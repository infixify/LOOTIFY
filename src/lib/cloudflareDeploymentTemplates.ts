import { SystemSettings } from '../types.ts';

export function generateCloudflareD1SchemaSql(): string {
  return `-- ============================================================================
-- LOOTIFY — CLOUDFLARE D1 (SERVERLESS SQLITE) DATABASE SCHEMA
-- Free Tier: 5,000,000 (50 Lakh) Reads/Day + 100,000 Writes/Day FREE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'earner',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  referral_activated INTEGER DEFAULT 0,
  available_coins INTEGER DEFAULT 0,
  pending_coins INTEGER DEFAULT 0,
  lifetime_earned_coins INTEGER DEFAULT 0,
  total_withdrawn_inr REAL DEFAULT 0,
  completed_first_payout INTEGER DEFAULT 0,
  offerwalls_completed INTEGER DEFAULT 0,
  shortlinks_completed INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_checkin_date TEXT,
  last_spin_date TEXT,
  ip_address TEXT,
  device_fingerprint TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  amount_coins INTEGER NOT NULL,
  status TEXT DEFAULT 'pending_hold', -- 'pending_hold' | 'cleared' | 'reversed_chargeback'
  external_tx_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  unlocks_at TEXT
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  method TEXT NOT NULL, -- 'upi' | 'bank' | 'gift_card' | 'ewallet' | 'crypto'
  tier_label TEXT NOT NULL,
  coins_deducted INTEGER NOT NULL,
  amount_inr REAL NOT NULL,
  payout_details_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  utr_or_voucher TEXT,
  admin_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  activated INTEGER DEFAULT 0,
  flat_bonus_coins INTEGER DEFAULT 0,
  total_commission_coins INTEGER DEFAULT 0,
  same_ip_flag INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS postback_logs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  external_tx_id TEXT NOT NULL,
  coins INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'credit' | 'chargeback'
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
`;
}

export function generateCloudflareWorkerCode(settings: SystemSettings): string {
  return `/**
 * ============================================================================
 * LOOTIFY — CLOUDFLARE WORKER + D1 SQL BACKEND (${settings.apiSubdomain})
 * Zero Sleep (0ms Cold Start) · Handles Notik.me & Lootably S2S Postbacks
 * ============================================================================
 *
 * HOW TO DEPLOY IN 2 MINUTES (100% FREE):
 * 1. Go to dash.cloudflare.com -> Workers & Pages -> Create Worker -> Name it "lootify-api"
 * 2. Go to D1 SQL Database -> Create Database "lootify-db" -> Paste schema.sql in Console
 * 3. In Worker Settings -> Bindings -> Add D1 Binding named: DB -> Select "lootify-db"
 * 4. Paste this code in Worker Editor and click "Deploy"!
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
    // URL: https://${settings.apiSubdomain}/api/postback/notik?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1
    if (url.pathname.startsWith("/api/postback/")) {
      const provider = url.pathname.split("/").pop().toUpperCase();
      const userId = url.searchParams.get("user_id") || url.searchParams.get("uid") || "";
      const coins = parseInt(url.searchParams.get("amount") || url.searchParams.get("coins") || "0", 10);
      const txId = url.searchParams.get("txn_id") || url.searchParams.get("tx_id") || ("TX_" + Date.now());
      const status = url.searchParams.get("status") || "1"; // 1 = Credit, 2 = Chargeback Reversal

      if (!userId || coins <= 0) {
        return new Response("INVALID_PARAMS", { status: 400, headers: corsHeaders });
      }

      const holdDays = ${settings.pendingHoldDays};
      const unlocksAt = new Date(Date.now() + holdDays * 86400000).toISOString();

      if (status === "2") {
        // Chargeback Reversal: Deduct from pending_coins
        await env.DB.prepare(
          "UPDATE users SET pending_coins = MAX(0, pending_coins - ?) WHERE id = ?"
        ).bind(coins, userId).run();

        await env.DB.prepare(
          "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, 'Earner', 'chargeback_reversal', ?, ?, 'reversed_chargeback', ?)"
        ).bind("ldg_cb_" + Date.now(), userId, provider + " Chargeback (" + txId + ")", -coins, txId).run();

        return new Response("OK_CHARGEBACK_REVERSED", { status: 200, headers: corsHeaders });
      }

      // Credit to 3-to-5-Day Pending Balance Hold
      await env.DB.prepare(
        "UPDATE users SET pending_coins = pending_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ?, offerwalls_completed = offerwalls_completed + 1 WHERE id = ?"
      ).bind(coins, coins, userId).run();

      await env.DB.prepare(
        "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id, unlocks_at) VALUES (?, ?, 'Earner', 'offerwall', ?, ?, 'pending_hold', ?, ?)"
      ).bind("ldg_" + Date.now(), userId, provider + " Offerwall (" + txId + ")", coins, txId, unlocksAt).run();

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // 2. HEALTH CHECK ENDPOINT
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "${settings.siteName} Cloudflare Worker + D1 Engine",
        domain: "${settings.customDomain}",
      }, { headers: corsHeaders });
    }

    return Response.json({ message: "Lootify S2S Worker Active" }, { headers: corsHeaders });
  }
};
`;
}
