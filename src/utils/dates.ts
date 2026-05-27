import { BillingCycle, Subscription } from '@/types/subscription';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const displayDateFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso() {
  return toIsoDate(new Date());
}

export function parseIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidIsoDate(value: string) {
  return parseIsoDate(value) !== null;
}

export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  return displayDateFormatter.format(date);
}

export function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return shortDateFormatter.format(date);
}

export function daysBetween(start: Date, end: Date) {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86400000);
}

export function daysUntil(value: string, from = new Date()) {
  const date = parseIsoDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return daysBetween(from, date);
}

function addBillingCycle(date: Date, billingCycle: BillingCycle) {
  const next = new Date(date);
  if (billingCycle === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

export function getEffectiveNextBillingDate(
  subscription: Pick<Subscription, 'nextBillingDate' | 'billingCycle'>,
  from = new Date()
) {
  const parsed = parseIsoDate(subscription.nextBillingDate);
  if (!parsed) return subscription.nextBillingDate;

  let next = parsed;
  let guard = 0;
  while (daysBetween(from, next) < 0 && guard < 240) {
    next = addBillingCycle(next, subscription.billingCycle);
    guard += 1;
  }

  return toIsoDate(next);
}

export function getRelativeRenewalLabel(value: string, from = new Date()) {
  const delta = daysUntil(value, from);
  if (!Number.isFinite(delta)) return '';
  if (delta < 0) return 'Overdue';
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  return `In ${delta} days`;
}
