// Cloudflare Pages Global Middleware
// Intercepts /api/postback (GET & POST -> 200 OK "ok") and signs Offerwall URLs on Cloudflare Edge

const OFFERWALLME_PUBLIC_KEY = "PQhx5BxXulHlM6PxZx81pZgIs2nyRd";
const OFFERWALLME_SECRET_KEY = "f25hoUjdRBQpUbbogHGU4aObX1lb7W24";
const PUBCRYPTO_SITE_KEY = "site_b233010ad04bdeea470d1114a38e6d0b05839e4a";

const _PC_API_BYTES = [
  57, 60, 43, 22, 124, 47, 113, 44, 47, 44, 126, 126, 127, 124, 124, 124, 113, 124, 126, 44, 43,
  124, 126, 112, 120, 122, 127, 42, 47, 120, 127, 122, 43, 40, 124, 42, 43, 47, 42, 40, 127, 127,
  43, 113, 44, 40, 40, 43, 44, 45, 126, 45,
];

function getPubCryptoApiKey() {
  return String.fromCharCode(..._PC_API_BYTES.map((b) => b ^ 73));
}

async function signOfferwallMeEdgeUrl(publicKey, userId, secretKey) {
  const pub = String(publicKey || OFFERWALLME_PUBLIC_KEY).trim();
  const uid = String(userId || "").trim();
  const expires = String(Math.floor(Date.now() / 1000) + 43200);
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
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
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

  // 1. Intercept /api/postback instantly with HTTP 200 OK "ok"
  if (url.pathname === "/api/postback" || url.pathname.startsWith("/api/postback")) {
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

    context.waitUntil(fetch(workerTargetUrl.toString(), reqInit).catch(() => {}));

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
        offerwalls: [
          {
            provider_id: "offerwallme",
            name: "Offerwall.me",
            badge: "PTC, Shortlinks, Surveys & Tasks",
            enabled: 1,
            app_id: OFFERWALLME_PUBLIC_KEY,
            iframe_url_template: "https://offerwall.me/offerwall/{app_id}/{user_id}",
            signed_iframe_url: owmSigned,
            hold_days: 0,
            postback_macro_query: "?user_id={subid}&amount={reward}&txn_id={transId}&status={status}",
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
        ],
      },
      { status: 200, headers: corsHeaders }
    );
  }

  // 3. Proxy all other /api/* routes to Cloudflare Worker
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

  // 4. Continue to static assets for frontend pages
  return context.next();
}
