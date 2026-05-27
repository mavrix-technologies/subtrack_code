import { BrandIcon } from '@/components/BrandIcon';
import { POPULAR_APPS } from '@/constants/brands';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { trackEvent } from '@/services/analytics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
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

const appNameMatchers = POPULAR_APPS
  .slice()
  .sort((a, b) => b.name.length - a.name.length)
  .map((app) => ({
    app,
    compactRegex: new RegExp(`\\b${app.name.toLowerCase().replace(/\s+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    regex: new RegExp(`\\b${app.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }));

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

export default function AddScreen() {
  "use no memo";

  const { palette } = useTheme();
  const { currency } = useCurrency();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [internetResults, setInternetResults] = useState<any[]>([]);

  const handleSearchQueryChange = (val: string) => {
    setSearchQuery(val);
    if (val.length > 1) {
      fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${val}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setInternetResults(data);
        })
        .catch(() => setInternetResults([]));
    } else {
      setInternetResults([]);
    }
  };
  
  // Form State
  const [billingCycle, setBillingCycle] = useState('Monthly');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentDateStr, setPaymentDateStr] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handlePaymentDateStrChange = (val: string) => {
    setPaymentDateStr(val);
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      setPaymentDate(parsed);
    }
  };



  const [planDetails, setPlanDetails] = useState('Premium');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [billingMenuVisible, setBillingMenuVisible] = useState(false);
  const [planMenuVisible, setPlanMenuVisible] = useState(false);
  const [paymentMenuVisible, setPaymentMenuVisible] = useState(false);
  
  const { addSubscription } = useAppData();

  const handleSaveSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!name || !price) {
      Alert.alert('Missing Fields', 'Please provide a name and price for the subscription.');
      return;
    }

    const priceNum = parseFloat(price.replace(/,/g, ''));
    if (isNaN(priceNum)) {
      Alert.alert('Invalid Price', 'Please enter a valid number for the price.');
      return;
    }

    try {
      const selected = POPULAR_APPS.find(app => app.id === selectedAppId);
      await addSubscription({
        name,
        price: priceNum,
        billingCycle: billingCycle.toLowerCase() === 'yearly' ? 'yearly' : 'monthly',
        nextBillingDate: paymentDate.toISOString(),
        category: 'others',
        icon: (selectedAppId || 'generic') as any,
        color: selected ? `#${selected.icon.hex}` : palette.primary,
        planName: planDetails,
        notes: `Payment Method: ${paymentMethod}`,
        startedOn: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        yearlyPrice: billingCycle.toLowerCase() === 'yearly' ? priceNum : priceNum * 12,
      });
      void trackEvent('add_subscription_saved', {
        billing_cycle: billingCycle.toLowerCase(),
        price: priceNum,
        imported_logo: Boolean(selectedAppId?.startsWith('http')),
      });
      router.back();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to save subscription.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleMagicImport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void trackEvent('magic_import_started');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0].base64) {
      return;
    }

    setIsScanning(true);
    try {
      // 1. Call OCR.space API (Free Tier limit: 500/day, max 1MB image recommended)
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${result.assets[0].base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          apikey: 'helloworld', // Demo key. Use your own key in production.
        },
        body: formData,
      });

      const json = await response.json();
      
      if (json.IsErroredOnProcessing || !json.ParsedResults || json.ParsedResults.length === 0) {
        Alert.alert('Scan Failed', 'Could not parse text from image.');
        void trackEvent('magic_import_failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsScanning(false);
        return;
      }

      const extractedText = json.ParsedResults[0].ParsedText || '';
      // 2. Parse the OCR Text via Regex
      const lowercaseText = extractedText.toLowerCase();

      // Clean text to make matching easier
      const cleanText = extractedText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

      // --- EXTRACT PRICE ---
      let foundPrice = '';
      // Matches: $14.99, ₹499, Rs. 499, INR 500, USD 9.99
      const symbolPriceMatch = cleanText.match(/(?:₹|Rs\.?|\$|€|£|INR|USD|EUR|GBP)[\s]*([\d,]+(?:\.\d{2})?)/i);
      // Matches: Total: 499, Amount Due: 14.99, Paid 500
      const wordPriceMatch = cleanText.match(/(?:total|amount|price|paid|payment|charged|due)(?:[\s:]*)(?:₹|Rs\.?|\$|€|£|INR|USD|EUR|GBP)?[\s]*([\d,]+(?:\.\d{2})?)/i);
      
      if (symbolPriceMatch && symbolPriceMatch[1]) {
        foundPrice = symbolPriceMatch[1].replace(/,/g, '');
      } else if (wordPriceMatch && wordPriceMatch[1]) {
        foundPrice = wordPriceMatch[1].replace(/,/g, '');
      }
      
      // Fallback: Just find the first obvious standalone decimal number (e.g., 14.99 or 499.00)
      if (!foundPrice) {
         const standaloneMatch = cleanText.match(/\b(\d{1,4}\.\d{2})\b/);
         if (standaloneMatch) foundPrice = standaloneMatch[1];
      }

      if (foundPrice) setPrice(foundPrice);

      // --- EXTRACT BILLING CYCLE ---
      const isYearly = /(year|annual|annually|12 month|every 12|yearly)/i.test(lowercaseText);
      const isWeekly = /(week|weekly|7 day|every 7)/i.test(lowercaseText);
      
      if (isYearly) {
        setBillingCycle('Yearly');
      } else if (isWeekly) {
        setBillingCycle('Weekly');
      } else {
        // Default to Monthly if we see month keywords or if nothing is found (most common)
        setBillingCycle('Monthly');
      }

      // --- EXTRACT DATE ---
      // Matches formats like: 12 May 2026, 05/12/2026, May 12th, 2026
      const dateMatch = cleanText.match(/(\d{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b)/i);
      if (dateMatch && dateMatch[1]) {
        const parsedDate = new Date(dateMatch[1]);
        if (!isNaN(parsedDate.getTime())) {
          setPaymentDate(parsedDate);
          setPaymentDateStr(parsedDate.toISOString().split('T')[0]);
        }
      }

      // --- EXTRACT APP NAME ---
      let matchedApp = null;
      for (const matcher of appNameMatchers) {
        // Use word boundary to avoid partial matches (e.g., matching "in" to LinkedIn)
        if (matcher.regex.test(cleanText) || matcher.compactRegex.test(lowercaseText)) {
          matchedApp = matcher.app;
          break;
        }
      }

      if (matchedApp) {
        setName(matchedApp.name);
        setSelectedAppId(matchedApp.id);
      } else {
        // Fallback Name: Take the first few uppercase words or the first text line
        const firstLine = extractedText.split('\n')[0]?.trim() || '';
        if (firstLine.length > 2 && firstLine.length < 30) {
          setName(firstLine);
        } else {
          setName('Unknown Sub');
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const successMessage = matchedApp 
        ? `Detected ${matchedApp.name} subscription for ${foundPrice ? foundPrice : 'an unknown price'}!` 
        : `Couldn't perfectly match a known app.\n\nRaw text found:\n"${extractedText.substring(0, 100)}..."`;

      Alert.alert('Magic Import Finished', successMessage, [{ text: 'Review details' }]);
      void trackEvent('magic_import_completed', {
        matched_app: Boolean(matchedApp),
        found_price: Boolean(foundPrice),
      });
      setIsScanning(false);

    } catch (err: any) {
      console.error(err);
      Alert.alert('Scan Failed', err.message || 'We could not detect a subscription from this screenshot.');
      void trackEvent('magic_import_failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsScanning(false);
    }
  };

  const handlePresentModalPress = () => {
    Keyboard.dismiss();
    setModalVisible(true);
  };

  const handleDismissModalPress = () => {
    setModalVisible(false);
  };
  
  const selectedApp = POPULAR_APPS.find(app => app.id === selectedAppId);
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Add Logo */}
        <View style={styles.addLogoContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.addLogoBox,
              selectedApp && {
                backgroundColor:
                  selectedApp.icon.hex === '000000' || selectedApp.icon.hex === '111111'
                    ? '#1A202C'
                    : `#${selectedApp.icon.hex}`,
              },
              selectedAppId?.startsWith('http') && { backgroundColor: palette.surface },
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
            onPress={handlePresentModalPress}
          >
            {selectedApp ? (
              <BrandIcon path={selectedApp.icon.path} color="#FFFFFF" size={38} />
            ) : selectedAppId?.startsWith('http') ? (
              <Image
                source={{ uri: selectedAppId }}
                style={{ width: 48, height: 48, borderRadius: 12, resizeMode: 'contain' }}
              />
            ) : (
              <View style={styles.addLogoPlaceholder}>
                <Icon source="image-plus" size={28} color={palette.primary} />
                <Text style={styles.addLogoText}>Add logo</Text>
              </View>
            )}
          </Pressable>
          {selectedApp && (
            <Pressable onPress={handlePresentModalPress} style={styles.changeLogoBtn}>
              <Text style={styles.changeLogoText}>Change</Text>
            </Pressable>
          )}
        </View>

        {/* Magic Import Button */}
        <Pressable
          style={({ pressed }) => [
            styles.magicImportBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
          ]}
          onPress={handleMagicImport}
          disabled={isScanning}
        >
          <View style={styles.magicImportIconWrapper}>
            {isScanning ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Icon source="auto-fix" size={20} color="#FFFFFF" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.magicImportTitle}>
              {isScanning ? 'Scanning…' : 'Magic Import'}
            </Text>
            <Text style={styles.magicImportSub}>
              {isScanning ? 'Reading your screenshot' : 'Auto-fill from a screenshot'}
            </Text>
          </View>
          <View style={styles.magicImportBadge}>
            <Text style={styles.magicImportBadgeText}>AI</Text>
          </View>
        </Pressable>

        {/* Form */}
        <View style={styles.formContainer}>
          
          {/* Name Field */}
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Name</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Price & Billing Cycle Row */}
          <View style={[styles.row, compact && styles.rowStack]}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Price</Text>
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Billing cycle</Text>
              </View>
              <Pressable 
                style={[styles.selectContainer, billingMenuVisible && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} 
                onPress={() => { Keyboard.dismiss(); setBillingMenuVisible(!billingMenuVisible); }}
              >
                <Text style={styles.selectText}>{billingCycle}</Text>
                <Icon source={billingMenuVisible ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
              </Pressable>
              {billingMenuVisible && (
                <View style={styles.inlineDropdown}>
                  {['Weekly', 'Monthly', 'Yearly'].map((opt, index, arr) => (
                    <Pressable 
                      key={opt} 
                      style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]} 
                      onPress={() => { setBillingCycle(opt); setBillingMenuVisible(false); }}
                    >
                      <Text style={[styles.inlineDropdownText, billingCycle === opt && { color: palette.primary, fontWeight: '600' }]}>{opt}</Text>
                      {billingCycle === opt && <Icon source="check" size={18} color={palette.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Next payment date */}
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
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: palette.text,
                    paddingHorizontal: 16,
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    outlineStyle: 'none',
                  } as any}
                />
                <View style={{ marginRight: 16 }}>
                  <Icon source="calendar-month-outline" size={20} color={palette.muted} />
                </View>
              </View>
            ) : (
              <>
                <Pressable style={styles.selectContainer} onPress={() => setShowDatePicker(!showDatePicker)}>
                  <Text style={styles.selectText}>
                    {paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>
                  <Icon source="calendar-month-outline" size={20} color={palette.muted} />
                </Pressable>
                {showDatePicker && (
                  <View style={{ marginTop: 8, backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' }}>
                    <DateTimePicker
                      value={paymentDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, date) => {
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

          {/* Plan details */}
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Plan details</Text>
            </View>
            <Pressable 
              style={[styles.selectContainer, planMenuVisible && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} 
              onPress={() => { Keyboard.dismiss(); setPlanMenuVisible(!planMenuVisible); }}
            >
              <Text style={styles.selectText}>{planDetails}</Text>
              <Icon source={planMenuVisible ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
            </Pressable>
            {planMenuVisible && (
              <View style={styles.inlineDropdown}>
                {['Basic', 'Standard', 'Premium', 'Family', 'Student'].map((opt, index, arr) => (
                  <Pressable 
                    key={opt} 
                    style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]} 
                    onPress={() => { setPlanDetails(opt); setPlanMenuVisible(false); }}
                  >
                    <Text style={[styles.inlineDropdownText, planDetails === opt && { color: palette.primary, fontWeight: '600' }]}>{opt}</Text>
                    {planDetails === opt && <Icon source="check" size={18} color={palette.primary} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Payment method */}
          <View>
            <Pressable 
              style={[styles.paymentMethodCard, paymentMenuVisible && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} 
              onPress={() => { Keyboard.dismiss(); setPaymentMenuVisible(!paymentMenuVisible); }}
            >
            <Text style={styles.paymentMethodTitle} numberOfLines={1}>Payment method</Text>
              <View style={styles.paymentMethodRight}>
                <View style={styles.cardPreview}>
                  <Icon source={getPaymentMethodIcon(paymentMethod)} size={16} color={palette.primary} />
                  <Text style={styles.cardNumber} numberOfLines={1}>{paymentMethod}</Text>
                </View>
                <Icon source={paymentMenuVisible ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
              </View>
            </Pressable>
            {paymentMenuVisible && (
              <View style={styles.inlineDropdown}>
                {PAYMENT_METHOD_OPTIONS.map((opt, index, arr) => (
                  <Pressable 
                    key={opt} 
                    style={[styles.inlineDropdownItem, index === arr.length - 1 && { borderBottomWidth: 0 }]} 
                    onPress={() => { setPaymentMethod(opt); setPaymentMenuVisible(false); }}
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
      </ScrollView>

      {/* Liquid Glass Footer Button */}
      <BlurView 
        intensity={80} 
        tint="light" 
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}
      >
        <Pressable 
          style={({ pressed }) => [
            styles.saveButton,
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
          ]}
          onPress={handleSaveSubscription}
        >
          <Text style={styles.saveButtonText}>Save subscription</Text>
        </Pressable>
      </BlurView>

      {/* Native React Native Modal Fallback */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleDismissModalPress}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleDismissModalPress} />
          
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIndicator} />
              <Text style={styles.sheetTitle}>Choose an App</Text>
              
              <View style={styles.searchBarContainer}>
                <Icon source="magnify" size={20} color={palette.muted} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search apps..."
                  placeholderTextColor={palette.muted}
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => { setSearchQuery(''); setInternetResults([]); }}>
                    <Icon source="close-circle" size={20} color={palette.muted} />
                  </Pressable>
                )}
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.appGrid} keyboardShouldPersistTaps="handled">
              {internetResults.length > 0 && (
                <View style={styles.sectionLabel}>
                  <Icon source="web" size={14} color={palette.primary} />
                  <Text style={[styles.sectionLabelText, { color: palette.primary }]}>Web Results</Text>
                </View>
              )}
              {internetResults.map(company => {
                const logoUrl = `https://unavatar.io/${company.domain}?fallback=https://www.google.com/s2/favicons?domain=${company.domain}&sz=256`;
                return (
                  <Pressable
                    key={company.domain}
                    style={({ pressed }) => [styles.appGridItem, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSelectedAppId(logoUrl);
                      setName(company.name);
                      handleDismissModalPress();
                    }}
                  >
                    <View style={[styles.appIconBox, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }]}>
                      <Image source={{ uri: logoUrl }} style={{ width: '72%', height: '72%', resizeMode: 'contain' }} />
                    </View>
                    <Text style={styles.appName} numberOfLines={1}>{company.name}</Text>
                  </Pressable>
                );
              })}

              {internetResults.length > 0 && (
                <View style={styles.sectionLabel}>
                  <Icon source="star-outline" size={14} color={palette.muted} />
                  <Text style={[styles.sectionLabelText, { color: palette.muted }]}>Popular Apps</Text>
                </View>
              )}

              {POPULAR_APPS.reduce<React.ReactElement[]>((matches, app) => {
                if (!app.name.toLowerCase().includes(searchQuery.toLowerCase())) return matches;
                const bgColor = app.icon.hex === '000000' || app.icon.hex === '111111' ? '#1A202C' : `#${app.icon.hex}`;
                const isSelected = selectedAppId === app.id;
                matches.push(
                  <Pressable
                    key={app.id}
                    style={({ pressed }) => [styles.appGridItem, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSelectedAppId(app.id);
                      setName(app.name);
                      handleDismissModalPress();
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
                return matches;
              }, [])}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  addLogoContainer: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  addLogoBox: {
    width: 88,
    height: 88,
    backgroundColor: palette.background,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.line,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  addLogoPlaceholder: {
    alignItems: 'center',
    gap: 6,
  },
  addLogoText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.primary,
  },
  changeLogoBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.line,
  },
  changeLogoText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  magicImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    borderRadius: 20,
    marginBottom: 28,
    gap: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  magicImportIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  magicImportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  magicImportSub: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  magicImportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.primary + '18',
    flexShrink: 0,
  },
  magicImportBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.primary,
    letterSpacing: 0.5,
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
  selectText: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
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
  mcCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 20,
    marginRight: 6,
  },
  mcCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.text,
    maxWidth: 120,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
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
    fontSize: 16,
    fontWeight: '600',
  },
  iconLetter: {
    fontSize: 32,
    fontWeight: 'bold',
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
    height: '85%',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIndicator: {
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
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${palette.line}40`,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    width: '100%',
  },
  searchBarInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 16,
    color: palette.text,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
