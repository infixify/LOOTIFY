import React, { useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
  Edit3,
  FileCode,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  BootstrapPayload,
  CustomTaskItem,
  ShortlinkItem,
  SystemSettings,
} from '../types.ts';
import {
  generateCloudflareD1SchemaSql,
  generateCloudflareWorkerCode,
} from '../lib/cloudflareDeploymentTemplates.ts';

interface AdminConsoleProps {
  data: BootstrapPayload;
  apiPost: (endpoint: string, body?: any) => Promise<any>;
  apiDelete: (endpoint: string) => Promise<any>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type AdminTab =
  | 'economy'
  | 'postbacks'
  | 'shortlinks'
  | 'tasks'
  | 'ads'
  | 'users'
  | 'payouts'
  | 'deploy';

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  data,
  apiPost,
  apiDelete,
  notify,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('economy');
  const [formSettings, setFormSettings] = useState<SystemSettings>(data.settings);

  // New Shortlink Form State
  const [slProvider, setSlProvider] = useState('ShrinkMe.io');
  const [slTitle, setSlTitle] = useState('');
  const [slUrl, setSlUrl] = useState('');
  const [slCoins, setSlCoins] = useState(85);
  const [slSeconds, setSlSeconds] = useState(10);

  // New Custom Task Form State
  const [tskCategory, setTskCategory] = useState<CustomTaskItem['category']>('telegram');
  const [tskTitle, setTskTitle] = useState('');
  const [tskInstructions, setTskInstructions] = useState('');
  const [tskUrl, setTskUrl] = useState('');
  const [tskCoins, setTskCoins] = useState(150);
  const [tskHoldDays, setTskHoldDays] = useState(0);

  // New Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [promoCoins, setPromoCoins] = useState(150);
  const [promoMax, setPromoMax] = useState(100);

  // Withdrawal UTR Input State
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});

  // User Coin Adjustment Input State
  const [userCoinInputs, setUserCoinInputs] = useState<Record<string, number>>({});

  const adminData = data.adminData || {
    users: [data.currentUser],
    allSubmissions: data.userTaskSubmissions,
    allWithdrawals: data.withdrawals,
    promoCodes: [],
    postbackLogs: [],
  };

  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    notify(`${label} copied!`, 'success');
  };

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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/admin/settings', formSettings);
      notify('Global Economy, Theme & Rules saved live!', 'success');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            GOD-MODE MASTER CONTROL CENTER · 100% NO-CODE WEBSITE CONTROL
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
            {data.settings.siteName} Admin Panel
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Control coin rates, pending hold days, referral commissions, shortlinks, offerwall
            postbacks, ad scripts, and user payouts in real time.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-xl">
          {(
            [
              { id: 'economy', label: '1. Economy & Rules' },
              { id: 'postbacks', label: '2. Offerwalls & S2S' },
              { id: 'shortlinks', label: '3. Shortlinks' },
              { id: 'tasks', label: '4. Tasks & Proofs' },
              { id: 'ads', label: '5. Ads (Monetag)' },
              { id: 'users', label: '6. Users & Fraud' },
              { id: 'payouts', label: '7. Payouts & Lifafa' },
              { id: 'deploy', label: '8. GitHub + DB Kit' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          TAB 1: GLOBAL ECONOMY, THEME & RULES
      ==================================================================== */}
      {activeTab === 'economy' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-lg font-bold">
              Global Website Branding, Economy & Anti-Fraud Rules
            </h3>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
            >
              <Save className="w-3.5 h-3.5" /> Save All Settings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium mb-1">Website Brand Name</label>
              <input
                type="text"
                value={formSettings.siteName}
                onChange={(e) => setFormSettings({ ...formSettings, siteName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                GitHub Pages Custom Domain
              </label>
              <input
                type="text"
                value={formSettings.customDomain}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, customDomain: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Cloudflare Worker API Subdomain
              </label>
              <input
                type="text"
                value={formSettings.apiSubdomain}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, apiSubdomain: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Coins Per ₹1.00 INR (Default: 100)
              </label>
              <input
                type="number"
                value={formSettings.coinsPerInr}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, coinsPerInr: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Pending Balance Hold Days (Anti-Chargeback)
              </label>
              <input
                type="number"
                min={0}
                max={14}
                value={formSettings.pendingHoldDays}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, pendingHoldDays: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Default Website Theme
              </label>
              <select
                value={formSettings.defaultTheme}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    defaultTheme: e.target.value as 'dark' | 'light',
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="dark">Dark Fintech Slate (Recommended)</option>
                <option value="light">Clean Banking Daylight</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                1st Payout Starter Hook (INR)
              </label>
              <input
                type="number"
                value={formSettings.starterPayoutInr}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, starterPayoutInr: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Tier 2 Scaled Minimum (INR)
              </label>
              <input
                type="number"
                value={formSettings.tier2PayoutInr}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, tier2PayoutInr: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Tier 3 Pro Minimum (INR)
              </label>
              <input
                type="number"
                value={formSettings.tier3PayoutInr}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, tier3PayoutInr: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Refer & Earn Flat Bonus (Coins)
              </label>
              <input
                type="number"
                value={formSettings.referralFlatBonusCoins}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    referralFlatBonusCoins: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Invitee Joining Welcome Bonus (Coins)
              </label>
              <input
                type="number"
                value={formSettings.referralWelcomeBonusCoins}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    referralWelcomeBonusCoins: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Lifetime Referral Commission (%)
              </label>
              <input
                type="number"
                value={formSettings.referralCommissionPercent}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    referralCommissionPercent: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-medium">Top Announcement Banner Text</label>
            <input
              type="text"
              value={formSettings.announcementText}
              onChange={(e) =>
                setFormSettings({ ...formSettings, announcementText: e.target.value })
              }
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium mb-2">
              Enabled Withdrawal Rails (Toggle ON/OFF)
            </label>
            <div className="flex flex-wrap gap-3">
              {(['upi', 'bank', 'gift_card', 'ewallet', 'crypto'] as const).map((rail) => (
                <label
                  key={rail}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formSettings.payoutMethodsEnabled[rail]}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        payoutMethodsEnabled: {
                          ...formSettings.payoutMethodsEnabled,
                          [rail]: e.target.checked,
                        },
                      })
                    }
                    className="accent-emerald-500"
                  />
                  <span className="uppercase">{rail.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* ====================================================================
          TAB 2: OFFERWALLS & S2S POSTBACK WEBHOOK CENTER
      ==================================================================== */}
      {activeTab === 'postbacks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold">
              Ready-to-Copy Offerwall S2S Postback URLs ({data.settings.apiSubdomain})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Notik.me S2S Webhook URL
                  </span>
                  <button
                    onClick={() =>
                      copyText(
                        `https://${data.settings.apiSubdomain}/api/postback/notik?user_id={user_id}&amount={amount}&txn_id={txn_id}&status=1`,
                        'Notik.me S2S URL'
                      )
                    }
                    className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <code className="block text-xs font-mono break-all">
                  https://{data.settings.apiSubdomain}/api/postback/notik?user_id=&#123;user_id&#125;&amp;amount=&#123;amount&#125;&amp;txn_id=&#123;txn_id&#125;&amp;status=1
                </code>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Lootably S2S Webhook URL
                  </span>
                  <button
                    onClick={() =>
                      copyText(
                        `https://${data.settings.apiSubdomain}/api/postback/lootably?user_id={userID}&amount={currency}&txn_id={transactionID}&status={status}`,
                        'Lootably S2S URL'
                      )
                    }
                    className="text-xs text-amber-500 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <code className="block text-xs font-mono break-all">
                  https://{data.settings.apiSubdomain}/api/postback/lootably?user_id=&#123;userID&#125;&amp;amount=&#123;currency&#125;&amp;txn_id=&#123;transactionID&#125;&amp;status=&#123;status&#125;
                </code>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base">Live S2S Postback & Chargeback Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Tx ID</th>
                    <th className="py-3 px-4 text-right">Coins</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {adminData.postbackLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-semibold">{log.provider}</td>
                      <td className="py-3 px-4 font-mono text-xs">{log.userId}</td>
                      <td className="py-3 px-4 font-mono text-xs">{log.externalTxId}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        {log.type === 'credit' ? `+${log.coins}` : `-${log.coins}`}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {log.type === 'credit' ? (
                          <span className="text-emerald-500 font-semibold">Pending Credit</span>
                        ) : (
                          <span className="text-red-500 font-semibold">Chargeback Reversal</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: SHORTLINKS BONUS WALL CRUD
      ==================================================================== */}
      {activeTab === 'shortlinks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold">Add New Paid Shortlink (ShrinkMe.io / GPLinks)</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Provider</label>
                <input
                  type="text"
                  value={slProvider}
                  onChange={(e) => setSlProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Link Title</label>
                <input
                  type="text"
                  value={slTitle}
                  onChange={(e) => setSlTitle(e.target.value)}
                  placeholder="ShrinkMe VIP Bonus #3"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Shortlink URL</label>
                <input
                  type="url"
                  value={slUrl}
                  onChange={(e) => setSlUrl(e.target.value)}
                  placeholder="https://shrinkme.io/..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reward Coins</label>
                <input
                  type="number"
                  value={slCoins}
                  onChange={(e) => setSlCoins(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <button
                onClick={async () => {
                  if (!slTitle || !slUrl) {
                    notify('Enter shortlink title and URL', 'error');
                    return;
                  }
                  await apiPost('/api/admin/shortlinks', {
                    id: '',
                    provider: slProvider,
                    title: slTitle,
                    destinationUrl: slUrl,
                    rewardCoins: slCoins,
                    cooldownHours: 24,
                    minResolveSeconds: slSeconds,
                    stepsCount: 3,
                    dailyMaxClaims: 1,
                    enabled: true,
                  });
                  setSlTitle('');
                  setSlUrl('');
                  notify('Shortlink added to wall!', 'success');
                }}
                className="py-2 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                + Add Shortlink
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Destination URL</th>
                  <th className="py-3 px-4 text-right">Coins</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.shortlinks.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-semibold">{s.provider}</td>
                    <td className="py-3 px-4">{s.title}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {s.destinationUrl}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-500">
                      +{s.rewardCoins}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={async () => {
                          await apiDelete(`/api/admin/shortlinks/${s.id}`);
                          notify('Shortlink removed', 'info');
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: CUSTOM TASKS CRUD & PROOF APPROVAL DESK
      ==================================================================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold">Create Custom Social / App Review Task</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={tskCategory}
                onChange={(e) => setTskCategory(e.target.value as CustomTaskItem['category'])}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="telegram">Telegram Join</option>
                <option value="youtube">YouTube Subscribe</option>
                <option value="instagram">Instagram Follow</option>
                <option value="app_review">App Review</option>
              </select>
              <input
                type="text"
                value={tskTitle}
                onChange={(e) => setTskTitle(e.target.value)}
                placeholder="Task Title"
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                type="url"
                value={tskUrl}
                onChange={(e) => setTskUrl(e.target.value)}
                placeholder="Target URL (https://...)"
                className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <input
                type="number"
                value={tskCoins}
                onChange={(e) => setTskCoins(Number(e.target.value))}
                placeholder="Reward Coins"
                className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={tskInstructions}
                onChange={(e) => setTskInstructions(e.target.value)}
                placeholder="Step-by-step instructions for earner..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
              <button
                onClick={async () => {
                  if (!tskTitle || !tskUrl) {
                    notify('Enter task title and target URL', 'error');
                    return;
                  }
                  await apiPost('/api/admin/tasks', {
                    id: '',
                    category: tskCategory,
                    title: tskTitle,
                    instructions: tskInstructions || 'Complete the task and submit your username.',
                    targetUrl: tskUrl,
                    rewardCoins: tskCoins,
                    holdDays: tskHoldDays,
                    proofPrompt: 'Enter your @username or proof link',
                    enabled: true,
                  });
                  setTskTitle('');
                  setTskUrl('');
                  setTskInstructions('');
                  notify('New task published!', 'success');
                }}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg whitespace-nowrap"
              >
                + Publish Task
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base">User Task Proof Submissions Queue</h3>
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Earner</th>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Submitted Proof</th>
                  <th className="py-3 px-4 text-right">Reward</th>
                  <th className="py-3 px-4 text-right">Review Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {adminData.allSubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="py-3 px-4 font-medium">{sub.userName}</td>
                    <td className="py-3 px-4 text-xs">{sub.taskTitle}</td>
                    <td className="py-3 px-4 font-mono text-xs">{sub.proofText}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-500">
                      +{sub.rewardCoins}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sub.status === 'pending' ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={async () => {
                              await apiPost(`/api/admin/task-submissions/${sub.id}/review`, {
                                decision: 'approved',
                              });
                              notify('Proof approved & coins credited!', 'success');
                            }}
                            className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-md"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              await apiPost(`/api/admin/task-submissions/${sub.id}/review`, {
                                decision: 'rejected',
                              });
                              notify('Proof rejected.', 'info');
                            }}
                            className="px-3 py-1 text-xs font-semibold bg-red-600 text-white rounded-md"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {sub.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 5: AD NETWORKS & SCRIPT MANAGER (MONETAG & ADSTERRA)
      ==================================================================== */}
      {activeTab === 'ads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.adPlacements.map((ad) => (
            <div
              key={ad.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-500">{ad.network}</span>
                  <h3 className="font-bold text-base">{ad.title}</h3>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ad.enabled}
                    onChange={async (e) => {
                      await apiPost('/api/admin/ads', { ...ad, enabled: e.target.checked });
                      notify(`${ad.title} ${e.target.checked ? 'enabled' : 'disabled'}!`, 'info');
                    }}
                    className="accent-emerald-500"
                  />
                  <span>{ad.enabled ? 'Active' : 'Paused'}</span>
                </label>
              </div>
              <textarea
                rows={3}
                defaultValue={ad.scriptOrHtml}
                onBlur={async (e) => {
                  await apiPost('/api/admin/ads', { ...ad, scriptOrHtml: e.target.value });
                  notify('Ad zone script updated!', 'success');
                }}
                className="w-full p-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
              />
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          TAB 6: USERS, BALANCES, PENDING HOLD RELEASE & FRAUD
      ==================================================================== */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base">
              All Registered Earners ({adminData.users.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3 px-4">User & IP</th>
                  <th className="py-3 px-4 text-right">Available Coins</th>
                  <th className="py-3 px-4 text-right">Pending Hold</th>
                  <th className="py-3 px-4">Escrow Action</th>
                  <th className="py-3 px-4">Manual Coin Adjust</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {adminData.users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs font-mono text-slate-500">
                        {u.email} · IP: {u.ipAddress}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-500">
                      {u.availableCoins.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-amber-500">
                      {u.pendingCoins.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        disabled={u.pendingCoins <= 0}
                        onClick={async () => {
                          await apiPost(`/api/admin/users/${u.id}/action`, {
                            actionType: 'release_pending',
                          });
                          notify(
                            `Released ${u.pendingCoins} pending coins to ${u.name}'s available wallet!`,
                            'success'
                          );
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                          u.pendingCoins > 0
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Release Hold Early
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          placeholder="Coins"
                          value={userCoinInputs[u.id] || ''}
                          onChange={(e) =>
                            setUserCoinInputs({
                              ...userCoinInputs,
                              [u.id]: Number(e.target.value),
                            })
                          }
                          className="w-20 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                        />
                        <button
                          onClick={async () => {
                            await apiPost(`/api/admin/users/${u.id}/action`, {
                              actionType: 'add_coins',
                              amountCoins: userCoinInputs[u.id] || 100,
                            });
                            notify(`Added coins to ${u.name}`, 'success');
                          }}
                          className="px-2 py-1 text-xs font-semibold bg-emerald-600 text-white rounded"
                        >
                          +Add
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={async () => {
                          await apiPost(`/api/admin/users/${u.id}/action`, {
                            actionType: 'toggle_ban',
                          });
                          notify(`Updated status for ${u.name}`, 'info');
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded ${
                          u.status === 'banned'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.status === 'banned' ? 'Banned (Unban)' : 'Active (Ban)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 7: PAYOUT APPROVAL DESK & LIFAFA PROMO CODES
      ==================================================================== */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          {/* Lifafa Promo Code Creator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold">
              Create Limited-Claim Lifafa / Promo Code (For Telegram & Social Giveaways)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Promo Code Name</label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="DIWALI500"
                  className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reward Coins Per Claim</label>
                <input
                  type="number"
                  value={promoCoins}
                  onChange={(e) => setPromoCoins(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Max Total Users</label>
                <input
                  type="number"
                  value={promoMax}
                  onChange={(e) => setPromoMax(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <button
                onClick={async () => {
                  if (!promoCode) return;
                  await apiPost('/api/admin/promos', {
                    code: promoCode,
                    rewardCoins: promoCoins,
                    maxClaims: promoMax,
                  });
                  setPromoCode('');
                  notify('Lifafa Promo Code created!', 'success');
                }}
                className="py-2 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                + Create Lifafa Code
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {adminData.promoCodes.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono"
                >
                  <span className="font-bold text-emerald-500">{p.code}</span>
                  <span>+{p.rewardCoins} Coins</span>
                  <span>
                    ({p.claimedUserIds.length}/{p.maxClaims} claimed)
                  </span>
                  <button
                    onClick={async () => {
                      await apiDelete(`/api/admin/promos/${p.id}`);
                      notify('Promo code deleted', 'info');
                    }}
                    className="text-red-500 hover:underline"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Withdrawal Processing Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base">
                Withdrawal Requests Queue (UPI · Bank · Gift Cards · E-Wallet · USDT)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3 px-4">Earner</th>
                    <th className="py-3 px-4">Method & Destination Details</th>
                    <th className="py-3 px-4 text-right">Amount (INR)</th>
                    <th className="py-3 px-4">UTR / Gift Voucher Code</th>
                    <th className="py-3 px-4 text-right">Process Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {adminData.allWithdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold">{w.userName}</p>
                        <p className="text-xs text-slate-500">{w.tierLabel}</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        <span className="uppercase font-bold text-emerald-500">{w.method}: </span>
                        {w.payoutDetails.upiId ||
                          w.payoutDetails.accountNumber ||
                          w.payoutDetails.giftCardBrand ||
                          w.payoutDetails.walletPhone ||
                          w.payoutDetails.cryptoAddress ||
                          'Verified Destination'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-500">
                        ₹{w.amountInr.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {w.status === 'pending' ? (
                          <input
                            type="text"
                            placeholder="Enter UTR or Voucher Code"
                            value={utrInputs[w.id] || ''}
                            onChange={(e) =>
                              setUtrInputs({ ...utrInputs, [w.id]: e.target.value })
                            }
                            className="px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                          />
                        ) : (
                          <span className="font-mono text-xs">{w.utrOrVoucher || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {w.status === 'pending' ? (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={async () => {
                                await apiPost(`/api/admin/withdrawals/${w.id}/process`, {
                                  status: 'approved',
                                  utrOrVoucher: utrInputs[w.id] || `UTR_${Date.now()}`,
                                });
                                notify(`Marked ₹${w.amountInr} as Paid!`, 'success');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={async () => {
                                await apiPost(`/api/admin/withdrawals/${w.id}/process`, {
                                  status: 'rejected',
                                });
                                notify(
                                  `Withdrawal rejected & ${w.coinsDeducted} Coins auto-refunded!`,
                                  'info'
                                );
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md"
                            >
                              Reject & Refund
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold uppercase text-emerald-500">
                            {w.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 8: GITHUB PAGES + CLOUDFLARE WORKER/D1 KIT & 1-CLICK DB BACKUP
      ==================================================================== */}
      {activeTab === 'deploy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold">1-Click Full Database Backup & Snapshot</h3>
            <p className="text-xs text-slate-500">
              Download a complete JSON snapshot of all users, coin balances, tasks, shortlinks, and
              payout history at any time.
            </p>
            <a
              href="/api/admin/backup"
              download="lootify_backup.json"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
            >
              <Download className="w-4 h-4" /> Download Full Database Backup (JSON)
            </a>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold">
              GitHub Pages + Cloudflare Worker/D1 Export Files
            </h3>
            <p className="text-xs text-slate-500">
              Download your ready-made Custom Domain <code>CNAME</code>, Cloudflare Worker S2S
              Backend (<code>worker.js</code>), and D1 SQL Schema (<code>schema.sql</code>).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => downloadFile('CNAME', data.settings.customDomain)}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Download CNAME
              </button>
              <button
                onClick={() =>
                  downloadFile('schema.sql', generateCloudflareD1SchemaSql())
                }
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Download schema.sql (D1 DB)
              </button>
              <button
                onClick={() =>
                  downloadFile(
                    'worker.js',
                    generateCloudflareWorkerCode(data.settings)
                  )
                }
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg"
              >
                Download worker.js (S2S Backend)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
