import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const ADMIN_EMAIL = 'sarthaksinghyadav1@gmail.com';
const DB_FILE = path.join(process.cwd(), '.lootify-server-db.json');

// Server-side-only secret resolver for Offerwall.me (never exposed to browser/frontend)
function getOfferwallMeSecret(dbSecret?: string): string {
  if (dbSecret && dbSecret.trim().length > 8) return dbSecret.trim();
  if (process.env.OFFERWALLME_SECRET_KEY) return process.env.OFFERWALLME_SECRET_KEY.trim();
  return 'f25hoUjdRBQpUbbogHGU4aObX1lb7W24';
}

function getOfferwallMeBearerToken(): string {
  if (process.env.OFFERWALLME_API_TOKEN) return process.env.OFFERWALLME_API_TOKEN.trim();
  return '35qVPqjgP6oB8wwiTFFUplZFqj455jgysnI3SuQH';
}

const _owmFeedCache = new Map<string, { ts: number; payload: any }>();

async function fetchOfferwallMeFeedItems(
  pubKey: string,
  secretKey: string,
  userId: string,
  clientIp: string,
  countryCode: string
): Promise<any> {
  const pub = String(pubKey || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd').trim();
  const uid = String(userId || 'plr_c2fydghha3').trim();
  const token = getOfferwallMeBearerToken();
  const country = String(countryCode || 'IN').trim().toUpperCase();
  const cacheKey = `${uid}_${country}`;
  const cached = _owmFeedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30000) {
    return cached.payload;
  }

  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');

  const runFetchWithIp = async (ipToUse: string) => {
    const qs = new URLSearchParams({
      api: pub,
      id: uid,
      ip: ipToUse,
      token,
      country,
      identityExpires: expires,
      identitySignature: signature,
    }).toString();

    const endpoints = [
      { key: 'ptc', url: `https://offerwall.me/api.php?${qs}` },
      { key: 'shortlinks', url: `https://offerwall.me/slapi.php?${qs}` },
      { key: 'tasks', url: `https://offerwall.me/taskapi.php?${qs}` },
      { key: 'offers', url: `https://offerwall.me/offerapi.php?${qs}` },
      { key: 'surveys', url: `https://offerwall.me/surveyapi.php?${qs}` },
    ];

    const results: Record<string, any[]> = {
      ptc: [],
      shortlinks: [],
      tasks: [],
      offers: [],
      surveys: [],
    };

    await Promise.all(
      endpoints.map(async (ep) => {
        try {
          const resp = await fetch(ep.url, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (resp.ok) {
            const json: any = await resp.json();
            if (json && Array.isArray(json.data)) {
              results[ep.key] = json.data;
            }
          }
        } catch {}
      })
    );
    return results;
  };

  const cleanIp = String(clientIp || '').trim();
  const isLocalOrCloudIp =
    !cleanIp ||
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('172.') ||
    cleanIp.startsWith('2600:1900:') ||
    cleanIp.startsWith('34.') ||
    cleanIp.startsWith('35.');

  const primaryIp = isLocalOrCloudIp ? '152.58.192.42' : cleanIp;
  let feed = await runFetchWithIp(primaryIp);
  const totalCount =
    feed.ptc.length +
    feed.shortlinks.length +
    feed.tasks.length +
    feed.offers.length +
    feed.surveys.length;

  if (totalCount === 0 && primaryIp !== '152.58.192.42') {
    feed = await runFetchWithIp('152.58.192.42');
  }

  const payload = {
    ok: true,
    userId: uid,
    country,
    ptc: feed.ptc,
    shortlinks: feed.shortlinks,
    tasks: feed.tasks,
    offers: feed.offers,
    surveys: feed.surveys,
    fetchedAt: new Date().toISOString(),
  };
  _owmFeedCache.set(cacheKey, { ts: Date.now(), payload });
  return payload;
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
  const satoshis = Math.max(1, Math.round(Number(coinsAmount || 1) * 1000));
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
  const expires = String(Math.floor(Date.now() / 1000) + 43200);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
}

async function fetchOfferwallMeHistoryForUser(userId: string, secretKey: string): Promise<any[]> {
  const uid = String(userId || '').trim();
  if (!uid) return [];
  try {
    const pub = 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
    const expires = String(Math.floor(Date.now() / 1000) + 3600);
    const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
    const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
    const resp = await fetch(
      `https://offerwall.me/api/public/history/${encodeURIComponent(pub)}?userId=${encodeURIComponent(
        uid
      )}`,
      {
        headers: {
          'x-offerwall-user-expires': expires,
          'x-offerwall-user-signature': signature,
        },
      }
    );
    if (!resp.ok) return [];
    const data: any = await resp.json();
    if (!data || !Array.isArray(data.history)) return [];
    return data.history.filter((item: any) => {
      if (!item) return false;
      const reward = Number(item.reward) || 0;
      if (reward <= 0 || item.rejectionReason) return false;
      const st = String(item.status || '').trim().toLowerCase();
      if (
        st === 'rejected' ||
        st === 'reversed' ||
        st === 'chargeback' ||
        st === 'pending' ||
        st === 'failed' ||
        st === 'postback failed' ||
        st.includes('fail') ||
        st === 'cancelled' ||
        st === 'disqualified' ||
        st === 'expired'
      ) {
        return false;
      }
      return st === 'approved' || st === 'completed';
    });
  } catch {
    return [];
  }
}

function pickCleanFromObj(obj: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null) {
      const trimmed = String(val).trim();
      if (
        trimmed &&
        !trimmed.includes('{') &&
        !trimmed.includes('}') &&
        !trimmed.includes('[') &&
        !trimmed.includes(']')
      ) {
        return trimmed;
      }
    }
  }
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
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
  hold_days: 0,
  postback_macro_query: '?user_id={subId}&amount={reward}&txn_id={transId}&status={status}',
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
  hold_days: 0,
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
  utr_or_voucher?: string | null;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  processed_at?: string;
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

interface ServerShortlinkConfig {
  id: string;
  name: string;
  provider: string;
  url: string;
  reward_coins: number;
  daily_limit: number;
  timer_seconds: number;
  difficulty: 'Easy' | 'Medium' | 'Fast';
  badge: string;
  enabled: number;
}

const DEFAULT_SHORTLINKS: ServerShortlinkConfig[] = [
  {
    id: 'shrinkme_vip',
    name: 'ShrinkMe VIP Link',
    provider: 'ShrinkMe.io',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=shrinkme_vip',
    reward_coins: 120,
    daily_limit: 3,
    timer_seconds: 15,
    difficulty: 'Medium',
    badge: '🔥 Highest Paying • 3 Steps',
    enabled: 1,
  },
  {
    id: 'cuty_crypto',
    name: 'Cuty.io Fast Crypto Link',
    provider: 'Cuty.io',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=cuty_crypto',
    reward_coins: 100,
    daily_limit: 5,
    timer_seconds: 12,
    difficulty: 'Easy',
    badge: '⚡ Instant Credit • 2 Steps',
    enabled: 1,
  },
  {
    id: 'exeio_global',
    name: 'Exe.io Premium Shortlink',
    provider: 'Exe.io',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=exeio_global',
    reward_coins: 110,
    daily_limit: 3,
    timer_seconds: 15,
    difficulty: 'Medium',
    badge: '💎 High CPM • 3 Steps',
    enabled: 1,
  },
  {
    id: 'gplinks_india',
    name: 'GPLinks Express',
    provider: 'GPLinks',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=gplinks_india',
    reward_coins: 100,
    daily_limit: 4,
    timer_seconds: 15,
    difficulty: 'Medium',
    badge: '🇮🇳 Top India CPM • 3 Steps',
    enabled: 1,
  },
  {
    id: 'clicksfly_turbo',
    name: 'Clicksfly Turbo Link',
    provider: 'Clicksfly',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=clicksfly_turbo',
    reward_coins: 90,
    daily_limit: 4,
    timer_seconds: 12,
    difficulty: 'Easy',
    badge: '🚀 Fast Timer • 2 Steps',
    enabled: 1,
  },
  {
    id: 'droplink_fast',
    name: 'Droplink Quick Claim',
    provider: 'Droplink',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=droplink_fast',
    reward_coins: 80,
    daily_limit: 5,
    timer_seconds: 10,
    difficulty: 'Fast',
    badge: '⚡ Clean 1-Step Ad',
    enabled: 1,
  },
  {
    id: 'ouo_express',
    name: 'Ouo.io Global Shortlink',
    provider: 'Ouo.io',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=ouo_express',
    reward_coins: 75,
    daily_limit: 5,
    timer_seconds: 10,
    difficulty: 'Fast',
    badge: '🌍 Global Fast Link',
    enabled: 1,
  },
  {
    id: 'linkvertise_pro',
    name: 'Linkvertise Direct Boost',
    provider: 'Linkvertise',
    url: 'https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=linkvertise_pro',
    reward_coins: 150,
    daily_limit: 2,
    timer_seconds: 15,
    difficulty: 'Easy',
    badge: '👑 Premium Advertiser',
    enabled: 1,
  },
];

interface ServerDB {
  users: ServerUser[];
  withdrawals: ServerWithdrawal[];
  postbacks: ServerPostbackLog[];
  offerwalls: ServerOfferwallConfig[];
  shortlinks: ServerShortlinkConfig[];
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
      const rawShortlinks: ServerShortlinkConfig[] =
        Array.isArray(parsed.shortlinks) && parsed.shortlinks.length > 0
          ? parsed.shortlinks
          : DEFAULT_SHORTLINKS.map((s) => ({ ...s }));
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
        postbacks: Array.isArray(parsed.postbacks) ? parsed.postbacks : [],
        offerwalls: rawWalls,
        shortlinks: rawShortlinks,
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
    shortlinks: DEFAULT_SHORTLINKS.map((s) => ({ ...s })),
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

  const parseTimestampMs = (val: string) => {
    if (!val) return 0;
    const str = String(val).trim();
    const iso =
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)
        ? str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z')
        : str;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? 0 : ms;
  };

  const heldRewards = db.postbacks
    .filter(
      (p) =>
        p.user_id === u.id &&
        (p.source_type === 'offerwall' ||
          p.source_type === 'shortlink' ||
          p.source_type === 'admin_adjustment') &&
        (p.status === 'pending_hold' || p.status === 'credited' || p.status === 'deducted')
    )
    .map((h) => {
      const c = Number((Number(h.amount_coins) || 0).toFixed(2));
      const rawCreated = String(h.created_at || '').trim();
      const normalizedCreated =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(rawCreated)
          ? rawCreated.replace(' ', 'T') + (rawCreated.endsWith('Z') ? '' : 'Z')
          : rawCreated || new Date().toISOString();
      return {
        id: h.external_tx_id || h.id,
        title: h.title || 'Offerwall Task',
        coins: c,
        amountInr: Number(((c * 90) / 100000).toFixed(4)),
        status: (h.status as 'pending_hold' | 'credited') || 'pending_hold',
        createdAt: normalizedCreated,
        unlocksAt: h.unlocks_at ? String(h.unlocks_at) : null,
      };
    })
    .sort((a, b) => parseTimestampMs(b.createdAt) - parseTimestampMs(a.createdAt))
    .slice(0, 100);

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

  app.get('/6ae944d6b90ff696f376d5b2.html', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send('6ae944d6b90ff696f376d5b2');
  });

  app.get('/verify_9b9b6c4618b92c39094bf2b79f6424c1c91e602f.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send('9b9b6c4618b92c39094bf2b79f6424c1c91e602f');
  });

  app.post(['/api/user/sync', '/api/auth/google', '/api/auth/register', '/api/auth/login'], async (req, res) => {
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

    const generatePlayerIdFromEmail = (emailRaw: string) => {
      const clean = String(emailRaw || '').trim().toLowerCase();
      if (clean === 'sarthaksinghyadav1@gmail.com') return 'plr_c2fydghha3';
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < clean.length; i++) {
        const c = clean.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 0x01000193) >>> 0;
        h2 ^= c + i * 31;
        h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
      }
      const prefix = clean.replace(/[^a-z0-9]/g, '').slice(0, 4) || 'user';
      return `plr_${prefix}_${h1.toString(36)}${h2.toString(36)}`;
    };

    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user && preferredId) {
      const byId = db.users.find((u) => u.id === preferredId);
      if (byId && (byId.email.toLowerCase() === email || byId.email.toLowerCase().endsWith('@lootify.local'))) {
        byId.email = email;
        byId.name = name;
        user = byId;
      }
    }

    if (!user) {
      const cleanPrefix = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'LOOT';
      const idTaken = preferredId ? db.users.some((u) => u.id === preferredId && u.email.toLowerCase() !== email) : false;
      const resolvedId = preferredId && !idTaken ? preferredId : generatePlayerIdFromEmail(email);
      user = {
        id: resolvedId,
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
    }

    // Automatically sync Offerwall.me completed task history for this user
    let newlyCreditedCoins = 0;
    let newlyCreditedCount = 0;
    try {
      const owmWall = db.offerwalls.find((w) => w.provider_id === 'offerwallme');
      const secret = getOfferwallMeSecret(owmWall && owmWall.secret_key);
      const owmHistory = await fetchOfferwallMeHistoryForUser(user.id, secret);
      for (const item of owmHistory) {
        const rawTx = String(item.transactionId || item.id || '').trim();
        if (!rawTx) continue;
        const txId = `offerwallme_${user.id}_${rawTx}`;
        const rewardCoins = Number((Number(item.reward) || 0).toFixed(2));
        if (rewardCoins <= 0) continue;
        const alreadyExists = db.postbacks.some(
          (p) =>
            p.external_tx_id === txId ||
            p.external_tx_id === `owm_${rawTx}` ||
            p.external_tx_id.endsWith(`_${rawTx}`)
        );
        if (!alreadyExists) {
          user.availableCoins = Number(((Number(user.availableCoins) || 0) + rewardCoins).toFixed(2));
          user.questsCompleted = (Number(user.questsCompleted) || 0) + 1;
          newlyCreditedCoins = Number((newlyCreditedCoins + rewardCoins).toFixed(2));
          newlyCreditedCount += 1;
          db.postbacks.unshift({
            id: 'ldg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            user_id: user.id,
            user_name: user.name,
            source_type: 'offerwall',
            title: `OFFERWALL.ME (${String(item.type || 'Task').toUpperCase()}): ${String(
              item.title || 'Completed Task'
            )}`,
            amount_coins: rewardCoins,
            status: 'credited',
            external_tx_id: txId,
            created_at: item.createdAt || new Date().toISOString(),
            unlocks_at: null,
          });
        }
      }
      saveDB(db);
    } catch {}

    res.json({
      ok: true,
      user: buildPlayerResponse(db, user),
      newlyCreditedCoins,
      newlyCreditedCount,
    });
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

  // ======================================================================
  // OFFERWALL.ME SINGLE-PIECE JSON FEED APIs & TASK PROOF SUBMISSION
  // ======================================================================
  app.get('/api/offerwallme/items', async (req, res) => {
    try {
      const db = loadDB();
      const wall = db.offerwalls.find((w) => w.provider_id === 'offerwallme');
      const pubKey = (wall && wall.app_id) || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
      const secret = getOfferwallMeSecret(wall && wall.secret_key);
      const reqUserId = String(
        req.query.user_id || req.query.userId || req.headers['x-user-id'] || 'plr_c2fydghha3'
      ).trim();

      const rawFwd = String(
        req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
      )
        .split(',')[0]
        .trim();
      const country = String(
        req.query.country || req.headers['cf-ipcountry'] || 'IN'
      )
        .trim()
        .toUpperCase();

      if (req.query.refresh === '1') {
        _owmFeedCache.delete(`${reqUserId}_${country}`);
      }

      const payload = await fetchOfferwallMeFeedItems(pubKey, secret, reqUserId, rawFwd, country);
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch Offerwall.me items' });
    }
  });

  app.post('/api/offerwallme/task-submit', async (req, res) => {
    try {
      const db = loadDB();
      const wall = db.offerwalls.find((w) => w.provider_id === 'offerwallme');
      const pubKey = (wall && wall.app_id) || 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
      const secret = getOfferwallMeSecret(wall && wall.secret_key);
      const token = getOfferwallMeBearerToken();

      const body = req.body || {};
      const uid = String(body.userId || body.user_id || 'plr_c2fydghha3').trim();
      const taskId = String(body.taskId || body.task_id || '').trim();
      const proof = String(body.proof || '').trim();
      const country = String(body.country || req.headers['cf-ipcountry'] || 'IN')
        .trim()
        .toUpperCase();

      if (!taskId || !proof) {
        res.status(400).json({ ok: false, error: 'Task ID and proof are required.' });
        return;
      }

      const rawFwd = String(
        req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
      )
        .split(',')[0]
        .trim();
      const isLocalOrCloudIp =
        !rawFwd ||
        rawFwd === '127.0.0.1' ||
        rawFwd === '::1' ||
        rawFwd.startsWith('10.') ||
        rawFwd.startsWith('192.168.') ||
        rawFwd.startsWith('2600:1900:');
      const clientIp = isLocalOrCloudIp ? '152.58.192.42' : rawFwd;

      const expires = String(Math.floor(Date.now() / 1000) + 3600);
      const message = `offerwall-user-v1\n${pubKey}\n${uid}\n${expires}`;
      const signature = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');

      const resp = await fetch('https://offerwall.me/tasksubmit.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          api: pubKey,
          token,
          id: uid,
          identityExpires: expires,
          identitySignature: signature,
          country,
          task_id: taskId,
          ip: clientIp,
          proof,
        }),
      });

      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || (data && data.status && Number(data.status) >= 400)) {
        res.status(400).json({
          ok: false,
          error: data?.message || data?.error || 'Could not submit task proof to Offerwall.me.',
          details: data,
        });
        return;
      }

      res.json({
        ok: true,
        message:
          data?.message ||
          'Task proof submitted to Offerwall.me! Coins will credit automatically via S2S Postback upon approval.',
        data,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Task proof submission error.' });
    }
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
      (p) => p.user_id === user.id && (p.source_type === 'offerwall' || p.source_type === 'shortlink')
    ).length;
    const maxAllowedRolls = 2 + offerwallsDone * 3;
    if (claimsSoFar >= maxAllowedRolls) {
      res.status(403).json({
        error:
          '⚡ Faucet Energy Recharged via Offerwalls & Shortlinks! Complete 1 quick task, PTC ad, or shortlink to unlock 3 more Free Faucet Rolls!',
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
      notice: `+${rewardCoins} Coin(s) added to your Lootify Wallet! Complete Offerwall tasks or Shortlinks to earn up to 3,000 Coins instantly.`,
      user: buildPlayerResponse(db, user),
    });
  });

  // ======================================================================
  // SHORTLINKS EARNING SECTION (GET /api/shortlinks & POST /api/shortlinks/claim)
  // ======================================================================
  app.get('/api/shortlinks', (req, res) => {
    const db = loadDB();
    const reqUserId = String(req.query.user_id || req.headers['x-user-id'] || '').trim();
    const todayPrefix = new Date().toISOString().slice(0, 10);

    const list = db.shortlinks.map((s) => {
      let claimsToday = 0;
      if (reqUserId) {
        claimsToday = db.postbacks.filter(
          (p) =>
            p.user_id.toLowerCase() === reqUserId.toLowerCase() &&
            p.source_type === 'shortlink' &&
            String(p.external_tx_id || '').startsWith(`sl_${s.id}_${todayPrefix}_`)
        ).length;
      }
      return {
        ...s,
        claims_today: claimsToday,
      };
    });

    res.json({ ok: true, shortlinks: list });
  });

  app.post('/api/shortlinks/claim', (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const shortlinkId = String(body.shortlinkId || '').trim();

    if (!shortlinkId) {
      res.status(400).json({ error: 'Shortlink ID is required.' });
      return;
    }

    const user = db.users.find(
      (u) => (userId && u.id.toLowerCase() === userId.toLowerCase()) || (email && u.email.toLowerCase() === email)
    );
    if (!user) {
      res.status(404).json({ error: 'Player account not found. Please re-login.' });
      return;
    }

    const sl = db.shortlinks.find((s) => s.id === shortlinkId);
    if (!sl || !sl.enabled) {
      res.status(404).json({ error: 'This shortlink is currently unavailable.' });
      return;
    }

    const todayPrefix = new Date().toISOString().slice(0, 10);
    const claimsToday = db.postbacks.filter(
      (p) =>
        p.user_id === user.id &&
        p.source_type === 'shortlink' &&
        String(p.external_tx_id || '').startsWith(`sl_${sl.id}_${todayPrefix}_`)
    ).length;

    const maxDaily = Math.max(1, Number(sl.daily_limit) || 1);
    if (claimsToday >= maxDaily) {
      res.status(429).json({
        error: `Daily limit reached for ${sl.name} (${claimsToday}/${maxDaily} views today). Come back tomorrow or complete another shortlink!`,
      });
      return;
    }

    const rewardCoins = Math.max(0.01, Number(sl.reward_coins) || 50);
    const nowIso = new Date().toISOString();
    const txId = `sl_${sl.id}_${todayPrefix}_${claimsToday + 1}_${Date.now()}`;

    user.availableCoins = Number(((Number(user.availableCoins) || 0) + rewardCoins).toFixed(2));
    user.questsCompleted = (Number(user.questsCompleted) || 0) + 1;

    db.postbacks.unshift({
      id: 'ldg_sl_' + Date.now(),
      user_id: user.id,
      user_name: user.name,
      source_type: 'shortlink',
      title: `🔗 SHORTLINK (${sl.provider.toUpperCase()}): ${sl.name} [View ${claimsToday + 1}/${maxDaily}]`,
      amount_coins: rewardCoins,
      status: 'credited',
      external_tx_id: txId,
      created_at: nowIso,
      unlocks_at: null,
    });

    if (user.referredBy) {
      const referrer = db.users.find(
        (r) => r.referralCode.toUpperCase() === user.referredBy?.toUpperCase()
      );
      if (referrer) {
        const refBonus = Number(Math.max(0.5, rewardCoins * 0.1).toFixed(2));
        referrer.availableCoins = Number(((Number(referrer.availableCoins) || 0) + refBonus).toFixed(2));
      }
    }

    saveDB(db);

    const updatedShortlinks = db.shortlinks.map((s) => {
      const cToday = db.postbacks.filter(
        (p) =>
          p.user_id === user.id &&
          p.source_type === 'shortlink' &&
          String(p.external_tx_id || '').startsWith(`sl_${s.id}_${todayPrefix}_`)
      ).length;
      return {
        ...s,
        claims_today: cToday,
      };
    });

    res.json({
      ok: true,
      rewardCoins,
      claimsToday: claimsToday + 1,
      dailyLimit: maxDaily,
      message: `🎉 +${rewardCoins} Coins credited to your Withdrawable Wallet from ${sl.name} (${claimsToday + 1}/${maxDaily} today)!`,
      user: buildPlayerResponse(db, user),
      shortlinks: updatedShortlinks,
    });
  });

  app.post('/api/withdrawals', async (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const method = String(body.method || 'upi').trim().toLowerCase();
    const methodLabel = String(body.methodLabel || 'UPI Direct Transfer').trim();
    const destination = String(body.destination || '').trim();
    const rawCoins = Math.floor(Number(body.coins) || 0);
    const inrInput = Number(body.inrAmount || body.amountInr || 0);

    if (!destination) {
      res.status(400).json({ error: 'Destination account (UPI ID or FaucetPay Address/Email) is required.' });
      return;
    }

    const user = db.users.find(
      (u) => (userId && u.id === userId) || (email && u.email.toLowerCase() === email)
    );
    if (!user) {
      res.status(404).json({ error: 'Player account not found on server.' });
      return;
    }

    let coinsToDeduct = rawCoins;
    let amountInr = 0;
    let amountUsd = 0;
    let isInstantFaucetPay = false;
    let instantSuccess = false;
    let instantPayoutId = '';
    let instantNotice = '';

    if (method === 'crypto' || method === 'faucetpay') {
      // FAUCETPAY (NO TRANSACTION FEES) :- MINIMUM 100 COINS (0.001 USDT)
      if (coinsToDeduct < 100) {
        res.status(400).json({ error: 'Minimum FaucetPay withdrawal is 100 Coins (0.001 USDT).' });
        return;
      }
      if (user.availableCoins < coinsToDeduct) {
        res.status(400).json({
          error: `Insufficient available coins. You requested ${coinsToDeduct} Coins, but your available balance is ${user.availableCoins} Coins.`,
        });
        return;
      }

      amountUsd = Number((coinsToDeduct / 100000).toFixed(4));
      amountInr = Number(((coinsToDeduct * 90) / 100000).toFixed(2));

      // Up to 0.01 USDT (1,000 Coins): AUTOMATIC INSTANT TRANSFER via FaucetPay API!
      if (coinsToDeduct <= 1000) {
        isInstantFaucetPay = true;
        try {
          const fpResult = await sendFaucetPayPayout(destination, coinsToDeduct, 'USDT', false);
          if (fpResult && Number(fpResult.status) === 200) {
            instantSuccess = true;
            instantPayoutId = String(fpResult.payout_id || fpResult.payout_user_hash || 'FP_INSTANT_' + Date.now());
            instantNotice = `⚡ Instant FaucetPay payout sent! ${amountUsd} USDT has been credited directly to ${destination} (Payout ID: ${instantPayoutId}).`;
          } else {
            instantSuccess = false;
            instantNotice = (fpResult && fpResult.message) || 'FaucetPay API balance temporarily awaiting reload. Queued for 1-click admin transfer.';
          }
        } catch (fpErr: any) {
          instantSuccess = false;
          instantNotice = fpErr?.message || 'FaucetPay API connection error. Queued for admin review.';
        }
      }
    } else if (method === 'upi') {
      // UPI (FOR ₹ ONLY) UPI ID:- MINIMUM 1₹ WITHDRAWAL, 100 coins extra for every amount (1₹ = 1100 coins, 2₹ = 2200, etc.)
      const targetInr = inrInput > 0 ? Math.floor(inrInput) : Math.floor(rawCoins / 1100);
      if (targetInr < 1) {
        res.status(400).json({ error: 'Minimum UPI withdrawal is ₹1 (1,100 Coins). ₹1 = 1,100 Coins (includes 100 Coins transfer fee).' });
        return;
      }
      coinsToDeduct = targetInr * 1100;
      amountInr = targetInr;
      amountUsd = Number((coinsToDeduct / 100000).toFixed(4));

      if (user.availableCoins < coinsToDeduct) {
        res.status(400).json({
          error: `Insufficient available coins. ₹${targetInr} withdrawal requires ${coinsToDeduct.toLocaleString('en-IN')} Coins (₹1 = 1,100 Coins). Your available balance is ${user.availableCoins} Coins.`,
        });
        return;
      }
    } else if (method === 'gift_card') {
      if (coinsToDeduct < 1000) {
        res.status(400).json({ error: 'Please enter a valid Gift Card coin amount.' });
        return;
      }
      if (user.availableCoins < coinsToDeduct) {
        res.status(400).json({
          error: `Insufficient available coins. Your available balance is ${user.availableCoins} Coins.`,
        });
        return;
      }
      amountInr = Number(((coinsToDeduct * 90) / 100000).toFixed(2));
      amountUsd = Number((coinsToDeduct / 100000).toFixed(4));
    } else {
      // Other channels: Min 100,000 Coins
      if (coinsToDeduct < 100000) {
        res.status(400).json({ error: 'Minimum withdrawal for this channel is 100,000 Coins ($1.00 USD / ₹90.00 INR).' });
        return;
      }
      if (user.availableCoins < coinsToDeduct) {
        res.status(400).json({
          error: `Insufficient available coins. Your available balance is ${user.availableCoins} Coins.`,
        });
        return;
      }
      amountInr = Number(((coinsToDeduct * 90) / 100000).toFixed(2));
      amountUsd = Number((coinsToDeduct / 100000).toFixed(4));
    }

    user.availableCoins -= coinsToDeduct;
    const finalStatus = instantSuccess ? 'completed' : 'pending';
    const wd: ServerWithdrawal = {
      id: 'wd_' + Date.now().toString(36),
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      method,
      tier_label: methodLabel,
      coins_deducted: coinsToDeduct,
      amount_inr: amountInr,
      payout_details_json: destination,
      utr_or_voucher: instantPayoutId || (isInstantFaucetPay && !instantSuccess ? 'FP_QUEUED: ' + instantNotice : null),
      status: finalStatus,
      created_at: new Date().toISOString(),
      processed_at: instantSuccess ? new Date().toISOString() : undefined,
    };
    db.withdrawals.unshift(wd);

    db.postbacks.unshift({
      id: 'ldg_wd_' + Date.now(),
      user_id: user.id,
      user_name: user.name,
      source_type: 'withdrawal',
      title: instantSuccess
        ? `⚡ Instant FaucetPay Payout ($${amountUsd} USDT)`
        : `Cashout Request (${methodLabel} - ${method === 'crypto' || method === 'faucetpay' ? `$${amountUsd} USDT` : `₹${amountInr}`})`,
      amount_coins: -coinsToDeduct,
      status: finalStatus,
      external_tx_id: wd.id,
      created_at: new Date().toISOString(),
    });

    saveDB(db);

    res.json({
      ok: true,
      status: finalStatus,
      instant: instantSuccess,
      payoutId: instantPayoutId || null,
      message: instantSuccess
        ? instantNotice
        : method === 'crypto' || method === 'faucetpay'
        ? (isInstantFaucetPay
            ? `Withdrawal queued! ${instantNotice}`
            : `Withdrawal of $${amountUsd} USDT submitted for Admin Review (amounts above $0.01 / 1,000 Coins are reviewed before 1-click automatic transfer).`)
        : `Withdrawal request for ₹${amountInr} (${coinsToDeduct.toLocaleString('en-IN')} Coins) submitted! Admin will transfer to your UPI ID (${destination}).`,
      user: buildPlayerResponse(db, user),
      withdrawalId: wd.id,
    });
  });

  // SINGLE Universal S2S Offerwall Postback Webhook (GET & POST) — Supports /api/postback and /lootify/api/postback
  app.all(['/api/postback', '/api/postback/:provider', '/lootify/api/postback', '/lootify/api/postback/:provider'], (req, res) => {
    const db = loadDB();

    const merged: Record<string, string> = {};
    Object.entries(req.query || {}).forEach(([k, v]) => {
      if (v !== undefined) merged[k] = String(v);
    });
    Object.entries(req.body || {}).forEach(([k, v]) => {
      if (v !== undefined) merged[k] = String(v);
    });

    const rawTxId =
      pickCleanFromObj(merged, [
        'transId',
        'trans_id',
        'txn_id',
        'tx_id',
        'transaction_id',
        'id',
      ]) || `${Date.now()}`;

    const isPubCryptoPayload = Boolean(
      merged.reward_pb !== undefined ||
        merged.payout_pb !== undefined ||
        merged.reward_name !== undefined ||
        /^(LD|LT)-/i.test(rawTxId)
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

    const userId = pickCleanFromObj(merged, [
      'subId',
      'subid',
      'sub_id',
      'user_id',
      'uid',
      'user',
      'userid',
      'click_id',
    ]);

    const explicitRewardPb = pickCleanFromObj(merged, ['reward_pb', 'member_points']);
    const explicitFullReward = pickCleanFromObj(merged, ['reward', 'coins', 'points', 'currency']);
    const explicitAmount = pickCleanFromObj(merged, ['amount']);
    const rawUsdPayout = pickCleanFromObj(merged, ['payout_pb', 'payout', 'usd']);

    let coins = 0;
    const pbVal = explicitRewardPb ? Math.abs(parseFloat(explicitRewardPb) || 0) : 0;
    const fullVal = explicitFullReward ? Math.abs(parseFloat(explicitFullReward) || 0) : 0;
    const amtVal = explicitAmount ? Math.abs(parseFloat(explicitAmount) || 0) : 0;
    const highestCoins = Math.max(pbVal, fullVal, amtVal);

    if (highestCoins > 0) {
      coins = Number(Math.max(0.01, highestCoins).toFixed(2));
    } else if (rawUsdPayout && Number(rawUsdPayout) > 0) {
      const pVal = Math.abs(parseFloat(rawUsdPayout) || 0);
      const rate = isPubCryptoPayload || providerId === 'pubcrypto' ? 9000 : 3000;
      coins = pVal < 1.0 ? Number((pVal * rate).toFixed(2)) : Number(pVal.toFixed(2));
    }
    if ((isPubCryptoPayload || providerId === 'pubcrypto') && coins > 0) {
      if (fullVal > 0) {
        coins = Math.max(coins, fullVal);
      } else {
        coins = Number((coins * 1.259259).toFixed(2));
      }
    }
    const parsedAmount = coins;

    const incomingSig = (
      merged.signature ||
      merged.sig ||
      merged.hash ||
      ''
    )
      .trim()
      .toLowerCase();
    if (incomingSig) {
      const sigSubId = pickCleanFromObj(merged, ['subId', 'subid', 'sub_id', 'user_id']) || userId;
      const sigTransId = pickCleanFromObj(merged, ['transId', 'trans_id', 'txn_id']) || rawTxId;
      const sigReward =
        merged.reward_pb !== undefined
          ? merged.reward_pb
          : merged.reward !== undefined
          ? merged.reward
          : coins;

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
      if (!isPendingStatus && existingEntry.status === 'pending_hold') {
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
      shortlinks: db.shortlinks,
    });
  });

  app.post('/api/admin/withdrawals/update', async (req, res) => {
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

    if (status === 'completed' && (wd.method === 'crypto' || wd.method === 'faucetpay')) {
      // "WAHA SE APPROVE DABATE HI AUTOMATIC TRANSFER"
      let fpPayoutId = wd.utr_or_voucher;
      if (!fpPayoutId || (!fpPayoutId.startsWith('fp_') && !fpPayoutId.startsWith('FP_') && !fpPayoutId.includes('FAUCETPAY_'))) {
        try {
          const fpResult = await sendFaucetPayPayout(
            wd.payout_details_json,
            wd.coins_deducted,
            'USDT',
            false
          );
          if (!fpResult || Number(fpResult.status) !== 200) {
            res.status(400).json({
              error:
                (fpResult && fpResult.message) ||
                'FaucetPay API error. Ensure your FaucetPay wallet has sufficient USDT balance.',
              faucetpayResponse: fpResult || null,
            });
            return;
          }
          fpPayoutId = String(fpResult.payout_id || fpResult.payout_user_hash || 'FP_' + Date.now());
        } catch (err: any) {
          res.status(500).json({ error: err?.message || 'Failed to contact FaucetPay API' });
          return;
        }
      }
      wd.status = 'completed';
      wd.utr_or_voucher = fpPayoutId;
      wd.processed_at = new Date().toISOString();
      saveDB(db);
      res.json({
        ok: true,
        payoutId: fpPayoutId,
        message: `Approved & Automatically Transferred via FaucetPay API to ${wd.payout_details_json}!`,
      });
      return;
    }

    wd.status = status;
    wd.processed_at = new Date().toISOString();
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

  // Dynamic Shortlinks Add / Update (UPSERT)
  app.post(['/api/admin/shortlinks/save', '/api/admin/shortlinks/update'], (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const id = String(body.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!id) {
      res.status(400).json({ error: 'Shortlink ID / Slug is required.' });
      return;
    }

    const diffRaw = String(body.difficulty || 'Easy').trim();
    const difficulty: 'Easy' | 'Medium' | 'Fast' =
      diffRaw === 'Medium' ? 'Medium' : diffRaw === 'Fast' ? 'Fast' : 'Easy';

    const updatedLink: ServerShortlinkConfig = {
      id,
      name: String(body.name || id).trim(),
      provider: String(body.provider || 'Shortlink Partner').trim(),
      url: String(
        body.url || `https://lootify.eternant.c0m.to/#/shortlinks?sl_verify=${id}`
      ).trim(),
      reward_coins: Math.max(0.01, Number(body.reward_coins) || 100),
      daily_limit: Math.max(1, parseInt(String(body.daily_limit || '3'), 10) || 3),
      timer_seconds: Math.max(3, parseInt(String(body.timer_seconds || '12'), 10) || 12),
      difficulty,
      badge: String(body.badge || '⚡ Instant Credit').trim(),
      enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
    };

    const idx = db.shortlinks.findIndex((s) => s.id === id);
    if (idx >= 0) {
      db.shortlinks[idx] = updatedLink;
    } else {
      db.shortlinks.unshift(updatedLink);
    }

    saveDB(db);
    res.json({ ok: true, shortlink: updatedLink, shortlinks: db.shortlinks });
  });

  // Dynamic Shortlink Delete
  app.post('/api/admin/shortlinks/delete', (req, res) => {
    const db = loadDB();
    const id = String(req.body?.id || '').trim().toLowerCase();
    db.shortlinks = db.shortlinks.filter((s) => s.id !== id);
    saveDB(db);
    res.json({ ok: true, shortlinks: db.shortlinks });
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

  // Admin Manual Wallet Controller: Add / Minus / Set Coins on Desired User & Wallet Type with Custom Note
  app.post('/api/admin/users/adjust-wallet', (req, res) => {
    const db = loadDB();
    const body = req.body || {};
    const targetRaw = String(body.targetUser || body.userId || body.email || '').trim();
    const action = String(body.action || 'add').trim().toLowerCase(); // 'add' | 'minus' | 'set'
    const walletType = String(body.walletType || 'available').trim().toLowerCase(); // 'available' | 'pending' | 'both'
    const rawCoins = Math.abs(Number(body.coins) || 0);
    const category = String(body.category || 'admin_bonus').trim();
    const customNote = String(body.note || '').trim();
    const customTxId = String(body.customTxId || '').trim();
    const holdDays = Math.max(0, parseInt(String(body.holdDays ?? '7'), 10) || 0);
    const showInUserHistory = body.showInUserHistory !== false;

    if (!targetRaw) {
      res.status(400).json({ error: 'Target Player ID or Email is required.' });
      return;
    }
    if (action !== 'set' && rawCoins <= 0) {
      res.status(400).json({ error: 'Please enter a valid positive coin amount.' });
      return;
    }

    let user = db.users.find(
      (u) =>
        u.id.toLowerCase() === targetRaw.toLowerCase() ||
        u.email.toLowerCase() === targetRaw.toLowerCase()
    );

    if (!user) {
      const isEmail = targetRaw.includes('@');
      const newId = isEmail
        ? 'plr_' + targetRaw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10)
        : targetRaw;
      const newEmail = isEmail ? targetRaw.toLowerCase() : `${targetRaw}@lootify.local`;
      const newName = isEmail ? targetRaw.split('@')[0] : `Player ${targetRaw.slice(0, 8)}`;
      user = {
        id: newId,
        name: newName,
        email: newEmail,
        authProvider: 'google',
        referralCode: 'LOOT' + Math.floor(100 + Math.random() * 900),
        referredBy: null,
        availableCoins: 0,
        pendingCoins: 0,
        questsCompleted: 0,
        referralsCount: 0,
        joinedAt: new Date().toISOString().slice(0, 10),
      };
      db.users.unshift(user);
    }

    const prevAvail = Number(user.availableCoins) || 0;
    const prevPending = Number(user.pendingCoins) || 0;
    let deltaAvail = 0;
    let deltaPending = 0;

    if (walletType === 'available' || walletType === 'both') {
      if (action === 'add') {
        deltaAvail = Number(rawCoins.toFixed(2));
      } else if (action === 'minus') {
        deltaAvail = -Number(Math.min(prevAvail, rawCoins).toFixed(2));
      } else if (action === 'set') {
        deltaAvail = Number((rawCoins - prevAvail).toFixed(2));
      }
      user.availableCoins = Math.max(0, Number((prevAvail + deltaAvail).toFixed(2)));
    }

    if (walletType === 'pending' || walletType === 'both') {
      if (action === 'add') {
        deltaPending = Number(rawCoins.toFixed(2));
      } else if (action === 'minus') {
        deltaPending = -Number(Math.min(prevPending, rawCoins).toFixed(2));
      } else if (action === 'set') {
        deltaPending = Number((rawCoins - prevPending).toFixed(2));
      }
      user.pendingCoins = Math.max(0, Number((prevPending + deltaPending).toFixed(2)));
    }

    const categoryLabels: Record<string, string> = {
      admin_bonus: '🎁 Admin Bonus',
      manual_credit: '⚡ Manual Credit',
      offerwall_compensation: '🛠️ Offerwall Compensation',
      contest_prize: '🏆 Contest / Giveaway Prize',
      promo_reward: '💎 Special Promo Reward',
      penalty_deduction: '⚠️ Admin Penalty / Deduction',
      chargeback_adjustment: '🔄 Chargeback Adjustment',
      custom: '📌 Admin Adjustment',
    };
    const badgePrefix = categoryLabels[category] || '📌 Admin Adjustment';
    const walletLabel =
      walletType === 'pending'
        ? 'Pending/Hold Wallet'
        : walletType === 'both'
        ? 'Available + Pending Wallets'
        : 'Available Wallet';
    const effectiveDelta = walletType === 'pending' ? deltaPending : deltaAvail;
    const defaultNote =
      effectiveDelta >= 0
        ? `Added +${Math.abs(effectiveDelta)} Coins to ${walletLabel}`
        : `Deducted ${effectiveDelta} Coins from ${walletLabel}`;
    const finalTitle = customNote ? `${badgePrefix}: ${customNote}` : `${badgePrefix} — ${defaultNote}`;
    const txRef = customTxId || `ADM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();
    const unlocksAt =
      walletType === 'pending' && deltaPending > 0 && holdDays > 0
        ? new Date(Date.now() + holdDays * 86400000).toISOString()
        : null;

    db.postbacks.unshift({
      id: 'ldg_adm_' + Date.now(),
      user_id: user.id,
      user_name: user.name,
      source_type: showInUserHistory ? 'admin_adjustment' : 'admin_silent',
      title: finalTitle,
      amount_coins: effectiveDelta,
      status: walletType === 'pending' ? (deltaPending >= 0 ? 'pending_hold' : 'deducted') : 'credited',
      external_tx_id: txRef,
      created_at: nowIso,
      unlocks_at: unlocksAt,
    });

    saveDB(db);
    res.json({
      ok: true,
      message: `${
        effectiveDelta >= 0 ? `✅ +${effectiveDelta}` : `⚠️ ${effectiveDelta}`
      } Coins applied to ${user.email} (${user.id}) [${walletLabel}]! New Balance: ${user.availableCoins} Available / ${user.pendingCoins} Pending.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        available_coins: user.availableCoins,
        pending_coins: user.pendingCoins,
        lifetime_earned_coins: user.availableCoins + user.pendingCoins,
      },
      txId: txRef,
      deltaAvail,
      deltaPending,
    });
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
