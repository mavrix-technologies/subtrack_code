import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Subscription } from '@/types/subscription';
import { Reminder, ReminderDraft } from '@/types/reminder';
import { getEffectiveNextBillingDate, parseIsoDate, formatDisplayDate } from '@/utils/dates';

// ── Expo Go detection ─────────────────────────────────────────────────────────

const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(sub: Subscription): string {
  const symbols: Record<string, string> = {
    INR: 'Rs. ', USD: '$', EUR: 'EUR ', GBP: 'GBP ',
  };
  const sym = symbols[sub.currency] ?? (sub.currency + ' ');
  return `${sym}${sub.price.toLocaleString()}`;
}

// ── Channel IDs ───────────────────────────────────────────────────────────────

const CHANNEL_RENEWAL = 'renewal-reminders';
const CHANNEL_TEST    = 'test-alerts';
const CHANNEL_AI_REMINDER = 'ai-reminders';
const CHANNEL_AI_ALARM = 'ai-reminder-alarms';

// ── Singleton initialiser ─────────────────────────────────────────────────────

let notificationsReady = false;

async function getNotifications() {
  const Notifications = await import('expo-notifications');

  if (!notificationsReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });

    // Android channels — skipped in Expo Go (unsupported)
    if (!IS_EXPO_GO && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync(CHANNEL_RENEWAL, {
        name:                 'Renewal Reminders',
        description:          'Reminds you 1 day before a subscription renews',
        importance:           Notifications.AndroidImportance.HIGH,
        sound:                'renewal_alert.wav',
        vibrationPattern:     [0, 250, 250, 250],
        lightColor:           '#4338CA',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:            false,
        showBadge:            true,
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_TEST, {
        name:                 'Test Alerts',
        description:          'Test notification to verify your alert setup',
        importance:           Notifications.AndroidImportance.MAX,
        sound:                'test_chime.wav',
        vibrationPattern:     [0, 100, 100, 100, 100, 100],
        lightColor:           '#F59E0B',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:            false,
        showBadge:            false,
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_AI_REMINDER, {
        name:                 'AI Reminders',
        description:          'Smart reminders created by the AI assistant',
        importance:           Notifications.AndroidImportance.HIGH,
        sound:                'default',
        vibrationPattern:     [0, 180, 120, 180],
        lightColor:           '#F97316',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:            false,
        showBadge:            true,
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_AI_ALARM, {
        name:                 'AI Reminder Alarms',
        description:          'High-priority AI reminder alarms — wakes the screen like a real alarm',
        importance:           Notifications.AndroidImportance.MAX,
        sound:                'default',
        vibrationPattern:     [0, 500, 200, 500, 200, 900],
        lightColor:           '#EF4444',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:            true,   // ← cuts through Do-Not-Disturb
        showBadge:            true,
      });
    }

    notificationsReady = true;
  }

  return Notifications;
}

// ── Permission helper ─────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const N = await getNotifications();
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

// ── Trigger builders (channelId omitted in Expo Go) ───────────────────────────

function makeDateTrigger(N: any, date: Date, channelId: string): any {
  const trigger: Record<string, unknown> = {
    type: N.SchedulableTriggerInputTypes.DATE,
    date,
  };
  if (!IS_EXPO_GO) trigger.channelId = channelId;
  return trigger;
}

function makeRepeatTrigger(N: any, date: Date, repeat: ReminderDraft['repeat'], channelId: string): any {
  const base: Record<string, unknown> = {
    hour: date.getHours(),
    minute: date.getMinutes(),
  };

  if (!IS_EXPO_GO) base.channelId = channelId;

  if (repeat === 'daily') {
    return {
      ...base,
      type: N.SchedulableTriggerInputTypes.DAILY,
    };
  }

  if (repeat === 'weekly') {
    return {
      ...base,
      type: N.SchedulableTriggerInputTypes.WEEKLY,
      weekday: date.getDay() + 1,
    };
  }

  if (repeat === 'monthly') {
    return {
      ...base,
      type: N.SchedulableTriggerInputTypes.MONTHLY,
      day: date.getDate(),
    };
  }

  if (repeat === 'yearly') {
    return {
      ...base,
      type: N.SchedulableTriggerInputTypes.YEARLY,
      day: date.getDate(),
      month: date.getMonth() + 1,
    };
  }

  return makeDateTrigger(N, date, channelId);
}

function makeIntervalTrigger(N: any, seconds: number, channelId: string): any {
  const trigger: Record<string, unknown> = {
    type:    N.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
  };
  if (!IS_EXPO_GO) trigger.channelId = channelId;
  return trigger;
}

// ── Sync renewal notifications ────────────────────────────────────────────────

export async function syncRenewalNotifications(subscriptions: Subscription[]) {
  const [N, granted] = await Promise.all([
    getNotifications(),
    requestNotificationPermission(),
  ]);
  if (!granted) return { scheduled: 0, permission: 'denied' as const };

  const scheduledNotifications = await N.getAllScheduledNotificationsAsync().catch(() => []);
  const cancelPromises: Promise<any>[] = [];
  for (const notification of scheduledNotifications) {
    if (notification?.content?.data?.type === 'renewal_reminder') {
      cancelPromises.push(
        N.cancelScheduledNotificationAsync(notification.identifier).catch(() => undefined)
      );
    }
  }
  await Promise.all(cancelPromises);

  let scheduled = 0;

  for (const sub of subscriptions) {
    if (sub.status === 'paused') continue;
    
    // Explicitly check if user turned reminders off completely
    const isEnabled = sub.remindersEnabled ?? true;
    if (!isEnabled) continue;

    const nextIso  = getEffectiveNextBillingDate(sub);
    const nextDate = parseIsoDate(nextIso);
    if (!nextDate) continue;

    const price = formatPrice(sub);
    const cycle = sub.billingCycle === 'monthly' ? 'month' : 'year';
    const plan  = sub.planName || 'subscription';
    
    const daysBefore = sub.reminderDays ?? 3;

    // Calculate exactly when the reminder should fire
    let reminderDate: Date;
    if (sub.reminderCustomDate) {
      reminderDate = new Date(sub.reminderCustomDate);
      // Ensure it fires at 9AM on that day
      reminderDate.setHours(9, 0, 0, 0);
    } else {
      reminderDate = new Date(nextDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      reminderDate.setHours(9, 0, 0, 0);
    }

    if (reminderDate > new Date()) {
      let title = `${sub.name} renews soon`;
      let body = `Your ${plan} auto-renews for ${price}/${cycle} on ${formatDisplayDate(nextIso)}.`;

      if (!sub.reminderCustomDate) {
        if (daysBefore === 1) {
          title = `${sub.name} renews tomorrow`;
          body = `Your ${plan} auto-renews for ${price}/${cycle}. Tap to manage.`;
        } else if (daysBefore === 0) {
          title = `${sub.name} renews today`;
          body = `${price} will be charged today. Tap to manage.`;
        } else if (daysBefore > 1) {
          title = `${sub.name} renews in ${daysBefore} days`;
        }
      }

      await N.scheduleNotificationAsync({
        content: {
          title,
          body,
          data:  { subscriptionId: sub.id, type: 'renewal_reminder' },
          sound: true,
          badge: 1,
        },
        trigger: makeDateTrigger(N, reminderDate, CHANNEL_RENEWAL),
      });
      scheduled += 1;
    }
  }

  return { scheduled, permission: 'granted' as const };
}

export async function cancelScheduledNotifications() {
  const N = await getNotifications();
  await N.cancelAllScheduledNotificationsAsync();
}

// ── Instant test notification ─────────────────────────────────────────────────

export async function sendTestNotification(sub: Subscription): Promise<void> {
  const [N, granted] = await Promise.all([
    getNotifications(),
    requestNotificationPermission(),
  ]);
  if (!granted) throw new Error('Notification permission was not granted.');

  const price = formatPrice(sub);
  const cycle = sub.billingCycle === 'monthly' ? 'month' : 'year';
  const plan  = sub.planName || 'Standard Plan';

  await N.scheduleNotificationAsync({
    content: {
      title:    `${sub.name} — Renewal Reminder`,
      subtitle: plan,
      body:     `Your ${plan} renews tomorrow for ${price}/${cycle}. Tap to review or cancel.`,
      data:     { subscriptionId: sub.id, type: 'test' },
      sound:    true,
      badge:    1,
    },
    trigger: makeIntervalTrigger(N, 2, CHANNEL_TEST),
  });
}

export async function scheduleReminderNotifications(
  reminder: Pick<Reminder, 'id'> & ReminderDraft
): Promise<string[]> {
  const [N, granted] = await Promise.all([
    getNotifications(),
    requestNotificationPermission(),
  ]);
  if (!granted || !reminder.datetime) return [];

  const eventDate = new Date(reminder.datetime);
  if (Number.isNaN(eventDate.getTime())) return [];

  const leads = reminder.smartReminders.length > 0
    ? reminder.smartReminders
    : [{ label: 'Reminder', minutesBefore: 0 }];

  const notificationIds: string[] = [];
  const isAlarm = reminder.alertMode === 'alarm';
  const channelId = isAlarm ? CHANNEL_AI_ALARM : CHANNEL_AI_REMINDER;

  const promises = leads.map(async (lead) => {
    const triggerDate = new Date(eventDate);
    triggerDate.setMinutes(triggerDate.getMinutes() - Math.max(0, lead.minutesBefore));
    const isRepeating = reminder.repeat !== 'none';
    if (!isRepeating && triggerDate <= new Date()) return null;

    // Alarm-specific extras: full-screen intent pops over lock screen on Android,
    // categoryIdentifier maps to a registered category on iOS.
    const alarmExtras = isAlarm
      ? {
          categoryIdentifier: 'ALARM',
          // Android full-screen intent — wakes screen even when locked/muted
          ...((!IS_EXPO_GO) ? { fullScreenNotification: true } : {}),
        }
      : {};

    return N.scheduleNotificationAsync({
      content: {
        title: isAlarm
          ? `⏰ Alarm: ${reminder.title}`
          : lead.minutesBefore > 0 ? `${reminder.title} soon` : reminder.title,
        body: reminder.location
          ? `${lead.label} • ${reminder.location}`
          : lead.label,
        data: {
          reminderId: reminder.id,
          type: isAlarm ? 'ai_reminder_alarm' : 'ai_reminder',
          category: reminder.category,
        },
        sound: true,
        badge: 1,
        ...alarmExtras,
      },
      trigger: isRepeating
        ? makeRepeatTrigger(N, triggerDate, reminder.repeat, channelId)
        : makeDateTrigger(N, triggerDate, channelId),
    });
  });

  const scheduledIds = await Promise.all(promises);
  for (const id of scheduledIds) {
    if (id) notificationIds.push(id);
  }

  return notificationIds;
}

export async function cancelReminderNotifications(notificationIds?: string[]) {
  if (!notificationIds?.length) return;
  const N = await getNotifications();

  await Promise.all(
    notificationIds.map((id) => N.cancelScheduledNotificationAsync(id).catch(() => undefined))
  );
}
