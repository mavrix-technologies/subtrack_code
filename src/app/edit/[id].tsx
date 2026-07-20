import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { Subscription } from '@/types/subscription';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAYMENT_METHOD_OPTIONS = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Wallet',
  'Google Pay',
  'Apple Pay',
  'PayPal',
  'Cash',
  'Other',
];

function dateToInputValue(value?: string) {
  if (!value) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
  return parsed.toISOString().split('T')[0];
}

function getPaymentMethodIcon(method: string) {
  const lower = method.toLowerCase();
  if (lower.includes('upi') || lower.includes('google')) return 'qrcode-scan';
  if (lower.includes('card') || lower.includes('••••')) return 'credit-card-outline';
  if (lower.includes('bank')) return 'bank-outline';
  if (lower.includes('wallet')) return 'wallet-outline';
  if (lower.includes('apple')) return 'apple';
  if (lower.includes('paypal')) return 'alpha-p-circle-outline';
  if (lower.includes('cash')) return 'cash';
  return 'dots-horizontal-circle-outline';
}

function getPaymentMethod(notes?: string) {
  if (!notes) return 'UPI';
  return notes.replace(/^Payment Method:\s*/i, '').trim() || 'UPI';
}

function getBaseInput(subscription: Subscription) {
  return {
    name: subscription.name,
    price: subscription.price,
    billingCycle: subscription.billingCycle,
    nextBillingDate: subscription.nextBillingDate,
    category: subscription.category,
    icon: subscription.icon,
    color: subscription.color,
    planName: subscription.planName,
    notes: subscription.notes,
    startedOn: subscription.startedOn,
    lastUsedAt: subscription.lastUsedAt,
    yearlyPrice: subscription.yearlyPrice,
    status: subscription.status,
    reminderDays: subscription.reminderDays,
    remindersEnabled: subscription.remindersEnabled,
    reminderCustomDate: subscription.reminderCustomDate,
  };
}

export default function EditScreen() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { subscriptions } = useAppData();

  const sub = subscriptions.find((item) => item.id === id);

  if (!sub) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>Subscription not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary, fontSize: 16 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return <EditSubscriptionForm key={sub.id} sub={sub} />;
}

// react-doctor-disable-next-line react-doctor/no-giant-component
function EditSubscriptionForm({ sub }: { sub: Subscription }) {
  const { palette } = useTheme();
  const { currency } = useCurrency();
  const styles = createStyles(palette);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const { saveSubscription, removeSubscription } = useAppData();
  const initialDate = dateToInputValue(sub.nextBillingDate);
  const [name, setName] = useState(() => sub.name);
  const [price, setPrice] = useState(() => String(sub.price));
  const [billingCycle, setBillingCycle] = useState<'Monthly' | 'Yearly'>(() =>
    sub.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'
  );
  const [paymentDate, setPaymentDate] = useState(() => new Date(initialDate));
  const [paymentDateStr, setPaymentDateStr] = useState(() => initialDate);
  const [planDetails, setPlanDetails] = useState(() => sub.planName || '');
  const [paymentMethod, setPaymentMethod] = useState(() => getPaymentMethod(sub.notes));
  const [selectedAppId, setSelectedAppId] = useState<string>(() => sub.icon || 'generic');
  const [selectedColor, setSelectedColor] = useState(() => sub.color || palette.primary);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [billingMenuVisible, setBillingMenuVisible] = useState(false);
  const [planMenuVisible, setPlanMenuVisible] = useState(false);
  const [paymentMenuVisible, setPaymentMenuVisible] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedApp = POPULAR_APPS.find((app) => app.id === selectedAppId);

  const handlePaymentDateStrChange = (val: string) => {
    setPaymentDateStr(val);
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) setPaymentDate(parsed);
  };

  const handleSaveSubscription = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsedPrice = Number(price.replace(/,/g, ''));
    const parsedDate = new Date(paymentDateStr);

    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a subscription name.');
      return;
    }
    if (!price.trim() || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price greater than 0.');
      return;
    }
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Invalid date', 'Please enter a valid next payment date.');
      return;
    }

    setSaving(true);
    try {
      await saveSubscription(sub.id, {
        ...getBaseInput(sub),
        name: name.trim(),
        price: parsedPrice,
        billingCycle: billingCycle === 'Yearly' ? 'yearly' : 'monthly',
        nextBillingDate: paymentDateStr,
        icon: selectedAppId,
        color: selectedColor,
        planName: planDetails.trim() || undefined,
        notes: paymentMethod ? `Payment Method: ${paymentMethod}` : undefined,
        yearlyPrice:
          billingCycle === 'Yearly' ? parsedPrice : sub.yearlyPrice ?? parsedPrice * 12,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Failed to save subscription changes.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeleteSubscription = () => {
    if (!sub) return;
    Alert.alert('Delete subscription?', `Remove ${sub.name} from your subscriptions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeSubscription(sub.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.replace('/subscriptions');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Icon source="chevron-left" size={28} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Subscription</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.logoContainer}>
          <Pressable style={[styles.logoBox, { backgroundColor: selectedColor }]} onPress={() => setModalVisible(true)}>
            {selectedApp ? (
              <BrandIcon path={selectedApp.icon.path} size={38} color="#FFFFFF" />
            ) : selectedAppId.startsWith('http') ? (
              <Image source={{ uri: selectedAppId }} style={{ width: 52, height: 52, borderRadius: 12, resizeMode: 'contain' }} />
            ) : (
              <Text style={styles.logoText}>{name.charAt(0).toUpperCase() || '?'}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setModalVisible(true)}>
            <Text style={styles.changeLogoText}>Change logo</Text>
          </Pressable>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Name</Text>
            </View>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} />
          </View>

          <View style={[styles.row, compact && styles.rowStack]}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Price</Text>
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <TextInput style={styles.priceInput} value={price} onChangeText={setPrice} keyboardType="numeric" />
              </View>
            </View>

            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Billing cycle</Text>
              </View>
              <Pressable
                style={[styles.selectContainer, billingMenuVisible && styles.openSelect]}
                onPress={() => {
                  Keyboard.dismiss();
                  setBillingMenuVisible((visible) => !visible);
                }}
              >
                <Text style={styles.selectText}>{billingCycle}</Text>
                <Icon source={billingMenuVisible ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {billingMenuVisible && (
                <View style={styles.inlineDropdown}>
                  {(['Monthly', 'Yearly'] as const).map((opt, index, arr) => (
                    <Pressable
                      key={opt}
                      style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => {
                        setBillingCycle(opt);
                        setBillingMenuVisible(false);
                      }}
                    >
                      <Text style={[styles.inlineDropdownText, billingCycle === opt && { color: palette.primary, fontWeight: '600' }]}>{opt}</Text>
                      {billingCycle === opt && <Icon source="check" size={18} color={palette.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Next payment date</Text>
            </View>
            {Platform.OS === 'web' ? (
              <View style={[styles.selectContainer, { paddingHorizontal: 0 }]}>
                <TextInput
                  value={paymentDateStr}
                  onChangeText={handlePaymentDateStrChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  style={styles.webDateInput as any}
                />
                <View style={{ marginRight: 16 }}>
                  <Icon source="calendar-month-outline" size={20} color={palette.muted} />
                </View>
              </View>
            ) : (
              <>
                <Pressable style={styles.selectContainer} onPress={() => setShowDatePicker((visible) => !visible)}>
                  <Text style={styles.selectText} numberOfLines={1}>
                    {paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>
                  <Icon source="calendar-month-outline" size={20} color={palette.muted} />
                </Pressable>
                {showDatePicker && (
                  <View style={styles.datePickerWrap}>
                    <DateTimePicker
                      value={paymentDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(_, date) => {
                        if (Platform.OS === 'android') setShowDatePicker(false);
                        if (date) {
                          setPaymentDate(date);
                          setPaymentDateStr(date.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Plan details</Text>
            </View>
            <Pressable
              style={[styles.selectContainer, planMenuVisible && styles.openSelect]}
              onPress={() => {
                Keyboard.dismiss();
                setPlanMenuVisible((visible) => !visible);
              }}
            >
              <Text style={styles.selectText}>{planDetails || 'Standard'}</Text>
              <Icon source={planMenuVisible ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
            </Pressable>
            {planMenuVisible && (
              <View style={styles.inlineDropdown}>
                {['Basic', 'Standard', 'Premium', 'Family', 'Student'].map((opt, index, arr) => (
                  <Pressable
                    key={opt}
                    style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setPlanDetails(opt);
                      setPlanMenuVisible(false);
                    }}
                  >
                    <Text style={[styles.inlineDropdownText, (planDetails || 'Standard') === opt && { color: palette.primary, fontWeight: '600' }]}>{opt}</Text>
                    {(planDetails || 'Standard') === opt && <Icon source="check" size={18} color={palette.primary} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View>
            <Pressable
              style={[styles.paymentMethodCard, paymentMenuVisible && styles.openSelect]}
              onPress={() => {
                Keyboard.dismiss();
                setPaymentMenuVisible((visible) => !visible);
              }}
            >
              <Text style={styles.paymentMethodTitle} numberOfLines={1}>Payment method</Text>
              <View style={styles.paymentMethodRight}>
                <View style={styles.cardPreview}>
                  <Icon source={getPaymentMethodIcon(paymentMethod)} size={16} color={palette.primary} />
                  <Text style={styles.cardNumber} numberOfLines={1}>{paymentMethod}</Text>
                </View>
                <Icon source={paymentMenuVisible ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </View>
            </Pressable>
            {paymentMenuVisible && (
              <View style={styles.inlineDropdown}>
                {PAYMENT_METHOD_OPTIONS.map((opt, index, arr) => (
                  <Pressable
                    key={opt}
                    style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setPaymentMethod(opt);
                      setPaymentMenuVisible(false);
                    }}
                  >
                    <View style={styles.dropdownOptionLeft}>
                      <Icon source={getPaymentMethodIcon(opt)} size={18} color={paymentMethod === opt ? palette.primary : palette.muted} />
                      <Text style={[styles.inlineDropdownText, paymentMethod === opt && { color: palette.primary, fontWeight: '600' }]}>{opt}</Text>
                    </View>
                    {paymentMethod === opt && <Icon source="check" size={18} color={palette.primary} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Pressable style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSaveSubscription} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeleteSubscription}>
            <Text style={styles.deleteButtonText}>Delete subscription</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.sheetTitle}>Choose an App</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.appGrid}>
              {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
              {POPULAR_APPS.map((app) => {
                const bgColor = app.icon.hex === '000000' || app.icon.hex === '111111' ? '#1A202C' : `#${app.icon.hex}`;
                const isSelected = selectedAppId === app.id;
                return (
                  <Pressable
                    key={app.id}
                    style={({ pressed }) => [styles.appGridItem, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSelectedAppId(app.id);
                      setSelectedColor(bgColor);
                      if (!name.trim()) setName(app.name);
                      setModalVisible(false);
                    }}
                  >
                    <View style={[styles.appIconBox, { backgroundColor: bgColor }, isSelected && styles.appIconBoxSelected]}>
                      <BrandIcon path={app.icon.path} color="#FFFFFF" size={30} />
                      {isSelected && (
                        <View style={styles.appIconCheck}>
                          <Icon source="check-circle" size={18} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.appName, isSelected && { color: palette.primary, fontWeight: '700' }]} numberOfLines={1}>{app.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  changeLogoText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  formContainer: {
    gap: 20,
  },
  inputWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  labelContainer: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    color: palette.muted,
  },
  textInput: {
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowStack: {
    flexDirection: 'column',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  openSelect: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectText: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  webDateInput: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
    paddingHorizontal: 16,
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  datePickerWrap: {
    marginTop: 8,
    backgroundColor: palette.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  inlineDropdown: {
    backgroundColor: palette.surface,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    borderTopWidth: 0,
    marginTop: -1,
  },
  inlineDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  inlineDropdownText: {
    fontSize: 16,
    color: palette.text,
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  paymentMethodTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  paymentMethodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.text,
    maxWidth: 120,
  },
  actionButtons: {
    marginTop: 32,
    gap: 16,
  },
  saveButton: {
    height: 56,
    backgroundColor: palette.navBackground,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '78%',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalIndicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: palette.line,
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 40,
  },
  appGridItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  appIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
    overflow: 'hidden',
    boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
  },
  appIconBoxSelected: {
    boxShadow: '0 0 0 3px ' + palette.primary,
  },
  appIconCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  appName: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
  },
});
