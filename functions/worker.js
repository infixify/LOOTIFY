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

    // Auto-seed approved Offerwall.me placement so it is immediately active on Player Dashboard
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

  const questsCompleted =
    (Number(freshUser.offerwalls_completed) || 0) +
    (Number(freshUser.shortlinks_completed) || 0) +
    (Number(freshUser.tasks_completed) || 0);

  return {
    id: freshUser.id,
    name: freshUser.name,
    email: freshUser.email,
    authProvider: String(freshUser.id).startsWith("usr_g_") ? "google" : "email",
    referralCode: freshUser.referral_code,
    referredBy: freshUser.referred_by || null,
    availableCoins: Number(freshUser.available_coins) || 0,
    pendingCoins: Number(freshUser.pending_coins) || 0,
    questsCompleted,
    referralsCount: Number(refCountRow && refCountRow.cnt) || 0,
    joinedAt: String(freshUser.created_at || new Date().toISOString()).slice(0, 10),
    withdrawals,
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

    try {
      await ensureSchema(env.DB);

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
        if (!reqUserId) {
          return Response.json(
            { error: "user_id is required" },
            { status: 400, headers: corsHeaders }
          );
        }
        const cfg = await env.DB.prepare(
          "SELECT app_id, secret_key FROM offerwall_configs WHERE provider_id = 'offerwallme'"
        ).first();
        const pubKey = (cfg && cfg.app_id) || "PQhx5BxXulHlM6PxZx81pZgIs2nyRd";
        const secret = getOfferwallMeSecret(env, cfg && cfg.secret_key);
        const signedUrl = await signOfferwallMeUrl(pubKey, reqUserId, secret);
        return Response.json(
          { ok: true, signed_iframe_url: signedUrl },
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
        const isOfferwallMePayload = Boolean(
          params.get("subId") || params.get("transId") || params.get("offer_type")
        );
        const providerId = (
          params.get("network") ||
          params.get("provider") ||
          (rawLastSegment.toLowerCase() !== "postback"
            ? rawLastSegment
            : isOfferwallMePayload
            ? "offerwallme"
            : "universal")
        )
          .trim()
          .toLowerCase();
        const providerLabel =
          providerId === "offerwallme" ? "OFFERWALL.ME" : providerId.toUpperCase();

        // Normalize User ID across ALL offerwall networks
        const userId = (
          params.get("user_id") ||
          params.get("uid") ||
          params.get("subid") ||
          params.get("subId") ||
          params.get("user") ||
          params.get("userid") ||
          params.get("click_id") ||
          ""
        ).trim();

        // Normalize Reward / Amount (35% User Share: $1 USD = 3,000 Coins = ₹30)
        const rawPayoutUsd = params.get("payout") || params.get("usd") || "";
        const rawAmount =
          params.get("reward") ||
          params.get("amount") ||
          params.get("coins") ||
          params.get("points") ||
          params.get("currency") ||
          rawPayoutUsd ||
          "0";
        const parsedAmount = parseFloat(rawAmount);

        // If network sent USD decimal (or `payout` param), convert at 35% share ($1 = 3,000 Coins)
        const coins =
          rawPayoutUsd && !params.get("amount") && !params.get("coins") && !params.get("reward")
            ? Math.max(1, Math.round(Math.abs(parseFloat(rawPayoutUsd) || 0) * 3000))
            : parsedAmount > 0 && parsedAmount < 1 && rawAmount.includes(".")
            ? Math.max(1, Math.round(parsedAmount * 3000))
            : Math.round(Math.abs(parsedAmount || 0));

        // Normalize Transaction ID & scope with userId so multiple networks on 1 URL never collide
        const rawTxId = (
          params.get("transId") ||
          params.get("txn_id") ||
          params.get("tx_id") ||
          params.get("transaction_id") ||
          params.get("id") ||
          params.get("offer_id") ||
          `tx_${Date.now()}`
        ).trim();
        const txId = `${providerId}_${userId || "anon"}_${rawTxId}`;

        // Normalize Status
        const rawStatus = (params.get("status") || params.get("type") || "1").toLowerCase();
        const isChargeback =
          rawStatus === "2" ||
          rawStatus === "chargeback" ||
          rawStatus === "reversed" ||
          rawStatus === "0" ||
          rawStatus === "-1" ||
          parsedAmount < 0;

        const offerName =
          params.get("offer_name") ||
          params.get("offer") ||
          params.get("task") ||
          `Offerwall Task`;

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
                `[PRE-APPROVAL VERIFY PING] Universal Postback Checked`,
                coins || 0,
                txId
              )
              .run();
          } catch {}
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        // Verify Offerwall.me MD5 signature (`md5(subId + transId + reward + secretKey)`) or custom secret if provided
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
          const incomingSig = (params.get("signature") || "").trim().toLowerCase();
          if (incomingSig && (providerId === "offerwallme" || isOfferwallMePayload)) {
            const owmSecret = getOfferwallMeSecret(env, cfg && cfg.secret_key);
            const sigSubId = params.get("subId") || params.get("subid") || userId;
            const sigTransId = params.get("transId") || rawTxId;
            const sigReward = params.get("reward") || rawAmount;
            const expectedSig = md5Hex(`${sigSubId}${sigTransId}${sigReward}${owmSecret}`);
            if (expectedSig !== incomingSig) {
              return new Response("ERROR: Signature doesn't match", {
                status: 403,
                headers: corsHeaders,
              });
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

        // Pre-approval test postback with dummy user_id (e.g. "test", "12345") -> Return 200 OK ("ok")
        if (!user) {
          try {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO ledger_entries (id, user_id, user_name, source_type, title, amount_coins, status, external_tx_id) VALUES (?, ?, ?, 'offerwall', ?, ?, 'network_test_ok', ?)"
            )
              .bind(
                "ldg_test_" + Date.now(),
                userId,
                "Network Test User",
                `[NETWORK TEST POSTBACK] ${offerName}`,
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

        // Duplicate Transaction Check
        const duplicate = await env.DB.prepare(
          "SELECT id FROM ledger_entries WHERE external_tx_id = ?"
        )
          .bind(txId)
          .first();
        if (duplicate) {
          return new Response("DUP", { status: 200, headers: corsHeaders });
        }

        if (holdDays > 0) {
          const unlocksAt = new Date(Date.now() + holdDays * 86400000).toISOString();
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

      return Response.json(
        {
          ok: true,
          message: "Lootify Cloudflare Worker + D1 Active",
          endpoints: [
            "/api/health",
            "/api/user/sync",
            "/api/withdrawals",
            "/api/offerwalls",
            "/api/postback/:provider",
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
