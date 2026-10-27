/**
 * ============================================================================
 * LOOTIFY — CLOUDFLARE WORKER + D1 SQL BACKEND (functions/worker.js)
 * Zero Sleep (0ms Cold Start) · Handles Notik.me & Lootably S2S Postbacks
 * ============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-user-id",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. S2S OFFERWALL POSTBACK WEBHOOK (Notik.me / Lootably / Monetag)
    // URL: https://api.lootify.in/api/postback/notik?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1
    if (url.pathname.startsWith("/api/postback/")) {
      const provider = url.pathname.split("/").pop().toUpperCase();
      const userId = url.searchParams.get("user_id") || url.searchParams.get("uid") || "";
      const coins = parseInt(url.searchParams.get("amount") || url.searchParams.get("coins") || "0", 10);
      const txId = url.searchParams.get("txn_id") || url.searchParams.get("tx_id") || ("TX_" + Date.now());
      const status = url.searchParams.get("status") || "1"; // 1 = Credit, 2 = Chargeback Reversal

      if (!userId || coins <= 0) {
        return new Response("INVALID_PARAMS", { status: 400, headers: corsHeaders });
      }

      const holdDays = 3;
      const unlocksAt = new Date(Date.now() + holdDays * 86400000).toISOString();

      if (status === "2") {
        await env.DB.prepare(
          "UPDATE users SET pending_coins = MAX(0, pending_coins - ?) WHERE id = ?"
        ).bind(coins, userId).run();

        await env.DB.prepare(
          "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, 'Earner', 'chargeback_reversal', ?, ?, 'reversed_chargeback', ?)"
        ).bind("ldg_cb_" + Date.now(), userId, provider + " Chargeback (" + txId + ")", -coins, txId).run();

        return new Response("OK_CHARGEBACK_REVERSED", { status: 200, headers: corsHeaders });
      }

      await env.DB.prepare(
        "UPDATE users SET pending_coins = pending_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ?, offerwalls_completed = offerwalls_completed + 1 WHERE id = ?"
      ).bind(coins, coins, userId).run();

      await env.DB.prepare(
        "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id, unlocks_at) VALUES (?, ?, 'Earner', 'offerwall', ?, ?, 'pending_hold', ?, ?)"
      ).bind("ldg_" + Date.now(), userId, provider + " Offerwall (" + txId + ")", coins, txId, unlocksAt).run();

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "Lootify Cloudflare Worker + D1 Engine",
      }, { headers: corsHeaders });
    }

    return Response.json({ message: "Lootify S2S Functions Active" }, { headers: corsHeaders });
  }
};
