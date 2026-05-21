import { InlineNativeAd } from '@/components/ads/InlineNativeAd';
import { BrandIcon, POPULAR_APPS } from '@/components/BrandIcon';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { getCategoryBreakdown, getMonthlyEquivalent, getUpcomingRenewals } from '@/utils/calculations';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from 'react-native-paper';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getPaymentMethod(notes?: string) {
  const trimmed = notes?.trim();
  if (!trimmed) return 'Not set';
  return trimmed.replace(/^Payment Method:\s*/i, '');
}

export default function SubscriptionsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { subscriptions, removeSubscription } = useAppData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatAmount } = useCurrency();
  const report = useMemo(() => {
    const monthlyTotal = subscriptions.reduce((sum, sub) => sum + getMonthlyEquivalent(sub), 0);
    const yearlyTotal = monthlyTotal * 12;
    const categoryBreakdown = getCategoryBreakdown(subscriptions).slice(0, 5);
    const upcoming = getUpcomingRenewals(subscriptions).slice(0, 4).map((sub) => {
      const date = new Date(sub.nextBillingDate);
      return {
        id: sub.id,
        name: sub.name,
        amount: getMonthlyEquivalent(sub),
        label: Number.isNaN(date.getTime())
          ? 'No date'
          : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      };
    });
    return { monthlyTotal, yearlyTotal, categoryBreakdown, upcoming };
  }, [subscriptions]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Subscriptions</Text>
          <Text style={styles.subtitle}>{subscriptions.length} active</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/add')}
        >
          <Icon source="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subscriptions.length > 0 && (
          <View style={styles.reportPanel}>
            <View style={styles.reportHeader}>
              <View>
                <Text style={styles.reportTitle}>Subscription report</Text>
                <Text style={styles.reportSub}>Monthly and category spend</Text>
              </View>
              <View style={styles.reportTotalBox}>
                <Text style={styles.reportTotalLabel}>Monthly</Text>
                <Text style={styles.reportTotal}>{formatAmount(report.monthlyTotal)}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Yearly run rate</Text>
                <Text style={styles.metricValue}>{formatAmount(report.yearlyTotal)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Average</Text>
                <Text style={styles.metricValue}>{formatAmount(report.monthlyTotal / subscriptions.length)}</Text>
              </View>
            </View>

            <View style={styles.chartBlock}>
              <Text style={styles.chartTitle}>By category</Text>
              {report.categoryBreakdown.map((item) => (
                <View key={item.category} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{item.category}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(6, item.percentage)}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{item.percentage}%</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartBlock}>
              <Text style={styles.chartTitle}>Upcoming renewals</Text>
              <View style={styles.renewalGraph}>
                {report.upcoming.map((item) => {
                  const maxAmount = Math.max(...report.upcoming.map((r) => r.amount), 1);
                  const height = 24 + Math.round((item.amount / maxAmount) * 54);
                  return (
                    <View key={item.id} style={styles.renewalColumn}>
                      <View style={[styles.renewalBar, { height }]} />
                      <Text style={styles.renewalName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.renewalDate}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {subscriptions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: palette.muted, marginTop: 40 }}>No subscriptions yet. Add one!</Text>
        ) : (
          subscriptions.map((sub, index) => {
            const isExpanded = expandedId === sub.id;
            const appDef = POPULAR_APPS.find(a => a.id === sub.icon);
            const accentColor =
              sub.color && sub.color !== '#FFFFFF' && sub.color !== '#000000' && sub.color !== '#111111'
                ? sub.color
                : palette.primary;
            
            return (
              <React.Fragment key={sub.id}>
                <Animated.View layout={Layout.duration(300)} style={{ overflow: 'hidden', borderRadius: 12, marginBottom: 12 }}>
                  {isExpanded ? (
                    <Pressable style={[styles.expandedCard, { borderLeftColor: accentColor }]} onPress={() => setExpandedId(null)}>
                      <View style={styles.expandedTop}>
                        <View style={styles.cardLeft}>
                          <View style={[styles.expandedIconBox, { borderColor: `${accentColor}55` }]}>
                            {appDef ? (
                              <BrandIcon path={appDef.icon.path} size={24} color={accentColor} />
                            ) : sub.icon?.startsWith('http') ? (
                              <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                            ) : (
                              <Text style={[styles.expandedIconLetter, { color: accentColor }]}>{sub.name.charAt(0).toUpperCase()}</Text>
                            )}
                          </View>
                          <View style={styles.cardTextBlock}>
                            <Text style={styles.expandedTitle} numberOfLines={1}>{sub.name}</Text>
                            <Text style={styles.expandedSubtitle} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                          </View>
                        </View>
                        <View style={styles.cardRight}>
                          <Text style={styles.expandedPrice} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                          <Text style={styles.expandedSubtitle}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                        </View>
                      </View>

                      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                        <View style={styles.detailsBlock}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Payment info</Text>
                            <View style={styles.detailValueRow}>
                              <Text style={styles.detailValue}>{getPaymentMethod(sub.notes)}</Text>
                              <Pressable style={[styles.actionBtn, { borderColor: accentColor }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                                <Text style={[styles.actionBtnText, { color: accentColor }]}>Manage</Text>
                              </Pressable>
                            </View>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Plan details</Text>
                            <View style={styles.detailValueRow}>
                              <Text style={styles.detailValue}>{sub.planName || 'Standard'}</Text>
                              <Pressable style={[styles.actionBtn, { borderColor: accentColor }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                                <Text style={[styles.actionBtnText, { color: accentColor }]}>Change</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        <Pressable style={styles.cancelBtn} onPress={(e) => { e.stopPropagation(); removeSubscription(sub.id); }}>
                          <Text style={styles.cancelBtnText}>Cancel subscription</Text>
                        </Pressable>
                      </Animated.View>
                    </Pressable>
                  ) : (
                    <Pressable 
                      style={[styles.card, { borderLeftColor: accentColor }]}
                      onPress={() => setExpandedId(sub.id)}
                    >
                      <View style={styles.cardLeft}>
                        <View style={[styles.iconBox, { borderColor: `${accentColor}44` }]}>
                          {appDef ? (
                            <BrandIcon path={appDef.icon.path} size={24} color={accentColor} />
                          ) : sub.icon?.startsWith('http') ? (
                            <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                          ) : (
                            <Text style={[styles.normalIconLetter, { color: accentColor }]}>
                              {sub.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.cardTextBlock}>
                          <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{sub.name || 'Subscription'}</Text>
                          <Text style={[styles.cardSubtitle, { color: palette.muted }]} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                        </View>
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={[styles.cardPrice, { color: palette.text }]} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                        <Text style={[styles.cardDuration, { color: palette.muted }]}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                      </View>
                    </Pressable>
                  )}
                </Animated.View>
                {index === 3 && subscriptions.length > 4 ? <InlineNativeAd style={styles.listAd} /> : null}
              </React.Fragment>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    paddingTop: 8,
  },
  reportPanel: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    marginBottom: 18,
  },
  listAd: {
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  reportTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  reportSub: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginTop: 3,
  },
  reportTotalBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  reportTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
  },
  reportTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.primary,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 12,
    backgroundColor: palette.background,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    marginTop: 5,
  },
  chartBlock: {
    marginTop: 16,
    gap: 10,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 86,
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  barValue: {
    width: 36,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: palette.text,
  },
  renewalGraph: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  renewalColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  renewalBar: {
    width: '72%',
    maxWidth: 28,
    borderRadius: 7,
    backgroundColor: palette.primary,
  },
  renewalName: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.text,
    maxWidth: '100%',
  },
  renewalDate: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.muted,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 16,
    minHeight: 82,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 4,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  cardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  normalIconLetter: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    marginLeft: 12,
    maxWidth: 116,
  },
  cardPrice: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 'bold',
    color: palette.text,
  },
  cardDuration: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.muted,
    marginTop: 2,
  },
  expandedCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 4,
  },
  expandedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  expandedIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedIconLetter: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.primary,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
  },
  expandedSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 2,
  },
  expandedPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
  },
  detailsBlock: {
    gap: 10,
    marginBottom: 14,
  },
  detailRow: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: palette.muted,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: palette.text,
    flex: 1,
    minWidth: 0,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary,
    flexShrink: 0,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },
  cancelBtn: {
    backgroundColor: palette.background,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  cancelBtnText: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
