import { Subscription } from '@/types/subscription';
import { daysBetween, daysUntil, parseIsoDate } from '@/utils/dates';

export type SmartAlert = {
  id: string;
  type: 'unused' | 'renewal' | 'yearly-switch';
  severity: 'danger' | 'warning' | 'info';
  subscriptionId: string;
  title: string;
  message: string;
  ctaLabel: string;
  savings?: number;
};

export function generateSmartAlerts(
  subscriptions: Subscription[],
  from = new Date()
) {
  const alerts: SmartAlert[] = [];

  for (const subscription of subscriptions) {
    const lastUsed = subscription.lastUsedAt
      ? parseIsoDate(subscription.lastUsedAt)
      : null;
    if (lastUsed) {
      const unusedDays = daysBetween(lastUsed, from);
      if (unusedDays > 10) {
        alerts.push({
          id: `${subscription.id}-unused`,
          type: 'unused',
          severity: 'danger',
          subscriptionId: subscription.id,
          title: `${subscription.name} unused for ${unusedDays} days`,
          message: `Cancel before ${subscription.nextBillingDate} to save ${subscription.price}.`,
          ctaLabel: 'Review',
          savings: subscription.price,
        });
      }
    }

    const renewalIn = daysUntil(subscription.nextBillingDate, from);
    if (renewalIn >= 0 && renewalIn <= 2) {
      alerts.push({
        id: `${subscription.id}-renewal`,
        type: 'renewal',
        severity: renewalIn <= 1 ? 'warning' : 'info',
        subscriptionId: subscription.id,
        title:
          renewalIn === 0
            ? `${subscription.name} renews today`
            : renewalIn === 1
              ? `${subscription.name} renewal tomorrow`
              : `${subscription.name} renewal soon`,
        message: `Your subscription will renew for ${subscription.price}.`,
        ctaLabel: 'View',
      });
    }

    if (
      subscription.billingCycle === 'monthly' &&
      subscription.yearlyPrice &&
      subscription.yearlyPrice < subscription.price * 12
    ) {
      const savings = subscription.price * 12 - subscription.yearlyPrice;
      alerts.push({
        id: `${subscription.id}-yearly`,
        type: 'yearly-switch',
        severity: 'info',
        subscriptionId: subscription.id,
        title: `Switch ${subscription.name} to yearly?`,
        message: `You can save up to ${savings}.`,
        ctaLabel: 'View',
        savings,
      });
    }
  }

  return alerts.sort((a, b) => {
    const priority = { danger: 0, warning: 1, info: 2 };
    return priority[a.severity] - priority[b.severity];
  });
}
