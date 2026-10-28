export type ThemeMode = 'dark' | 'light';

export type DashboardTab = 'overview' | 'quests' | 'referrals' | 'wallet';

export type PayoutChannel = 'upi' | 'bank' | 'gift_card' | 'crypto';

export interface WithdrawalRecord {
  id: string;
  method: PayoutChannel;
  methodLabel: string;
  destination: string;
  coins: number;
  amountInr: number;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
}

export interface HeldRewardRecord {
  id: string;
  title: string;
  coins: number;
  amountInr: number;
  status: 'pending_hold' | 'credited' | 'reversed_chargeback';
  createdAt: string;
  unlocksAt?: string | null;
}

export interface PlayerUser {
  id: string;
  name: string;
  email: string;
  authProvider: 'google' | 'email';
  referralCode: string;
  referredBy: string | null;
  availableCoins: number;
  pendingCoins: number;
  questsCompleted: number;
  referralsCount: number;
  joinedAt: string;
  withdrawals: WithdrawalRecord[];
  heldRewards?: HeldRewardRecord[];
}

export interface OfferwallConfig {
  provider_id: string;
  name: string;
  badge: string;
  enabled: number;
  app_id: string;
  iframe_url_template: string;
  signed_iframe_url?: string;
  secret_key?: string;
  hold_days: number;
  postback_macro_query?: string;
}
