export type ThemeMode = 'dark' | 'light';

export type PageRoute =
  | 'home'
  | 'dashboard'
  | 'offerwalls'
  | 'shortlinks'
  | 'tasks'
  | 'referrals'
  | 'wallet'
  | 'leaderboard'
  | 'payout-proofs'
  | 'admin'
  | 'deploy-guide'
  | 'terms'
  | 'privacy'
  | 'contact';

export interface SystemSettings {
  siteName: string;
  customDomain: string;
  apiSubdomain: string;
  defaultTheme: ThemeMode;
  coinsPerInr: number; // e.g. 100 Coins = ₹1 INR
  pendingHoldDays: number; // e.g. 3 to 5 days hold
  starterPayoutInr: number; // e.g. ₹10 first withdrawal hook
  tier2PayoutInr: number; // e.g. ₹50 after first payout
  tier3PayoutInr: number; // e.g. ₹100
  tier4PayoutInr: number; // e.g. ₹500
  referralFlatBonusCoins: number; // e.g. 500 coins (₹5) when referral activates
  referralWelcomeBonusCoins: number; // e.g. 200 coins (₹2) for new invitee
  referralCommissionPercent: number; // e.g. 10% lifetime commission
  dailyStreakRewards: number[]; // 7-day array of coins
  spinWheelSlices: number[]; // 8 slices of coin amounts
  announcementText: string;
  announcementActive: boolean;
  payoutMethodsEnabled: {
    upi: boolean;
    bank: boolean;
    gift_card: boolean;
    ewallet: boolean;
    crypto: boolean;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'earner' | 'admin';
  referralCode: string;
  referredBy: string | null;
  referralActivated: boolean;
  availableCoins: number;
  pendingCoins: number;
  lifetimeEarnedCoins: number;
  totalWithdrawnInr: number;
  completedFirstPayout: boolean;
  offerwallsCompleted: number;
  shortlinksCompleted: number;
  tasksCompleted: number;
  streakDays: number;
  lastCheckInDate: string | null;
  lastSpinDate: string | null;
  claimedMilestones: number[];
  ipAddress: string;
  deviceFingerprint: string;
  status: 'active' | 'flagged' | 'banned';
  createdAt: string;
}

export interface OfferwallPartner {
  id: string;
  name: string;
  providerKey: 'notik' | 'lootably' | 'monetag' | 'custom';
  badgeText: string;
  description: string;
  iframeUrl: string;
  postbackSecret: string;
  payoutMultiplierPercent: number;
  holdDays: number;
  avgMonthlyEarningInr: number;
  enabled: boolean;
}

export interface ShortlinkItem {
  id: string;
  provider: string; // ShrinkMe.io, GPLinks, etc.
  title: string;
  destinationUrl: string;
  rewardCoins: number;
  cooldownHours: number; // 24h default
  minResolveSeconds: number; // Anti-bypass timer (e.g., 12s)
  stepsCount: number;
  dailyMaxClaims: number;
  enabled: boolean;
}

export interface CustomTaskItem {
  id: string;
  category: 'youtube' | 'telegram' | 'instagram' | 'app_review' | 'survey';
  title: string;
  instructions: string;
  targetUrl: string;
  rewardCoins: number;
  holdDays: number;
  proofPrompt: string;
  enabled: boolean;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  correctIndex: number;
}

export interface QuizItem {
  id: string;
  title: string;
  topic: string;
  rewardCoins: number;
  timeLimitSeconds: number;
  questions: QuizQuestion[];
  enabled: boolean;
}

export interface PaidArticleItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  readTimeSeconds: number;
  rewardCoins: number;
  enabled: boolean;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  userName: string;
  sourceType:
    | 'offerwall'
    | 'shortlink'
    | 'manual_task'
    | 'quiz'
    | 'article'
    | 'daily_streak'
    | 'spin_wheel'
    | 'referral_bonus'
    | 'referral_commission'
    | 'promo_code'
    | 'admin_adjustment'
    | 'chargeback_reversal';
  title: string;
  amountCoins: number;
  status: 'pending_hold' | 'cleared' | 'reversed_chargeback';
  createdAt: string;
  unlocksAt: string | null;
  externalTxId?: string;
}

export type PayoutMethodType = 'upi' | 'bank' | 'gift_card' | 'ewallet' | 'crypto';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  method: PayoutMethodType;
  tierLabel: string;
  coinsDeducted: number;
  amountInr: number;
  payoutDetails: {
    upiId?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifscCode?: string;
    giftCardBrand?: string;
    deliveryEmail?: string;
    walletProvider?: string;
    walletPhone?: string;
    cryptoNetwork?: string;
    cryptoAddress?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  utrOrVoucher?: string;
  createdAt: string;
  processedAt?: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  proofText: string;
  rewardCoins: number;
  holdDays: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  rewardCoins: number;
  maxClaims: number;
  claimedUserIds: string[];
  active: boolean;
  createdAt: string;
}

export interface AdPlacementItem {
  id: string;
  slotKey: 'header_banner' | 'sidebar_box' | 'shortlink_interstitial' | 'popunder_script';
  network: 'Monetag' | 'Adsterra' | 'Custom';
  title: string;
  scriptOrHtml: string;
  enabled: boolean;
}

export interface PostbackLogItem {
  id: string;
  provider: string;
  userId: string;
  externalTxId: string;
  coins: number;
  type: 'credit' | 'chargeback';
  status: 'accepted' | 'rejected';
  reason: string;
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  inviteeId: string;
  inviteeName: string;
  inviteeEmail: string;
  activated: boolean;
  flatBonusCoins: number;
  totalCommissionEarnedCoins: number;
  sameIpFlag: boolean;
  createdAt: string;
}

export interface BootstrapPayload {
  settings: SystemSettings;
  currentUser: UserProfile;
  allUsersCount: number;
  offerwalls: OfferwallPartner[];
  shortlinks: ShortlinkItem[];
  shortlinkCooldowns: Record<string, string>; // shortlinkId -> ISO expiry timestamp
  tasks: CustomTaskItem[];
  userTaskSubmissions: TaskSubmission[];
  quizzes: QuizItem[];
  completedQuizIds: string[];
  articles: PaidArticleItem[];
  completedArticleIds: string[];
  ledger: LedgerEntry[];
  withdrawals: WithdrawalRequest[];
  publicPayoutProofs: WithdrawalRequest[];
  referrals: ReferralRecord[];
  leaderboard: Array<{
    rank: number;
    name: string;
    lifetimeEarnedCoins: number;
    referralsCount: number;
    badge: string;
  }>;
  adPlacements: AdPlacementItem[];
  // Admin-only collections
  adminData?: {
    users: UserProfile[];
    allSubmissions: TaskSubmission[];
    allWithdrawals: WithdrawalRequest[];
    promoCodes: PromoCodeItem[];
    postbackLogs: PostbackLogItem[];
  };
}
