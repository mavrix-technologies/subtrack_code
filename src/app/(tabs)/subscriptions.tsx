import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Icon } from 'react-native-paper';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { Subscription } from '@/types/subscription';
import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { InlineNativeAd } from '@/components/ads/InlineNativeAd';
import {
  getEffectiveNextBillingDate,
  formatDisplayDate,
  getRelativeRenewalLabel,
} from '@/utils/dates';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function firstWeekday(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}

function getBillingISO(sub: Subscription, year: number, month: number): string | null {
  const iso = getEffectiveNextBillingDate(sub, new Date(year, month, 1));
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  if (y === year && m === month + 1) return iso;
  return null;
}

function getPaymentMethod(notes?: string) {
  const trimmed = notes?.trim();
  if (!trimmed) return 'Not set';
  return trimmed.replace(/^Payment Method:\s*/i, '');
}

// ── Main Screen ───────────────────────────────────────────────────────────────

// react-doctor-disable-next-line react-doctor/no-giant-component
export default function SubscriptionsScreen() {
  const { palette } = useTheme();
  const { subscriptions, removeSubscription } = useAppData();
  const { formatAmount } = useCurrency();

  const now = new Date();
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => todayISO());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = todayISO();
  const totalDays = daysInMonth(year, month);
  const startOffset = firstWeekday(year, month);

  const s = useMemo(() => createStyles(palette), [palette]);

  // Map ISO → subscriptions due that day
  const eventMap = useMemo(() => {
    const map: Record<string, Subscription[]> = {};
    for (const sub of subscriptions) {
      if (sub.status === 'paused') continue;
      const iso = getBillingISO(sub, year, month);
      if (!iso) continue;
      if (!map[iso]) map[iso] = [];
      map[iso].push(sub);
    }
    return map;
  }, [subscriptions, year, month]);

  const selectedSubs = selectedDate ? (eventMap[selectedDate] ?? []) : [];

  const goToPrev = useCallback(() => {
    Haptics.selectionAsync();
    if (month === 0) {
      setYear(y => y - 1);
      setMonth(11);
    } else {
      setMonth(m => m - 1);
    }
    setSelectedDate(null);
  }, [month]);

  const goToNext = useCallback(() => {
    Haptics.selectionAsync();
    if (month === 11) {
      setYear(y => y + 1);
      setMonth(0);
    } else {
      setMonth(m => m + 1);
    }
    setSelectedDate(null);
  }, [month]);

  const handleDayPress = useCallback((iso: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(iso);
  }, []);

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [startOffset, totalDays]);

  // Month totals
  const monthTotal = useMemo(() =>
    Object.values(eventMap).flat().reduce((sum, s) => sum + s.price, 0),
    [eventMap]
  );

  return (
    <View style={[s.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Subtitle / Stats Row ── */}
        <View style={s.metaRow}>
          <Text style={[s.metaTitle, { color: palette.text }]}>Upcoming</Text>
          <Text style={[s.metaCount, { color: palette.muted }]}>
            {Object.values(eventMap).flat().length} Total
          </Text>
        </View>

        {/* ── Calendar Card (Shadcn UI style) ── */}
        <View style={s.calendarCard}>
          {/* Header Row */}
          <View style={s.calendarHeader}>
            <Pressable onPress={goToPrev} style={s.navBtn} hitSlop={8}>
              <Icon source="chevron-left" size={22} color={palette.text} />
            </Pressable>

            <View style={s.titleBlock}>
              <Text style={[s.monthTitle, { color: palette.text }]}>
                {MONTH_NAMES[month]} {year}
              </Text>
            </View>

            <Pressable onPress={goToNext} style={s.navBtn} hitSlop={8}>
              <Icon source="chevron-right" size={22} color={palette.text} />
            </Pressable>
          </View>

          {/* Weekday Labels */}
          <View style={s.weekRow}>
            {SHORT_DAYS.map((d, i) => (
              <Text
                key={i}
                style={[
                  s.weekDayLabel,
                  { color: palette.muted },
                ]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={s.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={s.cell} />;
              const iso = toISO(year, month, day);
              const daySubs = eventMap[iso] ?? [];
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const hasSubs = daySubs.length > 0;

              return (
                <Pressable
                  key={iso}
                  style={s.cell}
                  onPress={() => handleDayPress(iso)}
                >
                  <View style={[
                    s.dayCircle,
                    isSelected && { backgroundColor: palette.primary },
                    isToday && !isSelected && { backgroundColor: palette.line },
                  ]}>
                    <Text style={[
                      s.dayNum,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isToday
                          ? palette.text
                          : palette.text,
                        fontWeight: (isToday || isSelected) ? '700' : '500',
                      },
                      !hasSubs && !isSelected && !isToday && { opacity: 0.4 },
                    ]}>
                      {day}
                    </Text>
                  </View>

                  {/* Single Clean Subscription Dot underneath number */}
                  {hasSubs && (
                    <View style={s.dots}>
                      <View
                        style={[
                          s.dot,
                          {
                            backgroundColor: isSelected
                              ? '#FFFFFF'
                              : daySubs[0].color && !['#FFFFFF', '#000000', '#111111'].includes(daySubs[0].color)
                              ? daySubs[0].color
                              : palette.primary,
                          }
                        ]}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Selected Day Renewals (Inline) ── */}
        <View style={s.selectedDaySection}>
          {selectedDate && (
            <>
              {selectedSubs.length > 0 ? (
                <View style={s.selectedSubsList}>
                  <Text style={[s.sectionSubtitle, { color: palette.text }]}>
                    Due on {new Date(
                      parseInt(selectedDate.split('-')[0]),
                      parseInt(selectedDate.split('-')[1]) - 1,
                      parseInt(selectedDate.split('-')[2])
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {selectedSubs.map((sub) => (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      palette={palette}
                      formatAmount={formatAmount}
                      onPress={() => router.push(`/subscription/${sub.id}`)}
                    />
                  ))}
                </View>
              ) : (
                <View style={[s.emptyStateCard, { backgroundColor: palette.success + '0A', borderColor: palette.success + '22' }]}>
                  <View style={s.emptyStateTextContainer}>
                    <Text style={[s.emptyStateTitle, { color: palette.text }]}>You have nothing due now.</Text>
                    <Text style={[s.emptyStateSubtitle, { color: palette.muted }]}>You have nothing to do in a while.</Text>
                  </View>
                  <View style={[s.emptyStateIconContainer, { backgroundColor: palette.success + '18' }]}>
                    <Icon source="wallet-outline" size={22} color={palette.success} />
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── All Subscriptions List (Active & Paused) ── */}
        <View style={s.listSection}>
          <View style={s.listHeaderRow}>
            <Text style={[s.sectionTitle, { color: palette.text }]}>All Subscriptions</Text>
            {monthTotal > 0 && (
              <View style={[s.summaryPill, { backgroundColor: palette.primary + '12' }]}>
                <Text style={[s.summaryText, { color: palette.primary }]}>
                  {formatAmount(monthTotal)}/mo
                </Text>
              </View>
            )}
          </View>

          {subscriptions.length === 0 ? (
            <Text style={{ textAlign: 'center', color: palette.muted, marginTop: 20 }}>
              No subscriptions yet. Add one!
            </Text>
          ) : (
            subscriptions.map((sub, index) => {
              const isExpanded = expandedId === sub.id;
              const appDef = POPULAR_APPS.find(a => a.id === sub.icon);
              const accentColor =
                sub.color && sub.color !== '#FFFFFF' && sub.color !== '#000000' && sub.color !== '#111111'
                  ? sub.color
                  : palette.primary;
              const isPaused = sub.status === 'paused';

              return (
                <React.Fragment key={sub.id}>
                  <Animated.View layout={Layout.duration(300)} style={{ overflow: 'hidden', borderRadius: 12, marginBottom: 12 }}>
                    {isExpanded ? (
                      <Pressable style={[s.expandedCard, { borderLeftColor: accentColor }]} onPress={() => setExpandedId(null)}>
                        <View style={s.expandedTop}>
                          <View style={s.cardLeft}>
                            <View style={[s.expandedIconBox, { borderColor: `${accentColor}55` }]}>
                              {appDef ? (
                                <BrandIcon path={appDef.icon.path} size={24} color={accentColor} />
                              ) : sub.icon?.startsWith('http') ? (
                                <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                              ) : (
                                <Text style={[s.expandedIconLetter, { color: accentColor }]}>{sub.name.charAt(0).toUpperCase()}</Text>
                              )}
                            </View>
                            <View style={s.cardTextBlock}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[s.expandedTitle, { color: palette.text }]} numberOfLines={1}>{sub.name}</Text>
                                {isPaused && (
                                  <View style={s.pausedBadge}>
                                    <Text style={s.pausedText}>Paused</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[s.expandedSubtitle, { color: palette.muted }]} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                            </View>
                          </View>
                          <View style={s.cardRight}>
                            <Text style={[s.expandedPrice, { color: palette.text }]} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                            <Text style={[s.expandedSubtitle, { color: palette.muted }]}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                          </View>
                        </View>

                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                          <View style={s.detailsBlock}>
                            <View style={s.detailRow}>
                              <Text style={[s.detailLabel, { color: palette.muted }]}>Payment info</Text>
                              <View style={s.detailValueRow}>
                                <Text style={[s.detailValue, { color: palette.text }]}>{getPaymentMethod(sub.notes)}</Text>
                                <Pressable style={[s.actionBtn, { borderColor: accentColor }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                                  <Text style={[s.actionBtnText, { color: accentColor }]}>Manage</Text>
                                </Pressable>
                              </View>
                            </View>
                            <View style={s.detailRow}>
                              <Text style={[s.detailLabel, { color: palette.muted }]}>Plan details</Text>
                              <View style={s.detailValueRow}>
                                <Text style={[s.detailValue, { color: palette.text }]}>{sub.planName || 'Standard'}</Text>
                                <Pressable style={[s.actionBtn, { borderColor: accentColor }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                                  <Text style={[s.actionBtnText, { color: accentColor }]}>Change</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>

                          <Pressable style={s.cancelBtn} onPress={(e) => { e.stopPropagation(); removeSubscription(sub.id); }}>
                            <Text style={[s.cancelBtnText, { color: palette.danger }]}>Cancel subscription</Text>
                          </Pressable>
                        </Animated.View>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[s.card, { borderLeftColor: accentColor }, isPaused && { opacity: 0.6 }]}
                        onPress={() => setExpandedId(sub.id)}
                      >
                        <View style={s.cardLeft}>
                          <View style={[s.iconBox, { borderColor: `${accentColor}44` }]}>
                            {appDef ? (
                              <BrandIcon path={appDef.icon.path} size={24} color={accentColor} />
                            ) : sub.icon?.startsWith('http') ? (
                              <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                            ) : (
                              <Text style={[s.normalIconLetter, { color: accentColor }]}>
                                {sub.name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={s.cardTextBlock}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[s.cardTitle, { color: palette.text }]} numberOfLines={1}>{sub.name || 'Subscription'}</Text>
                              {isPaused && (
                                <View style={s.pausedBadge}>
                                  <Text style={s.pausedText}>Paused</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.cardSubtitle, { color: palette.muted }]} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                          </View>
                        </View>
                        <View style={s.cardRight}>
                          <Text style={[s.cardPrice, { color: palette.text }]} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                          <Text style={[s.cardDuration, { color: palette.muted }]}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                        </View>
                      </Pressable>
                    )}
                  </Animated.View>
                  {index === 3 && subscriptions.length > 4 ? <InlineNativeAd style={s.listAd} /> : null}
                </React.Fragment>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub Row Component ──

function SubRow({
  sub,
  palette,
  formatAmount,
  onPress,
}: {
  sub: Subscription;
  palette: ReturnType<typeof useTheme>['palette'];
  formatAmount: (n: number) => string;
  onPress: () => void;
}) {
  const appDef = POPULAR_APPS.find((a) => a.id === sub.icon);
  const brandColor =
    sub.color && !['#FFFFFF', '#000000', '#111111'].includes(sub.color)
      ? sub.color
      : appDef?.icon.hex
      ? `#${appDef.icon.hex}`
      : palette.primary;

  const nextISO = getEffectiveNextBillingDate(sub);
  const relLabel = getRelativeRenewalLabel(nextISO);

  const sr = useMemo(() => createSubRowStyles(palette), [palette]);

  return (
    <Pressable
      style={[sr.row, { backgroundColor: palette.surface, borderColor: palette.line }]}
      onPress={onPress}
    >
      {/* Icon */}
      <View style={[sr.iconBox, { backgroundColor: brandColor + '18' }]}>
        {appDef ? (
          <BrandIcon path={appDef.icon.path} size={20} color={brandColor} />
        ) : (
          <Text style={[sr.iconLetter, { color: brandColor }]}>
            {sub.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={sr.info}>
        <Text style={[sr.name, { color: palette.text }]} numberOfLines={1}>{sub.name}</Text>
        <Text style={[sr.date, { color: palette.muted }]} numberOfLines={1}>
          {formatDisplayDate(nextISO)}
        </Text>
      </View>

      {/* Right */}
      <View style={sr.right}>
        <Text style={[sr.amount, { color: palette.text }]}>
          {formatAmount(sub.price)}
        </Text>
        <View style={[sr.badge, {
          backgroundColor:
            relLabel === 'Today' ? palette.danger + '20' :
            relLabel === 'Tomorrow' ? palette.warning + '20' :
            palette.primary + '15',
        }]}>
          <Text style={[sr.badgeText, {
            color:
              relLabel === 'Today' ? palette.danger :
              relLabel === 'Tomorrow' ? palette.warning :
              palette.primary,
          }]}>
            {relLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ──

const createStyles = (palette: any) =>
  StyleSheet.create({
    screen: { flex: 1 },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 12,
    },
    metaTitle: {
      fontSize: 20,
      fontWeight: '800',
    },
    metaCount: {
      fontSize: 14,
      fontWeight: '600',
    },
    calendarCard: {
      backgroundColor: palette.surface,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.line,
      marginBottom: 20,
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.02)',
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBlock: {
      alignItems: 'center',
    },
    monthTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: palette.line + '44',
      paddingBottom: 8,
    },
    weekDayLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: '14.2857%',
      alignItems: 'center',
      justifyContent: 'center',
      aspectRatio: 1,
      marginVertical: 2,
    },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNum: {
      fontSize: 14,
      fontWeight: '500',
    },
    dots: {
      position: 'absolute',
      bottom: 2,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    selectedDaySection: {
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    selectedSubsList: {
      gap: 12,
    },
    sectionSubtitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptyStateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
    },
    emptyStateTextContainer: {
      flex: 1,
      marginRight: 16,
      gap: 2,
    },
    emptyStateTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    emptyStateSubtitle: {
      fontSize: 13,
      fontWeight: '500',
    },
    emptyStateIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listSection: {
      marginTop: 8,
      paddingHorizontal: 4,
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    summaryPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    summaryText: {
      fontSize: 12,
      fontWeight: '700',
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
    },
    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,
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
    },
    cardDuration: {
      fontSize: 13,
      lineHeight: 18,
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
    },
    expandedTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    expandedSubtitle: {
      fontSize: 14,
      marginTop: 2,
    },
    expandedPrice: {
      fontSize: 18,
      fontWeight: 'bold',
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
      flex: 1,
      minWidth: 0,
    },
    actionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      flexShrink: 0,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '700',
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
      fontSize: 15,
      fontWeight: '700',
    },
    pausedBadge: {
      backgroundColor: '#F59E0B20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    pausedText: {
      color: '#F59E0B',
      fontSize: 10,
      fontWeight: '800',
    },
    listAd: {
      marginBottom: 12,
    },
  });

const createSubRowStyles = (palette: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconLetter: {
      fontSize: 18,
      fontWeight: '800',
    },
    info: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
    },
    date: {
      fontSize: 12,
      fontWeight: '500',
    },
    right: {
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
    },
    amount: {
      fontSize: 15,
      fontWeight: '800',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
