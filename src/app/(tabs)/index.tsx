import { BrandIcon, POPULAR_APPS } from '@/components/BrandIcon';
import { HomeBannerAd } from '@/components/ads/HomeBannerAd';
import { HomeNativeAd } from '@/components/ads/HomeNativeAd';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { HomeRemoteBanner } from '@/components/messaging/HomeRemoteBanner';
import { useExpenseStore } from '@/store/useExpenseStore';
import { Invoice, useInvoiceStore } from '@/store/useInvoiceStore';
import { getPendingInvoicesTotal, getTotalMonthlySpending } from '@/utils/calculations';
import { formatDisplayDate, getRelativeRenewalLabel } from '@/utils/dates';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from 'react-native-paper';
import Animated, { FadeInDown, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TrendPeriod = 'daily' | 'monthly' | 'yearly';

const TREND_PERIODS: { key: TrendPeriod; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

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

type HomeTrendPoint = {
  total: number;
};

function createHomeTrendData(
  period: TrendPeriod,
  anchorDate: Date,
  subscriptions: {
    price: number;
    billingCycle: 'monthly' | 'yearly';
    nextBillingDate: string;
  }[],
  expenses: { amount: number; date: string }[],
  invoices: Invoice[]
): HomeTrendPoint[] {
  const monthlySubscriptions = getTotalMonthlySpending(subscriptions as any);
  const annualSubscriptions = monthlySubscriptions * 12;
  const count = period === 'daily' ? 7 : period === 'monthly' ? 6 : 5;
  const anchor = new Date(anchorDate);

  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const bucket = new Date(anchor);
    if (period === 'daily') bucket.setDate(anchor.getDate() - offset);
    if (period === 'monthly') bucket.setMonth(anchor.getMonth() - offset, 1);
    if (period === 'yearly') bucket.setFullYear(anchor.getFullYear() - offset, 0, 1);

    const matchesBucket = (rawDate?: string) => {
      if (!rawDate) return false;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return false;
      if (period === 'daily') {
        return date.getFullYear() === bucket.getFullYear()
          && date.getMonth() === bucket.getMonth()
          && date.getDate() === bucket.getDate();
      }
      if (period === 'monthly') {
        return date.getFullYear() === bucket.getFullYear() && date.getMonth() === bucket.getMonth();
      }
      return date.getFullYear() === bucket.getFullYear();
    };

    const expenseTotal = expenses
      .filter((expense) => matchesBucket(expense.date))
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const invoiceOpen = invoices
      .filter((invoice) => matchesBucket(invoice.date))
      .reduce((sum, invoice) => sum + (invoice.balanceDue ?? invoice.total ?? 0), 0);
    const renewalDueTotal = subscriptions
      .filter((subscription) => matchesBucket(subscription.nextBillingDate))
      .reduce((sum, subscription) => sum + (subscription.price || 0), 0);
    const projectedTotal = period === 'daily'
      ? renewalDueTotal
      : period === 'monthly'
        ? monthlySubscriptions
        : annualSubscriptions;
    return {
      total: projectedTotal + expenseTotal + invoiceOpen,
    };
  });
}

function HomeTrendChart({
  activeIdx,
  data,
  palette,
  period,
  anchorDate,
  onBarPress,
}: {
  activeIdx: number;
  data: HomeTrendPoint[];
  palette: any;
  period: TrendPeriod;
  anchorDate: Date;
  onBarPress: (index: number) => void;
}) {
  const maxValue = Math.max(...data.map((p) => p.total), 1);

  // Generate short period labels
  const labels = data.map((_, index) => {
    const offset = data.length - 1 - index;
    const d = new Date(anchorDate);
    if (period === 'daily') {
      d.setDate(d.getDate() - offset);
      return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
    }
    if (period === 'monthly') {
      d.setMonth(d.getMonth() - offset, 1);
      return d.toLocaleDateString('en-US', { month: 'short' });
    }
    d.setFullYear(d.getFullYear() - offset, 0, 1);
    return String(d.getFullYear()).slice(2);
  });

  const BAR_HEIGHT = 90;
  const LABEL_HEIGHT = 20;

  return (
    <View style={styles.chartWrap}>
      {/* Bar chart */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_HEIGHT, gap: 6 }}>
        {data.map((point, index) => {
          const isActive = index === activeIdx;
          const ratio = maxValue > 0 ? point.total / maxValue : 0;
          const barH = Math.max(ratio * (BAR_HEIGHT - 24), 4);
          return (
            <Pressable
              key={`${period}-bar-${labels[index]}`}
              onPress={() => onBarPress(index)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: BAR_HEIGHT }}
            >
              {/* Value label on top of active bar */}
              {isActive && point.total > 0 && (
                <View style={[styles.barValueBadge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.barValueText} numberOfLines={1}>
                    {point.total >= 1000
                      ? `${(point.total / 1000).toFixed(1)}k`
                      : Math.round(point.total).toString()}
                  </Text>
                </View>
              )}
              {isActive && point.total === 0 && (
                <View style={[styles.barValueBadge, { backgroundColor: palette.muted + '60' }]}>
                  <Text style={[styles.barValueText, { color: palette.muted }]} numberOfLines={1}>-</Text>
                </View>
              )}
              <View
                style={{
                  width: '100%',
                  height: barH,
                  borderRadius: 6,
                  backgroundColor: isActive ? palette.primary : palette.primary + '30',
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Period labels */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, height: LABEL_HEIGHT }}>
        {labels.map((label, index) => {
          const isActive = index === activeIdx;
          return (
            <Pressable key={`${period}-label-${label}`} style={{ flex: 1, alignItems: 'center' }} onPress={() => onBarPress(index)}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? '800' : '600',
                  color: isActive ? palette.text : palette.muted,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 380;
  const layout = useMemo(() => createLayout(palette, isCompact), [palette, isCompact]);
  const { upcomingRenewals, subscriptions, loadingSubscriptions } = useAppData();
  const { expenses, isLoading: loadingExpenses } = useExpenseStore();
  const { invoices, isLoading: loadingInvoices } = useInvoiceStore();
  const { formatAmount } = useCurrency();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('monthly');
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [chartActiveIdx, setChartActiveIdx] = useState<number | null>(null);
  const chartAnchorDate = useMemo(() => new Date(), []);

  const monthlySubscriptions = useMemo(() => getTotalMonthlySpending(subscriptions), [subscriptions]);
  const monthExpenses = useMemo(() => getThisMonthExpenseTotal(expenses), [expenses]);
  const invoiceTotals = useMemo(() => getInvoiceTotals(invoices), [invoices]);
  const pendingInvoices = useMemo(() => getPendingInvoicesTotal(invoices), [invoices]);
  const trendData = useMemo(
    () => createHomeTrendData(trendPeriod, chartAnchorDate, subscriptions, expenses, invoices),
    [chartAnchorDate, expenses, invoices, subscriptions, trendPeriod]
  );
  // Reset active bar when period changes
  const resolvedActiveIdx = chartActiveIdx !== null && chartActiveIdx < trendData.length
    ? chartActiveIdx
    : trendData.length - 1;

  // Balance: use tapped bar's total if a past bar is selected, else live balance
  const isCurrentBar = resolvedActiveIdx === trendData.length - 1;
  const balance = isCurrentBar
    ? monthlySubscriptions + monthExpenses + pendingInvoices
    : trendData[resolvedActiveIdx]?.total ?? 0;

  // Label shown next to "Balance" when viewing a past period
  const selectedPeriodLabel = useMemo(() => {
    if (isCurrentBar) return null;
    const offset = trendData.length - 1 - resolvedActiveIdx;
    const d = new Date(chartAnchorDate);
    if (trendPeriod === 'daily') {
      d.setDate(d.getDate() - offset);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (trendPeriod === 'monthly') {
      d.setMonth(d.getMonth() - offset, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    d.setFullYear(d.getFullYear() - offset, 0, 1);
    return String(d.getFullYear());
  }, [isCurrentBar, resolvedActiveIdx, trendData.length, trendPeriod, chartAnchorDate]);
  const upcomingPreview = upcomingRenewals.slice(0, 5);
  const subscriptionPreview = subscriptions.slice(0, 5);
  const isHomeHydrating = loadingSubscriptions || loadingExpenses || loadingInvoices;
  const activePeriod = TREND_PERIODS.find((period) => period.key === trendPeriod) ?? TREND_PERIODS[1];

  return (
    <View style={layout.screen}>
      {/* Separate header — same background as hero, sits above the scroll */}
      <Animated.View entering={FadeInDown.duration(360)} style={[layout.headerBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brandGroup}>
          <Image
            source={require('../../../assets/SubTrack_Assets/SubTrack_Icon.png')}
            style={styles.appIcon}
          />
          <View style={styles.brandTextBlock}>
            <Text style={layout.brandName} numberOfLines={1}>SubTrack</Text>
          </View>
        </View>
        <Pressable style={layout.plusButton} onPress={() => router.push('/add')}>
          <Icon source="plus" size={23} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <ScrollView
        contentContainerStyle={layout.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(380).delay(70)} style={layout.heroCard}>

          <View style={styles.heroTop}>
            <View>
              <Text style={layout.heroLabel}>Balance</Text>
              {selectedPeriodLabel && (
                <Text style={layout.heroPeriodLabel} numberOfLines={1}>{selectedPeriodLabel}</Text>
              )}
            </View>
            <View style={styles.periodMenuWrap}>
              <Pressable style={layout.periodDropdown} onPress={() => setIsPeriodMenuOpen((current) => !current)}>
                <Text style={layout.periodDropdownText}>{activePeriod.label}</Text>
                <Icon source={isPeriodMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={palette.text} />
              </Pressable>
              {isPeriodMenuOpen && (
                <View style={layout.periodMenu}>
                  {TREND_PERIODS.map((period) => (
                    <Pressable
                      key={period.key}
                      style={[layout.periodMenuItem, trendPeriod === period.key && layout.periodMenuItemActive]}
                      onPress={() => {
                        setTrendPeriod(period.key);
                        setChartActiveIdx(null);
                        setIsPeriodMenuOpen(false);
                      }}
                    >
                      <Text style={[layout.periodMenuText, trendPeriod === period.key && layout.periodMenuTextActive]}>
                        {period.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.heroAmountRow}>
            <Text
              style={layout.balanceAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatAmount(balance)}
            </Text>
          </View>

          <HomeTrendChart
            activeIdx={resolvedActiveIdx}
            data={trendData}
            palette={palette}
            period={trendPeriod}
            anchorDate={chartAnchorDate}
            onBarPress={(index) => setChartActiveIdx(index)}
          />

          <View style={layout.heroMetrics}>
            <Pressable style={styles.heroMetric} onPress={() => router.push('/subscriptions')}>
              <Text style={layout.heroMetricValue} numberOfLines={1}>{formatAmount(monthlySubscriptions)}</Text>
              <Text style={layout.heroMetricLabel} numberOfLines={1}>Subscriptions</Text>
            </Pressable>
            <View style={layout.heroDivider} />
            <Pressable style={styles.heroMetric} onPress={() => router.push('/expenses')}>
              <Text style={layout.heroMetricValue} numberOfLines={1}>{formatAmount(monthExpenses)}</Text>
              <Text style={layout.heroMetricLabel} numberOfLines={1}>Expenses</Text>
            </Pressable>
            <View style={layout.heroDivider} />
            <Pressable style={styles.heroMetric} onPress={() => router.push('/invoices')}>
              <Text style={layout.heroMetricValue} numberOfLines={1}>{formatAmount(invoiceTotals.open)}</Text>
              <Text style={layout.heroMetricLabel} numberOfLines={1}>Invoices</Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={layout.content}>
          <HomeRemoteBanner />

          <HomeNativeAd />

          {upcomingPreview.length > 0 && (
            <>
              <Animated.View entering={FadeInDown.duration(340).delay(160)} style={styles.sectionHeader}>
                <Text style={layout.sectionTitle}>Upcoming</Text>
                <Pressable style={layout.viewAll} onPress={() => router.push('/subscriptions')}>
                  <Text style={layout.viewAllText}>View all</Text>
                </Pressable>
              </Animated.View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.upcomingScroll}
              >
                {upcomingPreview.map((sub, index) => {
                  const appDef = POPULAR_APPS.find((item) => item.id === sub.icon);
                  const brandColor = sub.color && !['#FFFFFF', '#000000', '#111111'].includes(sub.color)
                    ? sub.color
                    : '#7E99FF';

                  return (
                    <Animated.View
                      key={sub.id}
                      entering={FadeInRight.duration(360).delay(60 * index)}
                      layout={LinearTransition.springify().damping(18)}
                    >
                      <Pressable
                        style={layout.upcomingCard}
                        onPress={() => router.push(`/subscription/${sub.id}`)}
                      >
                        <View style={styles.upcomingIconBox}>
                          {appDef ? (
                            <BrandIcon path={appDef.icon.path} size={30} color={brandColor} />
                          ) : sub.icon?.startsWith('http') ? (
                            <Image source={{ uri: sub.icon }} style={styles.upcomingImage} />
                          ) : (
                            <Text style={[styles.fallbackIcon, { color: palette.text }]}>
                              {sub.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.upcomingPrice, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                          {formatAmount(sub.price)}
                        </Text>
                        <Text style={[styles.upcomingPlan, { color: palette.muted }]} numberOfLines={1}>{getRelativeRenewalLabel(sub.nextBillingDate)}</Text>
                        <Text style={[styles.upcomingName, { color: palette.text }]} numberOfLines={1}>{sub.name}</Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Animated.View entering={FadeInDown.duration(340).delay(210)} style={styles.sectionHeader}>
            <Text style={layout.sectionTitle}>All subscriptions</Text>
            <Pressable style={layout.viewAll} onPress={() => router.push('/subscriptions')}>
              <Text style={layout.viewAllText}>View all</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(360).delay(250)} layout={LinearTransition} style={styles.subscriptionList}>
            {isHomeHydrating && subscriptionPreview.length === 0 ? (
              <View style={layout.loadingRow}>
                <ActivityIndicator color={palette.primary} size="small" />
                <Text style={layout.loadingRowText}>Loading subscriptions</Text>
              </View>
            ) : subscriptionPreview.length === 0 ? (
              <Pressable style={layout.emptyRow} onPress={() => router.push('/add')}>
                <Icon source="plus-circle-outline" size={22} color="#FFFFFF" />
                <Text style={layout.emptyRowText}>Add your first subscription</Text>
              </Pressable>
            ) : (
              subscriptionPreview.map((sub, index) => {
                const appDef = POPULAR_APPS.find((item) => item.id === sub.icon);
                const colors = ['#7E99FF', '#F3CF45', '#62CF73', '#FF9778', '#BBA5FF'];
                const rowColor = sub.color && !['#FFFFFF', '#000000', '#111111'].includes(sub.color)
                  ? sub.color
                  : colors[index % colors.length];

                return (
                  <Animated.View
                    key={sub.id}
                    entering={FadeInDown.duration(360).delay(60 * index)}
                    layout={LinearTransition.springify().damping(18)}
                  >
                    <Pressable
                      style={layout.subscriptionRow}
                      onPress={() => router.push(`/subscription/${sub.id}`)}
                    >
                      <View style={styles.subscriptionCardTop}>
                        <View style={styles.rowLeft}>
                          <View style={layout.subscriptionIconBox}>
                            {appDef ? (
                              <BrandIcon path={appDef.icon.path} size={24} color={rowColor || palette.text} />
                            ) : sub.icon?.startsWith('http') ? (
                              <Image source={{ uri: sub.icon }} style={styles.rowImage} />
                            ) : (
                              <Text style={[styles.rowLetter, { color: rowColor || palette.text }]}>{sub.name.charAt(0).toUpperCase()}</Text>
                            )}
                          </View>
                          <View style={styles.rowTextBlock}>
                            <Text style={[styles.subscriptionName, { color: palette.text }]} numberOfLines={1}>{sub.name}</Text>
                            <Text style={[styles.subscriptionDate, { color: palette.muted }]} numberOfLines={1}>{sub.planName || 'Standard Plan'}</Text>
                          </View>
                        </View>
                        <View style={styles.rowAmountBlock}>
                          <Text style={[styles.subscriptionAmount, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                            {formatAmount(sub.price)}
                          </Text>
                          <Text style={[styles.subscriptionPeriod, { color: palette.muted }]} numberOfLines={1}>
                            1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}
                          </Text>
                        </View>
                      </View>
                      <View style={layout.subscriptionMetaRow}>
                        <View style={layout.subscriptionMetaPill}>
                          <Icon source="calendar-clock" size={14} color={palette.muted} />
                          <Text style={layout.subscriptionMetaText} numberOfLines={1}>{formatDisplayDate(sub.nextBillingDate)}</Text>
                        </View>
                        <View style={layout.subscriptionMetaPill}>
                          <Icon
                            source={sub.billingCycle === 'monthly' ? 'calendar-month-outline' : 'calendar-range-outline'}
                            size={14}
                            color={palette.muted}
                          />
                          <Text style={layout.subscriptionMetaText} numberOfLines={1}>
                            {sub.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                          </Text>
                        </View>
                        <View style={layout.subscriptionStatusPill}>
                          <View style={[styles.statusDot, { backgroundColor: sub.status === 'paused' ? palette.warning : palette.success }]} />
                          <Text style={layout.subscriptionMetaText} numberOfLines={1}>{sub.status === 'paused' ? 'Paused' : 'Active'}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>

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
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
  },
  brandTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 30,
  },
  heroAmountRow: {
    marginTop: 10,
    flexDirection: 'row',
    minWidth: 0,
  },
  chartWrap: {
    marginTop: 16,
    marginBottom: 4,
  },
  barValueBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    alignSelf: 'center',
  },
  barValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroMetric: {
    flex: 1,
    minWidth: 0,
  },
  periodMenuWrap: {
    position: 'relative',
    zIndex: 40,
    flexShrink: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 10,
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
  const softSurface = palette.surface;
  const softFill = palette.background;
  const visibleLine = palette.background === palette.surface ? '#E2E8F0' : palette.line;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.surface,
    },
    headerBar: {
      backgroundColor: softSurface,
      paddingHorizontal: isCompact ? 20 : 24,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scrollContent: {
      paddingTop: 0,
      paddingBottom: 126,
    },
    content: {
      paddingHorizontal: isCompact ? 20 : 24,
    },
    brandName: {
      color: palette.text,
      fontSize: 22,
      fontWeight: '800',
    },
    plusButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
      flexShrink: 0,
    },
    heroCard: {
      backgroundColor: softSurface,
      paddingHorizontal: isCompact ? 20 : 24,
      paddingTop: 4,
      paddingBottom: 18,
      marginBottom: 24,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: visibleLine,
      boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
      zIndex: 4,
    },
    heroLabel: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700',
    },
    heroPeriodLabel: {
      color: palette.primary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    periodDropdown: {
      minWidth: 104,
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      flexShrink: 0,
      zIndex: 30,
    },
    periodDropdownText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '800',
    },
    periodMenu: {
      position: 'absolute',
      top: 40,
      right: 0,
      width: 132,
      borderRadius: 16,
      padding: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: visibleLine,
      backgroundColor: palette.surface,
      boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
      zIndex: 40,
    },
    periodMenuItem: {
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    periodMenuItemActive: {
      backgroundColor: softFill,
    },
    periodMenuText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    periodMenuTextActive: {
      color: palette.text,
    },
    balanceAmount: {
      color: palette.text,
      fontSize: isCompact ? 34 : 38,
      fontWeight: '900',
      letterSpacing: 0,
      flex: 1,
      minWidth: 0,
    },
    heroMetrics: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: visibleLine,
    },
    heroDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: visibleLine,
    },
    heroMetricValue: {
      color: palette.text,
      fontSize: isCompact ? 12 : 13,
      fontWeight: '800',
      letterSpacing: 0,
    },
    heroMetricLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 3,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
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
