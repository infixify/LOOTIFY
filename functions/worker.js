/**
 * ============================================================================
 * LOOTIFY — CLOUDFLARE WORKER + D1 SQL BACKEND (functions/worker.js)
 * Zero Sleep (0ms Cold Start) · Auth (Sign Up / Login) + Wallet + S2S Postbacks
 * ============================================================================
 */

async function hashPassword(rawPassword) {
  const data = new TextEncoder().encode(rawPassword + "_lootify_salt_2026");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-user-id, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ======================================================================
      // 1. USER SIGN UP / REGISTER (POST /api/auth/register)
      // ======================================================================
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        const body = await request.json();
        const name = (body.name || "").trim();
        const email = (body.email || "").trim().toLowerCase();
        const password = (body.password || "").trim();
        const referralCodeInput = (body.referralCodeInput || "").trim().toUpperCase();

        if (!name || !email || !password) {
          return Response.json(
            { error: "Name, Email, and Password are required." },
            { status: 400, headers: corsHeaders }
          );
        }

        const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
          .bind(email)
          .first();
        if (existing) {
          return Response.json(
            { error: "This email is already registered. Please Sign In instead." },
            { status: 400, headers: corsHeaders }
          );
        }

        const userId = "usr_" + Date.now();
        const cleanPrefix = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5) || "USER";
        const referralCode = "LOOT-" + cleanPrefix + Math.floor(100 + Math.random() * 900);
        const passwordHash = await hashPassword(password);
        const welcomeBonus = 200; // ₹2.00 Welcome Bonus

        let referredByCode = null;
        if (referralCodeInput) {
          const referrer = await env.DB.prepare(
            "SELECT id, referral_code FROM users WHERE referral_code = ?"
          )
            .bind(referralCodeInput)
            .first();

          if (referrer) {
            referredByCode = referrer.referral_code;
            await env.DB.prepare(
              "INSERT INTO referrals (id, referrer_id, invitee_id, invitee_name, invitee_email, activated, flat_bonus_coins, total_commission_coins) VALUES (?, ?, ?, ?, ?, 0, 500, 0)"
            )
              .bind("ref_" + Date.now(), referrer.id, userId, name, email)
              .run();
          }
        }

        await env.DB.prepare(
          `INSERT INTO users (
            id, name, email, password_hash, role, referral_code, referred_by,
            available_coins, pending_coins, lifetime_earned_coins
          ) VALUES (?, ?, ?, ?, 'earner', ?, ?, ?, 0, ?)`
        )
          .bind(userId, name, email, passwordHash, referralCode, referredByCode, welcomeBonus, welcomeBonus)
          .run();

        await env.DB.prepare(
          `INSERT INTO ledger_entries (
            id, user_id, user_name, source_type, title, amount_coins, status
          ) VALUES (?, ?, ?, 'signup_bonus', 'Welcome Signup Bonus (+200 Coins)', ?, 'credited')`
        )
          .bind("ldg_welcome_" + Date.now(), userId, name, welcomeBonus)
          .run();

        const createdUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
          .bind(userId)
          .first();

        return Response.json(
          { ok: true, user: createdUser },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 2. USER & ADMIN SIGN IN / LOGIN (POST /api/auth/login)
      // ======================================================================
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const body = await request.json();
        const email = (body.email || "").trim().toLowerCase();
        const password = (body.password || "").trim();

        if (!email || !password) {
          return Response.json(
            { error: "Email and Password are required." },
            { status: 400, headers: corsHeaders }
          );
        }

        const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
          .bind(email)
          .first();

        if (!user) {
          return Response.json(
            { error: "No account found with this email. Please Create an Account first." },
            { status: 404, headers: corsHeaders }
          );
        }

        const hashedInput = await hashPassword(password);
        const passwordMatches =
          user.password_hash === hashedInput || user.password_hash === password;

        if (!passwordMatches) {
          return Response.json(
            { error: "Incorrect password. Please try again." },
            { status: 401, headers: corsHeaders }
          );
        }

        if (user.status === "banned") {
          return Response.json(
            { error: "This account has been suspended by Admin." },
            { status: 403, headers: corsHeaders }
          );
        }

        return Response.json(
          { ok: true, user },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 3. S2S OFFERWALL POSTBACK WEBHOOK (Notik.me / Lootably / Monetag)
      // URL: https://your-worker.workers.dev/api/postback/notik?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1
      // ======================================================================
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

      // ======================================================================
      // 4. HEALTH CHECK
      // ======================================================================
      if (url.pathname === "/api/health") {
        return Response.json(
          {
            ok: true,
            service: "Lootify Cloudflare Worker + D1 Auth & Wallet Engine",
          },
          { headers: corsHeaders }
        );
      }

      return Response.json(
        { message: "Lootify Cloudflare Worker + D1 Active" },
        { headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { error: err.message || "Internal Worker Error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
