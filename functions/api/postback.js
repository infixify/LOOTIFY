// Cloudflare Pages Function for Universal Postback (/api/postback)
// Accepts GET & POST requests, credits D1 database, and returns "ok"

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-admin-email, Authorization",
    "Content-Type": "text/plain; charset=utf-8",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Forward postback payload asynchronously to main Worker D1 Backend
    const workerTargetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev/api/postback");
    workerTargetUrl.search = url.search;

    let requestInit = {
      method: request.method,
      headers: request.headers,
    };

    if (request.method === "POST") {
      try {
        const bodyText = await request.clone().text();
        requestInit.body = bodyText;
      } catch {}
    }

    // Fire and forget fetch to Worker so DB is updated
    context.waitUntil(
      fetch(workerTargetUrl.toString(), requestInit).catch(() => {})
    );

    // Return immediate HTTP 200 OK "ok" to Offerwall verifiers
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
}
