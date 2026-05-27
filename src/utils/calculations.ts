import { Invoice } from '@/store/useInvoiceStore';
import { Subscription, SubscriptionCategory } from '@/types/subscription';
import { getEffectiveNextBillingDate } from './dates';

export const getMonthlyEquivalent = (sub: Subscription): number => {
  return sub.billingCycle === 'yearly' ? sub.price / 12 : sub.price;
};

export const getTotalMonthlySpending = (subs: Subscription[]): number => {
  return subs.reduce((sum, sub) => sum + getMonthlyEquivalent(sub), 0);
};

export const getCategoryBreakdown = (subs: Subscription[]): { category: SubscriptionCategory; total: number; percentage: number }[] => {
  const total = getTotalMonthlySpending(subs);
  if (total === 0) return [];

  const breakdown: Record<string, number> = {};
  subs.forEach((sub) => {
    const monthly = getMonthlyEquivalent(sub);
    breakdown[sub.category] = (breakdown[sub.category] || 0) + monthly;
  });

  return Object.entries(breakdown)
    .map(([category, catTotal]) => ({
      category: category as SubscriptionCategory,
      total: catTotal,
      percentage: Math.round((catTotal / total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
};

export const getUpcomingRenewals = (subs: Subscription[], currentDate = new Date()): Subscription[] => {
  return subs.slice().sort((a, b) => {
    const aDate = new Date(getEffectiveNextBillingDate(a, currentDate));
    const bDate = new Date(getEffectiveNextBillingDate(b, currentDate));
    return aDate.getTime() - bDate.getTime();
  });
};

export const getPendingInvoicesTotal = (invoices: Invoice[]) => {
  return invoices
    .filter((inv) => inv.status === 'unpaid' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + (inv.balanceDue ?? inv.total ?? 0), 0);
};
