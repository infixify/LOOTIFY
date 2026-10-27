import React, { useEffect, useState } from 'react';
import { DashboardTab, PayoutChannel, PlayerUser, ThemeMode, WithdrawalRecord } from './types.ts';

const STORAGE_USER_KEY = 'lootify_player_user';
const STORAGE_ACCOUNTS_KEY = 'lootify_registered_accounts';

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

    // Also update in registered accounts map so balances persist across logins
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
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => getTabFromHash());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' ? 'light' : 'dark';
  });
  const [copiedRef, setCopiedRef] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Cashout form state
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>('upi');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutCoins, setPayoutCoins] = useState('100');
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    // Clear legacy fake keys from earlier versions
    try {
      localStorage.removeItem('lootify_client_db_v1');
    } catch {}

    const syncFromEvents = () => {
      setUser(loadCurrentUser());
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
  }, []);

  const switchTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    setPayoutMessage(null);
    const hashTarget = tab === 'overview' ? '#/dashboard' : `#/${tab}`;
    if (window.location.hash !== hashTarget) {
      window.location.hash = hashTarget;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.location.hash = '';
    if (typeof (window as any).syncLandingAndAppVisibility === 'function') {
      (window as any).syncLandingAndAppVisibility();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!user) {
    return (
      <div className="lootify-v2 grid-bg" data-theme={theme} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card card-glow" style={{ maxWidth: 420, width: '100%', padding: '32px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,var(--green),#00A870)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 22, color: '#03100A', margin: '0 auto 16px', boxShadow: '0 0 16px rgba(0,232,154,0.35)' }}>
            L
          </div>
          <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
            Player Session Required
          </h2>
          <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: 24 }}>
            Please sign in or create your account on the Lootify home page to access your Player Dashboard.
          </p>
          <button type="button" onClick={goBackToLanding} className="btn btn-primary btn-full">
            Go to Sign Up / Login →
          </button>
        </div>
      </div>
    );
  }

  const inrBalance = (user.availableCoins / 10).toFixed(2);
  const pendingInr = (user.pendingCoins / 10).toFixed(2);
  const referralLink = `${window.location.origin}${window.location.pathname}?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2200);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);

    const coinsNum = Math.floor(Number(payoutCoins) || 0);
    if (coinsNum < 100) {
      setPayoutMessage({ type: 'error', text: 'Minimum withdrawal is 100 Coins (₹10).' });
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
      crypto: 'Crypto (USDT / BTC)',
    };

    const newRecord: WithdrawalRecord = {
      id: 'wd_' + Date.now().toString(36),
      method: payoutChannel,
      methodLabel: channelLabels[payoutChannel],
      destination: payoutDestination.trim(),
      coins: coinsNum,
      amountInr: Number((coinsNum / 10).toFixed(2)),
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

  return (
    <div className="lootify-v2 grid-bg" data-theme={theme} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── TOP NAVBAR (Same theme as Landing Page) ── */}
      <nav id="navbar">
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Brand */}
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

          {/* Desktop Tabs */}
          <div className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'quests', label: 'Quest Modes' },
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

          {/* Right Controls */}
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

        {/* Mobile Drawer */}
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
                { id: 'quests', label: '🎮 Quest Modes' },
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
                  PLAYER ID: {user.id.toUpperCase().slice(0, 10)}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>
                {user.email} &nbsp;•&nbsp; Joined {user.joinedAt}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={goBackToLanding} className="btn btn-ghost btn-sm">
              ← Landing Page
            </button>
            <button type="button" onClick={() => switchTab('wallet')} className="btn btn-primary btn-sm">
              🏦 Cashout ₹ INR
            </button>
          </div>
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 4 Real Stat Cards */}
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
                  Cash Value: <strong style={{ color: 'var(--txt)' }}>₹{inrBalance}</strong> (10 Coins = ₹1)
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
                  ₹{pendingInr} in 3–5 day verification hold
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
                  Offerwalls, shortlinks &amp; micro-tasks
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
                  Lifetime commission active
                </div>
              </div>
            </div>

            {/* Quick Action Bento */}
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
                      Explore Quest Modes
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                      Gaming Offerwalls, Paid Shortlinks &amp; Social Micro-Tasks
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 18 }}>
                  Complete game quests, surveys, shortlinks, and micro-tasks to earn Lootify Coins directly into your wallet.
                </p>
                <button type="button" className="btn btn-primary btn-sm">
                  🚀 Open Quest Modes →
                </button>
              </div>

              <div className="card qcard" style={{ padding: 26 }} onClick={() => switchTab('referrals')}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>👥</div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Refer &amp; Earn
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 16 }}>
                  Share your code <span className="font-mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{user.referralCode}</span> with friends and earn lifetime commission.
                </p>
                <button type="button" className="btn btn-outline btn-sm btn-full">
                  Get Referral Link
                </button>
              </div>
            </div>

            {/* Recent Activity / Withdrawals */}
            <div className="card" style={{ padding: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>
                  Recent Account Activity
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
                    Your completed quests, referral commissions, and cashout requests will appear here.
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

        {/* ── TAB 2: QUEST MODES ── */}
        {activeTab === 'quests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--txt)' }}>
                Quest Modes
              </h2>
              <p style={{ fontSize: 14, color: 'var(--txt2)', marginTop: 4 }}>
                Select a quest category below. All earnings are verified via real S2S postbacks.
              </p>
            </div>

            <div className="bento">
              {/* Offerwalls */}
              <div className="card span2" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
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
                      Gaming &amp; CPI Offerwalls
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                      S2S Postback Verified • 3–5 Day Anti-Fraud Escrow
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 16 }}>
                  Download mobile or PC games, complete in-game milestones, and finish surveys from verified offerwall partners.
                </p>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 10,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    color: 'var(--txt2)',
                  }}
                >
                  ⚡ Partner offerwall SDKs are linked to your Player ID (<span className="font-mono" style={{ color: 'var(--green)' }}>{user.id}</span>). Live campaigns will appear here automatically once enabled for your region.
                </div>
              </div>

              {/* Shortlinks */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>🔗</div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Paid Shortlinks Arena
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 14 }}>
                  Complete daily shortlinks with 24-hour auto-reset cooldowns and instant S2S credit.
                </p>
                <div
                  className="font-mono"
                  style={{
                    padding: '12px',
                    borderRadius: 8,
                    background: 'rgba(255,180,0,0.06)',
                    border: '1px solid rgba(255,180,0,0.2)',
                    fontSize: 12,
                    color: 'var(--gold)',
                    textAlign: 'center',
                  }}
                >
                  0 Active Links Available Right Now
                </div>
              </div>

              {/* Micro-tasks */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📋</div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>
                  Micro-Tasks &amp; Social
                </h3>
                <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 14 }}>
                  Social quests, app reviews, and community tasks with proof verification.
                </p>
                <div
                  className="font-mono"
                  style={{
                    padding: '12px',
                    borderRadius: 8,
                    background: 'rgba(155,110,255,0.06)',
                    border: '1px solid rgba(155,110,255,0.2)',
                    fontSize: 12,
                    color: 'var(--violet)',
                    textAlign: 'center',
                  }}
                >
                  No Active Micro-Tasks Queued
                </div>
              </div>

              {/* Refer & Earn */}
              <div className="card span2" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>
                    👥 Want to earn passively?
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                    Invite your squad with your referral link and earn lifetime commission on every quest they complete.
                  </p>
                </div>
                <button type="button" onClick={() => switchTab('referrals')} className="btn btn-primary btn-sm">
                  Open Refer &amp; Earn →
                </button>
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
                    width: 50,
                    height: 50,
                    background: 'linear-gradient(135deg,var(--violet),#6D28D9)',
                    borderRadius: 12,
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
                    Refer &amp; Earn Lifetime Commission
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
                    Share your unique link. Earn 10% lifetime commission on your friends&apos; quest rewards.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 20,
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', fontWeight: 600, marginBottom: 4 }}>
                    YOUR PERSONAL REFERRAL LINK
                  </div>
                  <div className="font-mono" style={{ fontSize: 13, color: 'var(--green)', wordBreak: 'break-all' }}>
                    {referralLink}
                  </div>
                </div>
                <button type="button" onClick={copyReferral} className="btn btn-primary btn-sm">
                  {copiedRef ? '✅ Copied!' : '📋 Copy Link'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 20 }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', fontWeight: 600 }}>YOUR REFERRAL CODE</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginTop: 6 }}>
                    {user.referralCode}
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', fontWeight: 600 }}>TOTAL REFERRED FRIENDS</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', marginTop: 6 }}>
                    {user.referralsCount}
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', fontWeight: 600 }}>COMMISSION RATE</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--violet)', marginTop: 6 }}>
                    10% Lifetime
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: CASHOUT WALLET ── */}
        {activeTab === 'wallet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Left: Cashout Form */}
            <div className="card card-glow" style={{ padding: 28 }}>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>
                Instant Cashout Request
              </h2>
              <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20 }}>
                Available Balance:{' '}
                <strong className="font-mono" style={{ color: 'var(--green)' }}>
                  {user.availableCoins} Coins (₹{inrBalance})
                </strong>
              </p>

              <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 8 }}>
                    SELECT CASHOUT CHANNEL
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(
                      [
                        { id: 'upi', label: '🏦 UPI Transfer' },
                        { id: 'bank', label: '🏛️ Bank IMPS' },
                        { id: 'gift_card', label: '🛒 Gift Cards' },
                        { id: 'crypto', label: '💰 USDT / BTC' },
                      ] as { id: PayoutChannel; label: string }[]
                    ).map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setPayoutChannel(ch.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          background: payoutChannel === ch.id ? 'rgba(0,232,154,0.12)' : 'var(--bg2)',
                          border: payoutChannel === ch.id ? '1.5px solid var(--green)' : '1px solid var(--border)',
                          color: payoutChannel === ch.id ? 'var(--green)' : 'var(--txt)',
                        }}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                    {payoutChannel === 'upi' && 'ENTER UPI ID (e.g. name@okaxis)'}
                    {payoutChannel === 'bank' && 'ENTER ACCOUNT NO & IFSC CODE'}
                    {payoutChannel === 'gift_card' && 'ENTER EMAIL FOR VOUCHER DELIVERY'}
                    {payoutChannel === 'crypto' && 'ENTER USDT (TRC20/BEP20) OR BTC ADDRESS'}
                  </label>
                  <input
                    type="text"
                    value={payoutDestination}
                    onChange={(e) => setPayoutDestination(e.target.value)}
                    placeholder={
                      payoutChannel === 'upi'
                        ? 'player@upi'
                        : payoutChannel === 'bank'
                        ? 'A/C Number + IFSC'
                        : payoutChannel === 'gift_card'
                        ? user.email
                        : '0x... or T...'
                    }
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border2)',
                      color: 'var(--txt)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                    COINS TO WITHDRAW (MIN 100 COINS = ₹10)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={10}
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
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 6 }}>
                    You will receive:{' '}
                    <strong className="font-mono" style={{ color: 'var(--green)' }}>
                      ₹{((Math.max(0, Number(payoutCoins) || 0)) / 10).toFixed(2)} INR
                    </strong>
                  </div>
                </div>

                {payoutMessage && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      background:
                        payoutMessage.type === 'success' ? 'rgba(0,232,154,0.1)' : 'rgba(255,85,102,0.1)',
                      border:
                        payoutMessage.type === 'success'
                          ? '1px solid rgba(0,232,154,0.3)'
                          : '1px solid rgba(255,85,102,0.3)',
                      color: payoutMessage.type === 'success' ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {payoutMessage.text}
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-full">
                  🚀 Submit Cashout Request
                </button>
              </form>
            </div>

            {/* Right: Withdrawal History */}
            <div className="card" style={{ padding: 28 }}>
              <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>
                Your Cashout History
              </h3>

              {user.withdrawals.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: 'var(--bg2)',
                    border: '1px dashed var(--border2)',
                    borderRadius: 12,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>
                    No cashouts yet
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--txt2)' }}>
                    Once you earn at least 100 Coins (₹10), you can request an instant payout here.
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
                          ₹{w.amountInr} via {w.methodLabel}
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                          {w.destination} • {w.createdAt}
                        </div>
                      </div>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 11,
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

      {/* ── SIMPLE FOOTER ── */}
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
            © 2026 Lootify.in — Player Dashboard
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="live-dot" style={{ width: 6, height: 6 }}></div>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>
              Connected as {user.email}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
