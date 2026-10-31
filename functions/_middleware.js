// Cloudflare Pages Global Middleware
// Intercepts /api/postback (GET & POST -> 200 OK "ok"), signs Offerwall URLs on Cloudflare Edge,
// auto-syncs Offerwall.me completed task history, and persists state in D1 + Cloudflare Edge Cache.

import worker from "./worker.js";

const OFFERWALLME_PUBLIC_KEY = "PQhx5BxXulHlM6PxZx81pZgIs2nyRd";
const OFFERWALLME_SECRET_KEY = "f25hoUjdRBQpUbbogHGU4aObX1lb7W24";
const PUBCRYPTO_SITE_KEY = "site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198";
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
      postback_macro_query: "?user_id={subid}&amount={reward_pb}&txn_id={transId}&status={status}",
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

  // Delegate all /api/* routes to worker.js (if D1 DB bound) or proxy to primary Worker endpoint
  if (url.pathname.startsWith("/api/")) {
    if (context.env && context.env.DB) {
      try {
        const resp = await worker.fetch(request, context.env);
        if (resp && resp.status !== 503) {
          return resp;
        }
      } catch {}
    }

    // Proxy fallback to primary Worker endpoint if Pages context lacks DB
    try {
      const workerTargetUrl = new URL(
        "https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search
      );
      const reqInit = {
        method: request.method,
        headers: request.headers,
      };
      if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
        try {
          reqInit.body = await request.clone().text();
        } catch {}
      }
      const proxyResp = await fetch(workerTargetUrl.toString(), reqInit);
      const respHeaders = new Headers(proxyResp.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
      return new Response(proxyResp.body, {
        status: proxyResp.status,
        statusText: proxyResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502, headers: corsHeaders });
    }
  }

  // Continue to static assets for frontend pages
  return context.next();
}
