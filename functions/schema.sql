-- ============================================================================
-- LOOTIFY — CLOUDFLARE D1 (SERVERLESS SQLITE) DATABASE SCHEMA (functions/schema.sql)
-- Note: functions/worker.js automatically creates these tables on first request,
-- so pushing to Git works automatically without manual SQL execution!
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
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
  status TEXT DEFAULT 'pending_hold',
  external_tx_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  unlocks_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_external_tx
ON ledger_entries(external_tx_id)
WHERE external_tx_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  method TEXT NOT NULL,
  tier_label TEXT NOT NULL,
  coins_deducted INTEGER NOT NULL,
  amount_inr REAL NOT NULL,
  payout_details_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS offerwall_configs (
  provider_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  badge TEXT DEFAULT 'Offerwall & Tasks',
  enabled INTEGER DEFAULT 1,
  app_id TEXT DEFAULT '',
  iframe_url_template TEXT DEFAULT '',
  secret_key TEXT DEFAULT '',
  hold_days INTEGER DEFAULT 0,
  postback_macro_query TEXT DEFAULT '?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Real Founder Admin Account (Email: sarthaksinghyadav1@gmail.com)
INSERT OR IGNORE INTO users (
  id, name, email, password_hash, role, referral_code, available_coins, pending_coins, lifetime_earned_coins
) VALUES (
  'usr_admin_1', 'Sarthak (Founder & Admin)', 'sarthaksinghyadav1@gmail.com', 'admin123', 'admin', 'LOOTADMIN', 0, 0, 0
);
