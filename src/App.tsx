/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Globe,
  Home,
  LayoutDashboard,
  Link2,
  ListChecks,
  Menu,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BootstrapPayload, PageRoute, ThemeMode } from './types.ts';
import { PublicPages } from './components/PublicPages.tsx';
import { EarnerViews } from './components/EarnerViews.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';
import {
  getClientBootstrap,
  handleClientApiAction,
} from './lib/standaloneWebEngine.ts';

const VALID_ROUTES: PageRoute[] = [
  'home',
  'dashboard',
  'offerwalls',
  'shortlinks',
  'tasks',
  'referrals',
  'wallet',
  'leaderboard',
  'payout-proofs',
  'admin',
  'deploy-guide',
  'terms',
  'privacy',
  'contact',
];

function getInitialRouteFromUrl(): PageRoute {
  const hashClean = window.location.hash.replace(/^#\/?/, '').replace(/\.html$/, '') as PageRoute;
  if (VALID_ROUTES.includes(hashClean)) return hashClean;

  const segments = window.location.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/\.html$/, ''));
  const lastSeg = (segments[segments.length - 1] || 'home') as PageRoute;
  if (VALID_ROUTES.includes(lastSeg)) return lastSeg;
  return 'home';
}

export default function App() {
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      return localStorage.getItem('lootify_user_id') || 'usr_earner_1';
    } catch {
      return 'usr_earner_1';
    }
  });
  const [data, setData] = useState<BootstrapPayload>(() =>
    getClientBootstrap(currentUserId)
  );
  const [activePage, setActivePage] = useState<PageRoute>(getInitialRouteFromUrl);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('lootify_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Auth & Cloudflare Worker Connection Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'database'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regReferral, setRegReferral] = useState('');
  const [workerApiUrl, setWorkerApiUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lootify_worker_api_url') || '';
    } catch {
      return '';
    }
  });

  // Navigate to a website page and update browser URL / hash cleanly
  const navigateToPage = useCallback((page: PageRoute) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    try {
      window.location.hash = page === 'home' ? '' : `#/${page}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Fallback if inside sandboxed iframe
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(getInitialRouteFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3600);
    },
    []
  );

  // Sync Dark / Light Theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lootify_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const resolveApiUrl = useCallback(
    (endpoint: string) => {
      const cleanBase = workerApiUrl.trim().replace(/\/+$/, '');
      if (cleanBase && endpoint.startsWith('/api/')) {
        return `${cleanBase}${endpoint}`;
      }
      return endpoint;
    },
    [workerApiUrl]
  );

  const fetchBootstrap = useCallback(
    async (uid = currentUserId) => {
      try {
        const res = await fetch(resolveApiUrl(`/api/bootstrap?userId=${encodeURIComponent(uid)}`), {
          headers: { 'x-user-id': uid },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error('Static GitHub Pages host detected');
        }
        const payload: BootstrapPayload = await res.json();
        setData(payload);
      } catch {
        // Automatic fallback when hosted as static website on GitHub Pages
        setData(getClientBootstrap(uid));
      }
    },
    [currentUserId, resolveApiUrl]
  );

  useEffect(() => {
    fetchBootstrap(currentUserId);
  }, [currentUserId, fetchBootstrap]);

  const apiPost = async (endpoint: string, body: any = {}) => {
    try {
      const res = await fetch(resolveApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !endpoint.startsWith('/api/postback/')) {
        throw new Error('USE_CLIENT_ENGINE');
      }
      if (endpoint.startsWith('/api/postback/')) {
        if (!res.ok) throw new Error('USE_CLIENT_ENGINE');
        await fetchBootstrap(currentUserId);
        return { ok: true };
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Operation failed');
      }
      if (json.bootstrap) {
        setData(json.bootstrap);
      } else if (json.settings && json.currentUser) {
        setData(json);
      } else if (json.user && json.user.id) {
        // Sync Cloudflare Worker D1 user response into local client state
        const fallbackPayload = handleClientApiAction('POST', endpoint, currentUserId, body);
        setData(fallbackPayload);
        return fallbackPayload;
      } else {
        await fetchBootstrap(currentUserId);
      }
      return json;
    } catch (err: any) {
      if (err.message === 'USE_CLIENT_ENGINE' || err instanceof TypeError || err instanceof SyntaxError) {
        const result = handleClientApiAction('POST', endpoint, currentUserId, body);
        if (result.bootstrap) {
          setData(result.bootstrap);
        } else if (result.settings && result.currentUser) {
          setData(result);
        }
        return result;
      }
      throw err;
    }
  };

  const apiDelete = async (endpoint: string) => {
    try {
      const res = await fetch(resolveApiUrl(endpoint), {
        method: 'DELETE',
        headers: { 'x-user-id': currentUserId },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('USE_CLIENT_ENGINE');
      }
      const json = await res.json();
      if (json.settings && json.currentUser) {
        setData(json);
      } else {
        await fetchBootstrap(currentUserId);
      }
      return json;
    } catch {
      const result = handleClientApiAction('DELETE', endpoint, currentUserId);
      setData(result);
      return result;
    }
  };

  const handleRegisterUser = async (
    name: string,
    email: string,
    referralCodeInput: string,
    password = 'user123'
  ) => {
    try {
      const json = await apiPost('/api/auth/register', {
        name,
        email,
        password,
        referralCodeInput,
      });
      const targetUser = json.currentUser || json.user;
      if (targetUser) {
        setCurrentUserId(targetUser.id);
        localStorage.setItem('lootify_user_id', targetUser.id);
      }
      if (json.settings && json.currentUser) {
        setData(json);
      }
      setAuthModalOpen(false);
      navigateToPage('dashboard');
      notify(
        `Welcome to Lootify.in, ${targetUser?.name || name}! +200 Bonus Coins added to your wallet.`,
        'success'
      );
    } catch (err: any) {
      notify(err.message || 'Registration failed', 'error');
    }
  };

  const handleLoginUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = await apiPost('/api/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });
      const targetUser = json.currentUser || json.user;
      if (targetUser) {
        setCurrentUserId(targetUser.id);
        localStorage.setItem('lootify_user_id', targetUser.id);
      }
      if (json.settings && json.currentUser) {
        setData(json);
      }
      setAuthModalOpen(false);
      navigateToPage(targetUser?.role === 'admin' ? 'admin' : 'dashboard');
      notify(`Signed in as ${targetUser?.name || loginEmail}`, 'success');
    } catch (err: any) {
      notify(err.message || 'Invalid login credentials', 'error');
    }
  };

  const switchDemoAccount = (targetUid: string, targetRoute?: PageRoute) => {
    setCurrentUserId(targetUid);
    localStorage.setItem('lootify_user_id', targetUid);
    if (targetRoute) navigateToPage(targetRoute);
    notify(
      targetUid === 'usr_admin_1'
        ? 'Switched to Website Admin Account (Sarthak)'
        : 'Switched to Website Member Account (Aarav Verma)',
      'info'
    );
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-xl font-bold font-display">Loading Lootify.in Website...</div>
          <p className="text-xs text-slate-500 font-mono">
            Connecting to Multi-Page Website & Escrow Wallet Engine
          </p>
        </div>
      </div>
    );
  }

  const { settings, currentUser } = data;
  const availableInr = currentUser.availableCoins / settings.coinsPerInr;
  const headerAd = data.adPlacements.find((a) => a.slotKey === 'header_banner' && a.enabled);

  const websitePages: Array<{
    id: PageRoute;
    label: string;
    path: string;
  }> = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'dashboard', label: 'My Account', path: '/dashboard' },
    { id: 'offerwalls', label: 'Offerwalls', path: '/offerwalls' },
    { id: 'shortlinks', label: 'Paid Shortlinks', path: '/shortlinks' },
    { id: 'tasks', label: 'Tasks & Quizzes', path: '/tasks' },
    { id: 'referrals', label: 'Refer & Earn', path: '/referrals' },
    { id: 'wallet', label: 'Withdraw Cash', path: '/wallet' },
    { id: 'payout-proofs', label: 'Payment Proofs', path: '/payout-proofs' },
    { id: 'leaderboard', label: 'Leaderboard', path: '/leaderboard' },
    { id: 'deploy-guide', label: 'GitHub Website Setup', path: '/deploy-guide' },
    { id: 'admin', label: 'Website Admin Panel', path: '/admin' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Top 3-Zone Website Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single Website Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateToPage('home');
            }}
            className="text-xl font-extrabold tracking-tight font-display text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0"
          >
            {settings.siteName}.in
          </a>

          {/* Zone 2: 5 Primary Website Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateToPage('home');
              }}
              className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'home'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              Home
            </a>
            <a
              href="/offerwalls"
              onClick={(e) => {
                e.preventDefault();
                navigateToPage('offerwalls');
              }}
              className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'offerwalls'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              Offerwalls
            </a>
            <a
              href="/shortlinks"
              onClick={(e) => {
                e.preventDefault();
                navigateToPage('shortlinks');
              }}
              className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'shortlinks'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              Shortlinks
            </a>
            <a
              href="/referrals"
              onClick={(e) => {
                e.preventDefault();
                navigateToPage('referrals');
              }}
              className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'referrals'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              Refer & Earn
            </a>
            <a
              href="/payout-proofs"
              onClick={(e) => {
                e.preventDefault();
                navigateToPage('payout-proofs');
              }}
              className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'payout-proofs'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              Payment Proofs
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigateToPage('wallet')}
              className="px-4 py-2 text-xs font-mono font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Withdraw: ₹{availableInr.toFixed(2)} ({currentUser.availableCoins.toLocaleString()}{' '}
              Coins)
            </button>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Open Website Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Multi-Page Website Navigation Bar + Theme Switch + Role Switch */}
      <div className="bg-slate-100/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* All Website Page Links */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {websitePages.map((pg) => {
              const isCurrent = activePage === pg.id;
              return (
                <a
                  key={pg.id}
                  href={pg.path}
                  onClick={(e) => {
                    e.preventDefault();
                    if (pg.id === 'admin' && currentUser.role !== 'admin') {
                      switchDemoAccount('usr_admin_1', 'admin');
                    } else {
                      navigateToPage(pg.id);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {pg.label}
                </a>
              );
            })}
          </div>

          {/* Right Controls: Sign In / Account + Role Switch + Theme Switch */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => {
                setAuthTab('login');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Sign In / Register ({currentUser.name.split(' ')[0]})</span>
            </button>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg">
              <button
                onClick={() => switchDemoAccount('usr_earner_1', 'dashboard')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  currentUser.role === 'earner'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                User View
              </button>
              <button
                onClick={() => switchDemoAccount('usr_admin_1', 'admin')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Admin View
              </button>
            </div>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1.5">
            {websitePages.map((pg) => (
              <button
                key={pg.id}
                onClick={() => {
                  if (pg.id === 'admin' && currentUser.role !== 'admin') {
                    switchDemoAccount('usr_admin_1', 'admin');
                  } else {
                    navigateToPage(pg.id);
                  }
                }}
                className={`text-left px-3 py-2 text-xs font-medium rounded-lg ${
                  activePage === pg.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {pg.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Website Announcement Strip */}
      {settings.announcementActive && (
        <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
            <p className="text-slate-700 dark:text-slate-200">
              <strong className="text-emerald-600 dark:text-emerald-400">
                {settings.siteName}.in Official Notice:
              </strong>{' '}
              {settings.announcementText}
            </p>
            <span className="font-mono text-[11px] text-slate-500 shrink-0 hidden sm:inline">
              Pending Hold: {currentUser.pendingCoins.toLocaleString()} Coins (₹
              {(currentUser.pendingCoins / settings.coinsPerInr).toFixed(2)})
            </span>
          </div>
        </div>
      )}

      {/* Full-Width Website Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:py-10 space-y-8">
        {/* Top Website Leaderboard Ad Banner (Monetag / Adsterra) */}
        {headerAd && activePage !== 'admin' && (
          <div className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 mr-2">
                [Sponsored · {headerAd.network}]
              </span>
              <span className="text-slate-600 dark:text-slate-300">{headerAd.title}</span>
            </div>
            <button
              onClick={() => navigateToPage('offerwalls')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            >
              Explore Partner Offers →
            </button>
          </div>
        )}

        {/* Active Website Page Content */}
        {activePage === 'admin' ? (
          <AdminConsole
            data={data}
            apiPost={apiPost}
            apiDelete={apiDelete}
            notify={notify}
          />
        ) : [
            'home',
            'payout-proofs',
            'leaderboard',
            'deploy-guide',
            'terms',
            'privacy',
            'contact',
          ].includes(activePage) ? (
          <PublicPages
            data={data}
            activePage={activePage}
            onNavigate={navigateToPage}
            onRegisterUser={handleRegisterUser}
            notify={notify}
          />
        ) : (
          <EarnerViews
            data={data}
            activePage={activePage}
            onNavigate={navigateToPage}
            apiPost={apiPost}
            refreshData={() => fetchBootstrap(currentUserId)}
            notify={notify}
          />
        )}
      </main>

      {/* Full 4-Column Multi-Page Website Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-12 mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="space-y-3">
            <div className="text-lg font-extrabold font-display text-emerald-600 dark:text-emerald-400">
              {settings.siteName}.in
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              India’s standalone multi-earning website powered by verified Offerwalls, Shortlinks,
              Quizzes, and a 3-Layer Refer & Earn system with instant UPI, Bank, Gift Card, and
              Crypto cashouts.
            </p>
            <p className="font-mono text-slate-500">
              Conversion Rate: {settings.coinsPerInr} Coins = ₹1.00 INR
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Website Earning Pages
            </h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li>
                <button onClick={() => navigateToPage('dashboard')} className="hover:underline">
                  My Earning Account (/dashboard)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('offerwalls')} className="hover:underline">
                  Notik.me & Lootably Offerwalls (/offerwalls)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('shortlinks')} className="hover:underline">
                  ShrinkMe & GPLinks Shortlinks (/shortlinks)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('tasks')} className="hover:underline">
                  Social Tasks, Quizzes & Articles (/tasks)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('referrals')} className="hover:underline">
                  Refer & Earn 10% Commission (/referrals)
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Payouts & Public Proofs
            </h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li>
                <button onClick={() => navigateToPage('wallet')} className="hover:underline">
                  Withdraw via UPI / Bank / Crypto (/wallet)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('payout-proofs')} className="hover:underline">
                  Live Verified Payment Proofs (/payout-proofs)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('leaderboard')} className="hover:underline">
                  Top Earners Leaderboard (/leaderboard)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('admin')} className="hover:underline">
                  Website Admin Control Center (/admin)
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Legal & Website Hosting
            </h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li>
                <button onClick={() => navigateToPage('terms')} className="hover:underline">
                  Terms of Service & Anti-Fraud (/terms)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('privacy')} className="hover:underline">
                  Privacy & Cookie Policy (/privacy)
                </button>
              </li>
              <li>
                <button onClick={() => navigateToPage('contact')} className="hover:underline">
                  Contact & Publisher Support (/contact)
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateToPage('deploy-guide')}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  GitHub Pages + Custom Domain Guide (/deploy-guide)
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            © 2026 {settings.siteName}.in — Standalone Web Platform (Hosted on GitHub Pages +
            Cloudflare D1 SQL).
          </span>
          <span>Zero Mobile App Required · 100% Browser Compatible</span>
        </div>
      </footer>

      {/* Sign In / Create Account & Cloudflare D1 Database Connection Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold font-display text-slate-900 dark:text-white">
                  {settings.siteName}.in Account & Database
                </h3>
                <p className="text-xs text-slate-500">
                  Powered by Cloudflare D1 SQL (Unlimited Users · Zero Auth Limits)
                </p>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <button
                onClick={() => setAuthTab('login')}
                className={`py-2 rounded-lg transition-colors ${
                  authTab === 'login'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`py-2 rounded-lg transition-colors ${
                  authTab === 'register'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Create Account
              </button>
              <button
                onClick={() => setAuthTab('database')}
                className={`py-2 rounded-lg transition-colors ${
                  authTab === 'database'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Connect DB
              </button>
            </div>

            {authTab === 'login' && (
              <form onSubmit={handleLoginUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="aarav@lootify.in or admin@lootify.in"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                >
                  Sign In to Account →
                </button>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Quick Test Accounts:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail('aarav@lootify.in');
                        setLoginPassword('123456');
                      }}
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Fill Member
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail('admin@lootify.in');
                        setLoginPassword('admin123');
                      }}
                      className="text-amber-500 font-semibold hover:underline"
                    >
                      Fill Admin
                    </button>
                  </div>
                </div>
              </form>
            )}

            {authTab === 'register' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegisterUser(regName, regEmail, regReferral, regPassword);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rohit Sharma"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Create Password
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Referral Code (Optional — Get +200 Bonus Coins)
                  </label>
                  <input
                    type="text"
                    value={regReferral}
                    onChange={(e) => setRegReferral(e.target.value.toUpperCase())}
                    placeholder="LOOT-AARAV"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                >
                  Create Free Account (+200 Coins) →
                </button>
              </form>
            )}

            {authTab === 'database' && (
              <div className="space-y-3.5 text-xs">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Paste your <strong>Cloudflare Worker URL</strong> below after setting up Cloudflare
                  D1 (`functions/schema.sql` + `functions/worker.js`). Leave blank to run in Instant
                  Browser Storage mode.
                </p>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Cloudflare Worker Backend URL
                  </label>
                  <input
                    type="url"
                    value={workerApiUrl}
                    onChange={(e) => setWorkerApiUrl(e.target.value)}
                    placeholder="https://lootify-api.yourname.workers.dev"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('lootify_worker_api_url', workerApiUrl.trim());
                      notify(
                        workerApiUrl.trim()
                          ? `Connected to Cloudflare Worker: ${workerApiUrl.trim()}`
                          : 'Using Standalone Browser Database Mode',
                        'success'
                      );
                      setAuthModalOpen(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                  >
                    Save Database URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalOpen(false);
                      navigateToPage('deploy-guide');
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    View SQL & Worker Code
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex items-center gap-3 text-xs font-medium">
          <span
            className={
              toast.type === 'error'
                ? 'text-red-500 font-bold'
                : toast.type === 'success'
                ? 'text-emerald-500 font-bold'
                : 'text-amber-500 font-bold'
            }
          >
            {toast.type === 'error' ? 'Alert' : toast.type === 'success' ? 'Success' : 'Info'}
          </span>
          <span className="text-slate-800 dark:text-slate-100">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
