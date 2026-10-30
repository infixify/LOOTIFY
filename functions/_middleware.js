// Cloudflare Pages Global Middleware
// Intercepts /api/postback (GET & POST -> 200 OK "ok"), signs Offerwall URLs on Cloudflare Edge,
// auto-syncs Offerwall.me completed task history, and persists state in D1 + Cloudflare Edge Cache.

import worker from "./worker.js";

const OFFERWALLME_PUBLIC_KEY = "PQhx5BxXulHlM6PxZx81pZgIs2nyRd";
const OFFERWALLME_SECRET_KEY = "f25hoUjdRBQpUbbogHGU4aObX1lb7W24";
const PUBCRYPTO_SITE_KEY = "site_b233010ad04bdeea470d1114a38e6d0b05839e4a";
const ADMIN_EMAIL = "sarthaksinghyadav1@gmail.com";

const _PC_API_BYTES = [
  57, 60, 43, 22, 124, 47, 113, 44, 47, 44, 126, 126, 127, 124, 124, 124, 113, 124, 126, 44, 43,
  124, 126, 112, 120, 122, 127, 42, 47, 120, 127, 122, 43, 40, 124, 42, 43, 47, 42, 40, 127, 127,
  43, 113, 44, 40, 40, 43, 44, 45, 126, 45,
];

function getPubCryptoApiKey() {
  return String.fromCharCode(..._PC_API_BYTES.map((b) => b ^ 73));
}

async function computeOfferwallMeSignature(publicKey, userId, expires, secretKey) {
  const pub = String(publicKey || OFFERWALLME_PUBLIC_KEY).trim();
  const uid = String(userId || "").trim();
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey || OFFERWALLME_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signOfferwallMeEdgeUrl(publicKey, userId, secretKey) {
  const pub = String(publicKey || OFFERWALLME_PUBLIC_KEY).trim();
  const uid = String(userId || "").trim();
  const expires = String(Math.floor(Date.now() / 1000) + 43200);
  const signature = await computeOfferwallMeSignature(pub, uid, expires, secretKey);
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
}

async function fetchOfferwallMeHistoryEdge(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  try {
    const pub = OFFERWALLME_PUBLIC_KEY;
    const expires = String(Math.floor(Date.now() / 1000) + 3600);
    const signature = await computeOfferwallMeSignature(pub, uid, expires, OFFERWALLME_SECRET_KEY);
    const resp = await fetch(
      `https://offerwall.me/api/public/history/${encodeURIComponent(pub)}?userId=${encodeURIComponent(
        uid
      )}`,
      {
        headers: {
          "x-offerwall-user-expires": expires,
          "x-offerwall-user-signature": signature,
        },
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data || !Array.isArray(data.history)) return [];
    return data.history.filter((item) => {
      if (!item) return false;
      const st = String(item.status || "").trim().toLowerCase();
      const reward = Number(item.reward) || 0;
      // Allow reversal/rejection entries through so sync loop can deduct if previously credited
      if (st === "reversed" || st === "rejected" || st === "chargeback" || reward < 0) {
        return true;
      }
      // Strictly reject pending, failed, postback failed, cancelled, disqualified, or rejected tasks
      if (
        reward <= 0 ||
        item.rejectionReason ||
        st === "pending" ||
        st === "failed" ||
        st === "postback failed" ||
        st.includes("fail") ||
        st === "cancelled" ||
        st === "disqualified" ||
        st === "expired"
      ) {
        return false;
      }
      // Explicit whitelist: only genuinely completed & Offerwall.me-approved conversions where publisher is paid
      return st === "approved" || st === "completed";
    });
  } catch {
    return [];
  }
}

async function createPubCryptoEdgeUrl(siteKey, userId, theme = "dark") {
  const sKey = String(siteKey || PUBCRYPTO_SITE_KEY).trim();
  const uid = String(userId || "").trim();
  const cleanTheme = theme === "light" ? "light" : "dark";
  const apiKey = getPubCryptoApiKey();
  if (apiKey && uid) {
    try {
      const resp = await fetch("https://pub.cryptolinkforearn.com/api/publisher/embed-tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_key: sKey,
          sub_id: uid,
          origin: "https://lootify.eternant.c0m.to",
          theme: cleanTheme,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.iframe_url) return String(data.iframe_url);
      }
    } catch {}
  }
  return `https://pub.cryptolinkforearn.com/offerwall/?site_key=${encodeURIComponent(
    sKey
  )}&sub_id=${encodeURIComponent(uid || "guest")}&theme=${cleanTheme}`;
}

function pickCleanParam(params, keys) {
  for (const k of keys) {
    const val = params.get(k);
    if (val !== null && val !== undefined) {
      const trimmed = String(val).trim();
      if (
        trimmed &&
        !trimmed.includes("{") &&
        !trimmed.includes("}") &&
        !trimmed.includes("[") &&
        !trimmed.includes("]")
      ) {
        return trimmed;
      }
    }
  }
  for (const k of keys) {
    const val = params.get(k);
    if (val !== null && val !== undefined && String(val).trim()) {
      return String(val).trim();
    }
  }
  return "";
}

async function edgeGetJson(key, fallbackVal = null) {
  try {
    if (typeof caches === "undefined" || !caches.default) return fallbackVal;
    const cacheKey = new Request(
      `https://edge-store.lootify.internal/${encodeURIComponent(key)}`,
      { method: "GET" }
    );
    const match = await caches.default.match(cacheKey);
    if (!match) return fallbackVal;
    return await match.json();
  } catch {
    return fallbackVal;
  }
}

async function edgePutJson(key, value) {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const cacheKey = new Request(
      `https://edge-store.lootify.internal/${encodeURIComponent(key)}`,
      { method: "GET" }
    );
    const resp = new Response(JSON.stringify(value), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=31536000",
      },
    });
    await caches.default.put(cacheKey, resp);
  } catch {}
}

function getDefaultOfferwallsList(owmSigned = "", pcSigned = "") {
  return [
    {
      provider_id: "offerwallme",
      name: "Offerwall.me",
      badge: "PTC, Shortlinks, Surveys & Tasks",
      enabled: 1,
      app_id: OFFERWALLME_PUBLIC_KEY,
      iframe_url_template: "https://offerwall.me/offerwall/{app_id}/{user_id}",
      signed_iframe_url: owmSigned,
      hold_days: 0,
      postback_macro_query: "?user_id={subId}&amount={reward}&txn_id={transId}&status={status}",
    },
    {
      provider_id: "pubcrypto",
      name: "PubCrypto",
      badge: "Shortlinks, PTC, Tasks & Offerwalls",
      enabled: 1,
      app_id: PUBCRYPTO_SITE_KEY,
      iframe_url_template:
        "https://pub.cryptolinkforearn.com/offerwall/?site_key={app_id}&sub_id={user_id}&theme=dark",
      signed_iframe_url: pcSigned,
      hold_days: 0,
      postback_macro_query: "",
    },
  ];
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-admin-email",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Intercept /api/postback instantly with HTTP 200 OK "ok" + persist credit in Edge Cache
  if (url.pathname === "/api/postback" || url.pathname.startsWith("/api/postback")) {
    const params = new URLSearchParams(url.search);
    let rawBodyText = "";
    if (request.method === "POST" || request.method === "PUT") {
      try {
        rawBodyText = await request.clone().text();
        const ct = (request.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) {
          const parsed = JSON.parse(rawBodyText);
          Object.entries(parsed || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null) params.set(k, String(v));
          });
        } else {
          const bodyParams = new URLSearchParams(rawBodyText);
          bodyParams.forEach((v, k) => {
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              params.set(k, v);
            }
          });
        }
      } catch {}
    }

    const userId = pickCleanParam(params, [
      "subId",
      "subid",
      "sub_id",
      "user_id",
      "uid",
      "user",
      "userid",
      "click_id",
    ]);
    const rawAmount = pickCleanParam(params, [
      "reward_pb",
      "reward",
      "amount",
      "coins",
      "points",
      "currency",
      "payout_pb",
      "payout",
    ]);
    const rawTxId =
      pickCleanParam(params, [
        "transId",
        "trans_id",
        "txn_id",
        "tx_id",
        "transaction_id",
        "id",
        "offer_id",
      ]) || `tx_${Date.now()}`;
    const rawStatus = pickCleanParam(params, ["status", "type"]) || "1";
    const offerName =
      pickCleanParam(params, ["offer_name", "offer", "task"]) || "Offerwall Task";
    const isPubCrypto = Boolean(params.get("reward_pb") || params.get("payout_pb"));
    const providerId = isPubCrypto ? "pubcrypto" : "offerwallme";
    const coins = Number(Math.abs(parseFloat(rawAmount || "0") || 0).toFixed(2));
    const txKey = providerId === "offerwallme" ? `owm_${rawTxId}` : `${providerId}_${rawTxId}`;

    const handleEdgePostbackPersist = async () => {
      try {
        const globalIdx = (await edgeGetJson("global_index", null)) || {
          userIds: [],
          postbacks: [],
          withdrawals: [],
        };

        const normStatus = String(rawStatus || "1").trim().toLowerCase();
        const isReversal =
          normStatus === "2" ||
          normStatus === "reversed" ||
          normStatus === "chargeback" ||
          normStatus === "rejected";
        const isApprovedStatus =
          normStatus === "1" ||
          normStatus === "approved" ||
          normStatus === "completed" ||
          normStatus === "credit";
        const isTestPing =
          !userId ||
          userId.includes("{") ||
          userId.includes("[") ||
          userId.toLowerCase() === "test-user-123" ||
          String(rawTxId).toUpperCase().startsWith("TEST-OFFER-") ||
          coins <= 0;

        const pbEntry = {
          id: "ldg_" + Date.now(),
          user_id: userId || "NETWORK_VERIFIER",
          user_name: userId || "Network Test",
          source_type: "offerwall",
          title: `${providerId.toUpperCase()}: ${offerName}`,
          amount_coins: coins,
          status: isTestPing
            ? "verified_ping"
            : isReversal
            ? "reversed_chargeback"
            : isApprovedStatus
            ? "credited"
            : "ignored_non_approved",
          external_tx_id: txKey,
          created_at: new Date().toISOString(),
        };

        if (
          !globalIdx.postbacks.some(
            (p) =>
              p &&
              p.external_tx_id === txKey &&
              p.status === pbEntry.status &&
              txKey !== "owm_"
          )
        ) {
          globalIdx.postbacks.unshift(pbEntry);
          globalIdx.postbacks = globalIdx.postbacks.slice(0, 100);
        }

        if (!isTestPing && (isApprovedStatus || isReversal)) {
          let edgeUser = (await edgeGetJson(`user_${userId}`, null)) || {
            id: userId,
            name: userId,
            email: `${userId}@lootify.local`,
            authProvider: "google",
            referralCode: "LOOT100",
            referredBy: null,
            availableCoins: 0,
            pendingCoins: 0,
            questsCompleted: 0,
            referralsCount: 0,
            faucetClaimsCount: 0,
            lastFaucetClaimAt: null,
            joinedAt: new Date().toISOString().slice(0, 10),
            withdrawals: [],
            heldRewards: [],
            faucetHistory: [],
            creditedTxIds: [],
            reversedTxIds: [],
          };

          const creditedSet = new Set(
            Array.isArray(edgeUser.creditedTxIds) ? edgeUser.creditedTxIds : []
          );
          const reversedSet = new Set(
            Array.isArray(edgeUser.reversedTxIds) ? edgeUser.reversedTxIds : []
          );

          if (isReversal) {
            if (!reversedSet.has(txKey)) {
              reversedSet.add(txKey);
              edgeUser.availableCoins = Number(
                Math.max(0, (Number(edgeUser.availableCoins) || 0) - coins).toFixed(2)
              );
              edgeUser.heldRewards = (
                Array.isArray(edgeUser.heldRewards) ? edgeUser.heldRewards : []
              ).map((h) => (h && h.id === txKey ? { ...h, status: "reversed" } : h));
              edgeUser.reversedTxIds = Array.from(reversedSet);
              await edgePutJson(`user_${userId}`, edgeUser);
            }
          } else if (isApprovedStatus && !creditedSet.has(txKey) && !reversedSet.has(txKey)) {
            creditedSet.add(txKey);
            edgeUser.availableCoins = Number(
              ((Number(edgeUser.availableCoins) || 0) + coins).toFixed(2)
            );
            edgeUser.questsCompleted = (Number(edgeUser.questsCompleted) || 0) + 1;
            const rewardEntry = {
              id: txKey,
              title: `${providerId.toUpperCase()}: ${offerName}`,
              coins,
              amountInr: Number((coins / 100).toFixed(4)),
              status: "credited",
              createdAt: new Date().toISOString().slice(0, 10),
              unlocksAt: null,
            };
            edgeUser.heldRewards = [
              rewardEntry,
              ...(Array.isArray(edgeUser.heldRewards) ? edgeUser.heldRewards : []).filter(
                (h) => h && h.id !== txKey
              ),
            ].slice(0, 50);
            edgeUser.creditedTxIds = Array.from(creditedSet);
            edgeUser.reversedTxIds = Array.from(reversedSet);
            await edgePutJson(`user_${userId}`, edgeUser);
            if (!globalIdx.userIds.includes(userId)) {
              globalIdx.userIds.push(userId);
            }
          }
        }

        await edgePutJson("global_index", globalIdx);
      } catch {}

      try {
        if (context.env && context.env.DB) {
          const d1PostbackReq = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body:
              rawBodyText && (request.method === "POST" || request.method === "PUT")
                ? rawBodyText
                : undefined,
          });
          await worker.fetch(d1PostbackReq, context.env);
        } else {
          const workerTargetUrl = new URL(
            "https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search
          );
          const reqInit = {
            method: request.method,
            headers: request.headers,
          };
          if (rawBodyText && (request.method === "POST" || request.method === "PUT")) {
            reqInit.body = rawBodyText;
          }
          await fetch(workerTargetUrl.toString(), reqInit);
        }
      } catch {}
    };

    context.waitUntil(handleEdgePostbackPersist());

    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 2. Edge-Signed Offerwall URLs (/api/offerwalls/signed-url & /api/offerwalls)
  if (url.pathname === "/api/offerwalls/signed-url" && request.method === "GET") {
    const reqUserId = (
      url.searchParams.get("user_id") ||
      request.headers.get("x-user-id") ||
      ""
    ).trim();
    const providerId = (url.searchParams.get("provider_id") || "offerwallme")
      .trim()
      .toLowerCase();
    const reqTheme = (url.searchParams.get("theme") || "dark").trim();
    if (!reqUserId) {
      return Response.json({ error: "user_id is required" }, { status: 400, headers: corsHeaders });
    }
    if (providerId === "pubcrypto") {
      const signedUrl = await createPubCryptoEdgeUrl(PUBCRYPTO_SITE_KEY, reqUserId, reqTheme);
      return Response.json(
        {
          ok: true,
          provider_id: "pubcrypto",
          signed_iframe_url: signedUrl,
          server_time: Math.floor(Date.now() / 1000),
        },
        { status: 200, headers: corsHeaders }
      );
    }
    const signedUrl = await signOfferwallMeEdgeUrl(
      OFFERWALLME_PUBLIC_KEY,
      reqUserId,
      OFFERWALLME_SECRET_KEY
    );
    return Response.json(
      {
        ok: true,
        provider_id: "offerwallme",
        signed_iframe_url: signedUrl,
        server_time: Math.floor(Date.now() / 1000),
      },
      { status: 200, headers: corsHeaders }
    );
  }

  if (url.pathname === "/api/offerwalls" && request.method === "GET") {
    const reqUserId = (
      url.searchParams.get("user_id") ||
      request.headers.get("x-user-id") ||
      ""
    ).trim();
    const reqTheme = (url.searchParams.get("theme") || "dark").trim();

    const owmSigned = reqUserId
      ? await signOfferwallMeEdgeUrl(OFFERWALLME_PUBLIC_KEY, reqUserId, OFFERWALLME_SECRET_KEY)
      : "";
    const pcSigned = reqUserId
      ? await createPubCryptoEdgeUrl(PUBCRYPTO_SITE_KEY, reqUserId, reqTheme)
      : "";

    return Response.json(
      {
        ok: true,
        server_time: Math.floor(Date.now() / 1000),
        offerwalls: getDefaultOfferwallsList(owmSigned, pcSigned),
      },
      { status: 200, headers: corsHeaders }
    );
  }

  if (url.pathname === "/api/system/db-check") {
    return await worker.fetch(request, context.env);
  }

  // 2B. Direct D1 Execution when Cloudflare D1 binding (`DB`) is connected in Dashboard
  if (url.pathname.startsWith("/api/") && context.env && context.env.DB) {
    return await worker.fetch(request, context.env);
  }

  // 3. Edge User Sync + Automatic Offerwall.me History Auto-Credit (/api/user/sync & /api/auth/*)
  if (
    (url.pathname === "/api/user/sync" ||
      url.pathname === "/api/auth/google" ||
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/register") &&
    request.method === "POST"
  ) {
    let body = {};
    try {
      body = await request.clone().json();
    } catch {}

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || email.split("@")[0] || "Player").trim();
    const userId =
      String(body.id || "").trim() ||
      "plr_" +
        btoa(email || "guest")
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 10)
          .toLowerCase();

    if (!email && !userId) {
      return Response.json({ error: "Email or ID is required" }, { status: 400, headers: corsHeaders });
    }

    const edgeUser = await edgeGetJson(`user_${userId}`, null);
    const incomingCredited = Array.isArray(body.creditedTxIds) ? body.creditedTxIds : [];
    const edgeCredited =
      edgeUser && Array.isArray(edgeUser.creditedTxIds) ? edgeUser.creditedTxIds : [];
    const incomingHeld = Array.isArray(body.heldRewards) ? body.heldRewards : [];
    const edgeHeld = edgeUser && Array.isArray(edgeUser.heldRewards) ? edgeUser.heldRewards : [];

    const creditedSet = new Set([...incomingCredited, ...edgeCredited]);
    for (const h of [...incomingHeld, ...edgeHeld]) {
      if (h && h.id && (String(h.id).startsWith("owm_") || String(h.id).startsWith("pubcrypto_"))) {
        creditedSet.add(String(h.id));
      }
    }

    // Merge heldRewards without duplicates
    const heldMap = new Map();
    for (const h of [...edgeHeld, ...incomingHeld]) {
      if (h && h.id && !heldMap.has(h.id)) {
        heldMap.set(h.id, h);
      }
    }

    // Merge withdrawals without duplicates
    const wdMap = new Map();
    const incomingWd = Array.isArray(body.withdrawals) ? body.withdrawals : [];
    const edgeWd = edgeUser && Array.isArray(edgeUser.withdrawals) ? edgeUser.withdrawals : [];
    for (const w of [...edgeWd, ...incomingWd]) {
      if (w && w.id && !wdMap.has(w.id)) {
        wdMap.set(w.id, w);
      }
    }

    // Merge faucetHistory without duplicates
    const fhMap = new Map();
    const incomingFh = Array.isArray(body.faucetHistory) ? body.faucetHistory : [];
    const edgeFh = edgeUser && Array.isArray(edgeUser.faucetHistory) ? edgeUser.faucetHistory : [];
    for (const f of [...edgeFh, ...incomingFh]) {
      if (f && f.id && !fhMap.has(f.id)) {
        fhMap.set(f.id, f);
      }
    }

    let availableCoins = Number(
      Math.max(Number(body.availableCoins) || 0, Number(edgeUser && edgeUser.availableCoins) || 0).toFixed(2)
    );
    let pendingCoins = Number(
      Math.max(Number(body.pendingCoins) || 0, Number(edgeUser && edgeUser.pendingCoins) || 0).toFixed(2)
    );
    let questsCompleted = Math.max(
      Number(body.questsCompleted) || 0,
      Number(edgeUser && edgeUser.questsCompleted) || 0
    );
    let faucetClaimsCount = Math.max(
      Number(body.faucetClaimsCount) || 0,
      Number(edgeUser && edgeUser.faucetClaimsCount) || 0
    );

    // Fetch live Offerwall.me completed task history for this userId & auto-credit any uncredited tasks!
    const owmHistory = await fetchOfferwallMeHistoryEdge(userId);
    let newlyCreditedCoins = 0;
    let newlyCreditedCount = 0;

    const globalIdx = (await edgeGetJson("global_index", null)) || {
      userIds: [],
      postbacks: [],
      withdrawals: [],
    };

    const reversedSet = new Set(
      edgeUser && Array.isArray(edgeUser.reversedTxIds) ? edgeUser.reversedTxIds : []
    );

    for (const item of owmHistory) {
      const rawTx = String(item.transactionId || item.id || "").trim();
      if (!rawTx) continue;
      const txKey = `owm_${rawTx}`;
      const st = String(item.status || "").trim().toLowerCase();
      const rawReward = Number(item.reward) || 0;
      const rewardCoins = Number(Math.abs(rawReward).toFixed(2));
      if (rewardCoins <= 0) continue;

      const isReversedOrRejected =
        st === "reversed" || st === "rejected" || st === "chargeback" || rawReward < 0;

      if (isReversedOrRejected) {
        if (creditedSet.has(txKey) && !reversedSet.has(txKey)) {
          reversedSet.add(txKey);
          availableCoins = Number(Math.max(0, availableCoins - rewardCoins).toFixed(2));
          if (heldMap.has(txKey)) {
            heldMap.set(txKey, { ...heldMap.get(txKey), status: "reversed" });
          }
        }
        continue;
      }

      if (st === "postback failed" || st.includes("fail")) continue;

      const isApprovedConversion =
        !item.rejectionReason &&
        (st === "approved" || st === "completed");
      if (!isApprovedConversion) continue;

      if (!creditedSet.has(txKey) && !reversedSet.has(txKey)) {
        creditedSet.add(txKey);
        availableCoins = Number((availableCoins + rewardCoins).toFixed(2));
        questsCompleted += 1;
        newlyCreditedCoins = Number((newlyCreditedCoins + rewardCoins).toFixed(2));
        newlyCreditedCount += 1;

        const createdDate = item.createdAt
          ? String(item.createdAt).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const taskType = String(item.type || "Task").toUpperCase();
        const taskTitle = String(item.title || "Completed Offer");

        heldMap.set(txKey, {
          id: txKey,
          title: `OFFERWALL.ME (${taskType}): ${taskTitle}`,
          coins: rewardCoins,
          amountInr: Number((rewardCoins / 100).toFixed(4)),
          status: "credited",
          createdAt: createdDate,
          unlocksAt: null,
        });

        if (!globalIdx.postbacks.some((p) => p && p.external_tx_id === txKey)) {
          globalIdx.postbacks.unshift({
            id: "ldg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            user_id: userId,
            user_name: name,
            source_type: "offerwall",
            title: `OFFERWALL.ME (${taskType}): ${taskTitle}`,
            amount_coins: rewardCoins,
            status: "credited",
            external_tx_id: txKey,
            created_at: item.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    // Ensure questsCompleted is at least the count of credited tasks + faucet claims
    questsCompleted = Math.max(questsCompleted, creditedSet.size + faucetClaimsCount);

    const cleanPrefix = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "LOOT";
    const mergedUser = {
      id: userId,
      name,
      email: email || (edgeUser && edgeUser.email) || `${userId}@lootify.local`,
      authProvider: body.authProvider === "email" ? "email" : "google",
      referralCode:
        body.referralCode ||
        (edgeUser && edgeUser.referralCode) ||
        cleanPrefix + Math.floor(100 + Math.random() * 900),
      referredBy: body.referredBy || (edgeUser && edgeUser.referredBy) || null,
      availableCoins,
      pendingCoins,
      questsCompleted,
      referralsCount: Math.max(
        Number(body.referralsCount) || 0,
        Number(edgeUser && edgeUser.referralsCount) || 0
      ),
      faucetClaimsCount,
      lastFaucetClaimAt:
        body.lastFaucetClaimAt || (edgeUser && edgeUser.lastFaucetClaimAt) || null,
      joinedAt:
        body.joinedAt ||
        (edgeUser && edgeUser.joinedAt) ||
        new Date().toISOString().slice(0, 10),
      withdrawals: Array.from(wdMap.values()).slice(0, 50),
      heldRewards: Array.from(heldMap.values()).slice(0, 50),
      faucetHistory: Array.from(fhMap.values()).slice(0, 30),
      creditedTxIds: Array.from(creditedSet),
      reversedTxIds: Array.from(reversedSet),
    };

    await edgePutJson(`user_${userId}`, mergedUser);
    if (!globalIdx.userIds.includes(userId)) {
      globalIdx.userIds.push(userId);
    }
    globalIdx.postbacks = globalIdx.postbacks.slice(0, 100);
    await edgePutJson("global_index", globalIdx);

    return Response.json(
      {
        ok: true,
        user: mergedUser,
        newlyCreditedCoins,
        newlyCreditedCount,
      },
      { status: 200, headers: corsHeaders }
    );
  }

  // 4. Edge Faucet Claim Handler (/api/faucet/claim)
  if (url.pathname === "/api/faucet/claim" && request.method === "POST") {
    let body = {};
    try {
      body = await request.clone().json();
    } catch {}
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400, headers: corsHeaders });
    }
    const edgeUser = await edgeGetJson(`user_${userId}`, null);
    if (!edgeUser) {
      return Response.json(
        { error: "Please sync your wallet first." },
        { status: 404, headers: corsHeaders }
      );
    }

    const rollNumber = Math.floor(Math.random() * 10000);
    const rewardCoins =
      rollNumber >= 9998 ? 50 : rollNumber >= 9986 ? 10 : rollNumber >= 9886 ? 3 : 1;
    const nowIso = new Date().toISOString();

    edgeUser.availableCoins = Number(((Number(edgeUser.availableCoins) || 0) + rewardCoins).toFixed(2));
    edgeUser.questsCompleted = (Number(edgeUser.questsCompleted) || 0) + 1;
    edgeUser.faucetClaimsCount = (Number(edgeUser.faucetClaimsCount) || 0) + 1;
    edgeUser.lastFaucetClaimAt = nowIso;
    edgeUser.faucetHistory = [
      {
        id: "fc_" + Date.now(),
        rollNumber,
        coins: rewardCoins,
        payoutMode: "wallet",
        createdAt: nowIso.slice(0, 16).replace("T", " "),
      },
      ...(Array.isArray(edgeUser.faucetHistory) ? edgeUser.faucetHistory : []),
    ].slice(0, 30);

    await edgePutJson(`user_${userId}`, edgeUser);
    return Response.json(
      {
        ok: true,
        rollNumber,
        rewardCoins,
        payoutMode: "wallet",
        notice: `+${rewardCoins} Coin(s) added to your Lootify Wallet!`,
        user: edgeUser,
      },
      { status: 200, headers: corsHeaders }
    );
  }

  // 5. Edge Admin Dashboard Handler (/api/admin/dashboard)
  if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
    const adminHeader = (
      request.headers.get("x-admin-email") ||
      url.searchParams.get("admin_email") ||
      ""
    )
      .trim()
      .toLowerCase();
    if (adminHeader !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403, headers: corsHeaders });
    }

    const globalIdx = (await edgeGetJson("global_index", null)) || {
      userIds: [],
      postbacks: [],
      withdrawals: [],
    };
    const users = [];
    for (const uid of globalIdx.userIds || []) {
      const u = await edgeGetJson(`user_${uid}`, null);
      if (u) users.push(u);
    }

    return Response.json(
      {
        ok: true,
        users,
        withdrawals: globalIdx.withdrawals || [],
        postbacks: globalIdx.postbacks || [],
        offerwalls: getDefaultOfferwallsList("", ""),
      },
      { status: 200, headers: corsHeaders }
    );
  }

  // 6. Proxy all other /api/* routes to Cloudflare Worker with graceful fallback
  if (url.pathname.startsWith("/api/")) {
    const workerTargetUrl = new URL(
      "https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search
    );
    const reqInit = {
      method: request.method,
      headers: request.headers,
    };

    if (request.method === "POST" || request.method === "PUT") {
      try {
        reqInit.body = await request.clone().text();
      } catch {}
    }

    try {
      const resp = await fetch(workerTargetUrl.toString(), reqInit);
      const respHeaders = new Headers(resp.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502, headers: corsHeaders });
    }
  }

  // 7. Continue to static assets for frontend pages
  return context.next();
}
