import React, { useState } from 'react';
import {
  ArrowRight,
  Copy,
  Download,
  FileCode,
  Globe,
  Server,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { BootstrapPayload, PageRoute, PayoutMethodType } from '../types.ts';
import {
  generateCloudflareD1SchemaSql,
  generateCloudflareWorkerCode,
} from '../lib/cloudflareDeploymentTemplates.ts';

interface PublicPagesProps {
  data: BootstrapPayload;
  activePage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  onRegisterUser: (
    name: string,
    email: string,
    referralCode: string,
    password?: string
  ) => Promise<void>;
  onLoginUser?: (email: string, password: string) => Promise<void>;
  onGoogleAuth?: (params: {
    name: string;
    email: string;
    referralCodeInput?: string;
    credential?: string;
  }) => Promise<void>;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PublicPages: React.FC<PublicPagesProps> = ({
  data,
  activePage,
  onNavigate,
  onRegisterUser,
  onLoginUser,
  onGoogleAuth,
  theme = 'dark',
  onToggleTheme,
  notify,
}) => {
  const { settings, publicPayoutProofs, leaderboard } = data;

  // Interactive Calculator State (Lootify v2)
  const [calcOffersPerDay, setCalcOffersPerDay] = useState(5);
  const [calcShortlinksPerDay, setCalcShortlinksPerDay] = useState(10);
  const [calcActiveReferrals, setCalcActiveReferrals] = useState(3);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Landing Page Hero Auth Card State ('register' | 'login')
  const [heroAuthMode, setHeroAuthMode] = useState<'register' | 'login'>('register');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRefCode, setRegRefCode] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Google Sign-In Account Picker & Client ID Setup State
  const DEFAULT_GOOGLE_CLIENT_ID =
    '881444436109-t1v1a42d9l8v7ibnqplnebdkdlqp15v7.apps.googleusercontent.com';
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    try {
      return localStorage.getItem('lootify_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
    } catch {
      return DEFAULT_GOOGLE_CLIENT_ID;
    }
  });

  // Payout Proof Filter
  const [proofFilter, setProofFilter] = useState<'all' | PayoutMethodType>('all');

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  // Copy helper
  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    notify(`${label} copied to clipboard!`, 'success');
  };

  // Download file helper
  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded ${filename}`, 'success');
  };

  const dailyOfferCoins = calcOffersPerDay * 650;
  const dailyShortlinkCoins = calcShortlinksPerDay * 85;
  const dailyRefCommissionCoins = Math.round(
    calcActiveReferrals * 300 * (settings.referralCommissionPercent / 100)
  );
  const totalDailyCoins = dailyOfferCoins + dailyShortlinkCoins + dailyRefCommissionCoins;
  const totalDailyInr = totalDailyCoins / settings.coinsPerInr;
  const totalMonthlyInr = totalDailyInr * 30;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      notify('Please enter your name and email address.', 'error');
      return;
    }
    setRegSubmitting(true);
    try {
      await onRegisterUser(regName, regEmail, regRefCode, regPassword || 'user123');
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      onNavigate('dashboard');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleHeroLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      notify('Please enter your email and password.', 'error');
      return;
    }
    setLoginSubmitting(true);
    try {
      if (onLoginUser) {
        await onLoginUser(loginEmail, loginPassword);
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const triggerGoogleSignIn = () => {
    const cleanClientId = (googleClientId || DEFAULT_GOOGLE_CLIENT_ID).trim();
    const win = window as any;

    // 1. Prefer Google Identity Services OAuth2 Token Popup (opens real Google account selector popup on every click)
    if (cleanClientId && win.google?.accounts?.oauth2) {
      try {
        const tokenClient = win.google.accounts.oauth2.initTokenClient({
          client_id: cleanClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token && onGoogleAuth) {
              try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await profileRes.json();
                if (profile?.email) {
                  await onGoogleAuth({
                    name: profile.name || profile.given_name || profile.email.split('@')[0],
                    email: profile.email,
                    referralCodeInput: regRefCode,
                  });
                }
              } catch {
                notify('Could not fetch Google profile details.', 'error');
              }
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch {
        // Fallback to One-Tap or Account Chooser modal below
      }
    }

    // 2. Fallback to Google One-Tap Credential prompt
    if (cleanClientId && win.google?.accounts?.id) {
      win.google.accounts.id.initialize({
        client_id: cleanClientId,
        callback: async (response: any) => {
          if (response?.credential && onGoogleAuth) {
            await onGoogleAuth({
              name: '',
              email: '',
              referralCodeInput: regRefCode,
              credential: response.credential,
            });
          }
        },
      });
      win.google.accounts.id.prompt();
      return;
    }

    // 3. Fallback interactive Google Account Chooser modal
    setGoogleChooserOpen(true);
  };

  if (activePage === 'payout-proofs') {
    const filteredProofs =
      proofFilter === 'all'
        ? publicPayoutProofs
        : publicPayoutProofs.filter((p) => p.method === proofFilter);

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
              Verified Public Ledger · Real-Time Payouts
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Live Withdrawal Proofs
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Every real UPI, Bank Transfer, Gift Card, E-Wallet, and USDT payout processed on{' '}
              {settings.siteName}.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg overflow-x-auto">
            {(['all', 'upi', 'bank', 'gift_card', 'ewallet', 'crypto'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setProofFilter(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  proofFilter === m
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m === 'all'
                  ? 'All Rails'
                  : m === 'upi'
                  ? 'UPI'
                  : m === 'bank'
                  ? 'Bank IMPS'
                  : m === 'gift_card'
                  ? 'Gift Cards'
                  : m === 'ewallet'
                  ? 'Paytm/Wallet'
                  : 'Crypto USDT'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filteredProofs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                No Live Withdrawals Recorded Yet
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                This table displays 100% real user payouts from the database. Complete any 1 Offerwall or 3 Shortlinks to request the first ₹{settings.starterPayoutInr} Starter UPI Payout!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">Earner</th>
                    <th className="py-3.5 px-4">Payout Rail</th>
                    <th className="py-3.5 px-4">Tier</th>
                    <th className="py-3.5 px-4 text-right">Coins Redeemed</th>
                    <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                    <th className="py-3.5 px-4">UTR / Voucher Proof</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredProofs.map((w) => (
                    <tr
                      key={w.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        {w.userName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 uppercase">
                        {w.method.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {w.tierLabel}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {w.coinsDeducted.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{w.amountInr.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {w.utrOrVoucher || 'Processing in Queue'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">
                        {w.status === 'approved' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Paid & Verified
                          </span>
                        ) : w.status === 'pending' ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            In Verification Queue
                          </span>
                        ) : (
                          <span className="text-red-500">Refunded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activePage === 'leaderboard') {
    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
              Top Earners & Referrers · Updated Live
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {settings.siteName} Hall of Fame
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Earn coins from Offerwalls, Shortlinks, and 10% Lifetime Referral Commissions to climb
              the ranks.
            </p>
          </div>
          <button
            onClick={() => onNavigate('referrals')}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Invite Friends & Climb Rank
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {leaderboard.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Leaderboard is Ready for Real Earners
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Sign in with Google or create your account to earn your first +200 Welcome Bonus Coins and claim Rank #1 on the live leaderboard!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">Rank</th>
                    <th className="py-3.5 px-4">Earner Name</th>
                    <th className="py-3.5 px-4">Standing</th>
                    <th className="py-3.5 px-4 text-right">Active Referrals</th>
                    <th className="py-3.5 px-4 text-right">Lifetime Coins</th>
                    <th className="py-3.5 px-4 text-right">INR Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {leaderboard.map((row) => (
                    <tr
                      key={row.rank}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        #{row.rank}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Trophy
                          className={`w-4 h-4 ${
                            row.rank === 1
                              ? 'text-amber-500'
                              : row.rank === 2
                              ? 'text-slate-400'
                              : row.rank === 3
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        />
                        {row.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {row.badge}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.referralsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                        {row.lifetimeEarnedCoins.toLocaleString()} Coins
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{(row.lifetimeEarnedCoins / settings.coinsPerInr).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activePage === 'deploy-guide') {
    const workerCode = generateCloudflareWorkerCode(settings);
    const d1Schema = generateCloudflareD1SchemaSql();

    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            Easy Hinglish Step-by-Step Deployment Guide
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            GitHub Push + Custom Domain + Cloudflare Setup Guide
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Complete step-by-step guide aur 1-Click Setup Files for {settings.customDomain}.
          </p>
        </div>

        {/* 4 Easy Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                STEP 01 · AI STUDIO TO GITHUB
              </span>
              <Globe className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold">
              1. AI Studio Se Seedha GitHub Repo Me Push Kese Karein?
            </h3>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                AI Studio ke top-right bar me aapko <strong>GitHub Icon / Export to GitHub</strong>{' '}
                button dikhega (ya <strong>Download ZIP</strong> option).
              </li>
              <li>
                Uspe click karein, apna GitHub account connect karein, aur{' '}
                <strong>Create New Repository</strong> me naam dalein: <code>LOOTIFY</code>.
              </li>
              <li>
                Jaise hi code GitHub pe jayega, aapki website automatic build aur live ho jayegi.
              </li>
            </ol>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                STEP 02 · GITHUB PAGES + CUSTOM DOMAIN
              </span>
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold">
              2. GitHub Pages Par Apna Custom Domain ({settings.customDomain}) Kese Lagayein?
            </h3>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                Apne GitHub Repo me jayein → <strong>Settings</strong> → <strong>Pages</strong> par
                click karein.
              </li>
              <li>
                Niche <strong>Custom domain</strong> box me apna domain (jaise{' '}
                <code>{settings.customDomain}</code>) daal kar Save karein aur{' '}
                <strong>Enforce HTTPS</strong> tick kar dein.
              </li>
            </ol>
            <div className="pt-2">
              <button
                onClick={() => downloadFile('CNAME', settings.customDomain)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download CNAME File ({settings.customDomain})
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                STEP 03 · FREE CLOUDFLARE D1 SQL DATABASE
              </span>
              <Server className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold">
              3. Database (50 Lakh Reads/Day Free) Kaha Aur Kese Banayein?
            </h3>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                <a
                  href="https://dash.cloudflare.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-500 underline"
                >
                  dash.cloudflare.com
                </a>{' '}
                par free account kholein.
              </li>
              <li>
                Left menu me <strong>Workers & Pages → D1 SQL Database</strong> par jayein aur{' '}
                <strong>Create Database</strong> (naam: <code>lootify-db</code>) karein.
              </li>
              <li>
                Niche diya gaya <strong>SQL Schema Copy</strong> karein aur D1 ke{' '}
                <strong>Console</strong> box me paste karke Run kar dein.
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => copyText(d1Schema, 'Cloudflare D1 SQL Schema')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy D1 SQL Schema
              </button>
              <button
                onClick={() => downloadFile('schema.sql', d1Schema)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download schema.sql
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                STEP 04 · OFFERWALL S2S BACKEND ({settings.apiSubdomain})
              </span>
              <FileCode className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold">
              4. Offerwall Postback Backend (Zero-Sleep Worker) Kese Lagayein?
            </h3>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                Cloudflare me <strong>Workers & Pages → Create Worker</strong> karein (naam:{' '}
                <code>lootify-api</code>).
              </li>
              <li>
                Worker ke <strong>Settings → Bindings</strong> me जाकर <code>DB</code> naam se apna{' '}
                <code>lootify-db</code> D1 database link kar dein.
              </li>
              <li>
                Niche se <strong>worker.js Code Copy</strong> karke Worker me paste karein aur{' '}
                <strong>Deploy</strong> dabayein!
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => copyText(workerCode, 'Cloudflare Worker Backend Code')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy worker.js Code
              </button>
              <button
                onClick={() => downloadFile('worker.js', workerCode)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download worker.js
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePage === 'terms' || activePage === 'privacy' || activePage === 'contact') {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          {(['terms', 'privacy', 'contact'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activePage === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab === 'terms'
                ? 'Terms & Anti-Fraud Rules'
                : tab === 'privacy'
                ? 'Privacy & Cookie Policy'
                : 'Contact & Publisher Support'}
            </button>
          ))}
        </div>

        {activePage === 'terms' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8 space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Terms of Service & Anti-Fraud Survival Policy — {settings.siteName}
            </h1>
            <p className="text-xs text-slate-500">
              Domain: https://{settings.customDomain} · Effective Year: 2026
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                1. Single Account & Zero VPN/Proxy Mandate
              </h3>
              <p>
                Each individual user is permitted strictly one account per household, IP address, and
                device fingerprint. Using VPNs, proxies, emulators, or automated shortlink bypass
                scripts is strictly prohibited and triggers immediate permanent suspension.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                2. Mandatory {settings.pendingHoldDays}-Day Pending Escrow Hold
              </h3>
              <p>
                To protect publisher accounts and prevent fraudulent reversals, high-value
                Offerwall completions (Notik.me, Lootably) are held in a {settings.pendingHoldDays}
                -day Pending Balance state before moving to Withdrawable Balance. Any offerwall
                chargeback received during this window automatically reverses the pending coins.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                3. Progressive Withdrawal Tiers
              </h3>
              <p>
                New verified members qualify for a ₹{settings.starterPayoutInr} Starter Trust
                Payout after completing at least 1 Offerwall offer or 3 Shortlinks. Subsequent
                payouts operate at progressive tiers (₹{settings.tier2PayoutInr}, ₹
                {settings.tier3PayoutInr}, and ₹{settings.tier4PayoutInr}) across UPI, Bank
                Transfer, Gift Cards, E-Wallets, and USDT.
              </p>
            </div>
          </div>
        )}

        {activePage === 'privacy' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8 space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Privacy Policy & Offerwall Tracking Disclosure
            </h1>
            <p>
              {settings.siteName} collects only essential account identifiers (Name, Email, IP
              Address for fraud & cooldown verification, and your selected withdrawal address such as
              UPI ID or Wallet address).
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                Third-Party Offerwalls & Shortlink Partners
              </h3>
              <p>
                When you open an offerwall (Notik.me, Lootably) or shortlink (ShrinkMe.io, GPLinks),
                we pass your anonymous internal User ID (<code>sub_id</code>) so our S2S postback
                server can credit your wallet upon task completion. We never sell your personal
                email or payout credentials to third parties.
              </p>
            </div>
          </div>
        )}

        {activePage === 'contact' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Contact {settings.siteName} Support & Business Desk
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                For missing offerwall credits, payout UTR inquiries, or ad network verification on{' '}
                {settings.customDomain}.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                notify(
                  'Support ticket submitted! Our team will respond within 24 hours.',
                  'success'
                );
                setContactName('');
                setContactEmail('');
                setContactMsg('');
              }}
              className="space-y-4 max-w-xl"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Message / Transaction ID</label>
                <textarea
                  rows={4}
                  required
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  placeholder="Describe your inquiry or paste your Offerwall Transaction ID..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                Send Support Ticket
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Default: LOOTIFY V2 GAMING REWARDS LANDING PAGE ('home')
  const v2MonthlyCoins = Math.round(
    calcOffersPerDay * 4 * 1200 +
      calcShortlinksPerDay * 20 * 30 +
      calcActiveReferrals * 50 +
      calcActiveReferrals * 500 * 0.1
  );
  const v2MonthlyInr = Math.round(v2MonthlyCoins / 10);

  const v2Faqs = [
    {
      q: 'Is Lootify legit? Will I actually get paid?',
      a: 'Yes! Lootify is a real GPT (Get-Paid-To) platform operating with transparent coin economics. We use S2S postback verification with all offerwall partners. Withdrawals are processed via verified UPI, bank transfer, and voucher codes.',
    },
    {
      q: 'Why are some earnings in "Pending Hold"?',
      a: 'Offerwall and advertiser rewards go through a mandatory 3–5 day anti-fraud escrow period. This protects both players and advertisers from fraudulent chargebacks. After verification, coins auto-release into your Available Balance.',
    },
    {
      q: 'What cashout methods are supported?',
      a: 'Direct Transfer: UPI and Bank. Gift Cards: Amazon, PhonePe, and Google Play. Online Wallets: BTC, USDT, Faucet, and WebMoney WMZ.',
    },
    {
      q: 'How does the Refer & Earn system work?',
      a: 'Share your custom referral link with friends. Every time your referred friend earns on Lootify, you receive a lifetime commission on their earnings — forever, with no cap.',
    },
    {
      q: 'What are the shortlink daily limits?',
      a: 'You can complete up to 40 shortlinks per day. The cooldown resets automatically every 24 hours with instant S2S postback credit.',
    },
    {
      q: 'Is there a minimum age requirement?',
      a: 'Players must be 18 years or older to participate and withdraw earnings. All accounts go through email verification, and payout identity checks may apply for large withdrawals.',
    },
  ];

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="lootify-v2 grid-bg" data-theme={theme}>
      {/* ════════════════════════════════════════
        NAVBAR
      ════════════════════════════════════════ */}
      <nav id="navbar">
        <div
          className="wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
          }}
        >
          {/* Logo */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg,var(--green),#00A870)',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Chakra Petch',sans-serif",
                fontWeight: 700,
                fontSize: '18px',
                color: '#03100A',
                boxShadow: '0 0 14px rgba(0,232,154,0.4)',
              }}
            >
              L
            </div>
            <span
              className="font-display"
              style={{ fontSize: '19px', fontWeight: 700, color: 'var(--txt)' }}
            >
              LOOTIFY<span style={{ color: 'var(--green)' }}>.</span>
            </span>
          </a>

          {/* Center nav desktop */}
          <div className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a
              href="#quest-modes"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('quest-modes');
              }}
              className="nav-link"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--txt2)',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--green)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--txt2)')}
            >
              Quest Modes
            </a>
            <a
              href="#calculator"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('calculator');
              }}
              className="nav-link"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--txt2)',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--green)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--txt2)')}
            >
              Calculator
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              }}
              className="nav-link"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--txt2)',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--green)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--txt2)')}
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('faq');
              }}
              className="nav-link"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--txt2)',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--green)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--txt2)')}
            >
              FAQ
            </a>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="live-dot" />
              <span
                className="font-mono"
                style={{ fontSize: '10px', fontWeight: 600, color: 'var(--green)' }}
              >
                LIVE
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleTheme && onToggleTheme()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
              title="Toggle theme"
            >
              <span id="theme-icon">{theme === 'light' ? '☀️' : '🌙'}</span>
            </button>
            <a
              href="#hero-auth"
              className="btn btn-primary btn-sm"
              style={{ padding: '9px 16px' }}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('hero-auth');
              }}
            >
              Sign Up Free
            </a>
            <button
              type="button"
              id="hamburger"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              style={{
                display: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--txt)',
                fontSize: '18px',
              }}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            id="mmenu"
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg2)',
              borderTop: '1px solid var(--border)',
              padding: '16px 20px',
              gap: '4px',
            }}
          >
            <a
              href="#quest-modes"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('quest-modes');
              }}
              style={{
                padding: '12px 8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--txt)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border)',
                display: 'block',
              }}
            >
              🎮 Quest Modes
            </a>
            <a
              href="#calculator"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('calculator');
              }}
              style={{
                padding: '12px 8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--txt)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border)',
                display: 'block',
              }}
            >
              🧮 Calculator
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              }}
              style={{
                padding: '12px 8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--txt)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border)',
                display: 'block',
              }}
            >
              ⚙️ How It Works
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('faq');
              }}
              style={{
                padding: '12px 8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--txt)',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              ❓ FAQ
            </a>
            <a
              href="#hero-auth"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('hero-auth');
              }}
              className="btn btn-primary btn-full"
              style={{ marginTop: '12px' }}
            >
              🚀 Start Earning Free
            </a>
          </div>
        )}
      </nav>

      {/* ════════════════════════════════════════
        HERO
      ════════════════════════════════════════ */}
      <section
        id="hero"
        className="hero-gradient"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '48px 20px',
        }}
      >
        {/* BG orbs */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(0,232,154,0.08),transparent)',
            top: '-100px',
            left: '-100px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(155,110,255,0.07),transparent)',
            bottom: '-80px',
            right: '-80px',
            pointerEvents: 'none',
          }}
        />

        <div className="wrap" style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div
            className="hero-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '48px',
              alignItems: 'center',
            }}
          >
            {/* Left: Copy */}
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,232,154,0.07)',
                  border: '1px solid rgba(0,232,154,0.2)',
                  borderRadius: '100px',
                  padding: '6px 14px',
                  marginBottom: '28px',
                }}
              >
                <div className="live-dot" style={{ width: '6px', height: '6px' }} />
                <span
                  className="font-mono"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--green)',
                    letterSpacing: '.06em',
                  }}
                >
                  INDIA&apos;S #1 GAMING REWARDS PLATFORM
                </span>
              </div>

              <h1
                className="font-display"
                style={{
                  fontSize: 'clamp(36px,6vw,64px)',
                  fontWeight: 700,
                  lineHeight: 1.08,
                  marginBottom: '20px',
                  color: 'var(--txt)',
                }}
              >
                Play Games.
                <br />
                <span style={{ color: 'var(--green)', textShadow: '0 0 30px rgba(0,232,154,0.35)' }}>
                  Cash Out
                </span>
                <br />
                Real{' '}
                <span style={{ color: 'var(--gold)', textShadow: '0 0 25px rgba(255,180,0,0.35)' }}>
                  ₹ INR.
                </span>
              </h1>

              <p
                style={{
                  fontSize: '16px',
                  lineHeight: 1.75,
                  color: 'var(--txt2)',
                  marginBottom: '28px',
                  maxWidth: '440px',
                }}
              >
                Complete game quests, offerwalls, shortlinks &amp; micro-tasks.. Withdraw to UPI,
                Google Play, Amazon Pay, or Crypto — instantly.
              </p>
            </div>

            {/* Right: Auth Card */}
            <div id="hero-auth">
              <div
                className="card card-glow auth-card"
                style={{ padding: 'clamp(24px,5vw,40px)', maxWidth: '440px', width: '100%' }}
              >
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>🎮</div>
                  <h2
                    className="font-display"
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: 'var(--txt)',
                      marginBottom: '6px',
                    }}
                  >
                    Start Earning Now
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--txt2)' }}>
                    Sign up with your Google account to start earning
                  </p>
                </div>

                <button
                  type="button"
                  className="google-btn"
                  id="btn-google-signin"
                  onClick={triggerGoogleSignIn}
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <p
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--txt2)',
                    marginTop: '16px',
                  }}
                >
                  🔒 Secure &nbsp;•&nbsp; No password needed &nbsp;•&nbsp; Free forever
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        PARTNERS STRIP
      ════════════════════════════════════════ */}
      <section
        className="section-sm"
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg2)',
        }}
      >
        <div className="wrap">
          <p
            className="font-mono"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--txt2)',
              letterSpacing: '.08em',
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            CASHOUT CHANNELS
          </p>
          <div className="cashout-grid">
            {/* Direct Transfer */}
            <div
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <p
                className="font-mono"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--green)',
                  letterSpacing: '.07em',
                  marginBottom: '12px',
                }}
              >
                DIRECT TRANSFER
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="pill">🏦 UPI</div>
                <div className="pill">🏛️ Bank</div>
              </div>
            </div>

            {/* Gift Cards */}
            <div
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <p
                className="font-mono"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--gold)',
                  letterSpacing: '.07em',
                  marginBottom: '12px',
                }}
              >
                GIFT CARDS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="pill">🛒 Amazon</div>
                <div className="pill">📱 PhonePe</div>
                <div className="pill">🎮 Google Play</div>
              </div>
            </div>

            {/* Online Wallets */}
            <div
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <p
                className="font-mono"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--violet)',
                  letterSpacing: '.07em',
                  marginBottom: '12px',
                }}
              >
                ONLINE WALLETS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="pill">₿ BTC</div>
                <div className="pill">💰 USDT</div>
                <div className="pill">🚰 Faucet</div>
                <div className="pill">💼 WebMoney WMZ</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        HOW IT WORKS
      ════════════════════════════════════════ */}
      <section id="how-it-works" className="section">
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2
              className="font-display"
              style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: 'var(--txt)' }}
            >
              How Lootify Works
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', marginTop: '10px' }}>
              4 steps from zero to cash in your UPI wallet
            </p>
          </div>

          <div className="steps-grid">
            <div className="card" style={{ padding: '28px', textAlign: 'center', position: 'relative' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg,var(--green),#00A870)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#03100A',
                  boxShadow: '0 0 20px rgba(0,232,154,0.35)',
                }}
              >
                1
              </div>
              <div className="step-line" />
              <h3
                className="font-display"
                style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}
              >
                Create Player ID
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.7 }}>
                Sign up with Google and start completing quests immediately.
              </p>
            </div>

            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg,var(--gold),#D97706)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#1A0A00',
                  boxShadow: '0 0 20px rgba(255,180,0,0.35)',
                }}
              >
                2
              </div>
              <h3
                className="font-display"
                style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}
              >
                Complete Quests
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.7 }}>
                Play games, complete offerwalls, smash shortlinks, micro-tasks &amp; refer your
                squad.
              </p>
            </div>

            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg,var(--violet),#6D28D9)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: 'white',
                  boxShadow: '0 0 20px rgba(155,110,255,0.35)',
                }}
              >
                3
              </div>
              <h3
                className="font-display"
                style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}
              >
                3–5 Day Escrow
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.7 }}>
                Offerwall rewards go through transparent 3–5 day anti-fraud verification, then
                auto-release.
              </p>
            </div>

            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg,var(--green),var(--violet))',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: 'white',
                  boxShadow: '0 0 20px rgba(0,232,154,0.25)',
                }}
              >
                4
              </div>
              <h3
                className="font-display"
                style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)', marginBottom: '10px' }}
              >
                Instant Cashout
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.7 }}>
                Withdraw to UPI, Bank, Google Play, Amazon Pay, or USDT crypto — whenever
                you&apos;re ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        6 QUEST MODES BENTO GRID
      ════════════════════════════════════════ */}
      <section id="quest-modes" className="section" style={{ background: 'var(--bg2)' }}>
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2
              className="font-display"
              style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: 'var(--txt)' }}
            >
              6 Ways to Earn Loot
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--txt2)', marginTop: '10px' }}>
              Pick your zone — every grind is rewarded
            </p>
          </div>

          <div className="bento">
            {/* 1: Gaming Offerwalls (span 2) */}
            <div
              className="card qcard span2"
              style={{ padding: '28px' }}
              onClick={() => onNavigate('offerwalls')}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      background: 'linear-gradient(135deg,var(--green),#065F46)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0,
                    }}
                  >
                    🎮
                  </div>
                  <div>
                    <h3
                      className="font-display"
                      style={{ fontSize: '17px', fontWeight: 700, color: 'var(--txt)' }}
                    >
                      Gaming &amp; CPI Offerwalls
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--txt2)' }}>
                      Multiple Premium Offerwall Partners
                    </p>
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--txt2)',
                  lineHeight: 1.7,
                  marginBottom: '18px',
                }}
              >
                Download mobile/PC games, reach in-game milestones, or complete high-paying surveys
                across multiple premium offerwall partners.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('offerwalls');
                }}
              >
                🚀 Launch Mode
              </button>
            </div>

            {/* 2: Shortlinks */}
            <div
              className="card qcard"
              style={{ padding: '24px' }}
              onClick={() => onNavigate('shortlinks')}
            >
              <div style={{ fontSize: '26px', marginBottom: '12px' }}>🔗</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <h3
                  className="font-display"
                  style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)' }}
                >
                  Paid Shortlinks Arena
                </h3>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--txt2)',
                  lineHeight: 1.7,
                  marginBottom: '14px',
                }}
              >
                15–25 Coins per link. Up to 40 daily shortlinks. S2S instant postbacks. Auto 24h
                reset.
              </p>
              <div
                className="font-mono"
                style={{
                  background: 'rgba(255,180,0,0.05)',
                  border: '1px solid rgba(255,180,0,0.15)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: 'var(--gold)',
                }}
              >
                ⏱ 24h Cooldown Auto-Reset
              </div>
              <button
                type="button"
                className="btn btn-outline btn-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('shortlinks');
                }}
              >
                Launch Mode
              </button>
            </div>

            {/* 3: Micro-Tasks */}
            <div
              className="card qcard"
              style={{ padding: '24px' }}
              onClick={() => onNavigate('tasks')}
            >
              <div style={{ fontSize: '26px', marginBottom: '12px' }}>📋</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <h3
                  className="font-display"
                  style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)' }}
                >
                  Micro-Tasks &amp; Social
                </h3>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--txt2)',
                  lineHeight: 1.7,
                  marginBottom: '14px',
                }}
              >
                Subscribe YouTube, join Telegram squads, review apps. Screenshot proof upload for
                instant credit.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-full"
                style={{ color: 'var(--violet)', borderColor: 'var(--violet)' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--violet-dim)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('tasks');
                }}
              >
                Launch Mode
              </button>
            </div>

            {/* 4: Quiz + Spin */}
            <div
              className="card qcard"
              style={{ padding: '24px' }}
              onClick={() => onNavigate('quiz')}
            >
              <div style={{ fontSize: '26px', marginBottom: '12px' }}>🎰</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <h3
                  className="font-display"
                  style={{ fontSize: '15px', fontWeight: 700, color: 'var(--txt)' }}
                >
                  Quiz, Spin &amp; 7-Day Streak
                </h3>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--txt2)',
                  lineHeight: 1.7,
                  marginBottom: '14px',
                }}
              >
                Daily trivia, lucky wheel, and 7-day streak bonus loot chests. New questions every
                day.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('quiz');
                }}
              >
                Launch Mode
              </button>
            </div>

            {/* 5: Refer (span 2) */}
            <div
              className="card qcard span2"
              style={{
                padding: '28px',
                background: 'linear-gradient(135deg,rgba(155,110,255,0.06),rgba(0,232,154,0.04))',
                borderColor: 'rgba(155,110,255,0.3)',
              }}
              onClick={() => onNavigate('referrals')}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    background: 'linear-gradient(135deg,var(--violet),#6D28D9)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    flexShrink: 0,
                  }}
                >
                  👥
                </div>
                <div>
                  <h3
                    className="font-display"
                    style={{ fontSize: '17px', fontWeight: 700, color: 'var(--txt)' }}
                  >
                    Refer &amp; Earn
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--txt2)' }}>
                    Apne dost ko invite karo, unki kamaai ka hissa pao
                  </p>
                </div>
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--txt2)',
                  lineHeight: 1.75,
                  marginBottom: '20px',
                }}
              >
                Apna referral link share karo. Jab bhi tumhara referred dost earn kare, tumhe{' '}
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>lifetime commission</span>{' '}
                milti hai — koi cap nahi, hamesha ke liye.
              </p>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg,var(--violet),#6D28D9)',
                  color: '#fff',
                  padding: '10px 22px',
                  fontSize: '13px',
                  borderRadius: '10px',
                  fontFamily: "'Chakra Petch',sans-serif",
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all .2s',
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.boxShadow = '0 0 24px rgba(155,110,255,0.4)')
                }
                onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('referrals');
                }}
              >
                🔗 Referral Link Lo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        EARNING CALCULATOR
      ════════════════════════════════════════ */}
      <section id="calculator" className="section">
        <div className="wrap">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2
                className="font-display"
                style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: 'var(--txt)' }}
              >
                Earning Calculator
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--txt2)', marginTop: '10px' }}>
                Dekho apni grind se kitna kama sakte ho
              </p>
            </div>

            <div className="card glow-green" style={{ padding: 'clamp(20px,5vw,40px)' }}>
              <div style={{ display: 'grid', gap: '28px', marginBottom: '36px' }}>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)' }}>
                      🎮 Game Offers &amp; Surveys per Week
                    </label>
                    <span
                      id="v1"
                      className="font-mono"
                      style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}
                    >
                      {calcOffersPerDay} offers
                    </span>
                  </div>
                  <input
                    type="range"
                    id="s1"
                    min={1}
                    max={30}
                    value={calcOffersPerDay}
                    onChange={(e) => setCalcOffersPerDay(Number(e.target.value))}
                    style={{ accentColor: 'var(--green)' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--txt2)',
                      marginTop: '4px',
                    }}
                  >
                    <span>1</span>
                    <span>30</span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)' }}>
                      🔗 Paid Shortlinks per Day
                    </label>
                    <span
                      id="v2"
                      className="font-mono"
                      style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold)' }}
                    >
                      {calcShortlinksPerDay} links
                    </span>
                  </div>
                  <input
                    type="range"
                    id="s2"
                    min={0}
                    max={40}
                    value={calcShortlinksPerDay}
                    onChange={(e) => setCalcShortlinksPerDay(Number(e.target.value))}
                    style={{ accentColor: 'var(--gold)' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--txt2)',
                      marginTop: '4px',
                    }}
                  >
                    <span>0</span>
                    <span>40</span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)' }}>
                      👥 Active Referrals
                    </label>
                    <span
                      id="v3"
                      className="font-mono"
                      style={{ fontSize: '14px', fontWeight: 600, color: 'var(--violet)' }}
                    >
                      {calcActiveReferrals} friends
                    </span>
                  </div>
                  <input
                    type="range"
                    id="s3"
                    min={0}
                    max={50}
                    value={calcActiveReferrals}
                    onChange={(e) => setCalcActiveReferrals(Number(e.target.value))}
                    style={{ accentColor: 'var(--violet)' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--txt2)',
                      marginTop: '4px',
                    }}
                  >
                    <span>0</span>
                    <span>50</span>
                  </div>
                </div>
              </div>

              <div className="calc-grid">
                <div
                  style={{
                    background: 'rgba(0,232,154,0.07)',
                    border: '1px solid rgba(0,232,154,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--green)',
                      fontWeight: 600,
                      letterSpacing: '.08em',
                      marginBottom: '8px',
                    }}
                  >
                    EST. MONTHLY COINS
                  </div>
                  <div
                    id="rc"
                    className="font-mono"
                    style={{
                      fontSize: 'clamp(28px,5vw,38px)',
                      fontWeight: 600,
                      color: 'var(--green)',
                      textShadow: '0 0 20px rgba(0,232,154,0.3)',
                    }}
                  >
                    {v2MonthlyCoins.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px' }}>
                    Lootify Coins
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255,180,0,0.07)',
                    border: '1px solid rgba(255,180,0,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--gold)',
                      fontWeight: 600,
                      letterSpacing: '.08em',
                      marginBottom: '8px',
                    }}
                  >
                    EST. MONTHLY CASHOUT
                  </div>
                  <div
                    id="ri"
                    className="font-mono"
                    style={{
                      fontSize: 'clamp(28px,5vw,38px)',
                      fontWeight: 600,
                      color: 'var(--gold)',
                      textShadow: '0 0 20px rgba(255,180,0,0.3)',
                    }}
                  >
                    ₹{v2MonthlyInr.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px' }}>
                    Indian Rupees
                  </div>
                </div>
              </div>

              <p
                style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--txt2)',
                  marginTop: '16px',
                }}
              >
                * Estimates based on average payouts. Actual earnings may vary.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        FAQ
      ════════════════════════════════════════ */}
      <section id="faq" className="section">
        <div className="wrap">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <h2
                className="font-display"
                style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: 'var(--txt)' }}
              >
                Frequently Asked Questions
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} id="faq-list">
              {v2Faqs.map((f, i) => {
                const isOpen = openFaqIndex === i;
                return (
                  <div key={i} className="card" style={{ overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                      style={{
                        width: '100%',
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--txt)',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{f.q}</span>
                      <span
                        className={`faq-chevron ${isOpen ? 'open' : ''}`}
                        style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
                      >
                        ▼
                      </span>
                    </button>
                    <div className={`faq-body ${isOpen ? 'open' : ''}`}>
                      <div
                        style={{
                          padding: '14px 20px 18px',
                          fontSize: '14px',
                          color: 'var(--txt2)',
                          lineHeight: 1.8,
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        {f.a}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
        CTA BANNER
      ════════════════════════════════════════ */}
      <section
        style={{
          padding: '64px 20px',
          background: 'linear-gradient(135deg,rgba(0,232,154,0.06),rgba(155,110,255,0.05))',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="wrap" style={{ textAlign: 'center' }}>
          <div
            className="font-mono"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--green)',
              letterSpacing: '.08em',
              marginBottom: '16px',
            }}
          >
            READY TO EARN?
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(26px,4vw,48px)',
              fontWeight: 700,
              color: 'var(--txt)',
              marginBottom: '16px',
            }}
          >
            Join 2.4 Lakh+ Players
            <br />
            Earning Real Money
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--txt2)',
              marginBottom: '32px',
              maxWidth: '480px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Start for free. No investment needed. Your first ₹20 is waiting.
          </p>
          <a
            href="#hero-auth"
            className="btn btn-primary btn-lg"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('hero-auth');
            }}
          >
            🚀 Start Earning Free Now
          </a>
          <p style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '16px' }}>
            Free forever · No credit card · Instant payout
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
        FOOTER
      ════════════════════════════════════════ */}
      <footer
        style={{
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border)',
          padding: '56px 20px 32px',
        }}
      >
        <div className="wrap">
          <div className="footer-grid" style={{ marginBottom: '44px' }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '14px',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    background: 'linear-gradient(135deg,var(--green),#00A870)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Chakra Petch',sans-serif",
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#03100A',
                  }}
                >
                  L
                </div>
                <span
                  className="font-display"
                  style={{ fontSize: '18px', fontWeight: 700, color: 'var(--txt)' }}
                >
                  LOOTIFY<span style={{ color: 'var(--green)' }}>.</span>
                </span>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--txt2)',
                  lineHeight: 1.7,
                  maxWidth: '260px',
                  marginBottom: '20px',
                }}
              >
                India&apos;s next-gen gaming rewards platform. Play games, complete quests, and cash
                out real ₹ INR instantly.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="#hero-auth"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('hero-auth');
                  }}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '15px',
                    transition: 'border-color .2s',
                  }}
                >
                  📱
                </a>
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('contact');
                  }}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '15px',
                    transition: 'border-color .2s',
                  }}
                >
                  💬
                </a>
                <a
                  href="#referrals"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('referrals');
                  }}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '15px',
                    transition: 'border-color .2s',
                  }}
                >
                  🐦
                </a>
              </div>
            </div>

            <div>
              <h4
                className="font-display"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--txt)',
                  marginBottom: '14px',
                  letterSpacing: '.04em',
                }}
              >
                PLATFORM
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="#quest-modes"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('quest-modes');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Quest Modes
                </a>
                <a
                  href="#calculator"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('calculator');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Earning Calculator
                </a>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('how-it-works');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  How It Works
                </a>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('faq');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  FAQ
                </a>
              </div>
            </div>

            <div>
              <h4
                className="font-display"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--txt)',
                  marginBottom: '14px',
                  letterSpacing: '.04em',
                }}
              >
                BUSINESS
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="#advertise"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('advertise');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Advertise With Us
                </a>
                <a
                  href="#referrals"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('referrals');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Affiliate Program
                </a>
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('contact');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Support / Help
                </a>
              </div>
            </div>

            <div>
              <h4
                className="font-display"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--txt)',
                  marginBottom: '14px',
                  letterSpacing: '.04em',
                }}
              >
                LEGAL
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="#terms"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('terms');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Terms of Service
                </a>
                <a
                  href="#privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('privacy');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Privacy Policy
                </a>
                <a
                  href="#disclaimer"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('disclaimer');
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--txt2)',
                    textDecoration: 'none',
                    transition: 'color .2s',
                  }}
                >
                  Disclaimer
                </a>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <p style={{ fontSize: '12px', color: 'var(--txt2)' }}>
              © 2026 Lootify.in — All rights reserved. Play smart, earn real.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="live-dot" style={{ width: '6px', height: '6px' }} />
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--green)' }}>
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Real Google Account Sign-In Fallback Modal */}
      {googleChooserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sign in with Google
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter your Google account details to continue to {settings.siteName}.in
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoogleChooserOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!customGoogleEmail.trim()) return;
                if (onGoogleAuth) {
                  await onGoogleAuth({
                    name: customGoogleName.trim() || customGoogleEmail.split('@')[0],
                    email: customGoogleEmail.trim(),
                    referralCodeInput: regRefCode,
                  });
                  setGoogleChooserOpen(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Continue with your Gmail address (+{settings.referralWelcomeBonusCoins} Welcome
                Coins):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  placeholder="Your GamerTag / Name"
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
                <input
                  type="email"
                  required
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
              >
                Continue with Google Account →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


