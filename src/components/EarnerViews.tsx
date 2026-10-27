import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Flame,
  Gift,
  HelpCircle,
  Link2,
  Lock,
  Play,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import {
  BootstrapPayload,
  OfferwallPartner,
  PageRoute,
  PaidArticleItem,
  PayoutMethodType,
  QuizItem,
  ShortlinkItem,
} from '../types.ts';

interface EarnerViewsProps {
  data: BootstrapPayload;
  activePage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  apiPost: (endpoint: string, body?: any) => Promise<any>;
  refreshData: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EarnerViews: React.FC<EarnerViewsProps> = ({
  data,
  activePage,
  onNavigate,
  apiPost,
  refreshData,
  notify,
}) => {
  const { settings, currentUser } = data;

  // Promo Code State
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Spin Wheel State
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastWonCoins, setLastWonCoins] = useState<number | null>(null);

  // Offerwall Modal & Simulator State
  const [selectedOfferwall, setSelectedOfferwall] = useState<OfferwallPartner | null>(null);
  const [simCoins, setSimCoins] = useState(750);
  const [simProvider, setSimProvider] = useState<'notik' | 'lootably'>('notik');

  // Shortlink Verification Modal State (Captcha + Anti-Bypass Timer)
  const [activeShortlink, setActiveShortlink] = useState<ShortlinkItem | null>(null);
  const [captchaNumA, setCaptchaNumA] = useState(4);
  const [captchaNumB, setCaptchaNumB] = useState(5);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [shortlinkToken, setShortlinkToken] = useState<string | null>(null);
  const [shortlinkCountdown, setShortlinkCountdown] = useState(0);

  // Tasks / Quizzes / Articles Tab State
  const [taskSubTab, setTaskSubTab] = useState<'social' | 'quizzes' | 'articles'>('social');
  const [proofInputs, setProofInputs] = useState<Record<string, string>>({});
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [activeArticle, setActiveArticle] = useState<PaidArticleItem | null>(null);
  const [articleTimer, setArticleTimer] = useState(0);

  // Wallet & Withdrawal Form State
  const [selectedTierInr, setSelectedTierInr] = useState<number>(
    currentUser.completedFirstPayout ? settings.tier2PayoutInr : settings.starterPayoutInr
  );
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethodType>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [giftCardBrand, setGiftCardBrand] = useState('Amazon Pay Gift Card');
  const [deliveryEmail, setDeliveryEmail] = useState(currentUser.email);
  const [walletProvider, setWalletProvider] = useState('Paytm Wallet');
  const [walletPhone, setWalletPhone] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState('USDT (TRC20 - Tron)');
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Countdown tick for Shortlink Anti-Bypass Timer
  useEffect(() => {
    if (!shortlinkToken || shortlinkCountdown <= 0) return;
    const t = setInterval(() => {
      setShortlinkCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [shortlinkToken, shortlinkCountdown]);

  // Countdown tick for Paid Article Reader
  useEffect(() => {
    if (!activeArticle || articleTimer <= 0) return;
    const t = setInterval(() => {
      setArticleTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [activeArticle, articleTimer]);

  const availableInr = currentUser.availableCoins / settings.coinsPerInr;
  const pendingInr = currentUser.pendingCoins / settings.coinsPerInr;
  const starterUnlocked =
    currentUser.offerwallsCompleted >= 1 || currentUser.shortlinksCompleted >= 3;

  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    notify(`${label} copied!`, 'success');
  };

  // Daily Check-in Handler
  const handleDailyCheckIn = async () => {
    try {
      await apiPost('/api/rewards/daily-checkin');
      notify('Daily Check-In Streak Bonus claimed!', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  // Spin Wheel Handler
  const handleSpinWheel = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWonCoins(null);
    try {
      const res = await apiPost('/api/rewards/spin-wheel');
      const extraDegrees = 1440 + res.sliceIndex * 45;
      setWheelRotation((prev) => prev + extraDegrees);
      setTimeout(() => {
        setLastWonCoins(res.wonCoins);
        setSpinning(false);
        notify(`Jackpot! You won +${res.wonCoins} Coins on the Fortune Wheel!`, 'success');
      }, 1800);
    } catch (e: any) {
      setSpinning(false);
      notify(e.message, 'error');
    }
  };

  // Promo Code Claim Handler
  const handleClaimPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    try {
      await apiPost('/api/rewards/claim-promo', { code: promoInput });
      notify(`Lifafa Promo Code "${promoInput.toUpperCase()}" redeemed!`, 'success');
      setPromoInput('');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setPromoLoading(false);
    }
  };

  // Shortlink Modal Open
  const openShortlinkModal = (link: ShortlinkItem) => {
    const a = Math.floor(2 + Math.random() * 7);
    const b = Math.floor(2 + Math.random() * 7);
    setCaptchaNumA(a);
    setCaptchaNumB(b);
    setCaptchaAnswer('');
    setCaptchaPassed(false);
    setShortlinkToken(null);
    setShortlinkCountdown(0);
    setActiveShortlink(link);
  };

  const handlePassCaptchaAndStartLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShortlink) return;
    if (Number(captchaAnswer) !== captchaNumA + captchaNumB) {
      notify('Incorrect Captcha answer! Please try again.', 'error');
      return;
    }
    try {
      const res = await apiPost('/api/shortlinks/start', {
        shortlinkId: activeShortlink.id,
      });
      setCaptchaPassed(true);
      setShortlinkToken(res.token);
      setShortlinkCountdown(res.minResolveSeconds);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleClaimShortlinkReward = async () => {
    if (!shortlinkToken || !activeShortlink) return;
    try {
      await apiPost('/api/shortlinks/claim', { token: shortlinkToken });
      notify(
        `+${activeShortlink.rewardCoins} Coins credited! ${activeShortlink.provider} is now on 24h cooldown.`,
        'success'
      );
      setActiveShortlink(null);
      setShortlinkToken(null);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // Simulate Offerwall S2S Postback
  const handleSimulateOfferwallPostback = async (status: '1' | '2') => {
    try {
      const txId = `${simProvider.toUpperCase()}_${Math.floor(100000 + Math.random() * 900000)}`;
      await apiPost(
        `/api/postback/${simProvider}?user_id=${currentUser.id}&amount=${simCoins}&txn_id=${txId}&status=${status}`,
        { amount: simCoins, status }
      );
      await refreshData();
      if (status === '1') {
        notify(
          `S2S Postback Received! +${simCoins} Coins added to your ${settings.pendingHoldDays}-Day Pending Escrow Hold.`,
          'success'
        );
      } else {
        notify(
          `Chargeback Postback Simulated! -${simCoins} Coins reversed from your Pending Hold.`,
          'info'
        );
      }
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // ==========================================================================
  // VIEW 1: OFFERWALLS HUB ('offerwalls')
  // ==========================================================================
  if (activePage === 'offerwalls') {
    const enabledWalls = data.offerwalls.filter((o) => o.enabled);

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
              Main Earning Source · Server-to-Server (S2S) Postback Tracking
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Offerwalls & High-Payout App Tasks
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Complete app installs, surveys, and trial registrations. Earnings enter a{' '}
              <strong>{settings.pendingHoldDays}-Day Pending Balance Hold</strong> to protect
              against network chargebacks.
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-500 dark:text-slate-400">
            Your Tracking Sub-ID: <strong className="text-emerald-500">{currentUser.id}</strong>
          </div>
        </div>

        {/* Offerwall Partner Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {enabledWalls.map((wall) => {
            const resolvedUrl = wall.iframeUrl.replace('{USER_ID}', currentUser.id);
            return (
              <div
                key={wall.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {wall.badgeText}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{wall.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {wall.description}
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Clearance Hold: {wall.holdDays} Days</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      Avg ₹{wall.avgMonthlyEarningInr}/mo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedOfferwall(wall)}
                      className="px-3 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                      Open Offerwall
                    </button>
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Chrome Tab <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive S2S Postback & Chargeback Simulator (For Testing Live Backend!) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                LIVE S2S WEBHOOK TESTER · TEST OFFER COMPLETION & CHARGEBACK REVERSAL
              </p>
              <h3 className="text-base font-bold mt-0.5">
                Test How Notik.me & Lootably S2S Postbacks Credit Your Wallet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click below to fire a real HTTP webhook call to <code>/api/postback/:provider</code>{' '}
                for your account (<code>{currentUser.id}</code>).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2">
            <div>
              <label className="block text-xs font-medium mb-1">Offerwall Network</label>
              <select
                value={simProvider}
                onChange={(e) => setSimProvider(e.target.value as 'notik' | 'lootably')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="notik">Notik.me S2S Webhook</option>
                <option value="lootably">Lootably S2S Webhook</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Offer Reward (Coins)</label>
              <input
                type="number"
                min={50}
                max={10000}
                value={simCoins}
                onChange={(e) => setSimCoins(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
            <button
              onClick={() => handleSimulateOfferwallPostback('1')}
              className="py-2.5 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              Simulate Offer Credit (+{simCoins} Pending Coins)
            </button>
            <button
              onClick={() => handleSimulateOfferwallPostback('2')}
              className="py-2.5 px-4 text-xs font-semibold bg-red-600/90 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Simulate Chargeback Reversal (-{simCoins} Coins)
            </button>
          </div>
        </div>

        {/* Embedded Offerwall Modal */}
        {selectedOfferwall && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-base">{selectedOfferwall.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Tracking ID: {currentUser.id} · Hold Period: {selectedOfferwall.holdDays} Days
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOfferwall(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Close Window
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Live Offerwall Integration URL:
                  </p>
                  <code className="block font-mono text-emerald-600 dark:text-emerald-400 break-all">
                    {selectedOfferwall.iframeUrl.replace('{USER_ID}', currentUser.id)}
                  </code>
                  <p className="text-slate-500">
                    Note: Replace <code>YOUR_NOTIK_KEY</code> or <code>YOUR_LOOTABLY_ID</code> in
                    the Admin Panel once you register your domain (
                    <code>{settings.customDomain}</code>) on Notik.me / Lootably.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Install & Register Fintech App</p>
                      <p className="text-xs text-slate-500">Instant S2S Tracking · New Users</p>
                    </div>
                    <button
                      onClick={() => {
                        setSimCoins(850);
                        handleSimulateOfferwallPostback('1');
                        setSelectedOfferwall(null);
                      }}
                      className="px-3 py-2 text-xs font-mono font-semibold bg-emerald-600 text-white rounded-lg"
                    >
                      +850 Coins
                    </button>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Complete 5-Min Consumer Survey</p>
                      <p className="text-xs text-slate-500">High Fill Rate · India & Global</p>
                    </div>
                    <button
                      onClick={() => {
                        setSimCoins(450);
                        handleSimulateOfferwallPostback('1');
                        setSelectedOfferwall(null);
                      }}
                      className="px-3 py-2 text-xs font-mono font-semibold bg-emerald-600 text-white rounded-lg"
                    >
                      +450 Coins
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: PAID SHORTLINKS BONUS WALL ('shortlinks')
  // ==========================================================================
  if (activePage === 'shortlinks') {
    const enabledLinks = data.shortlinks.filter((s) => s.enabled);

    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
              Dedicated Shortlinks Bonus Wall · ShrinkMe.io & GPLinks
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Paid Shortlinks (Instant Wallet Credit)
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Pass the human Captcha check and complete the shortlink steps. Protected by a{' '}
              <strong>24-Hour IP/Device Cooldown</strong> and <strong>Anti-Bypass Timer</strong>.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Completed Today:{' '}
            <strong className="text-slate-900 dark:text-white">
              {Object.keys(data.shortlinkCooldowns).length} / {enabledLinks.length} Links
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enabledLinks.map((link) => {
            const expiryIso = data.shortlinkCooldowns[link.id];
            const isCoolingDown = expiryIso && new Date(expiryIso).getTime() > Date.now();
            const hoursLeft = isCoolingDown
              ? Math.max(
                  1,
                  Math.ceil((new Date(expiryIso).getTime() - Date.now()) / 3600000)
                )
              : 0;

            return (
              <div
                key={link.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {link.provider} · {link.stepsCount} Steps · Min {link.minResolveSeconds}s
                      Anti-Bypass Check
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {link.title}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{link.rewardCoins} Coins
                    </p>
                    <p className="text-xs font-mono text-slate-500">
                      ₹{(link.rewardCoins / settings.coinsPerInr).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Cooldown: {link.cooldownHours} Hours per IP/Device
                  </span>
                  {isCoolingDown ? (
                    <button
                      disabled
                      className="px-4 py-2 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed"
                    >
                      Locked ({hoursLeft}h Cooldown Left)
                    </button>
                  ) : (
                    <button
                      onClick={() => openShortlinkModal(link)}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                    >
                      Verify Captcha & Open Link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shortlink Captcha + Anti-Bypass Verification Modal */}
        {activeShortlink && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Human Anti-Bot Gate · {activeShortlink.provider}
                  </p>
                  <h3 className="font-bold text-base mt-0.5">{activeShortlink.title}</h3>
                </div>
                <button
                  onClick={() => setActiveShortlink(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {!captchaPassed ? (
                <form onSubmit={handlePassCaptchaAndStartLink} className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-semibold">
                      Human Captcha Verification: What is {captchaNumA} + {captchaNumB}?
                    </label>
                    <input
                      type="number"
                      required
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Enter sum..."
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                  >
                    Verify Captcha & Start Anti-Bypass Timer
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      Anti-Bypass Timer Running (Prevents Bot Scripts)
                    </p>
                    <p className="text-3xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {shortlinkCountdown}s
                    </p>
                    <a
                      href={activeShortlink.destinationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                    >
                      Open {activeShortlink.provider} in New Tab{' '}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <button
                    disabled={shortlinkCountdown > 0}
                    onClick={handleClaimShortlinkReward}
                    className={`w-full py-3 text-xs font-semibold rounded-lg transition-colors ${
                      shortlinkCountdown > 0
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {shortlinkCountdown > 0
                      ? `Wait ${shortlinkCountdown}s to Claim +${activeShortlink.rewardCoins} Coins...`
                      : `Verify & Claim +${activeShortlink.rewardCoins} Coins Now`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // VIEW 3: MICRO-TASKS, QUIZZES & PAID ARTICLES ('tasks')
  // ==========================================================================
  if (activePage === 'tasks') {
    const enabledTasks = data.tasks.filter((t) => t.enabled);
    const enabledQuizzes = data.quizzes.filter((q) => q.enabled);
    const enabledArticles = data.articles.filter((a) => a.enabled);

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
              Multi-Format Earning Hub · Social Missions, Quizzes & Reading
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Micro-Tasks, Quizzes & Paid Articles
            </h1>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setTaskSubTab('social')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                taskSubTab === 'social'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Social & Manual Tasks ({enabledTasks.length})
            </button>
            <button
              onClick={() => setTaskSubTab('quizzes')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                taskSubTab === 'quizzes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Trivia Quizzes ({enabledQuizzes.length})
            </button>
            <button
              onClick={() => setTaskSubTab('articles')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                taskSubTab === 'articles'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Paid Articles ({enabledArticles.length})
            </button>
          </div>
        </div>

        {/* Sub-Tab 1: Social & Manual Tasks */}
        {taskSubTab === 'social' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enabledTasks.map((task) => {
              const existingSub = data.userTaskSubmissions.find((s) => s.taskId === task.id);
              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500 uppercase">
                          {task.category.replace('_', ' ')} ·{' '}
                          {task.holdDays > 0 ? `${task.holdDays}d Hold` : 'Fast Approval'}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                          {task.title}
                        </h3>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        +{task.rewardCoins} Coins
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {task.instructions}
                    </p>
                    <a
                      href={task.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Open Task Destination Link <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    {existingSub ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Proof Submitted: <code>{existingSub.proofText}</code>
                        </span>
                        <span
                          className={`font-semibold uppercase ${
                            existingSub.status === 'approved'
                              ? 'text-emerald-500'
                              : existingSub.status === 'pending'
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {existingSub.status}
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={proofInputs[task.id] || ''}
                          onChange={(e) =>
                            setProofInputs({ ...proofInputs, [task.id]: e.target.value })
                          }
                          placeholder={task.proofPrompt}
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                        />
                        <button
                          onClick={async () => {
                            try {
                              await apiPost('/api/tasks/submit-proof', {
                                taskId: task.id,
                                proofText: proofInputs[task.id],
                              });
                              notify(
                                'Task proof submitted! Admin will review & credit your coins.',
                                'success'
                              );
                            } catch (err: any) {
                              notify(err.message, 'error');
                            }
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          Submit Proof
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-Tab 2: Quizzes */}
        {taskSubTab === 'quizzes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enabledQuizzes.map((qz) => {
                const isDone = data.completedQuizIds.includes(qz.id);
                return (
                  <div
                    key={qz.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <p className="text-xs text-slate-500">
                        {qz.topic} · {qz.questions.length} Questions
                      </p>
                      <h3 className="text-lg font-bold mt-1">{qz.title}</h3>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                      <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        +{qz.rewardCoins} Coins
                      </span>
                      {isDone ? (
                        <span className="text-xs font-semibold text-emerald-500">
                          Completed & Credited
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveQuiz(qz);
                            setQuizAnswers({});
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                        >
                          Start Quiz
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeQuiz && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h3 className="text-lg font-bold">{activeQuiz.title}</h3>
                  <button
                    onClick={() => setActiveQuiz(null)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Close Quiz
                  </button>
                </div>
                <div className="space-y-5">
                  {activeQuiz.questions.map((qObj, qIdx) => (
                    <div key={qIdx} className="space-y-2">
                      <p className="text-sm font-semibold">
                        {qIdx + 1}. {qObj.q}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {qObj.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx })}
                            className={`text-left px-3.5 py-2.5 text-xs rounded-lg border transition-colors ${
                              quizAnswers[qIdx] === oIdx
                                ? 'border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    let correct = 0;
                    activeQuiz.questions.forEach((q, idx) => {
                      if (quizAnswers[idx] === q.correctIndex) correct++;
                    });
                    if (correct < 2) {
                      notify(
                        `You scored ${correct}/${activeQuiz.questions.length}. Answer at least 2 correctly to claim coins!`,
                        'error'
                      );
                      return;
                    }
                    try {
                      await apiPost('/api/quizzes/complete', {
                        quizId: activeQuiz.id,
                        score: correct,
                        total: activeQuiz.questions.length,
                      });
                      notify(
                        `Quiz passed (${correct}/${activeQuiz.questions.length})! +${activeQuiz.rewardCoins} Coins added!`,
                        'success'
                      );
                      setActiveQuiz(null);
                    } catch (err: any) {
                      notify(err.message, 'error');
                    }
                  }}
                  className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  Submit Quiz & Claim +{activeQuiz.rewardCoins} Coins
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 3: Paid Articles */}
        {taskSubTab === 'articles' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enabledArticles.map((art) => {
                const isDone = data.completedArticleIds.includes(art.id);
                return (
                  <div
                    key={art.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <p className="text-xs text-slate-500">
                        {art.category} · {art.readTimeSeconds}s Focus Timer
                      </p>
                      <h3 className="text-lg font-bold mt-1">{art.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {art.summary}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                      <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        +{art.rewardCoins} Coins
                      </span>
                      {isDone ? (
                        <span className="text-xs font-semibold text-emerald-500">
                          Read & Claimed
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveArticle(art);
                            setArticleTimer(art.readTimeSeconds);
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                        >
                          Read & Earn
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeArticle && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h3 className="text-lg font-bold">{activeArticle.title}</h3>
                  <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {articleTimer > 0
                      ? `Reading Timer: ${articleTimer}s remaining`
                      : 'Timer Complete! Ready to Claim'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {activeArticle.content}
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    disabled={articleTimer > 0}
                    onClick={async () => {
                      try {
                        await apiPost('/api/articles/complete', {
                          articleId: activeArticle.id,
                        });
                        notify(
                          `+${activeArticle.rewardCoins} Coins credited for reading!`,
                          'success'
                        );
                        setActiveArticle(null);
                      } catch (err: any) {
                        notify(err.message, 'error');
                      }
                    }}
                    className={`px-5 py-2.5 text-xs font-semibold rounded-lg ${
                      articleTimer > 0
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {articleTimer > 0
                      ? `Keep Reading (${articleTimer}s)...`
                      : `Claim +${activeArticle.rewardCoins} Coins`}
                  </button>
                  <button
                    onClick={() => setActiveArticle(null)}
                    className="px-4 py-2.5 text-xs text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // VIEW 4: 3-LAYER REFER & EARN HUB ('referrals')
  // ==========================================================================
  if (activePage === 'referrals') {
    const refLink = `https://${settings.customDomain}/?ref=${currentUser.referralCode}`;
    const activeRefs = data.referrals.filter((r) => r.activated && !r.sameIpFlag).length;
    const totalCommissionCoins = data.referrals.reduce(
      (sum, r) => sum + r.totalCommissionEarnedCoins,
      0
    );

    const milestones = [
      { count: 5, rewardCoins: 1000, title: 'Starter Influencer (5 Active Friends)' },
      { count: 25, rewardCoins: 6000, title: 'Growth Ambassador (25 Active Friends)' },
      { count: 100, rewardCoins: 30000, title: 'VIP Partner (100 Active Friends)' },
    ];

    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            3-Layer Viral Referral Engine · Anti-Bot Protected
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Refer Friends & Earn {settings.referralCommissionPercent}% Lifetime Commission
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Earn <strong>+{settings.referralFlatBonusCoins} Coins (₹
            {(settings.referralFlatBonusCoins / settings.coinsPerInr).toFixed(0)})</strong> when
            your friend completes their 1st Offerwall or 3 Shortlinks, plus{' '}
            <strong>{settings.referralCommissionPercent}% lifetime bonus coins</strong> on all their
            future earnings!
          </p>
        </div>

        {/* Share Link & Code Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-2">
              <label className="block text-xs font-semibold text-slate-500">
                Your Unique Referral Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={refLink}
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                />
                <button
                  onClick={() => copyText(refLink, 'Referral Link')}
                  className="px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                onClick={() =>
                  copyText(currentUser.referralCode, `Referral Code (${currentUser.referralCode})`)
                }
                className="px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                Code: {currentUser.referralCode}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Join ${settings.siteName} using my code ${currentUser.referralCode} and get +${settings.referralWelcomeBonusCoins} Bonus Coins! Withdraw your first ₹${settings.starterPayoutInr} via UPI: ${refLink}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 text-xs font-semibold bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-600/25"
              >
                Share on WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  refLink
                )}&text=${encodeURIComponent(
                  `Earn daily UPI cash on ${settings.siteName}! Use code ${currentUser.referralCode} for +${settings.referralWelcomeBonusCoins} free coins.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-500/25"
              >
                Share on Telegram
              </a>
            </div>
          </div>
        </div>

        {/* 3 Referral Summary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Invited Friends</p>
            <p className="text-2xl font-bold font-mono tabular-nums mt-1">
              {data.referrals.length} Referrals ({activeRefs} Activated)
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500">Layer-1 Activation Bonuses Earned</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
              +{(activeRefs * settings.referralFlatBonusCoins).toLocaleString()} Coins
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500">
              Layer-2 Passive Commissions ({settings.referralCommissionPercent}%)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
              +{totalCommissionCoins.toLocaleString()} Coins
            </p>
          </div>
        </div>

        {/* Layer-3 Referral Milestones */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold">Layer-3 Referral Milestone Rewards</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {milestones.map((m) => {
              const claimed = currentUser.claimedMilestones.includes(m.count);
              const eligible = activeRefs >= m.count && !claimed;
              return (
                <div
                  key={m.count}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <p className="text-xs text-slate-500">{m.title}</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                      +{m.rewardCoins.toLocaleString()} Coins (₹
                      {(m.rewardCoins / settings.coinsPerInr).toFixed(0)})
                    </p>
                    <p className="text-xs font-mono text-slate-500 mt-1">
                      Progress: {activeRefs} / {m.count} Active Friends
                    </p>
                  </div>
                  <button
                    disabled={!eligible}
                    onClick={async () => {
                      try {
                        await apiPost('/api/referrals/claim-milestone', {
                          targetCount: m.count,
                        });
                        notify(`Claimed +${m.rewardCoins} Milestone Coins!`, 'success');
                      } catch (err: any) {
                        notify(err.message, 'error');
                      }
                    }}
                    className={`w-full py-2 text-xs font-semibold rounded-lg ${
                      claimed
                        ? 'bg-emerald-500/15 text-emerald-500 cursor-default'
                        : eligible
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {claimed
                      ? 'Milestone Claimed'
                      : eligible
                      ? 'Claim Milestone Reward'
                      : `Need ${m.count - activeRefs} More Active`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referred Users Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base">Your Referred Friends Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Friend Name</th>
                  <th className="py-3 px-4">Activation Status</th>
                  <th className="py-3 px-4 text-right">Flat Bonus</th>
                  <th className="py-3 px-4 text-right">10% Lifetime Commission</th>
                  <th className="py-3 px-4">Anti-Fraud Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-medium">{r.inviteeName}</td>
                    <td className="py-3 px-4 text-xs">
                      {r.activated ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Activated (Task Completed)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          Pending 1st Offerwall / 3 Shortlinks
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      +{r.flatBonusCoins} Coins
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{r.totalCommissionEarnedCoins} Coins
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {r.sameIpFlag ? (
                        <span className="text-red-500 font-semibold">
                          Blocked (Duplicate IP Detected)
                        </span>
                      ) : (
                        <span className="text-slate-500">Verified Unique IP</span>
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

  // ==========================================================================
  // VIEW 5: DUAL-LEDGER WALLET & MULTI-RAIL CASHOUT ('wallet')
  // ==========================================================================
  if (activePage === 'wallet') {
    const tiers = [
      {
        inr: settings.starterPayoutInr,
        label: `₹${settings.starterPayoutInr} Starter Hook`,
        locked: currentUser.completedFirstPayout,
        note: currentUser.completedFirstPayout
          ? 'Used on 1st Cashout'
          : starterUnlocked
          ? 'Unlocked & Ready!'
          : 'Need 1 Offerwall or 3 Shortlinks',
      },
      {
        inr: settings.tier2PayoutInr,
        label: `₹${settings.tier2PayoutInr} Standard Tier`,
        locked: false,
        note: `${(settings.tier2PayoutInr * settings.coinsPerInr).toLocaleString()} Coins`,
      },
      {
        inr: settings.tier3PayoutInr,
        label: `₹${settings.tier3PayoutInr} Pro Tier`,
        locked: false,
        note: `${(settings.tier3PayoutInr * settings.coinsPerInr).toLocaleString()} Coins`,
      },
      {
        inr: settings.tier4PayoutInr,
        label: `₹${settings.tier4PayoutInr} VIP Tier`,
        locked: false,
        note: `${(settings.tier4PayoutInr * settings.coinsPerInr).toLocaleString()} Coins`,
      },
    ];

    const handleWithdrawSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setWithdrawLoading(true);
      try {
        await apiPost('/api/wallet/withdraw', {
          amountInr: selectedTierInr,
          method: selectedMethod,
          payoutDetails: {
            upiId,
            accountHolder,
            accountNumber,
            ifscCode,
            giftCardBrand,
            deliveryEmail,
            walletProvider,
            walletPhone,
            cryptoNetwork,
            cryptoAddress,
          },
        });
        notify(
          `Withdrawal request for ₹${selectedTierInr} via ${selectedMethod.toUpperCase()} submitted!`,
          'success'
        );
      } catch (err: any) {
        notify(err.message, 'error');
      } finally {
        setWithdrawLoading(false);
      }
    };

    const pendingEntries = data.ledger.filter((l) => l.status === 'pending_hold');

    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            Dual-Ledger Escrow Wallet · Progressive Withdrawal Scaling
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Wallet & Multi-Rail Cashout
          </h1>
        </div>

        {/* Dual Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-1">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Withdrawable Available Balance
            </p>
            <p className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
              ₹{availableInr.toFixed(2)}
            </p>
            <p className="text-xs font-mono text-slate-500">
              {currentUser.availableCoins.toLocaleString()} Cleared Coins
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-1">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Pending Clearance Balance ({settings.pendingHoldDays}-Day Escrow Hold)
            </p>
            <p className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              ₹{pendingInr.toFixed(2)}
            </p>
            <p className="text-xs font-mono text-slate-500">
              {currentUser.pendingCoins.toLocaleString()} Coins in Verification Queue
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-1">
            <p className="text-xs font-medium text-slate-500">Total Withdrawn to Date</p>
            <p className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
              ₹{currentUser.totalWithdrawnInr.toFixed(2)}
            </p>
            <p className="text-xs font-mono text-slate-500">
              Lifetime Earned: {currentUser.lifetimeEarnedCoins.toLocaleString()} Coins
            </p>
          </div>
        </div>

        {/* Withdrawal Request Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleWithdrawSubmit}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-lg font-bold">1. Select Progressive Payout Tier</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your 1st withdrawal is unlocked at just ₹{settings.starterPayoutInr}. Subsequent
                withdrawals scale to ₹{settings.tier2PayoutInr}+ to protect platform unit economics.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tiers.map((t) => (
                <button
                  type="button"
                  key={t.inr}
                  disabled={t.locked}
                  onClick={() => setSelectedTierInr(t.inr)}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    t.locked
                      ? 'opacity-45 cursor-not-allowed border-slate-200 dark:border-slate-800'
                      : selectedTierInr === t.inr
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <p className="text-lg font-bold font-mono tabular-nums">₹{t.inr}</p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                    {t.label}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">{t.note}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold">2. Choose Withdrawal Method</h3>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'upi', label: 'UPI (ID / QR)' },
                    { key: 'bank', label: 'Bank Transfer (IMPS)' },
                    { key: 'gift_card', label: 'Gift Cards (Amazon/Play)' },
                    { key: 'ewallet', label: 'Paytm / PhonePe Wallet' },
                    { key: 'crypto', label: 'Crypto (USDT)' },
                  ] as const
                )
                  .filter((m) => settings.payoutMethodsEnabled[m.key])
                  .map((m) => (
                    <button
                      type="button"
                      key={m.key}
                      onClick={() => setSelectedMethod(m.key)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        selectedMethod === m.key
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Dynamic Payout Rail Inputs */}
            <div className="space-y-4 pt-2">
              {selectedMethod === 'upi' && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Enter Your UPI ID (Google Pay, PhonePe, Paytm, BHIM)
                  </label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@okaxis or 9876543210@ybl"
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                </div>
              )}

              {selectedMethod === 'bank' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      required
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="000011112222"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">11-Digit IFSC Code</label>
                    <input
                      type="text"
                      required
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="SBIN0001234"
                      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'gift_card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Select Gift Card Brand</label>
                    <select
                      value={giftCardBrand}
                      onChange={(e) => setGiftCardBrand(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option>Amazon Pay Gift Card</option>
                      <option>Google Play Recharge Code</option>
                      <option>Flipkart Gift Voucher</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Delivery Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'ewallet' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">E-Wallet Provider</label>
                    <select
                      value={walletProvider}
                      onChange={(e) => setWalletProvider(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option>Paytm Wallet</option>
                      <option>PhonePe Wallet</option>
                      <option>Amazon Pay Balance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Registered Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'crypto' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Crypto Network</label>
                    <select
                      value={cryptoNetwork}
                      onChange={(e) => setCryptoNetwork(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option>USDT (TRC20 - Tron)</option>
                      <option>USDT (BEP20 - BSC)</option>
                      <option>Binance Pay ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Wallet Address / Binance ID
                    </label>
                    <input
                      type="text"
                      required
                      value={cryptoAddress}
                      onChange={(e) => setCryptoAddress(e.target.value)}
                      placeholder="T... or 0x..."
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={withdrawLoading}
              className="w-full py-3 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              {withdrawLoading
                ? 'Submitting Withdrawal...'
                : `Withdraw ₹${selectedTierInr} (${(
                    selectedTierInr * settings.coinsPerInr
                  ).toLocaleString()} Coins) via ${selectedMethod.toUpperCase()}`}
            </button>
          </form>

          {/* Right Column: 3-to-5-Day Pending Balance Clearance Queue */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Anti-Chargeback Escrow Queue
              </p>
              <h3 className="text-lg font-bold mt-0.5">
                Pending Earnings ({settings.pendingHoldDays}-Day Hold)
              </h3>
              <p className="text-xs text-slate-500">
                These coins automatically move to your Withdrawable Balance on the unlock date
                below.
              </p>
            </div>

            {pendingEntries.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No pending holds right now. Complete an Offerwall task to see escrow tracking!
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEntries.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                        Unlocks:{' '}
                        {item.unlocksAt
                          ? new Date(item.unlocksAt).toLocaleDateString()
                          : 'Soon'}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400 shrink-0">
                      +{item.amountCoins} Coins
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Withdrawal History & Full Coin Ledger */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base">Your Recent Wallet & Withdrawal Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Activity / Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Coins</th>
                  <th className="py-3 px-4">Escrow Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.ledger.slice(0, 12).map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 px-4 font-medium">{entry.title}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 uppercase">
                      {entry.sourceType.replace('_', ' ')}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        entry.amountCoins >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500'
                      }`}
                    >
                      {entry.amountCoins >= 0 ? `+${entry.amountCoins}` : entry.amountCoins} Coins
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {entry.status === 'cleared' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Cleared in Available Wallet
                        </span>
                      ) : entry.status === 'pending_hold' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {settings.pendingHoldDays}-Day Pending Hold
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">Chargeback Reversed</span>
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

  // ==========================================================================
  // DEFAULT EARNER VIEW: OVERVIEW DASHBOARD ('dashboard')
  // ==========================================================================
  const todayStr = new Date().toISOString().slice(0, 10);
  const checkedInToday = currentUser.lastCheckInDate?.slice(0, 10) === todayStr;
  const spunToday = currentUser.lastSpinDate?.slice(0, 10) === todayStr;

  return (
    <div className="space-y-8">
      {/* Top Welcome & Dual-Ledger Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Welcome back, <strong className="text-slate-900 dark:text-white">{currentUser.name}</strong> · Referral Code: <code className="text-emerald-500 font-mono">{currentUser.referralCode}</code>
              </p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
                Earner Command Center
              </h1>
            </div>
            <button
              onClick={() => onNavigate('wallet')}
              className="px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Withdraw Funds (₹{availableInr.toFixed(2)})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500">Available Coins</p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {currentUser.availableCoins.toLocaleString()}
              </p>
              <p className="text-xs font-mono text-slate-500">₹{availableInr.toFixed(2)} Ready</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">
                Pending Hold ({settings.pendingHoldDays}d)
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                {currentUser.pendingCoins.toLocaleString()}
              </p>
              <p className="text-xs font-mono text-slate-500">₹{pendingInr.toFixed(2)} In Escrow</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Offerwalls & Links</p>
              <p className="text-xl font-bold font-mono tabular-nums mt-0.5">
                {currentUser.offerwallsCompleted + currentUser.shortlinksCompleted}
              </p>
              <p className="text-xs text-slate-500">
                {currentUser.offerwallsCompleted} Offers · {currentUser.shortlinksCompleted} Links
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current Payout Tier</p>
              <p className="text-xl font-bold font-mono tabular-nums mt-0.5">
                ₹
                {currentUser.completedFirstPayout
                  ? settings.tier2PayoutInr
                  : settings.starterPayoutInr}{' '}
                Min
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {currentUser.completedFirstPayout
                  ? 'Scaled Tier Active'
                  : starterUnlocked
                  ? '₹10 Starter Unlocked!'
                  : 'Complete 1 Offer to Unlock'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Lifafa / Promo Code Claim Card */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
              DAILY LIFAFA & PROMO CODE BOX
            </p>
            <h3 className="text-base font-bold mt-1">Redeem Instant Bonus Coins</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Try active codes: <code className="text-emerald-500 font-mono">LOOTIFY100</code> or{' '}
              <code className="text-emerald-500 font-mono">LAUNCH250</code>
            </p>
          </div>

          <form onSubmit={handleClaimPromo} className="space-y-2.5">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Enter Promo Code (e.g. LOOTIFY100)"
              className="w-full px-3.5 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <button
              type="submit"
              disabled={promoLoading}
              className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              {promoLoading ? 'Redeeming...' : 'Claim Lifafa Coins'}
            </button>
          </form>
        </div>
      </div>

      {/* 7-Day Daily Streak Ladder + Fortune Spin Wheel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Daily Retention Ladder · Current Streak: {currentUser.streakDays} Days
              </p>
              <h3 className="text-lg font-bold mt-0.5">7-Day Check-In Bonus</h3>
            </div>
            <button
              disabled={checkedInToday}
              onClick={handleDailyCheckIn}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                checkedInToday
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {checkedInToday ? 'Claimed Today' : 'Claim Today’s Check-In'}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {settings.dailyStreakRewards.map((coins, idx) => {
              const isPast = idx < currentUser.streakDays % 7;
              const isCurrent = idx === currentUser.streakDays % 7;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-center space-y-1 ${
                    isPast
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : isCurrent
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p className="text-[11px] text-slate-500">Day {idx + 1}</p>
                  <p className="text-xs font-bold font-mono tabular-nums">+{coins}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fortune Spin Wheel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                1 Free Spin Every 24 Hours
              </p>
              <h3 className="text-lg font-bold mt-0.5">Daily Fortune Wheel</h3>
            </div>
            <div
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: 'transform 1.7s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-amber-500 flex items-center justify-center font-mono text-xs font-bold"
            >
              SPIN
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Possible Prizes:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {settings.spinWheelSlices.join(' · ')} Coins
            </span>
          </p>

          {lastWonCoins !== null && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold text-center">
              Congratulations! You won +{lastWonCoins} Coins!
            </div>
          )}

          <button
            disabled={spunToday || spinning}
            onClick={handleSpinWheel}
            className={`w-full py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              spunToday
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {spinning
              ? 'Spinning Wheel...'
              : spunToday
              ? 'Spin Used Today (Resets in 24h)'
              : 'Spin Fortune Wheel Now'}
          </button>
        </div>
      </div>

      {/* Quick Action Cards to Earning Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Notik.me & Lootably
            </p>
            <h3 className="text-lg font-bold mt-1">High-Payout Offerwalls</h3>
            <p className="text-xs text-slate-500 mt-1">
              Earn 500 to 15,000 Coins per app install or survey.
            </p>
          </div>
          <button
            onClick={() => onNavigate('offerwalls')}
            className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
          >
            Open Offerwalls
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ShrinkMe.io & GPLinks
            </p>
            <h3 className="text-lg font-bold mt-1">Paid Shortlinks Wall</h3>
            <p className="text-xs text-slate-500 mt-1">
              Instant coin credit after Captcha + 10s verification.
            </p>
          </div>
          <button
            onClick={() => onNavigate('shortlinks')}
            className="w-full py-2.5 text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg"
          >
            Solve Shortlinks
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {settings.referralCommissionPercent}% Lifetime Commission
            </p>
            <h3 className="text-lg font-bold mt-1">Refer & Earn Network</h3>
            <p className="text-xs text-slate-500 mt-1">
              Get +{settings.referralFlatBonusCoins} Coins per active friend + 10% forever.
            </p>
          </div>
          <button
            onClick={() => onNavigate('referrals')}
            className="w-full py-2.5 text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg"
          >
            Open Referral Hub
          </button>
        </div>
      </div>
    </div>
  );
};
