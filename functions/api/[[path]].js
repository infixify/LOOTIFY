// Cloudflare Pages Function Proxy for all /api/* routes
// Seamlessly forwards requests to Worker API backend

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-admin-email, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle /api/postback specially with immediate "ok"
  if (url.pathname === "/api/postback" || url.pathname.startsWith("/api/postback/")) {
    const workerTargetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search);
    
    let requestInit = {
      method: request.method,
      headers: request.headers,
    };

    if (request.method === "POST" || request.method === "PUT") {
      try {
        requestInit.body = await request.clone().text();
      } catch {}
    }

    context.waitUntil(
      fetch(workerTargetUrl.toString(), requestInit).catch(() => {})
    );

    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Proxy all other /api/* calls to Cloudflare Worker
  const targetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev" + url.pathname + url.search);
  
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
    const resp = await fetch(targetUrl.toString(), reqInit);
    const respHeaders = new Headers(resp.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return Response.json({ error: "API proxy error: " + err.message }, { status: 502, headers: corsHeaders });
  }
}
