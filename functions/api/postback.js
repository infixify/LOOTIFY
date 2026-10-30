// Cloudflare Pages Function for Universal Postback (/api/postback)
// Accepts GET & POST requests, credits D1 database (context.env.DB), and returns "ok"
import worker from "../worker.js";

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
    let bodyText = "";
    if (request.method === "POST" || request.method === "PUT") {
      try {
        bodyText = await request.clone().text();
      } catch {}
    }

    context.waitUntil(
      (async () => {
        try {
          if (env && env.DB) {
            const d1Req = new Request(request.url, {
              method: request.method,
              headers: request.headers,
              body: bodyText && (request.method === "POST" || request.method === "PUT") ? bodyText : undefined,
            });
            await worker.fetch(d1Req, env);
          } else {
            const workerTargetUrl = new URL("https://lootify-api.sarthaksinghyadav1.workers.dev/api/postback");
            workerTargetUrl.search = url.search;
            await fetch(workerTargetUrl.toString(), {
              method: request.method,
              headers: request.headers,
              body: bodyText && (request.method === "POST" || request.method === "PUT") ? bodyText : undefined,
            });
          }
        } catch {}
      })()
    );

    // Return immediate HTTP 200 OK "ok" to Offerwall verifiers
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
}

