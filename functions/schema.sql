-- ============================================================================
-- LOOTIFY — CLOUDFLARE D1 (SERVERLESS SQLITE) DATABASE SCHEMA (functions/schema.sql)
-- Free Tier: 5,000,000 (50 Lakh) Reads/Day + 100,000 Writes/Day FREE
-- Copy & Paste this entire file into Cloudflare D1 -> Console -> Execute
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

-- Default Admin Account (Email: admin@lootify.in | Password: admin123)
INSERT OR IGNORE INTO users (
  id, name, email, password_hash, role, referral_code, available_coins, pending_coins, lifetime_earned_coins
) VALUES (
  'usr_admin_1', 'Sarthak (Founder & Admin)', 'admin@lootify.in', 'admin123', 'admin', 'LOOT-ADMIN', 250000, 0, 250000
);

-- Default Demo Earner Account (Email: aarav@lootify.in | Password: 123456)
INSERT OR IGNORE INTO users (
  id, name, email, password_hash, role, referral_code, available_coins, pending_coins, lifetime_earned_coins
) VALUES (
  'usr_earner_1', 'Aarav Verma', 'aarav@lootify.in', '123456', 'earner', 'LOOT-AARAV', 1840, 1450, 5290
);
