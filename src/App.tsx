import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardTab, OfferwallConfig, PayoutChannel, PlayerUser, ThemeMode, WithdrawalRecord } from './types.ts';

const STORAGE_USER_KEY = 'lootify_player_user';
const STORAGE_ACCOUNTS_KEY = 'lootify_registered_accounts';
const STORAGE_API_BASE_KEY = 'lootify_api_base_url';
const STORAGE_OFFERWALLS_CACHE_KEY = 'lootify_offerwalls_dynamic_v3';

const OFFERWALLME_PUBLIC_KEY = 'PQhx5BxXulHlM6PxZx81pZgIs2nyRd';
const _OWM_S_BYTES = [
  47, 123, 124, 33, 38, 28, 35, 45, 27, 11, 24, 57, 28, 43, 43, 38, 46, 1, 14, 28, 125, 40, 6, 43,
  17, 120, 37, 43, 126, 30, 123, 125,
];

const DEFAULT_OFFERWALLME_WALL: OfferwallConfig = {
  provider_id: 'offerwallme',
  name: 'Offerwall.me',
  badge: 'PTC, Shortlinks, Surveys & Tasks',
  enabled: 1,
  app_id: OFFERWALLME_PUBLIC_KEY,
  iframe_url_template: 'https://offerwall.me/offerwall/{app_id}/{user_id}',
  hold_days: 0,
  postback_macro_query: '?user_id={subid}&amount={reward}&txn_id={transId}&status={status}',
};

async function buildSignedOfferwallMeUrl(publicKey: string, userId: string): Promise<string> {
  const pub = (publicKey || OFFERWALLME_PUBLIC_KEY).trim();
  const uid = (userId || '').trim();
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${pub}\n${uid}\n${expires}`;
  const kStr = String.fromCharCode(..._OWM_S_BYTES.map((b) => b ^ 73));
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(kStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `https://offerwall.me/offerwall/${encodeURIComponent(pub)}/${encodeURIComponent(
    uid
  )}?identityExpires=${encodeURIComponent(expires)}&identitySignature=${encodeURIComponent(
    signature
  )}`;
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
        if (!parsed.some((w: OfferwallConfig) => w.provider_id === 'offerwallme')) {
          parsed.unshift({ ...DEFAULT_OFFERWALLME_WALL });
        }
        return parsed;
      }
    }
  } catch {}
  return [{ ...DEFAULT_OFFERWALLME_WALL }];
}

function saveCachedOfferwalls(walls: OfferwallConfig[]) {
  try {
    localStorage.setItem(STORAGE_OFFERWALLS_CACHE_KEY, JSON.stringify(walls));
  } catch {}
}

function loadCurrentUser(): PlayerUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.email) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name || parsed.email.split('@')[0]),
      email: String(parsed.email),
      authProvider: parsed.authProvider === 'email' ? 'email' : 'google',
      referralCode: String(parsed.referralCode || 'LOOT100'),
      referredBy: parsed.referredBy || null,
      availableCoins: Number(parsed.availableCoins) || 0,
      pendingCoins: Number(parsed.pendingCoins) || 0,
      questsCompleted: Number(parsed.questsCompleted) || 0,
      referralsCount: Number(parsed.referralsCount) || 0,
      joinedAt: String(parsed.joinedAt || new Date().toISOString().slice(0, 10)),
      withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
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
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem('lootify_user_id', user.id);

    const accountsRaw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    const accounts: Record<string, any> = accountsRaw ? JSON.parse(accountsRaw) : {};
    const key = user.email.toLowerCase();
    accounts[key] = {
      ...(accounts[key] || {}),
      user,
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
  const hash = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
  if (hash === 'quests' || hash === 'offerwalls' || hash === 'shortlinks' || hash === 'tasks') {
    return 'quests';
  }
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

  // Dynamic Offerwalls state (Offerwall.me active by default)
  const [offerwalls, setOfferwalls] = useState<OfferwallConfig[]>(() => loadCachedOfferwalls());
  const [selectedWallId, setSelectedWallId] = useState<string>('offerwallme');
  const [signedOfferwallMeUrl, setSignedOfferwallMeUrl] = useState<string>('');
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

  // Admin S2S Test Simulator state
  const [testProvider, setTestProvider] = useState('offerwallme');
  const [testUserId, setTestUserId] = useState('');
  const [testCoins, setTestCoins] = useState('500');

  // Cashout form state
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>('upi');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutCoins, setPayoutCoins] = useState('1000');
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const syncUserWithBackend = useCallback(async (currentUser: PlayerUser | null, showFeedback = false) => {
    if (!currentUser) return;
    if (showFeedback) setSyncingWallet(true);
    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/user/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          saveCurrentUser(data.user);
          setUser(data.user);
          if (showFeedback) {
            setSyncStatusMsg(`✅ Synced! Balance: ${data.user.availableCoins} Available Coins`);
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
      if (showFeedback) setSyncingWallet(false);
    }
  }, []);

  const fetchOfferwallsFromBackend = useCallback(async (uid?: string) => {
    const base = getApiBaseUrl();
    const activeUid = uid || loadCurrentUser()?.id || '';
    if (activeUid) {
      buildSignedOfferwallMeUrl(OFFERWALLME_PUBLIC_KEY, activeUid)
        .then((signed) => setSignedOfferwallMeUrl(signed))
        .catch(() => {});
    }
    try {
      const query = activeUid ? `?user_id=${encodeURIComponent(activeUid)}` : '';
      const res = await fetch(`${base}/api/offerwalls${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.offerwalls) && data.offerwalls.length > 0) {
          setOfferwalls(data.offerwalls);
          saveCachedOfferwalls(data.offerwalls);
          const owm = data.offerwalls.find((w: OfferwallConfig) => w.provider_id === 'offerwallme');
          if (owm && owm.signed_iframe_url) {
            setSignedOfferwallMeUrl(owm.signed_iframe_url);
          }
        }
      }
    } catch {
      // Fallback to cached offerwalls + Web Crypto signed Offerwall.me URL
    }
  }, []);

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
    } catch {}

    const initialUser = loadCurrentUser();
    fetchOfferwallsFromBackend(initialUser?.id);
    if (initialUser) {
      syncUserWithBackend(initialUser, false);
    }

    const syncFromEvents = () => {
      const loaded = loadCurrentUser();
      setUser(loaded);
      if (loaded) {
        syncUserWithBackend(loaded, false);
        fetchOfferwallsFromBackend(loaded.id);
      }
      setIsAdminRoute(isHashAdmin());
      setAdminLoggedIn(loadAdminSession());
      setActiveTab(getTabFromHash());
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(currentTheme);
    };

    window.addEventListener('lootify-auth-changed', syncFromEvents);
    window.addEventListener('hashchange', syncFromEvents);
    window.addEventListener('popstate', syncFromEvents);
    return () => {
      window.removeEventListener('lootify-auth-changed', syncFromEvents);
      window.removeEventListener('hashchange', syncFromEvents);
      window.removeEventListener('popstate', syncFromEvents);
    };
  }, [fetchOfferwallsFromBackend, syncUserWithBackend]);

  useEffect(() => {
    if (isAdminRoute && adminLoggedIn) {
      fetchAdminDashboard();
    }
  }, [isAdminRoute, adminLoggedIn, fetchAdminDashboard]);

  const switchTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setIsAdminRoute(false);
    setMobileNavOpen(false);
    setPayoutMessage(null);
    const hashTarget = tab === 'overview' ? '#/dashboard' : `#/${tab}`;
    if (window.location.hash !== hashTarget) {
      window.location.hash = hashTarget;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const universalPostbackPreview = `${effectiveOrigin}/api/postback${newWallMacroQuery}`;

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

          {/* 1. Cloudflare Worker + D1 Backend URL */}
          <div className="card" style={{ padding: 24 }}>
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
          <div className="card" style={{ padding: 24 }}>
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
                    const postbackUrl = `${effectiveOrigin}/api/postback${macroQuery}`;
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

          {/* 3. Live S2S Postback Webhook Simulator */}
          <div className="card" style={{ padding: 24 }}>
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

          {/* 4. Player Withdrawals Queue & Recent Postbacks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
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
                        <div style={{ display: 'flex', gap: 6 }}>
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
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)', marginBottom: 14 }}>
                Recent S2S Postback Logs ({adminPostbacks.length}) &amp; Players ({adminUsers.length})
              </h3>
              {adminPostbacks.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt2)', fontSize: 13, background: 'var(--bg2)', borderRadius: 10 }}>
                  No S2S postbacks received yet. Use the tester above to verify!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {adminPostbacks.slice(0, 10).map((p) => (
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
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{p.title}</div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                          User: {p.user_id} • TX: {p.external_tx_id}
                        </div>
                      </div>
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

  const inrBalance = (user.availableCoins / 100).toFixed(2);
  const pendingInr = (user.pendingCoins / 100).toFixed(2);
  const referralLink = `${window.location.origin}${window.location.pathname}?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2200);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);

    const coinsNum = Math.floor(Number(payoutCoins) || 0);
    if (coinsNum < 1000) {
      setPayoutMessage({ type: 'error', text: 'Minimum withdrawal is 1,000 Coins (₹10).' });
      return;
    }
    if (coinsNum > user.availableCoins) {
      setPayoutMessage({
        type: 'error',
        text: `Insufficient balance. You currently have ${user.availableCoins} available coins.`,
      });
      return;
    }
    if (!payoutDestination.trim()) {
      setPayoutMessage({ type: 'error', text: 'Please enter your payout destination details.' });
      return;
    }

    const channelLabels: Record<PayoutChannel, string> = {
      upi: 'UPI Direct Transfer',
      bank: 'Bank Transfer (IMPS)',
      gift_card: 'Gift Card Voucher',
      crypto: 'Crypto / FaucetPay (USDT / BTC)',
    };

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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          saveCurrentUser(data.user);
          setUser(data.user);
          setPayoutDestination('');
          setPayoutMessage({
            type: 'success',
            text: `Withdrawal request for ₹${(coinsNum / 100).toFixed(2)} (${coinsNum} Coins) submitted to server!`,
          });
          return;
        }
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
      amountInr: Number((coinsNum / 100).toFixed(2)),
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
      text: `Withdrawal request for ₹${newRecord.amountInr} (${coinsNum} Coins) submitted!`,
    });
  };

  const enabledOfferwalls = offerwalls.filter((w) => w.enabled);
  const selectedWall =
    enabledOfferwalls.find((w) => w.provider_id === selectedWallId) || enabledOfferwalls[0] || null;

  const resolvedIframeUrl =
    selectedWall?.signed_iframe_url ||
    (selectedWall?.provider_id === 'offerwallme' && signedOfferwallMeUrl
      ? signedOfferwallMeUrl
      : selectedWall && selectedWall.iframe_url_template
        ? selectedWall.iframe_url_template
            .replace(/\{app_id\}/g, encodeURIComponent((selectedWall.app_id || '').trim()))
            .replace(/\{user_id\}/g, encodeURIComponent(user.id))
        : '');

  return (
    <div className="lootify-v2 grid-bg" data-theme={theme} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

          <div className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'quests', label: 'Offerwalls & Quests' },
                { id: 'referrals', label: 'Refer & Earn' },
                { id: 'wallet', label: 'Cashout' },
              ] as { id: DashboardTab; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className="font-display"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid rgba(0,232,154,0.35)' : '1px solid transparent',
                    background: active ? 'rgba(0,232,154,0.1)' : 'transparent',
                    color: active ? 'var(--green)' : 'var(--txt2)',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
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
                { id: 'overview', label: '⚡ Overview' },
                { id: 'quests', label: '🎮 Offerwalls & Quests' },
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
      <main className="wrap" style={{ flex: 1, width: '100%', padding: '36px 20px 64px' }}>
        {/* Player Header Bar */}
        <div
          className="card"
          style={{
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            background: 'linear-gradient(135deg, rgba(0,232,154,0.06), rgba(155,110,255,0.04))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'linear-gradient(135deg, var(--green), #00A870)',
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
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 className="font-display" style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 700, color: 'var(--txt)' }}>
                  {user.name}
                </h1>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(0,232,154,0.1)',
                    border: '1px solid rgba(0,232,154,0.25)',
                    color: 'var(--green)',
                    fontWeight: 600,
                  }}
                >
                  PLAYER ID: {user.id}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>
                {user.email} &nbsp;•&nbsp; Joined {user.joinedAt}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => syncUserWithBackend(user, true)}
              disabled={syncingWallet}
              className="btn btn-ghost btn-sm"
            >
              {syncingWallet ? '⏳ Syncing...' : '🔄 Sync S2S Coins'}
            </button>
            <button type="button" onClick={() => switchTab('wallet')} className="btn btn-primary btn-sm">
              🏦 Cashout ₹ INR
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

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', letterSpacing: '0.06em', marginBottom: 8 }}>
                  AVAILABLE COINS
                </div>
                <div className="font-mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--green)' }}>
                  {user.availableCoins.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  Cash Value: <strong style={{ color: 'var(--txt)' }}>₹{inrBalance}</strong> (1,000 Coins = ₹10)
                </div>
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', letterSpacing: '0.06em', marginBottom: 8 }}>
                  PENDING ESCROW
                </div>
                <div className="font-mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--gold)' }}>
                  {user.pendingCoins.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  ₹{pendingInr} in verification hold
                </div>
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', letterSpacing: '0.06em', marginBottom: 8 }}>
                  QUESTS COMPLETED
                </div>
                <div className="font-mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--violet)' }}>
                  {user.questsCompleted}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                  Offerwalls, PTC &amp; shortlinks
                </div>
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', letterSpacing: '0.06em', marginBottom: 8 }}>
                  REFERRED PLAYERS
                </div>
                <div className="font-mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--txt)' }}>
                  {user.referralsCount}
                </div>
                <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
                  10% lifetime commission active
                </div>
              </div>
            </div>

            <div className="bento">
              <div className="card qcard span2" style={{ padding: 26 }} onClick={() => switchTab('quests')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      background: 'linear-gradient(135deg,var(--green),#065F46)',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    🎮
                  </div>
                  <div>
                    <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--txt)' }}>
                      Open Live Offerwalls &amp; Micro-Tasks
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                      Verified S2S Postback Offerwalls • Surveys • Shortlinks • Gaming Quests
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 18 }}>
                  Complete PTC ads, paid shortlinks, surveys, and gaming quests with automatic S2S postback credit to your Player ID (<span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span>).
                </p>
                <button type="button" className="btn btn-primary btn-sm">
                  🚀 Launch Offerwalls →
                </button>
              </div>

              <div className="card qcard" style={{ padding: 26 }} onClick={() => switchTab('referrals')}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>👥</div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Refer &amp; Earn
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 16 }}>
                  Share your code <span className="font-mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{user.referralCode}</span> with friends and earn 10% lifetime commission.
                </p>
                <button type="button" className="btn btn-outline btn-sm btn-full">
                  Get Referral Link
                </button>
              </div>
            </div>

            {/* Offerwall.me Official Banner Ad Slots (728x90 & 468x60) */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
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
              <OfferwallMeBanner size="728x90" />
              <OfferwallMeBanner size="468x60" />
            </div>

            <div className="card" style={{ padding: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                  Recent Cashout &amp; Account Activity
                </h3>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                  REAL-TIME LEDGER
                </span>
              </div>

              {user.withdrawals.length === 0 ? (
                <div
                  style={{
                    padding: '32px 20px',
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
                    Your completed offerwall tasks and cashout requests will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {user.withdrawals.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                          {w.methodLabel} — ₹{w.amountInr}
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                          {w.destination} • {w.createdAt}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
                          -{w.coins} Coins
                        </span>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: OFFERWALLS & QUEST MODES (100% Dynamic) ── */}
        {activeTab === 'quests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                  Partner Offerwalls &amp; Micro-Tasks
                </h2>
                <p style={{ fontSize: 14, color: 'var(--txt2)', marginTop: 4 }}>
                  All completions credit automatically via S2S Postback to Player ID{' '}
                  <span className="font-mono" style={{ color: 'var(--green)' }}>
                    {user.id}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => syncUserWithBackend(user, true)}
                className="btn btn-outline btn-sm"
              >
                🔄 Refresh Earned Coins
              </button>
            </div>

            {enabledOfferwalls.length === 0 ? (
              <div
                className="card card-glow"
                style={{
                  padding: '56px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 38, marginBottom: 14 }}>🎮</div>
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Partner Offerwalls Integrating Soon
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', maxWidth: 500, margin: '0 auto 20px', lineHeight: 1.7 }}>
                  Our S2S Postback Engine is live and ready. As soon as partner offerwalls are added in the Admin Panel, they will appear here automatically.
                </p>
                {user.email.toLowerCase() === ADMIN_ALLOWED_EMAIL && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#/admin';
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    ⚙️ Open Admin Panel to Add Offerwall →
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {enabledOfferwalls.map((wall) => {
                    const isSelected = selectedWall?.provider_id === wall.provider_id;
                    return (
                      <button
                        key={wall.provider_id}
                        type="button"
                        onClick={() => setSelectedWallId(wall.provider_id)}
                        style={{
                          textAlign: 'left',
                          padding: '16px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(0,232,154,0.1)' : 'var(--bg2)',
                          border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
                            {wall.name}
                          </span>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 10,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: 'rgba(0,232,154,0.15)',
                              color: 'var(--green)',
                              fontWeight: 600,
                            }}
                          >
                            LIVE
                          </span>
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>
                          {wall.badge}
                        </div>
                      </button>
                    );
                  })}
                </div>

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
                            ? `Rewards go through a ${selectedWall.hold_days}-day anti-fraud hold`
                            : 'Instant S2S Postback credit to Available Balance'}
                        </p>
                      </div>
                      {resolvedIframeUrl && (
                        <a
                          href={resolvedIframeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          ↗ Open Fullscreen in New Tab
                        </a>
                      )}
                    </div>

                    {resolvedIframeUrl ? (
                      <iframe
                        src={resolvedIframeUrl}
                        title={selectedWall.name}
                        style={{
                          width: '100%',
                          height: 680,
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          background: '#0B121E',
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                      />
                    ) : (
                      <div
                        style={{
                          padding: '48px 24px',
                          textAlign: 'center',
                          background: 'var(--bg2)',
                          border: '1px dashed var(--border2)',
                          borderRadius: 12,
                        }}
                      >
                        <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                          Please set the Iframe URL Template for <strong>{selectedWall.name}</strong> in the Admin Panel.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Offerwall.me Multi-Size Banner Ad Showcase (728x90, 468x60, 300x250) */}
                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', letterSpacing: '0.06em' }}>
                      OFFERWALL.ME SPONSORED BANNERS (728×90 • 468×60 • 300×250)
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--green)' }}>
                      DIRECT PLACEMENT ACTIVE
                    </span>
                  </div>
                  <OfferwallMeBanner size="728x90" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}>
                    <OfferwallMeBanner size="468x60" />
                    <OfferwallMeBanner size="300x250" />
                  </div>
                </div>
              </>
            )}
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

        {/* ── TAB 4: CASHOUT WALLET ── */}
        {activeTab === 'wallet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div className="card card-glow" style={{ padding: 28 }}>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>
                Withdraw Earnings
              </h2>
              <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20 }}>
                Minimum withdrawal is <strong>1,000 Coins (₹10)</strong>. Conversion rate: 100 Coins = ₹1 INR (1,000 Coins = ₹10).
              </p>

              <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 8 }}>
                    SELECT PAYOUT CHANNEL
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {(
                      [
                        { id: 'upi', label: '⚡ UPI Transfer' },
                        { id: 'bank', label: '🏦 Bank IMPS' },
                        { id: 'gift_card', label: '🎁 Gift Vouchers' },
                        { id: 'crypto', label: '🪙 Crypto / FaucetPay' },
                      ] as { id: PayoutChannel; label: string }[]
                    ).map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setPayoutChannel(ch.id)}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: payoutChannel === ch.id ? 'rgba(0,232,154,0.12)' : 'var(--bg2)',
                          border: payoutChannel === ch.id ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: payoutChannel === ch.id ? 'var(--green)' : 'var(--txt)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                    {payoutChannel === 'upi'
                      ? 'UPI ID (e.g. name@okaxis)'
                      : payoutChannel === 'bank'
                      ? 'ACCOUNT NO & IFSC CODE'
                      : payoutChannel === 'gift_card'
                      ? 'DELIVERY EMAIL ADDRESS'
                      : 'FAUCETPAY EMAIL OR USDT ADDRESS'}
                  </label>
                  <input
                    type="text"
                    value={payoutDestination}
                    onChange={(e) => setPayoutDestination(e.target.value)}
                    placeholder={
                      payoutChannel === 'upi'
                        ? 'yourname@upi'
                        : payoutChannel === 'bank'
                        ? 'A/C Number & IFSC'
                        : payoutChannel === 'gift_card'
                        ? user.email
                        : 'FaucetPay Email or TRC20 / Polygon Address'
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

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                    COINS TO WITHDRAW (AVAILABLE: {user.availableCoins} COINS)
                  </label>
                  <input
                    type="number"
                    min={1000}
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
                      fontSize: 15,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                    Payout Value:{' '}
                    <strong className="font-mono" style={{ color: 'var(--green)' }}>
                      ₹{((Math.max(0, Number(payoutCoins) || 0)) / 100).toFixed(2)} INR
                    </strong>
                  </div>
                </div>

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

                <button type="submit" className="btn btn-primary btn-full" style={{ padding: '14px' }}>
                  Request Instant Cashout →
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 28 }}>
              <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 14 }}>
                Withdrawal History
              </h3>

              {user.withdrawals.length === 0 ? (
                <div
                  style={{
                    padding: '36px 20px',
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
                          {w.destination} • {w.createdAt}
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
    </div>
  );
}
