import { Invoice } from '@/store/useInvoiceStore';
import { Expense } from '@/store/useExpenseStore';
import { Reminder } from '@/types/reminder';
import { Subscription } from '@/types/subscription';
import { SmartAlert } from '@/utils/ai-engine';
import { daysUntil, formatDisplayDate } from '@/utils/dates';

export type NotificationCenterItem = {
  id: string;
  kind: 'alert' | 'renewal' | 'invoice' | 'reminder' | 'activity';
  severity: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  meta: string;
  icon: string;
  route: string;
  unread: boolean;
};

type BuildNotificationItemsInput = {
  smartAlerts: SmartAlert[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  expenses?: Expense[];
  reminders: Reminder[];
};

function reminderTimeLabel(value: string | null) {
  if (!value) return 'No time set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No time set';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function daysUntilDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const from = new Date();
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((dateUtc - fromUtc) / 86400000);
}

export function buildNotificationItems({
  smartAlerts,
  subscriptions,
  invoices,
  expenses = [],
  reminders,
}: BuildNotificationItemsInput): NotificationCenterItem[] {
  const subscriptionById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const items: NotificationCenterItem[] = [];

  for (const alert of smartAlerts.slice(0, 8)) {
    items.push({
      id: `alert-${alert.id}`,
      kind: 'alert',
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      meta: alert.ctaLabel,
      icon: alert.severity === 'danger' ? 'alert-circle-outline' : 'bell-ring-outline',
      route: `/subscription/${alert.subscriptionId}`,
      unread: true,
    });
  }

  for (const subscription of subscriptions) {
    const days = daysUntil(subscription.nextBillingDate);
    if (subscription.status === 'paused' || days < 0 || days > 7) continue;

    items.push({
      id: `renewal-${subscription.id}`,
      kind: 'renewal',
      severity: days <= 1 ? 'warning' : 'info',
      title: days === 0 ? `${subscription.name} renews today` : `${subscription.name} renewal coming`,
      message: `${subscription.planName || 'Plan'} renews for ${subscription.price.toLocaleString()} on ${formatDisplayDate(subscription.nextBillingDate)}.`,
      meta: days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} left`,
      icon: 'calendar-clock',
      route: `/subscription/${subscription.id}`,
      unread: days <= 2,
    });
  }

  for (const invoice of invoices) {
    const isOpen = invoice.status === 'unpaid' || invoice.status === 'overdue';
    if (!isOpen) continue;
    const dueDays = invoice.dueDate ? daysUntil(invoice.dueDate) : null;
    if (invoice.status !== 'overdue' && dueDays !== null && dueDays > 7) continue;

    items.push({
      id: `invoice-${invoice.id}`,
      kind: 'invoice',
      severity: invoice.status === 'overdue' ? 'danger' : 'warning',
      title: invoice.status === 'overdue' ? 'Invoice overdue' : 'Invoice payment pending',
      message: `${invoice.clientName || invoice.invoiceNumber} has ${invoice.balanceDue.toLocaleString()} due.`,
      meta: invoice.status === 'overdue' ? 'Overdue' : invoice.dueDate ? formatDisplayDate(invoice.dueDate) : 'Open',
      icon: invoice.status === 'overdue' ? 'clock-alert-outline' : 'receipt-text-outline',
      route: `/invoice/${invoice.id}`,
      unread: invoice.status === 'overdue',
    });
  }

  for (const reminder of reminders) {
    if (reminder.status !== 'active' || !reminder.datetime) continue;
    const days = daysUntilDateTime(reminder.datetime);
    if (days < 0 || days > 7) continue;

    items.push({
      id: `reminder-${reminder.id}`,
      kind: 'reminder',
      severity: reminder.alertMode === 'alarm' ? 'danger' : days <= 1 ? 'warning' : 'info',
      title: reminder.title,
      message: reminder.location || reminder.notes || 'AI reminder is scheduled.',
      meta: reminderTimeLabel(reminder.datetime),
      icon: reminder.alertMode === 'alarm' ? 'alarm' : 'bell-outline',
      route: '/assistant',
      unread: days <= 1,
    });
  }

  const recentInvoices = invoices
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  for (const invoice of recentInvoices) {
    const subscription = invoice.linkedExpenseId ? null : subscriptionById.get(invoice.id);
    items.push({
      id: `activity-invoice-${invoice.id}`,
      kind: 'activity',
      severity: invoice.status === 'paid' ? 'success' : 'info',
      title: invoice.status === 'paid' ? 'Invoice paid' : 'Invoice updated',
      message: `${invoice.clientName || invoice.invoiceNumber}${subscription ? ` for ${subscription.name}` : ''}`,
      meta: formatDisplayDate(invoice.date),
      icon: invoice.status === 'paid' ? 'check-circle-outline' : 'file-document-outline',
      route: `/invoice/${invoice.id}`,
      unread: false,
    });
  }

  const recentExpenses = expenses
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  for (const expense of recentExpenses) {
    items.push({
      id: `activity-expense-${expense.id}`,
      kind: 'activity',
      severity: expense.isSplit ? 'info' : 'success',
      title: expense.isSplit ? 'Split expense logged' : 'Expense logged',
      message: `${expense.name} for ${expense.amount.toLocaleString()}`,
      meta: formatDisplayDate(expense.date),
      icon: expense.isSplit ? 'account-multiple-outline' : 'wallet-outline',
      route: `/expense/${expense.id}`,
      unread: false,
    });
  }

  return items.sort((a, b) => {
    const severityRank = { danger: 0, warning: 1, info: 2, success: 3 };
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return severityRank[a.severity] - severityRank[b.severity];
  });
}

export function getUnreadNotificationCount(items: NotificationCenterItem[]) {
  return items.filter((item) => item.unread).length;
}
