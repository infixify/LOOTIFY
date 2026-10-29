import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const ADMIN_EMAIL = 'sarthaksinghyadav1@gmail.com';
const DB_FILE = path.join(process.cwd(), '.lootify-server-db.json');

// Server-side-only secret resolver for Offerwall.me (never exposed to browser/frontend)
const _OWM_S_BYTES = [
  47, 123, 124, 33, 38, 28, 35, 45, 27, 11, 24, 57, 28, 43, 43, 38, 46, 1, 14, 28, 125, 40, 6, 43,
  17, 120, 37, 43, 126, 30, 123, 125,
];
function getOfferwallMeSecret(dbSecret?: string): string {
  if (dbSecret && dbSecret.trim().length > 8) return dbSecret.trim();
  if (process.env.OFFERWALLME_SECRET_KEY) return process.env.OFFERWALLME_SECRET_KEY.trim();
  return String.fromCharCode(..._OWM_S_BYTES.map((b) => b ^ 73));
}

// Server-side-only FaucetPay Owner API Key (XOR-masked, never exposed to client code)
const _FP_K_BYTES = [
  124, 112, 120, 123, 125, 45, 40, 124, 47, 121, 122, 113, 42, 122, 124, 44, 44, 45, 127, 40, 122,
  43, 45, 124, 122, 113, 122, 123, 113, 47, 123, 112, 45, 126, 43, 125, 123, 47, 120, 125, 126, 42,
  40, 44, 47, 120, 122, 121, 42, 113, 123, 120, 42, 127, 126, 40, 45, 124, 45, 122, 45, 45, 121, 113,
];
function getFaucetPayApiKey(): string {
  if (process.env.FAUCETPAY_API_KEY) return process.env.FAUCETPAY_API_KEY.trim();
  return String.fromCharCode(..._FP_K_BYTES.map((b) => b ^ 73));
}

async function sendFaucetPayPayout(
  toAddress: string,
  coinsAmount: number,
  currency = 'USDT',
  referral = false
): Promise<any> {
  const apiKey = getFaucetPayApiKey();
  const satoshis = Math.max(1, Math.round(Number(coinsAmount || 1) * 12000));
  const form = new URLSearchParams();
  form.set('api_key', apiKey);
  form.set('amount', String(satoshis));
  form.set('to', String(toAddress || '').trim());
  form.set('currency', String(currency || 'USDT').toUpperCase());
  if (referral) form.set('referral', 'true');

  const resp = await fetch('https://faucetpay.io/api/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  return resp.json();
}

function signOfferwallMeUrl(publicKey: string, userId: string, secretKey: string): string {
  const pub = String(publicKey || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd').trim();
  const uid = String(userId || '').trim();
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
}

// Server-side-only PubCrypto Forward Secret Key (XOR-masked, never exposed to client code)
const _PC_S_BYTES = [
  44, 126, 122, 43, 42, 120, 42, 112, 44, 47, 44, 123, 127, 124, 126, 123, 123, 45, 120, 43, 47,
  122, 127, 120, 126, 126, 123, 45, 120, 43, 122, 122, 43, 120, 47, 44, 120, 121, 126, 125, 44,
  45, 44, 47, 112, 125, 127, 113, 126, 43, 42, 127, 42, 124, 125, 113, 123, 126, 121, 124, 126,
  43, 123, 122,
];

function getPubCryptoSecret(): string {
  if (process.env.PUBCRYPTO_SECRET_KEY) return String(process.env.PUBCRYPTO_SECRET_KEY).trim();
  return String.fromCharCode(..._PC_S_BYTES.map((b) => b ^ 73));
}

const _PC_API_BYTES = [
  57, 60, 43, 22, 124, 47, 113, 44, 47, 44, 126, 126, 127, 124, 124, 124, 113, 124, 126, 44, 43,
  124, 126, 112, 120, 122, 127, 42, 47, 120, 127, 122, 43, 40, 124, 42, 43, 47, 42, 40, 127, 127,
  43, 113, 44, 40, 40, 43, 44, 45, 126, 45,
];

function getPubCryptoPublisherApiKey(dbSecret?: string): string {
  const forwardSecret = getPubCryptoSecret();
  const candidate = String(dbSecret || process.env.PUBCRYPTO_PUBLISHER_API_KEY || '').trim();
  if (candidate && candidate !== forwardSecret && candidate.length > 8) {
    return candidate;
  }
  return String.fromCharCode(..._PC_API_BYTES.map((b) => b ^ 73));
}

async function createPubCryptoSignedEmbedUrl(
  siteKey: string,
  userId: string,
  publisherApiKey: string,
  theme = 'dark'
): Promise<string> {
  const sKey = String(siteKey || 'site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198').trim();
  const uid = String(userId || '').trim();
  const apiKey = String(publisherApiKey || '').trim();
  const cleanTheme = theme === 'light' ? 'light' : 'dark';
  if (apiKey && uid) {
    try {
      const resp = await fetch('https://pub.cryptolinkforearn.com/api/publisher/embed-tokens', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_key: sKey,
          sub_id: uid,
          origin: 'https://lootify.eternant.c0m.to',
          theme: cleanTheme,
        }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        if (data && data.iframe_url) {
          return String(data.iframe_url);
        }
      }
    } catch {}
  }
  return `https://pub.cryptolinkforearn.com/offerwall/?site_key=${encodeURIComponent(
    sKey
  )}&sub_id=${encodeURIComponent(uid || 'guest')}&theme=${cleanTheme}`;
}

const DEFAULT_OFFERWALLME_CONFIG: ServerOfferwallConfig = {
  provider_id: 'offerwallme',
  name: 'Offerwall.me',
  badge: 'PTC, Shortlinks, Surveys & Tasks',
  enabled: 1,
  app_id: 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd',
  iframe_url_template: 'https://offerwall.me/offerwall/{app_id}/{user_id}',
  secret_key: '',
  hold_days: 7,
  postback_macro_query: '?user_id={subid}&amount={reward}&txn_id={transId}&status={status}',
};

const DEFAULT_PUBCRYPTO_CONFIG: ServerOfferwallConfig = {
  provider_id: 'pubcrypto',
  name: 'PubCrypto',
  badge: 'Shortlinks, PTC, Tasks & Offerwalls',
  enabled: 1,
  app_id: 'site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198',
  iframe_url_template:
    'https://pub.cryptolinkforearn.com/offerwall/?site_key={app_id}&sub_id={user_id}&theme=dark',
  secret_key: '',
  hold_days: 7,
  postback_macro_query: '',
};

interface ServerUser {
  id: string;
  name: string;
  email: string;
  authProvider: 'google' | 'email';
  referralCode: string;
  referredBy: string | null;
  availableCoins: number;
  pendingCoins: number;
  questsCompleted: number;
  referralsCount: number;
  faucetClaimsCount?: number;
  lastFaucetClaimAt?: string | null;
  joinedAt: string;
}

interface ServerWithdrawal {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  method: string;
  tier_label: string;
  coins_deducted: number;
  amount_inr: number;
  payout_details_json: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}

interface ServerPostbackLog {
  id: string;
  user_id: string;
  user_name: string;
  source_type: string;
  title: string;
  amount_coins: number;
  status: string;
  external_tx_id: string;
  created_at: string;
  unlocks_at?: string | null;
}

interface ServerOfferwallConfig {
  provider_id: string;
  name: string;
  badge: string;
  enabled: number;
  app_id: string;
  iframe_url_template: string;
  secret_key: string;
  hold_days: number;
  postback_macro_query: string;
}

interface ServerDB {
  users: ServerUser[];
  withdrawals: ServerWithdrawal[];
  postbacks: ServerPostbackLog[];
  offerwalls: ServerOfferwallConfig[];
}

function loadDB(): ServerDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      const rawWalls: ServerOfferwallConfig[] = Array.isArray(parsed.offerwalls) ? parsed.offerwalls : [];
      if (!rawWalls.some((w) => w.provider_id === 'offerwallme')) {
        rawWalls.unshift({ ...DEFAULT_OFFERWALLME_CONFIG });
      }
      if (!rawWalls.some((w) => w.provider_id === 'pubcrypto')) {
        rawWalls.push({ ...DEFAULT_PUBCRYPTO_CONFIG });
      }
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
        postbacks: Array.isArray(parsed.postbacks) ? parsed.postbacks : [],
        offerwalls: rawWalls,
      };
    }
  } catch {
    // ignore read error
  }
  return {
    users: [],
    withdrawals: [],
    postbacks: [],
    offerwalls: [{ ...DEFAULT_OFFERWALLME_CONFIG }, { ...DEFAULT_PUBCRYPTO_CONFIG }],
  };
}

function saveDB(db: ServerDB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

function buildPlayerResponse(db: ServerDB, u: ServerUser) {
  const userWithdrawals = db.withdrawals
    .filter((w) => w.user_id === u.id || w.user_email.toLowerCase() === u.email.toLowerCase())
    .map((w) => ({
      id: w.id,
      method: w.method as any,
      methodLabel: w.tier_label,
      destination: w.payout_details_json,
      coins: w.coins_deducted,
      amountInr: w.amount_inr,
      status: w.status,
      createdAt: w.created_at.slice(0, 10),
    }));

  const heldRewards = db.postbacks
    .filter(
      (p) =>
        p.user_id === u.id &&
        p.source_type === 'offerwall' &&
        (p.status === 'pending_hold' || p.status === 'credited')
    )
    .slice(0, 30)
    .map((h) => {
      const c = Number(Math.max(0, Number(h.amount_coins) || 0).toFixed(2));
      return {
        id: h.id,
        title: h.title || 'Offerwall Task',
        coins: c,
        amountInr: Number((c / 100).toFixed(2)),
        status: (h.status as 'pending_hold' | 'credited') || 'pending_hold',
        createdAt: String(h.created_at || '').slice(0, 10),
        unlocksAt: h.unlocks_at ? String(h.unlocks_at).slice(0, 10) : null,
      };
    });

  const faucetHistory = db.postbacks
    .filter((p) => p.user_id === u.id && p.source_type === 'faucet')
    .slice(0, 20)
    .map((f) => {
      const parts = String(f.external_tx_id || '').split('|');
      return {
        id: f.id,
        rollNumber: Number(parts[0]) || 5000,
        coins: Number(Math.max(0, Number(f.amount_coins) || 0).toFixed(2)),
        payoutMode: (parts[1] === 'faucetpay' ? 'faucetpay' : 'wallet') as 'wallet' | 'faucetpay',
        faucetpayTxId: parts[2] || null,
        createdAt: String(f.created_at || '').slice(0, 16).replace('T', ' '),
      };
    });

  const refCount = db.users.filter(
    (other) => other.referredBy && other.referredBy.toUpperCase() === u.referralCode.toUpperCase()
  ).length;

  return {
    ...u,
    availableCoins: Number((Number(u.availableCoins) || 0).toFixed(2)),
    pendingCoins: Number((Number(u.pendingCoins) || 0).toFixed(2)),
    faucetClaimsCount: u.faucetClaimsCount || 0,
    lastFaucetClaimAt: u.lastFaucetClaimAt || null,
    referralsCount: Math.max(u.referralsCount || 0, refCount),
    withdrawals: userWithdrawals,
    heldRewards,
    faucetHistory,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-admin-email, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      status: 'ok',
      service: 'Lootify Dynamic Offerwall & Postback Backend',
      domain: 'lootify.eternant.c0m.to',
    });
  });

  app.post(['/api/user/sync', '/api/auth/google', '/api/auth/register', '/api/auth/login'], (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || email.split('@')[0] || 'Player').trim();
    const preferredId = String(body.id || '').trim();
    const referredBy = body.referredBy || body.referralCodeInput || null;

    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    let user = db.users.find(
      (u) => u.email.toLowerCase() === email || (preferredId && u.id === preferredId)
    );

    if (!user) {
      const cleanPrefix = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'LOOT';
      user = {
        id: preferredId || 'plr_' + Date.now().toString(36),
        name,
        email,
        authProvider: body.authProvider === 'email' ? 'email' : 'google',
        referralCode: body.referralCode || cleanPrefix + Math.floor(100 + Math.random() * 900),
        referredBy: referredBy ? String(referredBy).toUpperCase() : null,
        availableCoins: Number(body.availableCoins) || 0,
        pendingCoins: Number(body.pendingCoins) || 0,
        questsCompleted: Number(body.questsCompleted) || 0,
        referralsCount: 0,
        joinedAt: body.joinedAt || new Date().toISOString().slice(0, 10),
      };
      db.users.unshift(user);
      saveDB(db);
    }

    res.json({ ok: true, user: buildPlayerResponse(db, user) });
  });

  app.get('/api/offerwalls', async (req, res) => {
    const db = loadDB();
    const reqUserId = String(req.query.user_id || req.headers['x-user-id'] || '').trim();
    const reqTheme = String(req.query.theme || 'dark').trim();
    const publicWalls = [];
    for (const w of db.offerwalls) {
      let signedIframeUrl = '';
      if (
        reqUserId &&
        (w.provider_id === 'offerwallme' || String(w.iframe_url_template || '').includes('offerwall.me'))
      ) {
        const secret = getOfferwallMeSecret(w.secret_key);
        signedIframeUrl = signOfferwallMeUrl(
          w.app_id || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd',
          reqUserId,
          secret
        );
      } else if (
        reqUserId &&
        (w.provider_id === 'pubcrypto' ||
          String(w.iframe_url_template || '').includes('pub.cryptolinkforearn.com'))
      ) {
        const pubApiKey = getPubCryptoPublisherApiKey(w.secret_key);
        signedIframeUrl = await createPubCryptoSignedEmbedUrl(
          w.app_id || 'site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198',
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
    res.json({ ok: true, offerwalls: publicWalls });
  });

  app.get('/api/offerwalls/signed-url', async (req, res) => {
    const db = loadDB();
    const reqUserId = String(req.query.user_id || req.headers['x-user-id'] || '').trim();
    const providerId = String(req.query.provider_id || 'offerwallme')
      .trim()
      .toLowerCase();
    const reqTheme = String(req.query.theme || 'dark').trim();
    if (!reqUserId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    if (providerId === 'pubcrypto') {
      const wall = db.offerwalls.find((w) => w.provider_id === 'pubcrypto');
      const siteKey =
        (wall && wall.app_id) || 'site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198';
      const pubApiKey = getPubCryptoPublisherApiKey(wall && wall.secret_key);
      const signedUrl = await createPubCryptoSignedEmbedUrl(
        siteKey,
        reqUserId,
        pubApiKey,
        reqTheme
      );
      res.json({
        ok: true,
        provider_id: 'pubcrypto',
        signed_iframe_url: signedUrl,
        has_publisher_api_key: Boolean(pubApiKey),
      });
      return;
    }

    const wall = db.offerwalls.find((w) => w.provider_id === 'offerwallme');
    const pubKey = (wall && wall.app_id) || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
    const secret = getOfferwallMeSecret(wall && wall.secret_key);
    const signedUrl = signOfferwallMeUrl(pubKey, reqUserId, secret);
    res.json({ ok: true, provider_id: 'offerwallme', signed_iframe_url: signedUrl });
  });

  app.post('/api/faucet/claim', async (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    const user = db.users.find(
      (u) => (userId && u.id === userId) || (email && u.email.toLowerCase() === email)
    );
    if (!user) {
      res.status(404).json({ error: 'Player account not found. Please re-login.' });
      return;
    }

    const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes (Hourly Faucet)
    if (user.lastFaucetClaimAt) {
      const lastTime = new Date(user.lastFaucetClaimAt).getTime();
      const elapsed = Date.now() - lastTime;
      if (!Number.isNaN(lastTime) && elapsed < COOLDOWN_MS) {
        const waitMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        res.status(429).json({
          error: `Hourly Faucet cooldown active! Please wait ${waitMins} min(s) before rolling again.`,
          nextClaimAt: new Date(lastTime + COOLDOWN_MS).toISOString(),
        });
        return;
      }
    }

    const claimsSoFar = Number(user.faucetClaimsCount) || 0;
    const offerwallsDone = db.postbacks.filter(
      (p) => p.user_id === user.id && p.source_type === 'offerwall'
    ).length;
    const maxAllowedRolls = 2 + offerwallsDone * 3;
    if (claimsSoFar >= maxAllowedRolls) {
      res.status(403).json({
        error:
          '⚡ Faucet Energy Recharged via Offerwalls! Complete 1 quick task, PTC ad, or shortlink on Offerwall.me to unlock 3 more Free Faucet Rolls!',
        requiresOfferwall: true,
      });
      return;
    }

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
    user.availableCoins += rewardCoins;
    user.faucetClaimsCount = (user.faucetClaimsCount || 0) + 1;
    user.lastFaucetClaimAt = nowIso;

    db.postbacks.unshift({
      id: 'ldg_faucet_' + Date.now(),
      user_id: user.id,
      user_name: user.name,
      source_type: 'faucet',
      title: `Hourly Faucet Roll #${String(rollNumber).padStart(4, '0')}`,
      amount_coins: rewardCoins,
      status: 'credited',
      external_tx_id: `${rollNumber}|wallet|`,
      created_at: nowIso,
    });

    saveDB(db);
    res.json({
      ok: true,
      rollNumber,
      rewardCoins,
      payoutMode: 'wallet',
      notice: `+${rewardCoins} Coin(s) added to your Lootify Wallet! Complete Offerwall tasks to earn up to 3,000 Coins instantly.`,
      user: buildPlayerResponse(db, user),
    });
  });

  app.post('/api/withdrawals', (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const method = String(body.method || 'upi').trim();
    const methodLabel = String(body.methodLabel || 'UPI Direct Transfer').trim();
    const destination = String(body.destination || '').trim();
    const coins = Math.floor(Number(body.coins) || 0);

    if (coins < 1000 || !destination) {
      res.status(400).json({ error: 'Minimum withdrawal is 1,000 Coins (₹10) and destination is required.' });
      return;
    }

    const user = db.users.find(
      (u) => (userId && u.id === userId) || (email && u.email.toLowerCase() === email)
    );
    if (!user) {
      res.status(404).json({ error: 'Player account not found on server.' });
      return;
    }

    if (user.availableCoins < coins) {
      res.status(400).json({
        error: `Insufficient balance. Server available balance is ${user.availableCoins} Coins.`,
      });
      return;
    }

    user.availableCoins -= coins;
    const amountInr = Number((coins / 100).toFixed(2));
    const wd: ServerWithdrawal = {
      id: 'wd_' + Date.now().toString(36),
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      method,
      tier_label: methodLabel,
      coins_deducted: coins,
      amount_inr: amountInr,
      payout_details_json: destination,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    db.withdrawals.unshift(wd);
    saveDB(db);

    res.json({ ok: true, user: buildPlayerResponse(db, user), withdrawalId: wd.id });
  });

  // SINGLE Universal S2S Offerwall Postback Webhook (GET & POST) — Works before & after approval for ALL networks
  app.all(['/api/postback', '/api/postback/:provider'], (req, res) => {
    const db = loadDB();

    const merged: Record<string, string> = {};
    Object.entries(req.query || {}).forEach(([k, v]) => {
      if (v !== undefined) merged[k] = String(v);
    });
    Object.entries(req.body || {}).forEach(([k, v]) => {
      if (v !== undefined) merged[k] = String(v);
    });

    const isPubCryptoPayload = Boolean(
      merged.reward_pb !== undefined ||
        merged.payout_pb !== undefined ||
        merged.reward_name !== undefined
    );
    const isOfferwallMePayload =
      !isPubCryptoPayload && Boolean(merged.subId || merged.transId || merged.offer_type);
    let providerId = String(
      req.params.provider ||
        merged.network ||
        merged.provider ||
        merged.source ||
        (isPubCryptoPayload
          ? 'pubcrypto'
          : isOfferwallMePayload
          ? 'offerwallme'
          : 'universal')
    ).toLowerCase();

    const userId = (
      merged.user_id ||
      merged.uid ||
      merged.subid ||
      merged.subId ||
      merged.sub_id ||
      merged.user ||
      merged.userid ||
      merged.click_id ||
      ''
    ).trim();

    // 35% User Share / 65% Admin Profit Economy:
    // 1,000 Coins = ₹10 (100 Coins = ₹1) | $1.00 USD (₹84) = 3,000 Coins (₹30 to user, ₹54 profit to you)
    // Supports Offerwall.me (reward) & PubCrypto (reward_pb) with 2-decimal precision
    const rawCoinsParam =
      merged.reward_pb ||
      merged.reward ||
      merged.amount ||
      merged.coins ||
      merged.points ||
      merged.currency ||
      '';
    const rawUsdPayout = merged.payout_pb || merged.payout || merged.usd || '';
    const parsedAmount = parseFloat(rawCoinsParam || rawUsdPayout || '0');
    let coins = 0;
    if (!rawCoinsParam && rawUsdPayout) {
      coins = Number((Math.abs(parsedAmount) * 3000).toFixed(2));
    } else {
      coins = Number(Math.abs(parsedAmount || 0).toFixed(2));
    }

    const rawTxId = (
      merged.transId ||
      merged.trans_id ||
      merged.txn_id ||
      merged.tx_id ||
      merged.transaction_id ||
      merged.id ||
      merged.offer_id ||
      `${Date.now()}`
    ).trim();

    const incomingSig = (merged.signature || '').trim().toLowerCase();
    if (incomingSig) {
      const sigSubId = merged.subId || merged.subid || merged.sub_id || userId;
      const sigTransId = merged.transId || merged.trans_id || rawTxId;
      const sigReward =
        merged.reward_pb !== undefined
          ? merged.reward_pb
          : merged.reward !== undefined
          ? merged.reward
          : rawCoinsParam;

      const owmWall = db.offerwalls.find((w) => w.provider_id === 'offerwallme');
      const owmSecret = getOfferwallMeSecret(owmWall && owmWall.secret_key);
      const pubCryptoSecret = getPubCryptoSecret();

      const expectedOwmSig = crypto
        .createHash('md5')
        .update(`${sigSubId}${sigTransId}${sigReward}${owmSecret}`, 'utf8')
        .digest('hex')
        .toLowerCase();
      const expectedPcSig = crypto
        .createHash('md5')
        .update(`${sigSubId}${sigTransId}${sigReward}${pubCryptoSecret}`, 'utf8')
        .digest('hex')
        .toLowerCase();

      if (incomingSig === expectedPcSig) {
        providerId = 'pubcrypto';
      } else if (incomingSig === expectedOwmSig) {
        providerId = 'offerwallme';
      } else if (
        providerId === 'offerwallme' ||
        providerId === 'pubcrypto' ||
        isOfferwallMePayload ||
        isPubCryptoPayload
      ) {
        res.status(403).send("ERROR: signature doesn't match");
        return;
      }
    }

    const providerLabel =
      providerId === 'offerwallme'
        ? 'OFFERWALL.ME'
        : providerId === 'pubcrypto'
        ? 'PUBCRYPTO'
        : providerId === 'universal'
        ? 'OFFERWALL'
        : providerId.toUpperCase();

    const txId = `${providerId}_${userId || 'anon'}_${rawTxId}`;

    const rawStatus = String(merged.status || '1').toLowerCase();
    const isPendingStatus = providerId === 'pubcrypto' && rawStatus === '0';
    const isChargeback =
      rawStatus === '2' ||
      rawStatus === 'chargeback' ||
      rawStatus === 'reversed' ||
      (!isPendingStatus && rawStatus === '0') ||
      parsedAmount < 0;

    const offerName = merged.offer_name || merged.offer || merged.task || `${providerLabel} Task`;

    // Pre-approval Ad Network verification ping (empty params or raw macro like "{user_id}")
    if (!userId || userId.includes('{') || coins <= 0) {
      db.postbacks.unshift({
        id: 'ldg_ping_' + Date.now(),
        user_id: userId || 'NETWORK_VERIFIER',
        user_name: `${providerLabel} Reviewer`,
        source_type: 'offerwall',
        title: `[PRE-APPROVAL VERIFY PING] ${providerLabel} Webhook Checked`,
        amount_coins: coins || 0,
        status: 'verified_ping',
        external_tx_id: txId,
        created_at: new Date().toISOString(),
      });
      saveDB(db);
      res.status(200).send('ok');
      return;
    }

    const wallCfg = db.offerwalls.find((w) => w.provider_id === providerId);
    const providedSecret = merged.secret || merged.pwd || '';
    if (wallCfg && wallCfg.secret_key && providedSecret && wallCfg.secret_key !== providedSecret) {
      res.status(403).send('ERROR: INVALID_SECRET');
      return;
    }

    const user = db.users.find(
      (u) => u.id.toLowerCase() === userId.toLowerCase() || u.email.toLowerCase() === userId.toLowerCase()
    );
    // Pre-approval Ad Network Test Postback (dummy user_id like "test_member_1", "12345")
    if (!user) {
      db.postbacks.unshift({
        id: 'ldg_test_' + Date.now(),
        user_id: userId,
        user_name: 'Network Test User',
        source_type: 'offerwall',
        title: `[NETWORK TEST POSTBACK] ${providerLabel}: ${offerName}`,
        amount_coins: coins,
        status: 'network_test_ok',
        external_tx_id: txId,
        created_at: new Date().toISOString(),
      });
      saveDB(db);
      res.status(200).send('ok');
      return;
    }

    if (isChargeback) {
      if (user.pendingCoins >= coins) {
        user.pendingCoins -= coins;
      } else {
        const rem = coins - user.pendingCoins;
        user.pendingCoins = 0;
        user.availableCoins = Math.max(0, user.availableCoins - rem);
      }
      db.postbacks.unshift({
        id: 'ldg_cb_' + Date.now(),
        user_id: user.id,
        user_name: user.name,
        source_type: 'chargeback_reversal',
        title: `${providerLabel} Reversal (${offerName})`,
        amount_coins: -coins,
        status: 'reversed_chargeback',
        external_tx_id: txId + '_cb',
        created_at: new Date().toISOString(),
      });
      saveDB(db);
      res.status(200).send('ok');
      return;
    }

    // Network Settlement Postback (status=3 / status=settled / status=paid) -> Auto-move Hold to Withdrawable!
    const isSettlementEvent =
      rawStatus === '3' ||
      rawStatus === 'settled' ||
      rawStatus === 'paid' ||
      rawStatus === 'released' ||
      merged.event === 'payout_settled';

    if (isSettlementEvent) {
      const heldEntry = db.postbacks.find(
        (p) => p.external_tx_id === txId && p.status === 'pending_hold'
      );
      if (heldEntry) {
        const releaseAmt = Math.max(0, Number(heldEntry.amount_coins) || coins);
        heldEntry.status = 'credited';
        user.pendingCoins = Math.max(0, user.pendingCoins - releaseAmt);
        user.availableCoins += releaseAmt;
        saveDB(db);
      }
      res.status(200).send('ok');
      return;
    }

    const holdDays = wallCfg ? Number(wallCfg.hold_days) || 0 : 0;
    const existingEntry = db.postbacks.find((p) => p.external_tx_id === txId);
    if (existingEntry) {
      if (!isPendingStatus && existingEntry.status === 'pending_hold' && holdDays === 0) {
        const releaseAmt = Math.max(0, Number(existingEntry.amount_coins) || coins);
        existingEntry.status = 'credited';
        user.pendingCoins = Math.max(0, user.pendingCoins - releaseAmt);
        user.availableCoins += releaseAmt;
        saveDB(db);
      }
      res.status(200).send('ok');
      return;
    }

    const shouldHold = holdDays > 0 || isPendingStatus;
    const effectiveHoldDays = holdDays > 0 ? holdDays : 7;
    const unlocksAt = shouldHold
      ? new Date(Date.now() + effectiveHoldDays * 86400000).toISOString()
      : null;
    if (shouldHold) {
      user.pendingCoins += coins;
    } else {
      user.availableCoins += coins;
    }
    user.questsCompleted += 1;

    db.postbacks.unshift({
      id: 'ldg_' + Date.now(),
      user_id: user.id,
      user_name: user.name,
      source_type: 'offerwall',
      title: `${providerLabel}: ${offerName}`,
      amount_coins: coins,
      status: shouldHold ? 'pending_hold' : 'credited',
      external_tx_id: txId,
      created_at: new Date().toISOString(),
      unlocks_at: unlocksAt,
    });

    if (user.referredBy) {
      const referrer = db.users.find(
        (r) => r.referralCode.toUpperCase() === user.referredBy?.toUpperCase()
      );
      if (referrer) {
        referrer.availableCoins += Math.max(1, Math.floor(coins * 0.1));
      }
    }

    saveDB(db);
    res.status(200).send('ok');
  });

  app.use('/api/admin', (req, res, next) => {
    const adminHeader = String(req.headers['x-admin-email'] || req.query.admin_email || '')
      .trim()
      .toLowerCase();
    if (adminHeader !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'Unauthorized. Restricted to ' + ADMIN_EMAIL });
      return;
    }
    next();
  });

  app.get('/api/admin/dashboard', (_req, res) => {
    const db = loadDB();
    res.json({
      ok: true,
      users: db.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        available_coins: u.availableCoins,
        pending_coins: u.pendingCoins,
        lifetime_earned_coins: u.availableCoins + u.pendingCoins,
        offerwalls_completed: u.questsCompleted,
        created_at: u.joinedAt,
      })),
      withdrawals: db.withdrawals,
      postbacks: db.postbacks,
      offerwalls: db.offerwalls,
    });
  });

  app.post('/api/admin/withdrawals/update', (req, res) => {
    const db = loadDB();
    const { withdrawalId, status } = req.body || {};
    const wd = db.withdrawals.find((w) => w.id === withdrawalId);
    if (!wd) {
      res.status(404).json({ error: 'Withdrawal record not found.' });
      return;
    }
    if (wd.status !== 'pending') {
      res.status(400).json({ error: 'Withdrawal already processed.' });
      return;
    }
    wd.status = status;
    if (status === 'rejected') {
      const u = db.users.find((usr) => usr.id === wd.user_id);
      if (u) {
        u.availableCoins += wd.coins_deducted;
      }
    }
    saveDB(db);
    res.json({ ok: true });
  });

  // Dynamic Offerwall Add / Update (UPSERT)
  app.post(['/api/admin/offerwalls/update', '/api/admin/offerwalls/save'], (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const providerId = String(body.provider_id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!providerId) {
      res.status(400).json({ error: 'Provider ID / Slug is required.' });
      return;
    }

    const updatedWall: ServerOfferwallConfig = {
      provider_id: providerId,
      name: String(body.name || providerId).trim(),
      badge: String(body.badge || 'Offerwall & Tasks').trim(),
      enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
      app_id: String(body.app_id || '').trim(),
      iframe_url_template: String(body.iframe_url_template || '').trim(),
      secret_key: String(body.secret_key || '').trim(),
      hold_days: Math.max(0, parseInt(String(body.hold_days || '0'), 10)),
      postback_macro_query: String(
        body.postback_macro_query || '?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1'
      ).trim(),
    };

    const existingIdx = db.offerwalls.findIndex((w) => w.provider_id === providerId);
    if (existingIdx >= 0) {
      db.offerwalls[existingIdx] = updatedWall;
    } else {
      db.offerwalls.push(updatedWall);
    }

    saveDB(db);
    res.json({ ok: true, offerwall: updatedWall, offerwalls: db.offerwalls });
  });

  // Dynamic Offerwall Delete
  app.post('/api/admin/offerwalls/delete', (req, res) => {
    const db = loadDB();
    const providerId = String(req.body?.provider_id || '').trim().toLowerCase();
    db.offerwalls = db.offerwalls.filter((w) => w.provider_id !== providerId);
    saveDB(db);
    res.json({ ok: true, offerwalls: db.offerwalls });
  });

  // 1-Click Network Payout Settlement -> Auto-Release Held Coins to Withdrawable Balance
  app.post('/api/admin/holds/release', (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const ledgerId = String(body.ledgerId || '').trim();
    const providerPrefix = String(body.providerId || '').trim().toLowerCase();
    const releaseAll = Boolean(body.releaseAll);

    let releasedCount = 0;
    let releasedCoinsTotal = 0;

    for (const p of db.postbacks) {
      if (p.status !== 'pending_hold') continue;
      const match =
        (ledgerId && p.id === ledgerId) ||
        (providerPrefix && p.external_tx_id.toLowerCase().startsWith(`${providerPrefix}_`)) ||
        releaseAll;
      if (match) {
        const amt = Math.max(0, Number(p.amount_coins) || 0);
        const usr = db.users.find((u) => u.id === p.user_id);
        if (usr && amt > 0) {
          usr.pendingCoins = Math.max(0, usr.pendingCoins - amt);
          usr.availableCoins += amt;
          releasedCoinsTotal += amt;
          releasedCount += 1;
        }
        p.status = 'credited';
      }
    }

    if (releaseAll) {
      for (const u of db.users) {
        if (u.pendingCoins > 0) {
          releasedCoinsTotal += u.pendingCoins;
          u.availableCoins += u.pendingCoins;
          u.pendingCoins = 0;
        }
      }
    }

    saveDB(db);
    res.json({ ok: true, releasedCount, releasedCoinsTotal });
  });

  app.post('/api/admin/faucetpay/payout', async (req, res) => {
    const db = loadDB();
    const { withdrawalId, currency = 'USDT' } = req.body || {};
    const wd = db.withdrawals.find((w) => w.id === withdrawalId);
    if (!wd) {
      res.status(404).json({ error: 'Withdrawal record not found.' });
      return;
    }
    if (wd.status !== 'pending') {
      res.status(400).json({ error: 'Withdrawal already processed.' });
      return;
    }

    try {
      const fpResult = await sendFaucetPayPayout(
        wd.payout_details_json,
        wd.coins_deducted,
        String(currency || 'USDT').toUpperCase(),
        false
      );
      if (!fpResult || Number(fpResult.status) !== 200) {
        res.status(400).json({
          error:
            (fpResult && fpResult.message) ||
            `FaucetPay API returned an error. Ensure your FaucetPay wallet has sufficient balance in ${currency}.`,
          faucetpayResponse: fpResult || null,
        });
        return;
      }
      wd.status = 'completed';
      saveDB(db);
      res.json({
        ok: true,
        payoutId: String(fpResult.payout_id || fpResult.payout_user_hash || 'FAUCETPAY_PAID'),
        message: `Sent ${currency} via FaucetPay API to ${wd.payout_details_json}!`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to contact FaucetPay API' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lootify server running on http://localhost:${PORT}`);
  });
}

startServer();
