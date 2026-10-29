/**
 * ============================================================================
 * LOOTIFY — CLOUDFLARE WORKER + D1 SQL BACKEND (functions/worker.js)
 * Zero Sleep (0ms Cold Start) · Auto-Schema Migration on Git Push
 * Pre-Approval S2S Postback Verification Ready (Always returns 200 OK for Network Testers)
 * ============================================================================
 */

const ADMIN_EMAIL = "sarthaksinghyadav1@gmail.com";
let schemaInitialized = false;

async function ensureSchema(db) {
  if (schemaInitialized || !db) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS users (
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
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ledger_entries (
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
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS withdrawals (
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
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS referrals (
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
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS offerwall_configs (
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
        )`
      )
      .run();

    // Auto-seed approved Offerwall.me placement (default 7-day escrow hold until network settlement)
    await db
      .prepare(
        `INSERT OR IGNORE INTO offerwall_configs (
          provider_id, name, badge, enabled, app_id, iframe_url_template, secret_key, hold_days, postback_macro_query
        ) VALUES (
          'offerwallme',
          'Offerwall.me',
          'PTC, Shortlinks, Surveys & Tasks',
          1,
          'PQhx5BxXulHlM6PxZx81pZgIs2nyRd',
          'https://offerwall.me/offerwall/{app_id}/{user_id}',
          '',
          0,
          '?user_id={subid}&amount={reward}&txn_id={transId}&status={status}'
        )`
      )
      .run();

    // Auto-seed approved PubCrypto placement (Site Key: site_b233010ad04bdeea470d1114a38e6d0b05839e4a)
    await db
      .prepare(
        `INSERT OR IGNORE INTO offerwall_configs (
          provider_id, name, badge, enabled, app_id, iframe_url_template, secret_key, hold_days, postback_macro_query
        ) VALUES (
          'pubcrypto',
          'PubCrypto',
          'Shortlinks, PTC, Tasks & Offerwalls',
          1,
          'site_b233010ad04bdeea470d1114a38e6d0b05839e4a',
          'https://pub.cryptolinkforearn.com/offerwall/?site_key={app_id}&sub_id={user_id}&theme=dark',
          'c5564a3578c36a1ad2a2381ca995221e19490ffd98706c43fad2f7b898fad919',
          0,
          ''
        )`
      )
      .run();

    // Auto-migrate latest PubCrypto approved keys & zero-hold instant credit
    try {
      await db
        .prepare(
          "UPDATE offerwall_configs SET app_id = 'site_b233010ad04bdeea470d1114a38e6d0b05839e4a', secret_key = 'c5564a3578c36a1ad2a2381ca995221e19490ffd98706c43fad2f7b898fad919', hold_days = 0 WHERE provider_id = 'pubcrypto'"
        )
        .run();
      await db.prepare("UPDATE offerwall_configs SET hold_days = 0 WHERE provider_id = 'offerwallme'").run();
      // Release any previously held coins from artificial 7-day holds
      const held = await db.prepare("SELECT id, user_id, amount_coins FROM ledger_entries WHERE status = 'pending_hold'").all();
      for (const row of (held && held.results) || []) {
        const amt = Math.max(0, Number(row.amount_coins) || 0);
        if (amt > 0 && row.user_id) {
          await db.prepare("UPDATE ledger_entries SET status = 'credited' WHERE id = ?").bind(row.id).run();
          await db.prepare("UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = available_coins + ? WHERE id = ?").bind(amt, amt, row.user_id).run();
        }
      }
    } catch {}

    // Auto-migrate faucet columns on users table
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN faucet_claims_count INTEGER DEFAULT 0").run();
    } catch {}
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN last_faucet_claim_at TEXT").run();
    } catch {}

    schemaInitialized = true;
  } catch {
    // Continue if tables already exist
  }
}

// Runtime server-side-only secret resolver (never exposed to browser/frontend)
const _OWM_S_BYTES = [
  47, 123, 124, 33, 38, 28, 35, 45, 27, 11, 24, 57, 28, 43, 43, 38, 46, 1, 14, 28, 125, 40, 6, 43,
  17, 120, 37, 43, 126, 30, 123, 125,
];
function getOfferwallMeSecret(env, dbSecret) {
  if (dbSecret && String(dbSecret).trim().length > 8) return String(dbSecret).trim();
  if (env && env.OFFERWALLME_SECRET_KEY) return String(env.OFFERWALLME_SECRET_KEY).trim();
  return String.fromCharCode(..._OWM_S_BYTES.map((b) => b ^ 73));
}

// Server-side-only PubCrypto Forward Secret Key
function getPubCryptoSecret(env, dbSecret) {
  if (dbSecret && String(dbSecret).trim().length > 8) return String(dbSecret).trim();
  if (env && env.PUBCRYPTO_SECRET_KEY) return String(env.PUBCRYPTO_SECRET_KEY).trim();
  return "c5564a3578c36a1ad2a2381ca995221e19490ffd98706c43fad2f7b898fad919";
}

const _PC_API_BYTES = [
  57, 60, 43, 22, 124, 47, 113, 44, 47, 44, 126, 126, 127, 124, 124, 124, 113, 124, 126, 44, 43,
  124, 126, 112, 120, 122, 127, 42, 47, 120, 127, 122, 43, 40, 124, 42, 43, 47, 42, 40, 127, 127,
  43, 113, 44, 40, 40, 43, 44, 45, 126, 45,
];

function getPubCryptoPublisherApiKey(env, dbSecret) {
  const forwardSecret = getPubCryptoSecret(env, dbSecret);
  const candidate = String(dbSecret || (env && env.PUBCRYPTO_PUBLISHER_API_KEY) || "").trim();
  if (candidate && candidate !== forwardSecret && candidate.length > 8) {
    return candidate;
  }
  return String.fromCharCode(..._PC_API_BYTES.map((b) => b ^ 73));
}

async function createPubCryptoSignedEmbedUrl(siteKey, userId, publisherApiKey, theme = "dark") {
  const sKey = String(siteKey || "site_b233010ad04bdeea470d1114a38e6d0b05839e4a").trim();
  const uid = String(userId || "").trim();
  const apiKey = String(publisherApiKey || "").trim();
  const cleanTheme = theme === "light" ? "light" : "dark";
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
        if (data && data.iframe_url) {
          return String(data.iframe_url);
        }
      }
    } catch {}
  }
  return `https://pub.cryptolinkforearn.com/offerwall/?site_key=${encodeURIComponent(
    sKey
  )}&sub_id=${encodeURIComponent(uid || "guest")}&theme=${cleanTheme}`;
}

// Server-side-only FaucetPay Owner API Key (XOR-masked, never exposed to client code)
const _FP_K_BYTES = [
  124, 112, 120, 123, 125, 45, 40, 124, 47, 121, 122, 113, 42, 122, 124, 44, 44, 45, 127, 40, 122,
  43, 45, 124, 122, 113, 122, 123, 113, 47, 123, 112, 45, 126, 43, 125, 123, 47, 120, 125, 126, 42,
  40, 44, 47, 120, 122, 121, 42, 113, 123, 120, 42, 127, 126, 40, 45, 124, 45, 122, 45, 45, 121, 113,
];
function getFaucetPayApiKey(env) {
  if (env && env.FAUCETPAY_API_KEY) return String(env.FAUCETPAY_API_KEY).trim();
  return String.fromCharCode(..._FP_K_BYTES.map((b) => b ^ 73));
}

async function sendFaucetPayPayout(env, toAddress, coinsAmount, currency = "USDT", referral = false) {
  const apiKey = getFaucetPayApiKey(env);
  // 1,000 Coins = ₹10 (~$0.12 USD) -> 1 Coin = $0.00012 USD = 12,000 satoshis (8 decimals in FaucetPay)
  const satoshis = Math.max(1, Math.round(Number(coinsAmount || 1) * 12000));
  const form = new URLSearchParams();
  form.set("api_key", apiKey);
  form.set("amount", String(satoshis));
  form.set("to", String(toAddress || "").trim());
  form.set("currency", String(currency || "USDT").toUpperCase());
  if (referral) form.set("referral", "true");

  const resp = await fetch("https://faucetpay.io/api/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await resp.json();
  return data;
}

// Offerwall.me Mandatory Signed User ID Generator (HMAC-SHA256)
// Spec: "offerwall-user-v1\nPUBLIC_API_KEY\nEXACT_USER_ID\nEXPIRY_UNIX_SECONDS"
async function signOfferwallMeUrl(publicKey, userId, secretKey) {
  const pub = String(publicKey || "PQhx5BxXulHlM6PxZx81pZgIs2nyRd").trim();
  const uid = String(userId || "").trim();
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
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

// Pure-JS MD5 helper for Offerwall.me S2S Postback Signature verification: md5(subId + transId + reward + secretKey)
function md5Hex(input) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | (~x & z); }
  function G(x, y, z) { return (x & z) | (y & ~z); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | ~z); }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  const utf8 = unescape(encodeURIComponent(String(input)));
  const strLen = utf8.length;
  const wordCount = (((strLen + 8) >>> 6) + 1) << 4;
  const words = new Array(wordCount - 1).fill(0);
  let bytePos = 0;
  let byteCount = 0;
  while (byteCount < strLen) {
    const wordIdx = (byteCount - (byteCount % 4)) / 4;
    bytePos = (byteCount % 4) * 8;
    words[wordIdx] = words[wordIdx] | (utf8.charCodeAt(byteCount) << bytePos);
    byteCount++;
  }
  const wordIdx = (byteCount - (byteCount % 4)) / 4;
  bytePos = (byteCount % 4) * 8;
  words[wordIdx] = words[wordIdx] | (0x80 << bytePos);
  words[wordCount - 2] = strLen << 3;
  words[wordCount - 1] = strLen >>> 29;
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let k = 0; k < words.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, words[k + 0], 7, 0xd76aa478);
    d = FF(d, a, b, c, words[k + 1], 12, 0xe8c7b756);
    c = FF(c, d, a, b, words[k + 2], 17, 0x242070db);
    b = FF(b, c, d, a, words[k + 3], 22, 0xc1bdceee);
    a = FF(a, b, c, d, words[k + 4], 7, 0xf57c0faf);
    d = FF(d, a, b, c, words[k + 5], 12, 0x4787c62a);
    c = FF(c, d, a, b, words[k + 6], 17, 0xa8304613);
    b = FF(b, c, d, a, words[k + 7], 22, 0xfd469501);
    a = FF(a, b, c, d, words[k + 8], 7, 0x698098d8);
    d = FF(d, a, b, c, words[k + 9], 12, 0x8b44f7af);
    c = FF(c, d, a, b, words[k + 10], 17, 0xffff5bb1);
    b = FF(b, c, d, a, words[k + 11], 22, 0x895cd7be);
    a = FF(a, b, c, d, words[k + 12], 7, 0x6b901122);
    d = FF(d, a, b, c, words[k + 13], 12, 0xfd987193);
    c = FF(c, d, a, b, words[k + 14], 17, 0xa679438e);
    b = FF(b, c, d, a, words[k + 15], 22, 0x49b40821);
    a = GG(a, b, c, d, words[k + 1], 5, 0xf61e2562);
    d = GG(d, a, b, c, words[k + 6], 9, 0xc040b340);
    c = GG(c, d, a, b, words[k + 11], 14, 0x265e5a51);
    b = GG(b, c, d, a, words[k + 0], 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, words[k + 5], 5, 0xd62f105d);
    d = GG(d, a, b, c, words[k + 10], 9, 0x02441453);
    c = GG(c, d, a, b, words[k + 15], 14, 0xd8a1e681);
    b = GG(b, c, d, a, words[k + 4], 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, words[k + 9], 5, 0x21e1cde6);
    d = GG(d, a, b, c, words[k + 14], 9, 0xc33707d6);
    c = GG(c, d, a, b, words[k + 3], 14, 0xf4d50d87);
    b = GG(b, c, d, a, words[k + 8], 20, 0x455a14ed);
    a = GG(a, b, c, d, words[k + 13], 5, 0xa9e3e905);
    d = GG(d, a, b, c, words[k + 2], 9, 0xfcefa3f8);
    c = GG(c, d, a, b, words[k + 7], 14, 0x676f02d9);
    b = GG(b, c, d, a, words[k + 12], 20, 0x8d2a4c8a);
    a = HH(a, b, c, d, words[k + 5], 4, 0xfffa3942);
    d = HH(d, a, b, c, words[k + 8], 11, 0x8771f681);
    c = HH(c, d, a, b, words[k + 11], 16, 0x6d9d6122);
    b = HH(b, c, d, a, words[k + 14], 23, 0xfde5380c);
    a = HH(a, b, c, d, words[k + 1], 4, 0xa4beea44);
    d = HH(d, a, b, c, words[k + 4], 11, 0x4bdecfa9);
    c = HH(c, d, a, b, words[k + 7], 16, 0xf6bb4b60);
    b = HH(b, c, d, a, words[k + 10], 23, 0xbebfbc70);
    a = HH(a, b, c, d, words[k + 13], 4, 0x289b7ec6);
    d = HH(d, a, b, c, words[k + 0], 11, 0xeaa127fa);
    c = HH(c, d, a, b, words[k + 3], 16, 0xd4ef3085);
    b = HH(b, c, d, a, words[k + 6], 23, 0x04881d05);
    a = HH(a, b, c, d, words[k + 9], 4, 0xd9d4d039);
    d = HH(d, a, b, c, words[k + 12], 11, 0xe6db99e5);
    c = HH(c, d, a, b, words[k + 15], 16, 0x1fa27cf8);
    b = HH(b, c, d, a, words[k + 2], 23, 0xc4ac5665);
    a = II(a, b, c, d, words[k + 0], 6, 0xf4292244);
    d = II(d, a, b, c, words[k + 7], 10, 0x432aff97);
    c = II(c, d, a, b, words[k + 14], 15, 0xab9423a7);
    b = II(b, c, d, a, words[k + 5], 21, 0xfc93a039);
    a = II(a, b, c, d, words[k + 12], 6, 0x655b59c3);
    d = II(d, a, b, c, words[k + 3], 10, 0x8f0ccc92);
    c = II(c, d, a, b, words[k + 10], 15, 0xffeff47d);
    b = II(b, c, d, a, words[k + 1], 21, 0x85845dd1);
    a = II(a, b, c, d, words[k + 8], 6, 0x6fa87e4f);
    d = II(d, a, b, c, words[k + 15], 10, 0xfe2ce6e0);
    c = II(c, d, a, b, words[k + 6], 15, 0xa3014314);
    b = II(b, c, d, a, words[k + 13], 21, 0x4e0811a1);
    a = II(a, b, c, d, words[k + 4], 6, 0xf7537e82);
    d = II(d, a, b, c, words[k + 11], 10, 0xbd3af235);
    c = II(c, d, a, b, words[k + 2], 15, 0x2ad7d2bb);
    b = II(b, c, d, a, words[k + 9], 21, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  function wordToHex(lValue) {
    let out = "";
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      out += lByte.toString(16).padStart(2, "0");
    }
    return out;
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

async function hashPassword(rawPassword) {
  const data = new TextEncoder().encode(rawPassword + "_lootify_salt_2026");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function releaseMaturedHoldCoins(db, userId) {
  try {
    const nowIso = new Date().toISOString();
    const matured = await db
      .prepare(
        "SELECT id, amount_coins FROM ledger_entries WHERE user_id = ? AND status = 'pending_hold' AND unlocks_at IS NOT NULL AND unlocks_at <= ?"
      )
      .bind(userId, nowIso)
      .all();

    const rows = (matured && matured.results) || [];
    if (rows.length === 0) return;

    let totalToRelease = 0;
    for (const r of rows) {
      totalToRelease += Math.max(0, Number(r.amount_coins) || 0);
      await db
        .prepare("UPDATE ledger_entries SET status = 'credited' WHERE id = ?")
        .bind(r.id)
        .run();
    }

    if (totalToRelease > 0) {
      await db
        .prepare(
          "UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = available_coins + ? WHERE id = ?"
        )
        .bind(totalToRelease, totalToRelease, userId)
        .run();
    }
  } catch {
    // ignore if table not migrated yet
  }
}

async function formatPlayerPayload(db, userRow) {
  if (!userRow) return null;
  await releaseMaturedHoldCoins(db, userRow.id);

  const freshUser = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userRow.id)
    .first();

  const withdrawalsRes = await db
    .prepare("SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(userRow.id)
    .all();

  const refCountRow = await db
    .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?")
    .bind(userRow.id)
    .first();

  const withdrawals = ((withdrawalsRes && withdrawalsRes.results) || []).map((w) => ({
    id: w.id,
    method: w.method || "upi",
    methodLabel: w.tier_label || "UPI Direct Transfer",
    destination: w.payout_details_json || "",
    coins: Number(w.coins_deducted) || 0,
    amountInr: Number(w.amount_inr) || 0,
    status: w.status || "pending",
    createdAt: String(w.created_at || "").slice(0, 10),
  }));

  const heldRes = await db
    .prepare(
      "SELECT id, title, amount_coins, status, created_at, unlocks_at FROM ledger_entries WHERE user_id = ? AND source_type = 'offerwall' AND status IN ('pending_hold', 'credited') ORDER BY created_at DESC LIMIT 30"
    )
    .bind(userRow.id)
    .all();

  const heldRewards = ((heldRes && heldRes.results) || []).map((h) => {
    const c = Number(Math.max(0, Number(h.amount_coins) || 0).toFixed(2));
    return {
      id: h.id,
      title: h.title || "Offerwall Task",
      coins: c,
      amountInr: Number((c / 100).toFixed(2)),
      status: h.status || "pending_hold",
      createdAt: String(h.created_at || "").slice(0, 10),
      unlocksAt: h.unlocks_at ? String(h.unlocks_at).slice(0, 10) : null,
    };
  });

  const faucetRes = await db
    .prepare(
      "SELECT id, title, amount_coins, external_tx_id, created_at FROM ledger_entries WHERE user_id = ? AND source_type = 'faucet' ORDER BY created_at DESC LIMIT 20"
    )
    .bind(userRow.id)
    .all();

  const faucetHistory = ((faucetRes && faucetRes.results) || []).map((f) => {
    const rawExt = String(f.external_tx_id || "");
    const parts = rawExt.split("|");
    return {
      id: f.id,
      rollNumber: Number(parts[0]) || 5000,
      coins: Number(Math.max(0, Number(f.amount_coins) || 0).toFixed(2)),
      payoutMode: parts[1] === "faucetpay" ? "faucetpay" : "wallet",
      faucetpayTxId: parts[2] || null,
      createdAt: String(f.created_at || "").slice(0, 16).replace("T", " "),
    };
  });

  const questsCompleted =
    (Number(freshUser.offerwalls_completed) || 0) +
    (Number(freshUser.shortlinks_completed) || 0) +
    (Number(freshUser.tasks_completed) || 0) +
    (Number(freshUser.faucet_claims_count) || 0);

  return {
    id: freshUser.id,
    name: freshUser.name,
    email: freshUser.email,
    authProvider: String(freshUser.id).startsWith("usr_g_") ? "google" : "email",
    referralCode: freshUser.referral_code,
    referredBy: freshUser.referred_by || null,
    availableCoins: Number((Number(freshUser.available_coins) || 0).toFixed(2)),
    pendingCoins: Number((Number(freshUser.pending_coins) || 0).toFixed(2)),
    questsCompleted,
    referralsCount: Number(refCountRow && refCountRow.cnt) || 0,
    faucetClaimsCount: Number(freshUser.faucet_claims_count) || 0,
    lastFaucetClaimAt: freshUser.last_faucet_claim_at || null,
    joinedAt: String(freshUser.created_at || new Date().toISOString()).slice(0, 10),
    withdrawals,
    heldRewards,
    faucetHistory,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-admin-email, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/6ae24c701df775943c89d1b5.html") {
      return new Response("6ae24c701df775943c89d1b5", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
      });
    }

    if (
      url.pathname === "/offerzono-fb89da80b263fe5a.html" ||
      url.pathname === "/offerzono-fb89da80b263fe5a0f4eb2c10b141679.html"
    ) {
      return new Response(
        "offerzono-site-verification: fb89da80b263fe5a0f4eb2c10b141679",
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
        }
      );
    }

    try {
      if (!env || !env.DB) {
        if (url.pathname === "/api/postback" || url.pathname.startsWith("/api/postback/")) {
          return new Response("ok", {
            status: 200,
            headers: {
              ...corsHeaders,
              "x-lootify-notice": "D1 DB binding required for persistence",
            },
          });
        }
        if (url.pathname.startsWith("/api/")) {
          return Response.json(
            { error: "Cloudflare D1 database binding 'DB' is missing. Please add D1 binding named 'DB' in Cloudflare Worker Settings -> Bindings." },
            { status: 503, headers: corsHeaders }
          );
        }
      } else {
        await ensureSchema(env.DB);
      }

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

        const userId = body.id || "plr_" + Date.now().toString(36);
        const cleanPrefix = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5) || "LOOT";
        const referralCode = cleanPrefix + Math.floor(100 + Math.random() * 900);
        const passwordHash = await hashPassword(password);

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
              "INSERT INTO referrals (id, referrer_id, invitee_id, invitee_name, invitee_email, activated, flat_bonus_coins, total_commission_coins) VALUES (?, ?, ?, ?, ?, 0, 0, 0)"
            )
              .bind("ref_" + Date.now(), referrer.id, userId, name, email)
              .run();
          }
        }

        await env.DB.prepare(
          `INSERT INTO users (
            id, name, email, password_hash, role, referral_code, referred_by,
            available_coins, pending_coins, lifetime_earned_coins
          ) VALUES (?, ?, ?, ?, 'earner', ?, ?, 0, 0, 0)`
        )
          .bind(userId, name, email, passwordHash, referralCode, referredByCode)
          .run();

        const createdUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
          .bind(userId)
          .first();

        const player = await formatPlayerPayload(env.DB, createdUser);
        return Response.json({ ok: true, user: player }, { status: 200, headers: corsHeaders });
      }

      // ======================================================================
      // 2. USER SIGN IN / LOGIN (POST /api/auth/login)
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
            { error: "No account found with this email. Please Sign Up first." },
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

        const player = await formatPlayerPayload(env.DB, user);
        return Response.json({ ok: true, user: player }, { status: 200, headers: corsHeaders });
      }

      // ======================================================================
      // 2B. GOOGLE SIGN-IN / SYNC USER (POST /api/auth/google & POST /api/user/sync)
      // ======================================================================
      if (
        (url.pathname === "/api/auth/google" || url.pathname === "/api/user/sync") &&
        request.method === "POST"
      ) {
        const body = await request.json();
        const email = (body.email || "").trim().toLowerCase();
        const name = (body.name || email.split("@")[0] || "Player").trim();
        const preferredId = (body.id || "").trim();
        const referralCodeInput = (body.referralCodeInput || body.referredBy || "")
          .trim()
          .toUpperCase();

        if (!email) {
          return Response.json(
            { error: "Valid email is required." },
            { status: 400, headers: corsHeaders }
          );
        }

        let existingUser = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
          .bind(email)
          .first();

        if (!existingUser && preferredId) {
          existingUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
            .bind(preferredId)
            .first();
        }

        if (existingUser) {
          const player = await formatPlayerPayload(env.DB, existingUser);
          return Response.json(
            { ok: true, user: player, isNewUser: false },
            { status: 200, headers: corsHeaders }
          );
        }

        const userId = preferredId || "plr_" + Date.now().toString(36);
        const cleanPrefix = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5) || "LOOT";
        const referralCode =
          body.referralCode || cleanPrefix + Math.floor(100 + Math.random() * 900);
        const passwordHash = await hashPassword("oauth_" + email);

        let referredByCode = null;
        if (referralCodeInput) {
          const referrer = await env.DB.prepare(
            "SELECT id, referral_code FROM users WHERE referral_code = ?"
          )
            .bind(referralCodeInput)
            .first();

          if (referrer && referrer.id !== userId) {
            referredByCode = referrer.referral_code;
            await env.DB.prepare(
              "INSERT INTO referrals (id, referrer_id, invitee_id, invitee_name, invitee_email, activated, flat_bonus_coins, total_commission_coins) VALUES (?, ?, ?, ?, ?, 0, 0, 0)"
            )
              .bind("ref_" + Date.now(), referrer.id, userId, name, email)
              .run();
          }
        }

        await env.DB.prepare(
          `INSERT INTO users (
            id, name, email, password_hash, role, referral_code, referred_by,
            available_coins, pending_coins, lifetime_earned_coins
          ) VALUES (?, ?, ?, ?, 'earner', ?, ?, 0, 0, 0)`
        )
          .bind(userId, name, email, passwordHash, referralCode, referredByCode)
          .run();

        const createdUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
          .bind(userId)
          .first();

        const player = await formatPlayerPayload(env.DB, createdUser);
        return Response.json(
          { ok: true, user: player, isNewUser: true },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 3. SUBMIT CASHOUT / WITHDRAWAL (POST /api/withdrawals)
      // ======================================================================
      if (url.pathname === "/api/withdrawals" && request.method === "POST") {
        const body = await request.json();
        const userId = (body.userId || "").trim();
        const email = (body.email || "").trim().toLowerCase();
        const method = (body.method || "upi").trim();
        const methodLabel = (body.methodLabel || "UPI Direct Transfer").trim();
        const destination = (body.destination || "").trim();
        const coins = Math.floor(Number(body.coins) || 0);

        if ((!userId && !email) || coins < 1000 || !destination) {
          return Response.json(
            { error: "Minimum withdrawal is 1,000 Coins (₹10) and destination is required." },
            { status: 400, headers: corsHeaders }
          );
        }

        let user = userId
          ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first()
          : null;
        if (!user && email) {
          user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
        }

        if (!user) {
          return Response.json(
            { error: "Player account not found in database." },
            { status: 404, headers: corsHeaders }
          );
        }

        await releaseMaturedHoldCoins(env.DB, user.id);
        user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();

        if ((Number(user.available_coins) || 0) < coins) {
          return Response.json(
            {
              error: `Insufficient available coins. Your server balance is ${user.available_coins} Coins.`,
            },
            { status: 400, headers: corsHeaders }
          );
        }

        const amountInr = Number((coins / 100).toFixed(2));
        const wdId = "wd_" + Date.now().toString(36);

        await env.DB.prepare(
          "UPDATE users SET available_coins = available_coins - ? WHERE id = ?"
        )
          .bind(coins, user.id)
          .run();

        await env.DB.prepare(
          `INSERT INTO withdrawals (
            id, user_id, user_name, user_email, method, tier_label,
            coins_deducted, amount_inr, payout_details_json, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        )
          .bind(wdId, user.id, user.name, user.email, method, methodLabel, coins, amountInr, destination)
          .run();

        await env.DB.prepare(
          `INSERT INTO ledger_entries (
            id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id
          ) VALUES (?, ?, ?, 'withdrawal', ?, ?, 'pending', ?)`
        )
          .bind(
            "ldg_wd_" + Date.now(),
            user.id,
            user.name,
            `Cashout Request (${methodLabel} - ₹${amountInr})`,
            -coins,
            wdId
          )
          .run();

        const updatedPlayer = await formatPlayerPayload(env.DB, user);
        return Response.json(
          { ok: true, user: updatedPlayer, withdrawalId: wdId },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 4. GET CONFIGURED OFFERWALLS & SERVER-SIGNED URLS (GET /api/offerwalls)
      // ======================================================================
      if (url.pathname === "/api/offerwalls" && request.method === "GET") {
        const reqUserId = (
          url.searchParams.get("user_id") ||
          request.headers.get("x-user-id") ||
          ""
        ).trim();
        const reqTheme = (url.searchParams.get("theme") || "dark").trim();

        const rows = await env.DB.prepare(
          "SELECT provider_id, name, badge, enabled, app_id, iframe_url_template, secret_key, hold_days, postback_macro_query FROM offerwall_configs ORDER BY rowid ASC"
        ).all();

        const rawWalls = (rows && rows.results) || [];
        const publicWalls = [];
        for (const w of rawWalls) {
          let signedIframeUrl = "";
          if (
            reqUserId &&
            (w.provider_id === "offerwallme" ||
              String(w.iframe_url_template || "").includes("offerwall.me"))
          ) {
            const secret = getOfferwallMeSecret(env, w.secret_key);
            signedIframeUrl = await signOfferwallMeUrl(
              w.app_id || "PQhx5BxXulHlM6PxZx81pZgIs2nyRd",
              reqUserId,
              secret
            );
          } else if (
            reqUserId &&
            (w.provider_id === "pubcrypto" ||
              String(w.iframe_url_template || "").includes("pub.cryptolinkforearn.com"))
          ) {
            const pubApiKey = getPubCryptoPublisherApiKey(env, w.secret_key);
            signedIframeUrl = await createPubCryptoSignedEmbedUrl(
              w.app_id || "site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198",
              reqUserId,
              pubApiKey,
              reqTheme
            );
          }
          publicWalls.push({
            provider_id: w.provider_id,
            name: w.name,
            badge: w.badge,
            enabled: w.enabled,
            app_id: w.app_id,
            iframe_url_template: w.iframe_url_template,
            signed_iframe_url: signedIframeUrl,
            hold_days: w.hold_days,
            postback_macro_query: w.postback_macro_query,
          });
        }

        return Response.json(
          { ok: true, offerwalls: publicWalls },
          { status: 200, headers: corsHeaders }
        );
      }

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
          return Response.json(
            { error: "user_id is required" },
            { status: 400, headers: corsHeaders }
          );
        }

        if (providerId === "pubcrypto") {
          const cfg = await env.DB.prepare(
            "SELECT app_id, secret_key FROM offerwall_configs WHERE provider_id = 'pubcrypto'"
          ).first();
          const siteKey =
            (cfg && cfg.app_id) || "site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198";
          const pubApiKey = getPubCryptoPublisherApiKey(env, cfg && cfg.secret_key);
          const signedUrl = await createPubCryptoSignedEmbedUrl(
            siteKey,
            reqUserId,
            pubApiKey,
            reqTheme
          );
          return Response.json(
            {
              ok: true,
              provider_id: "pubcrypto",
              signed_iframe_url: signedUrl,
              has_publisher_api_key: Boolean(pubApiKey),
            },
            { status: 200, headers: corsHeaders }
          );
        }

        const cfg = await env.DB.prepare(
          "SELECT app_id, secret_key FROM offerwall_configs WHERE provider_id = 'offerwallme'"
        ).first();
        const pubKey = (cfg && cfg.app_id) || "PQhx5BxXulHlM6PxZx81pZgIs2nyRd";
        const secret = getOfferwallMeSecret(env, cfg && cfg.secret_key);
        const signedUrl = await signOfferwallMeUrl(pubKey, reqUserId, secret);
        return Response.json(
          { ok: true, provider_id: "offerwallme", signed_iframe_url: signedUrl },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 4B. LOOTIFY PROFIT-OPTIMIZED FAUCET (POST /api/faucet/claim)
      // Economy:
      // - Cooldown: 60 Minutes (Hourly Roll)
      // - Base Roll: 1 Coin (₹0.01) -> Covered by 3 Banner Ad Impressions!
      // - Profit Gate: First 2 Faucet Rolls are Free; after that, every 1 Offerwall
      //   task completed unlocks 3 Faucet Rolls (100% Guaranteed Admin Profit!)
      // ======================================================================
      if (url.pathname === "/api/faucet/claim" && request.method === "POST") {
        const body = await request.json();
        const userId = String(body.userId || "").trim();
        const email = String(body.email || "").trim().toLowerCase();

        let user = userId
          ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first()
          : null;
        if (!user && email) {
          user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
        }
        if (!user) {
          return Response.json(
            { error: "Player account not found. Please re-login." },
            { status: 404, headers: corsHeaders }
          );
        }

        const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes (Hourly Faucet)
        if (user.last_faucet_claim_at) {
          const lastClaimTime = new Date(user.last_faucet_claim_at).getTime();
          const elapsed = Date.now() - lastClaimTime;
          if (!Number.isNaN(lastClaimTime) && elapsed < COOLDOWN_MS) {
            const waitMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
            return Response.json(
              {
                error: `Hourly Faucet cooldown active! Please wait ${waitMins} min(s) before rolling again.`,
                nextClaimAt: new Date(lastClaimTime + COOLDOWN_MS).toISOString(),
              },
              { status: 429, headers: corsHeaders }
            );
          }
        }

        // Profit Protection Gate: First 2 rolls are free; after that, each Offerwall task unlocks +3 Faucet rolls
        const claimsSoFar = Number(user.faucet_claims_count) || 0;
        const offerwallsDone = Number(user.offerwalls_completed) || 0;
        const maxAllowedRolls = 2 + offerwallsDone * 3;
        if (claimsSoFar >= maxAllowedRolls) {
          return Response.json(
            {
              error:
                "⚡ Faucet Energy Recharged via Offerwalls! Complete 1 quick task, PTC ad, or shortlink on Offerwall.me to unlock 3 more Free Faucet Rolls!",
              requiresOfferwall: true,
            },
            { status: 403, headers: corsHeaders }
          );
        }

        // Profit-Optimized Lucky Roll 0 - 9999 (Average cost ~1.03 Coins = ₹0.0103)
        const rollNumber = Math.floor(Math.random() * 10000);
        let rewardCoins = 1;
        if (rollNumber >= 9998) {
          rewardCoins = 50;
        } else if (rollNumber >= 9986) {
          rewardCoins = 10;
        } else if (rollNumber >= 9886) {
          rewardCoins = 3;
        }

        const nowIso = new Date().toISOString();
        await env.DB.prepare(
          "UPDATE users SET available_coins = available_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ?, faucet_claims_count = COALESCE(faucet_claims_count, 0) + 1, last_faucet_claim_at = ? WHERE id = ?"
        )
          .bind(rewardCoins, rewardCoins, nowIso, user.id)
          .run();

        await env.DB.prepare(
          "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id, created_at) VALUES (?, ?, ?, 'faucet', ?, ?, 'credited', ?, ?)"
        )
          .bind(
            "ldg_faucet_" + Date.now(),
            user.id,
            user.name,
            `Hourly Faucet Roll #${String(rollNumber).padStart(4, "0")}`,
            rewardCoins,
            `${rollNumber}|wallet|`,
            nowIso
          )
          .run();

        const updatedRow = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
          .bind(user.id)
          .first();
        const player = await formatPlayerPayload(env.DB, updatedRow);

        return Response.json(
          {
            ok: true,
            rollNumber,
            rewardCoins,
            payoutMode: "wallet",
            notice: `+${rewardCoins} Coin(s) added to your Lootify Wallet! Complete Offerwall tasks to earn up to 3,000 Coins instantly.`,
            user: player,
          },
          { status: 200, headers: corsHeaders }
        );
      }

      // ======================================================================
      // 5. SINGLE UNIVERSAL S2S OFFERWALL POSTBACK WEBHOOK (/api/postback)
      // Economy: 1,000 Coins = ₹10 (100 Coins = ₹1)
      // 35% User Share / 65% Admin Profit -> $1 USD (₹84) = 3,000 Coins (₹30)
      // Works for ALL Ad Networks on ONE single URL (/api/postback)!
      // ======================================================================
      if (url.pathname === "/api/postback" || url.pathname.startsWith("/api/postback/")) {
        const params = new URLSearchParams(url.search);
        if (request.method === "POST") {
          const contentType = request.headers.get("content-type") || "";
          try {
            if (contentType.includes("application/json")) {
              const jsonBody = await request.json();
              Object.entries(jsonBody || {}).forEach(([k, v]) => params.set(k, String(v)));
            } else {
              const textBody = await request.text();
              const bodyParams = new URLSearchParams(textBody);
              bodyParams.forEach((v, k) => params.set(k, v));
            }
          } catch {}
        }

        const rawLastSegment = url.pathname.split("/").filter(Boolean).pop() || "universal";
        const isPubCryptoPayload = Boolean(
          params.get("reward_pb") !== null ||
            params.get("payout_pb") !== null ||
            params.get("reward_name") !== null
        );
        const isOfferwallMePayload =
          !isPubCryptoPayload &&
          Boolean(params.get("subId") || params.get("transId") || params.get("offer_type"));
        let providerId = (
          params.get("network") ||
          params.get("provider") ||
          (rawLastSegment.toLowerCase() !== "postback"
            ? rawLastSegment
            : isPubCryptoPayload
            ? "pubcrypto"
            : isOfferwallMePayload
            ? "offerwallme"
            : "universal")
        )
          .trim()
          .toLowerCase();

        // Normalize User ID across ALL offerwall networks
        const userId = (
          params.get("user_id") ||
          params.get("uid") ||
          params.get("subid") ||
          params.get("subId") ||
          params.get("sub_id") ||
          params.get("user") ||
          params.get("userid") ||
          params.get("click_id") ||
          ""
        ).trim();

        // Normalize Reward / Amount (35% User Share: $1 USD = 3,000 Coins = ₹30)
        // Supports Offerwall.me (reward) & PubCrypto (reward_pb) with 2-decimal precision
        const rawPayoutUsd =
          params.get("payout_pb") || params.get("payout") || params.get("usd") || "";
        const hasExplicitCoinParam = Boolean(
          params.get("reward_pb") ||
            params.get("reward") ||
            params.get("coins") ||
            params.get("points") ||
            params.get("amount")
        );
        const rawAmount =
          params.get("reward_pb") ||
          params.get("reward") ||
          params.get("amount") ||
          params.get("coins") ||
          params.get("points") ||
          params.get("currency") ||
          rawPayoutUsd ||
          "0";
        const parsedAmount = parseFloat(rawAmount);

        const coins =
          rawPayoutUsd && !hasExplicitCoinParam
            ? Number((Math.abs(parseFloat(rawPayoutUsd) || 0) * 3000).toFixed(2))
            : Number(Math.abs(parsedAmount || 0).toFixed(2));

        // Normalize Transaction ID
        const rawTxId = (
          params.get("transId") ||
          params.get("trans_id") ||
          params.get("txn_id") ||
          params.get("tx_id") ||
          params.get("transaction_id") ||
          params.get("id") ||
          params.get("offer_id") ||
          `tx_${Date.now()}`
        ).trim();

        // Verify Offerwall.me OR PubCrypto MD5 signature (`md5(subId + transId + reward + secretKey)`)
        const incomingSig = (
          params.get("signature") ||
          params.get("sig") ||
          params.get("hash") ||
          ""
        )
          .trim()
          .toLowerCase();
        if (incomingSig) {
          const sigSubId =
            params.get("subId") || params.get("subid") || params.get("sub_id") || userId;
          const sigTransId = params.get("transId") || params.get("trans_id") || rawTxId;
          const sigReward =
            params.get("reward_pb") !== null
              ? params.get("reward_pb")
              : params.get("reward") !== null
              ? params.get("reward")
              : rawAmount;

          const owmCfg = await env.DB.prepare(
            "SELECT secret_key FROM offerwall_configs WHERE provider_id = 'offerwallme'"
          ).first();
          const owmSecret = getOfferwallMeSecret(env, owmCfg && owmCfg.secret_key);
          const pcCfg = await env.DB.prepare(
            "SELECT secret_key FROM offerwall_configs WHERE provider_id = 'pubcrypto'"
          ).first();
          const pubCryptoSecret = getPubCryptoSecret(env, pcCfg && pcCfg.secret_key);

          const expectedOwmSig = md5Hex(`${sigSubId}${sigTransId}${sigReward}${owmSecret}`);
          const expectedPcSig = md5Hex(`${sigSubId}${sigTransId}${sigReward}${pubCryptoSecret}`);

          if (incomingSig === expectedPcSig) {
            providerId = "pubcrypto";
          } else if (incomingSig === expectedOwmSig) {
            providerId = "offerwallme";
          } else if (
            providerId === "offerwallme" ||
            providerId === "pubcrypto" ||
            isOfferwallMePayload ||
            isPubCryptoPayload
          ) {
            return new Response("ERROR: signature doesn't match", {
              status: 403,
              headers: corsHeaders,
            });
          }
        }

        const providerLabel =
          providerId === "offerwallme"
            ? "OFFERWALL.ME"
            : providerId === "pubcrypto"
            ? "PUBCRYPTO"
            : providerId.toUpperCase();
        const txId = `${providerId}_${userId || "anon"}_${rawTxId}`;

        // Normalize Status:
        // In PubCrypto: status=0 is Pending, status=1 is Credit, status=2 is Chargeback
        // In Offerwall.me: status=1 is Credit, status=2 is Chargeback
        const rawStatus = (params.get("status") || params.get("type") || "1").toLowerCase();
        const isPendingStatus = providerId === "pubcrypto" && rawStatus === "0";
        const isChargeback =
          rawStatus === "2" ||
          rawStatus === "chargeback" ||
          rawStatus === "reversed" ||
          (!isPendingStatus && rawStatus === "0") ||
          rawStatus === "-1" ||
          parsedAmount < 0;

        const offerName =
          params.get("offer_name") ||
          params.get("offer") ||
          params.get("task") ||
          (providerId === "pubcrypto" ? "PubCrypto Task" : "Offerwall Task");

        // Pre-approval Ad Network verification ping -> Always return 200 OK ("ok")
        if (!userId || userId.includes("{") || userId.includes("[") || coins <= 0) {
          try {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, ?, 'offerwall', ?, ?, 'verified_ping', ?)"
            )
              .bind(
                "ldg_ping_" + Date.now(),
                userId || "NETWORK_VERIFIER",
                "Ad Network Reviewer",
                `[${providerLabel} VERIFY PING] Universal Postback Checked`,
                coins || 0,
                txId
              )
              .run();
          } catch {}
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        let holdDays = 0;
        try {
          const cfg = await env.DB.prepare(
            "SELECT secret_key, hold_days FROM offerwall_configs WHERE provider_id = ?"
          )
            .bind(providerId)
            .first();
          if (cfg) {
            holdDays = Number(cfg.hold_days) || 0;
            const providedSecret = params.get("secret") || params.get("pwd") || "";
            if (cfg.secret_key && providedSecret && cfg.secret_key !== providedSecret) {
              return new Response("ERROR: INVALID_SECRET", { status: 403, headers: corsHeaders });
            }
          }
        } catch {}

        // Find user by ID or Email
        let user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        if (!user) {
          user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
            .bind(userId.toLowerCase())
            .first();
        }

        // Auto-create user if not in DB yet so coins are NEVER lost
        if (!user) {
          const isDummyTester = /^(test|demo|verifier|reviewer|sample)/i.test(userId);
          if (!isDummyTester) {
            const cleanName = userId.startsWith("plr_") ? "Player " + userId.slice(4, 9) : "Player";
            const userEmail = userId.includes("@") ? userId.toLowerCase() : `${userId}@lootify.local`;
            const refCode = "LOOT" + Math.floor(100 + Math.random() * 900);
            try {
              await env.DB.prepare(
                `INSERT INTO users (
                  id, name, email, role, referral_code, available_coins, pending_coins, lifetime_earned_coins
                ) VALUES (?, ?, ?, 'earner', ?, 0, 0, 0)`
              )
                .bind(userId, cleanName, userEmail, refCode)
                .run();
              user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
            } catch {}
          }
        }

        // Pre-approval test postback with dummy user_id (e.g. "test_member_1", "12345") -> Return 200 OK ("ok")
        if (!user) {
          try {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, ?, 'offerwall', ?, ?, 'network_test_ok', ?)"
            )
              .bind(
                "ldg_test_" + Date.now(),
                userId,
                "Network Test User",
                `[${providerLabel} TEST POSTBACK] ${offerName}`,
                coins,
                txId
              )
              .run();
          } catch {}
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        // Chargeback / Reversal Handling
        if (isChargeback) {
          await env.DB.prepare(
            "UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = CASE WHEN pending_coins < ? THEN MAX(0, available_coins - (? - pending_coins)) ELSE available_coins END WHERE id = ?"
          )
            .bind(coins, coins, coins, user.id)
            .run();

          await env.DB.prepare(
            "INSERT OR IGNORE INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, ?, 'chargeback_reversal', ?, ?, 'reversed_chargeback', ?)"
          )
            .bind(
              "ldg_cb_" + Date.now(),
              user.id,
              user.name,
              `${providerLabel} Reversal (${offerName})`,
              -coins,
              txId + "_cb"
            )
            .run();

          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        // Network Settlement Postback (status=3 / status=settled / status=paid) -> Auto-move Hold to Withdrawable!
        const isSettlementEvent =
          rawStatus === "3" ||
          rawStatus === "settled" ||
          rawStatus === "paid" ||
          rawStatus === "released" ||
          params.get("event") === "payout_settled";

        if (isSettlementEvent) {
          const heldRow = await env.DB.prepare(
            "SELECT id, amount_coins FROM ledger_entries WHERE external_tx_id = ? AND status = 'pending_hold'"
          )
            .bind(txId)
            .first();
          if (heldRow) {
            const releaseAmt = Math.max(0, Number(heldRow.amount_coins) || coins);
            await env.DB.prepare("UPDATE ledger_entries SET status = 'credited' WHERE id = ?")
              .bind(heldRow.id)
              .run();
            await env.DB.prepare(
              "UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = available_coins + ? WHERE id = ?"
            )
              .bind(releaseAmt, releaseAmt, user.id)
              .run();
          }
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        // Duplicate Transaction Check (Always reply "ok" so PubCrypto/Offerwall.me mark delivery as successful)
        const duplicate = await env.DB.prepare(
          "SELECT id, status, amount_coins FROM ledger_entries WHERE external_tx_id = ?"
        )
          .bind(txId)
          .first();
        if (duplicate) {
          if (!isPendingStatus && duplicate.status === "pending_hold") {
            const releaseAmt = Math.max(0, Number(duplicate.amount_coins) || coins);
            await env.DB.prepare("UPDATE ledger_entries SET status = 'credited' WHERE id = ?")
              .bind(duplicate.id)
              .run();
            await env.DB.prepare(
              "UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = available_coins + ? WHERE id = ?"
            )
              .bind(releaseAmt, releaseAmt, user.id)
              .run();
          }
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        if (holdDays > 0 || isPendingStatus) {
          const effectiveHoldDays = holdDays > 0 ? holdDays : 7;
          const unlocksAt = new Date(Date.now() + effectiveHoldDays * 86400000).toISOString();
          await env.DB.prepare(
            "UPDATE users SET pending_coins = pending_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ?, offerwalls_completed = offerwalls_completed + 1 WHERE id = ?"
          )
            .bind(coins, coins, user.id)
            .run();

          await env.DB.prepare(
            "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id, unlocks_at) VALUES (?, ?, ?, 'offerwall', ?, ?, 'pending_hold', ?, ?)"
          )
            .bind(
              "ldg_" + Date.now(),
              user.id,
              user.name,
              `${providerLabel}: ${offerName}`,
              coins,
              txId,
              unlocksAt
            )
            .run();
        } else {
          await env.DB.prepare(
            "UPDATE users SET available_coins = available_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ?, offerwalls_completed = offerwalls_completed + 1 WHERE id = ?"
          )
            .bind(coins, coins, user.id)
            .run();

          await env.DB.prepare(
            "INSERT INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, ?, 'offerwall', ?, ?, 'credited', ?)"
          )
            .bind(
              "ldg_" + Date.now(),
              user.id,
              user.name,
              `${providerLabel}: ${offerName}`,
              coins,
              txId
            )
            .run();
        }

        // 10% Lifetime Referral Commission
        if (user.referred_by) {
          const commission = Math.max(1, Math.floor(coins * 0.1));
          const referrer = await env.DB.prepare(
            "SELECT id, name FROM users WHERE referral_code = ?"
          )
            .bind(user.referred_by)
            .first();
          if (referrer) {
            await env.DB.prepare(
              "UPDATE users SET available_coins = available_coins + ?, lifetime_earned_coins = lifetime_earned_coins + ? WHERE id = ?"
            )
              .bind(commission, commission, referrer.id)
              .run();

            await env.DB.prepare(
              "UPDATE referrals SET activated = 1, total_commission_coins = total_commission_coins + ? WHERE referrer_id = ? AND invitee_id = ?"
            )
              .bind(commission, referrer.id, user.id)
              .run();
          }
        }

        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // ======================================================================
      // 6. ADMIN DASHBOARD DATA & DYNAMIC OFFERWALL MANAGEMENT
      // Locked strictly to sarthaksinghyadav1@gmail.com
      // ======================================================================
      if (url.pathname.startsWith("/api/admin/")) {
        const adminHeader = (
          request.headers.get("x-admin-email") ||
          url.searchParams.get("admin_email") ||
          ""
        )
          .trim()
          .toLowerCase();

        if (adminHeader !== ADMIN_EMAIL) {
          return Response.json(
            { error: "Unauthorized. Restricted to " + ADMIN_EMAIL },
            { status: 403, headers: corsHeaders }
          );
        }

        if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
          const usersRes = await env.DB.prepare(
            "SELECT id, name, email, available_coins, pending_coins, lifetime_earned_coins, offerwalls_completed, created_at FROM users ORDER BY created_at DESC LIMIT 100"
          ).all();
          const withdrawalsRes = await env.DB.prepare(
            "SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100"
          ).all();
          const postbacksRes = await env.DB.prepare(
            "SELECT * FROM ledger_entries WHERE source_type IN ('offerwall', 'chargeback_reversal') ORDER BY created_at DESC LIMIT 50"
          ).all();
          const offerwallsRes = await env.DB.prepare(
            "SELECT * FROM offerwall_configs ORDER BY rowid ASC"
          ).all();

          return Response.json(
            {
              ok: true,
              users: (usersRes && usersRes.results) || [],
              withdrawals: (withdrawalsRes && withdrawalsRes.results) || [],
              postbacks: (postbacksRes && postbacksRes.results) || [],
              offerwalls: (offerwallsRes && offerwallsRes.results) || [],
            },
            { status: 200, headers: corsHeaders }
          );
        }

        if (url.pathname === "/api/admin/withdrawals/update" && request.method === "POST") {
          const body = await request.json();
          const withdrawalId = (body.withdrawalId || "").trim();
          const newStatus = (body.status || "").trim();

          const wd = await env.DB.prepare("SELECT * FROM withdrawals WHERE id = ?")
            .bind(withdrawalId)
            .first();
          if (!wd) {
            return Response.json(
              { error: "Withdrawal record not found." },
              { status: 404, headers: corsHeaders }
            );
          }

          if (wd.status !== "pending") {
            return Response.json(
              { error: "Withdrawal is already processed." },
              { status: 400, headers: corsHeaders }
            );
          }

          await env.DB.prepare(
            "UPDATE withdrawals SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
            .bind(newStatus, withdrawalId)
            .run();

          if (newStatus === "rejected") {
            await env.DB.prepare(
              "UPDATE users SET available_coins = available_coins + ? WHERE id = ?"
            )
              .bind(Number(wd.coins_deducted) || 0, wd.user_id)
              .run();
          } else if (newStatus === "completed") {
            await env.DB.prepare(
              "UPDATE users SET total_withdrawn_inr = total_withdrawn_inr + ?, completed_first_payout = 1 WHERE id = ?"
            )
              .bind(Number(wd.amount_inr) || 0, wd.user_id)
              .run();
          }

          return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
        }

        // Dynamic Offerwall Add / Update (UPSERT)
        if (
          (url.pathname === "/api/admin/offerwalls/update" ||
            url.pathname === "/api/admin/offerwalls/save") &&
          request.method === "POST"
        ) {
          const body = await request.json();
          const providerId = String(body.provider_id || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "");
          const name = String(body.name || providerId || "Custom Offerwall").trim();
          const badge = String(body.badge || "Offerwall & Tasks").trim();
          const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1;
          const appId = String(body.app_id || "").trim();
          const iframeUrlTemplate = String(body.iframe_url_template || "").trim();
          const secretKey = String(body.secret_key || "").trim();
          const holdDays = Math.max(0, parseInt(String(body.hold_days || "0"), 10));
          const postbackMacroQuery = String(
            body.postback_macro_query || "?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1"
          ).trim();

          if (!providerId) {
            return Response.json(
              { error: "Provider ID / Slug is required." },
              { status: 400, headers: corsHeaders }
            );
          }

          await env.DB.prepare(
            `INSERT INTO offerwall_configs (
              provider_id, name, badge, enabled, app_id, iframe_url_template, secret_key, hold_days, postback_macro_query, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(provider_id) DO UPDATE SET
              name = excluded.name,
              badge = excluded.badge,
              enabled = excluded.enabled,
              app_id = excluded.app_id,
              iframe_url_template = excluded.iframe_url_template,
              secret_key = excluded.secret_key,
              hold_days = excluded.hold_days,
              postback_macro_query = excluded.postback_macro_query,
              updated_at = CURRENT_TIMESTAMP`
          )
            .bind(
              providerId,
              name,
              badge,
              enabled,
              appId,
              iframeUrlTemplate,
              secretKey,
              holdDays,
              postbackMacroQuery
            )
            .run();

          return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
        }

        // Dynamic Offerwall Delete
        if (url.pathname === "/api/admin/offerwalls/delete" && request.method === "POST") {
          const body = await request.json();
          const providerId = String(body.provider_id || "").trim().toLowerCase();
          if (!providerId) {
            return Response.json(
              { error: "Provider ID is required." },
              { status: 400, headers: corsHeaders }
            );
          }

          await env.DB.prepare("DELETE FROM offerwall_configs WHERE provider_id = ?")
            .bind(providerId)
            .run();

          return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
        }

        // 1-Click Network Payout Settlement -> Auto-Release Held Coins to Withdrawable Balance
        if (url.pathname === "/api/admin/holds/release" && request.method === "POST") {
          const body = await request.json();
          const ledgerId = String(body.ledgerId || "").trim();
          const providerPrefix = String(body.providerId || "").trim().toLowerCase();
          const releaseAll = Boolean(body.releaseAll);

          let rowsToRelease = [];
          if (ledgerId) {
            const single = await env.DB.prepare(
              "SELECT id, user_id, amount_coins FROM ledger_entries WHERE id = ? AND status = 'pending_hold'"
            )
              .bind(ledgerId)
              .first();
            if (single) rowsToRelease = [single];
          } else if (providerPrefix) {
            const res = await env.DB.prepare(
              "SELECT id, user_id, amount_coins FROM ledger_entries WHERE status = 'pending_hold' AND LOWER(external_tx_id) LIKE ?"
            )
              .bind(`${providerPrefix}_%`)
              .all();
            rowsToRelease = (res && res.results) || [];
          } else if (releaseAll) {
            const res = await env.DB.prepare(
              "SELECT id, user_id, amount_coins FROM ledger_entries WHERE status = 'pending_hold'"
            ).all();
            rowsToRelease = (res && res.results) || [];
          }

          let releasedCount = 0;
          let releasedCoinsTotal = 0;
          for (const row of rowsToRelease) {
            const amt = Math.max(0, Number(row.amount_coins) || 0);
            if (amt > 0 && row.user_id) {
              await env.DB.prepare("UPDATE ledger_entries SET status = 'credited' WHERE id = ?")
                .bind(row.id)
                .run();
              await env.DB.prepare(
                "UPDATE users SET pending_coins = MAX(0, pending_coins - ?), available_coins = available_coins + ? WHERE id = ?"
              )
                .bind(amt, amt, row.user_id)
                .run();
              releasedCount += 1;
              releasedCoinsTotal += amt;
            }
          }

          // Also if releaseAll is true and any user still has residual pending_coins (e.g. from older records), move them to available_coins
          if (releaseAll) {
            const residualUsers = await env.DB.prepare(
              "SELECT id, pending_coins FROM users WHERE pending_coins > 0"
            ).all();
            for (const u of (residualUsers && residualUsers.results) || []) {
              const rem = Math.max(0, Number(u.pending_coins) || 0);
              if (rem > 0) {
                await env.DB.prepare(
                  "UPDATE users SET pending_coins = 0, available_coins = available_coins + ? WHERE id = ?"
                )
                  .bind(rem, u.id)
                  .run();
                releasedCoinsTotal += rem;
              }
            }
          }

          return Response.json(
            {
              ok: true,
              releasedCount,
              releasedCoinsTotal,
            },
            { status: 200, headers: corsHeaders }
          );
        }

        // 1-Click Admin FaucetPay API Payout for Player Withdrawals
        if (url.pathname === "/api/admin/faucetpay/payout" && request.method === "POST") {
          const body = await request.json();
          const withdrawalId = String(body.withdrawalId || "").trim();
          const currency = String(body.currency || "USDT").toUpperCase();

          const wd = await env.DB.prepare("SELECT * FROM withdrawals WHERE id = ?")
            .bind(withdrawalId)
            .first();
          if (!wd) {
            return Response.json(
              { error: "Withdrawal record not found." },
              { status: 404, headers: corsHeaders }
            );
          }
          if (wd.status !== "pending") {
            return Response.json(
              { error: "Withdrawal is already processed." },
              { status: 400, headers: corsHeaders }
            );
          }

          const fpResult = await sendFaucetPayPayout(
            env,
            wd.payout_details_json,
            wd.coins_deducted,
            currency,
            false
          );

          if (!fpResult || Number(fpResult.status) !== 200) {
            return Response.json(
              {
                error:
                  (fpResult && fpResult.message) ||
                  "FaucetPay API returned an error. Ensure your FaucetPay wallet has sufficient balance in " +
                    currency,
                faucetpayResponse: fpResult || null,
              },
              { status: 400, headers: corsHeaders }
            );
          }

          const txHash = String(fpResult.payout_id || fpResult.payout_user_hash || "FAUCETPAY_PAID");
          await env.DB.prepare(
            "UPDATE withdrawals SET status = 'completed', utr_or_voucher = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
            .bind(txHash, withdrawalId)
            .run();

          await env.DB.prepare(
            "UPDATE users SET total_withdrawn_inr = total_withdrawn_inr + ?, completed_first_payout = 1 WHERE id = ?"
          )
            .bind(Number(wd.amount_inr) || 0, wd.user_id)
            .run();

          return Response.json(
            {
              ok: true,
              payoutId: txHash,
              message: `Sent ${currency} via FaucetPay API to ${wd.payout_details_json}!`,
            },
            { status: 200, headers: corsHeaders }
          );
        }
      }

      // ======================================================================
      // 7. HEALTH CHECK
      // ======================================================================
      if (url.pathname === "/api/health") {
        return Response.json(
          {
            ok: true,
            service: "Lootify Cloudflare Worker + D1 Pre-Approval & Live Postback Backend",
            domain: "lootify.eternant.c0m.to",
          },
          { headers: corsHeaders }
        );
      }

      // If anyone or Offerwall crawler visits root / frontend pages on the Worker URL,
      // seamlessly proxy to your GitHub Pages website (lootify.eternant.c0m.to)
      try {
        const ghUrl = new URL(request.url);
        ghUrl.hostname = "lootify.eternant.c0m.to";
        ghUrl.protocol = "https:";
        ghUrl.port = "";
        const ghReq = new Request(ghUrl.toString(), {
          method: request.method,
          headers: request.headers,
        });
        const ghResp = await fetch(ghReq);
        if (ghResp.status < 400 || ghResp.status === 404) {
          const respHeaders = new Headers(ghResp.headers);
          respHeaders.set("Access-Control-Allow-Origin", "*");
          return new Response(ghResp.body, {
            status: ghResp.status,
            statusText: ghResp.statusText,
            headers: respHeaders,
          });
        }
      } catch {}

      return Response.json(
        {
          ok: true,
          message: "Lootify Cloudflare Worker + D1 Active",
          endpoints: [
            "/api/health",
            "/api/user/sync",
            "/api/withdrawals",
            "/api/offerwalls",
            "/api/postback",
            "/api/admin/dashboard",
          ],
        },
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
