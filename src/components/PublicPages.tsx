import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  Globe,
  HelpCircle,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
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

  // Interactive Calculator State
  const [calcOffersPerDay, setCalcOffersPerDay] = useState(2);
  const [calcShortlinksPerDay, setCalcShortlinksPerDay] = useState(4);
  const [calcActiveReferrals, setCalcActiveReferrals] = useState(10);

  // Landing Page Hero Auth Card State ('register' | 'login')
  const [heroAuthMode, setHeroAuthMode] = useState<'register' | 'login'>('register');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRefCode, setRegRefCode] = useState('LOOT-AARAV');
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
              Every UPI, Bank Transfer, Gift Card, E-Wallet, and USDT payout processed on{' '}
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
            Aapne pucha tha: &ldquo;Repo ko directly push kese karu aur baaki cheezein easy steps me
            batao&rdquo; — ye rahi aapki complete step-by-step guide aur 1-Click Setup Files!
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
                <strong>Create New Repository</strong> me naam dalein: <code>lootify-web</code>.
              </li>
              <li>
                Humne is project me pehle se hi{' '}
                <code>.github/workflows/deploy-pages.yml</code> aur <code>public/404.html</code>{' '}
                bana diya hai! Jaise hi code GitHub pe jayega, aapki website automatic build ho
                jayegi.
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
                <strong>Build and deployment (Source)</strong> me{' '}
                <strong>GitHub Actions</strong> select karein.
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
                par free account kholein aur apna Custom Domain add karein.
              </li>
              <li>
                Left menu me <strong>Workers & Pages → D1 SQL Database</strong> par jayein aur{' '}
                <strong>Create Database</strong> (naam: <code>lootify-db</code>) karein.
              </li>
              <li>
                Niche diya gaya <strong>SQL Schema Copy</strong> karein aur D1 ke{' '}
                <strong>Console</strong> box me paste karke Run kar dein—saari tables 2 second me
                ban jayengi!
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
                <strong>Deploy</strong> dabayein! Phir Notik.me aur Lootably me apna Postback URL
                daal dein.
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

        {/* Ready-to-Paste Offerwall Postback URLs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold">
            Ready-to-Copy Offerwall S2S Postback URLs (For Notik.me & Lootably)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jab aap Notik.me aur Lootably par apna publisher account banayenge, wahan Postback URL
            box me ye URLs copy-paste kar dein:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Notik.me S2S Postback URL
                </span>
                <button
                  onClick={() =>
                    copyText(
                      `https://${settings.apiSubdomain}/api/postback/notik?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1`,
                      'Notik.me Postback URL'
                    )
                  }
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <code className="block text-xs font-mono break-all text-slate-700 dark:text-slate-300">
                https://{settings.apiSubdomain}/api/postback/notik?user_id=&#123;user_id&#125;&amp;amount=&#123;amount&#125;&amp;txn_id=&#123;txn_id&#125;&amp;status=1
              </code>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Lootably S2S Postback URL
                </span>
                <button
                  onClick={() =>
                    copyText(
                      `https://${settings.apiSubdomain}/api/postback/lootably?user_id={userID}&amount={currency}&txn_id={transactionID}&status={status}`,
                      'Lootably Postback URL'
                    )
                  }
                  className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <code className="block text-xs font-mono break-all text-slate-700 dark:text-slate-300">
                https://{settings.apiSubdomain}/api/postback/lootably?user_id=&#123;userID&#125;&amp;amount=&#123;currency&#125;&amp;txn_id=&#123;transactionID&#125;&amp;status=&#123;status&#125;
              </code>
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
                To protect publisher accounts and prevent fraudulent app uninstalls, high-value
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

  // Default: HOME / LANDING PAGE ('home')
  return (
    <div className="space-y-14">
      {/* Top Landing Page Welcome Bar with Theme Toggle & Live Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            LIVE · INDIA & GLOBAL
          </span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            First UPI / Paytm / Gift Card Withdrawal starts at just{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              ₹{settings.starterPayoutInr} ({settings.starterPayoutInr * settings.coinsPerInr} Coins)
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors"
            >
              {theme === 'dark' ? '☀ Switch to Light Theme' : '🌙 Switch to Dark Theme'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            Enter Member Dashboard →
          </button>
        </div>
      </div>

      {/* Hero Split Section: Value Proposition (Left) + Google Sign-In & Login/Signup Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-9 space-y-6 shadow-xs">
          <div className="space-y-4">
            <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              {settings.siteName}.in · Official Multi-Earning & Rewards Website
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Turn Your Daily Free Time Into Instant UPI, Bank & Gift Card Cashouts.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Complete verified offers on <strong>Notik.me & Lootably</strong>, solve daily{' '}
              <strong>ShrinkMe & GPLinks</strong> shortlinks, play timed trivia quizzes, and earn{' '}
              <strong>{settings.referralCommissionPercent}% lifetime passive commission</strong> from
              every friend you invite.
            </p>
          </div>

          {/* 3 Key Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Starter Cashout</div>
              <div className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{settings.starterPayoutInr}.00 Minimum
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Instant UPI & Gift Cards</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Welcome Bonus</div>
              <div className="text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                +{settings.referralWelcomeBonusCoins} Coins
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Credited on Google Sign-In</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Refer & Earn</div>
              <div className="text-lg font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                ₹5 + {settings.referralCommissionPercent}% Life
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">3-Layer Viral Commission</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={triggerGoogleSignIn}
              className="inline-flex items-center gap-2.5 px-5 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <span>Continue with Google (+200 Coins)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('payout-proofs')}
              className="inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              View Live Payment Proofs
            </button>
          </div>

          {/* Partner Network Strip */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Official Ad & Payout Partners:</span>
            <div className="flex flex-wrap items-center gap-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
              <span>Notik.me</span>
              <span>·</span>
              <span>Lootably</span>
              <span>·</span>
              <span>ShrinkMe.io</span>
              <span>·</span>
              <span>GPLinks</span>
              <span>·</span>
              <span>Monetag</span>
              <span>·</span>
              <span>UPI / Paytm / USDT</span>
            </div>
          </div>
        </div>

        {/* Right Column: Embedded Google Sign-In + Email Sign-Up / Login Card */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col justify-between space-y-5 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                INSTANT BONUS · +{settings.referralWelcomeBonusCoins} COINS
              </span>
              <span className="text-[11px] font-mono text-slate-500">100 Coins = ₹1.00</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {heroAuthMode === 'register'
                ? 'Join Lootify.in for Free'
                : 'Sign In to Your Lootify Wallet'}
            </h2>

            {/* 1-Click Official Google Sign-In Button */}
            <button
              type="button"
              onClick={triggerGoogleSignIn}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-900 dark:text-white text-sm font-bold flex items-center justify-center gap-3 transition-colors shadow-2xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span>OR USE EMAIL ACCOUNT</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Mode Switcher: Create Account vs Sign In */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHeroAuthMode('register')}
                className={`py-2 rounded-lg transition-colors ${
                  heroAuthMode === 'register'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setHeroAuthMode('login')}
                className={`py-2 rounded-lg transition-colors ${
                  heroAuthMode === 'login'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Sign In (Login)
              </button>
            </div>
          </div>

          {heroAuthMode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Rohit Sharma"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="rohit@gmail.com"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Referral Code</label>
                  <input
                    type="text"
                    value={regRefCode}
                    onChange={(e) => setRegRefCode(e.target.value.toUpperCase())}
                    placeholder="LOOT-AARAV"
                    className="w-full px-3.5 py-2 text-sm font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
              >
                {regSubmitting
                  ? 'Creating Account...'
                  : `Create Free Account (+${settings.referralWelcomeBonusCoins} Coins)`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleHeroLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="aarav@lootify.in or admin@lootify.in"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
              >
                {loginSubmitting ? 'Signing In...' : 'Sign In to Dashboard →'}
              </button>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>1-Click Demo Login:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('aarav@lootify.in');
                      setLoginPassword('123456');
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    Fill Earner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('admin@lootify.in');
                      setLoginPassword('admin123');
                    }}
                    className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                  >
                    Fill Admin
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Full-Width 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">First Payout Threshold</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{settings.starterPayoutInr}.00
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Just {(settings.starterPayoutInr * settings.coinsPerInr).toLocaleString()} Coins to
            unlock
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Lifetime Referral Commission</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {settings.referralCommissionPercent}% Forever
          </p>
          <p className="text-xs text-slate-500 mt-1">
            + ₹{(settings.referralFlatBonusCoins / settings.coinsPerInr).toFixed(0)} Flat Activation
            Bonus
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Supported Payout Rails</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            5 Instant Rails
          </p>
          <p className="text-xs text-slate-500 mt-1">UPI · Bank · Gift Cards · Paytm · USDT</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Registered Earners</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {data.allUsersCount.toLocaleString()}+
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Protected by {settings.pendingHoldDays}-Day Escrow Guard
          </p>
        </div>
      </div>

      {/* Section: 6 Ways to Earn Real Cash Daily */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              6 Verified Earning Engines
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Everything You Can Do to Earn Daily on {settings.siteName}.in
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('offerwalls')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            View All Live Offers & Tasks →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                01 · OFFERWALLS
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                500 – 25,000 Coins
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Notik.me, Lootably & AdGate Offers
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Install trending apps, test mobile games, and complete verified surveys. Server-to-Server
              (S2S) postbacks credit coins automatically into your wallet.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                02 · PAID SHORTLINKS
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                70 – 100 Coins / Link
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              ShrinkMe.io & GPLinks Daily Links
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Solve high-CPM Indian shortlinks in 10–15 seconds. Protected by a 24-hour per-IP cooldown
              so CPM rates stay high and payouts remain instant.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                03 · 3-LAYER REFER & EARN
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                500 Coins + 10% Life
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Passive Lifetime Referral Income
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your friend gets +200 Coins on signup, you get +500 Coins (₹5) on their first offer, plus
              10% lifetime commission on everything they earn forever.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                04 · SOCIAL MICRO-TASKS
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                150 – 600 Coins
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Telegram, YouTube & App Reviews
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Join official channels, watch sponsor videos, or post honest reviews. Submit your
              username or proof link for rapid Admin verification.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                05 · QUIZZES & ARTICLES
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                50 – 150 Coins
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Timed Trivia & Read-to-Earn Guides
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Answer 3-question general knowledge & tech quizzes or read sponsored finance articles for
              15 seconds to claim instant available coins.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                06 · STREAKS, SPIN & LIFAFA
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                Daily Free Coins
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              7-Day Check-In, Lucky Wheel & Codes
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Maintain your 7-day login streak, spin the daily wheel for guaranteed coins, and redeem
              limited-claim Lifafa promo codes dropped by Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Section: 3-Step How It Works */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
        <div>
          <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
            Simple 3-Step Workflow
          </p>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            How Sign-In, Pending Escrow & Instant UPI Withdrawals Work
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              STEP 01 · GOOGLE OR EMAIL LOGIN
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Sign In & Get +200 Welcome Coins
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Click <strong>Continue with Google</strong> or create an email account above. Your
              account is stored in our high-speed Cloudflare D1 SQL database with +200 bonus coins.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
              STEP 02 · COMPLETE OFFERS & LINKS
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Earn Available & Escrow Coins
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Quizzes, streaks, and promo codes credit directly to <strong>Available Coins</strong>.
              High-paying Offerwalls & Shortlinks clear automatically after our {settings.pendingHoldDays}-day anti-fraud hold.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              STEP 03 · WITHDRAW REAL CASH
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Cashout from ₹{settings.starterPayoutInr} via UPI / Crypto
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Unlock your starter withdrawal at just ₹{settings.starterPayoutInr} (1,000 Coins) via
              UPI ID, Bank IMPS, Google Play / Amazon Gift Cards, Paytm, or USDT (TRC20/BEP20).
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Daily & Monthly Earning Potential Calculator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Transparent Unit Economics
              </p>
              <h2 className="text-xl md:text-2xl font-bold mt-1">
                Calculate Your Monthly Earning Potential
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adjust the sliders below to estimate how much you can earn combining Offerwalls,
                Shortlinks, and Referrals.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span>Offerwall Tasks Completed Per Day (Notik.me / Lootably)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {calcOffersPerDay} offers/day (~{dailyOfferCoins} Coins)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={calcOffersPerDay}
                  onChange={(e) => setCalcOffersPerDay(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span>Paid Shortlinks Solved Per Day (ShrinkMe / GPLinks)</span>
                  <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                    {calcShortlinksPerDay} links/day (~{dailyShortlinkCoins} Coins)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={calcShortlinksPerDay}
                  onChange={(e) => setCalcShortlinksPerDay(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span>
                    Active Referred Friends ({settings.referralCommissionPercent}% Lifetime Passive
                    Commission)
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {calcActiveReferrals} active friends (+{dailyRefCommissionCoins} Coins/day)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={calcActiveReferrals}
                  onChange={(e) => setCalcActiveReferrals(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Daily Income</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  ₹{totalDailyInr.toFixed(2)} / day
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Daily Coins</p>
                <p className="text-sm font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                  +{totalDailyCoins.toLocaleString()} Coins
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estimated 30-Day Monthly Payout
              </p>
              <p className="text-3xl md:text-4xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{totalMonthlyInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / month
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Withdrawable directly to UPI ID, Bank Account, Amazon/Google Play Gift Cards, Paytm,
                or USDT Wallet.
              </p>
            </div>

            <button
              type="button"
              onClick={triggerGoogleSignIn}
              className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              Sign In with Google & Start Earning Now →
            </button>
          </div>
        </div>
      </div>

      {/* Live Recent Payout Proofs Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              LIVE VERIFIED WITHDRAWALS
            </p>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Recent UPI, Bank & Gift Card Payouts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('payout-proofs')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            See Full Public Ledger →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 pr-4">Member</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">UTR / Voucher Reference</th>
                <th className="py-2.5 pl-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {publicPayoutProofs.slice(0, 5).map((w) => (
                <tr key={w.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">
                    {w.userName}
                  </td>
                  <td className="py-3 px-4 uppercase font-mono text-slate-500">
                    {w.method.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{w.amountInr.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {w.utrOrVoucher || 'Verified Queue'}
                  </td>
                  <td className="py-3 pl-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {w.status === 'approved' ? 'Paid ✓' : 'Processing'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            1. Minimum withdrawal kitna hai?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Naye users ke liye pehla Starter Withdrawal sirf <strong>₹{settings.starterPayoutInr} (1,000 Coins)</strong> par unlock ho jata hai. Uske baad aap ₹50, ₹100, aur ₹250+ tiers me unlimited baar UPI, Bank, Gift Card, ya USDT me withdraw kar sakte hain.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            2. Pending Balance Hold ({settings.pendingHoldDays} Days) kya hai?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Offerwalls aur Shortlinks ke coins {settings.pendingHoldDays} din ke liye Pending Escrow me rehte hain taaki fake/VPN completions filter ho sakein. {settings.pendingHoldDays} din baad wo apne aap Available Balance me aa jate hain.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            3. Google Sign-In kaise kaam karta hai?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Aap upar <strong>Continue with Google</strong> button daba kar 1-click me apna Gmail account connect kar sakte hain. Naye account par turant +{settings.referralWelcomeBonusCoins} Bonus Coins milte hain.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            4. Refer & Earn me kitna milta hai?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Har dost ko invite karne par dost ko +200 Coins milte hain, aur jab wo apna pehla offer poora karta hai toh aapko <strong>+500 Coins (₹5) flat bonus + lifetime 10% commission</strong> milta hai!
          </p>
        </div>
      </div>

      {/* Interactive Google Account Chooser & Google OAuth Client ID Modal */}
      {googleChooserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xl">
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
                    Choose an account to continue to {settings.siteName}.in
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

            {/* Quick 1-Tap Google Accounts */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  if (onGoogleAuth) {
                    await onGoogleAuth({
                      name: 'Sarthak (Founder & Admin)',
                      email: 'admin@lootify.in',
                      referralCodeInput: regRefCode,
                    });
                    setGoogleChooserOpen(false);
                  }
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 flex items-center justify-between text-left transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Sarthak Singh (Founder Admin)
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    sarthaksinghyadav1@gmail.com · Admin Role
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-500">Admin →</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (onGoogleAuth) {
                    await onGoogleAuth({
                      name: 'Aarav Verma',
                      email: 'aarav@lootify.in',
                      referralCodeInput: regRefCode,
                    });
                    setGoogleChooserOpen(false);
                  }
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 flex items-center justify-between text-left transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Aarav Verma (Verified Earner)
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    aarav@lootify.in · 1,840 Coins
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-500">Sign In →</span>
              </button>
            </div>

            {/* Custom Google Account Input */}
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
              className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs"
            >
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Or continue with any Gmail address (+200 Welcome Coins):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  placeholder="Your Name"
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
                Continue with Gmail Account →
              </button>
            </form>

            {/* Optional Real Google OAuth Client ID Config */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
              <div className="text-slate-500">
                <strong>Optional (Admin):</strong> Paste Google Cloud OAuth Client ID (
                <code>.apps.googleusercontent.com</code>) for live Google One-Tap popup:
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="123456789-xxxx.apps.googleusercontent.com"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('lootify_google_client_id', googleClientId.trim());
                    notify('Google OAuth Client ID saved!', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 font-semibold"
                >
                  Save ID
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

