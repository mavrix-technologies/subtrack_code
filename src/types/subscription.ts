export type BillingCycle = 'monthly' | 'yearly';

export type SubscriptionCategory =
  | 'entertainment'
  | 'productivity'
  | 'utilities'
  | 'education'
  | 'fitness'
  | 'others';

type SubscriptionIcon = string;

export type Subscription = {
  id: string;
  userId: string;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category: SubscriptionCategory;
  icon: SubscriptionIcon;
  color: string;
  currency: 'INR';
  planName?: string;
  notes?: string;
  startedOn?: string;
  lastUsedAt?: string;
  yearlyPrice?: number;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'paused';
  reminderDays?: number;
  remindersEnabled?: boolean;
  reminderCustomDate?: string;
};

export type SubscriptionFormValues = {
  name: string;
  price: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category: SubscriptionCategory;
  icon: SubscriptionIcon;
  color: string;
  planName: string;
  notes: string;
  startedOn: string;
  lastUsedAt: string;
  yearlyPrice: string;
};

export type SubscriptionInput = Omit<
  Subscription,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'currency'
>;
