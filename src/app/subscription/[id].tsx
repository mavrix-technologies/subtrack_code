import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Platform, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconButton, Chip, Text, Switch, Divider, Button } from 'react-native-paper';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/contexts/theme';
import { formatDisplayDate, getEffectiveNextBillingDate, parseIsoDate } from '@/utils/dates';
import { useAppData } from '@/contexts/app-data';
import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { useCurrency } from '@/contexts/currency';
import * as Haptics from 'expo-haptics';

// ── Ordinal Suffix Helper ──
function getOrdinalSuffix(day: number) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

// ── Dynamic Billing Day Description ──
function getRenewalDayLabel(nextBillingDate: string, billingCycle: string) {
  if (!nextBillingDate) return 'Subscription renewal';
  const parts = nextBillingDate.split('-');
  if (parts.length < 3) return 'Subscription renewal';
  const day = parseInt(parts[2], 10);
  if (isNaN(day)) return 'Subscription renewal';
  
  if (billingCycle === 'monthly') {
    return `Subscription on every ${day}${getOrdinalSuffix(day)}`;
  } else {
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, day);
    const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
    return `Subscription every year on ${monthStr} ${day}${getOrdinalSuffix(day)}`;
  }
}

// ── Timeline Generator ──
const getTimelineData = (sub: any) => {
  const nextIso = getEffectiveNextBillingDate(sub);
  const nextDate = parseIsoDate(nextIso) || new Date();
  const dates = [];
  
  for (let i = -4; i <= 0; i++) {
    const d = new Date(nextDate);
    if (sub.billingCycle === 'monthly') {
      d.setMonth(d.getMonth() + i);
    } else {
      d.setFullYear(d.getFullYear() + i);
    }
    dates.push({
      date: d,
      isFuture: i === 0,
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      year: d.getFullYear().toString(),
    });
  }
  return dates;
};

// ── Simulated Recent Transactions Generator ──
const getRecentTransactions = (sub: any) => {
  const nextIso = getEffectiveNextBillingDate(sub);
  const nextDate = parseIsoDate(nextIso) || new Date();
  const list = [];
  
  for (let i = 1; i <= 3; i++) {
    const d = new Date(nextDate);
    if (sub.billingCycle === 'monthly') {
      d.setMonth(d.getMonth() - i);
    } else {
      d.setFullYear(d.getFullYear() - i);
    }
    list.push({
      id: `${sub.id}-tx-${i}`,
      dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      price: sub.price,
    });
  }
  return list;
};

export default function SubscriptionDetailScreen() {
  "use no memo";

  const { palette, theme } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { subscriptions, removeSubscription, saveSubscription } = useAppData();
  const { formatAmount } = useCurrency();
  const [showReminderInfo, setShowReminderInfo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const sub = subscriptions.find(s => s.id === id);

  const [reminderDateStr, setReminderDateStr] = useState(() => {
    if (!sub) return new Date().toISOString().split('T')[0];
    const getReminderDateVal = () => {
      if (sub.reminderCustomDate) {
        return new Date(sub.reminderCustomDate);
      }
      const nextIso = getEffectiveNextBillingDate(sub);
      const nextDate = parseIsoDate(nextIso);
      if (!nextDate) return new Date();
      const daysBefore = sub.reminderDays ?? 3;
      const reminderDate = new Date(nextDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      return reminderDate;
    };
    return getReminderDateVal().toISOString().split('T')[0];
  });
  const [prevSubId, setPrevSubId] = useState(sub?.id);
  const [prevReminderCustomDate, setPrevReminderCustomDate] = useState(sub?.reminderCustomDate);

  const appDef = sub ? POPULAR_APPS.find((a: any) => a.id === sub.icon) : null;

  const getReminderDate = useCallback(() => {
    if (!sub) return new Date();
    if (sub.reminderCustomDate) {
      return new Date(sub.reminderCustomDate);
    }
    const nextIso = getEffectiveNextBillingDate(sub);
    const nextDate = parseIsoDate(nextIso);
    if (!nextDate) return new Date();
    const daysBefore = sub.reminderDays ?? 3;
    const reminderDate = new Date(nextDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    return reminderDate;
  }, [sub]);

  if (sub?.id !== prevSubId || sub?.reminderCustomDate !== prevReminderCustomDate) {
    setPrevSubId(sub?.id);
    setPrevReminderCustomDate(sub?.reminderCustomDate);
    const d = getReminderDate();
    setReminderDateStr(d.toISOString().split('T')[0]);
  }

  if (!sub) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: palette.text }}>Subscription not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: palette.primary, fontSize: 16 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  let brandColor = sub.color;
  if (!brandColor || brandColor === '#FFFFFF' || brandColor === '#000000' || brandColor === '#111111') {
    brandColor = palette.primary; 
  }

  const isPaused = sub.status === 'paused';
  const remindersEnabled = sub.remindersEnabled ?? true;

  const handleReminderDateStrChange = (val: string) => {
    setReminderDateStr(val);
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      updateSubData({ reminderCustomDate: parsed.toISOString() });
    }
  };

  const updateSubData = async (updates: Partial<typeof sub>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { id: _, userId: __, createdAt: ___, updatedAt: ____, currency: _____, ...inputData } = sub;
    await saveSubscription(sub.id, { ...inputData, ...updates });
  };

  const togglePause = async () => {
    await updateSubData({ status: isPaused ? 'active' : 'paused' });
  };

  const categoryLabel = sub.category
    ? sub.category.charAt(0).toUpperCase() + sub.category.slice(1)
    : 'Utilities';

  const timelineSteps = getTimelineData(sub);
  const recentTransactions = getRecentTransactions(sub);

  const topBgColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.45)' : brandColor + '12';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Unified Top Hero Block (matching mockup) */}
        <View style={[styles.topBlock, { backgroundColor: topBgColor, paddingTop: Math.max(insets.top, 12) }]}>
          {/* Header Row */}
          <View style={styles.header}>
            <IconButton 
              icon="chevron-left" 
              iconColor={palette.text} 
              size={24}
              onPress={() => router.back()}
              style={styles.backBtn}
            />
            <Text style={[styles.headerTitle, { color: palette.text }]}>Subscription Detail</Text>
            <IconButton 
              icon="pencil" 
              iconColor={palette.text} 
              size={20}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/edit/${sub.id}`);
              }}
              style={styles.editBtn}
            />
          </View>

          {/* Branding Content */}
          <View style={styles.brandingSection}>
            <View style={styles.logoContainer}>
              {appDef ? (
                <BrandIcon path={appDef.icon.path} size={36} color={brandColor} />
              ) : sub.icon?.startsWith('http') ? (
                <Image source={{ uri: sub.icon }} style={{ width: 52, height: 52, borderRadius: 26, resizeMode: 'cover' }} />
              ) : (
                <Text style={[styles.logoLetter, { color: brandColor }]}>{sub.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            
            <Text 
              variant="labelMedium" 
              style={[styles.statusText, { color: isPaused ? palette.warning : palette.success }]}
            >
              Status: {isPaused ? 'Paused' : 'Active'}
            </Text>
            
            <Text 
              variant="headlineSmall" 
              style={[styles.serviceName, { color: palette.text }]} 
              numberOfLines={2}
            >
              {sub.name}
            </Text>
            
            <Text 
              variant="bodyMedium" 
              style={[styles.renewalDayText, { color: palette.muted }]}
            >
              {getRenewalDayLabel(sub.nextBillingDate, sub.billingCycle)}
            </Text>
            
            <Chip
              icon={appDef ? 'tag-outline' : 'cog-outline'}
              style={[styles.categoryChip, { backgroundColor: brandColor + '15' }]}
              textStyle={{ color: brandColor, fontWeight: '700', fontSize: 12 }}
              compact
              mode="flat"
            >
              {categoryLabel}
            </Chip>
          </View>
        </View>

        {/* Content Section (standard clean list layout) */}
        <View style={styles.contentCard}>
          
          {/* Centered Next Payment block (no box outline, clean and open) */}
          <View style={styles.nextPaymentSection}>
            <Text variant="labelMedium" style={[styles.nextPaymentLabel, { color: palette.muted }]}>
              Next Payment
            </Text>
            <Text variant="displayLarge" style={[styles.nextPaymentPrice, { color: palette.text }]}>
              -{formatAmount(sub.price)}
            </Text>
            <Text variant="bodyMedium" style={[styles.nextPaymentDate, { color: palette.muted }]}>
              Expected around <Text style={[styles.expectedDateHighlight, { color: palette.success }]}>{formatDisplayDate(sub.nextBillingDate)}</Text>
            </Text>
          </View>

          {/* Connected Billing Timeline */}
          <View style={styles.timelineContainer}>
            <View style={styles.timelineRow}>
              {/* Leftmost leading line */}
              <View style={[styles.timelineFlexLine, { backgroundColor: brandColor, width: 24 }]} />
              
              {timelineSteps.map((step, idx) => {
                const dotColor = step.isFuture ? (theme === 'dark' ? '#475569' : '#CBD5E1') : brandColor;
                const nextStepIsFuture = idx < timelineSteps.length - 1 && timelineSteps[idx + 1].isFuture;
                
                return (
                  <React.Fragment key={idx}>
                    {/* The Dot */}
                    <View style={[
                      styles.timelineDot,
                      {
                        borderColor: dotColor,
                        backgroundColor: step.isFuture ? palette.background : '#FFFFFF',
                        borderWidth: step.isFuture ? 2.5 : 3.5,
                        borderStyle: step.isFuture ? 'dashed' : 'solid',
                      }
                    ]} />
                    
                    {/* The Line segment following the dot */}
                    {idx < timelineSteps.length - 1 ? (
                      nextStepIsFuture ? (
                        <View 
                          style={[
                            styles.timelineFlexLineDashed, 
                            { 
                              borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                            }
                          ]} 
                        />
                      ) : (
                        <View 
                          style={[
                            styles.timelineFlexLine, 
                            { 
                              backgroundColor: brandColor,
                            }
                          ]} 
                        />
                      )
                    ) : (
                      /* Rightmost trailing line */
                      <View 
                        style={[
                          styles.timelineFlexLineDashed, 
                          { 
                            borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                            width: 24,
                          }
                        ]} 
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Labels Row (aligned perfectly under each dot) */}
            <View style={styles.labelsRow}>
              {timelineSteps.map((step, idx) => (
                <View key={idx} style={styles.labelColumn}>
                  <Text variant="bodySmall" style={[styles.timelineLabel, { color: palette.text }]} numberOfLines={1}>
                    {step.month}
                  </Text>
                  <Text variant="bodySmall" style={[styles.timelineYear, { color: palette.muted }]}>
                    {step.year}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Spent Highlights Insight */}
          <View style={styles.insightRow}>
            <Icon source="lightbulb-on-outline" size={20} color={palette.muted} />
            <Text variant="bodyMedium" style={[styles.insightText, { color: palette.muted }]}>
              You've spent {formatAmount(sub.price * (sub.billingCycle === 'monthly' ? 5 : 1))} over 5 billing cycles on this vendor.
            </Text>
          </View>

          {/* Recent Transactions List */}
          <View style={styles.transactionsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: palette.text }]}>
                Recent Transactions ({recentTransactions.length})
              </Text>
              <Pressable hitSlop={8}>
                <Text style={[styles.seeAllLink, { color: brandColor }]}>See All</Text>
              </Pressable>
            </View>
            
            <View>
              {recentTransactions.map((tx) => (
                <View key={tx.id} style={[styles.txRow, { borderColor: palette.line }]}>
                  <View style={[styles.txLogoBox, { backgroundColor: brandColor + '12' }]}>
                    {appDef ? (
                      <BrandIcon path={appDef.icon.path} size={18} color={brandColor} />
                    ) : (
                      <Text variant="titleMedium" style={[styles.txLetter, { color: brandColor }]}>
                        {sub.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text variant="bodyMedium" style={[styles.txName, { color: palette.text }]} numberOfLines={1}>
                      {sub.name}
                    </Text>
                    <Text variant="bodySmall" style={[styles.txMeta, { color: palette.muted }]}>
                      {sub.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} · {tx.dateStr}
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={[styles.txPrice, { color: palette.text }]}>
                    {formatAmount(tx.price)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Settings Section */}
          <Text variant="titleMedium" style={[styles.settingsTitle, { color: palette.text }]}>
            Subscription Settings
          </Text>
          
          <View style={styles.detailsList}>
            {/* Smart Reminders Row */}
            <View style={[styles.listItem, (showReminderInfo || remindersEnabled) && { borderBottomWidth: 0 }]}>
              <View style={styles.listLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Icon source="bell-ring-outline" size={20} color="#F59E0B" />
                </View>
                <Text variant="bodyMedium" style={[styles.listLabel, { color: palette.text }]} numberOfLines={1}>
                  Smart Reminders
                </Text>
                <Pressable onPress={() => setShowReminderInfo(!showReminderInfo)} style={{ padding: 4 }}>
                  <Icon source="information-outline" size={16} color={palette.muted} />
                </Pressable>
              </View>
              <Switch 
                value={remindersEnabled} 
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  updateSubData({ remindersEnabled: val });
                }}
                trackColor={{ false: palette.line, true: palette.primary }}
              />
            </View>
            
            {showReminderInfo && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, backgroundColor: palette.surface, borderBottomWidth: remindersEnabled ? 0 : StyleSheet.hairlineWidth, borderBottomColor: palette.line }}>
                <Text variant="bodySmall" style={{ color: palette.muted, lineHeight: 18 }}>
                  Smart Reminders will send you a push notification before this subscription renews, ensuring you have time to cancel if needed.
                </Text>
              </View>
            )}

            {remindersEnabled && (
              <>
                {Platform.OS === 'web' ? (
                  <View style={[styles.listItem, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }]}>
                    <View style={styles.listLeft}>
                      <View style={[styles.listIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Icon source="calendar-clock" size={20} color="#3B82F6" />
                      </View>
                      <Text variant="bodyMedium" style={[styles.listLabel, { color: palette.text }]} numberOfLines={1}>
                        Remind me on
                      </Text>
                    </View>
                    <TextInput
                      value={reminderDateStr}
                      onChangeText={handleReminderDateStrChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={palette.muted}
                      style={{
                        fontSize: 14,
                        color: palette.text,
                        textAlign: 'right',
                        minWidth: 100,
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        outlineStyle: 'none',
                      } as any}
                    />
                  </View>
                ) : (
                  <>
                    <Pressable 
                      style={[styles.listItem, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <View style={styles.listLeft}>
                        <View style={[styles.listIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                          <Icon source="calendar-clock" size={20} color="#3B82F6" />
                        </View>
                        <Text variant="bodyMedium" style={[styles.listLabel, { color: palette.text }]} numberOfLines={1}>
                          Remind me on
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text variant="bodyMedium" style={[styles.listValue, { color: palette.text }]} numberOfLines={1}>
                          {getReminderDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <Icon source="chevron-right" size={20} color={palette.muted} />
                      </View>
                    </Pressable>
                    
                    <DateTimePickerModal
                      isVisible={showDatePicker}
                      mode="date"
                      date={getReminderDate()}
                      onConfirm={(selectedDate) => {
                        setShowDatePicker(false);
                        updateSubData({ reminderCustomDate: selectedDate.toISOString() });
                      }}
                      onCancel={() => setShowDatePicker(false)}
                      textColor={palette.text}
                    />
                  </>
                )}
              </>
            )}

            {/* Payment Method */}
            <View style={styles.listItem}>
              <View style={styles.listLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Icon source="credit-card-outline" size={20} color="#10B981" />
                </View>
                <Text variant="bodyMedium" style={[styles.listLabel, { color: palette.text }]} numberOfLines={1}>
                  Payment Method
                </Text>
              </View>
              <View style={styles.paymentMethodRight}>
                <Text variant="bodyMedium" style={[styles.listValue, { color: palette.text }]} numberOfLines={1}>
                  {sub.notes || 'Default Card'}
                </Text>
                <View style={[styles.mcCardBox, { borderColor: palette.line }]}>
                  <View style={styles.mcCircles}>
                    <View style={[styles.mcCircle, { backgroundColor: '#EF4444', right: -6 }]} />
                    <View style={[styles.mcCircle, { backgroundColor: '#F59E0B' }]} />
                  </View>
                </View>
              </View>
            </View>

            {/* Subscription ID */}
            <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
              <View style={styles.listLeft}>
                <View style={[styles.listIconBox, { backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line }]}>
                  <Icon source="fingerprint" size={20} color={palette.muted} />
                </View>
                <Text variant="bodyMedium" style={[styles.listLabel, { color: palette.text }]} numberOfLines={1}>
                  Subscription ID
                </Text>
              </View>
              <Text variant="bodyMedium" style={[styles.listValue, { color: palette.muted, fontSize: 13 }]} numberOfLines={1}>
                {sub.id.substring(0, 10)}
              </Text>
            </View>
          </View>

          {/* Quick Actions (Pause/Delete) styled as native Material outlined buttons */}
          <View style={styles.quickActions}>
            <Button
              mode="outlined"
              icon={isPaused ? "play" : "pause"}
              onPress={togglePause}
              textColor={palette.text}
              style={{ borderColor: palette.line, borderRadius: 12, flex: 1 }}
              labelStyle={{ fontWeight: '700', fontSize: 13 }}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              mode="outlined"
              icon="trash-can-outline"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                removeSubscription(sub.id);
                router.back();
              }}
              textColor="#EF4444"
              style={{ borderColor: '#EF4444' + '40', borderRadius: 12, flex: 1 }}
              labelStyle={{ fontWeight: '700', fontSize: 13 }}
            >
              Delete
            </Button>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topBlock: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 48,
  },
  backBtn: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  editBtn: {
    margin: 0,
  },
  brandingSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 10,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  logoLetter: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statusText: {
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 12,
  },
  serviceName: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  renewalDayText: {
    fontWeight: '500',
    marginBottom: 12,
  },
  categoryChip: {
    borderRadius: 16,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCard: {
    padding: 20,
  },
  nextPaymentSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  nextPaymentLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextPaymentPrice: {
    fontWeight: '800',
  },
  nextPaymentDate: {
    fontWeight: '500',
    marginTop: 4,
  },
  expectedDateHighlight: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  timelineContainer: {
    marginVertical: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineFlexLine: {
    flex: 1,
    height: 3,
  },
  timelineFlexLineDashed: {
    flex: 1,
    height: 3,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    marginTop: 8,
  },
  labelColumn: {
    alignItems: 'center',
    width: 50,
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  timelineYear: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginVertical: 12,
    justifyContent: 'center',
  },
  insightText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  transactionsSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  txName: {
    fontSize: 14,
    fontWeight: '700',
  },
  txMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  txPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 24,
    marginBottom: 32,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailsList: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  listIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  listValue: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  paymentMethodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  mcCardBox: {
    width: 32,
    height: 20,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mcCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 16,
    marginRight: 4,
  },
  mcCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
  },
});
