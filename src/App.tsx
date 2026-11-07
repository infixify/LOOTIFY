import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardTab, OfferwallConfig, PayoutChannel, PlayerUser, ShortlinkConfig, ThemeMode, WithdrawalRecord } from './types.ts';
import { INITIAL_OWM_FEED_SEED } from './owmSeedData.ts';

const STORAGE_USER_KEY = 'lootify_player_user';
const STORAGE_ACCOUNTS_KEY = 'lootify_registered_accounts';
const STORAGE_API_BASE_KEY = 'lootify_api_base_url';
const STORAGE_OFFERWALLS_CACHE_KEY = 'lootify_offerwalls_dynamic_v7';
const STORAGE_SHORTLINKS_CACHE_KEY = 'lootify_shortlinks_dynamic_v1';

const OFFERWALLME_PUBLIC_KEY = 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
const PUBCRYPTO_SITE_KEY = 'site_08b2aad8e6d798b346f08dcaf9b32e176eb5a198';
const _OWM_S_BYTES = [
  47, 123, 124, 33, 38, 28, 35, 45, 27, 11, 24, 57, 28, 43, 43, 38, 46, 1, 14, 28, 125, 40, 6, 43,
  17, 120, 37, 43, 126, 30, 123, 125,
];

const _PC_API_BYTES = [
  57, 60, 43, 22, 124, 47, 113, 44, 47, 44, 126, 126, 127, 124, 124, 124, 113, 124, 126, 44, 43,
  124, 126, 112, 120, 122, 127, 42, 47, 120, 127, 122, 43, 40, 124, 42, 43, 47, 42, 40, 127, 127,
  43, 113, 44, 40, 40, 43, 44, 45, 126, 45,
];

function getClientPubCryptoApiKey(): string {
  try {
    const custom = localStorage.getItem('lootify_pubcrypto_api_key');
    if (custom && custom.trim().length > 8) return custom.trim();
  } catch {}
  return String.fromCharCode(..._PC_API_BYTES.map((b) => b ^ 73));
}

const DEFAULT_OFFERWALLME_WALL: OfferwallConfig = {
  provider_id: 'offerwallme',
  name: 'Offerwall.me',
  badge: 'PTC, Shortlinks, Surveys & Tasks',
  enabled: 1,
  app_id: OFFERWALLME_PUBLIC_KEY,
  iframe_url_template: 'https://offerwall.me/offerwall/{app_id}/{user_id}',
  hold_days: 0,
  postback_macro_query: '?user_id={subId}&amount={reward}&txn_id={transId}&status={status}',
};

const DEFAULT_PUBCRYPTO_WALL: OfferwallConfig = {
  provider_id: 'pubcrypto',
  name: 'PubCrypto',
  badge: 'Shortlinks, PTC, Tasks & Offerwalls',
  enabled: 1,
  app_id: PUBCRYPTO_SITE_KEY,
  iframe_url_template:
    'https://pub.cryptolinkforearn.com/offerwall/?site_key={app_id}&sub_id={user_id}&theme=dark',
  hold_days: 0,
  postback_macro_query: '?user_id={subid}&amount={reward_pb}&txn_id={transId}&status={status}',
};

const DEFAULT_SHORTLINKS_LIST: ShortlinkConfig[] = [
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
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
    claims_today: 0,
  },
];

function formatIstDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) {
    return (
      new Date().toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }) + ' (IST)'
    );
  }
  try {
    let d: Date;
    let isDateOnly = false;
    if (typeof dateInput === 'number') {
      d = dateInput < 10000000000 ? new Date(dateInput * 1000) : new Date(dateInput);
    } else {
      const str = String(dateInput).trim();
      if (!str || str.startsWith('1970') || str === '0' || str === 'null' || str === 'undefined') {
        d = new Date();
      } else if (str.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
        isDateOnly = true;
        d = new Date(`${str}T00:00:00+05:30`);
      } else {
        d = new Date(str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') + 'Z' : str);
      }
    }
    if (Number.isNaN(d.getTime()) || d.getTime() < 86400000) {
      d = new Date();
    }
    if (isDateOnly) {
      return (
        d.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        }) + ' (IST)'
      );
    }
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return (
      new Date().toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }) + ' (IST)'
    );
  }
}

let _cachedServerTimeOffsetSec = 0;

function sha256BytesSync(asciiIn: number[]): number[] {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const maxWord = Math.pow(2, 32);
  let i = 0;
  let j = 0;
  const result: number[] = [];
  const words: number[] = [];
  const asciiBitLength = asciiIn.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  const ascii = asciiIn.slice();
  ascii.push(0x80);
  while ((ascii.length % 64) - 56 !== 0) ascii.push(0);
  for (i = 0; i < ascii.length; i++) {
    j = ascii[i];
    words[i >> 2] = (words[i >> 2] || 0) | (j << ((3 - (i % 4)) * 8));
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result.push(b);
    }
  }
  return result;
}

function hmacSha256HexSync(keyStr: string, messageStr: string): string {
  const enc = new TextEncoder();
  let keyBytes = Array.from(enc.encode(keyStr));
  const msgBytes = Array.from(enc.encode(messageStr));
  if (keyBytes.length > 64) keyBytes = sha256BytesSync(keyBytes);
  while (keyBytes.length < 64) keyBytes.push(0);
  const oKeyPad = keyBytes.map((b) => b ^ 0x5c);
  const iKeyPad = keyBytes.map((b) => b ^ 0x36);
  const innerHash = sha256BytesSync(iKeyPad.concat(msgBytes));
  const outerHash = sha256BytesSync(oKeyPad.concat(innerHash));
  return outerHash.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildSignedOfferwallMeUrlSync(
  publicKey: string,
  userId: string,
  customSecret?: string,
  baseUnixSeconds?: number
): string {
  const pub = (publicKey || OFFERWALLME_PUBLIC_KEY).trim();
  const uid = (userId || '').trim();
  if (!uid) return '';
  const nowSec =
    typeof baseUnixSeconds === 'number' && baseUnixSeconds > 1000000000
      ? Math.floor(baseUnixSeconds)
      : Math.floor(Date.now() / 1000) + _cachedServerTimeOffsetSec;
  // Deterministic 6-hour bucket so the signed URL never changes mid-session and never reloads the iframe
  const bucketSec = Math.floor(nowSec / 21600) * 21600;
  const expires = String(bucketSec + 43200);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const secretKey =
    customSecret && customSecret.trim().length > 8
      ? customSecret.trim()
      : 'f25hoUjdRBQpUbbogHGU4aObX1lb7W24';
  const signature = hmacSha256HexSync(secretKey, message);
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
}

async function buildSignedOfferwallMeUrl(
  publicKey: string,
  userId: string,
  customSecret?: string
): Promise<string> {
  return buildSignedOfferwallMeUrlSync(publicKey, userId, customSecret);
}

function buildOfferwallMeTabUrl(
  baseSignedUrl: string,
  tab: 'offers' | 'surveys' | 'iframe' | 'window' | 'video' | 'shortlinks' | 'tasks',
  taskType?: 'general' | 'telegram'
): string {
  if (!baseSignedUrl) return '';
  try {
    const u = new URL(baseSignedUrl);
    u.searchParams.set('tab', tab);
    if (tab === 'tasks' && taskType) {
      u.searchParams.set('taskType', taskType);
    } else {
      u.searchParams.delete('taskType');
    }
    return u.toString();
  } catch {
    const sep = baseSignedUrl.includes('?') ? '&' : '?';
    return `${baseSignedUrl}${sep}tab=${encodeURIComponent(tab)}${
      tab === 'tasks' && taskType ? `&taskType=${encodeURIComponent(taskType)}` : ''
    }`;
  }
}

function loadCachedPubCryptoUrl(_uid?: string, _themeMode?: string): string {
  // PubCrypto embed_token (owe_...) is strictly SINGLE-USE (1st call = 200 OK, 2nd call = 401 Embed link expired).
  // Never cache or reuse a consumed embed_token across mounts!
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('lootify_pc_embed_')) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
  return '';
}

function saveCachedPubCryptoUrl(_uid: string, _themeMode: string, _url: string) {
  // Single-use embed_token must never be cached in sessionStorage
}

function OfferwallMeBanner({ size }: { size: '728x90' | '468x60' | '300x250' }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://offerwall.me/api/public/banner-code.js';
    script.setAttribute('data-placement', OFFERWALLME_PUBLIC_KEY);
    script.setAttribute('data-size', size);
    script.setAttribute('data-frame-origin', 'https://offerwall.me');
    el.appendChild(script);
    return () => {
      el.innerHTML = '';
    };
  }, [size]);

  const [w, h] = size.split('x').map(Number);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: w,
          maxWidth: '100%',
          minHeight: h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'rgba(9,13,25,0.6)',
          border: '1px solid var(--border)',
        }}
      />
    </div>
  );
}

function getApiBaseUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_API_BASE_KEY);
    if (saved && saved.trim()) {
      if (saved.includes('workers.dev')) {
        localStorage.removeItem(STORAGE_API_BASE_KEY);
        return '';
      }
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {}
  return '';
}

function loadCachedOfferwalls(): OfferwallConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_OFFERWALLS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.map((w: OfferwallConfig) => {
          const copy = { ...w };
          delete copy.signed_iframe_url;
          if (copy.provider_id === 'offerwallme' && copy.postback_macro_query) {
            copy.postback_macro_query = copy.postback_macro_query.replace('{subid}', '{subId}');
          }
          return copy;
        });
        if (!cleaned.some((w: OfferwallConfig) => w.provider_id === 'offerwallme')) {
          cleaned.unshift({ ...DEFAULT_OFFERWALLME_WALL });
        }
        if (!cleaned.some((w: OfferwallConfig) => w.provider_id === 'pubcrypto')) {
          cleaned.push({ ...DEFAULT_PUBCRYPTO_WALL });
        }
        return cleaned;
      }
    }
  } catch {}
  return [{ ...DEFAULT_OFFERWALLME_WALL }, { ...DEFAULT_PUBCRYPTO_WALL }];
}

function saveCachedOfferwalls(walls: OfferwallConfig[]) {
  try {
    const cleaned = walls.map((w) => {
      const copy = { ...w };
      delete copy.signed_iframe_url;
      return copy;
    });
    localStorage.setItem(STORAGE_OFFERWALLS_CACHE_KEY, JSON.stringify(cleaned));
  } catch {}
}

function loadCachedShortlinks(): ShortlinkConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_SHORTLINKS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_SHORTLINKS_LIST.map((s) => ({ ...s }));
}

function saveCachedShortlinks(links: ShortlinkConfig[]) {
  try {
    localStorage.setItem(STORAGE_SHORTLINKS_CACHE_KEY, JSON.stringify(links));
  } catch {}
}

const STORAGE_OWM_FEED_CACHE_KEY = 'lootify_owm_feed_cache_v4';

function personalizeOwmItemUrl(rawUrl: string, uid: string): string {
  const cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl || !cleanUrl.includes('offerwall.me')) return cleanUrl;
  const cleanUid = (uid || 'plr_c2fydghha3').trim();
  const nowSec = Math.floor(Date.now() / 1000) + _cachedServerTimeOffsetSec;
  const bucketSec = Math.floor(nowSec / 21600) * 21600;
  const expires = String(bucketSec + 43200);
  const message = `offerwall-user-v1\n${OFFERWALLME_PUBLIC_KEY}\n${cleanUid}\n${expires}`;
  const signature = hmacSha256HexSync('f25hoUjdRBQpUbbogHGU4aObX1lb7W24', message);
  return cleanUrl
    .replace(/([?&]id=)[^&]*/i, `$1${encodeURIComponent(cleanUid)}`)
    .replace(/([?&]identityExpires=)[^&]*/i, `$1${encodeURIComponent(expires)}`)
    .replace(/([?&]identitySignature=)[^&]*/i, `$1${encodeURIComponent(signature)}`);
}

function personalizeOwmFeedForUser(
  feed: {
    ptc: any[];
    shortlinks: any[];
    tasks: any[];
    offers: any[];
    surveys: any[];
    history: any[];
  },
  uid?: string
) {
  let activeUid = (uid || '').trim();
  if (!activeUid) {
    try {
      const rawUser = localStorage.getItem(STORAGE_USER_KEY);
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser && parsedUser.id) activeUid = String(parsedUser.id).trim();
      }
    } catch {}
  }
  if (!activeUid) activeUid = 'plr_c2fydghha3';

  const rawPtc =
    Array.isArray(feed.ptc) && feed.ptc.length > 0 ? feed.ptc : INITIAL_OWM_FEED_SEED.ptc;
  const rawShortlinks =
    Array.isArray(feed.shortlinks) && feed.shortlinks.length > 0
      ? feed.shortlinks
      : INITIAL_OWM_FEED_SEED.shortlinks;
  const rawTasks =
    Array.isArray(feed.tasks) && feed.tasks.length > 0 ? feed.tasks : INITIAL_OWM_FEED_SEED.tasks;
  const rawOffers =
    Array.isArray(feed.offers) && feed.offers.length > 0
      ? feed.offers
      : INITIAL_OWM_FEED_SEED.offers;
  const rawSurveys =
    Array.isArray(feed.surveys) && feed.surveys.length > 0
      ? feed.surveys
      : INITIAL_OWM_FEED_SEED.surveys;

  return {
    ptc: rawPtc.map((x) => ({
      ...x,
      url: personalizeOwmItemUrl(x?.url, activeUid),
    })),
    shortlinks: rawShortlinks.map((x) => ({
      ...x,
      url: personalizeOwmItemUrl(x?.url, activeUid),
    })),
    tasks: rawTasks,
    offers: rawOffers.map((x) => ({
      ...x,
      url: personalizeOwmItemUrl(x?.url, activeUid),
    })),
    surveys: rawSurveys.map((x) => ({
      ...x,
      url: personalizeOwmItemUrl(x?.url, activeUid),
    })),
    history: Array.isArray(feed.history) ? feed.history : [],
  };
}

function loadCachedOwmFeed(): {
  ptc: any[];
  shortlinks: any[];
  tasks: any[];
  offers: any[];
  surveys: any[];
  history: any[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_OWM_FEED_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return personalizeOwmFeedForUser({
          ptc:
            Array.isArray(parsed.ptc) && parsed.ptc.length > 0
              ? parsed.ptc
              : INITIAL_OWM_FEED_SEED.ptc,
          shortlinks:
            Array.isArray(parsed.shortlinks) && parsed.shortlinks.length > 0
              ? parsed.shortlinks
              : INITIAL_OWM_FEED_SEED.shortlinks,
          tasks:
            Array.isArray(parsed.tasks) && parsed.tasks.length > 0
              ? parsed.tasks
              : INITIAL_OWM_FEED_SEED.tasks,
          offers:
            Array.isArray(parsed.offers) && parsed.offers.length > 0
              ? parsed.offers
              : INITIAL_OWM_FEED_SEED.offers,
          surveys:
            Array.isArray(parsed.surveys) && parsed.surveys.length > 0
              ? parsed.surveys
              : INITIAL_OWM_FEED_SEED.surveys,
          history: Array.isArray(parsed.history) ? parsed.history : [],
        });
      }
    }
  } catch {}
  return personalizeOwmFeedForUser(INITIAL_OWM_FEED_SEED);
}

function saveCachedOwmFeed(feed: {
  ptc: any[];
  shortlinks: any[];
  tasks: any[];
  offers: any[];
  surveys: any[];
  history: any[];
}) {
  try {
    const compact = {
      ptc: (feed.ptc || []).slice(0, 30),
      shortlinks: (feed.shortlinks || []).slice(0, 60),
      tasks: (feed.tasks || []).slice(0, 40),
      offers: (feed.offers || []).slice(0, 60),
      surveys: (feed.surveys || []).slice(0, 50),
      history: (feed.history || []).slice(0, 40),
    };
    localStorage.setItem(STORAGE_OWM_FEED_CACHE_KEY, JSON.stringify(compact));
  } catch {}
}

function generateUniquePlayerId(emailRaw: string): string {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (email === 'sarthaksinghyadav1@gmail.com') {
    return 'plr_c2fydghha3';
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < email.length; i++) {
    const c = email.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i * 31;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const prefix = email.replace(/[^a-z0-9]/g, '').slice(0, 4) || 'user';
  return `plr_${prefix}_${h1.toString(36)}${h2.toString(36)}`;
}

function parseHistoryTimestampMs(val?: string | number | Date | null): number {
  if (!val) return 0;
  if (typeof val === 'number') return val < 10000000000 ? val * 1000 : val;
  if (val instanceof Date) return val.getTime();
  const str = String(val).trim();
  if (!str) return 0;
  const iso =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)
      ? str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z')
      : str;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function loadCurrentUser(): PlayerUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.email) return null;

    const cleanEmail = String(parsed.email).trim().toLowerCase();
    let uId = String(parsed.id || '').trim();
    // Prevent any non-admin user from ever sharing the admin ID or demo ID
    if (
      cleanEmail !== 'sarthaksinghyadav1@gmail.com' &&
      (!uId || uId === 'plr_c2fydghha3' || uId === 'plr_demo')
    ) {
      uId = generateUniquePlayerId(cleanEmail);
    }

    const creditedSet = new Set<string>(Array.isArray(parsed.creditedTxIds) ? parsed.creditedTxIds : []);
    const heldRewards = (Array.isArray(parsed.heldRewards) ? [...parsed.heldRewards] : [])
      .filter(Boolean)
      .map((h: any) => {
        const coins = Number(Math.max(0, Number(h.coins) || 0).toFixed(2));
        return {
          ...h,
          coins,
          amountInr: Number(((coins * 90) / 100000).toFixed(4)),
        };
      })
      .sort((a: any, b: any) => parseHistoryTimestampMs(b.createdAt) - parseHistoryTimestampMs(a.createdAt));

    for (const h of heldRewards) {
      if (h && h.id) creditedSet.add(String(h.id));
    }
    const availableCoins = Number((Number(parsed.availableCoins) || 0).toFixed(2));

    return {
      id: uId,
      name: String(parsed.name || parsed.email.split('@')[0]),
      email: String(parsed.email),
      authProvider: parsed.authProvider === 'email' ? 'email' : 'google',
      referralCode: String(parsed.referralCode || 'LOOT100'),
      referredBy: parsed.referredBy || null,
      availableCoins,
      pendingCoins: Number(parsed.pendingCoins) || 0,
      questsCompleted: Math.max(Number(parsed.questsCompleted) || 0, heldRewards.length),
      referralsCount: Number(parsed.referralsCount) || 0,
      faucetClaimsCount: Number(parsed.faucetClaimsCount) || 0,
      lastFaucetClaimAt: parsed.lastFaucetClaimAt || null,
      joinedAt: String(parsed.joinedAt || new Date().toISOString().slice(0, 10)),
      withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
      heldRewards,
      faucetHistory: Array.isArray(parsed.faucetHistory) ? parsed.faucetHistory : [],
      creditedTxIds: Array.from(creditedSet),
    };
  } catch {
    return null;
  }
}

function saveCurrentUser(user: PlayerUser | null) {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem('lootify_user_id');
      return;
    }
    const sortedHeld = Array.isArray(user.heldRewards)
      ? [...user.heldRewards].sort(
          (a, b) => parseHistoryTimestampMs(b?.createdAt) - parseHistoryTimestampMs(a?.createdAt)
        )
      : [];
    const normalizedUser: PlayerUser = {
      ...user,
      heldRewards: sortedHeld,
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalizedUser));
    localStorage.setItem('lootify_user_id', normalizedUser.id);

    const accountsRaw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    const accounts: Record<string, any> = accountsRaw ? JSON.parse(accountsRaw) : {};
    const key = normalizedUser.email.toLowerCase();
    accounts[key] = {
      ...(accounts[key] || {}),
      user: normalizedUser,
    };
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

function isHashAdmin(): boolean {
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/\.html$/, '').toLowerCase();
  return hash === 'admin';
}

const ADMIN_ALLOWED_EMAIL = 'sarthaksinghyadav1@gmail.com';
const STORAGE_ADMIN_SESSION_KEY = 'lootify_admin_session';
const GOOGLE_CLIENT_ID = '881444436109-t1v1a42d9l8v7ibnqplnebdkdlqp15v7.apps.googleusercontent.com';

function loadAdminSession(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_ADMIN_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && String(parsed.email || '').trim().toLowerCase() === ADMIN_ALLOWED_EMAIL);
  } catch {
    return false;
  }
}

function saveAdminSession(active: boolean) {
  try {
    if (!active) {
      localStorage.removeItem(STORAGE_ADMIN_SESSION_KEY);
      return;
    }
    localStorage.setItem(
      STORAGE_ADMIN_SESSION_KEY,
      JSON.stringify({
        email: ADMIN_ALLOWED_EMAIL,
        loggedInAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore storage errors
  }
}

function getTabFromHash(): DashboardTab {
  const rawHash = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
  const hash = rawHash.split('?')[0];
  if (hash === 'shortlinks' || hash === 'shortlink' || rawHash.includes('sl_verify=')) {
    return 'shortlinks';
  }
  if (hash === 'offerwalls') {
    return 'offerwalls';
  }
  if (hash === 'quests') {
    return 'quests';
  }
  if (hash === 'ptc') {
    return 'ptc';
  }
  if (hash === 'youtube' || hash === 'video') {
    return 'youtube';
  }
  if (hash === 'surveys' || hash === 'survey') {
    return 'surveys';
  }
  if (hash === 'tasks') {
    return 'tasks';
  }
  if (hash === 'faucet' || hash === 'roll') return 'faucet';
  if (hash === 'referrals') return 'referrals';
  if (hash === 'wallet') return 'wallet';
  return 'overview';
}

export default function App() {
  const [user, setUser] = useState<PlayerUser | null>(() => loadCurrentUser());
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => isHashAdmin());
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(() => loadAdminSession());
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => getTabFromHash());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' ? 'light' : 'dark';
  });
  const [copiedRef, setCopiedRef] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Dynamic Offerwalls state (Offerwall.me & PubCrypto active by default)
  const [offerwalls, setOfferwalls] = useState<OfferwallConfig[]>(() => loadCachedOfferwalls());
  const [selectedWallId, setSelectedWallId] = useState<string>('offerwallme');
  const [signedOfferwallMeUrl, setSignedOfferwallMeUrl] = useState<string>(() => {
    const initialUser = loadCurrentUser();
    return initialUser?.id
      ? buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, initialUser.id)
      : '';
  });
  const [signedPubCryptoUrl, setSignedPubCryptoUrl] = useState<string>('');
  const [pubCryptoIframeHeight, setPubCryptoIframeHeight] = useState<number>(800);
  const [syncingWallet, setSyncingWallet] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Admin state
  const [apiBaseInput, setApiBaseInput] = useState<string>(() => getApiBaseUrl());
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);
  const [adminPostbacks, setAdminPostbacks] = useState<any[]>([]);
  const [copiedPostbackId, setCopiedPostbackId] = useState<string | null>(null);
  const [adminStatusBanner, setAdminStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Offerwall Creator state (100% Dynamic)
  const [newWallName, setNewWallName] = useState('');
  const [newWallSlug, setNewWallSlug] = useState('');
  const [newWallBadge, setNewWallBadge] = useState('Tasks & Surveys');
  const [newWallAppId, setNewWallAppId] = useState('');
  const [newWallIframe, setNewWallIframe] = useState('');
  const [newWallSecret, setNewWallSecret] = useState('');
  const [newWallHoldDays, setNewWallHoldDays] = useState('0');
  const [newWallMacroQuery, setNewWallMacroQuery] = useState(
    '?user_id={user_id}&amount={amount}&txn_id={txn_id}&status={status}'
  );

  const [useDirectOfferwallMe, setUseDirectOfferwallMe] = useState<boolean>(false);

  // Admin S2S Test Simulator state
  const [testProvider, setTestProvider] = useState('offerwallme');
  const [testUserId, setTestUserId] = useState('');
  const [testCoins, setTestCoins] = useState('500');

  // Admin Manual Player Wallet Controller state
  const [adjTargetUser, setAdjTargetUser] = useState('');
  const [adjAction, setAdjAction] = useState<'add' | 'minus' | 'set'>('add');
  const [adjWalletType, setAdjWalletType] = useState<'available' | 'pending' | 'both'>('available');
  const [adjCoins, setAdjCoins] = useState('500');
  const [adjCategory, setAdjCategory] = useState<string>('admin_bonus');
  const [adjNote, setAdjNote] = useState('');
  const [adjCustomTxId, setAdjCustomTxId] = useState('');
  const [adjHoldDays, setAdjHoldDays] = useState('7');
  const [adjShowInHistory, setAdjShowInHistory] = useState(true);
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState('');

  // Cashout form state
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>('crypto');
  const [giftCardBrand, setGiftCardBrand] = useState<'Google Play' | 'Amazon Pay' | 'Flipkart'>('Google Play');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutCoins, setPayoutCoins] = useState('1000');
  const [upiInrInput, setUpiInrInput] = useState('1');
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Built-in Faucet state
  const [faucetMathA, setFaucetMathA] = useState<number>(() => Math.floor(3 + Math.random() * 9));
  const [faucetMathB, setFaucetMathB] = useState<number>(() => Math.floor(2 + Math.random() * 8));
  const [faucetMathInput, setFaucetMathInput] = useState<string>('');
  const [faucetUnlockSecs, setFaucetUnlockSecs] = useState<number>(0);
  const [faucetUnlocked, setFaucetUnlocked] = useState<boolean>(false);
  const [faucetRolling, setFaucetRolling] = useState<boolean>(false);
  const [faucetCooldownSecs, setFaucetCooldownSecs] = useState<number>(0);
  const [faucetLastResult, setFaucetLastResult] = useState<{
    rollNumber: number;
    rewardCoins: number;
    notice?: string | null;
  } | null>(null);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  // Shortlinks Earning Section & Admin Shortlinks Manager state
  const [shortlinks, setShortlinks] = useState<ShortlinkConfig[]>(() => loadCachedShortlinks());
  const [shortlinkFilter, setShortlinkFilter] = useState<'all' | 'available' | 'completed' | 'highest'>('all');
  const [activeShortlinkId, setActiveShortlinkId] = useState<string | null>(null);
  const [shortlinkTimerSecs, setShortlinkTimerSecs] = useState<number>(0);
  const [shortlinkReadyToClaim, setShortlinkReadyToClaim] = useState<boolean>(false);
  const [shortlinkClaiming, setShortlinkClaiming] = useState<boolean>(false);
  const [shortlinkStatusMsg, setShortlinkStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin New Shortlink Creator state
  const [newSlName, setNewSlName] = useState('');
  const [newSlSlug, setNewSlSlug] = useState('');
  const [newSlProvider, setNewSlProvider] = useState('ShrinkMe.io');
  const [newSlUrl, setNewSlUrl] = useState('');
  const [newSlReward, setNewSlReward] = useState('100');
  const [newSlLimit, setNewSlLimit] = useState('3');
  const [newSlTimer, setNewSlTimer] = useState('15');
  const [newSlDifficulty, setNewSlDifficulty] = useState<'Easy' | 'Medium' | 'Fast'>('Easy');
  const [newSlBadge, setNewSlBadge] = useState('⚡ Instant Credit • 2 Steps');
  const [copiedSlDestId, setCopiedSlDestId] = useState<string | null>(null);
  const [quickLinkProvider, setQuickLinkProvider] = useState<string>('shrinkme');
  const [quickLinkApiToken, setQuickLinkApiToken] = useState<string>('');
  const [adminActiveSection, setAdminActiveSection] = useState<
    'all' | 'wallets' | 'withdrawals' | 'shortlinks' | 'offerwalls' | 'api'
  >('all');
  const [overviewHistoryFilter, setOverviewHistoryFilter] = useState<
    'all' | 'tasks' | 'faucet' | 'withdrawals'
  >('all');
  const [copiedPlayerId, setCopiedPlayerId] = useState<boolean>(false);
  const [earningsPopupOpen, setEarningsPopupOpen] = useState<boolean>(false);
  const [ptcSubMode, setPtcSubMode] = useState<'cards' | 'owm_iframe' | 'owm_window' | 'pubcrypto' | 'timewall_clicks'>('cards');
  const [ptcCardTypeFilter, setPtcCardTypeFilter] = useState<'all' | 'iframe' | 'window' | 'articles' | 'pubcrypto'>('all');
  const [tasksSubMode, setTasksSubMode] = useState<'cards' | 'owm_general' | 'owm_telegram' | 'pubcrypto' | 'timewall_tasks' | 'adlabs'>('cards');
  const [miniTaskSourceFilter, setMiniTaskSourceFilter] = useState<'all' | 'custom' | 'provider' | 'adlabs'>('all');
  const [offersViewMode, setOffersViewMode] = useState<'cards' | 'walls' | 'timewall_offers' | 'timewall_games'>('cards');
  const [surveysViewMode, setSurveysViewMode] = useState<'cards' | 'wall' | 'timewall'>('cards');
  const [youtubeViewMode, setYoutubeViewMode] = useState<'cards' | 'wall'>('cards');
  const [showPartnerShortlinksWall, setShowPartnerShortlinksWall] = useState<boolean>(false);
  const [shortlinksSubMode, setShortlinksSubMode] = useState<'cards' | 'pubcrypto' | 'owm_wall'>('cards');
  const [shortlinkSourceFilter, setShortlinkSourceFilter] = useState<'all' | 'custom' | 'pubcrypto' | 'offerwallme'>('all');

  // Custom Mini-Tasks (Admin-addable tasks + AdLabs ready tasks)
  const [customMiniTasks, setCustomMiniTasks] = useState<
    {
      id: string;
      title: string;
      category: string;
      providerTag: string;
      rewardCoins: number;
      url: string;
      instructions: string;
      proofPlaceholder: string;
      enabled: boolean;
    }[]
  >(() => {
    try {
      const raw = localStorage.getItem('lootify_custom_mini_tasks_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'mt_lootify_tg',
        title: 'Join Official Lootify Telegram Community',
        category: 'Telegram',
        providerTag: 'LOOTIFY MINI-TASK',
        rewardCoins: 150,
        url: 'https://t.me/',
        instructions: '1. Click the link to open Telegram.\n2. Join the official channel.\n3. Enter your Telegram @username below as proof.',
        proofPlaceholder: 'Enter your @telegram_username',
        enabled: true,
      },
      {
        id: 'mt_lootify_yt',
        title: 'Subscribe & Like Lootify YouTube Channel',
        category: 'YouTube',
        providerTag: 'LOOTIFY MINI-TASK',
        rewardCoins: 200,
        url: 'https://youtube.com/',
        instructions: '1. Subscribe to our YouTube channel and like the pinned video.\n2. Submit your YouTube handle or channel name below.',
        proofPlaceholder: 'Enter your YouTube @handle or name',
        enabled: true,
      },
    ];
  });
  const [showAddMiniTaskForm, setShowAddMiniTaskForm] = useState<boolean>(false);
  const [newMtTitle, setNewMtTitle] = useState<string>('');
  const [newMtCategory, setNewMtCategory] = useState<string>('Telegram / Social');
  const [newMtReward, setNewMtReward] = useState<string>('150');
  const [newMtUrl, setNewMtUrl] = useState<string>('');
  const [newMtInstructions, setNewMtInstructions] = useState<string>('');
  const [newMtProofHint, setNewMtProofHint] = useState<string>('Enter username or screenshot URL');

  // PubCrypto Native Single-Piece Feed State (0ms seed + live browser session sync across all internal sub-providers)
  const [pubCryptoNativeFeed, setPubCryptoNativeFeed] = useState<{
    linkTasks: any[];
    reviewMapTasks: any[];
    ptcCampaigns: any[];
    shortlinkCampaigns: any[];
    readArticleCampaigns: any[];
    timewallBaseUrl: string;
  }>(() => ({
    linkTasks: [
      { id: 83, task_name: 'UrkCik', member_reward: '320.00', total_max: 1, remaining_in_cycle: 1, used_in_cycle: 0, cooldown_seconds: 300, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 52, task_name: 'Cuty', member_reward: '60.00', total_max: 1, remaining_in_cycle: 1, used_in_cycle: 0, cooldown_seconds: 1, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 53, task_name: 'Exe', member_reward: '40.00', total_max: 1, remaining_in_cycle: 1, used_in_cycle: 0, cooldown_seconds: 30, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 73, task_name: 'ShrinkMy', member_reward: '40.00', total_max: 5, remaining_in_cycle: 5, used_in_cycle: 0, cooldown_seconds: 300, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 74, task_name: 'ShrinkMy #2', member_reward: '40.00', total_max: 5, remaining_in_cycle: 5, used_in_cycle: 0, cooldown_seconds: 300, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 75, task_name: 'ShrinkMe', member_reward: '40.00', total_max: 5, remaining_in_cycle: 5, used_in_cycle: 0, cooldown_seconds: 300, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
      { id: 81, task_name: 'Cutwin', member_reward: '40.00', total_max: 1, remaining_in_cycle: 1, used_in_cycle: 0, cooldown_seconds: 300, cooldown_remaining: 0, reset_mode: 'rolling_24h', available: true },
    ],
    reviewMapTasks: [],
    ptcCampaigns: [],
    shortlinkCampaigns: [],
    readArticleCampaigns: [],
    timewallBaseUrl: 'https://timewall.io/users/login?oid=fa4d255aee98efc5&uid=717d7a4e3d7d7b13dc82d3d5cd71fcf504280875474fac23',
  }));
  const [pubCryptoLaunchingId, setPubCryptoLaunchingId] = useState<string | null>(null);
  const [pubCryptoLaunchNotice, setPubCryptoLaunchNotice] = useState<string | null>(null);

  // Offerwall.me Single-Piece Feed State (Hydrated in 0ms from localStorage + Live SWR Sync)
  const [owmFeed, setOwmFeed] = useState<{
    ptc: any[];
    shortlinks: any[];
    tasks: any[];
    offers: any[];
    surveys: any[];
    history: any[];
  }>(() => loadCachedOwmFeed());
  const [owmFeedLoading, setOwmFeedLoading] = useState<boolean>(false);
  const [owmLastSyncedAt, setOwmLastSyncedAt] = useState<string>('');
  const [owmClickedIds, setOwmClickedIds] = useState<Record<string, number>>({});
  const [visibleOffersCount, setVisibleOffersCount] = useState<number>(24);
  const [visibleSurveysCount, setVisibleSurveysCount] = useState<number>(24);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskProofInputs, setTaskProofInputs] = useState<Record<string, string>>({});
  const [taskSubmittingId, setTaskSubmittingId] = useState<string | null>(null);
  const [taskSubmitNotice, setTaskSubmitNotice] = useState<{
    taskId: string;
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const markOwmItemClicked = useCallback((key: string) => {
    lastAdActivityAtRef.current = Date.now();
    setOwmClickedIds((prev) => ({ ...prev, [key]: Date.now() }));
  }, []);

  const getOwmCardLiveStatus = useCallback(
    (cardKey: string, titleCandidate: string): { label: string; color: string; bg: string } | null => {
      const cleanTitle = String(titleCandidate || '').trim().toLowerCase();
      if (cleanTitle && Array.isArray(owmFeed.history)) {
        const matched = owmFeed.history.find((h: any) => {
          const hTitle = String(h?.title || '').trim().toLowerCase();
          return hTitle && (hTitle === cleanTitle || hTitle.includes(cleanTitle) || cleanTitle.includes(hTitle));
        });
        if (matched) {
          const st = String(matched.status || '').trim().toLowerCase();
          if (st === 'approved' || st === 'completed') {
            return { label: 'APPROVED & CREDITED', color: 'var(--green)', bg: 'rgba(0,232,154,0.15)' };
          }
          if (st === 'pending') {
            return { label: 'PENDING REVIEW', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)' };
          }
          if (st === 'rejected' || st.includes('reject')) {
            return { label: 'REJECTED', color: 'var(--red)', bg: 'rgba(255,85,102,0.15)' };
          }
        }
      }
      if (owmClickedIds[cardKey]) {
        return { label: 'IN PROGRESS • AUTO-SYNCING', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)' };
      }
      return null;
    },
    [owmFeed.history, owmClickedIds]
  );

  const syncInFlightRef = useRef<boolean>(false);
  const lastAutoSyncAtRef = useRef<number>(0);
  const lastAdActivityAtRef = useRef<number>(Date.now());
  const burstTimersRef = useRef<number[]>([]);
  const pubCryptoRefreshInFlightRef = useRef<boolean>(false);
  const pubCryptoSessionRef = useRef<{
    token: string;
    siteKey: string;
    subId: string;
    expiresAt: number;
  } | null>(null);
  const pubCryptoNativeFetchInFlightRef = useRef<boolean>(false);
  const lastTabSwitchAtRef = useRef<number>(Date.now());
  const owmFetchInFlightRef = useRef<boolean>(false);
  const lastOwmFetchAtRef = useRef<number>(0);

  const syncUserWithBackend = useCallback(
    async (currentUser: PlayerUser | null, showFeedback = false, bypassThrottle = false) => {
      const activeUser = loadCurrentUser() || currentUser;
      if (!activeUser) return;
      if (syncInFlightRef.current && !showFeedback && !bypassThrottle) return;
      const now = Date.now();
      if (!showFeedback && !bypassThrottle && now - lastAutoSyncAtRef.current < 1200) return;

      syncInFlightRef.current = true;
      lastAutoSyncAtRef.current = now;
      if (showFeedback) setSyncingWallet(true);
      const base = getApiBaseUrl();
      const payloadBody = JSON.stringify({
        ...activeUser,
        forceHistory: Boolean(showFeedback || bypassThrottle),
      });
      try {
        let res = await fetch(`${base}/api/user/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadBody,
        }).catch(() => null);

        if ((!res || !res.ok) && base) {
          res = await fetch(`/api/user/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadBody,
          }).catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.user) {
            const freshLocal = loadCurrentUser() || activeUser;
            const sortedHeld = Array.isArray(data.user.heldRewards)
              ? [...data.user.heldRewards].sort(
                  (a, b) => parseHistoryTimestampMs(b?.createdAt) - parseHistoryTimestampMs(a?.createdAt)
                )
              : [];
            const nextUser: PlayerUser = {
              ...data.user,
              heldRewards: sortedHeld,
            };

            const prevAvail = Number(freshLocal.availableCoins) || 0;
            const nextAvail = Number(nextUser.availableCoins) || 0;
            const balanceIncrease = Number((nextAvail - prevAvail).toFixed(2));
            const newlyCredited = Number(data.newlyCreditedCoins) || 0;

            // Check if any new offerwall reward ID appeared compared to previous heldRewards
            const prevHeldIds = new Set(
              (Array.isArray(freshLocal.heldRewards) ? freshLocal.heldRewards : []).map((h) => String(h.id))
            );
            let newHeldCoins = 0;
            if (prevHeldIds.size > 0 && sortedHeld.length > 0) {
              for (const h of sortedHeld) {
                if (h && h.id && !prevHeldIds.has(String(h.id)) && Number(h.coins) > 0) {
                  newHeldCoins = Number((newHeldCoins + Number(h.coins)).toFixed(2));
                }
              }
            }

            const diffCoins =
              newHeldCoins > 0
                ? newHeldCoins
                : newlyCredited > 0
                  ? newlyCredited
                  : balanceIncrease > 0
                    ? balanceIncrease
                    : 0;

            saveCurrentUser(nextUser);
            setUser(nextUser);
            if (diffCoins > 0) {
              setSyncStatusMsg(
                `🎉 +${diffCoins} Coins credited instantly! Balance: ${nextUser.availableCoins} Coins`
              );
              setTimeout(() => setSyncStatusMsg(null), 6000);
            } else if (showFeedback) {
              setSyncStatusMsg(`✅ Synced! Balance: ${nextUser.availableCoins} Available Coins (${sortedHeld.length} tasks in history)`);
              setTimeout(() => setSyncStatusMsg(null), 3500);
            }
          }
        }
      } catch {
        if (showFeedback) {
          setSyncStatusMsg('⚡ Using local wallet cache');
          setTimeout(() => setSyncStatusMsg(null), 3500);
        }
      } finally {
        syncInFlightRef.current = false;
        if (showFeedback) setSyncingWallet(false);
      }
    },
    []
  );

  const fetchOfferwallsFromBackend = useCallback(async (uid?: string) => {
    const base = getApiBaseUrl();
    const activeUid = uid || loadCurrentUser()?.id || '';
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    if (activeUid) {
      const signed = buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, activeUid);
      setSignedOfferwallMeUrl((prev) => (prev && prev.includes(`/${encodeURIComponent(activeUid)}?`) ? prev : signed));
    }
    try {
      const query = activeUid
        ? `?user_id=${encodeURIComponent(activeUid)}&theme=${encodeURIComponent(currentTheme)}`
        : '';
      const res = await fetch(`${base}/api/offerwalls${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.offerwalls) && data.offerwalls.length > 0) {
          const mergedWalls: OfferwallConfig[] = [...data.offerwalls];
          if (!mergedWalls.some((w) => w.provider_id === 'pubcrypto')) {
            mergedWalls.push({ ...DEFAULT_PUBCRYPTO_WALL });
          }
          setOfferwalls(mergedWalls);
          saveCachedOfferwalls(mergedWalls);
          const owm = mergedWalls.find((w: OfferwallConfig) => w.provider_id === 'offerwallme');
          if (owm && owm.signed_iframe_url) {
            setSignedOfferwallMeUrl((prev) =>
              prev && prev.includes('identitySignature=') && prev.includes(`/${encodeURIComponent(activeUid)}?`)
                ? prev
                : String(owm.signed_iframe_url)
            );
          }
        }
      }
    } catch {
      // Fallback to cached offerwalls + synchronous signed Offerwall.me URL
    }
  }, []);

  const refreshOfferwallMeSignedUrl = useCallback(
    async (uid?: string, forceNew = false) => {
      const activeUid = uid || user?.id || loadCurrentUser()?.id || '';
      if (!activeUid) return;
      const syncUrl = buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, activeUid);
      if (!forceNew) {
        setSignedOfferwallMeUrl((prev) =>
          prev && prev.includes('identitySignature=') && prev.includes(`/${encodeURIComponent(activeUid)}?`)
            ? prev
            : syncUrl
        );
        return;
      }

      try {
        const edgeRes = await fetch(
          `/api/offerwalls/signed-url?provider_id=offerwallme&user_id=${encodeURIComponent(
            activeUid
          )}`
        );
        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData && typeof edgeData.server_time === 'number') {
            _cachedServerTimeOffsetSec = edgeData.server_time - Math.floor(Date.now() / 1000);
          }
          if (edgeData && edgeData.signed_iframe_url) {
            setSignedOfferwallMeUrl(edgeData.signed_iframe_url);
            return;
          }
        }
      } catch {}
      if (syncUrl) setSignedOfferwallMeUrl(syncUrl);
    },
    [user?.id]
  );

  const refreshPubCryptoSignedUrl = useCallback(
    async (uid?: string, forceNew = false) => {
      const activeUid = uid || user?.id || loadCurrentUser()?.id || '';
      if (!activeUid) return;
      const currentTheme =
        document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

      if (pubCryptoRefreshInFlightRef.current && !forceNew) return;
      pubCryptoRefreshInFlightRef.current = true;

      // Clear any previously consumed single-use token before minting a fresh one
      setSignedPubCryptoUrl('');

      const base = getApiBaseUrl();
      let resolved = false;
      const cacheBuster = Date.now();

      try {
        // 1. Request a fresh single-use embed_token via our Edge/Worker endpoint
        try {
          const res = await fetch(
            `${base}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
              activeUid
            )}&theme=${encodeURIComponent(currentTheme)}&force=1&_t=${cacheBuster}`,
            { cache: 'no-store' }
          );
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.signed_iframe_url && String(data.signed_iframe_url).includes('embed_token=')) {
              setSignedPubCryptoUrl(String(data.signed_iframe_url));
              resolved = true;
            }
          }
        } catch {}

        // 2. Local relative path fallback if base was remote
        if (!resolved && base) {
          try {
            const localRes = await fetch(
              `/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
                activeUid
              )}&theme=${encodeURIComponent(currentTheme)}&force=1&_t=${cacheBuster}`,
              { cache: 'no-store' }
            );
            const contentType = localRes.headers.get('content-type') || '';
            if (localRes.ok && contentType.includes('application/json')) {
              const data = await localRes.json();
              if (data && data.signed_iframe_url && String(data.signed_iframe_url).includes('embed_token=')) {
                setSignedPubCryptoUrl(String(data.signed_iframe_url));
                resolved = true;
              }
            }
          } catch {}
        }

        // 3. Direct client-side fallback ONLY if backend didn't return an embed_token
        if (!resolved) {
          try {
            const apiKey = getClientPubCryptoApiKey();
            const resp = await fetch('https://pub.cryptolinkforearn.com/api/publisher/embed-tokens', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                site_key: PUBCRYPTO_SITE_KEY,
                sub_id: activeUid,
                origin: 'https://lootify.eternant.c0m.to',
                theme: currentTheme,
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.iframe_url && String(data.iframe_url).includes('embed_token=')) {
                setSignedPubCryptoUrl(String(data.iframe_url));
                resolved = true;
              }
            }
          } catch {}
        }
      } finally {
        pubCryptoRefreshInFlightRef.current = false;
      }
    },
    [user?.id]
  );

  // Reusable 12-hour PubCrypto Browser Session (ows_...) for Native Single-Piece Extraction
  const ensurePubCryptoBrowserSession = useCallback(
    async (uid?: string, forceFresh = false) => {
      const activeUid = uid || user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
      const now = Date.now();
      if (
        !forceFresh &&
        pubCryptoSessionRef.current &&
        pubCryptoSessionRef.current.subId === activeUid &&
        pubCryptoSessionRef.current.token.startsWith('ows_') &&
        pubCryptoSessionRef.current.expiresAt > now + 15000
      ) {
        return pubCryptoSessionRef.current;
      }

      if (!forceFresh) {
        try {
          const cachedRaw = sessionStorage.getItem(`lootify_pc_ows_session_${activeUid}`);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (
              parsed &&
              typeof parsed.token === 'string' &&
              parsed.token.startsWith('ows_') &&
              Number(parsed.expiresAt) > now + 15000
            ) {
              pubCryptoSessionRef.current = parsed;
              return parsed;
            }
          }
        } catch {}
      }

      const base = getApiBaseUrl();
      let embedToken = '';
      try {
        const res = await fetch(
          `${base}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
            activeUid
          )}&theme=dark&force=1&_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.signed_iframe_url) {
            embedToken = new URL(String(data.signed_iframe_url)).searchParams.get('embed_token') || '';
          }
        }
      } catch {}

      if (!embedToken) {
        try {
          const localRes = await fetch(
            `/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
              activeUid
            )}&theme=dark&force=1&_t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (localRes.ok) {
            const data = await localRes.json();
            if (data?.signed_iframe_url) {
              embedToken = new URL(String(data.signed_iframe_url)).searchParams.get('embed_token') || '';
            }
          }
        } catch {}
      }

      if (!embedToken) return null;

      try {
        const sessRes = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embed_token: embedToken }),
        });
        if (!sessRes.ok) return null;
        const sessData = await sessRes.json();
        if (!sessData?.session_token || !String(sessData.session_token).startsWith('ows_')) return null;

        const sessionObj = {
          token: String(sessData.session_token),
          siteKey: String(sessData.site_key || PUBCRYPTO_SITE_KEY),
          subId: String(sessData.sub_id || activeUid),
          expiresAt: Date.now() + Math.max(600, Number(sessData.expires_in) || 43200) * 1000,
        };
        pubCryptoSessionRef.current = sessionObj;
        try {
          sessionStorage.setItem(`lootify_pc_ows_session_${activeUid}`, JSON.stringify(sessionObj));
        } catch {}
        return sessionObj;
      } catch {
        return null;
      }
    },
    [user?.id]
  );

  const fetchPubCryptoNativeFeed = useCallback(
    async (uid?: string, forceFresh = false) => {
      if (pubCryptoNativeFetchInFlightRef.current && !forceFresh) return;
      pubCryptoNativeFetchInFlightRef.current = true;
      try {
        const activeUid = uid || user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
        let sess = await ensurePubCryptoBrowserSession(activeUid, forceFresh);
        if (!sess) return;

        const authHeaders = { Authorization: `Bearer ${sess.token}` };
        const qs = `?site_key=${encodeURIComponent(sess.siteKey)}&sub_id=${encodeURIComponent(sess.subId)}`;

        let extRes = await fetch(`https://pub.cryptolinkforearn.com/api/link-tasks/external${qs}`, {
          headers: authHeaders,
        }).catch(() => null);

        if (extRes && extRes.status === 401) {
          sess = await ensurePubCryptoBrowserSession(activeUid, true);
          if (!sess) return;
          authHeaders.Authorization = `Bearer ${sess.token}`;
          extRes = await fetch(
            `https://pub.cryptolinkforearn.com/api/link-tasks/external?site_key=${encodeURIComponent(
              sess.siteKey
            )}&sub_id=${encodeURIComponent(sess.subId)}`,
            { headers: authHeaders }
          ).catch(() => null);
        }

        const [
          extJson,
          revJson,
          bitcoPtcJson,
          bitcoSlJson,
          readArtJson,
          aoyPtcJson,
          aoySlJson,
          pcOwmPtcJson,
          pcOwmSlJson,
          twJson,
        ] = await Promise.all([
          extRes && extRes.ok ? extRes.json().catch(() => null) : Promise.resolve(null),
          fetch(`https://pub.cryptolinkforearn.com/api/link-tasks/review-map${qs}`, { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/ptc', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/shortlink', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/read-article', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/aoytasks/ptc', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/aoytasks/shortlink', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/offerwallme/ptc', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/offerwallme/shortlink', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('https://pub.cryptolinkforearn.com/api/offerwall/timewall/frame?tab=featured', { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        setPubCryptoNativeFeed((prev) => {
          const linkTasks =
            extJson && Array.isArray(extJson.tasks) && extJson.tasks.length > 0
              ? extJson.tasks
              : prev.linkTasks;
          const reviewMapTasks =
            revJson && Array.isArray(revJson.tasks) ? revJson.tasks : prev.reviewMapTasks;
          const bitcoPtc = Array.isArray(bitcoPtcJson?.campaigns)
            ? bitcoPtcJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'BITCOTASK PTC' }))
            : [];
          const aoyPtc = Array.isArray(aoyPtcJson?.campaigns)
            ? aoyPtcJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'AOYTASKS PTC' }))
            : [];
          const pcOwmPtc = Array.isArray(pcOwmPtcJson?.campaigns)
            ? pcOwmPtcJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'PC • OFFERWALL.ME PTC' }))
            : [];
          const bitcoSl = Array.isArray(bitcoSlJson?.campaigns)
            ? bitcoSlJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'BITCOTASK LINK' }))
            : [];
          const aoySl = Array.isArray(aoySlJson?.campaigns)
            ? aoySlJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'AOYTASKS LINK' }))
            : [];
          const pcOwmSl = Array.isArray(pcOwmSlJson?.campaigns)
            ? pcOwmSlJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'PC • OFFERWALL.ME LINK' }))
            : [];
          const readArticleCampaigns = Array.isArray(readArtJson?.campaigns)
            ? readArtJson.campaigns.map((c: any) => ({ ...c, sourceLabel: 'BITCOTASK READ & EARN' }))
            : prev.readArticleCampaigns;
          const timewallBaseUrl =
            twJson && typeof twJson.frame_url === 'string' && twJson.frame_url.startsWith('https://timewall.io')
              ? twJson.frame_url.replace(/&tab=[^&]+/, '')
              : prev.timewallBaseUrl;

          const allMergedPtc = [...bitcoPtc, ...aoyPtc, ...pcOwmPtc];
          const allMergedSl = [...bitcoSl, ...aoySl, ...pcOwmSl];

          return {
            linkTasks,
            reviewMapTasks,
            ptcCampaigns: allMergedPtc.length > 0 ? allMergedPtc : prev.ptcCampaigns,
            shortlinkCampaigns: allMergedSl.length > 0 ? allMergedSl : prev.shortlinkCampaigns,
            readArticleCampaigns,
            timewallBaseUrl,
          };
        });
      } finally {
        pubCryptoNativeFetchInFlightRef.current = false;
      }
    },
    [ensurePubCryptoBrowserSession, user?.id]
  );

  const getOrCreatePubCryptoDeviceId = () => {
    const key = 'pubcrypto_link_device';
    try {
      const existing = localStorage.getItem(key);
      if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(key, hex);
      return hex;
    } catch {
      return 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    }
  };

  const handleLaunchPubCryptoLinkTask = useCallback(
    async (task: any) => {
      const popup = window.open('about:blank', '_blank');
      if (!popup) {
        setPubCryptoLaunchNotice('Please allow popups in your browser to open this task.');
        return;
      }
      const key = `pc_link_${task.id}`;
      setPubCryptoLaunchingId(key);
      setPubCryptoLaunchNotice(null);
      markOwmItemClicked(key);

      try {
        const activeUid = user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
        let sess = await ensurePubCryptoBrowserSession(activeUid, false);
        if (!sess) {
          sess = await ensurePubCryptoBrowserSession(activeUid, true);
        }
        if (!sess) throw new Error('Could not initialize PubCrypto session.');

        const deviceId = getOrCreatePubCryptoDeviceId();
        let res = await fetch('https://pub.cryptolinkforearn.com/api/link-tasks/external-launch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sess.token}`,
          },
          body: JSON.stringify({ task_id: task.id, device_id: deviceId }),
        });

        if (res.status === 401) {
          sess = await ensurePubCryptoBrowserSession(activeUid, true);
          if (sess) {
            res = await fetch('https://pub.cryptolinkforearn.com/api/link-tasks/external-launch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sess.token}`,
              },
              body: JSON.stringify({ task_id: task.id, device_id: deviceId }),
            });
          }
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.launch_url) {
          throw new Error(data?.error || 'Task is currently on cooldown or unavailable.');
        }

        try {
          popup.opener = null;
        } catch {}
        popup.location.replace(String(data.launch_url));
        fetchPubCryptoNativeFeed(activeUid, true);
      } catch (err: any) {
        popup.close();
        setPubCryptoLaunchNotice(err?.message || 'Unable to launch PubCrypto Link task.');
      } finally {
        setPubCryptoLaunchingId(null);
      }
    },
    [ensurePubCryptoBrowserSession, fetchPubCryptoNativeFeed, markOwmItemClicked, user?.id]
  );

  const handleLaunchPubCryptoCampaign = useCallback(
    async (campaign: any) => {
      const popup = window.open('about:blank', '_blank');
      if (!popup) {
        setPubCryptoLaunchNotice('Please allow popups in your browser to open this campaign.');
        return;
      }
      const key = `pc_camp_${campaign.id || campaign.campaign_token}`;
      setPubCryptoLaunchingId(key);
      setPubCryptoLaunchNotice(null);
      markOwmItemClicked(key);

      try {
        const activeUid = user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
        let sess = await ensurePubCryptoBrowserSession(activeUid, false);
        if (!sess) {
          sess = await ensurePubCryptoBrowserSession(activeUid, true);
        }
        if (!sess) throw new Error('Could not initialize PubCrypto session.');

        const clickBody = JSON.stringify({
          campaign_token: campaign.campaign_token,
          interaction: {
            visible_ms: 4200,
            pointer_events: 5,
            page_visible: true,
            trusted_click: true,
          },
        });

        let res = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sess.token}`,
          },
          body: clickBody,
        });

        if (res.status === 401) {
          sess = await ensurePubCryptoBrowserSession(activeUid, true);
          if (sess) {
            res = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/click', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sess.token}`,
              },
              body: clickBody,
            });
          }
        }

        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.redirect_url) {
          try {
            popup.opener = null;
          } catch {}
          popup.location.replace(String(data.redirect_url));
          return;
        }
        // Fallback: open full PubCrypto session if anti-bot challenge is requested
        const base = getApiBaseUrl();
        popup.location.replace(
          `${base}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
            activeUid
          )}&theme=dark&redirect=1`
        );
      } catch (err: any) {
        popup.close();
        setPubCryptoLaunchNotice(err?.message || 'Unable to open campaign.');
      } finally {
        setPubCryptoLaunchingId(null);
      }
    },
    [ensurePubCryptoBrowserSession, markOwmItemClicked, user?.id]
  );

  const handleLaunchPubCryptoPartnerWall = useCallback(
    async (partner: 'bitcotasks' | 'timewall') => {
      const popup = window.open('about:blank', '_blank');
      if (!popup) return;
      const key = `pc_partner_${partner}`;
      setPubCryptoLaunchingId(key);
      markOwmItemClicked(key);
      try {
        const activeUid = user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
        let sess = await ensurePubCryptoBrowserSession(activeUid, false);
        if (!sess) sess = await ensurePubCryptoBrowserSession(activeUid, true);
        if (!sess) throw new Error('Session failed');

        if (partner === 'timewall') {
          const twRes = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/timewall/frame?tab=tasks', {
            headers: { Authorization: `Bearer ${sess.token}` },
          });
          const twData = await twRes.json().catch(() => ({}));
          if (twRes.ok && twData?.frame_url) {
            popup.location.replace(String(twData.frame_url));
            return;
          }
        } else {
          const otRes = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/other-task', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sess.token}`,
            },
            body: '{}',
          });
          const otData = await otRes.json().catch(() => ({}));
          if (otRes.ok && otData?.campaign_token) {
            const clickRes = await fetch('https://pub.cryptolinkforearn.com/api/offerwall/click', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sess.token}`,
              },
              body: JSON.stringify({
                campaign_token: otData.campaign_token,
                interaction: { visible_ms: 4200, pointer_events: 5, page_visible: true, trusted_click: true },
              }),
            });
            const clickData = await clickRes.json().catch(() => ({}));
            if (clickRes.ok && clickData?.redirect_url) {
              popup.location.replace(String(clickData.redirect_url));
              return;
            }
          }
        }
        const base = getApiBaseUrl();
        popup.location.replace(
          `${base}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
            activeUid
          )}&theme=dark&redirect=1`
        );
      } catch {
        popup.close();
      } finally {
        setPubCryptoLaunchingId(null);
      }
    },
    [ensurePubCryptoBrowserSession, markOwmItemClicked, user?.id]
  );

  // Official PubCrypto Offerwall Auto-Resize postMessage Listener
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://pub.cryptolinkforearn.com' ||
        !event.data ||
        event.data.type !== 'pubcrypto:offerwall-resize'
      ) {
        return;
      }
      const nextHeight = Math.round(
        Math.min(5000, Math.max(360, Number(event.data.height) || 800))
      );
      setPubCryptoIframeHeight(nextHeight);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const fetchShortlinksFromBackend = useCallback(async (uid?: string) => {
    const base = getApiBaseUrl();
    const activeUid = uid || loadCurrentUser()?.id || '';
    try {
      const query = activeUid ? `?user_id=${encodeURIComponent(activeUid)}` : '';
      const res = await fetch(`${base}/api/shortlinks${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.shortlinks) && data.shortlinks.length > 0) {
          setShortlinks(data.shortlinks);
          saveCachedShortlinks(data.shortlinks);
        }
      }
    } catch {
      // Fallback to cached shortlinks
    }
  }, []);

  const fetchOfferwallMeFeed = useCallback(async (uid?: string, forceRefresh = false) => {
    const activeUid = uid || loadCurrentUser()?.id || 'plr_c2fydghha3';
    const now = Date.now();
    if (!forceRefresh && owmFetchInFlightRef.current) return;
    if (!forceRefresh && now - lastOwmFetchAtRef.current < 4000) return;

    owmFetchInFlightRef.current = true;
    lastOwmFetchAtRef.current = now;
    setOwmFeedLoading(true);

    // 1. Fast static bootstrap hydration (<50ms) if we only have the 24-item seed so far
    if (!forceRefresh) {
      fetch('./assets/owm-bootstrap.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((boot) => {
          if (boot && boot.ok) {
            setOwmFeed((prev) => {
              if (prev.offers.length > 30) return prev;
              const merged = personalizeOwmFeedForUser(
                {
                  ptc: Array.isArray(boot.ptc) && boot.ptc.length > 0 ? boot.ptc : prev.ptc,
                  shortlinks:
                    Array.isArray(boot.shortlinks) && boot.shortlinks.length > 0
                      ? boot.shortlinks
                      : prev.shortlinks,
                  tasks: Array.isArray(boot.tasks) && boot.tasks.length > 0 ? boot.tasks : prev.tasks,
                  offers: Array.isArray(boot.offers) && boot.offers.length > 0 ? boot.offers : prev.offers,
                  surveys: Array.isArray(boot.surveys) && boot.surveys.length > 0 ? boot.surveys : prev.surveys,
                  history: prev.history,
                },
                activeUid
              );
              saveCachedOwmFeed(merged);
              return merged;
            });
          }
        })
        .catch(() => {});
    }

    const base = getApiBaseUrl();
    const qs = `?user_id=${encodeURIComponent(activeUid)}${forceRefresh ? '&force=1' : ''}`;
    try {
      let data: any = null;
      try {
        const res = await fetch(`${base}/api/offerwallme/items${qs}`);
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && parsed.ok) data = parsed;
        }
      } catch {}

      if (!data && base) {
        try {
          const localRes = await fetch(`/api/offerwallme/items${qs}`);
          if (localRes.ok) {
            const parsed = await localRes.json();
            if (parsed && parsed.ok) data = parsed;
          }
        } catch {}
      }

      if (data && data.ok) {
        setOwmFeed((prev) => {
          const nextFeed = personalizeOwmFeedForUser(
            {
              ptc: Array.isArray(data.ptc) && data.ptc.length > 0 ? data.ptc : prev.ptc,
              shortlinks:
                Array.isArray(data.shortlinks) && data.shortlinks.length > 0
                  ? data.shortlinks
                  : prev.shortlinks,
              tasks: Array.isArray(data.tasks) && data.tasks.length > 0 ? data.tasks : prev.tasks,
              offers: Array.isArray(data.offers) && data.offers.length > 0 ? data.offers : prev.offers,
              surveys: Array.isArray(data.surveys) && data.surveys.length > 0 ? data.surveys : prev.surveys,
              history: Array.isArray(data.history) ? data.history : prev.history,
            },
            activeUid
          );
          saveCachedOwmFeed(nextFeed);
          return nextFeed;
        });
        setOwmLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour12: false }));

        // If feed history contains any newly approved/completed conversion not yet in local wallet, sync wallet immediately!
        if (Array.isArray(data.history) && data.history.length > 0) {
          const localUsr = loadCurrentUser();
          if (localUsr) {
            const knownIds = new Set<string>([
              ...(Array.isArray(localUsr.creditedTxIds) ? localUsr.creditedTxIds.map(String) : []),
              ...(Array.isArray(localUsr.heldRewards) ? localUsr.heldRewards.map((h) => String(h.id)) : []),
            ]);
            const hasUncreditedApproved = data.history.some((item: any) => {
              const rawTx = String(item?.transactionId || item?.id || '').trim();
              if (!rawTx) return false;
              const st = String(item?.status || '').trim().toLowerCase();
              if (st !== 'approved' && st !== 'completed') return false;
              return (
                !knownIds.has(`offerwallme_${localUsr.id}_${rawTx}`) &&
                !knownIds.has(`owm_${rawTx}`) &&
                !knownIds.has(rawTx)
              );
            });
            if (hasUncreditedApproved) {
              syncUserWithBackend(localUsr, false, true);
            }
          }
        }
      }
    } catch {} finally {
      owmFetchInFlightRef.current = false;
      setOwmFeedLoading(false);
    }
  }, [syncUserWithBackend]);

  const handleSubmitOwmTaskProof = async (taskId: string) => {
    const activeUid = user?.id || loadCurrentUser()?.id || 'plr_c2fydghha3';
    const proofText = String(taskProofInputs[taskId] || '').trim();
    if (!proofText) {
      setTaskSubmitNotice({
        taskId,
        type: 'error',
        text: 'Please enter your task proof (or screenshot link) before submitting.',
      });
      return;
    }
    setTaskSubmittingId(taskId);
    setTaskSubmitNotice(null);
    const base = getApiBaseUrl();
    try {
      let res = await fetch(`${base}/api/offerwallme/task-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUid,
          taskId,
          proof: proofText,
        }),
      }).catch(() => null);

      if ((!res || !res.ok) && base) {
        res = await fetch(`/api/offerwallme/task-submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeUid,
            taskId,
            proof: proofText,
          }),
        }).catch(() => null);
      }

      const data = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok || !data.ok) {
        setTaskSubmitNotice({
          taskId,
          type: 'error',
          text: data?.error || data?.message || 'Task submission failed. Please verify your proof and try again.',
        });
      } else {
        markOwmItemClicked(`task_${taskId}`);
        setTaskSubmitNotice({
          taskId,
          type: 'success',
          text:
            data?.message ||
            'Task proof submitted! Status updated to PENDING REVIEW. Coins will credit automatically via lootify/api/postback upon approval.',
        });
        setTaskProofInputs((prev) => ({ ...prev, [taskId]: '' }));
        fetchOfferwallMeFeed(activeUid, true);
        if (user) syncUserWithBackend(user, false, true);
      }
    } catch {
      setTaskSubmitNotice({
        taskId,
        type: 'error',
        text: 'Network error while submitting task proof. Please try again.',
      });
    } finally {
      setTaskSubmittingId(null);
    }
  };

  const fetchAdminDashboard = useCallback(async () => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/dashboard`, {
        headers: { 'x-admin-email': ADMIN_ALLOWED_EMAIL },
      });
      if (res.ok) {
        const data = await res.json();
        setBackendOnline(true);
        if (Array.isArray(data.users)) setAdminUsers(data.users);
        if (Array.isArray(data.withdrawals)) setAdminWithdrawals(data.withdrawals);
        if (Array.isArray(data.postbacks)) setAdminPostbacks(data.postbacks);
        if (Array.isArray(data.offerwalls) && data.offerwalls.length > 0) {
          setOfferwalls(data.offerwalls);
          saveCachedOfferwalls(data.offerwalls);
        }
        if (Array.isArray(data.shortlinks) && data.shortlinks.length > 0) {
          setShortlinks(data.shortlinks);
          saveCachedShortlinks(data.shortlinks);
        }
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('lootify_client_db_v1');
      localStorage.removeItem('lootify_offerwalls_cache_v1');
      localStorage.removeItem('lootify_offerwalls_dynamic_v4');
      localStorage.removeItem('lootify_offerwalls_dynamic_v5');
      localStorage.removeItem('lootify_offerwalls_dynamic_v6');
    } catch {}

    const initialUser = loadCurrentUser();
    fetchOfferwallsFromBackend(initialUser?.id);
    fetchShortlinksFromBackend(initialUser?.id);
    fetchOfferwallMeFeed(initialUser?.id, false);
    if (initialUser) {
      syncUserWithBackend(initialUser, false);
    }

    const checkShortlinkCallbackParam = () => {
      const fullHash = window.location.hash || '';
      const qIdx = fullHash.indexOf('?');
      if (qIdx >= 0) {
        const params = new URLSearchParams(fullHash.slice(qIdx + 1));
        const verifyId = params.get('sl_verify');
        if (verifyId) {
          setActiveShortlinkId(verifyId);
          setShortlinkTimerSecs(0);
          setShortlinkReadyToClaim(true);
          setActiveTab('shortlinks');
        }
      }
    };
    checkShortlinkCallbackParam();

    const onAuthChanged = () => {
      const loaded = loadCurrentUser();
      setUser(loaded);
      if (loaded) {
        syncUserWithBackend(loaded, false);
        fetchOfferwallsFromBackend(loaded.id);
        fetchShortlinksFromBackend(loaded.id);
        fetchOfferwallMeFeed(loaded.id, false);
      }
      setIsAdminRoute(isHashAdmin());
      setAdminLoggedIn(loadAdminSession());
      setActiveTab(getTabFromHash());
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(currentTheme);
    };

    const onRouteChanged = () => {
      setIsAdminRoute(isHashAdmin());
      setAdminLoggedIn(loadAdminSession());
      setActiveTab(getTabFromHash());
      checkShortlinkCallbackParam();
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(currentTheme);
    };

    window.addEventListener('lootify-auth-changed', onAuthChanged);
    window.addEventListener('hashchange', onRouteChanged);
    window.addEventListener('popstate', onRouteChanged);
    return () => {
      window.removeEventListener('lootify-auth-changed', onAuthChanged);
      window.removeEventListener('hashchange', onRouteChanged);
      window.removeEventListener('popstate', onRouteChanged);
    };
  }, [fetchOfferwallMeFeed, fetchOfferwallsFromBackend, fetchShortlinksFromBackend, syncUserWithBackend]);

  useEffect(() => {
    lastTabSwitchAtRef.current = Date.now();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const doRefresh = (forceFresh = false) => {
      const activeUid = user?.id || loadCurrentUser()?.id;
      if (!activeUid) return;
      const isWallSection =
        activeTab === 'quests' ||
        activeTab === 'offerwalls' ||
        activeTab === 'ptc' ||
        activeTab === 'youtube' ||
        activeTab === 'surveys' ||
        activeTab === 'tasks' ||
        activeTab === 'shortlinks';
      if (isWallSection) {
        refreshOfferwallMeSignedUrl(activeUid, false);
        fetchOfferwallMeFeed(activeUid, forceFresh);
        fetchPubCryptoNativeFeed(activeUid, forceFresh);
      }
    };

    doRefresh(false);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        doRefresh(true);
      }
    }, 20 * 1000);
    return () => window.clearInterval(intervalId);
  }, [user?.id, selectedWallId, activeTab, fetchOfferwallMeFeed, fetchPubCryptoNativeFeed, refreshOfferwallMeSignedUrl]);

  // Mint a brand-new single-use PubCrypto embed_token ONLY when a PubCrypto iframe wall actually mounts, and clear it when unmounted
  useEffect(() => {
    const activeUid = user?.id || loadCurrentUser()?.id;
    if (!activeUid) return;
    const isPubCryptoWallActive =
      (activeTab === 'ptc' && ptcSubMode === 'pubcrypto') ||
      (activeTab === 'tasks' && tasksSubMode === 'pubcrypto') ||
      (activeTab === 'shortlinks' && shortlinksSubMode === 'pubcrypto' && !showPartnerShortlinksWall) ||
      ((activeTab === 'quests' || activeTab === 'offerwalls') &&
        offersViewMode === 'walls' &&
        selectedWallId === 'pubcrypto');

    if (isPubCryptoWallActive) {
      refreshPubCryptoSignedUrl(activeUid, true);
    } else {
      setSignedPubCryptoUrl('');
    }
  }, [
    user?.id,
    activeTab,
    ptcSubMode,
    tasksSubMode,
    shortlinksSubMode,
    showPartnerShortlinksWall,
    offersViewMode,
    selectedWallId,
    refreshPubCryptoSignedUrl,
  ]);

  // Automatic Offerwall, Feed & Wallet sync on event-driven triggers + Multi-Wave Burst + Live 3s-5s Polling
  useEffect(() => {
    const clearBurstTimers = () => {
      for (const tid of burstTimersRef.current) {
        window.clearTimeout(tid);
      }
      burstTimersRef.current = [];
    };

    const scheduleBurstSyncWaves = (delaysMs: number[]) => {
      clearBurstTimers();
      for (const delay of delaysMs) {
        const tid = window.setTimeout(() => {
          const latest = loadCurrentUser();
          if (latest) {
            syncUserWithBackend(latest, false, true);
            if (delay === delaysMs[1] || delay === delaysMs[delaysMs.length - 1]) {
              fetchOfferwallMeFeed(latest.id, true);
            }
          }
        }, delay);
        burstTimersRef.current.push(tid);
      }
    };

    const syncLatestBalanceAndFeed = () => {
      lastAdActivityAtRef.current = Date.now();
      const current = loadCurrentUser();
      if (current) {
        syncUserWithBackend(current, false, true);
        fetchOfferwallMeFeed(current.id, true);
        fetchShortlinksFromBackend(current.id);
        // Schedule follow-up waves to catch S2S postbacks arriving 1.5s-11s after returning from ad/shortlink tab
        scheduleBurstSyncWaves([1500, 3500, 6500, 11000]);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncLatestBalanceAndFeed();
      }
    };

    const onWindowBlur = () => {
      // When user clicks inside an Offerwall or Iframe PTC ad on the page, parent window blurs with activeElement === IFRAME
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        lastAdActivityAtRef.current = Date.now();
        scheduleBurstSyncWaves([2500, 6000, 11000, 17000, 25000]);
      }
    };

    // Continuous live background wallet polling while page is visible (every 3s during active ad session, every 6s idle)
    const livePollInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const current = loadCurrentUser();
      if (!current) return;
      const now = Date.now();
      const isRecentAdSession = now - lastAdActivityAtRef.current < 90 * 1000;
      if (isRecentAdSession) {
        syncUserWithBackend(current, false, true);
      } else if (now - lastAutoSyncAtRef.current >= 5500) {
        syncUserWithBackend(current, false, false);
      }
    }, 3000);

    window.addEventListener('focus', syncLatestBalanceAndFeed);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearBurstTimers();
      window.clearInterval(livePollInterval);
      window.removeEventListener('focus', syncLatestBalanceAndFeed);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchOfferwallMeFeed, fetchShortlinksFromBackend, syncUserWithBackend]);

  useEffect(() => {
    if (isAdminRoute && adminLoggedIn) {
      fetchAdminDashboard();
    }
  }, [isAdminRoute, adminLoggedIn, fetchAdminDashboard]);

  // Faucet 60-min (Hourly) Cooldown & 5-sec Anti-Bot Timer
  useEffect(() => {
    const updateTimers = () => {
      if (user?.lastFaucetClaimAt) {
        const lastMs = new Date(user.lastFaucetClaimAt).getTime();
        const remMs = lastMs + 60 * 60 * 1000 - Date.now();
        setFaucetCooldownSecs(remMs > 0 ? Math.ceil(remMs / 1000) : 0);
      } else {
        setFaucetCooldownSecs(0);
      }
      setFaucetUnlockSecs((prev) => {
        if (prev <= 1) {
          if (prev === 1) setFaucetUnlocked(true);
          return 0;
        }
        return prev - 1;
      });
      setShortlinkTimerSecs((prev) => {
        if (prev <= 1) {
          if (prev === 1) setShortlinkReadyToClaim(true);
          return 0;
        }
        return prev - 1;
      });
    };
    updateTimers();
    const id = window.setInterval(updateTimers, 1000);
    return () => window.clearInterval(id);
  }, [user?.lastFaucetClaimAt]);

  const resolveShortlinkDestinationUrl = (sl: ShortlinkConfig, uid?: string) => {
    const rawUrl = String(sl.url || '').trim();
    const callbackUrl = `${window.location.origin}${window.location.pathname}#/shortlinks?sl_verify=${encodeURIComponent(sl.id)}`;
    if (!rawUrl) return callbackUrl;
    return rawUrl
      .replace(/\{user_id\}/gi, encodeURIComponent(uid || user?.id || 'guest'))
      .replace(/\{destination_url\}/gi, encodeURIComponent(callbackUrl))
      .replace(/\{return_url\}/gi, encodeURIComponent(callbackUrl));
  };

  const handleStartShortlinkVisit = (sl: ShortlinkConfig) => {
    setShortlinkStatusMsg(null);
    const claimsToday = Number(sl.claims_today) || 0;
    if (claimsToday >= sl.daily_limit) {
      setShortlinkStatusMsg({
        type: 'error',
        text: `Daily limit reached for ${sl.name} (${claimsToday}/${sl.daily_limit} views today). Try another shortlink below!`,
      });
      return;
    }
    setActiveShortlinkId(sl.id);
    setShortlinkReadyToClaim(false);
    setShortlinkTimerSecs(Math.max(5, Number(sl.timer_seconds) || 12));
  };

  const handleVerifyAndClaimShortlink = async (sl: ShortlinkConfig) => {
    if (!user) return;
    if (!shortlinkReadyToClaim || shortlinkTimerSecs > 0) {
      setShortlinkStatusMsg({
        type: 'error',
        text: `Please wait ${shortlinkTimerSecs}s for shortlink verification to finish before claiming.`,
      });
      return;
    }
    setShortlinkClaiming(true);
    setShortlinkStatusMsg(null);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/shortlinks/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          shortlinkId: sl.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShortlinkStatusMsg({
          type: 'error',
          text: data?.error || 'Could not claim shortlink reward.',
        });
        setShortlinkClaiming(false);
        return;
      }
      if (data?.user) {
        saveCurrentUser(data.user);
        setUser(data.user);
      }
      if (Array.isArray(data?.shortlinks)) {
        setShortlinks(data.shortlinks);
        saveCachedShortlinks(data.shortlinks);
      }
      setShortlinkStatusMsg({
        type: 'success',
        text:
          data?.message ||
          `🎉 +${sl.reward_coins} Coins credited to your Withdrawable Wallet from ${sl.name}!`,
      });
      setActiveShortlinkId(null);
      setShortlinkReadyToClaim(false);
      setShortlinkTimerSecs(0);
      if (window.location.hash.includes('sl_verify=')) {
        window.location.hash = '#/shortlinks';
      }
    } catch {
      // Offline / local fallback
      const rewardCoins = Number(sl.reward_coins) || 100;
      const nowIso = new Date().toISOString();
      const nextShortlinks = shortlinks.map((item) =>
        item.id === sl.id
          ? { ...item, claims_today: (Number(item.claims_today) || 0) + 1 }
          : item
      );
      setShortlinks(nextShortlinks);
      saveCachedShortlinks(nextShortlinks);
      const nextUser: PlayerUser = {
        ...user,
        availableCoins: Number((user.availableCoins + rewardCoins).toFixed(2)),
        questsCompleted: (user.questsCompleted || 0) + 1,
        heldRewards: [
          {
            id: `sl_${sl.id}_${Date.now()}`,
            title: `🔗 SHORTLINK (${sl.provider.toUpperCase()}): ${sl.name}`,
            coins: rewardCoins,
            amountInr: Number(((rewardCoins * 90) / 100000).toFixed(4)),
            status: 'credited',
            createdAt: nowIso,
            unlocksAt: null,
          },
          ...(user.heldRewards || []),
        ],
      };
      saveCurrentUser(nextUser);
      setUser(nextUser);
      setShortlinkStatusMsg({
        type: 'success',
        text: `🎉 +${rewardCoins} Coins credited to your Withdrawable Wallet from ${sl.name}!`,
      });
      setActiveShortlinkId(null);
      setShortlinkReadyToClaim(false);
      setShortlinkTimerSecs(0);
    } finally {
      setShortlinkClaiming(false);
    }
  };

  const startFaucetAntiBotTimer = () => {
    setFaucetError(null);
    if (Number(faucetMathInput.trim()) !== faucetMathA + faucetMathB) {
      setFaucetError(`Incorrect math answer! Please solve ${faucetMathA} + ${faucetMathB} first.`);
      return;
    }
    setFaucetUnlocked(false);
    setFaucetUnlockSecs(5);
  };

  const handleClaimFaucet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFaucetError(null);
    setFaucetLastResult(null);

    if (faucetCooldownSecs > 0) {
      setFaucetError('Hourly Faucet is on 60-minute cooldown. Please wait for the timer or complete Offerwalls now!');
      return;
    }
    if (Number(faucetMathInput.trim()) !== faucetMathA + faucetMathB) {
      setFaucetError(`Please solve the anti-bot challenge (${faucetMathA} + ${faucetMathB}).`);
      return;
    }
    if (!faucetUnlocked) {
      setFaucetError('Please click "Verify Anti-Bot" and wait 5 seconds before rolling.');
      return;
    }

    const localClaims = Number(user.faucetClaimsCount) || 0;
    const localOfferwalls = Math.max(0, (Number(user.questsCompleted) || 0) - localClaims);
    const localMaxAllowed = 2 + localOfferwalls * 3;
    if (localClaims >= localMaxAllowed) {
      setFaucetError(
        '⚡ Faucet Energy Empty! Complete 1 quick task, PTC ad, or shortlink on Offerwall.me to unlock +3 Free Faucet Rolls!'
      );
      return;
    }

    setFaucetRolling(true);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/faucet/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          payoutMode: 'wallet',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFaucetError(data?.error || 'Could not complete Faucet claim.');
        setFaucetRolling(false);
        return;
      }

      if (data && data.user) {
        saveCurrentUser(data.user);
        setUser(data.user);
      }
      setFaucetLastResult({
        rollNumber: data.rollNumber,
        rewardCoins: data.rewardCoins,
        notice: data.notice || null,
      });
      setFaucetUnlocked(false);
      setFaucetMathInput('');
      setFaucetMathA(Math.floor(3 + Math.random() * 9));
      setFaucetMathB(Math.floor(2 + Math.random() * 8));
    } catch {
      // Fallback local roll if offline
      const rollNumber = Math.floor(Math.random() * 10000);
      const rewardCoins =
        rollNumber >= 9998 ? 50 : rollNumber >= 9986 ? 10 : rollNumber >= 9886 ? 3 : 1;
      const nowIso = new Date().toISOString();
      const updated: PlayerUser = {
        ...user,
        availableCoins: user.availableCoins + rewardCoins,
        questsCompleted: user.questsCompleted + 1,
        faucetClaimsCount: (user.faucetClaimsCount || 0) + 1,
        lastFaucetClaimAt: nowIso,
        faucetHistory: [
          {
            id: 'fc_' + Date.now(),
            rollNumber,
            coins: rewardCoins,
            payoutMode: 'wallet',
            createdAt: nowIso.slice(0, 16).replace('T', ' '),
          },
          ...(user.faucetHistory || []),
        ],
      };
      saveCurrentUser(updated);
      setUser(updated);
      setFaucetLastResult({
        rollNumber,
        rewardCoins,
        notice: `+${rewardCoins} Coin(s) added to your Lootify Wallet!`,
      });
      setFaucetUnlocked(false);
      setFaucetMathInput('');
      setFaucetMathA(Math.floor(3 + Math.random() * 9));
      setFaucetMathB(Math.floor(2 + Math.random() * 8));
    } finally {
      setFaucetRolling(false);
    }
  };

  const switchTab = (tab: DashboardTab) => {
    lastTabSwitchAtRef.current = Date.now();
    setActiveTab(tab);
    setIsAdminRoute(false);
    setMobileNavOpen(false);
    setEarningsPopupOpen(false);
    setPayoutMessage(null);
    const hashTarget = tab === 'overview' ? '#/dashboard' : `#/${tab}`;
    if (window.location.hash !== hashTarget) {
      window.location.hash = hashTarget;
    }
    try {
      document.body.classList.remove('on-landing-home');
      document.body.classList.add('on-app-route');
    } catch {}
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    requestAnimationFrame(() => {
      try {
        document.body.classList.remove('on-landing-home');
        document.body.classList.add('on-app-route');
      } catch {}
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    });
    const latestUser = loadCurrentUser() || user;
    if (latestUser) {
      syncUserWithBackend(latestUser, false, true);
      fetchOfferwallMeFeed(latestUser.id, false);
    }
  };

  const verifyAndLoginAdmin = (emailCandidate: string) => {
    const cleanEmail = (emailCandidate || '').trim().toLowerCase();
    if (!cleanEmail) {
      setAdminAuthError('Google account verification failed. Please sign in with your authorized Google account.');
      return;
    }
    if (cleanEmail !== ADMIN_ALLOWED_EMAIL) {
      saveAdminSession(false);
      setAdminLoggedIn(false);
      setAdminAuthError(
        `Access Denied! "${cleanEmail}" is not authorized. Sirf ${ADMIN_ALLOWED_EMAIL} ke Google login se hi Admin Panel khulega.`
      );
      return;
    }
    setAdminAuthError(null);
    saveAdminSession(true);
    setAdminLoggedIn(true);
  };

  const handleAdminGoogleSignIn = () => {
    setAdminAuthError(null);
    let clientId = GOOGLE_CLIENT_ID;
    try {
      clientId = localStorage.getItem('lootify_google_client_id') || GOOGLE_CLIENT_ID;
    } catch {}

    const g = (window as any).google;
    if (g && g.accounts && g.accounts.oauth2) {
      try {
        const tokenClient = g.accounts.oauth2.initTokenClient({
          client_id: clientId.trim(),
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: 'Bearer ' + tokenResponse.access_token },
                });
                const profile = await profileRes.json();
                if (profile && profile.email) {
                  verifyAndLoginAdmin(profile.email);
                } else {
                  setAdminAuthError('Could not retrieve email from Google account.');
                }
              } catch {
                setAdminAuthError('Failed to verify Google account. Please try again.');
              }
            } else if (tokenResponse && tokenResponse.error) {
              setAdminAuthError('Google Sign-In was cancelled or failed.');
            }
          },
          error_callback: () => {
            setAdminAuthError('Google Sign-In popup could not be completed. Please try again.');
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch {
        setAdminAuthError('Google Sign-In initialization failed. Please refresh and try again.');
        return;
      }
    }

    setAdminAuthError('Google Identity Services SDK is still loading. Please wait a moment and click Sign in with Google again.');
  };

  const handleAdminLogout = () => {
    saveAdminSession(false);
    setAdminLoggedIn(false);
    setAdminAuthError(null);
  };

  const handleSaveApiBaseUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = apiBaseInput.trim().replace(/\/+$/, '');
    try {
      if (cleaned) {
        localStorage.setItem(STORAGE_API_BASE_KEY, cleaned);
      } else {
        localStorage.removeItem(STORAGE_API_BASE_KEY);
      }
    } catch {}
    setAdminStatusBanner({
      type: 'success',
      text: cleaned
        ? `Cloudflare Worker Backend URL saved: ${cleaned}`
        : 'Using default same-origin /api backend.',
    });
    fetchAdminDashboard();
  };

  const handleAddOfferwall = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newWallName.trim();
    const cleanSlug = (newWallSlug.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!cleanName || !cleanSlug) {
      setAdminStatusBanner({
        type: 'error',
        text: 'Please enter a Network Name and Provider ID / Slug.',
      });
      return;
    }

    const newWall: OfferwallConfig = {
      provider_id: cleanSlug,
      name: cleanName,
      badge: newWallBadge.trim() || 'Offerwall & Tasks',
      enabled: 1,
      app_id: newWallAppId.trim(),
      iframe_url_template: newWallIframe.trim(),
      secret_key: newWallSecret.trim(),
      hold_days: Math.max(0, parseInt(newWallHoldDays || '0', 10)),
      postback_macro_query:
        newWallMacroQuery.trim() || '?user_id={user_id}&amount={amount}&txn_id={txn_id}&status={status}',
    };

    const nextWalls = [...offerwalls.filter((w) => w.provider_id !== cleanSlug), newWall];
    setOfferwalls(nextWalls);
    saveCachedOfferwalls(nextWalls);
    setTestProvider(cleanSlug);

    setNewWallName('');
    setNewWallSlug('');
    setNewWallAppId('');
    setNewWallIframe('');
    setNewWallSecret('');
    setNewWallHoldDays('0');

    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/offerwalls/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify(newWall),
      });
      if (res.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `✅ Added "${cleanName}" (${cleanSlug}) to Database! S2S Postback URL is ready below.`,
        });
        fetchAdminDashboard();
        return;
      }
    } catch {}

    setAdminStatusBanner({
      type: 'success',
      text: `✅ Added "${cleanName}" (${cleanSlug})!`,
    });
  };

  const handleUpdateOfferwallField = (
    providerId: string,
    field: keyof OfferwallConfig,
    value: string | number
  ) => {
    setOfferwalls((prev) =>
      prev.map((w) => (w.provider_id === providerId ? { ...w, [field]: value } : w))
    );
  };

  const handleSaveOfferwallConfig = async (wall: OfferwallConfig) => {
    saveCachedOfferwalls(offerwalls);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/offerwalls/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify(wall),
      });
      if (res.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `✅ ${wall.name} configuration saved to database!`,
        });
        fetchAdminDashboard();
        return;
      }
    } catch {}
    setAdminStatusBanner({
      type: 'success',
      text: `✅ ${wall.name} saved!`,
    });
  };

  const handleDeleteOfferwall = async (providerId: string, wallName: string) => {
    const nextWalls = offerwalls.filter((w) => w.provider_id !== providerId);
    setOfferwalls(nextWalls);
    saveCachedOfferwalls(nextWalls);

    const base = getApiBaseUrl();
    try {
      await fetch(`${base}/api/admin/offerwalls/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify({ provider_id: providerId }),
      });
      fetchAdminDashboard();
    } catch {}

    setAdminStatusBanner({
      type: 'success',
      text: `🗑️ Removed "${wallName}" from Offerwalls.`,
    });
  };

  const handleAddShortlink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSlName.trim();
    const cleanId = (newSlSlug.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!cleanName || !cleanId) {
      setAdminStatusBanner({
        type: 'error',
        text: 'Please enter a Shortlink Name and Shortlink ID / Slug.',
      });
      return;
    }

    const defaultVerifyUrl = `${window.location.origin}${window.location.pathname}#/shortlinks?sl_verify=${cleanId}`;
    const newSl: ShortlinkConfig = {
      id: cleanId,
      name: cleanName,
      provider: newSlProvider.trim() || 'Shortlink Partner',
      url: newSlUrl.trim() || defaultVerifyUrl,
      reward_coins: Math.max(0.01, Number(newSlReward) || 100),
      daily_limit: Math.max(1, parseInt(newSlLimit || '3', 10) || 3),
      timer_seconds: Math.max(3, parseInt(newSlTimer || '15', 10) || 15),
      difficulty: newSlDifficulty,
      badge: newSlBadge.trim() || '⚡ Instant Credit',
      enabled: 1,
      claims_today: 0,
    };

    const nextLinks = [newSl, ...shortlinks.filter((s) => s.id !== cleanId)];
    setShortlinks(nextLinks);
    saveCachedShortlinks(nextLinks);

    setNewSlName('');
    setNewSlSlug('');
    setNewSlUrl('');

    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/shortlinks/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify(newSl),
      });
      if (res.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `✅ Added Shortlink "${cleanName}" (+${newSl.reward_coins} Coins, ${newSl.daily_limit}/day) to Database!`,
        });
        fetchAdminDashboard();
        return;
      }
    } catch {}

    setAdminStatusBanner({
      type: 'success',
      text: `✅ Added Shortlink "${cleanName}"!`,
    });
  };

  const handleUpdateShortlinkField = (
    id: string,
    field: keyof ShortlinkConfig,
    value: string | number
  ) => {
    setShortlinks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSaveShortlinkConfig = async (sl: ShortlinkConfig) => {
    saveCachedShortlinks(shortlinks);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/shortlinks/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify(sl),
      });
      if (res.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `✅ Shortlink "${sl.name}" saved to database!`,
        });
        fetchAdminDashboard();
        return;
      }
    } catch {}
    setAdminStatusBanner({
      type: 'success',
      text: `✅ Shortlink "${sl.name}" saved!`,
    });
  };

  const handleDeleteShortlink = async (id: string, name: string) => {
    const nextLinks = shortlinks.filter((s) => s.id !== id);
    setShortlinks(nextLinks);
    saveCachedShortlinks(nextLinks);

    const base = getApiBaseUrl();
    try {
      await fetch(`${base}/api/admin/shortlinks/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify({ id }),
      });
      fetchAdminDashboard();
    } catch {}

    setAdminStatusBanner({
      type: 'success',
      text: `🗑️ Removed Shortlink "${name}".`,
    });
  };

  const handleSimulatePostback = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUid = (testUserId || user?.id || '').trim();
    const providerSlug = (testProvider || 'custom').trim().toLowerCase();
    const amount = Math.max(1, parseInt(testCoins || '50', 10));
    if (!targetUid) {
      setAdminStatusBanner({
        type: 'error',
        text: 'Please enter a Player ID or Email to test the S2S Postback.',
      });
      return;
    }

    const base = getApiBaseUrl();
    const txId = 'TEST_' + Date.now();
    try {
      const res = await fetch(
        `${base}/api/postback/${encodeURIComponent(providerSlug)}?user_id=${encodeURIComponent(
          targetUid
        )}&amount=${amount}&txn_id=${txId}&status=1&offer_name=Admin_S2S_Test`
      );
      const text = await res.text();
      if (res.ok && text.startsWith('OK')) {
        setAdminStatusBanner({
          type: 'success',
          text: `🚀 S2S Postback [${providerSlug.toUpperCase()}] returned "${text}"! +${amount} Coins credited to ${targetUid}.`,
        });
        fetchAdminDashboard();
        if (user && (user.id === targetUid || user.email.toLowerCase() === targetUid.toLowerCase())) {
          syncUserWithBackend(user, false);
        }
      } else {
        setAdminStatusBanner({
          type: 'error',
          text: `Postback response (${res.status}): ${text}`,
        });
      }
    } catch (err: any) {
      setAdminStatusBanner({
        type: 'error',
        text: `Failed to reach postback endpoint: ${err?.message || 'Network error'}`,
      });
    }
  };

  const handleAdminWithdrawalDecision = async (withdrawalId: string, status: 'completed' | 'rejected') => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/withdrawals/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify({ withdrawalId, status }),
      });
      if (res.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `Withdrawal ${withdrawalId} marked as ${status.toUpperCase()}!`,
        });
        fetchAdminDashboard();
      }
    } catch {}
  };

  const handleReleaseHeldCoins = async (opts: {
    ledgerId?: string;
    providerId?: string;
    releaseAll?: boolean;
  }) => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/holds/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminStatusBanner({
          type: 'success',
          text: `💸 Released ${data.releasedCoinsTotal || 0} Held Coins into Players' Withdrawable Balance!`,
        });
        fetchAdminDashboard();
        if (user) {
          syncUserWithBackend(user, false);
        }
      }
    } catch {}
  };

  const handleAdminFaucetPayPayout = async (withdrawalId: string) => {
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/faucetpay/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify({ withdrawalId, currency: 'USDT' }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: `⚡ ${data.message || 'Paid via FaucetPay API!'}`,
        });
        fetchAdminDashboard();
      } else {
        setAdminStatusBanner({
          type: 'error',
          text: `FaucetPay API: ${data?.error || 'Could not complete payout.'}`,
        });
      }
    } catch {
      setAdminStatusBanner({
        type: 'error',
        text: 'Failed to reach FaucetPay payout endpoint.',
      });
    }
  };

  const handleAdminAdjustWallet = async (
    e?: React.FormEvent,
    overrideOpts?: {
      targetUser?: string;
      action?: 'add' | 'minus' | 'set';
      walletType?: 'available' | 'pending' | 'both';
      coins?: number;
      category?: string;
      note?: string;
    }
  ) => {
    if (e) e.preventDefault();
    const targetUser = (overrideOpts?.targetUser ?? adjTargetUser ?? user?.id ?? '').trim();
    const action = overrideOpts?.action ?? adjAction;
    const walletType = overrideOpts?.walletType ?? adjWalletType;
    const coins = overrideOpts?.coins !== undefined ? overrideOpts.coins : Number(adjCoins) || 0;
    const category = overrideOpts?.category ?? adjCategory;
    const note = overrideOpts?.note !== undefined ? overrideOpts.note : adjNote.trim();

    if (!targetUser) {
      setAdminStatusBanner({
        type: 'error',
        text: 'Please select a player or enter a Player ID / Email first.',
      });
      return;
    }
    if (action !== 'set' && coins <= 0) {
      setAdminStatusBanner({
        type: 'error',
        text: 'Please enter a valid positive coin amount.',
      });
      return;
    }

    setAdjSubmitting(true);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/admin/users/adjust-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_ALLOWED_EMAIL,
        },
        body: JSON.stringify({
          targetUser,
          action,
          walletType,
          coins,
          category,
          note,
          customTxId: adjCustomTxId.trim(),
          holdDays: Number(adjHoldDays) || 0,
          showInUserHistory: adjShowInHistory,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setAdminStatusBanner({
          type: 'success',
          text: data.message || 'Wallet adjustment applied!',
        });
        if (!overrideOpts) {
          setAdjNote('');
          setAdjCustomTxId('');
        }
        fetchAdminDashboard();
        if (
          user &&
          (user.id.toLowerCase() === targetUser.toLowerCase() ||
            user.email.toLowerCase() === targetUser.toLowerCase())
        ) {
          syncUserWithBackend(user, false, true);
        }
      } else {
        setAdminStatusBanner({
          type: 'error',
          text: data?.error || 'Could not adjust player wallet.',
        });
      }
    } catch (err: any) {
      setAdminStatusBanner({
        type: 'error',
        text: `Failed to reach wallet adjustment endpoint: ${err?.message || 'Network error'}`,
      });
    } finally {
      setAdjSubmitting(false);
    }
  };

  const handleToggleTheme = () => {
    if (typeof (window as any).toggleTheme === 'function') {
      (window as any).toggleTheme();
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(next);
    } else {
      const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
    }
  };

  const handleLogout = () => {
    saveCurrentUser(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent('lootify-auth-changed', { detail: { user: null } }));
    window.location.hash = '';
    if (typeof (window as any).syncLandingAndAppVisibility === 'function') {
      (window as any).syncLandingAndAppVisibility();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBackToLanding = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsAdminRoute(false);
    window.location.hash = user ? '#home' : '';
    if (typeof (window as any).syncLandingAndAppVisibility === 'function') {
      (window as any).syncLandingAndAppVisibility();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── ADMIN PANEL ROUTE (#/admin) ──
  if (isAdminRoute) {
    if (!adminLoggedIn) {
      return (
        <div
          className="lootify-v2 grid-bg"
          data-theme={theme}
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div className="card card-glow" style={{ maxWidth: 440, width: '100%', padding: '34px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: 'linear-gradient(135deg,var(--green),#00A870)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Chakra Petch',sans-serif",
                    fontWeight: 700,
                    fontSize: 18,
                    color: '#03100A',
                    boxShadow: '0 0 14px rgba(0,232,154,0.35)',
                  }}
                >
                  L
                </div>
                <div>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                    LOOTIFY<span style={{ color: 'var(--green)' }}>.</span> ADMIN
                  </div>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '0.06em' }}>
                    RESTRICTED ACCESS PORTAL
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleTheme}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Toggle theme"
              >
                <span>{theme === 'light' ? '☀️' : '🌙'}</span>
              </button>
            </div>

            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>
              Admin Google Login
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: 22 }}>
              Manual login disabled. Only Google Sign-In with the authorized owner Gmail account is permitted.
            </p>

            <button
              type="button"
              onClick={handleAdminGoogleSignIn}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '14px 16px',
                borderRadius: 10,
                background: '#FFFFFF',
                color: '#0F172A',
                border: '1px solid #E2E8F0',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {adminAuthError && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: 'rgba(255,85,102,0.1)',
                  border: '1px solid rgba(255,85,102,0.35)',
                  color: 'var(--red)',
                }}
              >
                ⛔ {adminAuthError}
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <button type="button" onClick={goBackToLanding} className="btn btn-ghost btn-sm">
                ← Landing Page
              </button>
              {user && (
                <button type="button" onClick={() => switchTab('overview')} className="btn btn-ghost btn-sm">
                  Player Dashboard →
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const effectiveOrigin = apiBaseInput.trim().replace(/\/+$/, '') || window.location.origin;
    const universalPostbackPreview = `${effectiveOrigin}/lootify/api/postback${newWallMacroQuery}`;

    // ── SINGLE-PAGE ADMIN PANEL (Authenticated as sarthaksinghyadav1@gmail.com) ──
    return (
      <div
        className="lootify-v2 grid-bg"
        data-theme={theme}
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <nav id="navbar">
          <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(135deg,var(--green),#00A870)',
                  borderRadius: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#03100A',
                  boxShadow: '0 0 14px rgba(0,232,154,0.4)',
                }}
              >
                L
              </div>
              <span className="font-display" style={{ fontSize: 19, fontWeight: 700, color: 'var(--txt)' }}>
                LOOTIFY<span style={{ color: 'var(--green)' }}>.</span>
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: 'rgba(255,180,0,0.12)',
                  border: '1px solid rgba(255,180,0,0.3)',
                  color: 'var(--gold)',
                  fontWeight: 700,
                }}
              >
                ADMIN PANEL
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleToggleTheme}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Toggle theme"
              >
                <span>{theme === 'light' ? '☀️' : '🌙'}</span>
              </button>

              <button
                type="button"
                onClick={() => switchTab('overview')}
                className="btn btn-ghost btn-sm hide-mob"
                style={{ padding: '8px 14px', fontSize: 12 }}
              >
                Player Dashboard
              </button>

              <button
                type="button"
                onClick={goBackToLanding}
                className="btn btn-ghost btn-sm hide-mob"
                style={{ padding: '8px 14px', fontSize: 12 }}
              >
                Landing Page
              </button>

              <button
                type="button"
                onClick={handleAdminLogout}
                className="btn btn-outline btn-sm"
                style={{ padding: '8px 14px', fontSize: 12, color: 'var(--red)', borderColor: 'rgba(255,85,102,0.4)' }}
              >
                Logout Admin
              </button>
            </div>
          </div>
        </nav>

        <main className="wrap" style={{ flex: 1, width: '100%', padding: '32px 20px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Admin Header Card */}
          <div
            className="card card-glow"
            style={{
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              background: 'linear-gradient(135deg, rgba(0,232,154,0.07), rgba(255,180,0,0.04))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, var(--gold), #D97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: '#03100A',
                  flexShrink: 0,
                }}
              >
                S
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h1 className="font-display" style={{ fontSize: 'clamp(19px, 3vw, 24px)', fontWeight: 700, color: 'var(--txt)' }}>
                    Lootify Dynamic Backend &amp; Offerwall Manager
                  </h1>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(0,232,154,0.12)',
                      border: '1px solid rgba(0,232,154,0.3)',
                      color: 'var(--green)',
                      fontWeight: 600,
                    }}
                  >
                    AUTO-MIGRATED D1
                  </span>
                </div>
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4 }}>
                  Admin: <strong style={{ color: 'var(--green)' }}>{ADMIN_ALLOWED_EMAIL}</strong> • Business Mail: <strong style={{ color: 'var(--gold)' }}>contact@lootify.eternant.c0m.to</strong>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="live-dot" style={{ width: 8, height: 8 }}></div>
              <span className="font-mono" style={{ fontSize: 12, color: backendOnline ? 'var(--green)' : 'var(--gold)', fontWeight: 600 }}>
                {backendOnline ? 'DATABASE CONNECTED' : 'READY FOR WORKER URL'}
              </span>
            </div>
          </div>

          {adminStatusBanner && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: adminStatusBanner.type === 'success' ? 'rgba(0,232,154,0.1)' : 'rgba(255,85,102,0.1)',
                border: adminStatusBanner.type === 'success' ? '1px solid rgba(0,232,154,0.35)' : '1px solid rgba(255,85,102,0.35)',
                color: adminStatusBanner.type === 'success' ? 'var(--green)' : 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{adminStatusBanner.text}</span>
              <button
                type="button"
                onClick={() => setAdminStatusBanner(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Admin Live KPI Summary Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div
              className="card"
              onClick={() => setAdminActiveSection('wallets')}
              style={{
                padding: '16px 18px',
                cursor: 'pointer',
                border:
                  adminActiveSection === 'wallets'
                    ? '1.5px solid var(--green)'
                    : '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.05em' }}>
                👥 REGISTERED PLAYERS
              </div>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>
                {adminUsers.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                Click to manage +/- Wallet Coins
              </div>
            </div>

            <div
              className="card"
              onClick={() => setAdminActiveSection('withdrawals')}
              style={{
                padding: '16px 18px',
                cursor: 'pointer',
                border:
                  adminActiveSection === 'withdrawals'
                    ? '1.5px solid var(--gold)'
                    : '1px solid rgba(255,180,0,0.28)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em' }}>
                🏦 PENDING WITHDRAWALS
              </div>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>
                {adminWithdrawals.filter((w) => w.status === 'pending').length}{' '}
                <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500 }}>
                  / {adminWithdrawals.length} Total
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                1-Click FaucetPay API &amp; UPI Queue
              </div>
            </div>

            <div
              className="card"
              onClick={() => setAdminActiveSection('shortlinks')}
              style={{
                padding: '16px 18px',
                cursor: 'pointer',
                border:
                  adminActiveSection === 'shortlinks'
                    ? '1.5px solid var(--green)'
                    : '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.05em' }}>
                🔗 EARNING WALLS ACTIVE
              </div>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)', marginTop: 4 }}>
                {offerwalls.filter((w) => w.enabled).length} Walls •{' '}
                <span style={{ color: 'var(--green)' }}>
                  {shortlinks.filter((s) => s.enabled).length} Links
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                Offerwalls &amp; Paid Shortlinks
              </div>
            </div>

            <div
              className="card"
              onClick={() => setAdminActiveSection('withdrawals')}
              style={{
                padding: '16px 18px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--violet)', letterSpacing: '0.05em' }}>
                ⏳ ESCROW S2S POSTBACKS
              </div>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--violet)', marginTop: 4 }}>
                {adminPostbacks.filter((p) => p.status === 'pending_hold').length}{' '}
                <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500 }}>
                  Held / {adminPostbacks.length} Logged
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                Auto-unlocks or 1-click release
              </div>
            </div>
          </div>

          {/* Admin Section Switcher & Quick-Jump Bar */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              background: 'var(--bg2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginRight: 4 }}>
                🗂️ VIEW SECTION:
              </span>
              {(
                [
                  { id: 'all', label: '📋 All Sections' },
                  { id: 'wallets', label: '💰 Player Wallets (+/-)' },
                  {
                    id: 'withdrawals',
                    label: `🏦 Withdrawals & Holds (${adminWithdrawals.filter((w) => w.status === 'pending').length})`,
                  },
                  { id: 'shortlinks', label: `🔗 Shortlinks (${shortlinks.length})` },
                  { id: 'offerwalls', label: `🎮 Offerwalls (${offerwalls.length})` },
                  { id: 'api', label: '🔌 API & S2S Tester' },
                ] as const
              ).map((tab) => {
                const active = adminActiveSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdminActiveSection(tab.id)}
                    className="font-mono"
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'rgba(0,232,154,0.14)' : 'var(--bg3)',
                      border: active ? '1.5px solid var(--green)' : '1px solid var(--border2)',
                      color: active ? 'var(--green)' : 'var(--txt)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={fetchAdminDashboard} className="btn btn-outline btn-sm">
              🔄 Refresh Admin Data
            </button>
          </div>

          {/* 1. Cloudflare Worker + D1 Backend URL */}
          <div
            id="admin-sec-1"
            className="card"
            style={{
              padding: 24,
              display: adminActiveSection === 'all' || adminActiveSection === 'api' ? 'block' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                  1. Cloudflare Worker API Connection (`lootify-api`)
                </h2>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
                  Aapka `functions/worker.js` Git push par automatic D1 database tables (`users`, `withdrawals`, `ledger_entries`, `offerwall_configs`) create/migrate kar leta hai. Agar Worker alag `.workers.dev` URL par hai to yahan daal dein (same-domain hone par blank chhod dein).
                </p>
              </div>
              <button type="button" onClick={fetchAdminDashboard} className="btn btn-ghost btn-sm">
                🔄 Refresh Database
              </button>
            </div>

            <form onSubmit={handleSaveApiBaseUrl} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={apiBaseInput}
                onChange={(e) => setApiBaseInput(e.target.value)}
                placeholder="https://lootify-api.your-subdomain.workers.dev (leave blank for same-origin /api)"
                className="font-mono"
                style={{
                  flex: 1,
                  minWidth: 260,
                  padding: '11px 14px',
                  borderRadius: 8,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  color: 'var(--green)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                💾 Save API URL
              </button>
            </form>
          </div>

          {/* 2. Dynamic Offerwall Creator */}
          <div
            id="admin-sec-2"
            className="card"
            style={{
              padding: 24,
              display: adminActiveSection === 'all' || adminActiveSection === 'offerwalls' ? 'block' : 'none',
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                2. Dynamic Offerwall Manager
              </h2>
              <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>
                Approved offerwall networks ko yahan se add, edit, ya delete karein.
              </p>
            </div>

            <form onSubmit={handleAddOfferwall} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    NETWORK NAME *
                  </label>
                  <input
                    type="text"
                    value={newWallName}
                    onChange={(e) => {
                      setNewWallName(e.target.value);
                      if (!newWallSlug) {
                        setNewWallSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    placeholder="e.g. Offerwall.me or Notik"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    PROVIDER ID / SLUG *
                  </label>
                  <input
                    type="text"
                    value={newWallSlug}
                    onChange={(e) => setNewWallSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g. offerwallme"
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--green)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    BADGE / SUBTITLE
                  </label>
                  <input
                    type="text"
                    value={newWallBadge}
                    onChange={(e) => setNewWallBadge(e.target.value)}
                    placeholder="e.g. PTC, Surveys & Tasks"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    APP ID / API KEY
                  </label>
                  <input
                    type="text"
                    value={newWallAppId}
                    onChange={(e) => setNewWallAppId(e.target.value)}
                    placeholder="Publisher App ID / Key"
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    IFRAME URL TEMPLATE (USE {'{app_id}'} &amp; {'{user_id}'})
                  </label>
                  <input
                    type="text"
                    value={newWallIframe}
                    onChange={(e) => setNewWallIframe(e.target.value)}
                    placeholder="https://example.com/wall/{app_id}/{user_id}"
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 12,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    POSTBACK QUERY MACROS (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={newWallMacroQuery}
                    onChange={(e) => setNewWallMacroQuery(e.target.value)}
                    placeholder="?user_id={user_id}&amount={amount}&txn_id={txn_id}&status={status}"
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt2)',
                      fontSize: 12,
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                      SECRET KEY (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={newWallSecret}
                      onChange={(e) => setNewWallSecret(e.target.value)}
                      placeholder="Optional postback secret"
                      className="font-mono"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                        color: 'var(--txt)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                      HOLD DAYS
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={newWallHoldDays}
                      onChange={(e) => setNewWallHoldDays(e.target.value)}
                      className="font-mono"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                        color: 'var(--gold)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  paddingTop: 6,
                }}
              >
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', wordBreak: 'break-all' }}>
                  Single Postback Endpoint: <span style={{ color: 'var(--green)' }}>{universalPostbackPreview}</span>
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  + Add Offerwall Network
                </button>
              </div>
            </form>

            {/* Added Offerwalls List */}
            <div style={{ marginTop: 20 }}>
              {offerwalls.length === 0 ? (
                <div
                  style={{
                    padding: '28px 20px',
                    textAlign: 'center',
                    borderRadius: 12,
                    background: 'var(--bg2)',
                    border: '1px dashed var(--border2)',
                    color: 'var(--txt2)',
                    fontSize: 13,
                  }}
                >
                  No offerwalls added yet. Use the form above to add any offerwall network whenever you get approved!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
                  {offerwalls.map((wall) => {
                    const macroQuery =
                      wall.postback_macro_query ||
                      '?user_id={user_id}&amount={amount}&txn_id={txn_id}&status={status}';
                    const postbackUrl = `${effectiveOrigin}/lootify/api/postback${macroQuery}`;
                    return (
                      <div
                        key={wall.provider_id}
                        style={{
                          padding: 18,
                          borderRadius: 12,
                          background: 'var(--bg2)',
                          border: wall.app_id ? '1.5px solid rgba(0,232,154,0.4)' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                              {wall.name}{' '}
                              <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                                ({wall.provider_id})
                              </span>
                            </div>
                            <div className="font-mono" style={{ fontSize: 11, color: 'var(--gold)' }}>
                              {wall.badge}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--txt2)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(wall.enabled)}
                                onChange={(e) => handleUpdateOfferwallField(wall.provider_id, 'enabled', e.target.checked ? 1 : 0)}
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteOfferwall(wall.provider_id, wall.name)}
                              style={{
                                background: 'rgba(255,85,102,0.12)',
                                border: '1px solid rgba(255,85,102,0.3)',
                                color: 'var(--red)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                              title="Delete Offerwall"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                            S2S POSTBACK URL (PASTE IN {wall.name.toUpperCase()} DASHBOARD)
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <code
                              className="font-mono"
                              style={{
                                fontSize: 11,
                                color: 'var(--green)',
                                wordBreak: 'break-all',
                                flex: 1,
                              }}
                            >
                              {postbackUrl}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(postbackUrl).catch(() => {});
                                setCopiedPostbackId(wall.provider_id);
                                setTimeout(() => setCopiedPostbackId(null), 2000);
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '5px 10px', fontSize: 11, flexShrink: 0 }}
                            >
                              {copiedPostbackId === wall.provider_id ? '✅ Copied' : '📋 Copy'}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>
                              APP ID / API KEY
                            </label>
                            <input
                              type="text"
                              value={wall.app_id}
                              onChange={(e) => handleUpdateOfferwallField(wall.provider_id, 'app_id', e.target.value)}
                              placeholder="Paste App ID or API Key"
                              className="font-mono"
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 8,
                                background: 'var(--bg3)',
                                border: '1px solid var(--border)',
                                color: 'var(--txt)',
                                fontSize: 12,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>
                              HOLD DAYS
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={wall.hold_days}
                              onChange={(e) => handleUpdateOfferwallField(wall.provider_id, 'hold_days', Number(e.target.value) || 0)}
                              className="font-mono"
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 8,
                                background: 'var(--bg3)',
                                border: '1px solid var(--border)',
                                color: 'var(--gold)',
                                fontSize: 12,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>
                            IFRAME URL TEMPLATE ({'{app_id}'} &amp; {'{user_id}'})
                          </label>
                          <input
                            type="text"
                            value={wall.iframe_url_template}
                            onChange={(e) => handleUpdateOfferwallField(wall.provider_id, 'iframe_url_template', e.target.value)}
                            className="font-mono"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              color: 'var(--txt2)',
                              fontSize: 11,
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>
                            {wall.provider_id === 'pubcrypto'
                              ? 'PUBCRYPTO PUBLISHER API KEY (FOR SIGNED EMBED TOKENS)'
                              : 'SECRET / PUBLISHER API KEY (OPTIONAL)'}
                          </label>
                          <input
                            type="password"
                            value={wall.secret_key || ''}
                            onChange={(e) => handleUpdateOfferwallField(wall.provider_id, 'secret_key', e.target.value)}
                            placeholder={
                              wall.provider_id === 'pubcrypto'
                                ? 'Paste Publisher API Key from pub.cryptolinkforearn.com -> Publisher'
                                : 'Optional Secret / API Key'
                            }
                            className="font-mono"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              color: 'var(--txt)',
                              fontSize: 11,
                            }}
                          />
                          {wall.provider_id === 'pubcrypto' && (
                            <div style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 4, lineHeight: 1.4 }}>
                              🔒 Postback Secret Key (`e73bc...57b23`) is already encrypted on server! Paste your{' '}
                              <strong>Publisher API Key</strong> (from PubCrypto menu → <em>Publisher</em> → <em>Your API key</em>) here to generate 1-time Signed Embed Tokens (`owe_...`).
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveOfferwallConfig(wall)}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 4 }}
                        >
                          💾 Save {wall.name} Changes
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 2B. Dynamic Shortlinks Manager */}
          <div
            id="admin-sec-2b"
            className="card card-glow"
            style={{
              padding: 24,
              display: adminActiveSection === 'all' || adminActiveSection === 'shortlinks' ? 'block' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                    2B. Dynamic Shortlinks Earning Manager
                  </h2>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(0,232,154,0.14)',
                      border: '1px solid rgba(0,232,154,0.35)',
                      color: 'var(--green)',
                      fontWeight: 700,
                    }}
                  >
                    {shortlinks.filter((s) => s.enabled).length} ACTIVE LINKS
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>
                  ShrinkMe.io, Cuty.io, Exe.io, GPLinks, Clicksfly ya kisi bhi Shortlink network ka link add/edit karein. Jab aap kisi shortener site par link shorten karein, to Destination URL me niche diya gaya{' '}
                  <code className="font-mono" style={{ color: 'var(--green)' }}>
                    {effectiveOrigin}/#/shortlinks?sl_verify=SHORTLINK_ID
                  </code>{' '}
                  daal dein — ya niche <strong>Quick-Link API Token Builder</strong> se 1-click me automatic link banayein!
                </p>
              </div>
            </div>

            {/* 1-Click Quick-Link API Token Auto-Builder */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(0,232,154,0.06)',
                border: '1px solid rgba(0,232,154,0.28)',
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
                  ⚡ 1-CLICK QUICK-LINK API AUTO-BUILDER (OPTIONAL — NO MANUAL SHORTENING NEEDED)
                </span>
                <span style={{ fontSize: 11, color: 'var(--txt2)' }}>
                  Shortener Dashboard → Tools → Quick Link API Token paste karein
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, alignItems: 'center' }}>
                <select
                  value={quickLinkProvider}
                  onChange={(e) => setQuickLinkProvider(e.target.value)}
                  className="font-mono"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border2)',
                    color: 'var(--txt)',
                    fontSize: 12,
                  }}
                >
                  <option value="shrinkme">ShrinkMe.io (shrinkme.io/st?api=...)</option>
                  <option value="cuty">Cuty.io (cuty.io/quick?token=...)</option>
                  <option value="exe">Exe.io (exe.io/st?api=...)</option>
                  <option value="gplinks">GPLinks (api.gplinks.com/st?api=...)</option>
                  <option value="clicksfly">Clicksfly (clicksfly.com/st?api=...)</option>
                  <option value="droplink">Droplink (droplink.co/st?api=...)</option>
                  <option value="ouo">Ouo.io (ouo.io/qs/...)</option>
                </select>

                <input
                  type="text"
                  value={quickLinkApiToken}
                  onChange={(e) => setQuickLinkApiToken(e.target.value)}
                  placeholder="Paste your Shortener API Token here (e.g. 8a9b0c1d2e...)"
                  className="font-mono"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border2)',
                    color: 'var(--gold)',
                    fontSize: 12,
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    const token = quickLinkApiToken.trim();
                    if (!token) {
                      setAdminStatusBanner({
                        type: 'error',
                        text: 'Please paste your Shortener Quick-Link API Token first.',
                      });
                      return;
                    }
                    const templates: Record<string, { url: string; id: string; label: string }> = {
                      shrinkme: {
                        id: 'shrinkme',
                        label: 'ShrinkMe.io',
                        url: `https://shrinkme.io/st?api=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      cuty: {
                        id: 'cuty',
                        label: 'Cuty.io',
                        url: `https://cuty.io/quick?token=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      exe: {
                        id: 'exeio',
                        label: 'Exe.io',
                        url: `https://exe.io/st?api=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      gplinks: {
                        id: 'gplinks',
                        label: 'GPLinks',
                        url: `https://api.gplinks.com/st?api=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      clicksfly: {
                        id: 'clicksfly',
                        label: 'Clicksfly',
                        url: `https://clicksfly.com/st?api=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      droplink: {
                        id: 'droplink',
                        label: 'Droplink',
                        url: `https://droplink.co/st?api=${encodeURIComponent(token)}&url={destination_url}`,
                      },
                      ouo: {
                        id: 'ouo',
                        label: 'Ouo.io',
                        url: `https://ouo.io/qs/${encodeURIComponent(token)}?s={destination_url}`,
                      },
                    };
                    const picked = templates[quickLinkProvider] || templates.shrinkme;
                    setNewSlUrl(picked.url);
                    setNewSlProvider(picked.label);
                    const matchingCard = shortlinks.find((s) => s.id === picked.id);
                    if (matchingCard) {
                      const updatedCard = { ...matchingCard, url: picked.url, enabled: 1 };
                      handleUpdateShortlinkField(picked.id, 'url', picked.url);
                      handleSaveShortlinkConfig(updatedCard);
                    } else {
                      setAdminStatusBanner({
                        type: 'success',
                        text: `Quick-Link URL generated for ${picked.label}! Click "+ Add Shortlink to Wall" below to save.`,
                      });
                    }
                  }}
                  className="btn btn-primary btn-sm"
                >
                  ⚡ Apply Quick-Link API to {quickLinkProvider.toUpperCase()}
                </button>
              </div>
            </div>

            <form
              onSubmit={handleAddShortlink}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: 18,
                borderRadius: 12,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    SHORTLINK TITLE *
                  </label>
                  <input
                    type="text"
                    value={newSlName}
                    onChange={(e) => {
                      setNewSlName(e.target.value);
                      if (!newSlSlug) {
                        setNewSlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                    placeholder="e.g. ShrinkMe VIP Link"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    SHORTLINK ID / SLUG *
                  </label>
                  <input
                    type="text"
                    value={newSlSlug}
                    onChange={(e) => setNewSlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g. shrinkme_1"
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--green)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    NETWORK / PROVIDER
                  </label>
                  <input
                    type="text"
                    value={newSlProvider}
                    onChange={(e) => setNewSlProvider(e.target.value)}
                    placeholder="e.g. ShrinkMe.io / Cuty.io"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    REWARD COINS PER VIEW *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0.01}
                    value={newSlReward}
                    onChange={(e) => setNewSlReward(e.target.value)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--gold)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    SHORTENED LINK URL (PASTE YOUR SHORTENED LINK HERE)
                  </label>
                  <input
                    type="text"
                    value={newSlUrl}
                    onChange={(e) => setNewSlUrl(e.target.value)}
                    placeholder={`e.g. https://shrinkme.ink/AbCdEf or leave blank for ${effectiveOrigin}/#/shortlinks?sl_verify=${newSlSlug || 'id'}`}
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 12,
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                      DAILY VIEWS
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newSlLimit}
                      onChange={(e) => setNewSlLimit(e.target.value)}
                      className="font-mono"
                      style={{
                        width: '100%',
                        padding: '10px 10px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                        color: 'var(--txt)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                      TIMER (SEC)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={120}
                      value={newSlTimer}
                      onChange={(e) => setNewSlTimer(e.target.value)}
                      className="font-mono"
                      style={{
                        width: '100%',
                        padding: '10px 10px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                        color: 'var(--txt)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                      DIFFICULTY
                    </label>
                    <select
                      value={newSlDifficulty}
                      onChange={(e) => setNewSlDifficulty(e.target.value as 'Easy' | 'Medium' | 'Fast')}
                      style={{
                        width: '100%',
                        padding: '10px 8px',
                        borderRadius: 8,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                        color: 'var(--txt)',
                        fontSize: 12,
                      }}
                    >
                      <option value="Fast">Fast</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', wordBreak: 'break-all' }}>
                  Destination URL to Shorten:{' '}
                  <span style={{ color: 'var(--green)' }}>
                    {effectiveOrigin}/#/shortlinks?sl_verify={newSlSlug || 'your_slug'}
                  </span>
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  + Add Shortlink to Wall
                </button>
              </div>
            </form>

            {/* Configured Shortlinks Grid */}
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
              {shortlinks.map((sl) => {
                const destToShorten = `${effectiveOrigin}/#/shortlinks?sl_verify=${sl.id}`;
                return (
                  <div
                    key={sl.id}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--bg2)',
                      border: sl.enabled ? '1px solid rgba(0,232,154,0.35)' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                          🔗 {sl.name}{' '}
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                            ({sl.provider})
                          </span>
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--gold)' }}>
                          +{sl.reward_coins} Coins • {sl.daily_limit} Views/Day • {sl.timer_seconds}s
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--txt2)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(sl.enabled)}
                            onChange={(e) => handleUpdateShortlinkField(sl.id, 'enabled', e.target.checked ? 1 : 0)}
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteShortlink(sl.id, sl.name)}
                          style={{
                            background: 'rgba(255,85,102,0.12)',
                            border: '1px solid rgba(255,85,102,0.3)',
                            color: 'var(--red)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          title="Delete Shortlink"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                        DESTINATION URL (SHORTEN THIS IN {sl.provider.toUpperCase()})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <code className="font-mono" style={{ fontSize: 10.5, color: 'var(--green)', wordBreak: 'break-all', flex: 1 }}>
                          {destToShorten}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(destToShorten).catch(() => {});
                            setCopiedSlDestId(sl.id);
                            setTimeout(() => setCopiedSlDestId(null), 2000);
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', fontSize: 10 }}
                        >
                          {copiedSlDestId === sl.id ? '✅ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 10.5, color: 'var(--txt2)', marginBottom: 3 }}>
                        SHORTENED URL (PLAYERS CLICK THIS)
                      </label>
                      <input
                        type="text"
                        value={sl.url}
                        onChange={(e) => handleUpdateShortlinkField(sl.id, 'url', e.target.value)}
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          color: 'var(--txt)',
                          fontSize: 11,
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--txt2)', marginBottom: 3 }}>
                          REWARD COINS
                        </label>
                        <input
                          type="number"
                          step="any"
                          min={0.01}
                          value={sl.reward_coins}
                          onChange={(e) => handleUpdateShortlinkField(sl.id, 'reward_coins', Number(e.target.value) || 0)}
                          className="font-mono"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            color: 'var(--gold)',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--txt2)', marginBottom: 3 }}>
                          DAILY LIMIT
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={sl.daily_limit}
                          onChange={(e) => handleUpdateShortlinkField(sl.id, 'daily_limit', Number(e.target.value) || 1)}
                          className="font-mono"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            color: 'var(--txt)',
                            fontSize: 12,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--txt2)', marginBottom: 3 }}>
                          TIMER (S)
                        </label>
                        <input
                          type="number"
                          min={3}
                          value={sl.timer_seconds}
                          onChange={(e) => handleUpdateShortlinkField(sl.id, 'timer_seconds', Number(e.target.value) || 10)}
                          className="font-mono"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            color: 'var(--txt)',
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--txt2)', marginBottom: 3 }}>
                          DIFFICULTY TAG
                        </label>
                        <select
                          value={sl.difficulty}
                          onChange={(e) =>
                            handleUpdateShortlinkField(
                              sl.id,
                              'difficulty',
                              e.target.value as 'Easy' | 'Medium' | 'Fast'
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            color: 'var(--txt)',
                            fontSize: 11.5,
                          }}
                        >
                          <option value="Fast">Fast</option>
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--txt2)', marginBottom: 3 }}>
                          STEPS / INFO BADGE
                        </label>
                        <input
                          type="text"
                          value={sl.badge || ''}
                          onChange={(e) => handleUpdateShortlinkField(sl.id, 'badge', e.target.value)}
                          placeholder="⚡ Instant Credit • 2 Steps"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            color: 'var(--txt)',
                            fontSize: 11.5,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveShortlinkConfig(sl)}
                      className="btn btn-primary btn-sm"
                    >
                      💾 Save {sl.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Live S2S Postback Webhook Simulator */}
          <div
            id="admin-sec-3"
            className="card"
            style={{
              padding: 24,
              display: adminActiveSection === 'all' || adminActiveSection === 'api' ? 'block' : 'none',
            }}
          >
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>
              3. Universal S2S Postback Webhook Tester (`/api/postback/:provider`)
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
              Apne backend ka universal postback webhook kisi bhi provider slug aur Player ID par test karein.
            </p>

            <form onSubmit={handleSimulatePostback} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                  PROVIDER SLUG
                </label>
                <input
                  type="text"
                  value={testProvider}
                  onChange={(e) => setTestProvider(e.target.value)}
                  placeholder="e.g. custom or offerwallme"
                  className="font-mono"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border2)',
                    color: 'var(--green)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                  PLAYER ID OR EMAIL
                </label>
                <input
                  type="text"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder={user ? `${user.id} or ${user.email}` : 'Player ID or Email'}
                  className="font-mono"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border2)',
                    color: 'var(--txt)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                  COINS TO CREDIT
                </label>
                <input
                  type="number"
                  min={1}
                  value={testCoins}
                  onChange={(e) => setTestCoins(e.target.value)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border2)',
                    color: 'var(--gold)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-sm" style={{ height: 40 }}>
                ⚡ Fire Test Postback
              </button>
            </form>
          </div>

          {/* 3B. Admin Player Wallet & Balance Controller (Add / Minus / Set Coins + Custom Note) */}
          <div
            id="admin-sec-4"
            className="card card-glow"
            style={{
              padding: 24,
              display: adminActiveSection === 'all' || adminActiveSection === 'wallets' ? 'block' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                    4. Player Wallet &amp; Coin Balance Controller (Add / Minus / Custom Note)
                  </h2>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,180,0,0.14)',
                      border: '1px solid rgba(255,180,0,0.35)',
                      color: 'var(--gold)',
                      fontWeight: 700,
                    }}
                  >
                    DIRECT D1 LEDGER CONTROL
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>
                  Kisi bhi user ke <strong>Available (Withdrawable)</strong> ya <strong>Pending (On-Hold)</strong> wallet me coins <strong>Add (+)</strong>, <strong>Minus (-)</strong>, ya <strong>Exact Set</strong> karein aur custom Transaction Note lagayein.
                </p>
              </div>
            </div>

            {(() => {
              const matchedAdminUser = adminUsers.find(
                (u) =>
                  adjTargetUser &&
                  (String(u.id || '').toLowerCase() === adjTargetUser.trim().toLowerCase() ||
                    String(u.email || '').toLowerCase() === adjTargetUser.trim().toLowerCase())
              );
              const parsedAdjCoins = Math.max(0, Number(adjCoins) || 0);
              const previewUsd = (parsedAdjCoins / 100000).toFixed(4);
              const previewInr = ((parsedAdjCoins * 90) / 100000).toFixed(2);

              return (
                <form
                  onSubmit={(e) => handleAdminAdjustWallet(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: 18,
                    borderRadius: 12,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Row 1: Select User from Dropdown OR Enter ID/Email */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        QUICK SELECT REGISTERED PLAYER ({adminUsers.length})
                      </label>
                      <select
                        value={matchedAdminUser ? matchedAdminUser.id : ''}
                        onChange={(e) => {
                          if (e.target.value) setAdjTargetUser(e.target.value);
                        }}
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: 'var(--txt)',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      >
                        <option value="">-- Choose Player from List --</option>
                        {adminUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email}) — Avail: {u.available_coins} | Hold: {u.pending_coins}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        TARGET PLAYER ID OR EMAIL *
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={adjTargetUser}
                          onChange={(e) => setAdjTargetUser(e.target.value)}
                          placeholder={user ? `e.g. ${user.id} or ${user.email}` : 'Enter Player ID or Email'}
                          className="font-mono"
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--bg3)',
                            border: '1px solid var(--border2)',
                            color: 'var(--green)',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                        {user && (
                          <button
                            type="button"
                            onClick={() => setAdjTargetUser(user.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                            title="Fill my own Player ID"
                          >
                            My ID
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected Player Live Snapshot Banner */}
                  {matchedAdminUser && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'rgba(0,232,154,0.07)',
                        border: '1px solid rgba(0,232,154,0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                          👤 {matchedAdminUser.name}{' '}
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                            ({matchedAdminUser.id})
                          </span>
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                          Email: {matchedAdminUser.email} • Tasks Done: {matchedAdminUser.offerwalls_completed || 0}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--txt2)', fontWeight: 600 }}>AVAILABLE WALLET</div>
                          <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                            {Number(matchedAdminUser.available_coins || 0).toLocaleString('en-IN')} Coins ($
                            {(Number(matchedAdminUser.available_coins || 0) / 100000).toFixed(4)})
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--txt2)', fontWeight: 600 }}>PENDING / HOLD WALLET</div>
                          <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                            {Number(matchedAdminUser.pending_coins || 0).toLocaleString('en-IN')} Coins
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Row 2: Action Type, Desired Wallet Type, Coins Amount */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        ACTION MODE (ADD / MINUS / SET)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {(
                          [
                            { id: 'add', label: '➕ Add', color: 'var(--green)' },
                            { id: 'minus', label: '➖ Minus', color: 'var(--red)' },
                            { id: 'set', label: '🎯 Set Exact', color: 'var(--gold)' },
                          ] as const
                        ).map((mode) => {
                          const active = adjAction === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                setAdjAction(mode.id);
                                if (mode.id === 'minus' && adjCategory === 'admin_bonus') {
                                  setAdjCategory('penalty_deduction');
                                } else if (mode.id === 'add' && adjCategory === 'penalty_deduction') {
                                  setAdjCategory('admin_bonus');
                                }
                              }}
                              style={{
                                padding: '9px 6px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: active ? 'var(--bg3)' : 'transparent',
                                border: active ? `1.5px solid ${mode.color}` : '1px solid var(--border)',
                                color: active ? mode.color : 'var(--txt2)',
                              }}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        DESIRED WALLET TYPE *
                      </label>
                      <select
                        value={adjWalletType}
                        onChange={(e) => setAdjWalletType(e.target.value as 'available' | 'pending' | 'both')}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: 'var(--txt)',
                          fontSize: 13,
                          fontWeight: 600,
                          outline: 'none',
                        }}
                      >
                        <option value="available">💰 Available / Withdrawable Wallet</option>
                        <option value="pending">⏳ Pending / On-Hold Escrow Wallet</option>
                        <option value="both">🔄 Both Wallets (Available + Pending)</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)' }}>
                          COINS AMOUNT *
                        </label>
                        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--gold)' }}>
                          = ${previewUsd} / ₹{previewInr}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={adjCoins}
                        onChange={(e) => setAdjCoins(e.target.value)}
                        placeholder="e.g. 500"
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: adjAction === 'minus' ? 'var(--red)' : 'var(--gold)',
                          fontSize: 14,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Coin Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginRight: 4 }}>
                      Quick Coins:
                    </span>
                    {['10', '50', '100', '500', '1000', '2500', '5000', '10000', '50000', '100000'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjCoins(val)}
                        className="font-mono"
                        style={{
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          background: adjCoins === val ? 'rgba(0,232,154,0.16)' : 'var(--bg3)',
                          border: adjCoins === val ? '1px solid var(--green)' : '1px solid var(--border)',
                          color: adjCoins === val ? 'var(--green)' : 'var(--txt2)',
                        }}
                      >
                        {Number(val).toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>

                  {/* Row 3: Category Badge, Transaction Note & Extra Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        TRANSACTION CATEGORY / BADGE
                      </label>
                      <select
                        value={adjCategory}
                        onChange={(e) => setAdjCategory(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: 'var(--txt)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      >
                        <option value="admin_bonus">🎁 Admin Bonus</option>
                        <option value="manual_credit">⚡ Manual Credit</option>
                        <option value="offerwall_compensation">🛠️ Offerwall Missing Postback Credit</option>
                        <option value="contest_prize">🏆 Contest / Giveaway Prize</option>
                        <option value="promo_reward">💎 Special Promo Reward</option>
                        <option value="penalty_deduction">⚠️ Admin Penalty / Deduction</option>
                        <option value="chargeback_adjustment">🔄 Chargeback / Reversal Adjustment</option>
                        <option value="custom">📌 Custom Adjustment</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        TRANSACTION NOTE / REASON (VISIBLE IN LEDGER &amp; PLAYER HISTORY)
                      </label>
                      <input
                        type="text"
                        value={adjNote}
                        onChange={(e) => setAdjNote(e.target.value)}
                        placeholder="e.g. Missing PubCrypto / Offerwall.me task reward credited by Admin"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: 'var(--txt)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Note Templates */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginRight: 4 }}>
                      Quick Notes:
                    </span>
                    {[
                      'Missing Offerwall Task Reward Credited',
                      'Special Loyalty & Active Player Bonus',
                      'Giveaway / Promo Code Winner',
                      'Referral Milestone Bonus',
                      'Invalid / Reversed Task Deduction',
                      'Manual Balance Correction by Admin',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdjNote(preset)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          background: adjNote === preset ? 'rgba(255,180,0,0.16)' : 'var(--bg3)',
                          border: adjNote === preset ? '1px solid var(--gold)' : '1px solid var(--border)',
                          color: adjNote === preset ? 'var(--gold)' : 'var(--txt2)',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Row 4: Extra Info (Custom Tx ID, Hold Days if Pending, Visibility Toggle & Submit) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 14,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={adjCustomTxId}
                        onChange={(e) => setAdjCustomTxId(e.target.value)}
                        placeholder="Optional Custom Tx ID (auto ADM_...)"
                        className="font-mono"
                        style={{
                          width: 220,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          color: 'var(--txt2)',
                          fontSize: 11,
                        }}
                      />

                      {(adjWalletType === 'pending' || adjWalletType === 'both') && adjAction !== 'minus' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                            Hold Days:
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={adjHoldDays}
                            onChange={(e) => setAdjHoldDays(e.target.value)}
                            className="font-mono"
                            style={{
                              width: 64,
                              padding: '7px 8px',
                              borderRadius: 8,
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              color: 'var(--gold)',
                              fontSize: 12,
                            }}
                          />
                        </div>
                      )}

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: 'var(--txt2)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={adjShowInHistory}
                          onChange={(e) => setAdjShowInHistory(e.target.checked)}
                        />
                        Show Note in Player&apos;s Activity History
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={adjSubmitting}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: '11px 20px',
                        fontSize: 13,
                        fontWeight: 700,
                        background:
                          adjAction === 'minus'
                            ? 'linear-gradient(135deg, #FF5566, #CC2936)'
                            : adjAction === 'set'
                            ? 'linear-gradient(135deg, var(--gold), #D49000)'
                            : undefined,
                        color: adjAction === 'minus' ? '#FFF' : '#03100A',
                      }}
                    >
                      {adjSubmitting
                        ? 'Applying...'
                        : adjAction === 'add'
                        ? `➕ Add +${parsedAdjCoins.toLocaleString('en-IN')} Coins to ${
                            adjWalletType === 'pending'
                              ? 'Pending Wallet'
                              : adjWalletType === 'both'
                              ? 'Both Wallets'
                              : 'Available Wallet'
                          }`
                        : adjAction === 'minus'
                        ? `➖ Deduct -${parsedAdjCoins.toLocaleString('en-IN')} Coins from ${
                            adjWalletType === 'pending'
                              ? 'Pending Wallet'
                              : adjWalletType === 'both'
                              ? 'Both Wallets'
                              : 'Available Wallet'
                          }`
                        : `🎯 Set ${
                            adjWalletType === 'pending'
                              ? 'Pending Wallet'
                              : adjWalletType === 'both'
                              ? 'Both Wallets'
                              : 'Available Wallet'
                          } = ${parsedAdjCoins.toLocaleString('en-IN')} Coins`}
                    </button>
                  </div>
                </form>
              );
            })()}

            {/* Registered Players Directory & 1-Click Quick Adjust */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                  👥 Registered Players Directory ({adminUsers.length}) — Click Any Player to Select or Quick Adjust
                </div>
                <input
                  type="text"
                  value={adminUserSearch}
                  onChange={(e) => setAdminUserSearch(e.target.value)}
                  placeholder="🔍 Search by Name, Email or Player ID..."
                  className="font-mono"
                  style={{
                    width: 260,
                    padding: '7px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border2)',
                    color: 'var(--txt)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              {adminUsers.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    textAlign: 'center',
                    borderRadius: 10,
                    background: 'var(--bg2)',
                    color: 'var(--txt2)',
                    fontSize: 12,
                  }}
                >
                  No players loaded yet. Click &quot;🔄 Refresh Database&quot; at the top.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                  {adminUsers
                    .filter((u) => {
                      const q = adminUserSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        String(u.name || '').toLowerCase().includes(q) ||
                        String(u.email || '').toLowerCase().includes(q) ||
                        String(u.id || '').toLowerCase().includes(q)
                      );
                    })
                    .map((u) => {
                      const isSelected =
                        adjTargetUser.trim().toLowerCase() === String(u.id || '').toLowerCase() ||
                        adjTargetUser.trim().toLowerCase() === String(u.email || '').toLowerCase();
                      return (
                        <div
                          key={u.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: isSelected ? 'rgba(0,232,154,0.08)' : 'var(--bg2)',
                            border: isSelected ? '1px solid var(--green)' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                              {u.name}{' '}
                              <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                                ({u.id})
                              </span>
                            </div>
                            <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                              {u.email} • Tasks: {u.offerwalls_completed || 0}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div className="font-mono" style={{ fontSize: 12, textAlign: 'right' }}>
                              <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                                Avail: {Number(u.available_coins || 0).toLocaleString('en-IN')}
                              </span>
                              {' • '}
                              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                                Hold: {Number(u.pending_coins || 0).toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => setAdjTargetUser(u.id)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '5px 10px', fontSize: 11 }}
                              >
                                {isSelected ? '✓ Selected' : '🎯 Select'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdminAdjustWallet(undefined, {
                                    targetUser: u.id,
                                    action: 'add',
                                    walletType: 'available',
                                    coins: 100,
                                    category: 'admin_bonus',
                                    note: 'Quick +100 Coins Admin Credit',
                                  })
                                }
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '5px 8px', fontSize: 11, color: 'var(--green)' }}
                                title="Instant +100 Available Coins"
                              >
                                +100
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdminAdjustWallet(undefined, {
                                    targetUser: u.id,
                                    action: 'minus',
                                    walletType: 'available',
                                    coins: 100,
                                    category: 'penalty_deduction',
                                    note: 'Quick -100 Coins Admin Deduction',
                                  })
                                }
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red)' }}
                                title="Instant -100 Available Coins"
                              >
                                -100
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* 5. Player Withdrawals Queue & Recent Postbacks */}
          <div
            id="admin-sec-5"
            style={{
              display:
                adminActiveSection === 'all' || adminActiveSection === 'withdrawals'
                  ? 'grid'
                  : 'none',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            <div className="card" style={{ padding: 24 }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)', marginBottom: 14 }}>
                Player Withdrawal Requests ({adminWithdrawals.length})
              </h3>
              {adminWithdrawals.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt2)', fontSize: 13, background: 'var(--bg2)', borderRadius: 10 }}>
                  No withdrawal requests in queue.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {adminWithdrawals.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                          ₹{w.amount_inr} ({w.coins_deducted} Coins) — {w.tier_label}
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
                          To: {w.payout_details_json} • Player: {w.user_email}
                        </div>
                      </div>
                      {w.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {w.method === 'crypto' && (
                            <button
                              type="button"
                              onClick={() => handleAdminFaucetPayPayout(w.id)}
                              className="btn btn-outline btn-sm"
                              style={{
                                padding: '6px 10px',
                                fontSize: 11,
                                color: 'var(--gold)',
                                borderColor: 'rgba(255,180,0,0.45)',
                              }}
                            >
                              ⚡ Pay via FaucetPay API
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAdminWithdrawalDecision(w.id, 'completed')}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                          >
                            ✓ Mark Paid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminWithdrawalDecision(w.id, 'rejected')}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '6px 10px', fontSize: 11, color: 'var(--red)', borderColor: 'var(--red)' }}
                          >
                            ✕ Reject &amp; Refund
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase' }}>
                          {w.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                    S2S Postback &amp; Escrow Hold Queue ({adminPostbacks.length})
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                    Jaise hi Ad Network se aapka payout aa jaye, 1-click me sabhi users ke Held Coins unke Withdrawable me bhej dein.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleReleaseHeldCoins({ releaseAll: true })}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: 11, padding: '7px 12px' }}
                >
                  💸 Network Payout Received → Release All Holds
                </button>
              </div>
              {adminPostbacks.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt2)', fontSize: 13, background: 'var(--bg2)', borderRadius: 10 }}>
                  No S2S postbacks received yet. Use the tester above to verify!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {adminPostbacks.slice(0, 12).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{p.title}</div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                          User: {p.user_id} • Status:{' '}
                          <span style={{ color: p.status === 'pending_hold' ? 'var(--gold)' : 'var(--green)' }}>
                            {p.status === 'pending_hold' ? 'ON HOLD' : p.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: Number(p.amount_coins) >= 0 ? 'var(--green)' : 'var(--red)',
                          }}
                        >
                          {Number(p.amount_coins) >= 0 ? `+${p.amount_coins}` : p.amount_coins} Coins
                        </span>
                        {p.status === 'pending_hold' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseHeldCoins({ ledgerId: p.id })}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 9px', fontSize: 10 }}
                          >
                            ✓ Release Hold
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', padding: '20px' }}>
          <div
            className="wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
              © 2026 Lootify — Restricted Admin Panel • Business Mail:{' '}
              <a href="mailto:contact@lootify.eternant.c0m.to" className="font-mono" style={{ color: 'var(--green)', textDecoration: 'none' }}>
                contact@lootify.eternant.c0m.to
              </a>
            </span>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--gold)' }}>
              Authorized: {ADMIN_ALLOWED_EMAIL}
            </span>
          </div>
        </footer>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const totalCoins = user.availableCoins + user.pendingCoins;
  const totalInr = ((totalCoins * 90) / 100000).toFixed(2);
  const totalUsd = (totalCoins / 100000).toFixed(2);
  const inrBalance = ((user.availableCoins * 90) / 100000).toFixed(2);
  const usdBalance = (user.availableCoins / 100000).toFixed(2);
  const pendingInr = ((user.pendingCoins * 90) / 100000).toFixed(2);
  const pendingUsd = (user.pendingCoins / 100000).toFixed(2);
  const referralLink = `${window.location.origin}${window.location.pathname}?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2200);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);

    const channelLabels: Record<PayoutChannel, string> = {
      crypto: 'FaucetPay (USDT - 0% Fee)',
      upi: 'UPI Direct Transfer (₹)',
      bank: 'Bank Transfer (IMPS)',
      gift_card: `${giftCardBrand} Gift Card`,
    };

    let coinsNum = 0;
    let inrVal = 0;
    let usdVal = 0;

    if (payoutChannel === 'crypto') {
      coinsNum = Math.floor(Number(payoutCoins) || 0);
      if (coinsNum < 100) {
        setPayoutMessage({ type: 'error', text: 'Minimum FaucetPay withdrawal is 100 Coins (0.001 USDT).' });
        return;
      }
      usdVal = Number((coinsNum / 100000).toFixed(4));
      inrVal = Number(((coinsNum * 90) / 100000).toFixed(2));
    } else if (payoutChannel === 'upi') {
      const inrParsed = Math.max(1, Math.floor(Number(upiInrInput) || 1));
      inrVal = inrParsed;
      coinsNum = inrParsed * 1100; // 100 coins extra for every amount (1₹ = 1100 coins, 2₹ = 2200, etc.)
      usdVal = Number((coinsNum / 100000).toFixed(4));
    } else if (payoutChannel === 'gift_card') {
      coinsNum = Math.floor(Number(payoutCoins) || 0);
      if (coinsNum < 1000) {
        setPayoutMessage({ type: 'error', text: 'Please enter a valid Gift Card coin amount.' });
        return;
      }
      inrVal = Number(((coinsNum * 90) / 100000).toFixed(2));
      usdVal = Number((coinsNum / 100000).toFixed(2));
    } else {
      coinsNum = Math.floor(Number(payoutCoins) || 0);
      if (coinsNum < 100000) {
        setPayoutMessage({ type: 'error', text: 'Minimum withdrawal for this channel is 100,000 Coins ($1.00 USD / ₹90.00 INR).' });
        return;
      }
      inrVal = Number(((coinsNum * 90) / 100000).toFixed(2));
      usdVal = Number((coinsNum / 100000).toFixed(2));
    }

    if (coinsNum > user.availableCoins) {
      setPayoutMessage({
        type: 'error',
        text: `Insufficient balance. This withdrawal requires ${coinsNum.toLocaleString('en-IN')} Coins, but you currently have ${user.availableCoins.toLocaleString('en-IN')} available coins.`,
      });
      return;
    }
    if (!payoutDestination.trim()) {
      setPayoutMessage({
        type: 'error',
        text:
          payoutChannel === 'upi'
            ? 'Please enter your UPI ID.'
            : payoutChannel === 'gift_card'
            ? 'Please enter the Email Address where you want to receive your Gift Card code.'
            : 'Please enter your FaucetPay Email or USDT Address.',
      });
      return;
    }

    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          method: payoutChannel,
          methodLabel: channelLabels[payoutChannel],
          destination: payoutDestination.trim(),
          coins: coinsNum,
          inrAmount: inrVal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.user) {
          saveCurrentUser(data.user);
          setUser(data.user);
        }
        setPayoutDestination('');
        setPayoutMessage({
          type: 'success',
          text: data.message || `Withdrawal request submitted!`,
        });
        return;
      } else if (data && data.error) {
        setPayoutMessage({ type: 'error', text: data.error });
        return;
      }
    } catch {
      // Fallback to local update if offline
    }

    const newRecord: WithdrawalRecord = {
      id: 'wd_' + Date.now().toString(36),
      method: payoutChannel,
      methodLabel: channelLabels[payoutChannel],
      destination: payoutDestination.trim(),
      coins: coinsNum,
      amountInr: inrVal,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const updatedUser: PlayerUser = {
      ...user,
      availableCoins: user.availableCoins - coinsNum,
      withdrawals: [newRecord, ...user.withdrawals],
    };

    saveCurrentUser(updatedUser);
    setUser(updatedUser);
    setPayoutDestination('');
    setPayoutMessage({
      type: 'success',
      text: payoutChannel === 'crypto'
        ? `Withdrawal request for $${usdVal} USDT (${coinsNum.toLocaleString('en-IN')} Coins) submitted!`
        : `Withdrawal request for ₹${inrVal} (${coinsNum.toLocaleString('en-IN')} Coins) submitted!`,
    });
  };

  const enabledOfferwalls = offerwalls.filter((w) => w.enabled);
  const selectedWall =
    enabledOfferwalls.find((w) => w.provider_id === selectedWallId) || enabledOfferwalls[0] || null;

  const resolvedIframeUrl =
    selectedWall?.provider_id === 'pubcrypto'
      ? signedPubCryptoUrl || ''
      : selectedWall?.provider_id === 'offerwallme' ||
          String(selectedWall?.iframe_url_template || '').includes('offerwall.me')
        ? signedOfferwallMeUrl ||
          buildSignedOfferwallMeUrlSync(
            selectedWall?.app_id || OFFERWALLME_PUBLIC_KEY,
            user.id,
            selectedWall?.secret_key
          )
        : selectedWall?.signed_iframe_url ||
          (selectedWall && selectedWall.iframe_url_template
            ? selectedWall.iframe_url_template
                .replace(/\{app_id\}/g, encodeURIComponent((selectedWall.app_id || OFFERWALLME_PUBLIC_KEY).trim()))
                .replace(/\{user_id\}/g, encodeURIComponent(user.id))
            : '');

  return (
    <div
      className="lootify-v2 grid-bg"
      data-theme={theme}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowAnchor: 'none' }}
    >
      {/* ── TOP NAVBAR ── */}
      <nav id="navbar">
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              switchTab('overview');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg,var(--green),#00A870)',
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Chakra Petch',sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: '#03100A',
                boxShadow: '0 0 14px rgba(0,232,154,0.4)',
              }}
            >
              L
            </div>
            <span className="font-display" style={{ fontSize: 19, fontWeight: 700, color: 'var(--txt)' }}>
              LOOTIFY<span style={{ color: 'var(--green)' }}>.</span>
            </span>
          </a>

          <div className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(0,232,154,0.1)',
                border: '1px solid rgba(0,232,154,0.28)',
                color: 'var(--green)',
                fontWeight: 600,
              }}
            >
              ⚡ 100,000 Coins = $1.00 USD / ₹90 INR
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div
              onClick={() => switchTab('wallet')}
              style={{
                background: 'rgba(255,180,0,0.1)',
                border: '1px solid rgba(255,180,0,0.28)',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Available Balance"
            >
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                {user.availableCoins.toLocaleString('en-IN')} Coins
              </span>
              <span className="hide-mob font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                (₹{inrBalance})
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Toggle theme"
            >
              <span>{theme === 'light' ? '☀️' : '🌙'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-ghost btn-sm hide-mob"
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              Logout
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              style={{
                display: 'none',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--txt)',
                fontSize: 18,
              }}
              id="hamburger"
            >
              ☰
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg2)',
              borderTop: '1px solid var(--border)',
              padding: '16px 20px',
              gap: 6,
            }}
          >
            {(
              [
                { id: 'overview', label: '⚡ Overview Dashboard' },
                { id: 'offerwalls', label: '1️⃣ Offer Tasks (App / Web / Register)' },
                { id: 'surveys', label: '2️⃣ Surveys (All Paid Surveys)' },
                { id: 'ptc', label: '3️⃣ PTC (Window / Iframe / Articles)' },
                { id: 'faucet', label: '4️⃣ Faucet (Hourly Claim)' },
                { id: 'tasks', label: '5️⃣ Mini Tasks (Custom, TimeWall & AdLabs)' },
                { id: 'youtube', label: '6️⃣ Video Ads' },
                { id: 'shortlinks', label: '7️⃣ Short Links (Our Added & Providers)' },
                { id: 'referrals', label: '👥 Refer & Earn' },
                { id: 'wallet', label: '🏦 Cashout Wallet' },
              ] as { id: DashboardTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 10px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: activeTab === t.id ? 'var(--green)' : 'var(--txt)',
                  background: activeTab === t.id ? 'rgba(0,232,154,0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={goBackToLanding} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                Home Page
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
                style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red)' }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main
        className="wrap"
        style={{ flex: 1, width: '100%', padding: '24px 20px 64px', overflowAnchor: 'none' }}
      >
        {/* Compact Unified Player Command Header */}
        <div
          className="card"
          style={{
            padding: '16px 22px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            background: 'linear-gradient(135deg, rgba(0,232,154,0.06), rgba(155,110,255,0.04))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, var(--green), #00A870)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                fontSize: 20,
                color: '#03100A',
                flexShrink: 0,
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 className="font-display" style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: 700, color: 'var(--txt)' }}>
                  {user.name}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id).catch(() => {});
                    setCopiedPlayerId(true);
                    setTimeout(() => setCopiedPlayerId(false), 2000);
                  }}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(0,232,154,0.1)',
                    border: '1px solid rgba(0,232,154,0.28)',
                    color: 'var(--green)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Click to copy Player ID"
                >
                  {copiedPlayerId ? '✅ COPIED ID!' : `ID: ${user.id} 📋`}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                {user.email} &nbsp;•&nbsp; Joined {user.joinedAt}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Live Compact Balance Pills */}
            <div
              onClick={() => switchTab('wallet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '7px 12px',
                borderRadius: 9,
                background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.04em' }}>
                  WITHDRAWABLE
                </div>
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                  {user.availableCoins.toLocaleString('en-IN')} <span style={{ fontSize: 11, color: 'var(--txt2)' }}>(₹{inrBalance})</span>
                </div>
              </div>
              <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.04em' }}>
                  ON HOLD
                </div>
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                  {user.pendingCoins.toLocaleString('en-IN')} <span style={{ fontSize: 11, color: 'var(--txt2)' }}>(₹{pendingInr})</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => syncUserWithBackend(user, true)}
              disabled={syncingWallet}
              className="btn btn-ghost btn-sm"
            >
              {syncingWallet ? '⏳ Syncing...' : '🔄 Sync S2S'}
            </button>
            <button type="button" onClick={() => switchTab('wallet')} className="btn btn-primary btn-sm">
              🏦 Cashout Now
            </button>
          </div>
        </div>

        {syncStatusMsg && (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(0,232,154,0.1)',
              border: '1px solid rgba(0,232,154,0.3)',
              color: 'var(--green)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {syncStatusMsg}
          </div>
        )}

        {/* ── TAB 1: OVERVIEW (PURE EARNING STATISTICS & ANALYTICS — NO DIRECT AD ACCESS) ── */}
        {activeTab === 'overview' && (() => {
          const todayPrefix = new Date().toISOString().slice(0, 10);
          const allHeld = user.heldRewards || [];
          const allFaucet = user.faucetHistory || [];

          const todayTasks = allHeld.filter(
            (h) => String(h.createdAt || '').startsWith(todayPrefix) && Number(h.coins) > 0
          );
          const todayFaucet = allFaucet.filter((f) => String(f.createdAt || '').startsWith(todayPrefix));
          const todayLeadsCount = todayTasks.length + todayFaucet.length;
          const todayCoinsEarned = Number(
            (
              todayTasks.reduce((acc, h) => acc + (Number(h.coins) || 0), 0) +
              todayFaucet.reduce((acc, f) => acc + (Number(f.coins) || 0), 0)
            ).toFixed(2)
          );

          const totalLeadsCount = Math.max(
            Number(user.questsCompleted) || 0,
            allHeld.filter((h) => Number(h.coins) > 0).length + allFaucet.length
          );
          const pendingLeadsCount = allHeld.filter((h) => h.status === 'pending_hold').length;

          // Category Breakdown Statistics
          const shortlinkEarned = Number(
            allHeld
              .filter((h) => String(h.title || '').toUpperCase().includes('SHORTLINK') && Number(h.coins) > 0)
              .reduce((acc, h) => acc + (Number(h.coins) || 0), 0)
              .toFixed(2)
          );
          const ptcEarned = Number(
            allHeld
              .filter((h) => String(h.title || '').toUpperCase().includes('PTC') && Number(h.coins) > 0)
              .reduce((acc, h) => acc + (Number(h.coins) || 0), 0)
              .toFixed(2)
          );
          const faucetEarned = Number(
            allFaucet.reduce((acc, f) => acc + (Number(f.coins) || 0), 0).toFixed(2)
          );
          const offerwallEarned = Number(
            Math.max(
              0,
              allHeld
                .filter(
                  (h) =>
                    !String(h.title || '').toUpperCase().includes('SHORTLINK') &&
                    !String(h.title || '').toUpperCase().includes('PTC') &&
                    Number(h.coins) > 0
                )
                .reduce((acc, h) => acc + (Number(h.coins) || 0), 0)
            ).toFixed(2)
          );
          const sumCategorized = Math.max(1, offerwallEarned + shortlinkEarned + ptcEarned + faucetEarned);

          const faucetPayProgressPct = Math.min(100, Math.round((user.availableCoins / 100) * 100));
          const upiMinProgressPct = Math.min(100, Math.round((user.availableCoins / 1100) * 100));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* TIER 1: LIVE EARNING & LEADS STATISTICS (OFFERZONO / ANALYTICS STYLE) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(0,232,154,0.12)',
                        border: '1px solid rgba(0,232,154,0.28)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--green)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </span>
                    <span className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                      Live Earning Statistics
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10.5,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(0,232,154,0.12)',
                        color: 'var(--green)',
                        fontWeight: 700,
                      }}
                    >
                      REAL-TIME ANALYTICS
                    </span>
                  </div>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                    Use the <strong style={{ color: 'var(--green)' }}>Earn</strong> tab in the bottom bar to open earning sections
                  </span>
                </div>

                {/* 3 Primary Lead & Activity Stat Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 14,
                  }}
                >
                  {/* Card 1: TODAY LEADS */}
                  <div
                    className="card"
                    style={{
                      padding: '20px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      border: '1px solid rgba(0,232,154,0.3)',
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: 'rgba(0,232,154,0.12)',
                        border: '1px solid rgba(0,232,154,0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00E89A',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                        TODAY LEADS
                      </div>
                      <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2, marginTop: 2 }}>
                        {todayLeadsCount}
                      </div>
                      <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 3 }}>
                        +{todayCoinsEarned.toLocaleString('en-IN')} Coins today
                      </div>
                    </div>
                  </div>

                  {/* Card 2: TOTAL LEADS */}
                  <div
                    className="card"
                    style={{
                      padding: '20px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      border: '1px solid rgba(155,110,255,0.28)',
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: 'rgba(155,110,255,0.14)',
                        border: '1px solid rgba(155,110,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9B6EFF',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                        TOTAL LEADS
                      </div>
                      <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2, marginTop: 2 }}>
                        {totalLeadsCount}
                      </div>
                      <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 3 }}>
                        since {user.joinedAt}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: PENDING LEADS */}
                  <div
                    className="card"
                    style={{
                      padding: '20px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      border: '1px solid rgba(255,180,0,0.28)',
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: 'rgba(255,180,0,0.12)',
                        border: '1px solid rgba(255,180,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFB400',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                        PENDING LEADS
                      </div>
                      <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', lineHeight: 1.2, marginTop: 2 }}>
                        {pendingLeadsCount}
                      </div>
                      <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 3 }}>
                        {pendingLeadsCount > 0 ? `${user.pendingCoins} Coins in verification` : 'no open holds'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Earning Source Breakdown Analytics Card */}
                <div
                  className="card"
                  style={{
                    marginTop: 14,
                    padding: '18px 22px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                        <path d="M22 12A10 10 0 0 0 12 2v10z" />
                      </svg>
                      Earnings Breakdown by Source
                    </span>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                      100,000 Coins = $1.00 USD / ₹90 INR
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                    {[
                      {
                        label: 'Offerwalls & Surveys',
                        coins: offerwallEarned,
                        pct: Math.round((offerwallEarned / sumCategorized) * 100),
                        color: 'var(--green)',
                      },
                      {
                        label: 'Paid Shortlinks',
                        coins: shortlinkEarned,
                        pct: Math.round((shortlinkEarned / sumCategorized) * 100),
                        color: 'var(--gold)',
                      },
                      {
                        label: 'PTC Ads & Tasks',
                        coins: ptcEarned,
                        pct: Math.round((ptcEarned / sumCategorized) * 100),
                        color: '#38BDF8',
                      },
                      {
                        label: 'Hourly Free Faucet',
                        coins: faucetEarned,
                        pct: Math.round((faucetEarned / sumCategorized) * 100),
                        color: 'var(--violet)',
                      },
                    ].map((src) => (
                      <div
                        key={src.label}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>
                          <span>{src.label}</span>
                          <span className="font-mono" style={{ color: src.color, fontWeight: 700 }}>
                            {src.coins.toLocaleString('en-IN')} C
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(4, src.pct)}%`,
                              height: '100%',
                              background: src.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TIER 2: UNIFIED WALLET STATS & CASHOUT ELIGIBILITY BAR */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
                    gap: 14,
                  }}
                >
                  <div className="card" style={{ padding: 20, border: '1.5px solid rgba(0,232,154,0.35)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', marginBottom: 6 }}>
                      1. WITHDRAWABLE NOW
                    </div>
                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                      {user.availableCoins.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 4 }}>
                      Ready Value: <strong style={{ color: 'var(--green)' }}>₹{inrBalance} (${usdBalance})</strong>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20, border: '1px solid rgba(255,180,0,0.28)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: 6 }}>
                      2. ON HOLD (VERIFICATION)
                    </div>
                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>
                      {user.pendingCoins.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 4 }}>
                      Hold Value: <strong style={{ color: 'var(--gold)' }}>₹{pendingInr}</strong> (Auto-settles)
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.06em', marginBottom: 6 }}>
                      3. TOTAL COINS BALANCE
                    </div>
                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--txt)' }}>
                      {totalCoins.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 4 }}>
                      Combined Value: <strong style={{ color: 'var(--txt)' }}>₹{totalInr}</strong>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--violet)', letterSpacing: '0.06em', marginBottom: 6 }}>
                      4. TASKS &amp; REFERRALS
                    </div>
                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--violet)' }}>
                      {user.questsCompleted} <span style={{ fontSize: 13, color: 'var(--txt2)' }}>• {user.referralsCount} Refs</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 4 }}>
                      10% lifetime commission active
                    </div>
                  </div>
                </div>

                {/* Visual Instant Cashout Progress Bar */}
                <div
                  className="card"
                  style={{
                    padding: '14px 18px',
                    background: 'var(--bg2)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 16,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
                      <span className="font-mono" style={{ color: 'var(--txt)', fontWeight: 700 }}>
                        🪙 FaucetPay Instant Goal (100 Coins = $0.001)
                      </span>
                      <span className="font-mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                        {faucetPayProgressPct}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 7, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div
                        style={{
                          width: `${faucetPayProgressPct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--gold), var(--green))',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
                      <span className="font-mono" style={{ color: 'var(--txt)', fontWeight: 700 }}>
                        ⚡ UPI Minimum Goal (1,100 Coins = ₹1 INR)
                      </span>
                      <span className="font-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>
                        {upiMinProgressPct}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 7, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div
                        style={{
                          width: `${upiMinProgressPct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--green), #059669)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TIER 3: TWO-COLUMN SPLIT (FILTERABLE ACTIVITY LEDGER + PAYOUT METHODS & AD PLACEMENT) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
                {/* Left Column: Filterable Account Activity Ledger */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--txt)' }}>
                        Recent Account Activity
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                        Live ledger of your completed Offerwalls, Shortlinks, Faucet rolls &amp; Cashouts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => syncUserWithBackend(user, true)}
                      className="btn btn-outline btn-sm"
                    >
                      🔄 Sync History
                    </button>
                  </div>

                  {/* Activity Filter Pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {(
                      [
                        { id: 'all', label: 'All Activity' },
                        { id: 'tasks', label: `Tasks & Links (${user.heldRewards?.length || 0})` },
                        { id: 'faucet', label: `Faucet (${user.faucetHistory?.length || 0})` },
                        { id: 'withdrawals', label: `Cashouts (${user.withdrawals?.length || 0})` },
                      ] as const
                    ).map((tab) => {
                      const active = overviewHistoryFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setOverviewHistoryFilter(tab.id)}
                          className="font-mono"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 7,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: active ? 'rgba(0,232,154,0.14)' : 'var(--bg2)',
                            border: active ? '1px solid var(--green)' : '1px solid var(--border)',
                            color: active ? 'var(--green)' : 'var(--txt2)',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {(user.heldRewards?.length || 0) === 0 &&
                  (user.faucetHistory?.length || 0) === 0 &&
                  user.withdrawals.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 18px',
                        textAlign: 'center',
                        background: 'var(--bg2)',
                        border: '1px dashed var(--border2)',
                        borderRadius: 12,
                      }}
                    >
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>
                        No transactions yet
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Complete any Offerwall task, Shortlink, or Faucet roll above to see live entries here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                      {(overviewHistoryFilter === 'all' || overviewHistoryFilter === 'tasks') &&
                        (user.heldRewards || []).slice(0, 15).map((item) => {
                          const isHeld = item.status === 'pending_hold';
                          const isDeducted = Number(item.coins) < 0 || item.status === 'deducted';
                          return (
                            <div
                              key={`ov_task_${item.id}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                background: 'var(--bg2)',
                                border: isDeducted
                                  ? '1px solid rgba(255,85,102,0.32)'
                                  : isHeld
                                  ? '1px solid rgba(255,180,0,0.28)'
                                  : '1px solid rgba(0,232,154,0.22)',
                                borderRadius: 10,
                                flexWrap: 'wrap',
                                gap: 10,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                                  {item.title}
                                </div>
                                <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 2 }}>
                                  {formatIstDate(item.createdAt)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: isDeducted ? 'var(--red)' : isHeld ? 'var(--gold)' : 'var(--green)',
                                  }}
                                >
                                  {Number(item.coins) >= 0 ? `+${item.coins}` : item.coins} Coins
                                </span>
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 9.5,
                                    padding: '3px 7px',
                                    borderRadius: 6,
                                    background: isDeducted
                                      ? 'rgba(255,85,102,0.12)'
                                      : isHeld
                                      ? 'rgba(255,180,0,0.12)'
                                      : 'rgba(0,232,154,0.12)',
                                    color: isDeducted ? 'var(--red)' : isHeld ? 'var(--gold)' : 'var(--green)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {isDeducted ? '⚠️ DEDUCTED' : isHeld ? '⏳ ON HOLD' : '✅ CREDITED'}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      {(overviewHistoryFilter === 'all' || overviewHistoryFilter === 'faucet') &&
                        (user.faucetHistory || []).slice(0, 8).map((f) => (
                          <div
                            key={`ov_faucet_${f.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              background: 'var(--bg2)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              flexWrap: 'wrap',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                                Hourly Faucet Roll #{String(f.rollNumber).padStart(4, '0')}
                              </div>
                              <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 2 }}>
                                {formatIstDate(f.createdAt)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)' }}>
                                +{f.coins} Coins
                              </span>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 9.5,
                                  padding: '3px 7px',
                                  borderRadius: 6,
                                  background: 'rgba(0,232,154,0.12)',
                                  color: 'var(--green)',
                                  fontWeight: 700,
                                }}
                              >
                                ✅ CREDITED
                              </span>
                            </div>
                          </div>
                        ))}

                      {(overviewHistoryFilter === 'all' || overviewHistoryFilter === 'withdrawals') &&
                        user.withdrawals.map((w) => (
                          <div
                            key={w.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              background: 'var(--bg2)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              flexWrap: 'wrap',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                                {w.methodLabel} — ₹{w.amountInr}
                              </div>
                              <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 2 }}>
                                {w.destination} • {formatIstDate(w.createdAt)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gold)' }}>
                                -{w.coins} Coins
                              </span>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 9.5,
                                  padding: '3px 7px',
                                  borderRadius: 6,
                                  background: 'rgba(255,180,0,0.1)',
                                  border: '1px solid rgba(255,180,0,0.25)',
                                  color: 'var(--gold)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {w.status}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Quick Cashout Channels & Sponsored Partner Placement */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card" style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                        🏦 Supported Payout Methods
                      </h3>
                      <button
                        type="button"
                        onClick={() => switchTab('wallet')}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '5px 11px', fontSize: 11 }}
                      >
                        Open Cashout →
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        onClick={() => {
                          setPayoutChannel('crypto');
                          switchTab('wallet');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          background: 'var(--bg2)',
                          border: '1px solid rgba(255,180,0,0.28)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                            🪙 FaucetPay (USDT) — 0% Fee
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                            Min 100 Coins ($0.001) • Instant API Transfer &lt;= $0.01
                          </div>
                        </div>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                          INSTANT ⚡
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          setPayoutChannel('upi');
                          switchTab('wallet');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          background: 'var(--bg2)',
                          border: '1px solid rgba(0,232,154,0.28)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                            ⚡ UPI (₹ Only) — Direct Bank VPA
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                            Min ₹1 Withdrawal • ₹1 = 1,100 Coins (₹2 = 2,200)
                          </div>
                        </div>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                          MIN ₹1
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          setPayoutChannel('gift_card');
                          switchTab('wallet');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          background: 'var(--bg2)',
                          border: '1px solid rgba(155,110,255,0.28)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet)' }}>
                            🎁 Gift Cards (Play • Amazon • Flipkart)
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                            Redeem vouchers delivered directly to your email
                          </div>
                        </div>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--violet)', fontWeight: 700 }}>
                          VOUCHERS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Offerwall.me Official Banner Ad Slots */}
                  <div
                    className="card"
                    style={{
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--txt2)', letterSpacing: '0.08em' }}>
                        SPONSORED PARTNER PLACEMENT • OFFERWALL.ME
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--green)' }}>
                        VERIFIED ADS
                      </span>
                    </div>
                    <OfferwallMeBanner size="468x60" />
                    <OfferwallMeBanner size="300x250" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TAB 5: MINI TASKS (Our Custom Added Mini-Tasks + AdLabs + TimeWall Tasks + Offerwall.me Micro-Tasks) ── */}
        {activeTab === 'tasks' && (() => {
          const baseOwmUrl =
            signedOfferwallMeUrl ||
            buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id);
          const taskIframeUrl =
            tasksSubMode === 'owm_telegram'
              ? buildOfferwallMeTabUrl(baseOwmUrl, 'tasks', 'telegram')
              : tasksSubMode === 'owm_general'
              ? buildOfferwallMeTabUrl(baseOwmUrl, 'tasks', 'general')
              : tasksSubMode === 'timewall_tasks'
              ? `${pubCryptoNativeFeed.timewallBaseUrl}&tab=tasks`
              : signedPubCryptoUrl;

          const activeCustomTasks = customMiniTasks.filter((t) => t.enabled);
          const totalMiniTasksCount =
            activeCustomTasks.length +
            owmFeed.tasks.length +
            pubCryptoNativeFeed.reviewMapTasks.length;

          const handleCreateCustomMiniTask = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newMtTitle.trim()) return;
            const created = {
              id: `mt_${Date.now()}`,
              title: newMtTitle.trim(),
              category: newMtCategory.trim() || 'Micro-Task',
              providerTag: 'LOOTIFY MINI-TASK',
              rewardCoins: Math.max(1, Number(newMtReward) || 100),
              url: newMtUrl.trim() || 'https://',
              instructions:
                newMtInstructions.trim() ||
                'Complete the required steps on the destination page and submit your proof below.',
              proofPlaceholder: newMtProofHint.trim() || 'Enter username or screenshot link',
              enabled: true,
            };
            const next = [created, ...customMiniTasks];
            setCustomMiniTasks(next);
            try {
              localStorage.setItem('lootify_custom_mini_tasks_v1', JSON.stringify(next));
            } catch {}
            setNewMtTitle('');
            setNewMtUrl('');
            setNewMtInstructions('');
            setShowAddMiniTaskForm(false);
          };

          const handleDeleteCustomMiniTask = (id: string) => {
            const next = customMiniTasks.filter((item) => item.id !== id);
            setCustomMiniTasks(next);
            try {
              localStorage.setItem('lootify_custom_mini_tasks_v1', JSON.stringify(next));
            } catch {}
          };

          const handleSubmitCustomMiniTaskProof = (task: (typeof customMiniTasks)[0]) => {
            if (!user) return;
            const proofVal = String(taskProofInputs[task.id] || '').trim();
            if (!proofVal) {
              setTaskSubmitNotice({
                taskId: task.id,
                type: 'error',
                text: 'Please enter your proof (username / link / text) before submitting.',
              });
              return;
            }
            const alreadyDone = (user.heldRewards || []).some((h) => String(h.id).includes(task.id));
            if (alreadyDone) {
              setTaskSubmitNotice({
                taskId: task.id,
                type: 'error',
                text: 'You have already submitted proof for this Mini-Task.',
              });
              return;
            }
            const rewardCoins = Number(task.rewardCoins) || 100;
            const inrVal = Number(((rewardCoins * 90) / 100000).toFixed(2));
            const nowIso = new Date().toISOString();
            const nextUser: PlayerUser = {
              ...user,
              pendingCoins: Number((user.pendingCoins + rewardCoins).toFixed(2)),
              questsCompleted: (user.questsCompleted || 0) + 1,
              heldRewards: [
                {
                  id: `custom_mt_${task.id}_${Date.now()}`,
                  title: `📋 MINI TASK (${task.category.toUpperCase()}): ${task.title} [Proof: ${proofVal}]`,
                  coins: rewardCoins,
                  amountInr: inrVal,
                  createdAt: nowIso,
                  unlocksAt: new Date(Date.now() + 86400 * 1000).toISOString(),
                  status: 'pending_hold',
                },
                ...(user.heldRewards || []),
              ],
            };
            saveCurrentUser(nextUser);
            setUser(nextUser);
            syncUserWithBackend(nextUser, false, true);
            setTaskSubmitNotice({
              taskId: task.id,
              type: 'success',
              text: `✅ Proof submitted! +${rewardCoins} Coins logged to your Wallet.`,
            });
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(245,158,11,0.14)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F59E0B',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="m9 14 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                      5. Mini Tasks — Custom Added Tasks, AdLabs, TimeWall &amp; Micro-Jobs
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                      Our added Mini-Tasks + Provider Micro-Tasks (TimeWall, Offerwall.me, PubCrypto &amp; AdLabs) for{' '}
                      <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> • Postback: <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'cards', label: `📋 All Mini Tasks (${totalMiniTasksCount})` },
                    { id: 'timewall_tasks', label: '⏱️ TimeWall Mini-Tasks' },
                    { id: 'adlabs', label: '🔥 AdLabs Mini-Tasks' },
                    { id: 'owm_telegram', label: '💬 Telegram Join Wall' },
                    { id: 'owm_general', label: '🌐 Offerwall.me Task Wall' },
                    { id: 'pubcrypto', label: '🚀 PubCrypto Review Map Wall' },
                  ].map((mode) => {
                    const active = tasksSubMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setTasksSubMode(mode.id as any);
                        }}
                        className="btn btn-sm"
                        style={{
                          background: active ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                          border: active ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: active ? 'var(--green)' : 'var(--txt2)',
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                  {(adminLoggedIn || user.email.toLowerCase() === 'sarthaksinghyadav1@gmail.com') && (
                    <button
                      type="button"
                      onClick={() => setShowAddMiniTaskForm((prev) => !prev)}
                      className="btn btn-primary btn-sm"
                    >
                      {showAddMiniTaskForm ? '✕ Close Creator' : '+ Add Mini-Task (Admin)'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      fetchOfferwallMeFeed(user.id, true);
                      fetchPubCryptoNativeFeed(user.id, true);
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    {owmFeedLoading ? 'Refreshing...' : 'Refresh Tasks'}
                  </button>
                </div>
              </div>

              {pubCryptoLaunchNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: '#F59E0B',
                    fontSize: 12.5,
                  }}
                >
                  ⚡ {pubCryptoLaunchNotice}
                </div>
              )}

              {/* Admin Mini-Task Creator Box (Only visible to Admin when toggled) */}
              {showAddMiniTaskForm && (adminLoggedIn || user.email.toLowerCase() === 'sarthaksinghyadav1@gmail.com') && (
                <form
                  onSubmit={handleCreateCustomMiniTask}
                  className="card card-glow"
                  style={{
                    padding: 20,
                    background: 'var(--bg2)',
                    border: '1.5px solid var(--green)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--green)' }}>
                      ⚡ Add Custom Mini-Task (Lootify Native Mini-Tasks)
                    </h3>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                      ADMIN ONLY
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                    <input
                      type="text"
                      required
                      value={newMtTitle}
                      onChange={(e) => setNewMtTitle(e.target.value)}
                      placeholder="Task Title (e.g. Join Telegram Channel)"
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                    />
                    <input
                      type="text"
                      value={newMtCategory}
                      onChange={(e) => setNewMtCategory(e.target.value)}
                      placeholder="Category (e.g. Telegram, YouTube, Signup)"
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={newMtReward}
                      onChange={(e) => setNewMtReward(e.target.value)}
                      placeholder="Reward Coins (e.g. 150)"
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                    />
                    <input
                      type="url"
                      value={newMtUrl}
                      onChange={(e) => setNewMtUrl(e.target.value)}
                      placeholder="Destination URL (https://...)"
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newMtInstructions}
                    onChange={(e) => setNewMtInstructions(e.target.value)}
                    placeholder="Step-by-step instructions for the player..."
                    style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                  />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={newMtProofHint}
                      onChange={(e) => setNewMtProofHint(e.target.value)}
                      placeholder="Proof prompt (e.g. Enter your @telegram_username)"
                      style={{ flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--txt)', fontSize: 13 }}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Save &amp; Publish Mini-Task
                    </button>
                  </div>
                </form>
              )}

              {tasksSubMode === 'adlabs' ? (
                <div className="card card-glow" style={{ padding: 28, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(245,158,11,0.16)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      color: '#F59E0B',
                      fontWeight: 700,
                    }}
                  >
                    🔥 ADLABS MINI-TASKS ENGINE • S2S POSTBACK READY
                  </span>
                  <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
                    AdLabs Mini-Tasks Provider Slot Ready
                  </h3>
                  <p style={{ fontSize: 13.5, color: 'var(--txt2)', maxWidth: 540, lineHeight: 1.65 }}>
                    AdLabs micro-tasks slot aur S2S postback endpoint (<code className="font-mono" style={{ color: 'var(--green)' }}>lootify/api/postback</code>) pre-configured hai. Jaise hi AdLabs publisher API key add hogi, saare AdLabs Mini-Tasks yahan single-piece cards ke roop me live dikhenge.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" onClick={() => setTasksSubMode('cards')} className="btn btn-primary btn-sm">
                      View Active Mini-Tasks ({totalMiniTasksCount})
                    </button>
                    <button type="button" onClick={() => setTasksSubMode('timewall_tasks')} className="btn btn-outline btn-sm">
                      Open TimeWall Mini-Tasks
                    </button>
                  </div>
                </div>
              ) : tasksSubMode === 'cards' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Source Filter Pills inside Mini Tasks */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { id: 'all', label: `All Mini Tasks (${totalMiniTasksCount})` },
                        { id: 'custom', label: `⭐ Hamare Added Tasks (${activeCustomTasks.length})` },
                        { id: 'provider', label: `🌐 Offerwall.me & PubCrypto (${owmFeed.tasks.length + pubCryptoNativeFeed.reviewMapTasks.length})` },
                        { id: 'adlabs', label: '🔥 AdLabs Tasks (Integrating Soon)' },
                      ].map((f) => {
                        const active = miniTaskSourceFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setMiniTaskSourceFilter(f.id as any)}
                            className="font-mono"
                            style={{
                              padding: '7px 14px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: active ? 'rgba(245,158,11,0.16)' : 'var(--bg2)',
                              border: active ? '1.5px solid #F59E0B' : '1px solid var(--border)',
                              color: active ? '#F59E0B' : 'var(--txt2)',
                            }}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTasksSubMode('timewall_tasks')}
                      className="btn btn-sm"
                      style={{
                        background: 'rgba(56,189,248,0.16)',
                        border: '1px solid rgba(56,189,248,0.4)',
                        color: '#38BDF8',
                        fontWeight: 700,
                      }}
                    >
                      ⏱️ Open Extracted TimeWall Mini-Tasks →
                    </button>
                  </div>

                  {/* 1. HAMARE ADDED CUSTOM MINI-TASKS */}
                  {(miniTaskSourceFilter === 'all' || miniTaskSourceFilter === 'custom') &&
                    activeCustomTasks.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                        {activeCustomTasks.map((ct) => {
                          const isExpanded = expandedTaskId === ct.id;
                          const inrVal = ((ct.rewardCoins * 90) / 100000).toFixed(2);
                          return (
                            <div
                              key={ct.id}
                              className="card"
                              style={{
                                padding: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 14,
                                border: '1.5px solid rgba(0,232,154,0.38)',
                                background: 'var(--bg2)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                  <div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                      <span
                                        className="font-mono"
                                        style={{
                                          fontSize: 10,
                                          padding: '3px 8px',
                                          borderRadius: 5,
                                          background: 'rgba(0,232,154,0.16)',
                                          color: 'var(--green)',
                                          fontWeight: 700,
                                        }}
                                      >
                                        ⭐ {ct.providerTag}
                                      </span>
                                      <span
                                        className="font-mono"
                                        style={{
                                          fontSize: 10,
                                          padding: '3px 8px',
                                          borderRadius: 5,
                                          background: 'rgba(245,158,11,0.15)',
                                          color: '#F59E0B',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {ct.category.toUpperCase()}
                                      </span>
                                    </div>
                                    <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                      {ct.title}
                                    </h3>
                                  </div>
                                  <div
                                    style={{
                                      textAlign: 'right',
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      background: 'rgba(0,232,154,0.1)',
                                      border: '1px solid rgba(0,232,154,0.3)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                                      +{ct.rewardCoins}
                                    </div>
                                    <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--txt2)' }}>
                                      COINS (₹{inrVal})
                                    </div>
                                  </div>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 8, lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                                  {ct.instructions}
                                </p>
                              </div>

                              {isExpanded && (
                                <div
                                  style={{
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'var(--bg3)',
                                    border: '1px solid var(--border2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                  }}
                                >
                                  <a
                                    href={ct.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline btn-sm"
                                    style={{ textAlign: 'center', textDecoration: 'none' }}
                                  >
                                    1. Open Task Link ↗
                                  </a>
                                  <input
                                    type="text"
                                    value={taskProofInputs[ct.id] || ''}
                                    onChange={(e) =>
                                      setTaskProofInputs((prev) => ({
                                        ...prev,
                                        [ct.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={ct.proofPlaceholder}
                                    style={{
                                      width: '100%',
                                      padding: '9px 12px',
                                      borderRadius: 8,
                                      background: 'var(--bg2)',
                                      border: '1px solid var(--border2)',
                                      color: 'var(--txt)',
                                      fontSize: 12.5,
                                    }}
                                  />
                                  {taskSubmitNotice && taskSubmitNotice.taskId === ct.id && (
                                    <div
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        background:
                                          taskSubmitNotice.type === 'success'
                                            ? 'rgba(0,232,154,0.12)'
                                            : 'rgba(255,85,102,0.12)',
                                        color: taskSubmitNotice.type === 'success' ? 'var(--green)' : 'var(--red)',
                                      }}
                                    >
                                      {taskSubmitNotice.text}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitCustomMiniTaskProof(ct)}
                                    className="btn btn-primary btn-sm btn-full"
                                  >
                                    2. Submit Proof &amp; Claim +{ct.rewardCoins} Coins
                                  </button>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8 }}>
                                <a
                                  href={ct.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-outline btn-sm"
                                  style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                                >
                                  Open Link ↗
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setExpandedTaskId(isExpanded ? null : ct.id)}
                                  className="btn btn-primary btn-sm"
                                  style={{ flex: 1 }}
                                >
                                  {isExpanded ? 'Hide Proof Box' : `Submit Proof (+${ct.rewardCoins})`}
                                </button>
                                {(adminLoggedIn || user.email.toLowerCase() === 'sarthaksinghyadav1@gmail.com') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomMiniTask(ct.id)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--red)' }}
                                    title="Delete Custom Mini-Task"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* 2. ADLABS FILTER VIEW */}
                  {miniTaskSourceFilter === 'adlabs' && (
                    <div className="card" style={{ padding: 28, textAlign: 'center', border: '1px dashed rgba(245,158,11,0.45)' }}>
                      <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#F59E0B' }}>
                        🔥 AdLabs Mini-Tasks Provider Slot
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 6 }}>
                        AdLabs integration slot is ready with <code className="font-mono">lootify/api/postback</code>. Tasks from AdLabs will appear here automatically once connected.
                      </p>
                    </div>
                  )}

                  {/* 3. PUBCRYPTO REVIEW MAP & INNER PROVIDER MINI-TASKS */}
                  {(miniTaskSourceFilter === 'all' || miniTaskSourceFilter === 'provider') &&
                    pubCryptoNativeFeed.reviewMapTasks.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                        {pubCryptoNativeFeed.reviewMapTasks.map((rm: any, idx: number) => (
                          <div
                            key={`pc_rm_${rm.id || idx}`}
                            className="card"
                            style={{
                              padding: 18,
                              background: 'var(--bg2)',
                              border: '1px solid rgba(139,92,246,0.38)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 7px',
                                    borderRadius: 5,
                                    background: 'rgba(139,92,246,0.18)',
                                    color: '#C4B5FD',
                                    fontWeight: 700,
                                  }}
                                >
                                  🗺️ PUBCRYPTO REVIEW MAP
                                </span>
                                <span className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                                  +{rm.member_reward} COINS
                                </span>
                              </div>
                              <div className="font-display" style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--txt)', marginTop: 6 }}>
                                {rm.task_name}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLaunchPubCryptoLinkTask(rm)}
                              className="btn btn-primary btn-sm btn-full"
                            >
                              Start Review Map Mini-Task ↗
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* 4. OFFERWALL.ME SINGLE-PIECE MINI-TASKS */}
                  {(miniTaskSourceFilter === 'all' || miniTaskSourceFilter === 'provider') && (
                    owmFeedLoading && owmFeed.tasks.length === 0 ? (
                      <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                        Loading provider mini-tasks from Offerwall.me API...
                      </div>
                    ) : owmFeed.tasks.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
                        {owmFeed.tasks.map((task: any, idx: number) => {
                          const tid = String(task.id || idx);
                          const rewardCoins = Number(task.reward) || 0;
                          const inrVal = ((rewardCoins * 90) / 100000).toFixed(2);
                          const isExpanded = expandedTaskId === tid;
                          const approvalDays = task.approval_time
                            ? Math.max(1, Math.round(Number(task.approval_time) / 1440))
                            : 1;
                          return (
                            <div
                              key={tid}
                              className="card"
                              style={{
                                padding: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 14,
                                border: isExpanded
                                  ? '1.5px solid var(--green)'
                                  : '1px solid rgba(245,158,11,0.28)',
                                background: 'var(--bg2)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    {task.image ? (
                                      <img
                                        src={task.image}
                                        alt={task.title}
                                        style={{
                                          width: 44,
                                          height: 44,
                                          borderRadius: 10,
                                          objectFit: 'cover',
                                          border: '1px solid var(--border)',
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 44,
                                          height: 44,
                                          borderRadius: 10,
                                          background: 'rgba(245,158,11,0.14)',
                                          border: '1px solid rgba(245,158,11,0.32)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#F59E0B',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M9 11l3 3L22 4" />
                                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                        </svg>
                                      </div>
                                    )}
                                    <div>
                                      <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                        {task.title}
                                      </h3>
                                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                                        <span
                                          className="font-mono"
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            borderRadius: 5,
                                            background: 'rgba(245,158,11,0.14)',
                                            color: '#F59E0B',
                                            fontWeight: 700,
                                          }}
                                        >
                                          OFFERWALL.ME • PROOF: {String(task.proof_type || 'Text').toUpperCase()}
                                        </span>
                                        <span
                                          className="font-mono"
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            borderRadius: 5,
                                            background: 'rgba(56,189,248,0.14)',
                                            color: '#38BDF8',
                                            fontWeight: 700,
                                          }}
                                        >
                                          REVIEW: ~{approvalDays}d
                                        </span>
                                        {(() => {
                                          const st = getOwmCardLiveStatus(`task_${tid}`, task.title);
                                          if (!st) return null;
                                          return (
                                            <span
                                              className="font-mono"
                                              style={{
                                                fontSize: 10,
                                                padding: '2px 7px',
                                                borderRadius: 5,
                                                background: st.bg,
                                                color: st.color,
                                                fontWeight: 700,
                                              }}
                                            >
                                              {st.label}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign: 'right',
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      background: 'rgba(0,232,154,0.1)',
                                      border: '1px solid rgba(0,232,154,0.3)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                                      +{rewardCoins.toLocaleString('en-IN')}
                                    </div>
                                    <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--txt2)' }}>
                                      COINS (₹{inrVal})
                                    </div>
                                  </div>
                                </div>

                                {task.description && (
                                  <p style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 10, lineHeight: 1.55 }}>
                                    {task.description}
                                  </p>
                                )}
                              </div>

                              {isExpanded && (
                                <div
                                  style={{
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'var(--bg3)',
                                    border: '1px solid var(--border2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                  }}
                                >
                                  <div className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                                    STEP-BY-STEP INSTRUCTIONS
                                  </div>
                                  <div
                                    style={{ fontSize: 12.5, color: 'var(--txt)', lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{
                                      __html: String(task.instructions || task.description || 'Complete the task and submit proof below.'),
                                    }}
                                  />

                                  {task.url && (
                                    <a
                                      href={task.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-outline btn-sm"
                                      style={{ textAlign: 'center', textDecoration: 'none' }}
                                    >
                                      Open Task Destination Link ↗
                                    </a>
                                  )}

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                    <label className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', fontWeight: 700 }}>
                                      SUBMIT PROOF ({task.proof_text || 'Enter username, text proof, or screenshot link'}):
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={taskProofInputs[tid] || ''}
                                      onChange={(e) =>
                                        setTaskProofInputs((prev) => ({
                                          ...prev,
                                          [tid]: e.target.value,
                                        }))
                                      }
                                      placeholder={
                                        task.proof_text ||
                                        (task.proof_type === 'Image'
                                          ? 'Paste screenshot image URL or proof details...'
                                          : 'Enter your required proof text...')
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: 8,
                                        background: 'var(--bg2)',
                                        border: '1px solid var(--border2)',
                                        color: 'var(--txt)',
                                        fontSize: 12.5,
                                      }}
                                    />

                                    {taskSubmitNotice && taskSubmitNotice.taskId === tid && (
                                      <div
                                        style={{
                                          padding: '8px 12px',
                                          borderRadius: 8,
                                          fontSize: 12,
                                          background:
                                            taskSubmitNotice.type === 'success'
                                              ? 'rgba(0,232,154,0.12)'
                                              : 'rgba(255,85,102,0.12)',
                                          border:
                                            taskSubmitNotice.type === 'success'
                                              ? '1px solid rgba(0,232,154,0.35)'
                                              : '1px solid rgba(255,85,102,0.35)',
                                          color:
                                            taskSubmitNotice.type === 'success' ? 'var(--green)' : 'var(--red)',
                                        }}
                                      >
                                        {taskSubmitNotice.text}
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={taskSubmittingId === tid}
                                      onClick={() => handleSubmitOwmTaskProof(tid)}
                                      className="btn btn-primary btn-sm btn-full"
                                    >
                                      {taskSubmittingId === tid
                                        ? 'Submitting Proof...'
                                        : `Submit Proof & Claim +${rewardCoins.toLocaleString('en-IN')} Coins`}
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8 }}>
                                {task.url && !isExpanded && (
                                  <a
                                    href={task.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline btn-sm"
                                    style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                                  >
                                    Open Link ↗
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setExpandedTaskId(isExpanded ? null : tid)}
                                  className="btn btn-primary btn-sm"
                                  style={{ flex: 1 }}
                                >
                                  {isExpanded
                                    ? 'Hide Instructions'
                                    : `Start Mini-Task (+${rewardCoins.toLocaleString('en-IN')} Coins)`}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="card card-glow" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                        {tasksSubMode === 'timewall_tasks'
                          ? '⏱️ TimeWall — Extracted Mini-Tasks & Micro-Jobs (?tab=tasks)'
                          : tasksSubMode === 'owm_telegram'
                          ? '💬 Offerwall.me — Telegram Join Mini-Tasks (?tab=tasks&taskType=telegram)'
                          : tasksSubMode === 'owm_general'
                          ? '🌐 Offerwall.me — General Mini-Tasks (?tab=tasks)'
                          : '🚀 PubCrypto — Review Map & Mini-Tasks'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Directly extracted Mini-Tasks feed. Completed tasks credit via <code className="font-mono">lootify/api/postback</code>.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {tasksSubMode === 'pubcrypto' && (
                        <button
                          type="button"
                          onClick={() => refreshPubCryptoSignedUrl(user.id, true)}
                          className="btn btn-outline btn-sm"
                        >
                          Reload Session
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => syncUserWithBackend(user, true)}
                        className="btn btn-outline btn-sm"
                      >
                        Sync Balance
                      </button>
                      {(tasksSubMode === 'pubcrypto' || taskIframeUrl) && (
                        <a
                          href={
                            tasksSubMode === 'pubcrypto'
                              ? `${getApiBaseUrl()}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
                                  user.id
                                )}&theme=${encodeURIComponent(theme)}&redirect=1`
                              : taskIframeUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          ↗ Open Fullscreen
                        </a>
                      )}
                    </div>
                  </div>
                  {tasksSubMode === 'pubcrypto' && !taskIframeUrl ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--txt2)' }}>
                      Generating fresh PubCrypto session token...
                    </div>
                  ) : (
                    <iframe
                      key={`tasks_${tasksSubMode}_${user.id}_${tasksSubMode === 'pubcrypto' ? taskIframeUrl : 'owm'}`}
                      data-pubcrypto-offerwall={tasksSubMode === 'pubcrypto' ? true : undefined}
                      src={taskIframeUrl}
                      title="Mini Tasks Feed"
                      width="100%"
                      height={tasksSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 680}
                      frameBorder={0}
                      referrerPolicy={tasksSubMode === 'pubcrypto' ? 'no-referrer' : undefined}
                      allow="clipboard-write; fullscreen; popups"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: tasksSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 680,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: '#0B121E',
                      }}
                      sandbox={
                        tasksSubMode === 'pubcrypto'
                          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── TAB 6: VIDEO ADS (Single-Piece Video Ads + Offerwall.me Video Wall) ── */}
        {activeTab === 'youtube' && (() => {
          const baseOwmUrl =
            signedOfferwallMeUrl ||
            buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id);
          const videoIframeUrl = buildOfferwallMeTabUrl(baseOwmUrl, 'video');
          const videoPtcItems = owmFeed.ptc.filter(
            (item: any) => Number(item.type) === 2 || String(item.title || '').toLowerCase().includes('video') || String(item.title || '').toLowerCase().includes('youtube')
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(244,63,94,0.14)',
                      border: '1px solid rgba(244,63,94,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F43F5E',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="4" />
                      <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                      6. Video Ads — Watch Sponsored Videos &amp; YouTube Campaigns
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                      Watch sponsored video ads for Player ID{' '}
                      <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> • Postback: <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setYoutubeViewMode('cards')}
                    className="btn btn-sm"
                    style={{
                      background: youtubeViewMode === 'cards' ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                      border: youtubeViewMode === 'cards' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                      color: youtubeViewMode === 'cards' ? 'var(--green)' : 'var(--txt2)',
                    }}
                  >
                    ▶️ Video Ad Cards ({videoPtcItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setYoutubeViewMode('wall')}
                    className="btn btn-sm"
                    style={{
                      background: youtubeViewMode === 'wall' ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                      border: youtubeViewMode === 'wall' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                      color: youtubeViewMode === 'wall' ? 'var(--green)' : 'var(--txt2)',
                    }}
                  >
                    🌐 Offerwall.me Video Wall
                  </button>
                  <button
                    type="button"
                    onClick={() => syncUserWithBackend(user, true)}
                    className="btn btn-outline btn-sm"
                  >
                    Sync Earned Coins
                  </button>
                </div>
              </div>

              {youtubeViewMode === 'cards' ? (
                videoPtcItems.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
                    {videoPtcItems.map((vid: any, idx: number) => {
                      const rewardCoins = Number(vid.reward) || 0;
                      return (
                        <div key={idx} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                {vid.title}
                              </h3>
                              <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                                +{rewardCoins} Coins
                              </span>
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 6 }}>
                              {vid.description || `Watch video for ${vid.duration || 15}s to earn +${rewardCoins} Coins.`}
                            </p>
                          </div>
                          <a
                            href={vid.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm btn-full"
                            style={{ textAlign: 'center', textDecoration: 'none' }}
                          >
                            Watch Video ({vid.duration || 15}s) &amp; Earn ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                      No Single-Piece Video Campaigns Active Right Now
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--txt2)', maxWidth: 480 }}>
                      New video clips appear here automatically as soon as advertisers publish them, or you can open the Offerwall.me Video Wall directly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setYoutubeViewMode('wall')}
                      className="btn btn-primary btn-sm"
                    >
                      Open Offerwall.me Video Wall
                    </button>
                  </div>
                )
              ) : (
                <div className="card card-glow" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                        Offerwall.me — Video Campaigns Feed (<code className="font-mono">?tab=video</code>)
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Watch directly inside the Offerwall.me Video player below.
                      </p>
                    </div>
                    {videoIframeUrl && (
                      <a
                        href={videoIframeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        ↗ Open Fullscreen
                      </a>
                    )}
                  </div>
                  <iframe
                    key={`youtube_video_${user.id}`}
                    src={videoIframeUrl}
                    title="Video Ads"
                    width="100%"
                    height={620}
                    frameBorder={0}
                    allow="clipboard-write; fullscreen; popups; autoplay"
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 620,
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: '#0B121E',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 2. SURVEYS: ALL AVAILABLE SURVEYS (Single-Piece Routers + TimeWall Surveys + Offerwall.me Survey Wall) ── */}
        {activeTab === 'surveys' && (() => {
          const baseOwmUrl =
            signedOfferwallMeUrl ||
            buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id);
          const surveysIframeUrl = buildOfferwallMeTabUrl(baseOwmUrl, 'surveys');

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(16,185,129,0.14)',
                      border: '1px solid rgba(16,185,129,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10B981',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      <path d="M22 12A10 10 0 0 0 12 2v10z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                      2. Surveys — All Available Paid Surveys
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                      All research survey routers (CPX, BitLabs, TheoremReach, TimeWall Surveys &amp; Offerwall.me) for{' '}
                      <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> • Postback: <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSurveysViewMode('cards')}
                    className="btn btn-sm"
                    style={{
                      background: surveysViewMode === 'cards' ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                      border: surveysViewMode === 'cards' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                      color: surveysViewMode === 'cards' ? 'var(--green)' : 'var(--txt2)',
                    }}
                  >
                    📊 All Survey Cards ({owmFeed.surveys.length + 1})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveysViewMode('timewall')}
                    className="btn btn-sm"
                    style={{
                      background: surveysViewMode === 'timewall' ? 'rgba(56,189,248,0.16)' : 'var(--bg2)',
                      border: surveysViewMode === 'timewall' ? '1.5px solid #38BDF8' : '1px solid var(--border)',
                      color: surveysViewMode === 'timewall' ? '#38BDF8' : 'var(--txt2)',
                    }}
                  >
                    ⏱️ TimeWall Surveys
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveysViewMode('wall')}
                    className="btn btn-sm"
                    style={{
                      background: surveysViewMode === 'wall' ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                      border: surveysViewMode === 'wall' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                      color: surveysViewMode === 'wall' ? 'var(--green)' : 'var(--txt2)',
                    }}
                  >
                    🌐 Offerwall.me Survey Wall
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchOfferwallMeFeed(user.id, true)}
                    className="btn btn-outline btn-sm"
                  >
                    {owmFeedLoading ? 'Refreshing...' : 'Refresh Surveys'}
                  </button>
                </div>
              </div>

              {surveysViewMode === 'cards' ? (
                <>
                  {/* Extracted Inner Sub-Provider Survey Routers Banner */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div
                      className="card"
                      style={{
                        padding: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        background: 'var(--bg2)',
                        border: '1.5px solid rgba(56,189,248,0.4)',
                      }}
                    >
                      <div>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 5,
                            background: 'rgba(56,189,248,0.16)',
                            color: '#38BDF8',
                            fontWeight: 700,
                          }}
                        >
                          ⏱️ EXTRACTED INNER PROVIDER • PUBCRYPTO
                        </span>
                        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginTop: 6 }}>
                          TimeWall Paid Surveys Hub
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                          Direct extracted TimeWall survey router (`&amp;tab=surveys`) with high-paying daily studies.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSurveysViewMode('timewall')}
                        className="btn btn-primary btn-sm"
                        style={{ background: '#38BDF8', color: '#04120B', fontWeight: 700, flexShrink: 0 }}
                      >
                        Open TimeWall Surveys ↗
                      </button>
                    </div>

                    <div
                      className="card"
                      style={{
                        padding: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        background: 'var(--bg2)',
                        border: '1.5px solid rgba(0,232,154,0.35)',
                      }}
                    >
                      <div>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 5,
                            background: 'rgba(0,232,154,0.16)',
                            color: 'var(--green)',
                            fontWeight: 700,
                          }}
                        >
                          🌐 OFFERWALL.ME SURVEY ROUTER
                        </span>
                        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginTop: 6 }}>
                          Full Offerwall.me Survey Wall
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                          Access all live survey routers &amp; qualification bonuses in one embedded wall.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSurveysViewMode('wall')}
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0 }}
                      >
                        Open Survey Wall ↗
                      </button>
                    </div>
                  </div>

                  {owmFeedLoading && owmFeed.surveys.length === 0 ? (
                    <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                      Loading individual paid surveys from Offerwall.me API...
                    </div>
                  ) : owmFeed.surveys.length === 0 ? (
                    <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                      No individual surveys available right now. Switch to TimeWall Surveys or Offerwall.me Survey Wall above.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {owmFeed.surveys.slice(0, visibleSurveysCount).map((sv: any, idx: number) => {
                          const rewardCoins = Number(sv.reward) || 0;
                          const inrVal = ((rewardCoins * 90) / 100000).toFixed(2);
                          const cleanDesc = String(sv.description || '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                          return (
                            <div
                              key={sv.id || idx}
                              className="card"
                              style={{
                                padding: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 14,
                                border: '1px solid rgba(16,185,129,0.28)',
                                background: 'var(--bg2)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {sv.image ? (
                                      <img
                                        src={sv.image}
                                        alt={sv.title || sv.name}
                                        loading="lazy"
                                        decoding="async"
                                        style={{
                                          width: 46,
                                          height: 46,
                                          borderRadius: 10,
                                          objectFit: 'cover',
                                          border: '1px solid var(--border)',
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 46,
                                          height: 46,
                                          borderRadius: 10,
                                          background: 'rgba(16,185,129,0.14)',
                                          border: '1px solid rgba(16,185,129,0.32)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#10B981',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                                          <path d="M22 12A10 10 0 0 0 12 2v10z" />
                                        </svg>
                                      </div>
                                    )}
                                    <div>
                                      <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                        {sv.title || sv.name}
                                      </h3>
                                      <div className="font-mono" style={{ fontSize: 10.5, color: '#10B981', fontWeight: 700, marginTop: 3 }}>
                                        {String(sv.provider || 'SURVEY ROUTER').toUpperCase()} • {Array.isArray(sv.countries) ? sv.countries.join(', ') : 'GLOBAL'}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign: 'right',
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      background: 'rgba(0,232,154,0.1)',
                                      border: '1px solid rgba(0,232,154,0.3)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                                      +{rewardCoins.toLocaleString('en-IN')}
                                    </div>
                                    <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--txt2)' }}>
                                      COINS (₹{inrVal})
                                    </div>
                                  </div>
                                </div>

                                <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 10, lineHeight: 1.5 }}>
                                  {cleanDesc
                                    ? cleanDesc.length > 140
                                      ? cleanDesc.slice(0, 140) + '...'
                                      : cleanDesc
                                    : 'Complete this research survey router with honest answers to earn instant Coins.'}
                                </p>
                              </div>

                              <a
                                href={sv.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm btn-full"
                                style={{ textAlign: 'center', textDecoration: 'none' }}
                              >
                                Start Survey (+{rewardCoins.toLocaleString('en-IN')} Coins) ↗
                              </a>
                            </div>
                          );
                        })}
                      </div>
                      {owmFeed.surveys.length > visibleSurveysCount && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                          <button
                            type="button"
                            onClick={() => setVisibleSurveysCount((prev) => prev + 36)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '10px 22px' }}
                          >
                            Show More Surveys ({owmFeed.surveys.length - visibleSurveysCount} more available)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="card card-glow" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                        {surveysViewMode === 'timewall'
                          ? '⏱️ TimeWall — Paid Surveys (&tab=surveys)'
                          : '🌐 Offerwall.me — Full Survey Wall (?tab=surveys)'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Instant S2S Postback credit via <code className="font-mono">lootify/api/postback</code>
                      </p>
                    </div>
                    <a
                      href={
                        surveysViewMode === 'timewall'
                          ? `${pubCryptoNativeFeed.timewallBaseUrl}&tab=surveys`
                          : surveysIframeUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      ↗ Open Fullscreen
                    </a>
                  </div>
                  <iframe
                    key={`surveys_${surveysViewMode}_${user.id}`}
                    src={
                      surveysViewMode === 'timewall'
                        ? `${pubCryptoNativeFeed.timewallBaseUrl}&tab=surveys`
                        : surveysIframeUrl
                    }
                    title="Paid Surveys"
                    width="100%"
                    height={680}
                    frameBorder={0}
                    allow="clipboard-write; fullscreen; popups"
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 680,
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: '#0B121E',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 3. PTC: CONTAINS ALL WINDOW/IFRAME PTC, PUBCRYPTO PTC, TIMEWALL CLICKS & READ ARTICLES ── */}
        {activeTab === 'ptc' && (() => {
          const baseOwmUrl =
            signedOfferwallMeUrl ||
            buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id);
          const ptcIframeUrl =
            ptcSubMode === 'owm_iframe'
              ? buildOfferwallMeTabUrl(baseOwmUrl, 'iframe')
              : ptcSubMode === 'owm_window'
              ? buildOfferwallMeTabUrl(baseOwmUrl, 'window')
              : ptcSubMode === 'timewall_clicks'
              ? `${pubCryptoNativeFeed.timewallBaseUrl}&tab=clicks`
              : signedPubCryptoUrl;

          const owmPtcAds =
            Array.isArray(owmFeed.ptc) && owmFeed.ptc.length > 0
              ? owmFeed.ptc
              : personalizeOwmFeedForUser(INITIAL_OWM_FEED_SEED, user.id).ptc;

          const pcExtractedPtcAds = (pubCryptoNativeFeed.ptcCampaigns || []).map((c: any) => ({
            ...c,
            isPubCryptoNative: true,
            isArticleCampaign: false,
            reward: Number(c.reward) > 0 && Number(c.reward) < 1 ? Number((Number(c.reward) * 25).toFixed(2)) : Number(c.reward) || 0.5,
          }));

          const pcExtractedArticles = (pubCryptoNativeFeed.readArticleCampaigns || []).map((art: any) => ({
            ...art,
            isPubCryptoNative: true,
            isArticleCampaign: true,
            duration: Number(art.duration) || 15,
            reward: Number(art.reward) > 0 && Number(art.reward) < 1 ? Number((Number(art.reward) * 25).toFixed(2)) : Number(art.reward) || 1,
          }));

          const allPtcAds = [...pcExtractedArticles, ...pcExtractedPtcAds, ...owmPtcAds];

          const isWindowPtcAd = (ad: any) =>
            !ad?.isPubCryptoNative && (Number(ad?.type) === 1 || String(ad?.url || '').includes('/sw.php'));

          const windowCount = owmPtcAds.filter((ad: any) => isWindowPtcAd(ad)).length;
          const iframeCount = owmPtcAds.filter((ad: any) => !isWindowPtcAd(ad)).length;
          const articleCount = pcExtractedArticles.length;
          const pcPtcCount = pcExtractedPtcAds.length;

          const filteredPtcCards = allPtcAds.filter((ad: any) => {
            if (ptcCardTypeFilter === 'articles') return Boolean(ad?.isArticleCampaign);
            if (ptcCardTypeFilter === 'pubcrypto') return Boolean(ad?.isPubCryptoNative) && !ad?.isArticleCampaign;
            if (ptcCardTypeFilter === 'window') return !ad?.isPubCryptoNative && isWindowPtcAd(ad);
            if (ptcCardTypeFilter === 'iframe') return !ad?.isPubCryptoNative && !isWindowPtcAd(ad);
            return true;
          });

          const totalPtcCoins = Number(
            filteredPtcCards.reduce((sum: number, ad: any) => sum + (Number(ad.reward) || 0), 0).toFixed(2)
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(56,189,248,0.14)',
                      border: '1px solid rgba(56,189,248,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38BDF8',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                      3. PTC &amp; Read Articles — Window PTC, Iframe PTC &amp; Articles
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                      {allPtcAds.length} Live Items ({windowCount} Window PTC • {iframeCount} Iframe PTC • {articleCount} Read Articles • {pcPtcCount} PubCrypto PTC • +{totalPtcCoins} Coins) for{' '}
                      <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> • Postback: <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'cards', label: `All PTC & Articles (${allPtcAds.length})` },
                    { id: 'timewall_clicks', label: '⏱️ TimeWall Clicks' },
                    { id: 'pubcrypto', label: '🔥 PubCrypto PTC Wall' },
                    { id: 'owm_iframe', label: '🖼️ Iframe PTC Wall' },
                    { id: 'owm_window', label: '🪟 Window PTC Wall' },
                  ].map((mode) => {
                    const active = ptcSubMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setPtcSubMode(mode.id as any);
                        }}
                        className="btn btn-sm"
                        style={{
                          background: active ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                          border: active ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: active ? 'var(--green)' : 'var(--txt2)',
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      fetchOfferwallMeFeed(user.id, true);
                      fetchPubCryptoNativeFeed(user.id, true);
                      syncUserWithBackend(user, true);
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    {owmFeedLoading ? 'Refreshing...' : 'Refresh & Sync'}
                  </button>
                </div>
              </div>

              {ptcSubMode === 'cards' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Sub-filter for Single-Piece Window, Iframe, Read Articles & PubCrypto PTC Cards */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { id: 'all', label: `All PTC & Articles (${allPtcAds.length})` },
                        {
                          id: 'window',
                          label: `🪟 Window PTC (${windowCount})`,
                        },
                        {
                          id: 'iframe',
                          label: `🖼️ Iframe PTC (${iframeCount})`,
                        },
                        {
                          id: 'articles',
                          label: `📖 Read Articles (${articleCount})`,
                        },
                        {
                          id: 'pubcrypto',
                          label: `🚀 PubCrypto PTC (${pcPtcCount})`,
                        },
                      ].map((f) => {
                        const active = ptcCardTypeFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setPtcCardTypeFilter(f.id as any)}
                            className="font-mono"
                            style={{
                              padding: '7px 14px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: active ? 'rgba(56,189,248,0.16)' : 'var(--bg2)',
                              border: active ? '1.5px solid #38BDF8' : '1px solid var(--border)',
                              color: active ? '#38BDF8' : 'var(--txt2)',
                            }}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                      Tagged: <strong>WINDOW PTC</strong> • <strong>IFRAME PTC</strong> • <strong>READ ARTICLE</strong> • <strong>PUBCRYPTO PTC</strong>
                    </span>
                  </div>

                  {filteredPtcCards.length === 0 ? (
                    <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                      No PTC ads or articles in this filter right now. Try switching filter above.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
                      {filteredPtcCards.map((ad: any, idx: number) => {
                        const rewardCoins = Number(ad.reward) || 0;
                        const durationSec = Number(ad.duration) || 5;
                        const isPcNative = Boolean(ad?.isPubCryptoNative);
                        const isArticle = Boolean(ad?.isArticleCampaign);
                        const isWindow = isWindowPtcAd(ad);
                        const personalizedHref = isPcNative ? '#' : personalizeOwmItemUrl(ad.url, user.id);
                        return (
                          <div
                            key={`${ad.id || ad.title}_${idx}`}
                            className="card"
                            style={{
                              padding: 20,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 14,
                              border: isArticle
                                ? '1.5px solid rgba(245,158,11,0.45)'
                                : isPcNative
                                  ? '1.5px solid rgba(139,92,246,0.45)'
                                  : isWindow
                                    ? '1.5px solid rgba(56,189,248,0.38)'
                                    : '1.5px solid rgba(0,232,154,0.35)',
                              background: 'var(--bg2)',
                            }}
                          >
                            <div>
                              {/* Prominent Top Tag Bar: WINDOW PTC vs IFRAME PTC vs READ ARTICLE vs PUBCRYPTO PTC */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  marginBottom: 10,
                                  paddingBottom: 10,
                                  borderBottom: '1px solid var(--border)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span
                                    className="font-mono"
                                    style={{
                                      fontSize: 11,
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                      background: isArticle
                                        ? 'rgba(245,158,11,0.18)'
                                        : isPcNative
                                          ? 'rgba(139,92,246,0.2)'
                                          : isWindow
                                            ? 'rgba(56,189,248,0.18)'
                                            : 'rgba(0,232,154,0.18)',
                                      border: isArticle
                                        ? '1px solid rgba(245,158,11,0.48)'
                                        : isPcNative
                                          ? '1px solid rgba(139,92,246,0.5)'
                                          : isWindow
                                            ? '1px solid rgba(56,189,248,0.45)'
                                            : '1px solid rgba(0,232,154,0.45)',
                                      color: isArticle
                                        ? '#FBBF24'
                                        : isPcNative
                                          ? '#C4B5FD'
                                          : isWindow
                                            ? '#38BDF8'
                                            : 'var(--green)',
                                      fontWeight: 700,
                                      letterSpacing: '0.03em',
                                    }}
                                  >
                                    {isArticle
                                      ? `📖 ${ad.sourceLabel || 'READ ARTICLE'}`
                                      : isPcNative
                                        ? `🚀 ${ad.sourceLabel || 'PUBCRYPTO PTC'}`
                                        : isWindow
                                          ? '🪟 WINDOW PTC'
                                          : '🖼️ IFRAME PTC'}
                                  </span>
                                  <span
                                    className="font-mono"
                                    style={{
                                      fontSize: 10.5,
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      background: 'rgba(245,158,11,0.15)',
                                      border: '1px solid rgba(245,158,11,0.32)',
                                      color: '#F59E0B',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ⏱️ {durationSec}s
                                  </span>
                                  {(() => {
                                    const st = getOwmCardLiveStatus(
                                      isPcNative ? `pc_camp_${ad.id || ad.campaign_token}` : `ptc_${ad.title}_${idx}`,
                                      ad.title
                                    );
                                    if (!st) return null;
                                    return (
                                      <span
                                        className="font-mono"
                                        style={{
                                          fontSize: 10,
                                          padding: '3px 7px',
                                          borderRadius: 5,
                                          background: st.bg,
                                          color: st.color,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {st.label}
                                      </span>
                                    );
                                  })()}
                                </div>

                                <div
                                  style={{
                                    textAlign: 'right',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    background: 'rgba(0,232,154,0.12)',
                                    border: '1px solid rgba(0,232,154,0.32)',
                                    flexShrink: 0,
                                  }}
                                >
                                  <span className="font-mono" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--green)' }}>
                                    +{rewardCoins} Coins
                                  </span>
                                </div>
                              </div>

                              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                {ad.title}
                              </h3>

                              {ad.description ? (
                                <p style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 6, lineHeight: 1.5 }}>
                                  {ad.description}
                                </p>
                              ) : isArticle ? (
                                <p style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 6, lineHeight: 1.5 }}>
                                  Read this sponsored article for {durationSec} seconds to earn instant Coins.
                                </p>
                              ) : null}
                            </div>

                            {isPcNative ? (
                              <button
                                type="button"
                                onClick={() => handleLaunchPubCryptoCampaign(ad)}
                                className="btn btn-primary btn-sm btn-full"
                                style={{
                                  background: isArticle
                                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                                    : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                                  color: isArticle ? '#04120B' : '#FFFFFF',
                                  fontWeight: 700,
                                }}
                              >
                                {pubCryptoLaunchingId === `pc_camp_${ad.id || ad.campaign_token}`
                                  ? isArticle
                                    ? 'Opening Article...'
                                    : 'Opening PubCrypto Ad...'
                                  : isArticle
                                    ? `Read Article (${durationSec}s) • +${rewardCoins} Coins ↗`
                                    : `Open PubCrypto PTC (${durationSec}s) • +${rewardCoins} Coins ↗`}
                              </button>
                            ) : (
                              <a
                                href={personalizedHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markOwmItemClicked(`ptc_${ad.title}_${idx}`)}
                                className="btn btn-primary btn-sm btn-full"
                                style={{
                                  textAlign: 'center',
                                  textDecoration: 'none',
                                  background: isWindow ? '#38BDF8' : 'var(--green)',
                                  color: '#03100A',
                                  fontWeight: 700,
                                }}
                              >
                                {owmClickedIds[`ptc_${ad.title}_${idx}`]
                                  ? `Re-open ${isWindow ? 'Window PTC' : 'Iframe PTC'} (${durationSec}s) • Auto-Syncing ↗`
                                  : `Open ${isWindow ? 'Window PTC' : 'Iframe PTC'} (${durationSec}s) • +${rewardCoins} Coins ↗`}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="card card-glow" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                        {ptcSubMode === 'owm_iframe'
                          ? 'Offerwall.me — Iframe PTC Ads (?tab=iframe)'
                          : ptcSubMode === 'owm_window'
                          ? 'Offerwall.me — Window PTC Ads (?tab=window)'
                          : ptcSubMode === 'timewall_clicks'
                          ? '⏱️ TimeWall — PTC Clicks (&tab=clicks)'
                          : 'PubCrypto — PTC & Articles Wall'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Opens directly on the selected PTC section. Every completed view credits automatically via <code className="font-mono">lootify/api/postback</code>.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ptcSubMode === 'pubcrypto' && (
                        <button
                          type="button"
                          onClick={() => refreshPubCryptoSignedUrl(user.id, true)}
                          className="btn btn-outline btn-sm"
                        >
                          Reload Session
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => syncUserWithBackend(user, true)}
                        className="btn btn-outline btn-sm"
                      >
                        Sync Balance
                      </button>
                      {(ptcSubMode === 'pubcrypto' || ptcIframeUrl) && (
                        <a
                          href={
                            ptcSubMode === 'pubcrypto'
                              ? `${getApiBaseUrl()}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
                                  user.id
                                )}&theme=${encodeURIComponent(theme)}&redirect=1`
                              : ptcIframeUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          ↗ Open Fullscreen
                        </a>
                      )}
                    </div>
                  </div>
                  {ptcSubMode === 'pubcrypto' && !ptcIframeUrl ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--txt2)' }}>
                      Generating fresh PubCrypto session token...
                    </div>
                  ) : (
                    <iframe
                      key={`ptc_${ptcSubMode}_${user.id}_${ptcSubMode === 'pubcrypto' ? ptcIframeUrl : 'owm'}`}
                      data-pubcrypto-offerwall={ptcSubMode === 'pubcrypto' ? true : undefined}
                      src={ptcIframeUrl}
                      title="PTC Ads Wall"
                      width="100%"
                      height={ptcSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 680}
                      frameBorder={0}
                      referrerPolicy={ptcSubMode === 'pubcrypto' ? 'no-referrer' : undefined}
                      allow="clipboard-write; fullscreen; popups"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: ptcSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 680,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: '#0B121E',
                      }}
                      sandbox={
                        ptcSubMode === 'pubcrypto'
                          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 1. OFFER TASKS: ALL APP/WEB REGISTER, DOWNLOAD, GAME & PARTNER OFFERS COMBINED ── */}
        {(activeTab === 'quests' || activeTab === 'offerwalls') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(139,92,246,0.14)',
                    border: '1px solid rgba(139,92,246,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#A78BFA',
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="4" />
                    <path d="M6 12h4" />
                    <path d="M8 10v4" />
                    <circle cx="15" cy="11" r="1" fill="currentColor" />
                    <circle cx="17" cy="13" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                    1. Offer Tasks — All App, Web, Register, Download &amp; Game Offers
                  </h2>
                  <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                    All providers &amp; extracted inner sub-providers (Offerwall.me, TimeWall Offers, TimeWall Games, BitcoTasks, PubCrypto) for{' '}
                    <span className="font-mono" style={{ color: 'var(--green)' }}>
                      {user.id}
                    </span>{' '}
                    • Postback: <code className="font-mono">lootify/api/postback</code>
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setOffersViewMode('cards')}
                  className="btn btn-sm"
                  style={{
                    background: offersViewMode === 'cards' ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                    border: offersViewMode === 'cards' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                    color: offersViewMode === 'cards' ? 'var(--green)' : 'var(--txt2)',
                  }}
                >
                  🎯 All Offer Tasks ({owmFeed.offers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOffersViewMode('timewall_offers')}
                  className="btn btn-sm"
                  style={{
                    background: offersViewMode === 'timewall_offers' ? 'rgba(56,189,248,0.16)' : 'var(--bg2)',
                    border: offersViewMode === 'timewall_offers' ? '1.5px solid #38BDF8' : '1px solid var(--border)',
                    color: offersViewMode === 'timewall_offers' ? '#38BDF8' : 'var(--txt2)',
                  }}
                >
                  ⏱️ TimeWall Offers
                </button>
                <button
                  type="button"
                  onClick={() => setOffersViewMode('timewall_games')}
                  className="btn btn-sm"
                  style={{
                    background: offersViewMode === 'timewall_games' ? 'rgba(139,92,246,0.18)' : 'var(--bg2)',
                    border: offersViewMode === 'timewall_games' ? '1.5px solid #A78BFA' : '1px solid var(--border)',
                    color: offersViewMode === 'timewall_games' ? '#C4B5FD' : 'var(--txt2)',
                  }}
                >
                  🎮 TimeWall Games
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOffersViewMode('walls');
                    setSelectedWallId('pubcrypto');
                  }}
                  className="btn btn-sm"
                  style={{
                    background:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'pubcrypto'
                        ? 'rgba(0,232,154,0.16)'
                        : 'var(--bg2)',
                    border:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'pubcrypto'
                        ? '1.5px solid var(--green)'
                        : '1px solid var(--border)',
                    color:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'pubcrypto'
                        ? 'var(--green)'
                        : 'var(--txt2)',
                  }}
                >
                  🔥 PubCrypto Wall
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOffersViewMode('walls');
                    setSelectedWallId('offerwallme');
                  }}
                  className="btn btn-sm"
                  style={{
                    background:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'offerwallme'
                        ? 'rgba(0,232,154,0.16)'
                        : 'var(--bg2)',
                    border:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'offerwallme'
                        ? '1.5px solid var(--green)'
                        : '1px solid var(--border)',
                    color:
                      offersViewMode === 'walls' && selectedWall?.provider_id === 'offerwallme'
                        ? 'var(--green)'
                        : 'var(--txt2)',
                  }}
                >
                  🌐 Offerwall.me Wall
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fetchOfferwallMeFeed(user.id, true);
                    fetchPubCryptoNativeFeed(user.id, true);
                    syncUserWithBackend(user, true);
                  }}
                  className="btn btn-outline btn-sm"
                >
                  {owmFeedLoading ? 'Refreshing...' : 'Refresh & Sync'}
                </button>
              </div>
            </div>

            {/* Extracted Sub-Provider Offer Hubs (TimeWall Offers, TimeWall Games, BitcoTasks, Partner Walls) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              <button
                type="button"
                onClick={() => setOffersViewMode('timewall_offers')}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: offersViewMode === 'timewall_offers' ? 'rgba(56,189,248,0.14)' : 'var(--bg2)',
                  border: offersViewMode === 'timewall_offers' ? '1.5px solid #38BDF8' : '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                    ⏱️ TimeWall Offers
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(56,189,248,0.18)', color: '#38BDF8', fontWeight: 700 }}>
                    INNER WALL ↗
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                  App Installs, Signups &amp; Web Registrations
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOffersViewMode('timewall_games')}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: offersViewMode === 'timewall_games' ? 'rgba(139,92,246,0.16)' : 'var(--bg2)',
                  border: offersViewMode === 'timewall_games' ? '1.5px solid #A78BFA' : '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                    🎮 TimeWall Games
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(139,92,246,0.2)', color: '#C4B5FD', fontWeight: 700 }}>
                    PLAY &amp; EARN ↗
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                  Mobile &amp; Desktop Game Milestone Quests
                </div>
              </button>

              <a
                href={(pubCryptoNativeFeed as any).bitcotasksWallUrl || `https://bitcotasks.com/offerwall/6l99v24r10v1c46d40x1p1601k9536/${encodeURIComponent(user.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                    ⚡ BitcoTasks Full Wall
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,158,11,0.16)', color: '#F59E0B', fontWeight: 700 }}>
                    DIRECT ↗
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                  Extracted BitcoTasks Offerwall &amp; Lead Tasks
                </div>
              </a>

              {enabledOfferwalls.map((wall) => {
                const isSelected = offersViewMode === 'walls' && selectedWall?.provider_id === wall.provider_id;
                return (
                  <button
                    key={`top_wall_${wall.provider_id}`}
                    type="button"
                    onClick={() => {
                      setOffersViewMode('walls');
                      setSelectedWallId(wall.provider_id);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0,232,154,0.12)' : 'var(--bg2)',
                      border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                        {wall.provider_id === 'pubcrypto' ? '🔥 PubCrypto Offerwall' : `🌐 ${wall.name}`}
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 5,
                          background: isSelected ? 'var(--green)' : 'rgba(0,232,154,0.15)',
                          color: isSelected ? '#04120B' : 'var(--green)',
                          fontWeight: 700,
                        }}
                      >
                        {isSelected ? 'OPENING BELOW' : 'OPEN WALL ↗'}
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                      {wall.badge}
                    </div>
                  </button>
                );
              })}
            </div>

            {offersViewMode === 'timewall_offers' || offersViewMode === 'timewall_games' ? (
              <div className="card card-glow" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                      {offersViewMode === 'timewall_games'
                        ? '🎮 TimeWall — Game Offer Tasks (&tab=games)'
                        : '⏱️ TimeWall — App & Web Offer Tasks (&tab=featured)'}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                      Extracted inner provider from PubCrypto • Instant S2S Postback credit via <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => syncUserWithBackend(user, true)}
                      className="btn btn-outline btn-sm"
                    >
                      Sync Balance
                    </button>
                    <a
                      href={`${pubCryptoNativeFeed.timewallBaseUrl}&tab=${offersViewMode === 'timewall_games' ? 'games' : 'featured'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      ↗ Open Fullscreen
                    </a>
                  </div>
                </div>
                <iframe
                  key={`tw_${offersViewMode}_${user.id}`}
                  src={`${pubCryptoNativeFeed.timewallBaseUrl}&tab=${offersViewMode === 'timewall_games' ? 'games' : 'featured'}`}
                  title={offersViewMode === 'timewall_games' ? 'TimeWall Games' : 'TimeWall Offers'}
                  width="100%"
                  height={680}
                  frameBorder={0}
                  allow="clipboard-write; fullscreen; popups"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 680,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: '#0B121E',
                  }}
                />
              </div>
            ) : offersViewMode === 'cards' ? (
              owmFeedLoading && owmFeed.offers.length === 0 ? (
                <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                  Loading individual App, Web &amp; Game offers from Offerwall.me API...
                </div>
              ) : owmFeed.offers.length === 0 ? (
                <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--txt2)' }}>
                  No individual offers found right now. Switch to TimeWall Offers, TimeWall Games, or Full Partner Offerwalls above.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
                    {owmFeed.offers.slice(0, visibleOffersCount).map((offer: any, idx: number) => {
                      const rewardCoins = Number(offer.reward) || 0;
                      const inrVal = ((rewardCoins * 90) / 100000).toFixed(2);
                      const cleanDesc = String(offer.description || '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                      const imgSrc = offer.icon || offer.image || '';
                      return (
                        <div
                          key={offer.id || idx}
                          className="card"
                          style={{
                            padding: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 14,
                            border: '1px solid rgba(139,92,246,0.28)',
                            background: 'var(--bg2)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={offer.title || offer.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: 12,
                                      objectFit: 'cover',
                                      border: '1px solid var(--border)',
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: 12,
                                      background: 'rgba(139,92,246,0.14)',
                                      border: '1px solid rgba(139,92,246,0.32)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#A78BFA',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="2" y="6" width="20" height="12" rx="4" />
                                      <path d="M6 12h4" />
                                      <path d="M8 10v4" />
                                    </svg>
                                  </div>
                                )}
                                <div>
                                  <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                                    {offer.title || offer.name}
                                  </h3>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                    <span
                                      className="font-mono"
                                      style={{
                                        fontSize: 10,
                                        padding: '2px 7px',
                                        borderRadius: 5,
                                        background: 'rgba(139,92,246,0.15)',
                                        color: '#A78BFA',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {String(offer.provider || 'OFFER TASK').toUpperCase()}
                                    </span>
                                    {Array.isArray(offer.devices) && offer.devices.length > 0 && (
                                      <span
                                        className="font-mono"
                                        style={{
                                          fontSize: 10,
                                          padding: '2px 7px',
                                          borderRadius: 5,
                                          background: 'rgba(56,189,248,0.14)',
                                          color: '#38BDF8',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {offer.devices.join(' / ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  textAlign: 'right',
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  background: 'rgba(0,232,154,0.1)',
                                  border: '1px solid rgba(0,232,154,0.3)',
                                  flexShrink: 0,
                                }}
                              >
                                <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                                  +{rewardCoins.toLocaleString('en-IN')}
                                </div>
                                <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--txt2)' }}>
                                  COINS (₹{inrVal})
                                </div>
                              </div>
                            </div>

                            <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 10, lineHeight: 1.5 }}>
                              {cleanDesc
                                ? cleanDesc.length > 150
                                  ? cleanDesc.slice(0, 150) + '...'
                                  : cleanDesc
                                : 'Complete the app/web registration or download requirements to earn instant Coins.'}
                            </p>

                            {Array.isArray(offer.steps) && offer.steps.length > 1 && (
                              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {offer.steps.slice(0, 3).map((st: any, sIdx: number) => (
                                  <div
                                    key={st.id || sIdx}
                                    className="font-mono"
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: 11,
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      background: 'var(--bg3)',
                                      color: 'var(--txt2)',
                                    }}
                                  >
                                    <span>{st.label}</span>
                                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{st.reward}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <a
                            href={offer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm btn-full"
                            style={{ textAlign: 'center', textDecoration: 'none' }}
                          >
                            Start Offer Task (+{rewardCoins.toLocaleString('en-IN')} Coins) ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  {owmFeed.offers.length > visibleOffersCount && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => setVisibleOffersCount((prev) => prev + 36)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '10px 22px' }}
                      >
                        Show More Offer Tasks ({owmFeed.offers.length - visibleOffersCount} more available)
                      </button>
                    </div>
                  )}
                </>
              )
            ) : enabledOfferwalls.length === 0 ? (
              <div
                className="card card-glow"
                style={{
                  padding: '56px 24px',
                  textAlign: 'center',
                }}
              >
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Partner Offerwalls Integrating Soon
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', maxWidth: 500, margin: '0 auto 20px', lineHeight: 1.7 }}>
                  Our S2S Postback Engine is live and ready. As soon as partner offerwalls are added in the Admin Panel, they will appear here automatically.
                </p>
              </div>
            ) : (
              <>
                {selectedWall && (
                  <div className="card card-glow" style={{ padding: 24 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginBottom: 16,
                        paddingBottom: 14,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                          {selectedWall.name} Offerwall
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                          {selectedWall.hold_days > 0
                            ? `Rewards go through a ${selectedWall.hold_days}-day anti-fraud hold (auto-releases on network settlement)`
                            : 'Instant S2S Postback credit to Available Balance'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {selectedWall.provider_id === 'pubcrypto' && (
                          <button
                            type="button"
                            onClick={() => refreshPubCryptoSignedUrl(user.id, true)}
                            className="btn btn-outline btn-sm"
                          >
                            Reload Session
                          </button>
                        )}
                        {(selectedWall.provider_id === 'pubcrypto' || resolvedIframeUrl) && (
                          <a
                            href={
                              selectedWall.provider_id === 'pubcrypto'
                                ? `${getApiBaseUrl()}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
                                    user.id
                                  )}&theme=${encodeURIComponent(theme)}&redirect=1`
                                : resolvedIframeUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            ↗ Open Fullscreen in New Tab
                          </a>
                        )}
                      </div>
                    </div>

                    {selectedWall.provider_id === 'pubcrypto' && !resolvedIframeUrl ? (
                      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--txt2)' }}>
                        Generating fresh PubCrypto session token...
                      </div>
                    ) : resolvedIframeUrl ? (
                      <iframe
                        key={`${selectedWall.provider_id}_${user.id}_${selectedWall.provider_id === 'pubcrypto' ? resolvedIframeUrl : 'offers'}`}
                        data-pubcrypto-offerwall={selectedWall.provider_id === 'pubcrypto' ? true : undefined}
                        src={
                          selectedWall.provider_id === 'offerwallme'
                            ? buildOfferwallMeTabUrl(resolvedIframeUrl, 'offers')
                            : resolvedIframeUrl
                        }
                        title={selectedWall.name}
                        width="100%"
                        height={selectedWall.provider_id === 'pubcrypto' ? pubCryptoIframeHeight : 680}
                        frameBorder={0}
                        referrerPolicy={selectedWall.provider_id === 'pubcrypto' ? 'no-referrer' : undefined}
                        allow="clipboard-write; fullscreen; popups"
                        style={{
                          display: 'block',
                          width: '100%',
                          maxWidth: '100%',
                          height: selectedWall.provider_id === 'pubcrypto' ? pubCryptoIframeHeight : 680,
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          background: '#0B121E',
                        }}
                        sandbox={
                          selectedWall.provider_id === 'pubcrypto'
                            ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
                            : undefined
                        }
                      />
                    ) : null}
                  </div>
                )}
              </>
            )}

            {/* Live Completed Offerwall Tasks History */}
            <div className="card" style={{ padding: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                    Completed Offer Tasks — Live History
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                    Every task completed for Player ID <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> logs here automatically.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                    {user.heldRewards?.length || 0} Tasks Logged
                  </span>
                  <button
                    type="button"
                    onClick={() => syncUserWithBackend(user, true)}
                    className="btn btn-outline btn-sm"
                  >
                    🔄 Sync History
                  </button>
                </div>
              </div>

              {!user.heldRewards || user.heldRewards.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'var(--bg2)',
                    border: '1px dashed var(--border2)',
                    borderRadius: 12,
                  }}
                >
                  <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                    No offer tasks logged yet for Player ID {user.id}. Complete any offer, survey, PTC ad, or shortlink!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {user.heldRewards.slice(0, 20).map((item) => {
                    const isHeld = item.status === 'pending_hold';
                    return (
                      <div
                        key={`quest_hist_${item.id}`}
                        style={{
                          padding: '12px 14px',
                          background: 'var(--bg2)',
                          border: isHeld
                            ? '1px solid rgba(255,180,0,0.28)'
                            : '1px solid rgba(0,232,154,0.22)',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                            {item.title}
                          </div>
                          <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                            Earned: {formatIstDate(item.createdAt)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isHeld ? 'var(--gold)' : 'var(--green)',
                            }}
                          >
                            +{item.coins} Coins (₹{item.amountInr})
                          </span>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 10,
                              padding: '3px 7px',
                              borderRadius: 6,
                              background: isHeld
                                ? 'rgba(255,180,0,0.12)'
                                : 'rgba(0,232,154,0.12)',
                              color: isHeld ? 'var(--gold)' : 'var(--green)',
                              fontWeight: 700,
                            }}
                          >
                            {isHeld ? '⏳ ON HOLD' : '✅ CREDITED'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 7. SHORT LINKS: HAMARI ADDED SHORTLINKS + PUBCRYPTO / BITCOTASK / OFFERWALL.ME SHORTLINKS ── */}
        {activeTab === 'shortlinks' && (() => {
          const enabledCustomShortlinks = shortlinks.filter((s) => s.enabled);
          const totalShortlinksCount =
            enabledCustomShortlinks.length +
            pubCryptoNativeFeed.linkTasks.length +
            pubCryptoNativeFeed.shortlinkCampaigns.length +
            owmFeed.shortlinks.length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(0,232,154,0.14)',
                      border: '1px solid rgba(0,232,154,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--green)',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                      7. Short Links — Hamari Added &amp; Partner Providers ({totalShortlinksCount})
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginTop: 2 }}>
                      Lootify Custom Shortlinks + PubCrypto Link + BitcoTask + Offerwall.me for{' '}
                      <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> • Instant S2S credit via{' '}
                      <code className="font-mono">lootify/api/postback</code>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    {
                      id: 'cards',
                      label: `🔗 All Shortlink Cards (${totalShortlinksCount})`,
                    },
                    { id: 'pubcrypto', label: '🔥 PubCrypto Shortlinks Wall' },
                    { id: 'owm_wall', label: '🌐 Offerwall.me Shortlinks Wall' },
                  ].map((mode) => {
                    const active = shortlinksSubMode === mode.id && !showPartnerShortlinksWall;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setShowPartnerShortlinksWall(false);
                          setShortlinksSubMode(mode.id as any);
                        }}
                        className="btn btn-sm"
                        style={{
                          background: active ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                          border: active ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: active ? 'var(--green)' : 'var(--txt2)',
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      fetchOfferwallMeFeed(user.id, true);
                      fetchPubCryptoNativeFeed(user.id, true);
                      syncUserWithBackend(user, true);
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    {owmFeedLoading ? 'Refreshing...' : 'Refresh & Sync'}
                  </button>
                </div>
              </div>

              {shortlinkStatusMsg && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background:
                      shortlinkStatusMsg.type === 'error'
                        ? 'rgba(255,85,102,0.12)'
                        : 'rgba(0,232,154,0.14)',
                    border:
                      shortlinkStatusMsg.type === 'error'
                        ? '1px solid rgba(255,85,102,0.35)'
                        : '1px solid rgba(0,232,154,0.38)',
                    color: shortlinkStatusMsg.type === 'error' ? 'var(--red)' : 'var(--green)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {shortlinkStatusMsg.text}
                </div>
              )}

              {pubCryptoLaunchNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: '#F59E0B',
                    fontSize: 12.5,
                  }}
                >
                  ⚡ {pubCryptoLaunchNotice}
                </div>
              )}

              {/* Source Filter Pills for Shortlinks */}
              {shortlinksSubMode === 'cards' && !showPartnerShortlinksWall && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: `All Shortlinks (${totalShortlinksCount})` },
                      { id: 'custom', label: `⭐ Hamari Added Shortlinks (${enabledCustomShortlinks.length})` },
                      {
                        id: 'pubcrypto',
                        label: `🚀 PubCrypto & BitcoTask (${pubCryptoNativeFeed.linkTasks.length + pubCryptoNativeFeed.shortlinkCampaigns.length})`,
                      },
                      { id: 'offerwallme', label: `🌐 Offerwall.me (${owmFeed.shortlinks.length})` },
                    ].map((sf) => {
                      const active = shortlinkSourceFilter === sf.id;
                      return (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => setShortlinkSourceFilter(sf.id as any)}
                          className="font-mono"
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: active ? 'rgba(0,232,154,0.16)' : 'var(--bg2)',
                            border: active ? '1.5px solid var(--green)' : '1px solid var(--border)',
                            color: active ? 'var(--green)' : 'var(--txt2)',
                          }}
                        >
                          {sf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 7A: HAMARI ADDED SHORTLINKS (LOOTIFY CUSTOM SHORTLINKS) ── */}
              {shortlinksSubMode === 'cards' &&
                !showPartnerShortlinksWall &&
                (shortlinkSourceFilter === 'all' || shortlinkSourceFilter === 'custom') &&
                enabledCustomShortlinks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'rgba(0,232,154,0.18)',
                            border: '1px solid rgba(0,232,154,0.45)',
                            color: 'var(--green)',
                            fontWeight: 700,
                          }}
                        >
                          ⭐ HAMARI ADDED SHORTLINKS (LOOTIFY CUSTOM)
                        </span>
                        <span className="font-mono" style={{ fontSize: 12, color: 'var(--txt2)' }}>
                          Complete link &amp; return to claim instant Coins
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 14 }}>
                      {enabledCustomShortlinks.map((sl) => {
                        const maxDaily = Math.max(1, Number(sl.daily_limit) || 1);
                        const claimedCount = Math.max(0, Number(sl.claims_today) || 0);
                        const remClaims = Math.max(0, maxDaily - claimedCount);
                        const pct = Math.min(100, Math.round((claimedCount / maxDaily) * 100));
                        const isActiveVisit = activeShortlinkId === sl.id;
                        const minSec = Number(sl.timer_seconds) || 12;
                        const canVerify = isActiveVisit && shortlinkReadyToClaim && shortlinkTimerSecs <= 0;
                        const destUrl = resolveShortlinkDestinationUrl(sl, user.id);

                        return (
                          <div
                            key={sl.id}
                            className="card"
                            style={{
                              padding: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                              background: 'var(--bg2)',
                              border: remClaims > 0 ? '1.5px solid rgba(0,232,154,0.42)' : '1px solid var(--border)',
                              opacity: remClaims > 0 ? 1 : 0.65,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div>
                                  <span
                                    className="font-mono"
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 7px',
                                      borderRadius: 5,
                                      background: 'rgba(0,232,154,0.15)',
                                      color: 'var(--green)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ⭐ LOOTIFY CUSTOM • {sl.badge || sl.provider}
                                  </span>
                                  <div className="font-display" style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--txt)', marginTop: 6 }}>
                                    {sl.name}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 2 }}>
                                    ⏱️ Wait {minSec}s • {remClaims}/{maxDaily} Left Today
                                  </div>
                                </div>
                                <div
                                  style={{
                                    textAlign: 'right',
                                    padding: '4px 8px',
                                    borderRadius: 7,
                                    background: 'rgba(0,232,154,0.12)',
                                    border: '1px solid rgba(0,232,154,0.32)',
                                  }}
                                >
                                  <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                                    +{sl.reward_coins}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 9, color: 'var(--txt2)' }}>
                                    COINS
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                                  <span className="font-mono" style={{ color: 'var(--txt2)' }}>Daily Progress</span>
                                  <span className="font-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>
                                    {remClaims} / {maxDaily} Left
                                  </span>
                                </div>
                                <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, var(--green), #059669)',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {remClaims <= 0 ? (
                              <button type="button" disabled className="btn btn-outline btn-sm btn-full" style={{ opacity: 0.6 }}>
                                Daily Limit Completed
                              </button>
                            ) : isActiveVisit ? (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  disabled={shortlinkClaiming}
                                  onClick={() => handleVerifyAndClaimShortlink(sl)}
                                  className="btn btn-primary btn-sm btn-full"
                                  style={{
                                    background: canVerify ? 'var(--green)' : 'rgba(245,158,11,0.2)',
                                    color: canVerify ? '#04120B' : '#F59E0B',
                                    border: canVerify ? 'none' : '1px solid rgba(245,158,11,0.4)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {shortlinkClaiming
                                    ? 'Claiming...'
                                    : canVerify
                                      ? `✅ Claim +${sl.reward_coins} Coins`
                                      : `⏳ Complete Link (${shortlinkTimerSecs}s)...`}
                                </button>
                              </div>
                            ) : (
                              <a
                                href={destUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleStartShortlinkVisit(sl)}
                                className="btn btn-primary btn-sm btn-full"
                                style={{ textAlign: 'center', textDecoration: 'none', fontWeight: 700 }}
                              >
                                Visit Shortlink (+{sl.reward_coins} Coins) ↗
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* ── 7B: EXTRACTED SINGLE-PIECE PUBCRYPTO LINK & BITCOTASK SHORTLINKS ── */}
              {shortlinksSubMode === 'cards' &&
                !showPartnerShortlinksWall &&
                (shortlinkSourceFilter === 'all' || shortlinkSourceFilter === 'pubcrypto') &&
                (pubCryptoNativeFeed.linkTasks.length > 0 || pubCryptoNativeFeed.shortlinkCampaigns.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'rgba(139,92,246,0.2)',
                            border: '1px solid rgba(139,92,246,0.45)',
                            color: '#C4B5FD',
                            fontWeight: 700,
                          }}
                        >
                          🚀 PUBCRYPTO &amp; BITCOTASK SHORTLINKS
                        </span>
                        <span className="font-mono" style={{ fontSize: 12, color: 'var(--txt2)' }}>
                          Direct 1-Click Launch • No Iframe Required
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 14 }}>
                      {pubCryptoNativeFeed.linkTasks.map((ptask: any, idx: number) => {
                        const maxViews = Math.max(1, Number(ptask.total_max) || 1);
                        const usedViews = Math.max(0, Number(ptask.used_in_cycle ?? ptask.completed_in_cycle ?? ptask.done_today) || 0);
                        const remViews =
                          ptask.remaining_in_cycle !== undefined
                            ? Math.max(0, Number(ptask.remaining_in_cycle))
                            : Math.max(0, maxViews - usedViews);
                        const pct = Math.min(100, Math.round(((maxViews - remViews) / maxViews) * 100));
                        const rewardCoins = Number(ptask.member_reward) || 40;
                        const cooldownSec = Number(ptask.cooldown_seconds) || 0;
                        const cardKey = `pc_link_${ptask.id || idx}`;
                        return (
                          <div
                            key={cardKey}
                            className="card"
                            style={{
                              padding: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                              background: 'var(--bg2)',
                              border: remViews > 0 ? '1.5px solid rgba(139,92,246,0.42)' : '1px solid var(--border)',
                              opacity: remViews > 0 ? 1 : 0.65,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 9,
                                      background: 'rgba(139,92,246,0.18)',
                                      border: '1px solid rgba(139,92,246,0.4)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#C4B5FD',
                                      flexShrink: 0,
                                      fontWeight: 800,
                                      fontSize: 14,
                                    }}
                                  >
                                    🚀
                                  </div>
                                  <div>
                                    <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                                      {ptask.task_name}
                                    </div>
                                    <div className="font-mono" style={{ fontSize: 10, color: '#A78BFA', fontWeight: 700 }}>
                                      PUBCRYPTO LINK {cooldownSec > 0 ? `• ⏱️ ${Math.round(cooldownSec / 60) || 1}m CD` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    textAlign: 'right',
                                    padding: '4px 8px',
                                    borderRadius: 7,
                                    background: 'rgba(0,232,154,0.12)',
                                    border: '1px solid rgba(0,232,154,0.32)',
                                  }}
                                >
                                  <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                                    +{rewardCoins}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 9, color: 'var(--txt2)' }}>
                                    COINS
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                                  <span className="font-mono" style={{ color: 'var(--txt2)' }}>Remaining in 24h Cycle</span>
                                  <span className="font-mono" style={{ color: '#C4B5FD', fontWeight: 700 }}>
                                    {remViews} / {maxViews} Left
                                  </span>
                                </div>
                                <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, #8B5CF6, var(--green))',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {remViews > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleLaunchPubCryptoLinkTask(ptask)}
                                disabled={pubCryptoLaunchingId === cardKey}
                                className="btn btn-primary btn-sm btn-full"
                                style={{
                                  background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                }}
                              >
                                {pubCryptoLaunchingId === cardKey
                                  ? 'Redirecting to Shortlink...'
                                  : owmClickedIds[cardKey]
                                    ? `Start Again (${remViews} Left) • Auto-Syncing ↗`
                                    : `Start PubCrypto Link (+${rewardCoins} Coins) ↗`}
                              </button>
                            ) : (
                              <button type="button" disabled className="btn btn-outline btn-sm btn-full" style={{ opacity: 0.6 }}>
                                Cycle Limit Reached
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {pubCryptoNativeFeed.shortlinkCampaigns.map((camp: any, idx: number) => {
                        const maxViews = Math.max(1, Number(camp.limit) || 1);
                        const remViews = camp.available !== null && camp.available !== undefined ? Number(camp.available) : maxViews;
                        const rewardCoins =
                          Number(camp.reward) > 0 && Number(camp.reward) < 1
                            ? Number((Number(camp.reward) * 25).toFixed(2))
                            : Number(camp.reward) || 1;
                        const cardKey = `pc_camp_${camp.id || camp.campaign_token || idx}`;
                        return (
                          <div
                            key={cardKey}
                            className="card"
                            style={{
                              padding: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                              background: 'var(--bg2)',
                              border: '1px solid rgba(139,92,246,0.35)',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div>
                                  <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                                    {camp.title}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 10, color: '#A78BFA', fontWeight: 700 }}>
                                    ⚡ {camp.sourceLabel || 'PUBCRYPTO SHORTLINK'} • {remViews}/{maxViews} Left
                                  </div>
                                </div>
                                <div
                                  style={{
                                    textAlign: 'right',
                                    padding: '4px 8px',
                                    borderRadius: 7,
                                    background: 'rgba(0,232,154,0.12)',
                                    border: '1px solid rgba(0,232,154,0.32)',
                                  }}
                                >
                                  <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                                    +{rewardCoins}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 9, color: 'var(--txt2)' }}>
                                    COINS
                                  </div>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLaunchPubCryptoCampaign(camp)}
                              className="btn btn-primary btn-sm btn-full"
                              style={{
                                background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                                color: '#FFFFFF',
                                fontWeight: 700,
                              }}
                            >
                              {pubCryptoLaunchingId === cardKey
                                ? 'Opening Shortlink...'
                                : `Open Shortlink (+${rewardCoins} Coins) ↗`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* ── 7C: OFFERWALL.ME SINGLE-PIECE SHORTLINKS ── */}
              {shortlinksSubMode === 'cards' &&
                !showPartnerShortlinksWall &&
                (shortlinkSourceFilter === 'all' || shortlinkSourceFilter === 'offerwallme') &&
                owmFeed.shortlinks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(56,189,248,0.16)',
                          border: '1px solid rgba(56,189,248,0.38)',
                          color: '#38BDF8',
                          fontWeight: 700,
                        }}
                      >
                        🌐 OFFERWALL.ME PARTNER SHORTLINKS
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 14 }}>
                      {owmFeed.shortlinks.map((osl: any, idx: number) => {
                        const remViews = Number(osl.remaining_views) || 0;
                        const maxViews = Math.max(1, Number(osl.daily_limit) || 1);
                        const doneViews = Math.max(0, maxViews - remViews);
                        const pct = Math.min(100, Math.round((doneViews / maxViews) * 100));
                        const rewardCoins = Number(osl.reward) || 0;
                        return (
                          <div
                            key={osl.id || idx}
                            className="card"
                            style={{
                              padding: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                              background: 'var(--bg2)',
                              border: remViews > 0 ? '1px solid rgba(0,232,154,0.28)' : '1px solid var(--border)',
                              opacity: remViews > 0 ? 1 : 0.6,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 9,
                                      background: 'rgba(0,232,154,0.12)',
                                      border: '1px solid rgba(0,232,154,0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--green)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                                      {osl.name}
                                    </div>
                                    <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--txt2)' }}>
                                      {osl.shortlink || 'Offerwall.me Shortlink'}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    textAlign: 'right',
                                    padding: '4px 8px',
                                    borderRadius: 7,
                                    background: 'rgba(0,232,154,0.1)',
                                    border: '1px solid rgba(0,232,154,0.28)',
                                  }}
                                >
                                  <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                                    +{rewardCoins}
                                  </div>
                                  <div className="font-mono" style={{ fontSize: 9, color: 'var(--txt2)' }}>
                                    COINS
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                                  <span className="font-mono" style={{ color: 'var(--txt2)' }}>Remaining Today</span>
                                  <span className="font-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>
                                    {remViews} / {maxViews} Left
                                  </span>
                                </div>
                                <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, var(--green), #059669)',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {remViews > 0 ? (
                              <a
                                href={osl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markOwmItemClicked(`sl_${osl.id || idx}`)}
                                className="btn btn-primary btn-sm btn-full"
                                style={{ textAlign: 'center', textDecoration: 'none' }}
                              >
                                {owmClickedIds[`sl_${osl.id || idx}`]
                                  ? `Visiting (${remViews} Left) • Auto-Syncing ↗`
                                  : `Visit Shortlink (+${rewardCoins} Coins) ↗`}
                              </a>
                            ) : (
                              <button type="button" disabled className="btn btn-outline btn-sm btn-full" style={{ opacity: 0.6 }}>
                                Completed for Today
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {(shortlinksSubMode === 'pubcrypto' || shortlinksSubMode === 'owm_wall' || showPartnerShortlinksWall) && (
                <div className="card card-glow" style={{ padding: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 14,
                      paddingBottom: 12,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>
                        {shortlinksSubMode === 'pubcrypto'
                          ? '🔥 PubCrypto — Shortlinks (PubCryptoLink), PTC & Tasks Wall'
                          : '🌐 Offerwall.me — Shortlinks Wall'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Instant S2S Postback credit via <code className="font-mono">lootify/api/postback</code>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {shortlinksSubMode === 'pubcrypto' && (
                        <button
                          type="button"
                          onClick={() => refreshPubCryptoSignedUrl(user.id, true)}
                          className="btn btn-outline btn-sm"
                        >
                          Reload Session
                        </button>
                      )}
                      <a
                        href={
                          shortlinksSubMode === 'pubcrypto'
                            ? `${getApiBaseUrl()}/api/offerwalls/signed-url?provider_id=pubcrypto&user_id=${encodeURIComponent(
                                user.id
                              )}&theme=${encodeURIComponent(theme)}&redirect=1`
                            : buildOfferwallMeTabUrl(
                                signedOfferwallMeUrl ||
                                  buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id),
                                'shortlinks'
                              )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        ↗ Open Fullscreen in New Tab
                      </a>
                    </div>
                  </div>
                  {shortlinksSubMode === 'pubcrypto' && !signedPubCryptoUrl ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--txt2)' }}>
                      Generating fresh PubCrypto session token...
                    </div>
                  ) : (
                    <iframe
                      key={`shortlinks_${shortlinksSubMode}_${user.id}_${shortlinksSubMode === 'pubcrypto' ? signedPubCryptoUrl : 'owm'}`}
                      data-pubcrypto-offerwall={shortlinksSubMode === 'pubcrypto' ? true : undefined}
                      src={
                        shortlinksSubMode === 'pubcrypto'
                          ? signedPubCryptoUrl
                          : buildOfferwallMeTabUrl(
                              signedOfferwallMeUrl ||
                                buildSignedOfferwallMeUrlSync(OFFERWALLME_PUBLIC_KEY, user.id),
                              'shortlinks'
                            )
                      }
                      title={shortlinksSubMode === 'pubcrypto' ? 'PubCrypto Shortlinks' : 'Offerwall.me Shortlinks'}
                      width="100%"
                      height={shortlinksSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 620}
                      frameBorder={0}
                      referrerPolicy={shortlinksSubMode === 'pubcrypto' ? 'no-referrer' : undefined}
                      allow="clipboard-write; fullscreen; popups"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: shortlinksSubMode === 'pubcrypto' ? pubCryptoIframeHeight : 620,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: '#0B121E',
                      }}
                      sandbox={
                        shortlinksSubMode === 'pubcrypto'
                          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── TAB 2C: LOOTIFY BUILT-IN FREE FAUCET + FAUCETPAY INSTANT ROLL ── */}
        {activeTab === 'faucet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 22, alignItems: 'start' }}>
              {/* Left Column: Faucet Roll Box (Immediately Above the Fold) */}
              <div className="card card-glow" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--green), #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                      }}
                    >
                      🚰
                    </div>
                    <div>
                      <h2 className="font-display" style={{ fontSize: 21, fontWeight: 700, color: 'var(--txt)' }}>
                        Lootify Hourly Faucet Roll
                      </h2>
                      <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        Roll Every 60 Minutes • Credits Lootify Wallet Coins (Withdraw at 100,000 Coins = $1 / ₹90 via UPI / FaucetPay)
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: faucetCooldownSecs > 0 ? 'rgba(255,180,0,0.14)' : 'rgba(0,232,154,0.14)',
                      color: faucetCooldownSecs > 0 ? 'var(--gold)' : 'var(--green)',
                      fontWeight: 700,
                    }}
                  >
                    {faucetCooldownSecs > 0
                      ? `⏳ Next Roll: ${Math.floor(faucetCooldownSecs / 60)}m ${faucetCooldownSecs % 60}s`
                      : '✅ READY TO ROLL'}
                  </span>
                </div>

                {/* Lucky Roll Payout Table (100% Profit Optimized: Base = 1 Coin = ₹0.01) */}
                <div
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--txt2)',
                      paddingBottom: 8,
                      marginBottom: 8,
                      borderBottom: '1px solid var(--border)',
                      fontWeight: 700,
                    }}
                  >
                    <span>LUCKY NUMBER</span>
                    <span>LOOTIFY WALLET REWARD</span>
                  </div>
                  {[
                    { range: '0000 – 9885', reward: '+1 Coin (₹0.01)', color: 'var(--txt)' },
                    { range: '9886 – 9985', reward: '+3 Coins (₹0.03)', color: 'var(--green)' },
                    { range: '9986 – 9997', reward: '+10 Coins (₹0.10)', color: 'var(--gold)' },
                    { range: '9998 – 9999', reward: '+50 Coins JACKPOT (₹0.50)', color: 'var(--violet)' },
                  ].map((row) => (
                    <div
                      key={row.range}
                      className="font-mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '5px 0',
                      }}
                    >
                      <span style={{ color: 'var(--txt2)' }}>{row.range}</span>
                      <span style={{ color: row.color, fontWeight: 700 }}>{row.reward}</span>
                    </div>
                  ))}
                </div>

                {/* Faucet Energy / Offerwall Boost Banner */}
                {(() => {
                  const claimsUsed = Number(user.faucetClaimsCount) || 0;
                  const offerwallTasks = Math.max(0, (Number(user.questsCompleted) || 0) - claimsUsed);
                  const totalUnlockedRolls = 2 + offerwallTasks * 3;
                  const remainingRolls = Math.max(0, totalUnlockedRolls - claimsUsed);
                  return (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        marginBottom: 16,
                        background:
                          remainingRolls > 0
                            ? 'rgba(0,232,154,0.08)'
                            : 'rgba(255,180,0,0.1)',
                        border:
                          remainingRolls > 0
                            ? '1px solid rgba(0,232,154,0.3)'
                            : '1px solid rgba(255,180,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: remainingRolls > 0 ? 'var(--green)' : 'var(--gold)' }}>
                          ⚡ Faucet Energy: {remainingRolls} Free Roll(s) Available
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                          Every 1 Offerwall task/shortlink completed unlocks <strong>+3 Free Faucet Rolls</strong> &amp; pays up to 3,000 Coins!
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => switchTab('shortlinks')}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                        >
                          🔗 1 Shortlink (+3 Rolls) →
                        </button>
                        <button
                          type="button"
                          onClick={() => switchTab('quests')}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                        >
                          🚀 Offerwalls (+3 Rolls) →
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <form onSubmit={handleClaimFaucet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Anti-Bot Math + 5s Security Verification */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>
                        🤖 Anti-Bot Check: What is {faucetMathA} + {faucetMathB} ?
                      </span>
                      <input
                        type="number"
                        value={faucetMathInput}
                        onChange={(e) => setFaucetMathInput(e.target.value)}
                        placeholder="Answer"
                        className="font-mono"
                        style={{
                          width: 90,
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: 'var(--bg3)',
                          border: '1px solid var(--border2)',
                          color: 'var(--green)',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={startFaucetAntiBotTimer}
                      disabled={faucetUnlockSecs > 0 || faucetUnlocked}
                      className="btn btn-outline btn-sm"
                      style={{ width: '100%' }}
                    >
                      {faucetUnlocked
                        ? '✅ Anti-Bot Verified — Click Roll Below!'
                        : faucetUnlockSecs > 0
                        ? `⏳ Verifying Human... ${faucetUnlockSecs}s`
                        : '🛡️ Step 1: Verify Anti-Bot (5s Timer)'}
                    </button>
                  </div>

                  {faucetError && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(255,85,102,0.1)',
                        border: '1px solid rgba(255,85,102,0.35)',
                        color: 'var(--red)',
                        fontSize: 12,
                      }}
                    >
                      ⚠️ {faucetError}
                    </div>
                  )}

                  {faucetLastResult && (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'rgba(0,232,154,0.12)',
                        border: '1.5px solid rgba(0,232,154,0.4)',
                        color: 'var(--green)',
                        textAlign: 'center',
                      }}
                    >
                      <div className="font-mono" style={{ fontSize: 18, fontWeight: 700 }}>
                        🎲 Lucky Roll #{String(faucetLastResult.rollNumber).padStart(4, '0')} → +{faucetLastResult.rewardCoins} Coin(s) Won!
                      </div>
                      {faucetLastResult.notice && (
                        <div style={{ fontSize: 12, color: 'var(--txt)', marginTop: 4 }}>
                          {faucetLastResult.notice}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={faucetRolling || faucetCooldownSecs > 0 || !faucetUnlocked}
                    className="btn btn-primary btn-full"
                    style={{
                      padding: '14px',
                      opacity: faucetRolling || faucetCooldownSecs > 0 || !faucetUnlocked ? 0.6 : 1,
                    }}
                  >
                    {faucetRolling
                      ? '🎲 Rolling Lucky Number...'
                      : faucetCooldownSecs > 0
                      ? `⏳ Cooldown (${Math.floor(faucetCooldownSecs / 60)}m ${faucetCooldownSecs % 60}s)`
                      : '🎲 Step 2: Roll & Add Coins to Wallet!'}
                  </button>
                </form>
              </div>

              {/* Right Column: Recent Faucet Claims First + Sponsored Banner Ads Below */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                      📜 Your Recent Faucet Rolls
                    </h3>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                      {user.faucetClaimsCount || 0} Total Claims
                    </span>
                  </div>
                  {!user.faucetHistory || user.faucetHistory.length === 0 ? (
                    <div
                      style={{
                        padding: '20px 14px',
                        textAlign: 'center',
                        borderRadius: 10,
                        background: 'var(--bg2)',
                        border: '1px dashed var(--border2)',
                        fontSize: 12,
                        color: 'var(--txt2)',
                      }}
                    >
                      No faucet rolls yet. Complete your first free roll on the left!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {user.faucetHistory.slice(0, 8).map((fc) => (
                        <div
                          key={fc.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>
                              Roll #{String(fc.rollNumber).padStart(4, '0')}
                            </div>
                            <div className="font-mono" style={{ fontSize: 10, color: 'var(--txt2)' }}>
                              {formatIstDate(fc.createdAt)} • {fc.payoutMode === 'faucetpay' ? 'FaucetPay' : 'Wallet'}
                            </div>
                          </div>
                          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                            +{fc.coins} Coins
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="card"
                  style={{
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                    SPONSORED FAUCET ADS • OFFERWALL.ME
                  </span>
                  <OfferwallMeBanner size="300x250" />
                  <OfferwallMeBanner size="468x60" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: REFER & EARN ── */}
        {activeTab === 'referrals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card card-glow" style={{ padding: 'clamp(22px, 4vw, 36px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(155,110,255,0.14)',
                    border: '1px solid rgba(155,110,255,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  👥
                </div>
                <div>
                  <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)' }}>
                    Refer Friends &amp; Earn 10% Lifetime Commission
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                    Share your unique referral link. Earn 10% of every offerwall task your friends complete — forever.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 4 }}>
                    YOUR PERSONAL REFERRAL LINK
                  </div>
                  <div className="font-mono" style={{ fontSize: 13, color: 'var(--green)', wordBreak: 'break-all' }}>
                    {referralLink}
                  </div>
                </div>
                <button type="button" onClick={copyReferral} className="btn btn-primary btn-sm">
                  {copiedRef ? '✅ Link Copied!' : '📋 Copy Referral Link'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div style={{ padding: 18, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 6 }}>YOUR REFERRAL CODE</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
                    {user.referralCode}
                  </div>
                </div>
                <div style={{ padding: 18, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 6 }}>TOTAL REFERRED FRIENDS</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                    {user.referralsCount}
                  </div>
                </div>
                <div style={{ padding: 18, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 6 }}>COMMISSION RATE</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                    10% Forever
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: CASHOUT WALLET (TOTAL COINS | WITHDRAWABLE | ON HOLD) ── */}
        {activeTab === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 3-Section Wallet Balance Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                    1. TOTAL COINS BALANCE
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--bg3)',
                      color: 'var(--txt2)',
                    }}
                  >
                    COMBINED
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--txt)' }}>
                  {totalCoins.toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: 14, color: 'var(--txt2)', fontWeight: 500 }}>Coins</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  Total Value: <strong style={{ color: 'var(--txt)' }}>₹{totalInr} INR</strong> (Withdrawable + On Hold)
                </div>
              </div>

              <div
                className="card"
                style={{
                  padding: 22,
                  border: '1.5px solid rgba(0,232,154,0.4)',
                  background: 'linear-gradient(135deg, rgba(0,232,154,0.08), rgba(0,232,154,0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
                    2. WITHDRAWABLE BALANCE
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(0,232,154,0.16)',
                      color: 'var(--green)',
                      fontWeight: 700,
                    }}
                  >
                    ACTIVE • READY
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>
                  {user.availableCoins.toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: 14, color: 'var(--txt2)', fontWeight: 500 }}>Coins</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  Cashout Value: <strong style={{ color: 'var(--green)' }}>₹{inrBalance} INR (${usdBalance} USD)</strong> • ⚡ FaucetPay Min: 100 Coins • ⚡ UPI Min: ₹1
                </div>
              </div>

              <div
                className="card"
                style={{
                  padding: 22,
                  border: '1.5px solid rgba(255,180,0,0.35)',
                  background: 'linear-gradient(135deg, rgba(255,180,0,0.08), rgba(255,180,0,0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em' }}>
                    3. ON HOLD (VERIFICATION)
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,180,0,0.16)',
                      color: 'var(--gold)',
                      fontWeight: 700,
                    }}
                  >
                    ESCROW HOLD
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>
                  {user.pendingCoins.toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: 14, color: 'var(--txt2)', fontWeight: 500 }}>Coins</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  Hold Value: <strong style={{ color: 'var(--gold)' }}>₹{pendingInr} INR (${pendingUsd} USD)</strong> — Auto-transfers to Withdrawable once Ad Network settles payout
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              <div className="card card-glow" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
                    Withdraw Active Earnings
                  </h2>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(0,232,154,0.12)',
                      color: 'var(--green)',
                      fontWeight: 700,
                    }}
                  >
                    100,000 Coins = $1.00 USD (₹90 INR)
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 18 }}>
                  Choose your preferred payout method below. Payouts via <strong>FaucetPay (USDT)</strong> are <strong>0% fee &amp; instant up to $0.01</strong>, and <strong>UPI (₹)</strong> allows minimum <strong>₹1 cashout</strong>.
                </p>

                <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '0.04em', marginBottom: 8 }}>
                      SELECT PAYOUT METHOD
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutChannel('crypto');
                          setPayoutCoins('1000');
                        }}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 10,
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: payoutChannel === 'crypto' ? 'rgba(255,180,0,0.12)' : 'var(--bg2)',
                          border: payoutChannel === 'crypto' ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                          color: payoutChannel === 'crypto' ? 'var(--gold)' : 'var(--txt)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🪙 FaucetPay</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 3 }}>
                          0% Fee • ⚡ Instant &lt;= $0.01
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutChannel('upi');
                          setUpiInrInput('1');
                        }}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 10,
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: payoutChannel === 'upi' ? 'rgba(0,232,154,0.12)' : 'var(--bg2)',
                          border: payoutChannel === 'upi' ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: payoutChannel === 'upi' ? 'var(--green)' : 'var(--txt)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>⚡ UPI (₹ Only)</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 3 }}>
                          Min ₹1 • ₹1 = 1,100 Coins
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutChannel('gift_card');
                          if (!payoutDestination) setPayoutDestination(user.email);
                          setPayoutCoins('10000');
                        }}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 10,
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: payoutChannel === 'gift_card' ? 'rgba(139,92,246,0.14)' : 'var(--bg2)',
                          border: payoutChannel === 'gift_card' ? '1.5px solid var(--violet)' : '1px solid var(--border)',
                          color: payoutChannel === 'gift_card' ? 'var(--violet)' : 'var(--txt)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🎁 Gift Card</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--txt2)', marginTop: 3 }}>
                          Google Play • Amazon • Flipkart
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Channel-Specific Helper Banner */}
                  {payoutChannel === 'crypto' ? (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(255,180,0,0.08)',
                        border: '1px solid rgba(255,180,0,0.3)',
                        fontSize: 12,
                        color: 'var(--txt)',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--gold)' }}>🪙 FAUCETPAY RULES:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11.5, color: 'var(--txt2)' }}>
                        <li><strong>Zero Transaction Fees:</strong> You receive 100% of your earnings.</li>
                        <li><strong>Minimum:</strong> Just <strong>100 Coins ($0.001 USDT)</strong>.</li>
                        <li><strong>⚡ Instant Transfer:</strong> Transactions up to <strong>1,000 Coins ($0.01 USDT)</strong> transfer automatically via FaucetPay API.</li>
                        <li><strong>🛡️ Admin Review:</strong> Above 1,000 Coins ($0.01 USDT), transfers are reviewed and sent via 1-click API approval.</li>
                      </ul>
                    </div>
                  ) : payoutChannel === 'upi' ? (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(0,232,154,0.08)',
                        border: '1px solid rgba(0,232,154,0.3)',
                        fontSize: 12,
                        color: 'var(--txt)',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--green)' }}>⚡ UPI (₹ ONLY) RULES:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11.5, color: 'var(--txt2)' }}>
                        <li><strong>Minimum:</strong> Just <strong>₹1 Withdrawal</strong>.</li>
                        <li><strong>Fee Structure:</strong> 100 extra coins per rupee (<strong>₹1 = 1,100 Coins</strong>, ₹2 = 2,200 Coins, ₹5 = 5,500 Coins, ₹10 = 11,000 Coins, and so on).</li>
                        <li><strong>Direct to VPA:</strong> Direct bank credit to your GooglePay, PhonePe, Paytm, or BHIM UPI ID.</li>
                      </ul>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        fontSize: 12,
                        color: 'var(--txt)',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--violet)' }}>🎁 GIFT CARD VOUCHERS:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11.5, color: 'var(--txt2)' }}>
                        <li><strong>Available Brands:</strong> Google Play Recharge Code, Amazon Pay Gift Card, Flipkart Voucher.</li>
                        <li><strong>Delivery:</strong> Redeem code delivered directly to your email address.</li>
                      </ul>
                    </div>
                  )}

                  {/* Gift Card Brand Selector when gift_card is active */}
                  {payoutChannel === 'gift_card' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                        SELECT GIFT CARD BRAND
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {(['Google Play', 'Amazon Pay', 'Flipkart'] as const).map((brand) => (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => setGiftCardBrand(brand)}
                            style={{
                              padding: '9px 8px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: giftCardBrand === brand ? 'rgba(139,92,246,0.18)' : 'var(--bg3)',
                              border: giftCardBrand === brand ? '1.5px solid var(--violet)' : '1px solid var(--border)',
                              color: giftCardBrand === brand ? 'var(--txt)' : 'var(--txt2)',
                            }}
                          >
                            {brand === 'Google Play' ? '▶️ Google Play' : brand === 'Amazon Pay' ? '🛒 Amazon Pay' : '🛍️ Flipkart'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Destination Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                      {payoutChannel === 'crypto'
                        ? 'FAUCETPAY LINKED EMAIL OR USDT WALLET ADDRESS'
                        : payoutChannel === 'upi'
                        ? 'UPI ID / VPA (e.g. name@okaxis, 9876543210@paytm)'
                        : `${giftCardBrand.toUpperCase()} VOUCHER DELIVERY EMAIL ADDRESS`}
                    </label>
                    <input
                      type="text"
                      value={payoutDestination}
                      onChange={(e) => setPayoutDestination(e.target.value)}
                      placeholder={
                        payoutChannel === 'crypto'
                          ? 'Enter FaucetPay email or TRC20/BEP20/Polygon address'
                          : payoutChannel === 'upi'
                          ? 'yourname@okhdfcbank or 9876543210@paytm'
                          : user.email
                      }
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border2)',
                        color: 'var(--txt)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Amount Input & Quick Selectors */}
                  {payoutChannel === 'crypto' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)' }}>
                          COINS TO WITHDRAW (AVAILABLE: {user.availableCoins} COINS)
                        </label>
                        <span className="font-mono" style={{ fontSize: 11, color: Number(payoutCoins || 0) <= 1000 ? 'var(--gold)' : 'var(--txt2)' }}>
                          {Number(payoutCoins || 0) <= 1000 ? '⚡ Instant Transfer Mode' : '🛡️ Admin Review Mode'}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={payoutCoins}
                        onChange={(e) => setPayoutCoins(e.target.value)}
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          border: '1px solid var(--border2)',
                          color: 'var(--gold)',
                          fontSize: 16,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />

                      {/* Quick FaucetPay Presets */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {[
                          { coins: '100', label: '100 ($0.001) ⚡' },
                          { coins: '500', label: '500 ($0.005) ⚡' },
                          { coins: '1000', label: '1,000 ($0.01) ⚡' },
                          { coins: '5000', label: '5k ($0.05)' },
                          { coins: '10000', label: '10k ($0.10)' },
                          { coins: '50000', label: '50k ($0.50)' },
                          { coins: '100000', label: '100k ($1.00)' },
                        ].map((btn) => (
                          <button
                            key={btn.coins}
                            type="button"
                            onClick={() => setPayoutCoins(btn.coins)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: payoutCoins === btn.coins ? 'rgba(255,180,0,0.18)' : 'var(--bg3)',
                              border: payoutCoins === btn.coins ? '1px solid var(--gold)' : '1px solid var(--border)',
                              color: payoutCoins === btn.coins ? 'var(--gold)' : 'var(--txt2)',
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 8 }}>
                        You Receive:{' '}
                        <strong className="font-mono" style={{ color: 'var(--gold)', fontSize: 13 }}>
                          ${((Math.max(0, Number(payoutCoins) || 0)) / 100000).toFixed(4)} USDT
                        </strong>{' '}
                        (approx. ₹{((Math.max(0, Number(payoutCoins) || 0) * 90) / 100000).toFixed(2)} INR) • 0% Fee
                      </div>
                    </div>
                  ) : payoutChannel === 'upi' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)' }}>
                          WITHDRAW AMOUNT IN RUPEES (₹) (MINIMUM ₹1)
                        </label>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
                          ₹1 = 1,100 Coins
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={upiInrInput}
                        onChange={(e) => setUpiInrInput(e.target.value)}
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          border: '1px solid var(--border2)',
                          color: 'var(--green)',
                          fontSize: 16,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />

                      {/* Quick UPI Presets */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {[
                          { inr: '1', label: '₹1 (1.1k)' },
                          { inr: '2', label: '₹2 (2.2k)' },
                          { inr: '5', label: '₹5 (5.5k)' },
                          { inr: '10', label: '₹10 (11k)' },
                          { inr: '25', label: '₹25 (27.5k)' },
                          { inr: '50', label: '₹50 (55k)' },
                          { inr: '100', label: '₹100 (110k)' },
                        ].map((btn) => (
                          <button
                            key={btn.inr}
                            type="button"
                            onClick={() => setUpiInrInput(btn.inr)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: upiInrInput === btn.inr ? 'rgba(0,232,154,0.18)' : 'var(--bg3)',
                              border: upiInrInput === btn.inr ? '1px solid var(--green)' : '1px solid var(--border)',
                              color: upiInrInput === btn.inr ? 'var(--green)' : 'var(--txt2)',
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const targetInr = Math.max(1, Math.floor(Number(upiInrInput) || 1));
                        const requiredCoins = targetInr * 1100;
                        return (
                          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 8 }}>
                            You Receive: <strong style={{ color: 'var(--green)' }}>₹{targetInr} INR</strong> • Coins Deducted:{' '}
                            <strong className="font-mono" style={{ color: 'var(--green)' }}>
                              {requiredCoins.toLocaleString('en-IN')} Coins
                            </strong>{' '}
                            ({(targetInr * 1000).toLocaleString('en-IN')} Base + {(targetInr * 100).toLocaleString('en-IN')} Fee)
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)' }}>
                          COINS FOR {giftCardBrand.toUpperCase()} GIFT CARD
                        </label>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--violet)' }}>
                          🎁 Redeem Code via Email
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={payoutCoins}
                        onChange={(e) => setPayoutCoins(e.target.value)}
                        className="font-mono"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          border: '1px solid var(--border2)',
                          color: 'var(--txt)',
                          fontSize: 15,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {[
                          { coins: '11000', label: '₹10 Voucher' },
                          { coins: '27500', label: '₹25 Voucher' },
                          { coins: '55000', label: '₹50 Voucher' },
                          { coins: '110000', label: '₹100 Voucher' },
                        ].map((btn) => (
                          <button
                            key={btn.coins}
                            type="button"
                            onClick={() => setPayoutCoins(btn.coins)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: payoutCoins === btn.coins ? 'rgba(139,92,246,0.18)' : 'var(--bg3)',
                              border: payoutCoins === btn.coins ? '1px solid var(--violet)' : '1px solid var(--border)',
                              color: payoutCoins === btn.coins ? 'var(--txt)' : 'var(--txt2)',
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 8 }}>
                        Voucher Value:{' '}
                        <strong className="font-mono" style={{ color: 'var(--green)' }}>
                          ₹{(((Math.max(0, Number(payoutCoins) || 0)) * 90) / 100000).toFixed(2)} INR
                        </strong>
                      </div>
                    </div>
                  )}

                  {payoutMessage && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        background:
                          payoutMessage.type === 'error' ? 'rgba(255,85,102,0.1)' : 'rgba(0,232,154,0.1)',
                        border:
                          payoutMessage.type === 'error'
                            ? '1px solid rgba(255,85,102,0.3)'
                            : '1px solid rgba(0,232,154,0.3)',
                        color: payoutMessage.type === 'error' ? 'var(--red)' : 'var(--green)',
                      }}
                    >
                      {payoutMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    style={{
                      padding: '14px',
                      background: payoutChannel === 'crypto' ? 'linear-gradient(135deg, var(--gold), #D49000)' : undefined,
                      color: payoutChannel === 'crypto' ? '#03100A' : undefined,
                      fontWeight: 700,
                    }}
                  >
                    {payoutChannel === 'crypto'
                      ? Number(payoutCoins || 0) <= 1000
                        ? `⚡ Claim Instant FaucetPay Transfer ($${((Math.max(0, Number(payoutCoins) || 0)) / 100000).toFixed(4)} USDT) →`
                        : `Request FaucetPay Transfer ($${((Math.max(0, Number(payoutCoins) || 0)) / 100000).toFixed(4)} USDT) →`
                      : payoutChannel === 'upi'
                      ? `Request ₹${Math.max(1, Math.floor(Number(upiInrInput) || 1))} UPI Transfer (${(Math.max(1, Math.floor(Number(upiInrInput) || 1)) * 1100).toLocaleString('en-IN')} Coins) →`
                      : `🎁 Claim ${giftCardBrand} Gift Card →`}
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Dedicated On-Hold & Settled Task Breakdown */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                        Completed Offerwall Tasks &amp; Earnings History
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                        All Offerwall.me &amp; PubCrypto completions credited to Player ID <span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span> (newest at top).
                      </p>
                    </div>
                    <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                      {user.heldRewards?.length || 0} Tasks ({user.pendingCoins} Held)
                    </span>
                  </div>

                  {!user.heldRewards || user.heldRewards.length === 0 ? (
                    <div
                      style={{
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'var(--bg2)',
                        border: '1px dashed var(--border2)',
                        borderRadius: 12,
                      }}
                    >
                      <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                        {user.pendingCoins > 0
                          ? `${user.pendingCoins.toLocaleString('en-IN')} Coins (₹${pendingInr}) currently in verification hold. Will auto-transfer to Withdrawable once settled.`
                          : 'No coins currently on hold. Complete Offerwall quests to earn!'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {user.heldRewards.map((item) => {
                        const isHeld = item.status === 'pending_hold';
                        const isDeducted = Number(item.coins) < 0 || item.status === 'deducted';
                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '12px 14px',
                              background: 'var(--bg2)',
                              border: isDeducted
                                ? '1px solid rgba(255,85,102,0.32)'
                                : isHeld
                                ? '1px solid rgba(255,180,0,0.28)'
                                : '1px solid rgba(0,232,154,0.22)',
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                                {item.title}
                              </div>
                              <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                                Date: {formatIstDate(item.createdAt)}
                                {isHeld && item.unlocksAt ? ` • Auto-Release: ${formatIstDate(item.unlocksAt)}` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: isDeducted ? 'var(--red)' : isHeld ? 'var(--gold)' : 'var(--green)',
                                }}
                              >
                                {Number(item.coins) >= 0 ? `+${item.coins}` : item.coins} Coins (₹{item.amountInr})
                              </span>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 10,
                                  padding: '3px 7px',
                                  borderRadius: 6,
                                  background: isDeducted
                                    ? 'rgba(255,85,102,0.12)'
                                    : isHeld
                                    ? 'rgba(255,180,0,0.12)'
                                    : 'rgba(0,232,154,0.12)',
                                  color: isDeducted ? 'var(--red)' : isHeld ? 'var(--gold)' : 'var(--green)',
                                  fontWeight: 700,
                                }}
                              >
                                {isDeducted ? '⚠️ DEDUCTED' : isHeld ? '⏳ ON HOLD' : '✅ WITHDRAWABLE'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Withdrawal History */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>
                    Withdrawal History
                  </h3>

                  {user.withdrawals.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 20px',
                        textAlign: 'center',
                        background: 'var(--bg2)',
                        border: '1px dashed var(--border2)',
                        borderRadius: 12,
                      }}
                    >
                      <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                        You haven&apos;t made any withdrawal requests yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {user.withdrawals.map((w) => (
                        <div
                          key={w.id}
                          style={{
                            padding: '14px 16px',
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                              ₹{w.amountInr} — {w.methodLabel}
                            </div>
                            <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                              {w.destination} • {formatIstDate(w.createdAt)}
                            </div>
                          </div>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 10,
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: 'rgba(255,180,0,0.1)',
                              border: '1px solid rgba(255,180,0,0.25)',
                              color: 'var(--gold)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {w.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', padding: '24px 20px' }}>
        <div
          className="wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
            © 2026 Lootify — Player Dashboard • Official Contact:{' '}
            <a href="mailto:contact@lootify.eternant.c0m.to" className="font-mono" style={{ color: 'var(--green)', textDecoration: 'none' }}>
              contact@lootify.eternant.c0m.to
            </a>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={goBackToLanding}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--txt2)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Landing Page
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--red)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </footer>

      {/* ── EARNINGS MINI POPUP MODAL (7 CATEGORIES) ── */}
      {earningsPopupOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 64,
            background: 'rgba(3, 16, 10, 0.72)',
            backdropFilter: 'blur(8px)',
            zIndex: 1900,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '10px',
            boxSizing: 'border-box',
          }}
          onClick={() => setEarningsPopupOpen(false)}
        >
          <div
            className="card card-glow"
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--bg2)',
              borderRadius: 20,
              padding: '16px 12px 14px',
              border: '1px solid rgba(0,232,154,0.3)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.55)',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(0,232,154,0.12)',
                    border: '1px solid rgba(0,232,154,0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00E89A',
                    flexShrink: 0,
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                    <path d="M7 6h1v4" />
                    <path d="m16.71 13.88.7.71-2.82 2.82" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)', display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    Earnings <span style={{ color: 'var(--txt2)', fontSize: 12.5, fontWeight: 500 }}>7 categories</span>
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEarningsPopupOpen(false)}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--txt2)',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 14,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {[
                {
                  id: 'offerwalls',
                  label: '1. Offer Tasks',
                  sub: 'Apps, games & signups',
                  color: '#00E89A',
                  bg: 'rgba(0,232,154,0.12)',
                  border: 'rgba(0,232,154,0.25)',
                  isNew: true,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00E89A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="M7 16v-5" />
                      <path d="M12 16V8" />
                      <path d="M17 16v-3" />
                    </svg>
                  ),
                },
                {
                  id: 'surveys',
                  target: 'surveys',
                  label: '2. Surveys',
                  sub: 'All paid surveys',
                  color: '#9B6EFF',
                  bg: 'rgba(155,110,255,0.13)',
                  border: 'rgba(155,110,255,0.28)',
                  isNew: true,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9B6EFF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      <path d="M22 12A10 10 0 0 0 12 2v10z" />
                    </svg>
                  ),
                },
                {
                  id: 'ptc',
                  label: '3. PTC & Articles',
                  sub: 'Window, Iframe & Read',
                  color: '#38BDF8',
                  bg: 'rgba(56,189,248,0.12)',
                  border: 'rgba(56,189,248,0.25)',
                  isNew: false,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
                      <path d="m13.58 13.58 5.42 5.42" />
                    </svg>
                  ),
                },
                {
                  id: 'faucet',
                  label: '4. Faucet',
                  sub: 'Free crypto claims',
                  color: '#00E89A',
                  bg: 'rgba(0,232,154,0.12)',
                  border: 'rgba(0,232,154,0.25)',
                  isNew: false,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00E89A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  ),
                },
                {
                  id: 'tasks',
                  label: '5. Mini Tasks',
                  sub: 'Custom, TimeWall & AdLabs',
                  color: '#FFB400',
                  bg: 'rgba(255,180,0,0.12)',
                  border: 'rgba(255,180,0,0.25)',
                  isNew: true,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFB400" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <path d="M9 12h6" />
                      <path d="M9 16h6" />
                    </svg>
                  ),
                },
                {
                  id: 'youtube',
                  target: 'youtube',
                  label: '6. Video Ads',
                  sub: 'Watch videos & earn',
                  color: '#38BDF8',
                  bg: 'rgba(56,189,248,0.12)',
                  border: 'rgba(56,189,248,0.25)',
                  isNew: false,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="4" />
                      <polygon points="10 9 15 12 10 15 10 9" fill="#38BDF8" stroke="none" />
                    </svg>
                  ),
                },
                {
                  id: 'shortlinks',
                  target: 'shortlinks',
                  label: '7. Short Links',
                  sub: 'Hamari added + partners',
                  color: '#00E89A',
                  bg: 'rgba(0,232,154,0.12)',
                  border: 'rgba(0,232,154,0.25)',
                  isNew: true,
                  svg: (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00E89A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  ),
                },
              ].map((item, idx) => (
                <div
                  key={`earn_pop_${idx}`}
                  onClick={() => {
                    setEarningsPopupOpen(false);
                    switchTab((item.target || item.id) as DashboardTab);
                  }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    minWidth: 0,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    gridColumn: idx === 6 ? 'span 2' : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.svg}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 3,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--txt)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {item.label}
                      </span>
                      {item.isNew && (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 7.5,
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--border2)',
                            color: 'var(--txt)',
                            flexShrink: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--txt2)',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}
            >
              <span className="font-mono" style={{ fontSize: 11.5, color: 'var(--txt2)' }}>
                All 7 earning methods live
              </span>
              <button
                type="button"
                onClick={() => {
                  setEarningsPopupOpen(false);
                  switchTab('offerwalls');
                }}
                className="font-mono"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--green)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Open Offer Tasks
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIXED MOBILE & APP BOTTOM NAVIGATION BAR (HOME, EARN, FAUCET, REFER, WALLET) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 2100,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {[
          {
            id: 'overview',
            label: 'Dashboard',
            color: '#00E89A',
            renderIcon: (active: boolean) => (
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#00E89A' : '#8FA89B'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            ),
          },
          {
            id: 'offerwalls',
            label: 'Earnings',
            color: '#38BDF8',
            renderIcon: (active: boolean) => (
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#00E89A' : '#38BDF8'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                <path d="M7 6h1v4" />
                <path d="m16.71 13.88.7.71-2.82 2.82" />
              </svg>
            ),
          },
          {
            id: 'faucet',
            label: 'Faucet',
            color: '#00E89A',
            renderIcon: (active: boolean) => (
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#00E89A' : '#8FA89B'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            ),
          },
          {
            id: 'wallet',
            label: 'Wallet',
            color: '#FFB400',
            renderIcon: (active: boolean) => (
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#00E89A' : '#FFB400'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            ),
          },
          {
            id: 'referrals',
            label: 'Referrals',
            color: '#9B6EFF',
            renderIcon: (active: boolean) => (
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#00E89A' : '#9B6EFF'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
        ].map((tab) => {
          const isEarnTab = tab.id === 'offerwalls';
          const active = isEarnTab
            ? earningsPopupOpen ||
              activeTab === 'offerwalls' ||
              activeTab === 'quests' ||
              activeTab === 'ptc' ||
              activeTab === 'youtube' ||
              activeTab === 'surveys' ||
              activeTab === 'tasks' ||
              activeTab === 'shortlinks'
            : !earningsPopupOpen && activeTab === tab.id;
          return (
            <button
              key={`bnav_${tab.id}`}
              type="button"
              onClick={() => {
                if (isEarnTab) {
                  setEarningsPopupOpen((prev) => !prev);
                } else {
                  setEarningsPopupOpen(false);
                  switchTab(tab.id as DashboardTab);
                }
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                color: active ? 'var(--green)' : 'var(--txt2)',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 28,
                    height: 2.5,
                    borderRadius: 99,
                    background: 'var(--green)',
                    boxShadow: '0 0 10px rgba(0,232,154,0.8)',
                  }}
                />
              )}
              <span
                style={{
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: active ? 'drop-shadow(0 0 8px rgba(0,232,154,0.55))' : 'none',
                }}
              >
                {tab.renderIcon(active)}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--txt)' : 'var(--txt2)',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
