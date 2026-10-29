// Cloudflare Pages Global Middleware
// Intercepts ALL incoming requests to /api/postback and returns "ok" for POST & GET requests

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
    const workerTargetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search);

    let reqInit = {
      method: request.method,
      headers: request.headers,
    };

    if (request.method === "POST" || request.method === "PUT") {
      try {
        reqInit.body = await request.clone().text();
      } catch {}
    }

    context.waitUntil(
      fetch(workerTargetUrl.toString(), reqInit).catch(() => {})
    );

    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 2. Proxy all other /api/* routes to Cloudflare Worker
  if (url.pathname.startsWith("/api/")) {
    const workerTargetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search);
    let reqInit = {
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

  // 3. Continue to static assets for frontend pages
  return context.next();
}
