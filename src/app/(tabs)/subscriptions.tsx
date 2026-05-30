import { InlineNativeAd } from '@/components/ads/InlineNativeAd';
import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { getMonthlyEquivalent } from '@/utils/calculations';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from 'react-native-paper';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

function getPaymentMethod(notes?: string) {
  const trimmed = notes?.trim();
  if (!trimmed) return 'Not set';
  return trimmed.replace(/^Payment Method:\s*/i, '');
}

export default function SubscriptionsScreen() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { subscriptions, removeSubscription } = useAppData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatAmount } = useCurrency();
  const monthlyTotal = subscriptions.reduce((sum, sub) => sum + getMonthlyEquivalent(sub), 0);
  const monthlySubscriptions = subscriptions.filter((sub) => sub.billingCycle === 'monthly').length;
  const report = {
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    monthlySubscriptions,
    yearlySubscriptions: subscriptions.length - monthlySubscriptions,
    average: subscriptions.length > 0 ? monthlyTotal / subscriptions.length : 0,
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subscriptions.length > 0 && (
          <View style={styles.reportPanel}>
            <View style={styles.reportHeader}>
              <View style={styles.reportHeading}>
                <Text style={styles.reportTitle}>Subscription report</Text>
                <Text style={styles.reportSub}>Clean monthly overview</Text>
              </View>
              <Icon source="chart-donut" size={22} color={palette.primary} />
            </View>

            <View style={styles.reportHero}>
              <View style={styles.reportTotalBox}>
                <Text style={styles.reportTotalLabel}>Monthly total</Text>
                <Text style={styles.reportTotal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {formatAmount(report.monthlyTotal)}
                </Text>
              </View>
              <View style={styles.reportCycleBadge}>
                <Text style={styles.reportCycleText}>{subscriptions.length} active</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Icon source="calendar-sync-outline" size={18} color={palette.primary} />
                <Text style={styles.metricLabel}>Yearly run rate</Text>
                <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(report.yearlyTotal)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Icon source="calculator-variant-outline" size={18} color={palette.primary} />
                <Text style={styles.metricLabel}>Average</Text>
                <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(report.average)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Icon source="calendar-range-outline" size={18} color={palette.primary} />
                <Text style={styles.metricLabel}>Billing mix</Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {report.monthlySubscriptions}M / {report.yearlySubscriptions}Y
                </Text>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    paddingTop: 8,
  },
  reportPanel: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 20,
    gap: 16,
  },
  listAd: {
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  reportHeading: {
    flex: 1,
    minWidth: 0,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.text,
  },
  reportSub: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    marginTop: 3,
  },
  reportHero: {
    borderRadius: 20,
    backgroundColor: palette.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
    overflow: 'hidden',
  },
  reportTotalBox: {
    flex: 1,
    minWidth: 0,
  },
  reportTotalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.78)',
  },
  reportTotal: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0,
    marginTop: 4,
  },
  reportCycleBadge: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  reportCycleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 12,
    minHeight: 92,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.muted,
    marginTop: 6,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: 0,
  },
  reportSection: {
    gap: 10,
  },
  reportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  barRow: {
    gap: 7,
    position: 'relative',
    paddingRight: 92,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    flexShrink: 0,
  },
  barLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    color: palette.text,
    textTransform: 'capitalize',
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.primary,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  renewalList: {
    gap: 10,
  },
  renewalRow: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: palette.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  renewalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  renewalTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  renewalInitial: {
    fontSize: 17,
    fontWeight: '900',
  },
  renewalName: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
  },
  renewalDate: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    marginTop: 3,
  },
  renewalAmountBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 102,
  },
  renewalAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: palette.text,
  },
  renewalMonthly: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.muted,
    marginTop: 3,
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
