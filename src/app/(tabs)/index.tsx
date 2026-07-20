import { BrandIcon } from '@/components/BrandIcon';
import { HomeBannerAd } from '@/components/ads/HomeBannerAd';
import { HomeNativeAd } from '@/components/ads/HomeNativeAd';
import { AnimatedNumberText } from '@/components/common/AnimatedNumberText';
import { NotificationBadgeButton } from '@/components/common/NotificationBadgeButton';
import { HomeRemoteBanner } from '@/components/messaging/HomeRemoteBanner';
import { POPULAR_APPS } from '@/constants/brands';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { listenToReminders } from '@/services/reminders';
import { Expense, useExpenseStore } from '@/store/useExpenseStore';
import { Invoice, useInvoiceStore } from '@/store/useInvoiceStore';
import { Reminder } from '@/types/reminder';
import { Subscription } from '@/types/subscription';
import { SmartAlert } from '@/utils/ai-engine';
import { getPendingInvoicesTotal, getTotalMonthlySpending } from '@/utils/calculations';
import { formatDisplayDate, getRelativeRenewalLabel } from '@/utils/dates';
import { buildNotificationItems, getUnreadNotificationCount } from '@/utils/notificationCenter';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function MaterialGlyph({
  color,
  name,
  size = 22,
}: {
  color: string;
  name: string;
  size?: number;
}) {
  return (
    <MaterialIcons
      name={name as keyof typeof MaterialIcons.glyphMap}
      size={size}
      color={color}
    />
  );
}

type HomeActivityItem = {
  id: string;
  title: string;
  meta: string;
  value: string;
  icon: string;
  route: string;
  brandIconPath?: string;
  brandColor?: string;
};

type SummaryCardItem = {
  label: string;
  value: number;
  formatter?: (value: number) => string;
  icon: string;
  onPress: () => void;
};

type StableHomeData = {
  subscriptions: Subscription[];
  upcomingRenewals: Subscription[];
  smartAlerts: SmartAlert[];
  expenses: Expense[];
  invoices: Invoice[];
  reminders: Reminder[];
};

const EMPTY_STABLE_HOME_DATA: StableHomeData = {
  subscriptions: [],
  upcomingRenewals: [],
  smartAlerts: [],
  expenses: [],
  invoices: [],
  reminders: [],
};

function getThisMonthExpenseTotal(expenses: { amount: number; date: string }[]) {
  const now = new Date();
  return expenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

function getInvoiceTotals(invoices: Invoice[]) {
  return invoices.reduce(
    (totals, invoice) => {
      totals.invoiced += invoice.total || 0;
      totals.collected += invoice.amountPaid || 0;
      totals.open += invoice.status === 'unpaid' || invoice.status === 'overdue'
        ? invoice.balanceDue ?? invoice.total ?? 0
        : 0;
      return totals;
    },
    { invoiced: 0, collected: 0, open: 0 }
  );
}

function getRecentExpenses(expenses: Expense[]) {
  return expenses
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
}

const resolveBrandIcon = (icon?: string) => POPULAR_APPS.find((app) => app.id === icon);

// react-doctor-disable-next-line react-doctor/no-giant-component
export default function DashboardScreen() {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 380;
  const layout = createLayout(palette, isCompact);
  const { upcomingRenewals, subscriptions, loadingSubscriptions, smartAlerts, user } = useAppData();
  const { expenses, isLoading: loadingExpenses } = useExpenseStore();
  const { invoices, isLoading: loadingInvoices } = useInvoiceStore();
  const { formatAmount } = useCurrency();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stableHomeData, setStableHomeData] = useState<StableHomeData>(EMPTY_STABLE_HOME_DATA);

  useEffect(() => {
    if (!user) return undefined;
    return listenToReminders(user.uid, setReminders, () => undefined);
  }, [user]);

  const isHomeHydrating = loadingSubscriptions || loadingExpenses || loadingInvoices;
  const hasLiveHomeData =
    subscriptions.length > 0 ||
    upcomingRenewals.length > 0 ||
    smartAlerts.length > 0 ||
    expenses.length > 0 ||
    invoices.length > 0 ||
    reminders.length > 0;

  useEffect(() => {
    if (!isHomeHydrating || hasLiveHomeData) {
      const nextStableHomeData = {
        subscriptions,
        upcomingRenewals,
        smartAlerts,
        expenses,
        invoices,
        reminders,
      };
      const updateHandle = setTimeout(() => {
        setStableHomeData(nextStableHomeData);
      }, 0);

      return () => clearTimeout(updateHandle);
    }

    return undefined;
  }, [
    expenses,
    hasLiveHomeData,
    invoices,
    isHomeHydrating,
    reminders,
    smartAlerts,
    subscriptions,
    upcomingRenewals,
  ]);

  const displayHomeData = isHomeHydrating && !hasLiveHomeData
    ? stableHomeData
    : {
        subscriptions,
        upcomingRenewals,
        smartAlerts,
        expenses,
        invoices,
        reminders,
      };

  const monthlySubscriptions = getTotalMonthlySpending(displayHomeData.subscriptions);
  const monthExpenses = getThisMonthExpenseTotal(displayHomeData.expenses);
  const invoiceTotals = getInvoiceTotals(displayHomeData.invoices);
  const pendingInvoices = getPendingInvoicesTotal(displayHomeData.invoices);
  const balance = monthlySubscriptions + monthExpenses + pendingInvoices;
  const shouldShowNumberPlaceholder = isHomeHydrating && !hasLiveHomeData;
  const upcomingPreview = displayHomeData.upcomingRenewals.slice(0, 5);
  const recentExpenses = getRecentExpenses(displayHomeData.expenses);
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const notificationItems = buildNotificationItems({
    smartAlerts: displayHomeData.smartAlerts,
    subscriptions: displayHomeData.subscriptions,
    invoices: displayHomeData.invoices,
    expenses: displayHomeData.expenses,
    reminders: displayHomeData.reminders,
  });
  const notificationCount = getUnreadNotificationCount(notificationItems);
  const activeReminders = displayHomeData.reminders.filter((reminder) => reminder.status === 'active' && reminder.datetime);
  const openInvoices = displayHomeData.invoices.filter((invoice) => invoice.status === 'overdue' || invoice.status === 'unpaid');
  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Total Spend',
      value: balance,
      formatter: formatAmount,
      icon: 'trending-up',
      onPress: () => router.push('/expenses'),
    },
    {
      label: 'Subscriptions',
      value: displayHomeData.subscriptions.length,
      icon: 'subscriptions',
      onPress: () => router.push('/subscriptions'),
    },
    {
      label: 'Pending Invoices',
      value: invoiceTotals.open,
      formatter: formatAmount,
      icon: 'receipt-long',
      onPress: () => router.push('/invoices'),
    },
    {
      label: 'Expenses',
      value: monthExpenses,
      formatter: formatAmount,
      icon: 'account-balance-wallet',
      onPress: () => router.push('/expenses'),
    },
  ];
  const activityItems = [
    ...upcomingPreview.map((sub) => {
      const appDef = resolveBrandIcon(sub.icon);
      const brandColor = sub.color && !['#FFFFFF', '#000000', '#111111'].includes(sub.color)
        ? sub.color
        : appDef?.icon.hex
          ? `#${appDef.icon.hex}`
          : palette.text;

      return {
        id: `renewal-${sub.id}`,
        title: sub.name,
        meta: `Renewal ${getRelativeRenewalLabel(sub.nextBillingDate)}`,
        value: formatAmount(sub.price),
        icon: 'event',
        route: `/subscription/${sub.id}`,
        brandIconPath: appDef?.icon.path,
        brandColor,
      };
    }),
    ...openInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      title: invoice.clientName || invoice.invoiceNumber,
      meta: invoice.status === 'overdue' ? 'Invoice overdue' : 'Payment pending',
      value: formatAmount(invoice.balanceDue ?? invoice.total),
      icon: 'receipt-long',
      route: `/invoice/${invoice.id}`,
    })),
    ...activeReminders.map((reminder) => ({
      id: `reminder-${reminder.id}`,
      title: reminder.title,
      meta: reminder.alertMode === 'alarm' ? 'Alarm scheduled' : 'Reminder scheduled',
      value: reminder.datetime ? formatDisplayDate(reminder.datetime.slice(0, 10)) : 'Active',
      icon: reminder.alertMode === 'alarm' ? 'alarm' : 'notifications-active',
      route: '/assistant',
    })),
    ...recentExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      title: expense.name,
      meta: expense.category || 'Latest expense',
      value: formatAmount(expense.amount),
      icon: expense.isSplit ? 'groups' : 'payments',
      route: `/expense/${expense.id}`,
    })),
  ].filter((item): item is HomeActivityItem => Boolean(item)).slice(0, 10);
  return (
    <View style={layout.screen}>
      <StatusBar style="light" backgroundColor={palette.primary} translucent={false} />
      <View pointerEvents="none" style={[layout.topStretchBackdrop, { height: insets.top + 280 }]} />
      <ScrollView
        style={layout.scroller}
        contentContainerStyle={layout.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        bounces={Platform.OS === 'ios'}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={[layout.orangeHero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroChrome}>
            <View style={styles.brandGroup}>
              <Image
                source={require('../../../assets/SubTrack_Assets/SubTrack_Monochrome.png')}
                style={styles.appIcon}
                contentFit="contain"
              />
              <View style={styles.brandTextBlock}>
                <Text style={layout.heroGreeting} numberOfLines={1}>Home</Text>
                <Text
                  style={layout.heroSubcopy}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  Hello, {firstName} · Financial overview
                </Text>
              </View>
            </View>
            <View style={styles.heroActions}>
              <Pressable style={layout.heroIconButton} onPress={() => router.push('/settings')}>
                <Icon source="cog-outline" size={20} color={palette.primary} />
              </Pressable>
              <NotificationBadgeButton
                count={notificationCount}
                style={layout.heroIconButton}
                onPress={() => router.push('/notifications')}
              >
                <Icon source="bell-outline" size={20} color={palette.primary} />
              </NotificationBadgeButton>
            </View>
          </View>

          <View style={layout.heroBalancePanel}>
            <Text style={layout.heroLabel}>Total Overview</Text>
            <AnimatedNumberText
              value={balance}
              formatter={formatAmount}
              style={layout.balanceAmount}
              loading={shouldShowNumberPlaceholder}
              placeholder="Loading"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
            <View style={styles.heroMetaRow}>
              <View style={layout.heroChangePill}>
                <Icon source="arrow-up" size={14} color="#FFFFFF" />
                <Text style={layout.heroChangeText}>Live balance</Text>
              </View>
              <Text style={layout.heroPeriodLabel} numberOfLines={1}>
                Current month
              </Text>
            </View>
          </View>
        </View>

        <View style={layout.content}>
          <View style={styles.summaryGrid}>
            {summaryCards.map((card, index) => (
              <View
                key={card.label}
                style={styles.summaryCardShell}
              >
                <Pressable
                  style={[
                    layout.summaryCard,
                    index === 0 && layout.summaryCardGreen,
                    index === 1 && layout.summaryCardBlue,
                    index === 2 && layout.summaryCardWarm,
                    index === 3 && layout.summaryCardAqua,
                  ]}
                  onPress={card.onPress}
                >
                  <View style={styles.summaryTopRow}>
                    <View style={layout.summaryIconBox}>
                      <MaterialGlyph name={card.icon} size={22} color={palette.primary} />
                    </View>
                    <Text style={layout.summaryLabel} numberOfLines={1}>{card.label}</Text>
                  </View>
                  <AnimatedNumberText
                    value={card.value}
                    formatter={card.formatter}
                    style={layout.summaryValue}
                    loading={shouldShowNumberPlaceholder}
                    placeholder="--"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.68}
                  />
                </Pressable>
              </View>
            ))}
          </View>

          <HomeRemoteBanner />

          <HomeNativeAd />

          <View style={layout.activitySection}>
            <View style={styles.activitySectionHeader}>
              <View style={styles.rowTextBlock}>
                <Text style={layout.sectionTitle}>Activity</Text>
                <Text style={layout.activitySectionMeta} numberOfLines={1}>Everything active in one place</Text>
              </View>
              <Pressable style={layout.viewAll} onPress={() => router.push('/notifications')}>
                <Text style={layout.viewAllText}>View all</Text>
              </Pressable>
            </View>

            <View style={styles.activityCards}>
              {isHomeHydrating && activityItems.length === 0 ? (
                <View style={layout.loadingRow}>
                  <ActivityIndicator color={palette.primary} size="small" />
                  <Text style={layout.loadingRowText}>Loading workspace</Text>
                </View>
              ) : activityItems.length === 0 ? (
                <Pressable style={layout.activityEmpty} onPress={() => router.push('/add')}>
                  <Icon source="plus-circle-outline" size={20} color={palette.primary} />
                  <Text style={layout.emptyOutlineText}>Nothing active. Add a subscription or expense.</Text>
                </Pressable>
              ) : (
                activityItems.map((item) => (
                  <View
                    key={item.id}
                  >
                    <Pressable style={layout.activityCard} onPress={() => router.push(item.route as never)}>
                      <View style={layout.activityRowIcon}>
                        {item.brandIconPath ? (
                          <BrandIcon path={item.brandIconPath} size={22} color={item.brandColor || palette.text} />
                        ) : (
                          <MaterialGlyph name={item.icon} size={21} color={palette.text} />
                        )}
                      </View>
                      <View style={styles.rowTextBlock}>
                        <Text style={layout.activityRowTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={layout.activityRowMeta} numberOfLines={1}>{item.meta}</Text>
                      </View>
                      <Text style={layout.activityRowValue} numberOfLines={1}>{item.value}</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>

          <HomeBannerAd />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  appIcon: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  brandTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  heroMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 10,
  },
  activitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  activityCards: {
    gap: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: -70,
    marginBottom: 20,
  },
  summaryCardShell: {
    width: '48%',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  upcomingScroll: {
    gap: 10,
    paddingRight: 2,
    marginBottom: 22,
  },
  upcomingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  upcomingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fallbackIcon: {
    fontSize: 17,
    fontWeight: '900',
  },
  upcomingPrice: {
    color: '#201F1B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  upcomingPlan: {
    color: '#6D675E',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  upcomingName: {
    color: '#201F1B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  subscriptionList: {
    gap: 12,
  },
  subscriptionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  rowImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  rowLetter: {
    fontSize: 21,
    fontWeight: '900',
  },
  rowTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  subscriptionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  subscriptionDate: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  rowAmountBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 118,
    minWidth: 88,
  },
  subscriptionAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    maxWidth: '100%',
  },
  subscriptionPeriod: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

function createLayout(palette: any, isCompact: boolean) {
  const softFill = palette.background;
  const visibleLine = palette.background === palette.surface ? '#E2E8F0' : palette.line;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    topStretchBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: palette.primary,
    },
    scroller: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: isCompact ? 20 : 24,
      paddingBottom: 16,
      backgroundColor: palette.primary,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 0,
    },
    headerSubtitle: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      marginTop: 2,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.32)',
    },
    scrollContent: {
      paddingTop: 0,
      paddingBottom: 126,
    },
    content: {
      paddingHorizontal: isCompact ? 20 : 24,
      backgroundColor: palette.background,
    },
    orangeHero: {
      minHeight: 250,
      paddingHorizontal: isCompact ? 20 : 24,
      paddingBottom: 86,
      paddingTop: 20,
      backgroundColor: palette.primary,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    heroGreeting: {
      color: '#FFFFFF',
      fontSize: isCompact ? 20 : 24,
      fontWeight: '900',
      letterSpacing: 0,
    },
    heroSubcopy: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    heroIconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.32)',
    },
    heroBalancePanel: {
      marginTop: 28,
      padding: 18,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.24)',
    },
    heroLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      fontWeight: '800',
    },
    heroPeriodLabel: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
      flexShrink: 1,
      textAlign: 'right',
    },
    heroChangePill: {
      minHeight: 28,
      borderRadius: 14,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.17)',
    },
    heroChangeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    balanceAmount: {
      color: '#FFFFFF',
      fontSize: isCompact ? 34 : 42,
      fontWeight: '900',
      letterSpacing: 0,
      flex: 1,
      minWidth: 0,
      fontVariant: ['tabular-nums'],
    },
    summaryCard: {
      width: '100%',
      minHeight: 112,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(31,41,55,0.07)',
      backgroundColor: palette.surface,
      padding: 14,
      justifyContent: 'space-between',
      boxShadow: '0 10px 24px rgba(15,23,42,0.10)',
    },
    summaryCardGreen: {
      backgroundColor: palette.surface,
    },
    summaryCardBlue: {
      backgroundColor: palette.surface,
    },
    summaryCardWarm: {
      backgroundColor: palette.surface,
    },
    summaryCardAqua: {
      backgroundColor: palette.surface,
    },
    summaryIconBox: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    summaryLabel: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
    },
    summaryValue: {
      color: palette.text,
      fontSize: isCompact ? 20 : 22,
      fontWeight: '900',
      letterSpacing: 0,
      marginTop: 14,
      minHeight: isCompact ? 27 : 30,
      fontVariant: ['tabular-nums'],
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
    },
    activitySection: {
      marginBottom: 22,
    },
    activitySectionMeta: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    inlineLink: {
      color: palette.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    activityCard: {
      minHeight: 72,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
    },
    activityEmpty: {
      minHeight: 58,
      borderRadius: 14,
      backgroundColor: softFill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    activityRowIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill,
      flexShrink: 0,
    },
    activityRowTitle: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '900',
    },
    activityRowMeta: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 3,
    },
    activityRowValue: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '900',
      maxWidth: 94,
      flexShrink: 0,
    },
    viewAll: {
      borderWidth: 1,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 15,
      flexShrink: 0,
    },
    viewAllText: {
      color: palette.text,
      fontSize: 11,
      fontWeight: '700',
    },
    upcomingCard: {
      width: isCompact ? 128 : 142,
      minHeight: 116,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      padding: 14,
      overflow: 'hidden',
      boxShadow: '0 6px 14px rgba(15,23,42,0.06)',
    },
    subscriptionRow: {
      position: 'relative',
      borderRadius: 24,
      minHeight: 112,
      padding: 18,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      overflow: 'hidden',
      boxShadow: '0 8px 18px rgba(15,23,42,0.07)',
    },
    subscriptionMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: visibleLine,
    },
    subscriptionMetaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 30,
      maxWidth: '100%',
      paddingHorizontal: 10,
      borderRadius: 15,
      backgroundColor: softFill,
      flexShrink: 1,
    },
    subscriptionStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 15,
      backgroundColor: softFill,
      flexShrink: 0,
    },
    subscriptionMetaText: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '800',
      minWidth: 0,
    },
    loadingRow: {
      minHeight: 56,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    loadingRowText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    emptyRow: {
      minHeight: 56,
      borderRadius: 12,
      backgroundColor: palette.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyRowText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    emptyOutlineRow: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyOutlineText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
    },
    miniTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '800',
    },
    miniMeta: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 3,
    },
    miniAmount: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '900',
      maxWidth: 96,
      flexShrink: 0,
    },
    subscriptionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      backgroundColor: softFill,
    },
  });
}
