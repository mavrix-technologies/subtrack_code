import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateSmartAlerts } from '../src/utils/ai-engine';
import { Subscription } from '../src/types/subscription';

const baseSubscription: Subscription = {
  id: 'spotify',
  userId: 'u1',
  name: 'Spotify',
  price: 119,
  billingCycle: 'monthly',
  nextBillingDate: '2026-05-06',
  category: 'entertainment',
  icon: 'spotify',
  color: '#1DB954',
  currency: 'INR',
};

describe('smart alert engine', () => {
  it('creates renewal alerts for subscriptions due within two days', () => {
    const alerts = generateSmartAlerts([baseSubscription], new Date(2026, 4, 5));
    assert.equal(alerts[0].type, 'renewal');
    assert.match(alerts[0].title, /tomorrow/);
  });

  it('creates unused subscription alerts after ten days', () => {
    const alerts = generateSmartAlerts(
      [
        {
          ...baseSubscription,
          id: 'netflix',
          name: 'Netflix',
          nextBillingDate: '2026-05-20',
          lastUsedAt: '2026-04-23',
        },
      ],
      new Date(2026, 4, 5)
    );

    assert.equal(alerts[0].type, 'unused');
    assert.match(alerts[0].title, /12 days/);
  });

  it('creates yearly switch suggestions when yearly pricing is cheaper', () => {
    const alerts = generateSmartAlerts(
      [
        {
          ...baseSubscription,
          yearlyPrice: 1228,
          nextBillingDate: '2026-05-20',
        },
      ],
      new Date(2026, 4, 5)
    );

    assert.equal(alerts[0].type, 'yearly-switch');
    assert.equal(alerts[0].savings, 200);
  });
});
