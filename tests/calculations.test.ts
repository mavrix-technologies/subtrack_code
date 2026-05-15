import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getCategoryBreakdown,
  getMonthlyEquivalent,
  getTotalMonthlySpending,
  getUpcomingRenewals,
} from '../src/utils/calculations';
import { getEffectiveNextBillingDate } from '../src/utils/dates';
import { Subscription } from '../src/types/subscription';

const subscriptions: Subscription[] = [
  {
    id: 'monthly',
    userId: 'u1',
    name: 'Netflix',
    price: 500,
    billingCycle: 'monthly',
    nextBillingDate: '2026-05-12',
    category: 'entertainment',
    icon: 'netflix',
    color: '#E50914',
    currency: 'INR',
  },
  {
    id: 'yearly',
    userId: 'u1',
    name: 'Adobe',
    price: 1200,
    billingCycle: 'yearly',
    nextBillingDate: '2026-05-20',
    category: 'productivity',
    icon: 'adobe',
    color: '#EC1C24',
    currency: 'INR',
  },
];

describe('subscription calculations', () => {
  it('converts yearly billing into a monthly equivalent', () => {
    assert.equal(getMonthlyEquivalent(subscriptions[1]), 100);
    assert.equal(getTotalMonthlySpending(subscriptions), 600);
  });

  it('groups spending by category', () => {
    const breakdown = getCategoryBreakdown(subscriptions);
    assert.equal(breakdown[0].category, 'entertainment');
    assert.equal(breakdown[0].total, 500);
    assert.equal(breakdown[0].percentage, 83);
  });

  it('sorts upcoming renewals ascending', () => {
    const upcoming = getUpcomingRenewals([...subscriptions].reverse(), new Date(2026, 4, 5));
    assert.deepEqual(
      upcoming.map((item) => item.id),
      ['monthly', 'yearly']
    );
  });

  it('advances overdue renewal dates without mutating the source date', () => {
    const next = getEffectiveNextBillingDate(
      {
        nextBillingDate: '2026-01-12',
        billingCycle: 'monthly',
      },
      new Date(2026, 4, 5)
    );
    assert.equal(next, '2026-05-12');
  });
});
