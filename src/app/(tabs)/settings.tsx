import { useAppData } from '@/contexts/app-data';
import { CURRENCIES, CurrencyOption, useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import {
  deleteSignedInUserDataAndAccount,
  exportUserData,
  openStoreReview,
  sendDataDeletionRequest,
  sendSupportRequest,
} from '@/services/accountData';
import { sendTestNotification } from '@/services/notifications';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useInvoiceStore } from '@/store/useInvoiceStore';
import { useSplitFriendStore } from '@/store/useSplitFriendStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { palette, theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const {
    user,
    subscriptions,
    upcomingRenewals,
    signOut,
    status,
    error,
    loadingSubscriptions,
    notificationsEnabled,
    setNotificationsEnabled,
    refreshNotifications,
  } = useAppData();
  const expenses = useExpenseStore((state) => state.expenses);
  const expensesLoading = useExpenseStore((state) => state.isLoading);
  const invoices = useInvoiceStore((state) => state.invoices);
  const invoicesLoading = useInvoiceStore((state) => state.isLoading);
  const friends = useSplitFriendStore((state) => state.friends);
  const friendsLoading = useSplitFriendStore((state) => state.isLoading);
  const styles = useMemo(() => createStyles(palette, theme === 'dark'), [palette, theme]);
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAccountBusy, setIsAccountBusy] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyOption>(currency);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  // Check support and load current setting
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);

      const stored = await AsyncStorage.getItem('biometric_lock_enabled');
      if (stored === 'true') {
        setBiometricEnabled(true);
      }
    })();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    Haptics.selectionAsync();
    if (value) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
      });
      if (!auth.success) return; // user cancelled or failed
    }
    setBiometricEnabled(value);
    await AsyncStorage.setItem('biometric_lock_enabled', value ? 'true' : 'false');
  };

  // Derive initials for avatar fallback
  const initials = useMemo(() => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [user?.name]);

  // Pick the next upcoming subscription as the test target, fallback to first
  const testSub = upcomingRenewals[0] ?? subscriptions[0] ?? null;
  const isSyncing = status === 'booting' || loadingSubscriptions || expensesLoading || invoicesLoading || friendsLoading;
  const dataCounts = `${subscriptions.length} subs • ${expenses.length} expenses • ${invoices.length} invoices • ${friends.length} friends`;

  const openLegalPage = (page: 'privacy' | 'terms' | 'contact') => {
    Haptics.selectionAsync();
    router.push(`/legal/${page}`);
  };

  const openCurrencyPicker = () => {
    Haptics.selectionAsync();
    if (Platform.OS === 'ios') {
      // iOS: ActionSheet with currency options
      const options = CURRENCIES.map(c => `${c.flag}  ${c.code} – ${c.name}`);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...options],
          cancelButtonIndex: 0,
          title: 'Select Currency',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setCurrency(CURRENCIES[buttonIndex - 1]);
          }
        }
      );
    } else {
      // Android: show native picker modal
      setPendingCurrency(currency);
      setCurrencyPickerOpen(true);
    }
  };

  const confirmCurrencyPicker = () => {
    setCurrency(pendingCurrency);
    setCurrencyPickerOpen(false);
  };

  const explainNotifications = (nextValue: boolean) => {
    Haptics.selectionAsync();
    if (!nextValue) {
      setNotificationsEnabled(false);
      return;
    }

    Alert.alert(
      'Enable renewal reminders?',
      'SubTrack uses notifications to remind you before subscriptions renew. You can turn them off anytime.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            setNotificationsEnabled(true);
            try {
              await refreshNotifications();
              Alert.alert('Reminders enabled', 'We will remind you before upcoming renewals.');
            } catch (err: any) {
              Alert.alert('Notifications unavailable', err?.message ?? 'Could not enable reminders.');
            }
          },
        },
      ]
    );
  };

  const dismissCurrencyPicker = () => {
    setCurrencyPickerOpen(false);
  };

  const testNotification = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!testSub) {
      Alert.alert('No Subscriptions', 'Add at least one subscription to test the alert.');
      return;
    }
    try {
      setIsSendingTest(true);
      await sendTestNotification(testSub);
      Alert.alert(
        'Alert Sent',
        `A test renewal notification for "${testSub.name}" will appear in ~2 seconds.\n\nMake sure sound is on!`,
        [{ text: 'Got it', style: 'default' }]
      );
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Could not send notification.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Sign Out'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Sign Out',
          message: 'Are you sure you want to sign out?',
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            setIsSigningOut(true);
            try {
              await signOut();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not sign out.');
              setIsSigningOut(false);
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              setIsSigningOut(true);
              try {
                await signOut();
              } catch (err: any) {
                Alert.alert('Error', err?.message ?? 'Could not sign out.');
                setIsSigningOut(false);
              }
            },
          },
        ]
      );
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsAccountBusy(true);
    try {
      await exportUserData(user);
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not export your data.');
    } finally {
      setIsAccountBusy(false);
    }
  };

  const handleDeletionRequest = async () => {
    try {
      await sendDataDeletionRequest(user);
    } catch (err: any) {
      Alert.alert('Could not open email', err?.message ?? 'Please contact support from the Contact Us page.');
    }
  };

  const handleSupportRequest = async () => {
    try {
      await sendSupportRequest(user);
    } catch (err: any) {
      Alert.alert('Could not open support', err?.message ?? 'Please try again later.');
    }
  };

  const handleRateApp = async () => {
    try {
      await openStoreReview();
    } catch (err: any) {
      Alert.alert('Could not open store', err?.message ?? 'Please try again later.');
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;

    Alert.alert(
      'Delete account?',
      'This permanently deletes your SubTrack data and account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final confirmation',
              'Delete all subscriptions, expenses, invoices, friends, preferences, and your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    setIsAccountBusy(true);
                    try {
                      await deleteSignedInUserDataAndAccount(user.uid);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (err: any) {
                      Alert.alert(
                        'Could not delete account',
                        err?.code === 'auth/requires-recent-login'
                          ? 'Please sign out, sign in again, and retry account deletion.'
                          : err?.message ?? 'Please try again later.'
                      );
                    } finally {
                      setIsAccountBusy(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Preferences & account</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileLeft}>
            {/* Avatar — initials based */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileTextBlock}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name || 'Guest'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email || 'No email'}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: isSyncing ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)' }]}>
                <Icon source={error ? 'cloud-alert-outline' : isSyncing ? 'cloud-sync-outline' : 'cloud-check-outline'} size={20} color={error ? palette.danger : isSyncing ? '#3B82F6' : palette.success} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>{error ? 'Sync needs attention' : isSyncing ? 'Syncing data' : 'Data synced'}</Text>
                <Text style={styles.listSubText} numberOfLines={1}>{error || dataCounts}</Text>
              </View>
            </View>
          </View>

          {/* ── Currency ─────────────────────────────────────── */}
          <Pressable style={styles.listItem} onPress={openCurrencyPicker}>
            <View style={styles.listItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)' }]}>
                <Icon source="currency-usd" size={20} color={palette.primary} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Currency</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Used across the entire app</Text>
              </View>
            </View>
            <View style={styles.listItemRight}>
              <View style={styles.currencyChip}>
                <Text style={styles.currencyFlag}>{currency.flag}</Text>
                <Text style={styles.currencyCode}>{currency.code}</Text>
              </View>
              <Icon source="chevron-right" size={16} color={palette.muted} />
            </View>
          </Pressable>

          {/* Notifications */}
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="bell-outline" size={20} color={palette.muted} />
              </View>
              <Text style={styles.listText}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={explainNotifications}
              trackColor={{ false: palette.line, true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* App Lock (Biometrics) */}
          {isBiometricSupported && (
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={styles.iconBox}>
                  <Icon source="face-recognition" size={20} color={palette.muted} />
                </View>
                <View style={styles.listTextBlock}>
                  <Text style={styles.listText} numberOfLines={1}>Face ID / Touch ID Lock</Text>
                  <Text style={styles.listSubText} numberOfLines={1}>Require authentication to open app</Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: palette.line, true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          {/* Test Notification Button */}
          <Pressable
            style={[styles.listItem, isSendingTest && { opacity: 0.6 }]}
            onPress={testNotification}
            disabled={isSendingTest}
          >
            <View style={styles.listItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Icon source={isSendingTest ? 'bell-sleep-outline' : 'bell-ring-outline'} size={20} color="#3B82F6" />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText} numberOfLines={1}>Test alert reminder</Text>
                {testSub ? (
                  <Text style={styles.listSubText} numberOfLines={1}>
                    Will fire for: {testSub.name}
                  </Text>
                ) : (
                  <Text style={styles.listSubText}>Add a subscription first</Text>
                )}
              </View>
            </View>
            <Text style={[styles.listHint, { color: '#3B82F6' }]}>
              {isSendingTest ? 'Sending...' : 'Send now'}
            </Text>
          </Pressable>

          {/* Appearance */}
          <Pressable
            style={styles.listItem}
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source={theme === 'dark' ? 'weather-night' : 'weather-sunny'} size={20} color={palette.muted} />
              </View>
              <Text style={styles.listText}>Appearance</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listValue}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
              <Icon source="chevron-right" size={16} color={palette.muted} />
            </View>
          </Pressable>

        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Account & data</Text>
        </View>

        <View style={styles.settingsList}>
          <Pressable style={[styles.listItem, isAccountBusy && { opacity: 0.6 }]} onPress={handleExportData} disabled={isAccountBusy || !user}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="download-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Export data</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Download your subscriptions, expenses, invoices, and settings</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={styles.listItem} onPress={handleDeletionRequest}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="email-fast-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Data deletion request</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Contact support for privacy/data deletion help</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={styles.listItem} onPress={handleSupportRequest}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="bug-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Report a problem</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Includes recent local crash details if available</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={styles.listItem} onPress={handleRateApp}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="star-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Rate SubTrack</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Open the app store listing</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={[styles.listItem, isAccountBusy && { opacity: 0.6 }]} onPress={handleDeleteAccount} disabled={isAccountBusy || !user}>
            <View style={styles.listItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: `${palette.danger}12` }]}>
                <Icon source="account-remove-outline" size={20} color={palette.danger} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={[styles.listText, { color: palette.danger }]}>Delete account</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Permanently remove your account and app data</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Legal</Text>
        </View>

        <View style={styles.settingsList}>
          <Pressable style={styles.listItem} onPress={() => openLegalPage('privacy')}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="shield-check-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Privacy Policy</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Data, ads, permissions, and user choices</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={styles.listItem} onPress={() => openLegalPage('terms')}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="file-document-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Terms & Conditions</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Rules and responsibility for app use</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable style={styles.listItem} onPress={() => openLegalPage('contact')}>
            <View style={styles.listItemLeft}>
              <View style={styles.iconBox}>
                <Icon source="information-outline" size={20} color={palette.muted} />
              </View>
              <View style={styles.listTextBlock}>
                <Text style={styles.listText}>Contact Us</Text>
                <Text style={styles.listSubText} numberOfLines={1}>Support and app information</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={16} color={palette.muted} />
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          style={[styles.signOutBtn, isSigningOut && { opacity: 0.6 }]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          <Icon source="logout" size={20} color={palette.danger} />
          <Text style={[styles.signOutText, { color: palette.danger }]}>
            {isSigningOut ? 'Signing out…' : 'Sign Out'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Currency Picker Modal (Android native picker) ── */}
      {Platform.OS === 'android' && (
        <Modal
          visible={currencyPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={dismissCurrencyPicker}
          statusBarTranslucent
        >
          <Pressable style={styles.modalBackdrop} onPress={dismissCurrencyPicker} />
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Title row */}
            <View style={styles.pickerTitleRow}>
              <TouchableOpacity onPress={dismissCurrencyPicker} style={styles.pickerBtn}>
                <Text style={[styles.pickerBtnText, { color: palette.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={confirmCurrencyPicker} style={styles.pickerBtn}>
                <Text style={[styles.pickerBtnText, { color: palette.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={pendingCurrency.code}
              onValueChange={(code) => {
                const found = CURRENCIES.find(c => c.code === code);
                if (found) setPendingCurrency(found);
              }}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {CURRENCIES.map(c => (
                <Picker.Item
                  key={c.code}
                  label={`${c.flag}  ${c.code} – ${c.name}`}
                  value={c.code}
                />
              ))}
            </Picker>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (palette: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.background,
    padding: 16,
    borderRadius: 20,
    marginBottom: 32,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  profileTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
  },
  profileEmail: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 32,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${palette.danger}40`,
    backgroundColor: `${palette.danger}0D`,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingsList: {
    gap: 4,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 28,
  },
  sectionHeaderText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  listTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listText: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  listSubText: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 1,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    marginLeft: 12,
  },
  listValue: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.muted,
  },
  listHint: {
    fontSize: 12,
    fontWeight: '500',
    color: palette.muted,
  },

  // Currency chip in settings row
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currencyFlag: {
    fontSize: 14,
  },
  currencyCode: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },

  // Modal backdrop
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Native picker sheet (Android)
  pickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#ffffff' : '#000000',
  },
  pickerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pickerBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    fontSize: 16,
    color: isDark ? '#ffffff' : '#000000',
  },
});
