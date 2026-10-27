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
}
