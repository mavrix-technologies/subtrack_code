import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formValuesToInput,
  getEmptySubscriptionForm,
  validateSubscriptionForm,
} from '../src/utils/validation';

describe('subscription form validation', () => {
  it('requires name, positive price, and a valid date', () => {
    const errors = validateSubscriptionForm({
      ...getEmptySubscriptionForm(),
      name: '',
      price: '0',
      nextBillingDate: 'not-a-date',
    });

    assert.equal(errors.name, 'Name is required');
    assert.equal(errors.price, 'Enter a price greater than 0');
    assert.equal(errors.nextBillingDate, 'Use YYYY-MM-DD');
  });

  it('normalizes valid form values for Firestore writes', () => {
    const input = formValuesToInput({
      ...getEmptySubscriptionForm(),
      name: ' Spotify ',
      price: '119',
      nextBillingDate: '2026-05-10',
      planName: 'Individual',
    });

    assert.equal(input.name, 'Spotify');
    assert.equal(input.price, 119);
    assert.equal(input.planName, 'Individual');
  });
});
