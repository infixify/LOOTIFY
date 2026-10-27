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
} from '../types.ts';

interface ClientDbSchema {
  settings: SystemSettings;
  users: UserProfile[];
  offerwalls: OfferwallPartner[];
  shortlinks: ShortlinkItem[];
  shortlinkCooldowns: Record<string, Record<string, string>>;
  shortlinkActiveTokens: Record<string, { shortlinkId: string; startedAtMs: number }>;
  tasks: CustomTaskItem[];
  taskSubmissions: TaskSubmission[];
  quizzes: QuizItem[];
  completedQuizzes: Record<string, string[]>;
  articles: PaidArticleItem[];
  completedArticles: Record<string, string[]>;
  ledger: LedgerEntry[];
  withdrawals: WithdrawalRequest[];
  referrals: ReferralRecord[];
  promoCodes: PromoCodeItem[];
  adPlacements: AdPlacementItem[];
  postbackLogs: PostbackLogItem[];
}

const STORAGE_KEY = 'lootify_real_db_v2';

const GUEST_USER_PROFILE: UserProfile = {
  id: 'guest',
  name: 'Guest Visitor',
  email: '',
  role: 'earner',
  referralCode: 'LOOTADMIN',
  referredBy: null,
  referralActivated: false,
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
  ipAddress: '0.0.0.0',
  deviceFingerprint: 'fp_guest',
  status: 'active',
  createdAt: new Date().toISOString(),
};

function createInitialClientDb(): ClientDbSchema {
  const nowIso = new Date().toISOString();

  return {
    settings: {
      siteName: 'Lootify',
      customDomain: 'lootify.eternant.c0m.to',
      apiSubdomain: 'lootify-api.sarthaksinghyadav1.workers.dev',
      defaultTheme: 'dark',
      coinsPerInr: 100,
      pendingHoldDays: 3,
      starterPayoutInr: 10,
      tier2PayoutInr: 50,
      tier3PayoutInr: 100,
      tier4PayoutInr: 500,
      referralFlatBonusCoins: 500,
      referralWelcomeBonusCoins: 200,
      referralCommissionPercent: 10,
      dailyStreakRewards: [25, 40, 60, 85, 110, 150, 250],
      spinWheelSlices: [15, 30, 50, 75, 100, 150, 250, 500],
      announcementText:
        'Welcome to Lootify.in! Complete any 1 Offerwall or 3 Shortlinks to unlock your instant ₹10 Starter UPI Withdrawal.',
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
        id: 'usr_admin_1',
        name: 'Sarthak (Founder & Admin)',
        email: 'sarthaksinghyadav1@gmail.com',
        role: 'admin',
        referralCode: 'LOOTADMIN',
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
        ipAddress: '0.0.0.0',
        deviceFingerprint: 'fp_admin_master_01',
        status: 'active',
        createdAt: nowIso,
      },
    ],
    offerwalls: [
      {
        id: 'ow_notik',
        name: 'Notik.me Offerwall',
        providerKey: 'notik',
        badgeText: 'Top Indian Payouts · Subdomain Friendly',
        description:
          'Complete trending Indian web & brand offers, surveys, and quick registrations. Automatically tracks via S2S Postback.',
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
          'Complete daily market surveys, web milestones, and one-click trial signups with fast S2S postback crediting.',
        iframeUrl: 'https://wall.lootably.com/?placementID=YOUR_LOOTABLY_ID&sid={USER_ID}',
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
          'Engage with sponsored web landing pages and micro-actions optimized for desktop and mobile browsers.',
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
        rewardCoins: 80,
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
        rewardCoins: 100,
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
        rewardCoins: 70,
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
        rewardCoins: 90,
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
              'To protect against ad-network chargebacks & fake offer reversals',
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
          'When you complete an offer or survey on Notik.me or Lootably, the advertiser sends an encrypted Server-to-Server (S2S) postback to Lootify. To keep payout rates high and prevent bot abuse, high-value offerwall credits enter a 3-day Pending Clearance Queue before unlocking for instant UPI, Bank, Gift Card, or USDT cashout.',
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
          'With Lootify’s 3-Layer Refer & Earn engine, you earn a flat 500 Coins (₹5) activation bonus as soon as your invited friend completes their first Offerwall or 3 Shortlinks, plus a 10% lifetime passive commission on every single coin they earn forever.',
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
        createdAt: nowIso,
      },
      {
        id: 'prm_2',
        code: 'LAUNCH250',
        rewardCoins: 250,
        maxClaims: 100,
        claimedUserIds: [],
        active: true,
        createdAt: nowIso,
      },
    ],
    adPlacements: [
      {
        id: 'ad_1',
        slotKey: 'header_banner',
        network: 'Monetag',
        title: 'Top Leaderboard 728x90 / Responsive Website Banner',
        scriptOrHtml: '<!-- Monetag Vignette / Banner Zone #88412 -->',
        enabled: true,
      },
      {
        id: 'ad_2',
        slotKey: 'sidebar_box',
        network: 'Adsterra',
        title: 'Website 300x250 High-CPM Native Box',
        scriptOrHtml: '<!-- Adsterra Native Banner Script Zone #33109 -->',
        enabled: true,
      },
    ],
    postbackLogs: [],
  };
}

function loadClientDb(): ClientDbSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ClientDbSchema;
  } catch {
    // ignore
  }
  const initial = createInitialClientDb();
  saveClientDb(initial);
  return initial;
}

function saveClientDb(db: ClientDbSchema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

export function syncExternalUserToClientDb(rawUser: any): BootstrapPayload {
  const db = loadClientDb();
  if (!rawUser || !rawUser.email) {
    return getClientBootstrap('');
  }
  const cleanEmail = String(rawUser.email).trim().toLowerCase();
  const userId = String(rawUser.id || `usr_${Date.now()}`);
  let existing = db.users.find(
    (u) => u.id === userId || u.email.toLowerCase() === cleanEmail
  );

  const mapped: UserProfile = {
    id: existing?.id || userId,
    name: String(rawUser.name || existing?.name || cleanEmail.split('@')[0]),
    email: cleanEmail,
    role:
      rawUser.role === 'admin' ||
      cleanEmail === 'sarthaksinghyadav1@gmail.com' ||
      cleanEmail === 'admin@lootify.in'
        ? 'admin'
        : 'earner',
    referralCode: String(
      rawUser.referralCode || rawUser.referral_code || existing?.referralCode || 'LOOTUSER'
    ),
    referredBy: rawUser.referredBy ?? rawUser.referred_by ?? existing?.referredBy ?? null,
    referralActivated: Boolean(
      rawUser.referralActivated ?? rawUser.referral_activated ?? existing?.referralActivated
    ),
    availableCoins: Number(
      rawUser.availableCoins ?? rawUser.available_coins ?? existing?.availableCoins ?? 0
    ),
    pendingCoins: Number(
      rawUser.pendingCoins ?? rawUser.pending_coins ?? existing?.pendingCoins ?? 0
    ),
    lifetimeEarnedCoins: Number(
      rawUser.lifetimeEarnedCoins ??
        rawUser.lifetime_earned_coins ??
        existing?.lifetimeEarnedCoins ??
        0
    ),
    totalWithdrawnInr: Number(
      rawUser.totalWithdrawnInr ?? rawUser.total_withdrawn_inr ?? existing?.totalWithdrawnInr ?? 0
    ),
    completedFirstPayout: Boolean(
      rawUser.completedFirstPayout ??
        rawUser.completed_first_payout ??
        existing?.completedFirstPayout
    ),
    offerwallsCompleted: Number(
      rawUser.offerwallsCompleted ??
        rawUser.offerwalls_completed ??
        existing?.offerwallsCompleted ??
        0
    ),
    shortlinksCompleted: Number(
      rawUser.shortlinksCompleted ??
        rawUser.shortlinks_completed ??
        existing?.shortlinksCompleted ??
        0
    ),
    tasksCompleted: Number(
      rawUser.tasksCompleted ?? rawUser.tasks_completed ?? existing?.tasksCompleted ?? 0
    ),
    streakDays: Number(rawUser.streakDays ?? rawUser.streak_days ?? existing?.streakDays ?? 0),
    lastCheckInDate:
      rawUser.lastCheckInDate ?? rawUser.last_checkin_date ?? existing?.lastCheckInDate ?? null,
    lastSpinDate:
      rawUser.lastSpinDate ?? rawUser.last_spin_date ?? existing?.lastSpinDate ?? null,
    claimedMilestones: existing?.claimedMilestones || [],
    ipAddress: String(rawUser.ipAddress || rawUser.ip_address || existing?.ipAddress || '0.0.0.0'),
    deviceFingerprint: String(
      rawUser.deviceFingerprint ||
        rawUser.device_fingerprint ||
        existing?.deviceFingerprint ||
        'fp_web'
    ),
    status: (rawUser.status as any) || existing?.status || 'active',
    createdAt: String(
      rawUser.createdAt || rawUser.created_at || existing?.createdAt || new Date().toISOString()
    ),
  };

  if (existing) {
    Object.assign(existing, mapped);
  } else {
    db.users.push(mapped);
  }

  // Ensure welcome ledger entry exists if newly created with welcome coins
  const hasLedger = db.ledger.some((l) => l.userId === mapped.id);
  if (!hasLedger && mapped.availableCoins > 0) {
    db.ledger.unshift({
      id: `ldg_welcome_${Date.now()}`,
      userId: mapped.id,
      userName: mapped.name,
      sourceType: 'referral_welcome',
      title: `Welcome Bonus (+${mapped.availableCoins} Coins)`,
      amountCoins: mapped.availableCoins,
      status: 'cleared',
      createdAt: new Date().toISOString(),
      unlocksAt: null,
    });
  }

  saveClientDb(db);
  return getClientBootstrap(mapped.id);
}

function creditClientEarnings(
  db: ClientDbSchema,
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
}

export function getClientBootstrap(userId: string): BootstrapPayload {
  const db = loadClientDb();
  const foundUser = userId ? db.users.find((u) => u.id === userId) : undefined;
  const currentUser: UserProfile = foundUser || GUEST_USER_PROFILE;

  const realEarners = db.users.filter(
    (u) => u.id !== 'guest' && (u.role === 'earner' || u.lifetimeEarnedCoins > 0)
  );
  const sortedUsers = [...realEarners].sort(
    (a, b) => b.lifetimeEarnedCoins - a.lifetimeEarnedCoins
  );

  const leaderboard = sortedUsers.slice(0, 10).map((u, idx) => ({
    rank: idx + 1,
    name: u.name,
    lifetimeEarnedCoins: u.lifetimeEarnedCoins,
    referralsCount: db.referrals.filter((r) => r.referrerId === u.id && r.activated).length,
    badge: idx === 0 ? 'Diamond Earner' : idx < 3 ? 'Elite Earner' : 'Verified Earner',
  }));

  return {
    settings: db.settings,
    currentUser,
    allUsersCount: db.users.length,
    offerwalls: db.offerwalls,
    shortlinks: db.shortlinks,
    shortlinkCooldowns: db.shortlinkCooldowns[currentUser.id] || {},
    tasks: db.tasks,
    userTaskSubmissions: db.taskSubmissions.filter((s) => s.userId === currentUser.id),
    quizzes: db.quizzes,
    completedQuizIds: db.completedQuizzes[currentUser.id] || [],
    articles: db.articles,
    completedArticleIds: db.completedArticles[currentUser.id] || [],
    ledger: db.ledger.filter((l) => l.userId === currentUser.id),
    withdrawals: db.withdrawals.filter((w) => w.userId === currentUser.id),
    publicPayoutProofs: db.withdrawals.slice(0, 15),
    referrals: db.referrals.filter((r) => r.referrerId === currentUser.id),
    leaderboard,
    adPlacements: db.adPlacements,
    adminData: {
      users: db.users,
      allSubmissions: db.taskSubmissions,
      allWithdrawals: db.withdrawals,
      promoCodes: db.promoCodes,
      postbackLogs: db.postbackLogs,
    },
  };
}

export function handleClientApiAction(
  method: 'POST' | 'DELETE',
  endpoint: string,
  userId: string,
  body: any = {}
): any {
  const db = loadClientDb();

  if (endpoint === '/api/auth/register') {
    const { name, email, referralCodeInput } = body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!name || !cleanEmail) {
      throw new Error('Full Name and Email are required.');
    }
    const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('This email is already registered. Please Sign In instead.');
    }
    const newUserId = `usr_${Date.now()}`;
    const myRefCode = `LOOT-${String(name)
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 5)}${Math.floor(10 + Math.random() * 89)}`;
    const welcomeCoins = db.settings.referralWelcomeBonusCoins;
    const newUser: UserProfile = {
      id: newUserId,
      name: String(name).trim(),
      email: cleanEmail,
      role:
        cleanEmail === 'sarthaksinghyadav1@gmail.com' || cleanEmail === 'admin@lootify.in'
          ? 'admin'
          : 'earner',
      referralCode: myRefCode,
      referredBy: referralCodeInput || null,
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
      ipAddress: '0.0.0.0',
      deviceFingerprint: 'fp_web_client',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    db.ledger.unshift({
      id: `ldg_welcome_${Date.now()}`,
      userId: newUserId,
      userName: newUser.name,
      sourceType: 'referral_welcome',
      title: `Welcome Signup Bonus (+${welcomeCoins} Coins)`,
      amountCoins: welcomeCoins,
      status: 'cleared',
      createdAt: new Date().toISOString(),
      unlocksAt: null,
    });
    saveClientDb(db);
    return getClientBootstrap(newUserId);
  }

  if (endpoint === '/api/auth/login') {
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const foundUser = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        (cleanEmail === 'admin@lootify.in' && u.role === 'admin')
    );
    if (!foundUser) {
      throw new Error('No account found with this email. Please Create an Account first.');
    }
    if (foundUser.status === 'banned') {
      throw new Error('This account has been suspended by Admin.');
    }
    return getClientBootstrap(foundUser.id);
  }

  if (endpoint === '/api/auth/google') {
    let cleanEmail = String(body.email || '').trim().toLowerCase();
    let cleanName = String(body.name || '').trim();
    if (body.credential) {
      try {
        const parts = String(body.credential).split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          cleanEmail = String(decoded.email || cleanEmail).toLowerCase();
          cleanName = String(decoded.name || decoded.given_name || cleanName);
        }
      } catch {
        // ignore
      }
    }
    if (!cleanEmail) {
      throw new Error('Valid Google account email is required.');
    }
    const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.status === 'banned') {
        throw new Error('This account has been suspended by Admin.');
      }
      return getClientBootstrap(existing.id);
    }
    const newUserId = `usr_g_${Date.now()}`;
    const displayName = cleanName || cleanEmail.split('@')[0];
    const myRefCode = `LOOT-${displayName
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 5)}${Math.floor(10 + Math.random() * 89)}`;
    const welcomeCoins = db.settings.referralWelcomeBonusCoins;
    const newUser: UserProfile = {
      id: newUserId,
      name: displayName,
      email: cleanEmail,
      role:
        cleanEmail === 'sarthaksinghyadav1@gmail.com' || cleanEmail === 'admin@lootify.in'
          ? 'admin'
          : 'earner',
      referralCode: myRefCode,
      referredBy: body.referralCodeInput || null,
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
      ipAddress: '0.0.0.0',
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
    saveClientDb(db);
    return getClientBootstrap(newUserId);
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user && !endpoint.startsWith('/api/admin/')) {
    throw new Error('Please Sign In or Create an Account first to earn coins.');
  }
  const activeUser = user || db.users[0];

  if (endpoint.startsWith('/api/postback/')) {
    const urlObj = new URL(endpoint, 'https://lootify.in');
    const provider = urlObj.pathname.split('/').pop() || 'notik';
    const amountCoins = Number(urlObj.searchParams.get('amount') || body.amount || 500);
    const status = String(urlObj.searchParams.get('status') || body.status || '1');
    const txId = String(urlObj.searchParams.get('txn_id') || `TX_${Date.now()}`);

    if (status === '2') {
      const deductFromPending = Math.min(activeUser.pendingCoins, amountCoins);
      activeUser.pendingCoins -= deductFromPending;
      db.ledger.unshift({
        id: `ldg_cb_${Date.now()}`,
        userId: activeUser.id,
        userName: activeUser.name,
        sourceType: 'chargeback_reversal',
        title: `${provider.toUpperCase()} Chargeback Reversal (${txId})`,
        amountCoins: -amountCoins,
        status: 'reversed_chargeback',
        createdAt: new Date().toISOString(),
        unlocksAt: null,
      });
    } else {
      activeUser.offerwallsCompleted += 1;
      creditClientEarnings(
        db,
        activeUser,
        amountCoins,
        'offerwall',
        `${provider.toUpperCase()} Offerwall Completion (${txId})`,
        db.settings.pendingHoldDays,
        txId
      );
    }
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/shortlinks/start') {
    const link = db.shortlinks.find((s) => s.id === body.shortlinkId);
    if (!link) throw new Error('Shortlink not found');
    const token = `slt_${Date.now()}`;
    db.shortlinkActiveTokens[token] = {
      shortlinkId: link.id,
      startedAtMs: Date.now(),
    };
    saveClientDb(db);
    return { token, minResolveSeconds: link.minResolveSeconds };
  }

  if (endpoint === '/api/shortlinks/claim') {
    const session = db.shortlinkActiveTokens[body.token];
    if (!session) throw new Error('Invalid shortlink session token');
    const link = db.shortlinks.find((s) => s.id === session.shortlinkId);
    if (!link) throw new Error('Shortlink not found');
    delete db.shortlinkActiveTokens[body.token];
    if (!db.shortlinkCooldowns[activeUser.id]) db.shortlinkCooldowns[activeUser.id] = {};
    db.shortlinkCooldowns[activeUser.id][link.id] = new Date(
      Date.now() + link.cooldownHours * 3600000
    ).toISOString();
    activeUser.shortlinksCompleted += 1;
    creditClientEarnings(
      db,
      activeUser,
      link.rewardCoins,
      'shortlink',
      `${link.provider} — ${link.title}`,
      0
    );
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/tasks/submit-proof') {
    const task = db.tasks.find((t) => t.id === body.taskId);
    if (!task) throw new Error('Task not found');
    db.taskSubmissions.unshift({
      id: `sub_${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      userId: activeUser.id,
      userName: activeUser.name,
      proofText: body.proofText,
      rewardCoins: task.rewardCoins,
      holdDays: task.holdDays,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/quizzes/complete') {
    const quiz = db.quizzes.find((q) => q.id === body.quizId);
    if (!quiz) throw new Error('Quiz not found');
    if (!db.completedQuizzes[activeUser.id]) db.completedQuizzes[activeUser.id] = [];
    db.completedQuizzes[activeUser.id].push(quiz.id);
    activeUser.tasksCompleted += 1;
    creditClientEarnings(
      db,
      activeUser,
      quiz.rewardCoins,
      'quiz',
      `Quiz Completed: ${quiz.title}`,
      0
    );
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/articles/complete') {
    const article = db.articles.find((a) => a.id === body.articleId);
    if (!article) throw new Error('Article not found');
    if (!db.completedArticles[activeUser.id]) db.completedArticles[activeUser.id] = [];
    db.completedArticles[activeUser.id].push(article.id);
    activeUser.tasksCompleted += 1;
    creditClientEarnings(
      db,
      activeUser,
      article.rewardCoins,
      'article',
      `Article Read: ${article.title}`,
      0
    );
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/rewards/daily-checkin') {
    const nextIdx = activeUser.streakDays % 7;
    const rewardCoins = db.settings.dailyStreakRewards[nextIdx] || 50;
    activeUser.streakDays += 1;
    activeUser.lastCheckInDate = new Date().toISOString();
    creditClientEarnings(
      db,
      activeUser,
      rewardCoins,
      'daily_streak',
      `Day ${activeUser.streakDays} Check-In Bonus`,
      0
    );
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/rewards/spin-wheel') {
    const slices = db.settings.spinWheelSlices;
    const sliceIndex = Math.floor(Math.random() * slices.length);
    const wonCoins = slices[sliceIndex];
    activeUser.lastSpinDate = new Date().toISOString();
    creditClientEarnings(
      db,
      activeUser,
      wonCoins,
      'spin_wheel',
      `Fortune Spin Wheel (+${wonCoins} Coins)`,
      0
    );
    saveClientDb(db);
    return { wonCoins, sliceIndex, bootstrap: getClientBootstrap(activeUser.id) };
  }

  if (endpoint === '/api/rewards/claim-promo') {
    const clean = String(body.code || '').trim().toUpperCase();
    const promo = db.promoCodes.find((p) => p.code.toUpperCase() === clean && p.active);
    if (!promo) throw new Error('Invalid or expired Promo Code.');
    if (promo.claimedUserIds.includes(activeUser.id)) throw new Error('Already claimed!');
    promo.claimedUserIds.push(activeUser.id);
    creditClientEarnings(
      db,
      activeUser,
      promo.rewardCoins,
      'promo_code',
      `Promo Code Redeemed (${promo.code})`,
      0
    );
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/wallet/withdraw') {
    const requestedInr = Number(body.amountInr);
    const coinsRequired = requestedInr * db.settings.coinsPerInr;
    if (activeUser.availableCoins < coinsRequired) {
      throw new Error(`Insufficient Available Coins. Need ${coinsRequired} Coins.`);
    }
    activeUser.availableCoins -= coinsRequired;
    if (requestedInr === db.settings.starterPayoutInr) {
      activeUser.completedFirstPayout = true;
    }
    db.withdrawals.unshift({
      id: `wd_${Date.now()}`,
      userId: activeUser.id,
      userName: activeUser.name,
      userEmail: activeUser.email,
      method: body.method,
      tierLabel: `₹${requestedInr} Payout`,
      coinsDeducted: coinsRequired,
      amountInr: requestedInr,
      payoutDetails: body.payoutDetails || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/admin/settings') {
    db.settings = { ...db.settings, ...body };
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/admin/shortlinks' && method === 'POST') {
    db.shortlinks.unshift({ ...body, id: `sl_${Date.now()}` });
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint.startsWith('/api/admin/shortlinks/') && method === 'DELETE') {
    const id = endpoint.split('/').pop();
    db.shortlinks = db.shortlinks.filter((s) => s.id !== id);
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/admin/tasks' && method === 'POST') {
    db.tasks.unshift({ ...body, id: `tsk_${Date.now()}` });
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint === '/api/admin/promos' && method === 'POST') {
    db.promoCodes.unshift({
      id: `prm_${Date.now()}`,
      code: String(body.code).toUpperCase(),
      rewardCoins: Number(body.rewardCoins) || 100,
      maxClaims: Number(body.maxClaims) || 50,
      claimedUserIds: [],
      active: true,
      createdAt: new Date().toISOString(),
    });
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint.startsWith('/api/admin/promos/') && method === 'DELETE') {
    const id = endpoint.split('/').pop();
    db.promoCodes = db.promoCodes.filter((p) => p.id !== id);
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint.includes('/api/admin/users/')) {
    const parts = endpoint.split('/');
    const targetId = parts[parts.length - 2];
    const targetUser = db.users.find((u) => u.id === targetId);
    if (targetUser) {
      if (body.actionType === 'release_pending') {
        targetUser.availableCoins += targetUser.pendingCoins;
        targetUser.pendingCoins = 0;
      } else if (body.actionType === 'add_coins') {
        targetUser.availableCoins += Number(body.amountCoins) || 100;
      } else if (body.actionType === 'toggle_ban') {
        targetUser.status = targetUser.status === 'banned' ? 'active' : 'banned';
      }
    }
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  if (endpoint.includes('/api/admin/withdrawals/')) {
    const parts = endpoint.split('/');
    const wdId = parts[parts.length - 2];
    const wd = db.withdrawals.find((w) => w.id === wdId);
    if (wd) {
      wd.status = body.status;
      wd.utrOrVoucher = body.utrOrVoucher || `UTR_${Date.now()}`;
    }
    saveClientDb(db);
    return getClientBootstrap(activeUser.id);
  }

  saveClientDb(db);
  return getClientBootstrap(activeUser.id);
}
