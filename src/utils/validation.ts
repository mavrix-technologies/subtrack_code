import {
  SubscriptionFormValues,
  SubscriptionInput,
} from '@/types/subscription';
import { isValidIsoDate, parseIsoDate, todayIso } from '@/utils/dates';

export type SubscriptionFormErrors = Partial<
  Record<keyof SubscriptionFormValues, string>
>;

export function getEmptySubscriptionForm(): SubscriptionFormValues {
  return {
    name: '',
    price: '',
    billingCycle: 'monthly',
    nextBillingDate: todayIso(),
    category: 'entertainment',
    icon: 'netflix',
    color: '#2F6BFF',
    planName: '',
    notes: '',
    startedOn: '',
    lastUsedAt: '',
    yearlyPrice: '',
  };
}

export function validateSubscriptionForm(values: SubscriptionFormValues) {
  const errors: SubscriptionFormErrors = {};
  const price = Number(values.price);
  const yearlyPrice = values.yearlyPrice ? Number(values.yearlyPrice) : undefined;

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!values.price.trim() || Number.isNaN(price) || price <= 0) {
    errors.price = 'Enter a price greater than 0';
  }

  if (!isValidIsoDate(values.nextBillingDate)) {
    errors.nextBillingDate = 'Use YYYY-MM-DD';
  } else {
    const today = parseIsoDate(todayIso())!;
    const next = parseIsoDate(values.nextBillingDate)!;
    if (next < today) {
      errors.nextBillingDate = 'Date cannot be in the past';
    }
  }

  if (values.startedOn && !isValidIsoDate(values.startedOn)) {
    errors.startedOn = 'Use YYYY-MM-DD';
  }

  if (values.lastUsedAt && !isValidIsoDate(values.lastUsedAt)) {
    errors.lastUsedAt = 'Use YYYY-MM-DD';
  }

  if (
    values.yearlyPrice &&
    (yearlyPrice === undefined || Number.isNaN(yearlyPrice) || yearlyPrice <= 0)
  ) {
    errors.yearlyPrice = 'Enter a yearly price greater than 0';
  }

  return errors;
}

export function formValuesToInput(
  values: SubscriptionFormValues
): SubscriptionInput {
  return {
    name: values.name.trim(),
    price: Number(values.price),
    billingCycle: values.billingCycle,
    nextBillingDate: values.nextBillingDate,
    category: values.category,
    icon: values.icon,
    color: values.color,
    planName: values.planName.trim() || undefined,
    notes: values.notes.trim() || undefined,
    startedOn: values.startedOn || undefined,
    lastUsedAt: values.lastUsedAt || undefined,
    yearlyPrice: values.yearlyPrice ? Number(values.yearlyPrice) : undefined,
  };
}
