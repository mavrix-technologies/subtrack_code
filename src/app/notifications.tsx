import { NotificationBadgeButton } from '@/components/common/NotificationBadgeButton';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { listenToReminders } from '@/services/reminders';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useInvoiceStore } from '@/store/useInvoiceStore';
import { Reminder } from '@/types/reminder';
import {
  buildNotificationItems,
  getUnreadNotificationCount,
  NotificationCenterItem,
} from '@/utils/notificationCenter';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

const FILTERS: { key: NotificationCenterItem['kind'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'alert', label: 'Alerts' },
  { key: 'renewal', label: 'Renewals' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'activity', label: 'Activity' },
];

function getSeverityColor(item: NotificationCenterItem, palette: ReturnType<typeof useTheme>['palette']) {
  if (item.severity === 'danger') return palette.danger;
  if (item.severity === 'warning') return palette.warning;
  if (item.severity === 'success') return palette.success;
  return palette.primary;
}

export default function NotificationsScreen() {
  const { palette } = useTheme();
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    subscriptions,
    loadingSubscriptions,
    smartAlerts,
    user,
  } = useAppData();
  const { expenses, isLoading: loadingExpenses } = useExpenseStore();
  const { invoices, isLoading: loadingInvoices } = useInvoiceStore();
  const { formatAmount } = useCurrency();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<NotificationCenterItem['kind'] | 'all'>('all');

  useEffect(() => {
    if (!user) return undefined;
    return listenToReminders(user.uid, setReminders, () => undefined);
  }, [user]);

  const items = buildNotificationItems({ smartAlerts, subscriptions, invoices, expenses, reminders });
  const unreadCount = getUnreadNotificationCount(items);
  const visibleItems = filter === 'all' ? items : items.filter((item) => item.kind === filter);
  const openInvoices = invoices.filter((invoice) => invoice.status === 'overdue' || invoice.status === 'unpaid');
  const isLoading = loadingSubscriptions || loadingExpenses || loadingInvoices;

  const styles = createStyles(palette);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Animated.View entering={FadeInDown.duration(280)} style={styles.overview}>
          <View style={styles.overviewTop}>
            <View style={styles.overviewIcon}>
              <NotificationBadgeButton count={unreadCount} onPress={() => undefined} style={styles.badgePreview}>
                <Icon source="bell-outline" size={24} color="#FFFFFF" />
              </NotificationBadgeButton>
            </View>
            <View style={styles.overviewCopy}>
              <Text style={styles.kicker}>Notification center</Text>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {unreadCount > 0 ? `${unreadCount} needs attention` : 'All caught up'}
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{String(smartAlerts.length)}</Text>
              <Text style={styles.metricLabel}>Alerts</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{String(reminders.filter((item) => item.status === 'active').length)}</Text>
              <Text style={styles.metricLabel}>Reminders</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{formatAmount(openInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0))}</Text>
              <Text style={styles.metricLabel}>Open</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(60)} style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Icon source="cellphone-message" size={20} color={palette.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Push notifications</Text>
            <Text style={styles.settingMeta}>Renewals, AI reminders, invoice alerts</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Animated.View layout={LinearTransition} style={styles.list}>
          {isLoading && visibleItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={palette.primary} />
              <Text style={styles.emptyTitle}>Loading notifications</Text>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon source="check-circle-outline" size={28} color={palette.success} />
              <Text style={styles.emptyTitle}>No notifications here</Text>
              <Text style={styles.emptyMeta}>New alerts, reminders, renewals, and activity will appear here.</Text>
            </View>
          ) : (
            visibleItems.map((item, index) => {
              const color = getSeverityColor(item, palette);
              return (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.duration(260).delay(Math.min(index * 35, 220))}
                  layout={LinearTransition.springify().damping(18)}
                >
                  <Pressable style={styles.itemCard} onPress={() => router.push(item.route as never)}>
                    <View style={[styles.itemIcon, { backgroundColor: `${color}18` }]}>
                      <Icon source={item.icon} size={21} color={color} />
                    </View>
                    <View style={styles.itemCopy}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                        {item.unread && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
                      </View>
                      <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>{item.meta}</Text>
                    </View>
                    <Icon source="chevron-right" size={20} color={palette.muted} />
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: ReturnType<typeof useTheme>['palette']) {
  const line = palette.background === palette.surface ? '#E2E8F0' : palette.line;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: 20,
      paddingBottom: 120,
      gap: 16,
    },
    overview: {
      borderRadius: 24,
      padding: 18,
      backgroundColor: palette.primary,
      boxShadow: '0 12px 28px rgba(249,115,22,0.22)',
    },
    overviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    overviewIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    badgePreview: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overviewCopy: {
      flex: 1,
      minWidth: 0,
    },
    kicker: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 12,
      fontWeight: '800',
    },
    title: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 0,
      marginTop: 2,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    metric: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      padding: 10,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    metricValue: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
    },
    metricLabel: {
      color: 'rgba(255,255,255,0.76)',
      fontSize: 11,
      fontWeight: '800',
      marginTop: 4,
    },
    settingRow: {
      minHeight: 74,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: palette.surface,
    },
    settingIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${palette.primary}18`,
    },
    settingCopy: {
      flex: 1,
      minWidth: 0,
    },
    settingTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '900',
    },
    settingMeta: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 3,
    },
    filterRow: {
      gap: 8,
      paddingRight: 4,
    },
    filterChip: {
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: 18,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      backgroundColor: palette.surface,
    },
    filterChipActive: {
      backgroundColor: '#111827',
      borderColor: '#111827',
    },
    filterText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    list: {
      gap: 10,
    },
    itemCard: {
      minHeight: 86,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      backgroundColor: palette.surface,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 6px 16px rgba(15,23,42,0.05)',
    },
    itemIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    itemCopy: {
      flex: 1,
      minWidth: 0,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '900',
      flex: 1,
      minWidth: 0,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    itemMessage: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 3,
    },
    itemMeta: {
      color: palette.primary,
      fontSize: 11,
      fontWeight: '900',
      marginTop: 5,
    },
    emptyCard: {
      minHeight: 150,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      gap: 8,
    },
    emptyTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyMeta: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
