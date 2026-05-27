import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Platform, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/contexts/theme';
import { formatDisplayDate, getEffectiveNextBillingDate, parseIsoDate } from '@/utils/dates';
import { useAppData } from '@/contexts/app-data';
import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { useCurrency } from '@/contexts/currency';
import * as Haptics from 'expo-haptics';

export default function SubscriptionDetailScreen() {
  "use no memo";

  const { palette } = useTheme();
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
    // get reminder date helper inline
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

  useEffect(() => {
    const d = getReminderDate();
    setReminderDateStr(d.toISOString().split('T')[0]);
  }, [sub?.reminderCustomDate, getReminderDate]);

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

  const yearlyCost = sub.billingCycle === 'monthly' ? sub.price * 12 : sub.price;
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable 
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Icon source="chevron-left" size={28} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Details</Text>
        <Pressable 
          style={styles.editBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/edit/${sub.id}`);
          }}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: brandColor }]}>
          <View style={styles.heroTop}>
            <View style={styles.logoBox}>
              {appDef ? (
                <BrandIcon path={appDef.icon.path} size={32} color={brandColor} />
              ) : sub.icon?.startsWith('http') ? (
                <Image source={{ uri: sub.icon }} style={{ width: 48, height: 48, borderRadius: 12, resizeMode: 'cover' }} />
              ) : (
                <Text style={[styles.logoText, { color: brandColor }]}>{sub.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, isPaused && { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.statusText}>{isPaused ? 'Paused' : 'Active'}</Text>
            </View>
          </View>
          
          <View style={styles.heroMiddle}>
          <Text style={styles.serviceName} numberOfLines={2}>{sub.name}</Text>
          <Text style={styles.planName} numberOfLines={1}>{sub.planName || 'Standard Plan'}</Text>
          </View>

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.priceLabel}>Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.price} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                <Text style={styles.billingCycle}>/{sub.billingCycle === 'monthly' ? 'mo' : 'yr'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceLabel}>Next Payment</Text>
              <Text style={styles.nextDateHero} numberOfLines={1}>{formatDisplayDate(sub.nextBillingDate)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/edit/${sub.id}`); }}>
            <View style={styles.actionIconBox}>
              <Icon source="pencil" size={22} color={palette.text} />
            </View>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={togglePause}>
            <View style={styles.actionIconBox}>
              <Icon source={isPaused ? "play" : "pause"} size={22} color={palette.text} />
            </View>
            <Text style={styles.actionText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            removeSubscription(sub.id);
            router.back();
          }}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Icon source="trash-can-outline" size={22} color="#EF4444" />
            </View>
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
          </Pressable>
        </View>

        {/* Statistics Section */}
        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Icon source="chart-line" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statLabel}>Yearly Projection</Text>
            <Text style={styles.statValue}>{formatAmount(yearlyCost)}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Icon source="calendar-check" size={20} color="#10B981" />
            </View>
            <Text style={styles.statLabel}>Cycle</Text>
            <Text style={styles.statValue}>{sub.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
          </View>
        </View>

        {/* Details & Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.detailsList}>
          {/* Smart Reminders */}
          <View style={[styles.listItem, (showReminderInfo || remindersEnabled) && { borderBottomWidth: 0 }]}>
            <View style={styles.listLeft}>
              <View style={[styles.listIconBox, { backgroundColor: palette.cardYellow }]}>
                <Icon source="bell-ring-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.listLabel} numberOfLines={1}>Smart Reminders</Text>
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
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: remindersEnabled ? 0 : 1, borderBottomColor: palette.line }}>
              <Text style={{ fontSize: 13, color: palette.muted, lineHeight: 18 }}>
                Smart Reminders will send you a push notification before this subscription renews, ensuring you have time to cancel if needed.
              </Text>
            </View>
          )}

          {remindersEnabled && (
            <>
              {Platform.OS === 'web' ? (
                <View style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: palette.line }]}>
                  <View style={styles.listLeft}>
                    <View style={[styles.listIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                      <Icon source="calendar-clock" size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.listLabel} numberOfLines={1}>Remind me on</Text>
                  </View>
                  <TextInput
                    value={reminderDateStr}
                    onChangeText={handleReminderDateStrChange}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.muted}
                    style={{
                      fontSize: 15,
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
                    style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: palette.line }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <View style={styles.listLeft}>
                      <View style={[styles.listIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Icon source="calendar-clock" size={20} color="#3B82F6" />
                      </View>
                      <Text style={styles.listLabel} numberOfLines={1}>Remind me on</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.listValue} numberOfLines={1}>
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
                    textColor={palette.text} // respects dark mode
                  />
                </>
              )}
            </>
          )}

          {/* Payment method */}
          <View style={styles.listItem}>
            <View style={styles.listLeft}>
              <View style={[styles.listIconBox, { backgroundColor: palette.cardTeal }]}>
                <Icon source="credit-card-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.listLabel} numberOfLines={1}>Payment Method</Text>
            </View>
            <View style={styles.paymentMethodRight}>
              <Text style={styles.listValue} numberOfLines={1}>{sub.notes || 'Default Card'}</Text>
              <View style={styles.mcCardBox}>
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
              <View style={[styles.listIconBox, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }]}>
                <Icon source="fingerprint" size={20} color={palette.muted} />
              </View>
              <Text style={styles.listLabel} numberOfLines={1}>Subscription ID</Text>
            </View>
            <Text style={[styles.listValue, { color: palette.muted, fontSize: 13 }]} numberOfLines={1}>{sub.id.substring(0, 10)}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: palette.surface,
    borderRadius: 16,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  heroCard: {
    borderRadius: 32,
    padding: 24,
    marginTop: 8,
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 8px 16px -4px rgba(0,0,0,0.1)',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  heroMiddle: {
    marginTop: 32,
    marginBottom: 32,
  },
  serviceName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planName: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 20,
    gap: 16,
  },
  priceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 4,
  },
  price: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  billingCycle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  nextDateHero: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 138,
    textAlign: 'right',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  detailsList: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  listIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  listValue: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.text,
    flexShrink: 1,
    minWidth: 0,
  },
  reminderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: palette.surface,
  },
  reminderChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentMethodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  mcCardBox: {
    width: 36,
    height: 22,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mcCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 18,
    marginRight: 6,
  },
  mcCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
});
