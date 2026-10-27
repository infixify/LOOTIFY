import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AdPlacementItem,
  BootstrapPayload,
  CustomTaskItem,
  LedgerEntry,
  OfferwallPartner,
  PaidArticleItem,
  PostbackLogItem,
  PromoCodeItem,
  QuizItem,
  ReferralRecord,
  ShortlinkItem,
  SystemSettings,
  TaskSubmission,
  UserProfile,
  WithdrawalRequest,
} from './src/types.ts';

interface DatabaseSchema {
  settings: SystemSettings;
  users: UserProfile[];
  offerwalls: OfferwallPartner[];
  shortlinks: ShortlinkItem[];
  shortlinkCooldowns: Record<string, Record<string, string>>; // userId -> { shortlinkId: expiryISO }
  shortlinkActiveTokens: Record<string, { shortlinkId: string; startedAtMs: number }>; // token -> session
  tasks: CustomTaskItem[];
  taskSubmissions: TaskSubmission[];
  quizzes: QuizItem[];
  completedQuizzes: Record<string, string[]>; // userId -> quizIds
  articles: PaidArticleItem[];
  completedArticles: Record<string, string[]>; // userId -> articleIds
  ledger: LedgerEntry[];
  withdrawals: WithdrawalRequest[];
  referrals: ReferralRecord[];
  promoCodes: PromoCodeItem[];
  adPlacements: AdPlacementItem[];
  postbackLogs: PostbackLogItem[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lootify_db.json');

function createInitialDatabase(): DatabaseSchema {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 1 * 86400000).toISOString();
  const twoDaysAhead = new Date(now.getTime() + 2 * 86400000).toISOString();
  const threeDaysAhead = new Date(now.getTime() + 3 * 86400000).toISOString();

  return {
    settings: {
      siteName: 'Lootify',
      customDomain: 'lootify.eternant.c0m.to',
      apiSubdomain: 'lootify-api.sarthaksinghyadav1.workers.dev',
      defaultTheme: 'dark',
      coinsPerInr: 100, // 100 Coins = ₹1
      pendingHoldDays: 3, // 3-day anti-chargeback hold
      starterPayoutInr: 10, // ₹10 First Payout Trust Hook (1,000 Coins)
      tier2PayoutInr: 50, // ₹50 after first payout
      tier3PayoutInr: 100, // ₹100
      tier4PayoutInr: 500, // ₹500
      referralFlatBonusCoins: 500, // ₹5 when referred user completes 1st offerwall or 3 shortlinks
      referralWelcomeBonusCoins: 200, // ₹2 joining bonus
      referralCommissionPercent: 10, // 10% lifetime passive commission
      dailyStreakRewards: [25, 40, 60, 85, 110, 150, 250],
      spinWheelSlices: [15, 30, 50, 75, 100, 150, 250, 500],
      announcementText:
        'Welcome to Lootify! Complete any 1 Offerwall or 3 Shortlinks to unlock your instant ₹10 Starter UPI Withdrawal.',
      announcementActive: true,
      payoutMethodsEnabled: {
        upi: true,
        bank: true,
        gift_card: true,
        ewallet: true,
        crypto: true,
      },
    },
    users: [
      {
        id: "usr_admin_1",
        name: "Sarthak (Founder & Admin)",
        email: "sarthaksinghyadav1@gmail.com",
        role: "admin",
        referralCode: "LOOTADMIN",
        referredBy: null,
        referralActivated: true,
        availableCoins: 0,
        pendingCoins: 0,
        lifetimeEarnedCoins: 0,
        totalWithdrawnInr: 0,
        completedFirstPayout: false,
        offerwallsCompleted: 0,
        shortlinksCompleted: 0,
        tasksCompleted: 0,
        streakDays: 0,
        lastCheckInDate: null,
        lastSpinDate: null,
        claimedMilestones: [],
        ipAddress: "0.0.0.0",
        deviceFingerprint: "fp_admin_master_01",
        status: "active",
        createdAt: new Date().toISOString(),
      },
    ],
    offerwalls: [
      {
        id: 'ow_notik',
        name: 'Notik.me Offerwall',
        providerKey: 'notik',
        badgeText: 'Top Indian Payouts · Subdomain Friendly',
        description:
          'Install trending Indian fintech & gaming apps, complete quick registrations, and earn up to ₹150 per offer. Automatically tracks via S2S Postback.',
        iframeUrl: 'https://notik.me/coins?api_key=YOUR_NOTIK_KEY&pub_id=LOOTIFY&user_id={USER_ID}',
        postbackSecret: 'notik_sec_99281a',
        payoutMultiplierPercent: 100,
        holdDays: 3,
        avgMonthlyEarningInr: 1850,
        enabled: true,
      },
      {
        id: 'ow_lootably',
        name: 'Lootably Tasks & Surveys',
        providerKey: 'lootably',
        badgeText: 'Instant Approval · High Survey Fill',
        description:
          'Complete daily market surveys, mobile game milestones, and one-click trial signups with fast S2S postback crediting.',
        iframeUrl:
          'https://wall.lootably.com/?placementID=YOUR_LOOTABLY_ID&sid={USER_ID}',
        postbackSecret: 'lootably_sec_7741b',
        payoutMultiplierPercent: 100,
        holdDays: 3,
        avgMonthlyEarningInr: 1400,
        enabled: true,
      },
      {
        id: 'ow_monetag',
        name: 'Monetag Direct SmartLink & Web Offers',
        providerKey: 'monetag',
        badgeText: 'High CPM · Instant Web Tasks',
        description:
          'Engage with sponsored web landing pages and micro-actions optimized for desktop and mobile Chrome browsers.',
        iframeUrl: 'https://monetag.com/smartlink?zone=LOOTIFY_ZONE&subid={USER_ID}',
        postbackSecret: 'monetag_sec_5512c',
        payoutMultiplierPercent: 100,
        holdDays: 3,
        avgMonthlyEarningInr: 950,
        enabled: true,
      },
    ],
    shortlinks: [
      {
        id: 'sl_shrinkme_1',
        provider: 'ShrinkMe.io',
        title: 'ShrinkMe Premium Bonus Link #1',
        destinationUrl: 'https://shrinkme.io/lootify-bonus-1',
        rewardCoins: 80, // ₹0.80
        cooldownHours: 24,
        minResolveSeconds: 10,
        stepsCount: 3,
        dailyMaxClaims: 1,
        enabled: true,
      },
      {
        id: 'sl_gplinks_1',
        provider: 'GPLinks',
        title: 'GPLinks High-CPM India Link #1',
        destinationUrl: 'https://gplinks.co/lootify-india-1',
        rewardCoins: 100, // ₹1.00
        cooldownHours: 24,
        minResolveSeconds: 12,
        stepsCount: 3,
        dailyMaxClaims: 1,
        enabled: true,
      },
      {
        id: 'sl_shrinkme_2',
        provider: 'ShrinkMe.io',
        title: 'ShrinkMe Fast Track Link #2',
        destinationUrl: 'https://shrinkme.io/lootify-fast-2',
        rewardCoins: 70, // ₹0.70
        cooldownHours: 24,
        minResolveSeconds: 10,
        stepsCount: 2,
        dailyMaxClaims: 1,
        enabled: true,
      },
      {
        id: 'sl_gplinks_2',
        provider: 'GPLinks',
        title: 'GPLinks Express Reward #2',
        destinationUrl: 'https://gplinks.co/lootify-express-2',
        rewardCoins: 90, // ₹0.90
        cooldownHours: 24,
        minResolveSeconds: 10,
        stepsCount: 3,
        dailyMaxClaims: 1,
        enabled: true,
      },
    ],
    shortlinkCooldowns: {},
    shortlinkActiveTokens: {},
    tasks: [
      {
        id: 'tsk_tg_join',
        category: 'telegram',
        title: 'Join Official Lootify Payment Proofs Channel',
        instructions:
          '1. Click the link to open our official channel.\n2. Join the channel and turn on notifications for daily Lifafa Promo Codes.\n3. Enter your Telegram @username below for verification.',
        targetUrl: 'https://t.me/lootify_official',
        rewardCoins: 150,
        holdDays: 0,
        proofPrompt: 'Enter your Telegram @username',
        enabled: true,
      },
      {
        id: 'tsk_yt_sub',
        category: 'youtube',
        title: 'Subscribe & Comment on Lootify Tutorial Video',
        instructions:
          '1. Open the YouTube tutorial video.\n2. Subscribe to the channel, like the video, and leave a helpful comment.\n3. Submit your YouTube handle or channel name.',
        targetUrl: 'https://youtube.com',
        rewardCoins: 200,
        holdDays: 1,
        proofPrompt: 'Enter your YouTube @handle and comment text',
        enabled: true,
      },
      {
        id: 'tsk_ig_follow',
        category: 'instagram',
        title: 'Follow Lootify on Instagram & Share Story',
        instructions:
          '1. Follow our official Instagram page.\n2. Tag 2 friends in the pinned giveaway post.\n3. Enter your Instagram @username.',
        targetUrl: 'https://instagram.com',
        rewardCoins: 150,
        holdDays: 1,
        proofPrompt: 'Enter your Instagram @username',
        enabled: true,
      },
      {
        id: 'tsk_trustpilot',
        category: 'app_review',
        title: 'Write an Honest Review After Your First ₹10 Payout',
        instructions:
          '1. Once you receive your ₹10 UPI payout, post your honest review with payout UTR proof.\n2. Paste your review link or username below.',
        targetUrl: 'https://trustpilot.com',
        rewardCoins: 350,
        holdDays: 3,
        proofPrompt: 'Enter your review link or display name',
        enabled: true,
      },
    ],
    taskSubmissions: [],
    quizzes: [
      {
        id: 'qz_fintech_1',
        title: 'Indian Digital Payments & UPI Trivia',
        topic: 'Fintech & Banking',
        rewardCoins: 120,
        timeLimitSeconds: 60,
        enabled: true,
        questions: [
          {
            q: 'Which organization developed the Unified Payments Interface (UPI) in India?',
            options: ['SEBI', 'NPCI', 'IRDAI', 'NABARD'],
            correctIndex: 1,
          },
          {
            q: 'How many digits are there in a standard Indian Bank IFSC code?',
            options: ['9 digits', '10 digits', '11 characters', '14 characters'],
            correctIndex: 2,
          },
          {
            q: 'On Lootify, how many Coins equal ₹10 INR for your starter withdrawal?',
            options: ['100 Coins', '500 Coins', '1,000 Coins', '5,000 Coins'],
            correctIndex: 2,
          },
        ],
      },
      {
        id: 'qz_crypto_2',
        title: 'Web3 & USDT Stablecoin Basics Quiz',
        topic: 'Crypto & Web3',
        rewardCoins: 150,
        timeLimitSeconds: 60,
        enabled: true,
        questions: [
          {
            q: 'What real-world currency is USDT (Tether) pegged 1:1 to?',
            options: ['Euro (EUR)', 'US Dollar (USD)', 'Japanese Yen (JPY)', 'British Pound'],
            correctIndex: 1,
          },
          {
            q: 'Which blockchain network is widely used for low-fee TRC20 USDT transfers?',
            options: ['Tron Network', 'Solana', 'Bitcoin Mainnet', 'Dogecoin'],
            correctIndex: 0,
          },
          {
            q: 'Why does Lootify hold big offerwall earnings in a 3-to-5 day pending state?',
            options: [
              'For fun',
              'To protect against ad-network chargebacks & fake app uninstalls',
              'Because servers sleep',
              'None of the above',
            ],
            correctIndex: 1,
          },
        ],
      },
    ],
    completedQuizzes: {},
    articles: [
      {
        id: 'art_1',
        title: 'How Offerwall Postbacks & Pending Holds Guarantee Safe Daily UPI Payouts',
        category: 'Earning Guide',
        summary:
          'Understand how S2S tracking works between Notik.me, Lootably, and your Lootify wallet.',
        content:
          'When you complete an app install or survey on Notik.me or Lootably, the advertiser sends an encrypted Server-to-Server (S2S) postback to Lootify. To keep payout rates high and prevent bot abuse, high-value offerwall credits enter a 3-day Pending Clearance Queue before unlocking for instant UPI, Bank, Gift Card, or USDT cashout. Tip: Always open heavy offerwall tasks directly in Chrome without a VPN so your tracking cookie never drops!',
        readTimeSeconds: 10,
        rewardCoins: 60,
        enabled: true,
      },
      {
        id: 'art_2',
        title: '5 Legitimate Ways to Maximize Your 10% Lifetime Referral Commission',
        category: 'Growth Strategy',
        summary:
          'Learn how top Lootify earners build passive daily coin streams without spamming.',
        content:
          'With Lootify’s 3-Layer Refer & Earn engine, you earn a flat 500 Coins (₹5) activation bonus as soon as your invited friend completes their first Offerwall or 3 Shortlinks, plus a 10% lifetime passive commission on every single coin they earn forever. Share your unique referral link alongside your ₹10 starter UPI payout screenshot on WhatsApp statuses, college groups, and Telegram channels to convert 4x more active earners.',
        readTimeSeconds: 10,
        rewardCoins: 60,
        enabled: true,
      },
    ],
    completedArticles: {},
    ledger: [],
    withdrawals: [],
    referrals: [],
    promoCodes: [
      {
        id: 'prm_1',
        code: 'LOOTIFY100',
        rewardCoins: 100,
        maxClaims: 500,
        claimedUserIds: [],
        active: true,
        createdAt: twoDaysAgo,
      },
      {
        id: 'prm_2',
        code: 'LAUNCH250',
        rewardCoins: 250,
        maxClaims: 100,
        claimedUserIds: [],
        active: true,
        createdAt: oneDayAgo,
      },
    ],
    adPlacements: [
      {
        id: 'ad_1',
        slotKey: 'header_banner',
        network: 'Monetag',
        title: 'Top Leaderboard 728x90 / Responsive Banner',
        scriptOrHtml: '<!-- Monetag Vignette / Banner Zone #88412 -->',
        enabled: true,
      },
      {
        id: 'ad_2',
        slotKey: 'sidebar_box',
        network: 'Adsterra',
        title: 'Sidebar 300x250 High-CPM Native Box',
        scriptOrHtml: '<!-- Adsterra Native Banner Script Zone #33109 -->',
        enabled: true,
      },
      {
        id: 'ad_3',
        slotKey: 'shortlink_interstitial',
        network: 'Monetag',
        title: 'Shortlink Verification Sponsor Banner',
        scriptOrHtml: '<!-- Monetag Direct Link Interstitial -->',
        enabled: true,
      },
      {
        id: 'ad_4',
        slotKey: 'popunder_script',
        network: 'Adsterra',
        title: 'Global Popunder (Max 1 per 12h)',
        scriptOrHtml: '<!-- Adsterra Popunder Script (Subdomain Approved) -->',
        enabled: false,
      },
    ],
    postbackLogs: [],
  };
}

// 95% Smart RAM Cache + Persistent Disk Sync
let memoryDb: DatabaseSchema | null = null;

function getDb(): DatabaseSchema {
  if (memoryDb) return memoryDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDb = JSON.parse(raw) as DatabaseSchema;
      return memoryDb;
    } catch (e) {
      console.error('Failed to read DB file, re-initializing:', e);
    }
  }
  memoryDb = createInitialDatabase();
  saveDb();
  return memoryDb;
}

function saveDb() {
  if (!memoryDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to persist DB:', e);
  }
}

// Automatically release any matured pending_hold ledger entries whose unlocksAt <= now
function processMaturedPendingHolds(db: DatabaseSchema) {
  const nowMs = Date.now();
  let mutated = false;
  for (const entry of db.ledger) {
    if (
      entry.status === 'pending_hold' &&
      entry.unlocksAt &&
      new Date(entry.unlocksAt).getTime() <= nowMs
    ) {
      entry.status = 'cleared';
      const user = db.users.find((u) => u.id === entry.userId);
      if (user) {
        user.pendingCoins = Math.max(0, user.pendingCoins - entry.amountCoins);
        user.availableCoins += entry.amountCoins;
      }
      mutated = true;
    }
  }
  if (mutated) saveDb();
}

// Helper to credit a user and trigger Layer-1 & Layer-2 Refer & Earn bonuses
function creditUserEarnings(
  db: DatabaseSchema,
  user: UserProfile,
  amountCoins: number,
  sourceType: LedgerEntry['sourceType'],
  title: string,
  holdDays: number,
  externalTxId?: string
) {
  const now = new Date();
  const isHold = holdDays > 0;
  const unlocksAt = isHold
    ? new Date(now.getTime() + holdDays * 86400000).toISOString()
    : null;

  if (isHold) {
    user.pendingCoins += amountCoins;
  } else {
    user.availableCoins += amountCoins;
  }
  user.lifetimeEarnedCoins += amountCoins;

  db.ledger.unshift({
    id: `ldg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    userName: user.name,
    sourceType,
    title,
    amountCoins,
    status: isHold ? 'pending_hold' : 'cleared',
    createdAt: now.toISOString(),
    unlocksAt,
    externalTxId,
  });

  // Check Refer & Earn Layer 1 (Activation Flat Bonus) & Layer 2 (Lifetime Commission)
  if (user.referredBy) {
    const referrer = db.users.find((u) => u.referralCode === user.referredBy);
    const refRecord = db.referrals.find((r) => r.inviteeId === user.id);

    if (referrer && refRecord && !refRecord.sameIpFlag) {
      // Layer 2: Lifetime Commission (%)
      const commissionCoins = Math.max(
        1,
        Math.round((amountCoins * db.settings.referralCommissionPercent) / 100)
      );
      referrer.availableCoins += commissionCoins;
      referrer.lifetimeEarnedCoins += commissionCoins;
      refRecord.totalCommissionEarnedCoins += commissionCoins;

      db.ledger.unshift({
        id: `ldg_comm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        userId: referrer.id,
        userName: referrer.name,
        sourceType: 'referral_commission',
        title: `${db.settings.referralCommissionPercent}% Referral Commission from ${user.name}`,
        amountCoins: commissionCoins,
        status: 'cleared',
        createdAt: now.toISOString(),
        unlocksAt: null,
      });

      // Layer 1: Activation Flat Bonus if user completed 1 Offerwall or 3 Shortlinks
      const meetsActivation =
        user.offerwallsCompleted >= 1 || user.shortlinksCompleted >= 3;
      if (!user.referralActivated && meetsActivation) {
        user.referralActivated = true;
        refRecord.activated = true;
        const flatBonus = db.settings.referralFlatBonusCoins;
        refRecord.flatBonusCoins = flatBonus;
        referrer.availableCoins += flatBonus;
        referrer.lifetimeEarnedCoins += flatBonus;

        db.ledger.unshift({
          id: `ldg_ref_${Date.now()}`,
          userId: referrer.id,
          userName: referrer.name,
          sourceType: 'referral_bonus',
          title: `Layer-1 Referral Activation Bonus (${user.name} completed qualifying task!)`,
          amountCoins: flatBonus,
          status: 'cleared',
          createdAt: now.toISOString(),
          unlocksAt: null,
        });
      }
    }
  }
}

function buildBootstrapPayload(db: DatabaseSchema, userId: string): BootstrapPayload {
  processMaturedPendingHolds(db);

  const currentUser =
    db.users.find((u) => u.id === userId) || db.users[0];

  const userCooldowns = db.shortlinkCooldowns[currentUser.id] || {};
  const userCompletedQuizzes = db.completedQuizzes[currentUser.id] || [];
  const userCompletedArticles = db.completedArticles[currentUser.id] || [];

  const sortedUsers = [...db.users].sort(
    (a, b) => b.lifetimeEarnedCoins - a.lifetimeEarnedCoins
  );

  const leaderboard = sortedUsers.slice(0, 10).map((u, idx) => {
    const refCount = db.referrals.filter(
      (r) => r.referrerId === u.id && r.activated
    ).length;
    return {
      rank: idx + 1,
      name: u.name,
      lifetimeEarnedCoins: u.lifetimeEarnedCoins,
      referralsCount: refCount,
      badge: idx === 0 ? 'Diamond Earner' : idx < 3 ? 'Elite Earner' : 'Verified Earner',
    };
  });

  const publicPayoutProofs = db.withdrawals.slice(0, 15);

  const payload: BootstrapPayload = {
    settings: db.settings,
    currentUser,
    allUsersCount: db.users.length,
    offerwalls: db.offerwalls,
    shortlinks: db.shortlinks,
    shortlinkCooldowns: userCooldowns,
    tasks: db.tasks,
    userTaskSubmissions: db.taskSubmissions.filter((s) => s.userId === currentUser.id),
    quizzes: db.quizzes,
    completedQuizIds: userCompletedQuizzes,
    articles: db.articles,
    completedArticleIds: userCompletedArticles,
    ledger: db.ledger.filter((l) => l.userId === currentUser.id),
    withdrawals: db.withdrawals.filter((w) => w.userId === currentUser.id),
    publicPayoutProofs,
    referrals: db.referrals.filter((r) => r.referrerId === currentUser.id),
    leaderboard,
    adPlacements: db.adPlacements,
  };

  if (currentUser.role === 'admin') {
    payload.adminData = {
      users: db.users,
      allSubmissions: db.taskSubmissions,
      allWithdrawals: db.withdrawals,
      promoCodes: db.promoCodes,
      postbackLogs: db.postbackLogs,
    };
  }

  return payload;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Enable CORS so when Frontend is hosted on GitHub Pages (yourdomain.com), API calls work seamlessly
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-user-id');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Helper to resolve current user ID from header or query
  const getRequestUserId = (req: Request): string => {
    return (
      (req.headers['x-user-id'] as string) ||
      (req.query.userId as string) ||
      'usr_earner_1'
    );
  };

  // 1. Bootstrap endpoint (Serves from 95% Smart RAM Cache)
  app.get('/api/bootstrap', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    res.json(buildBootstrapPayload(db, userId));
  });

  // 2. Auth: Register / Login / Demo Account Switcher
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const db = getDb();
    const { name, email, referralCodeInput } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const existing = db.users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );
    if (existing) {
      return res.json(buildBootstrapPayload(db, existing.id));
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      `103.21.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`;

    const cleanRef = referralCodeInput ? String(referralCodeInput).trim().toUpperCase() : null;
    const referrer = cleanRef
      ? db.users.find((u) => u.referralCode.toUpperCase() === cleanRef)
      : null;

    const newUserId = `usr_${Date.now()}`;
    const myRefCode = `LOOT${String(name)
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 5)}${Math.floor(10 + Math.random() * 89)}`;

    const welcomeCoins = referrer ? db.settings.referralWelcomeBonusCoins : 100;

    const newUser: UserProfile = {
      id: newUserId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role: 'earner',
      referralCode: myRefCode,
      referredBy: referrer ? referrer.referralCode : null,
      referralActivated: false,
      availableCoins: welcomeCoins,
      pendingCoins: 0,
      lifetimeEarnedCoins: welcomeCoins,
      totalWithdrawnInr: 0,
      completedFirstPayout: false,
      offerwallsCompleted: 0,
      shortlinksCompleted: 0,
      tasksCompleted: 0,
      streakDays: 0,
      lastCheckInDate: null,
      lastSpinDate: null,
      claimedMilestones: [],
      ipAddress: clientIp,
      deviceFingerprint: `fp_web_${Math.random().toString(36).slice(2, 8)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    db.ledger.unshift({
      id: `ldg_welcome_${Date.now()}`,
      userId: newUser.id,
      userName: newUser.name,
      sourceType: 'referral_bonus',
      title: referrer
        ? `Welcome Joining Bonus (Referred by ${referrer.name})`
        : 'Lootify Starter Welcome Bonus',
      amountCoins: welcomeCoins,
      status: 'cleared',
      createdAt: new Date().toISOString(),
      unlocksAt: null,
    });

    if (referrer) {
      const sameIpFlag = referrer.ipAddress === clientIp;
      db.referrals.unshift({
        id: `ref_${Date.now()}`,
        referrerId: referrer.id,
        inviteeId: newUser.id,
        inviteeName: newUser.name,
        inviteeEmail: newUser.email,
        activated: false,
        flatBonusCoins: 0,
        totalCommissionEarnedCoins: 0,
        sameIpFlag,
        createdAt: new Date().toISOString(),
      });
    }

    saveDb();
    res.json(buildBootstrapPayload(db, newUser.id));
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const db = getDb();
    const cleanEmail = String(req.body.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required to sign in.' });
    }
    const foundUser = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!foundUser) {
      return res.status(404).json({
        error: 'No account found with this email. Please Create an Account first.',
      });
    }
    if (foundUser.status === 'banned') {
      return res.status(403).json({
        error: 'This account has been suspended by Admin.',
      });
    }
    res.json(buildBootstrapPayload(db, foundUser.id));
  });

  app.post('/api/auth/google', (req: Request, res: Response) => {
    const db = getDb();
    let cleanEmail = String(req.body.email || '').trim().toLowerCase();
    let cleanName = String(req.body.name || '').trim();
    if (req.body.credential) {
      try {
        const parts = String(req.body.credential).split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
          );
          cleanEmail = String(decoded.email || cleanEmail).toLowerCase();
          cleanName = String(decoded.name || decoded.given_name || cleanName);
        }
      } catch {
        // ignore
      }
    }
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Valid Google email is required.' });
    }
    const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.status === 'banned') {
        return res.status(403).json({ error: 'This account has been suspended by Admin.' });
      }
      return res.json(buildBootstrapPayload(db, existing.id));
    }

    const displayName = cleanName || cleanEmail.split('@')[0];
    const newUserId = `usr_g_${Date.now()}`;
    const myRefCode = `LOOT-${displayName
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 5)}${Math.floor(10 + Math.random() * 89)}`;
    const welcomeCoins = db.settings.referralWelcomeBonusCoins;

    const newUser: UserProfile = {
      id: newUserId,
      name: displayName,
      email: cleanEmail,
      role: 'earner',
      referralCode: myRefCode,
      referredBy: req.body.referralCodeInput || null,
      referralActivated: false,
      availableCoins: welcomeCoins,
      pendingCoins: 0,
      lifetimeEarnedCoins: welcomeCoins,
      totalWithdrawnInr: 0,
      completedFirstPayout: false,
      offerwallsCompleted: 0,
      shortlinksCompleted: 0,
      tasksCompleted: 0,
      streakDays: 0,
      lastCheckInDate: null,
      lastSpinDate: null,
      claimedMilestones: [],
      ipAddress: '103.21.140.12',
      deviceFingerprint: 'fp_google_oauth',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    db.ledger.unshift({
      id: `ldg_gwelcome_${Date.now()}`,
      userId: newUserId,
      userName: newUser.name,
      sourceType: 'referral_welcome',
      title: `Google Sign-In Welcome Bonus (+${welcomeCoins} Coins)`,
      amountCoins: welcomeCoins,
      status: 'cleared',
      createdAt: new Date().toISOString(),
      unlocksAt: null,
    });
    saveDb();
    res.json(buildBootstrapPayload(db, newUserId));
  });

  // 3. Real S2S Offerwall Postback Webhook Endpoints (Notik.me & Lootably)
  // Example URL: /api/postback/notik?user_id=usr_earner_1&amount=850&txn_id=NTK123&status=1
  app.all('/api/postback/:provider', (req: Request, res: Response) => {
    const db = getDb();
    const providerParam = String(req.params.provider || 'notik').toLowerCase();
    const q = { ...req.query, ...req.body };

    const userId = String(q.user_id || q.uid || q.subid || 'usr_earner_1');
    const amountCoins = Number(q.amount || q.coins || q.currency || 500);
    const externalTxId = String(q.txn_id || q.tx_id || `TX_${Date.now()}`);
    const status = String(q.status || '1'); // '1' = credit, '2' = chargeback reversal

    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      db.postbackLogs.unshift({
        id: `pbl_${Date.now()}`,
        provider: providerParam,
        userId,
        externalTxId,
        coins: amountCoins,
        type: status === '2' ? 'chargeback' : 'credit',
        status: 'rejected',
        reason: 'User ID not found',
        createdAt: new Date().toISOString(),
      });
      saveDb();
      return res.status(404).send('USER_NOT_FOUND');
    }

    if (status === '2') {
      // Offerwall Chargeback Reversal! Deduct from Pending Coins first, then Available Coins
      const deductFromPending = Math.min(user.pendingCoins, amountCoins);
      const remainingDeduction = amountCoins - deductFromPending;
      user.pendingCoins -= deductFromPending;
      user.availableCoins = Math.max(0, user.availableCoins - remainingDeduction);

      db.ledger.unshift({
        id: `ldg_cb_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        sourceType: 'chargeback_reversal',
        title: `${providerParam.toUpperCase()} Chargeback Reversal (Tx: ${externalTxId})`,
        amountCoins: -amountCoins,
        status: 'reversed_chargeback',
        createdAt: new Date().toISOString(),
        unlocksAt: null,
        externalTxId,
      });

      db.postbackLogs.unshift({
        id: `pbl_${Date.now()}`,
        provider: providerParam.toUpperCase(),
        userId: user.id,
        externalTxId,
        coins: amountCoins,
        type: 'chargeback',
        status: 'accepted',
        reason: `Chargeback deducted from ${user.name}'s pending escrow balance`,
        createdAt: new Date().toISOString(),
      });

      saveDb();
      return res.status(200).send('OK_CHARGEBACK_PROCESSED');
    }

    // Standard Offerwall Credit -> Goes into 3-to-5-Day Pending Balance Hold
    user.offerwallsCompleted += 1;
    creditUserEarnings(
      db,
      user,
      amountCoins,
      'offerwall',
      `${providerParam.toUpperCase()} Offerwall Completion (${externalTxId})`,
      db.settings.pendingHoldDays,
      externalTxId
    );

    db.postbackLogs.unshift({
      id: `pbl_${Date.now()}`,
      provider: providerParam.toUpperCase(),
      userId: user.id,
      externalTxId,
      coins: amountCoins,
      type: 'credit',
      status: 'accepted',
      reason: `Credited to ${db.settings.pendingHoldDays}-day pending hold (+ Referrer commission)`,
      createdAt: new Date().toISOString(),
    });

    saveDb();
    return res.status(200).send('OK');
  });

  // 4. Shortlink Anti-Bypass Session Start & Claim (24h Cooldown + Captcha)
  app.post('/api/shortlinks/start', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { shortlinkId } = req.body;
    const link = db.shortlinks.find((s) => s.id === shortlinkId);
    if (!link) return res.status(404).json({ error: 'Shortlink not found' });

    const userCooldowns = db.shortlinkCooldowns[userId] || {};
    if (userCooldowns[shortlinkId] && new Date(userCooldowns[shortlinkId]).getTime() > Date.now()) {
      return res.status(400).json({ error: 'This shortlink is still on 24-hour cooldown.' });
    }

    const token = `slt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.shortlinkActiveTokens[token] = {
      shortlinkId,
      startedAtMs: Date.now(),
    };
    saveDb();
    res.json({ token, minResolveSeconds: link.minResolveSeconds });
  });

  app.post('/api/shortlinks/claim', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { token } = req.body;
    const session = db.shortlinkActiveTokens[token];
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired shortlink verification token.' });
    }

    const link = db.shortlinks.find((s) => s.id === session.shortlinkId);
    const user = db.users.find((u) => u.id === userId);
    if (!link || !user) {
      return res.status(404).json({ error: 'Shortlink or user not found.' });
    }

    const elapsedSec = (Date.now() - session.startedAtMs) / 1000;
    if (elapsedSec < link.minResolveSeconds - 1) {
      return res.status(400).json({
        error: `Anti-Bypass Guard: Completed too fast (${elapsedSec.toFixed(
          1
        )}s). Minimum ${link.minResolveSeconds}s required.`,
      });
    }

    delete db.shortlinkActiveTokens[token];

    if (!db.shortlinkCooldowns[userId]) db.shortlinkCooldowns[userId] = {};
    db.shortlinkCooldowns[userId][link.id] = new Date(
      Date.now() + link.cooldownHours * 3600000
    ).toISOString();

    user.shortlinksCompleted += 1;
    creditUserEarnings(
      db,
      user,
      link.rewardCoins,
      'shortlink',
      `${link.provider} — ${link.title}`,
      0 // Shortlinks credit directly to Available Balance after Captcha + Timer
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // 5. Submit Custom Manual Task Proof
  app.post('/api/tasks/submit-proof', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { taskId, proofText } = req.body;
    const task = db.tasks.find((t) => t.id === taskId);
    const user = db.users.find((u) => u.id === userId);
    if (!task || !user) return res.status(404).json({ error: 'Task not found' });
    if (!proofText || String(proofText).trim().length < 2) {
      return res.status(400).json({ error: 'Please provide valid proof details.' });
    }

    const alreadySubmitted = db.taskSubmissions.find(
      (s) => s.taskId === taskId && s.userId === userId && s.status !== 'rejected'
    );
    if (alreadySubmitted) {
      return res.status(400).json({ error: 'You have already submitted proof for this task.' });
    }

    db.taskSubmissions.unshift({
      id: `sub_${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      userId: user.id,
      userName: user.name,
      proofText: String(proofText).trim(),
      rewardCoins: task.rewardCoins,
      holdDays: task.holdDays,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // 6. Complete Quiz & Paid Article
  app.post('/api/quizzes/complete', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { quizId, score, total } = req.body;
    const quiz = db.quizzes.find((q) => q.id === quizId);
    const user = db.users.find((u) => u.id === userId);
    if (!quiz || !user) return res.status(404).json({ error: 'Quiz not found' });

    if (!db.completedQuizzes[userId]) db.completedQuizzes[userId] = [];
    if (db.completedQuizzes[userId].includes(quizId)) {
      return res.status(400).json({ error: 'You already completed this quiz.' });
    }

    db.completedQuizzes[userId].push(quizId);
    user.tasksCompleted += 1;

    creditUserEarnings(
      db,
      user,
      quiz.rewardCoins,
      'quiz',
      `Quiz Completed: ${quiz.title} (${score}/${total})`,
      0
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  app.post('/api/articles/complete', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { articleId } = req.body;
    const article = db.articles.find((a) => a.id === articleId);
    const user = db.users.find((u) => u.id === userId);
    if (!article || !user) return res.status(404).json({ error: 'Article not found' });

    if (!db.completedArticles[userId]) db.completedArticles[userId] = [];
    if (db.completedArticles[userId].includes(articleId)) {
      return res.status(400).json({ error: 'You already claimed this article reward.' });
    }

    db.completedArticles[userId].push(articleId);
    user.tasksCompleted += 1;

    creditUserEarnings(
      db,
      user,
      article.rewardCoins,
      'article',
      `Article Read: ${article.title}`,
      0
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // 7. Daily Streak Check-In, Spin Wheel & Promo Code (Lifafa)
  app.post('/api/rewards/daily-checkin', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayStr = new Date().toISOString().slice(0, 10);
    if (user.lastCheckInDate?.slice(0, 10) === todayStr) {
      return res.status(400).json({ error: 'You have already claimed today’s streak bonus!' });
    }

    const nextDayIndex = user.streakDays % 7;
    const rewardCoins = db.settings.dailyStreakRewards[nextDayIndex] || 50;
    user.streakDays += 1;
    user.lastCheckInDate = new Date().toISOString();

    creditUserEarnings(
      db,
      user,
      rewardCoins,
      'daily_streak',
      `Day ${user.streakDays} Check-In Streak Bonus`,
      0
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  app.post('/api/rewards/spin-wheel', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayStr = new Date().toISOString().slice(0, 10);
    if (user.lastSpinDate?.slice(0, 10) === todayStr) {
      return res.status(400).json({ error: 'Daily Spin already used today! Come back tomorrow.' });
    }

    const slices = db.settings.spinWheelSlices;
    const sliceIndex = Math.floor(Math.random() * slices.length);
    const wonCoins = slices[sliceIndex];
    user.lastSpinDate = new Date().toISOString();

    creditUserEarnings(
      db,
      user,
      wonCoins,
      'spin_wheel',
      `Fortune Spin Wheel Jackpot (+${wonCoins} Coins)`,
      0
    );

    saveDb();
    res.json({
      wonCoins,
      sliceIndex,
      bootstrap: buildBootstrapPayload(db, userId),
    });
  });

  app.post('/api/rewards/claim-promo', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { code } = req.body;
    const user = db.users.find((u) => u.id === userId);
    if (!user || !code) return res.status(400).json({ error: 'Enter a valid Promo Code.' });

    const cleanCode = String(code).trim().toUpperCase();
    const promo = db.promoCodes.find((p) => p.code.toUpperCase() === cleanCode && p.active);
    if (!promo) {
      return res.status(404).json({ error: 'Invalid or expired Lifafa / Promo Code.' });
    }
    if (promo.claimedUserIds.includes(user.id)) {
      return res.status(400).json({ error: 'You have already claimed this Promo Code!' });
    }
    if (promo.claimedUserIds.length >= promo.maxClaims) {
      return res.status(400).json({ error: 'All claims for this Promo Code have been exhausted.' });
    }

    promo.claimedUserIds.push(user.id);
    creditUserEarnings(
      db,
      user,
      promo.rewardCoins,
      'promo_code',
      `Lifafa Promo Code Redeemed (${promo.code})`,
      0
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // 8. Refer & Earn Layer-3 Milestone Claim
  app.post('/api/referrals/claim-milestone', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { targetCount } = req.body;
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeRefsCount = db.referrals.filter(
      (r) => r.referrerId === user.id && r.activated && !r.sameIpFlag
    ).length;

    const milestoneRewards: Record<number, number> = {
      5: 1000, // ₹10
      25: 6000, // ₹60
      100: 30000, // ₹300
    };

    const rewardCoins = milestoneRewards[Number(targetCount)];
    if (!rewardCoins) return res.status(400).json({ error: 'Invalid milestone tier.' });
    if (user.claimedMilestones.includes(Number(targetCount))) {
      return res.status(400).json({ error: 'Milestone already claimed!' });
    }
    if (activeRefsCount < Number(targetCount)) {
      return res.status(400).json({
        error: `You have ${activeRefsCount}/${targetCount} active referrals. Invite more active friends!`,
      });
    }

    user.claimedMilestones.push(Number(targetCount));
    creditUserEarnings(
      db,
      user,
      rewardCoins,
      'referral_bonus',
      `Referral Milestone Unlocked (${targetCount} Active Referrals)`,
      0
    );

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // 9. Multi-Rail Withdrawal Request (Progressive Tiers: ₹10 Hook -> ₹50/₹100+)
  app.post('/api/wallet/withdraw', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is flagged or restricted from withdrawals.' });
    }

    const { amountInr, method, payoutDetails } = req.body;
    const requestedInr = Number(amountInr);
    const coinsRequired = requestedInr * db.settings.coinsPerInr;

    // Progressive Tier Validation
    if (requestedInr === db.settings.starterPayoutInr) {
      if (user.completedFirstPayout) {
        return res.status(400).json({
          error: `The ₹${db.settings.starterPayoutInr} Starter Tier is only for your 1st cashout! Your minimum tier is now ₹${db.settings.tier2PayoutInr}.`,
        });
      }
      const unlockedStarter =
        user.offerwallsCompleted >= 1 || user.shortlinksCompleted >= 3;
      if (!unlockedStarter) {
        return res.status(400).json({
          error: `To unlock the ₹${db.settings.starterPayoutInr} First Payout Hook, complete at least 1 Offerwall or 3 Shortlinks first.`,
        });
      }
    } else if (requestedInr < db.settings.tier2PayoutInr) {
      return res.status(400).json({
        error: `Minimum withdrawal amount for this tier is ₹${db.settings.tier2PayoutInr}.`,
      });
    }

    if (user.availableCoins < coinsRequired) {
      return res.status(400).json({
        error: `Insufficient Available Coins. You need ${coinsRequired.toLocaleString()} Coins (Pending Hold coins unlock after ${db.settings.pendingHoldDays} days).`,
      });
    }

    user.availableCoins -= coinsRequired;
    if (requestedInr === db.settings.starterPayoutInr) {
      user.completedFirstPayout = true;
    }

    const tierLabel =
      requestedInr === db.settings.starterPayoutInr
        ? `₹${requestedInr} Starter Trust Payout`
        : `₹${requestedInr} Verified Tier Payout`;

    db.withdrawals.unshift({
      id: `wd_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      method,
      tierLabel,
      coinsDeducted: coinsRequired,
      amountInr: requestedInr,
      payoutDetails: payoutDetails || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // ============================================================================
  // GOD-MODE ADMIN PANEL ENDPOINTS
  // ============================================================================

  // Admin: Update Global Economy, Theme & Rules
  app.post('/api/admin/settings', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    db.settings = { ...db.settings, ...req.body };
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: Add / Update Shortlink
  app.post('/api/admin/shortlinks', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const item: ShortlinkItem = req.body;
    const idx = db.shortlinks.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      db.shortlinks[idx] = item;
    } else {
      db.shortlinks.unshift({
        ...item,
        id: `sl_${Date.now()}`,
      });
    }
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  app.delete('/api/admin/shortlinks/:id', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    db.shortlinks = db.shortlinks.filter((s) => s.id !== req.params.id);
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: Add / Update Custom Task
  app.post('/api/admin/tasks', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const item: CustomTaskItem = req.body;
    const idx = db.tasks.findIndex((t) => t.id === item.id);
    if (idx >= 0) {
      db.tasks[idx] = item;
    } else {
      db.tasks.unshift({
        ...item,
        id: `tsk_${Date.now()}`,
      });
    }
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  app.delete('/api/admin/tasks/:id', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    db.tasks = db.tasks.filter((t) => t.id !== req.params.id);
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: Review Task Submission (Approve / Reject)
  app.post('/api/admin/task-submissions/:id/review', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const { decision } = req.body; // 'approved' | 'rejected'
    const sub = db.taskSubmissions.find((s) => s.id === req.params.id);
    if (!sub || sub.status !== 'pending') {
      return res.status(404).json({ error: 'Submission not found or already processed' });
    }

    sub.status = decision;
    if (decision === 'approved') {
      const targetUser = db.users.find((u) => u.id === sub.userId);
      if (targetUser) {
        targetUser.tasksCompleted += 1;
        creditUserEarnings(
          db,
          targetUser,
          sub.rewardCoins,
          'manual_task',
          `Task Approved: ${sub.taskTitle}`,
          sub.holdDays
        );
      }
    }
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: Update Offerwalls
  app.post('/api/admin/offerwalls', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const item: OfferwallPartner = req.body;
    const idx = db.offerwalls.findIndex((o) => o.id === item.id);
    if (idx >= 0) {
      db.offerwalls[idx] = item;
    } else {
      db.offerwalls.push({ ...item, id: `ow_${Date.now()}` });
    }
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: Update Ad Placements (Monetag / Adsterra)
  app.post('/api/admin/ads', (req: Request, res: Response) => {
    const db = getDb();
    const userId = getRequestUserId(req);
    const item: AdPlacementItem = req.body;
    const idx = db.adPlacements.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      db.adPlacements[idx] = item;
    }
    saveDb();
    res.json(buildBootstrapPayload(db, userId));
  });

  // Admin: User Actions (Add/Deduct Coins, Fast-Forward Pending Hold, Ban/Unban)
  app.post('/api/admin/users/:id/action', (req: Request, res: Response) => {
    const db = getDb();
    const adminUserId = getRequestUserId(req);
    const targetUser = db.users.find((u) => u.id === req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const { actionType, amountCoins } = req.body;
    if (actionType === 'add_coins') {
      const amt = Number(amountCoins) || 0;
      targetUser.availableCoins += amt;
      targetUser.lifetimeEarnedCoins += amt;
      db.ledger.unshift({
        id: `ldg_adm_${Date.now()}`,
        userId: targetUser.id,
        userName: targetUser.name,
        sourceType: 'admin_adjustment',
        title: `Admin Bonus Credit (+${amt} Coins)`,
        amountCoins: amt,
        status: 'cleared',
        createdAt: new Date().toISOString(),
        unlocksAt: null,
      });
    } else if (actionType === 'deduct_coins') {
      const amt = Number(amountCoins) || 0;
      targetUser.availableCoins = Math.max(0, targetUser.availableCoins - amt);
      db.ledger.unshift({
        id: `ldg_adm_${Date.now()}`,
        userId: targetUser.id,
        userName: targetUser.name,
        sourceType: 'admin_adjustment',
        title: `Admin Balance Deduction (-${amt} Coins)`,
        amountCoins: -amt,
        status: 'cleared',
        createdAt: new Date().toISOString(),
        unlocksAt: null,
      });
    } else if (actionType === 'release_pending') {
      // Immediately mature all pending_hold entries for this user
      const releasedAmount = targetUser.pendingCoins;
      targetUser.availableCoins += releasedAmount;
      targetUser.pendingCoins = 0;
      for (const entry of db.ledger) {
        if (entry.userId === targetUser.id && entry.status === 'pending_hold') {
          entry.status = 'cleared';
          entry.unlocksAt = null;
        }
      }
    } else if (actionType === 'toggle_ban') {
      targetUser.status = targetUser.status === 'banned' ? 'active' : 'banned';
    }

    saveDb();
    res.json(buildBootstrapPayload(db, adminUserId));
  });

  // Admin: Process Withdrawal Request (Approve with UTR/Voucher or Reject with Auto-Refund)
  app.post('/api/admin/withdrawals/:id/process', (req: Request, res: Response) => {
    const db = getDb();
    const adminUserId = getRequestUserId(req);
    const wd = db.withdrawals.find((w) => w.id === req.params.id);
    if (!wd || wd.status !== 'pending') {
      return res.status(404).json({ error: 'Withdrawal request not found or already processed' });
    }

    const { status, utrOrVoucher, adminNote } = req.body; // 'approved' | 'rejected'
    wd.status = status;
    wd.utrOrVoucher = utrOrVoucher || (status === 'approved' ? `UTR${Date.now()}` : '');
    wd.adminNote = adminNote || '';
    wd.processedAt = new Date().toISOString();

    const targetUser = db.users.find((u) => u.id === wd.userId);
    if (targetUser) {
      if (status === 'approved') {
        targetUser.totalWithdrawnInr += wd.amountInr;
      } else if (status === 'rejected') {
        // Auto-refund coins back to user's available wallet
        targetUser.availableCoins += wd.coinsDeducted;
        db.ledger.unshift({
          id: `ldg_ref_wd_${Date.now()}`,
          userId: targetUser.id,
          userName: targetUser.name,
          sourceType: 'admin_adjustment',
          title: `Refund for Rejected Withdrawal (${wd.tierLabel})`,
          amountCoins: wd.coinsDeducted,
          status: 'cleared',
          createdAt: new Date().toISOString(),
          unlocksAt: null,
        });
      }
    }

    saveDb();
    res.json(buildBootstrapPayload(db, adminUserId));
  });

  // Admin: Create / Delete Promo Code (Lifafa)
  app.post('/api/admin/promos', (req: Request, res: Response) => {
    const db = getDb();
    const adminUserId = getRequestUserId(req);
    const { code, rewardCoins, maxClaims } = req.body;
    db.promoCodes.unshift({
      id: `prm_${Date.now()}`,
      code: String(code).trim().toUpperCase(),
      rewardCoins: Number(rewardCoins) || 100,
      maxClaims: Number(maxClaims) || 50,
      claimedUserIds: [],
      active: true,
      createdAt: new Date().toISOString(),
    });
    saveDb();
    res.json(buildBootstrapPayload(db, adminUserId));
  });

  app.delete('/api/admin/promos/:id', (req: Request, res: Response) => {
    const db = getDb();
    const adminUserId = getRequestUserId(req);
    db.promoCodes = db.promoCodes.filter((p) => p.id !== req.params.id);
    saveDb();
    res.json(buildBootstrapPayload(db, adminUserId));
  });

  // Admin: 1-Click Database Backup & Restore
  app.get('/api/admin/backup', (_req: Request, res: Response) => {
    const db = getDb();
    res.setHeader('Content-Disposition', 'attachment; filename="lootify_backup.json"');
    res.json(db);
  });

  app.post('/api/admin/restore', (req: Request, res: Response) => {
    const adminUserId = getRequestUserId(req);
    if (req.body && req.body.settings && Array.isArray(req.body.users)) {
      memoryDb = req.body as DatabaseSchema;
      saveDb();
      return res.json(buildBootstrapPayload(memoryDb, adminUserId));
    }
    return res.status(400).json({ error: 'Invalid backup JSON payload' });
  });

  // Mount Vite middleware in development or static dist in production
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
    console.log(`Lootify Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
