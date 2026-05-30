import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '@/contexts/theme';
import { useScanStore } from '@/store/useScanStore';
import { useInvoiceStore, InvoiceItem } from '@/store/useInvoiceStore';
import { useAppData } from '@/contexts/app-data';
import { createInvoice } from '@/services/invoiceService';
import { enqueueOfflineInvoice } from '@/services/offlineQueueService';

export default function InvoiceReviewScreen() {
  "use no memo";

  const { palette } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAppData();
  const S = React.useMemo(() => createStyles(palette), [palette]);

  const {
    extractedData,
    duplicateCheck,
    confidence,
    priceChanges,
    subscriptionRecommendation,
    imageUri,
  } = useScanStore();

  const fallbackDate = React.useMemo(() => new Date(), []);

  const { addInvoice } = useInvoiceStore();

  // Local Editable States
  const [clientName, setClientName] = useState(extractedData?.clientName || '');
  const [invoiceNumber, setInvoiceNumber] = useState(extractedData?.invoiceNumber || '');
  
  const [invoiceDateObject, setInvoiceDateObject] = useState<Date>(() => {
    if (extractedData?.date) {
      const parsed = new Date(extractedData.date);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [dueDateObject, setDueDateObject] = useState<Date | undefined>(() => {
    if (extractedData?.dueDate) {
      const parsed = new Date(extractedData.dueDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
  });
  const [showInvoiceDatePicker, setShowInvoiceDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  const [invoiceDateStr, setInvoiceDateStr] = useState(() => {
    const d = extractedData?.date ? new Date(extractedData.date) : new Date();
    return d.toISOString().split('T')[0];
  });
  const [dueDateStr, setDueDateStr] = useState(() => {
    if (extractedData?.dueDate) {
      const d = new Date(extractedData.dueDate);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return '';
  });

  const handleInvoiceDateStrChange = (val: string) => {
    setInvoiceDateStr(val);
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      setInvoiceDateObject(parsed);
    }
  };

  const handleDueDateStrChange = (val: string) => {
    setDueDateStr(val);
    if (!val.trim()) {
      setDueDateObject(undefined);
      return;
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      setDueDateObject(parsed);
    }
  };

  const [gstNumber, setGstNumber] = useState(extractedData?.gstNumber || '');
  const [clientPhone, setClientPhone] = useState(extractedData?.clientPhone || '');
  const [clientAddress, setClientAddress] = useState(extractedData?.clientAddress || '');
  const [category, setCategory] = useState(extractedData?.category || 'others');
  
  const [items, setItems] = useState<InvoiceItem[]>(extractedData?.items || []);
  const [taxRate, setTaxRate] = useState(extractedData?.taxRate?.toString() || '0');
  const [taxType, setTaxType] = useState<'cgst_sgst' | 'igst' | 'vat' | 'tax'>(extractedData?.taxType || 'tax');
  const [discountValue, setDiscountValue] = useState(extractedData?.discountValue?.toString() || '0');
  const [paymentMethod, setPaymentMethod] = useState(extractedData?.paymentMethod || 'UPI');
  const [notes, setNotes] = useState(extractedData?.notes || '');

  const [saving, setSaving] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(true);

  // Editable Financial States
  const [subtotalState, setSubtotalState] = useState(extractedData?.subtotal?.toFixed(2) || '0.00');
  const [discountState, setDiscountState] = useState(extractedData?.discountAmount?.toFixed(2) || '0.00');
  const [taxState, setTaxState] = useState(extractedData?.taxAmount?.toFixed(2) || '0.00');
  const [totalState, setTotalState] = useState(extractedData?.total?.toFixed(2) || '0.00');

  const [isSubtotalDirty, setIsSubtotalDirty] = useState(false);
  const [isDiscountDirty, setIsDiscountDirty] = useState(false);
  const [isTaxDirty, setIsTaxDirty] = useState(false);
  const [isTotalDirty, setIsTotalDirty] = useState(false);

  // Dynamically computed totals
  const computedSubtotal = React.useMemo(() => {
    if (items.length > 0) {
      return items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    }
    return extractedData?.subtotal || 0;
  }, [items, extractedData]);

  const disc = React.useMemo(() => {
    return parseFloat(discountValue) || extractedData?.discountAmount || 0;
  }, [discountValue, extractedData]);

  const rate = React.useMemo(() => {
    return parseFloat(taxRate) || 0;
  }, [taxRate]);

  const subtotalVal = isSubtotalDirty ? subtotalState : computedSubtotal.toFixed(2);
  const discountVal = isDiscountDirty ? discountState : disc.toFixed(2);

  const activeSubtotal = parseFloat(subtotalVal) || 0;
  const activeDiscount = parseFloat(discountVal) || 0;
  const computedTax = Math.round((activeSubtotal - activeDiscount) * (rate / 100) * 100) / 100;
  const taxVal = isTaxDirty ? taxState : computedTax.toFixed(2);

  const activeTax = parseFloat(taxVal) || 0;
  const computedTotal = activeSubtotal - activeDiscount + activeTax;
  const totalVal = isTotalDirty ? totalState : computedTotal.toFixed(2);

  const handleSubtotalChange = (val: string) => {
    setIsSubtotalDirty(true);
    setSubtotalState(val);
  };

  const handleDiscountChange = (val: string) => {
    setIsDiscountDirty(true);
    setDiscountState(val);
  };

  const handleTaxChange = (val: string) => {
    setIsTaxDirty(true);
    setTaxState(val);
  };

  const handleTotalChange = (val: string) => {
    setIsTotalDirty(true);
    setTotalState(val);
  };

  const handleResetTotals = () => {
    setIsSubtotalDirty(false);
    setIsDiscountDirty(false);
    setIsTaxDirty(false);
    setIsTotalDirty(false);
    setTaxType(extractedData?.taxType || 'tax');
  };

  // Edit Line Item Helpers
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    if (field === 'qty') {
      updated[index].qty = parseInt(value) || 0;
    } else if (field === 'price') {
      updated[index].price = parseFloat(value) || 0;
    } else if (field === 'mrp') {
      updated[index].mrp = value ? parseFloat(value) || 0 : undefined;
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { name: 'New Item', qty: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  /**
   * Save the invoice record
   */
  const handleSaveInvoice = async (statusOverride?: 'draft' | 'unpaid') => {
    if (!user) {
      Alert.alert('Authentication required', 'Please log in to save invoices.');
      return;
    }
    if (!clientName.trim()) {
      Alert.alert('Required field', 'Merchant name is required.');
      return;
    }

    setSaving(true);

    const invoicePayload: any = {
      id: extractedData?.id || `inv_${Date.now()}`,
      userId: user.uid,
      invoiceNumber: invoiceNumber.trim(),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientAddress: clientAddress.trim(),
      gstNumber: gstNumber.trim(),
      items: items.map(item => ({
        name: item.name,
        price: item.price,
        qty: item.qty,
        mrp: item.mrp,
        description: item.description || '',
      })),
      subtotal: parseFloat(subtotalVal) || 0,
      taxRate: parseFloat(taxRate) || 0,
      taxAmount: parseFloat(taxVal) || 0,
      taxType: taxType,
      discountType: 'flat',
      discountValue: parseFloat(discountVal) || 0,
      discountAmount: parseFloat(discountVal) || 0,
      total: parseFloat(totalVal) || 0,
      amountPaid: paymentMethod === 'Paid' ? (parseFloat(totalVal) || 0) : 0,
      balanceDue: paymentMethod === 'Paid' ? 0 : (parseFloat(totalVal) || 0),
      status: statusOverride || (paymentMethod === 'Paid' ? 'paid' : 'unpaid'),
      source: 'manual',
      notes: notes.trim(),
      date: invoiceDateObject.toISOString(),
      dueDate: dueDateObject ? dueDateObject.toISOString() : undefined,
      payments: [],
      imageUrl: imageUri || undefined,
      imageHash: extractedData?.imageHash || undefined,
      category: category || 'others',
      isDraft: statusOverride === 'draft',
      createdAt: new Date().toISOString(),
    };

    try {
      if (Platform.OS !== 'web') {
        // Try uploading to firestore, if fails (offline) it catches and enqueues
        await createInvoice(user.uid, invoicePayload);
      }
      addInvoice(invoicePayload);
      
      Alert.alert(
        'Success',
        statusOverride === 'draft' ? 'Invoice saved as Draft!' : 'Invoice saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // If subscription was suggested, prompt creation
              if (subscriptionRecommendation?.isSubscription) {
                Alert.alert(
                  'Subscription Detected',
                  `Would you like to add recurring subscription tracking for ${clientName}?`,
                  [
                    { text: 'No', onPress: () => router.replace('/(tabs)/invoices') },
                    { 
                      text: 'Yes, Add Subscription', 
                      onPress: () => router.replace({
                        pathname: '/add',
                        params: { 
                          name: clientName, 
                          cost: totalVal, 
                          period: subscriptionRecommendation.interval 
                        }
                      })
                    }
                  ]
                );
              } else {
                router.replace('/(tabs)/invoices');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.warn('Network upload failed, saving to offline queue:', error);
      // Enqueue to offline sync queue
      await enqueueOfflineInvoice(user.uid, invoicePayload);
      addInvoice(invoicePayload);
      
      Alert.alert(
        'Offline Save',
        'You are offline. Scanned invoice was saved locally and will sync when internet is restored.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/invoices') }]
      );
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    navigation.setOptions({
      title: 'Review Invoice',
      headerRight: () => (
        <Pressable onPress={() => handleSaveInvoice('draft')} style={S.headerDraftButton}>
          <Text style={[S.headerDraftText, { color: palette.primary }]}>Save Draft</Text>
        </Pressable>
      ),
    });
  }, [S.headerDraftButton, S.headerDraftText, handleSaveInvoice, navigation, palette.primary]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={S.root}
    >
      <ScrollView contentContainerStyle={S.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Alerts & Insights Section */}
        <View style={S.alertsContainer}>
          {/* OCR Processing Failure Banner */}
          {extractedData?.ocrFailed && (
            <View style={[S.alertCard, { backgroundColor: palette.warning + '15', borderColor: palette.warning, marginBottom: 12 }]}>
              <View style={S.alertHeader}>
                <Icon source="alert-circle-outline" size={20} color={palette.warning} />
                <Text style={[S.alertTitle, { color: palette.warning }]}>Scan Note: OCR Unreachable</Text>
              </View>
              <Text style={[S.alertText, { color: palette.text, marginTop: 4 }]}>
                We couldn&apos;t connect to the online OCR engine ({extractedData.ocrErrorMessage || 'network error'}). You can still review and save by entering the invoice details manually.
              </Text>
            </View>
          )}

          {/* Succeeded but no items detected */}
          {!extractedData?.ocrFailed && items.length === 0 && (
            <View style={[S.alertCard, { backgroundColor: palette.primary + '10', borderColor: palette.primary, marginBottom: 12 }]}>
              <View style={S.alertHeader}>
                <Icon source="text-box-search-outline" size={20} color={palette.primary} />
                <Text style={[S.alertTitle, { color: palette.primary }]}>No Products Auto-Detected</Text>
              </View>
              <Text style={[S.alertText, { color: palette.text, marginTop: 4 }]}>
                We successfully scanned the receipt, but couldn&apos;t auto-extract individual product line items. You can add items manually below by clicking &quot;+ Add Item&quot;.
              </Text>
            </View>
          )}
          {/* Duplicate Check Alert */}
          {duplicateCheck?.isDuplicate && (
            <View style={[S.alertCard, { backgroundColor: palette.danger + '15', borderColor: palette.danger }]}>
              <View style={S.alertHeader}>
                <Icon source="alert-decagram" size={20} color={palette.danger} />
                <Text style={[S.alertTitle, { color: palette.danger }]}>Potential Duplicate Detected</Text>
              </View>
              <Text style={[S.alertText, { color: palette.text }]}>
                {duplicateCheck.warningMessage || 'An identical invoice already exists in database.'}
              </Text>
              <View style={S.alertActions}>
                <Button 
                  mode="outlined" 
                  textColor={palette.danger}
                  style={{ borderColor: palette.danger, marginRight: 8 }}
                  onPress={() => router.replace(`/(tabs)/invoices`)}
                >
                  <Text>Cancel</Text>
                </Button>
                <Button 
                  mode="contained" 
                  buttonColor={palette.danger}
                  textColor="#FFF"
                  onPress={() => handleSaveInvoice()}
                >
                  <Text>Save Anyway</Text>
                </Button>
              </View>
            </View>
          )}

          {/* Subscription Detection Alert */}
          {subscriptionRecommendation?.isSubscription && (
            <View style={[S.alertCard, { backgroundColor: palette.success + '15', borderColor: palette.success }]}>
              <View style={S.alertHeader}>
                <Icon source="refresh" size={20} color={palette.success} />
                <Text style={[S.alertTitle, { color: palette.success }]}>Recurring Subscription Detected</Text>
              </View>
              <Text style={[S.alertText, { color: palette.text }]}>
                {clientName} looks like a {subscriptionRecommendation.interval} recurring charge. We can auto-create a subscription tracker for you when you save!
              </Text>
            </View>
          )}

          {/* Price Tracking Alerts */}
          {priceChanges.length > 0 && (
            <View style={[S.alertCard, { backgroundColor: palette.warning + '15', borderColor: palette.warning }]}>
              <View style={S.alertHeader}>
                <Icon source="trending-up" size={20} color={palette.warning} />
                <Text style={[S.alertTitle, { color: palette.warning }]}>Product Price Insights</Text>
              </View>
              {priceChanges.map((change, idx) => (
                <Text key={change.productName} style={[S.alertText, { color: palette.text, marginTop: 4 }]}>
                  • <Text style={{ fontWeight: '600' }}>{change.productName}</Text> price has changed. Was ₹{change.oldPrice.toFixed(2)}, now ₹{change.newPrice.toFixed(2)} ({change.diff >= 0 ? '+' : ''}₹{change.diff.toFixed(2)}).
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Collapsible Image Preview */}
        {imageUri && (
          <View style={S.imageSection}>
            <Pressable 
              style={S.imageToggleHeader}
              onPress={() => setShowImagePreview(!showImagePreview)}
            >
              <Text style={[S.sectionHeading, { color: palette.text }]}>Receipt Image</Text>
              <Icon 
                source={showImagePreview ? 'chevron-up' : 'chevron-down'} 
                size={22} 
                color={palette.text} 
              />
            </Pressable>
            
            {showImagePreview && (
              <View style={S.imageContainer}>
                <Image 
                  source={{ uri: imageUri }} 
                  style={S.receiptImage} 
                  contentFit="contain"
                />
              </View>
            )}
          </View>
        )}

        {/* Merchant & General Fields */}
        <View style={S.section}>
          <Text style={[S.sectionHeading, { color: palette.text }]}>General Details</Text>

          <View style={S.inputGroup}>
            <Text style={[S.label, { color: palette.muted }]}>Merchant Name</Text>
            <View style={[
              S.inputWrapper, 
              { borderColor: confidence.clientName === 'low' ? palette.warning : palette.border }
            ]}>
              <TextInput
                value={clientName}
                onChangeText={setClientName}
                style={[S.textInput, { color: palette.text }]}
                placeholder="Merchant Name"
                placeholderTextColor={palette.muted}
              />
              {confidence.clientName === 'low' && (
                <Icon source="alert" size={16} color={palette.warning} />
              )}
            </View>
          </View>

          <View style={S.inputGroup}>
            <Text style={[S.label, { color: palette.muted }]}>Category</Text>
            <View style={S.categoryRow}>
              {['groceries', 'utilities', 'entertainment', 'insurance', 'software', 'medical', 'dining', 'travel', 'others'].map((cat) => {
                const isSelected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[
                      S.categoryChip,
                      {
                        borderColor: isSelected ? palette.primary : palette.border,
                        backgroundColor: isSelected ? palette.primary + '15' : palette.surface,
                      }
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={{
                        color: isSelected ? palette.primary : palette.text,
                        fontSize: 12,
                        fontWeight: isSelected ? '600' : '400',
                        textTransform: 'capitalize',
                      }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={S.row}>
            <View style={[S.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Invoice Number</Text>
              <TextInput
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
                placeholder="INV-0000"
                placeholderTextColor={palette.muted}
              />
            </View>

            <View style={[S.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>GSTIN (optional)</Text>
              <TextInput
                value={gstNumber}
                onChangeText={setGstNumber}
                style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
                placeholder="27A..."
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>

          <View style={S.row}>
            <View style={[S.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Invoice Date</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  value={invoiceDateStr}
                  onChangeText={handleInvoiceDateStrChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
                />
              ) : (
                <Pressable
                  style={[
                    S.inputField, 
                    { 
                      borderColor: palette.border, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      backgroundColor: 'transparent',
                      paddingTop: 10
                    }
                  ]}
                  onPress={() => setShowInvoiceDatePicker(!showInvoiceDatePicker)}
                >
                  <Text style={{ color: palette.text, fontSize: 14 }}>
                    {invoiceDateObject.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                  <Icon source="calendar-month-outline" size={18} color={palette.muted} />
                </Pressable>
              )}
            </View>

            <View style={[S.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Due Date (optional)</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  value={dueDateStr}
                  onChangeText={handleDueDateStrChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
                />
              ) : (
                <Pressable
                  style={[
                    S.inputField, 
                    { 
                      borderColor: palette.border, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      backgroundColor: 'transparent',
                      paddingTop: 10
                    }
                  ]}
                  onPress={() => setShowDueDatePicker(!showDueDatePicker)}
                >
                  <Text style={{ color: dueDateObject ? palette.text : palette.muted, fontSize: 14 }}>
                    {dueDateObject 
                      ? dueDateObject.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Select due date'}
                  </Text>
                  {dueDateObject ? (
                    <Pressable onPress={(e) => { e.stopPropagation(); setDueDateObject(undefined); }}>
                      <Icon source="close-circle-outline" size={18} color={palette.muted} />
                    </Pressable>
                  ) : (
                    <Icon source="calendar-month-outline" size={18} color={palette.muted} />
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {Platform.OS !== 'web' && showInvoiceDatePicker && (
            <View style={{ marginBottom: 12, backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: palette.border }}>
              <DateTimePicker
                value={invoiceDateObject}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') setShowInvoiceDatePicker(false);
                  if (selectedDate) setInvoiceDateObject(selectedDate);
                }}
              />
            </View>
          )}

          {Platform.OS !== 'web' && showDueDatePicker && (
            <View style={{ marginBottom: 12, backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: palette.border }}>
              <DateTimePicker
                value={dueDateObject || fallbackDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') setShowDueDatePicker(false);
                  if (selectedDate) setDueDateObject(selectedDate);
                }}
              />
            </View>
          )}
        </View>

        {/* Contact/Address Fields */}
        <View style={S.section}>
          <Text style={[S.sectionHeading, { color: palette.text }]}>Merchant Contact info</Text>
          <View style={S.row}>
            <View style={[S.inputGroup, { flex: 1 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Phone</Text>
              <TextInput
                value={clientPhone}
                onChangeText={setClientPhone}
                style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
                placeholder="Phone Number"
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>
          <View style={S.inputGroup}>
            <Text style={[S.label, { color: palette.muted }]}>Address</Text>
            <TextInput
              value={clientAddress}
              onChangeText={setClientAddress}
              style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
              placeholder="Address"
              placeholderTextColor={palette.muted}
            />
          </View>
        </View>

        {/* Line Items */}
        <View style={S.section}>
          <View style={S.itemsHeader}>
            <Text style={[S.sectionHeading, { color: palette.text }]}>Line Items</Text>
            <Pressable style={S.addButton} onPress={handleAddItem}>
              <Icon source="plus" size={16} color={palette.primary} />
              <Text style={[S.addButtonText, { color: palette.primary }]}>Add Item</Text>
            </Pressable>
          </View>

          {items.map((item, idx) => (
            <View key={item.name + '-' + idx} style={[S.itemRow, { borderColor: palette.border, flexDirection: 'column', alignItems: 'stretch', paddingVertical: 12, borderBottomWidth: 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[S.fieldSubLabel, { marginBottom: 2 }]}>Product Name</Text>
                  <TextInput
                    value={item.name}
                    onChangeText={(val) => handleItemChange(idx, 'name', val)}
                    style={[S.itemInput, { color: palette.text, height: 38, paddingHorizontal: 10 }]}
                    placeholder="Product Name"
                    placeholderTextColor={palette.muted}
                  />
                </View>
                <Pressable style={{ alignSelf: 'flex-end', padding: 8, marginBottom: 2 }} onPress={() => handleRemoveItem(idx)}>
                  <Icon source="delete-outline" size={20} color={palette.danger} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: 50 }}>
                  <Text style={S.fieldSubLabel}>Qty</Text>
                  <TextInput
                    value={item.qty.toString()}
                    onChangeText={(val) => handleItemChange(idx, 'qty', val)}
                    keyboardType="number-pad"
                    style={[S.itemInput, { color: palette.text, textAlign: 'center', height: 34 }]}
                  />
                </View>
                
                <View style={{ width: 70, marginLeft: 8 }}>
                  <Text style={S.fieldSubLabel}>MRP (₹)</Text>
                  <TextInput
                    value={item.mrp !== undefined ? item.mrp.toString() : ''}
                    onChangeText={(val) => handleItemChange(idx, 'mrp', val)}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={palette.muted}
                    style={[S.itemInput, { color: palette.text, textAlign: 'center', height: 34 }]}
                  />
                </View>

                <View style={{ width: 85, marginLeft: 8 }}>
                  <Text style={S.fieldSubLabel}>Rate (Price)</Text>
                  <TextInput
                    value={item.price.toString()}
                    onChangeText={(val) => handleItemChange(idx, 'price', val)}
                    keyboardType="decimal-pad"
                    style={[S.itemInput, { color: palette.text, textAlign: 'right', height: 34 }]}
                  />
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 12 }}>
                  <Text style={[S.fieldSubLabel, { textAlign: 'right' }]}>Amount</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, marginTop: 8 }}>
                    ₹{(item.qty * item.price).toFixed(2)}
                  </Text>
                  {item.mrp !== undefined && item.mrp > item.price && (
                    <Text style={{ fontSize: 12, color: palette.success, fontWeight: '600', marginTop: 2 }}>
                      Saved ₹{((item.mrp - item.price) * item.qty).toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Financial Adjustments */}
        <View style={S.section}>
          <Text style={[S.sectionHeading, { color: palette.text }]}>Financial Calculations</Text>
          <View style={S.row}>
            <View style={[S.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Flat Discount (₹)</Text>
              <TextInput
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="decimal-pad"
                style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
              />
            </View>
            <View style={[S.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[S.label, { color: palette.muted }]}>Tax rate (%)</Text>
              <TextInput
                value={taxRate}
                onChangeText={setTaxRate}
                keyboardType="decimal-pad"
                style={[S.inputField, { borderColor: palette.border, color: palette.text }]}
              />
            </View>
          </View>

          <View style={[S.inputGroup, { marginTop: 12, marginBottom: 4 }]}>
            <Text style={[S.label, { color: palette.muted, marginBottom: 8 }]}>Tax Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['cgst_sgst', 'igst', 'vat', 'tax'] as const).map((type) => {
                const label = type === 'cgst_sgst' ? 'CGST & SGST' : type.toUpperCase();
                const isSelected = taxType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setTaxType(type)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: isSelected ? palette.primary : palette.border,
                      backgroundColor: isSelected ? palette.primary + '15' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isSelected ? '600' : '400', color: isSelected ? palette.primary : palette.text }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={S.totalsBlock}>
            <View style={[S.totalRow, { alignItems: 'center' }]}>
              <Text style={[S.totalLabel, { color: palette.muted }]}>Subtotal:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: palette.text, marginRight: 2 }}>₹</Text>
                <TextInput
                  value={subtotalVal}
                  onChangeText={handleSubtotalChange}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: palette.text,
                    textAlign: 'right',
                    minWidth: 80,
                    height: 24,
                    paddingVertical: 0,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: isSubtotalDirty ? palette.primary : palette.border,
                  }}
                />
              </View>
            </View>

            <View style={[S.totalRow, { alignItems: 'center' }]}>
              <Text style={[S.totalLabel, { color: palette.muted }]}>Discount:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: palette.danger, marginRight: 2 }}>-₹</Text>
                <TextInput
                  value={discountVal}
                  onChangeText={handleDiscountChange}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: palette.danger,
                    textAlign: 'right',
                    minWidth: 80,
                    height: 24,
                    paddingVertical: 0,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: isDiscountDirty ? palette.primary : palette.border,
                  }}
                />
              </View>
            </View>

            <View style={[S.totalRow, { alignItems: 'center' }]}>
              <Text style={[S.totalLabel, { color: palette.muted }]}>Taxable Amount:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: palette.text, marginRight: 2, fontWeight: '500' }}>₹</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text, paddingRight: 4 }}>
                  {(Math.max(0, (parseFloat(subtotalVal) || 0) - (parseFloat(discountVal) || 0))).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={[S.totalRow, { alignItems: 'center' }]}>
              <Text style={[S.totalLabel, { color: palette.muted }]}>Tax:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: palette.text, marginRight: 2 }}>₹</Text>
                <TextInput
                  value={taxVal}
                  onChangeText={handleTaxChange}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: palette.text,
                    textAlign: 'right',
                    minWidth: 80,
                    height: 24,
                    paddingVertical: 0,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: isTaxDirty ? palette.primary : palette.border,
                  }}
                />
              </View>
            </View>

            {parseFloat(taxRate) > 0 && (
              <View style={{ paddingLeft: 12, paddingVertical: 4 }}>
                {taxType === 'cgst_sgst' ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 12, color: palette.muted }}>- CGST ({(parseFloat(taxRate) / 2).toFixed(2)}%):</Text>
                      <Text style={{ fontSize: 12, color: palette.muted, paddingRight: 4 }}>₹{(parseFloat(taxVal) / 2).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: palette.muted }}>- SGST ({(parseFloat(taxRate) / 2).toFixed(2)}%):</Text>
                      <Text style={{ fontSize: 12, color: palette.muted, paddingRight: 4 }}>₹{(parseFloat(taxVal) / 2).toFixed(2)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: palette.muted }}>
                      - {taxType === 'igst' ? 'IGST' : taxType === 'vat' ? 'VAT' : 'Tax'} ({parseFloat(taxRate).toFixed(2)}%):
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.muted, paddingRight: 4 }}>₹{parseFloat(taxVal).toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={[S.grandTotalRow, { borderTopColor: palette.border, alignItems: 'center' }]}>
              <Text style={[S.grandTotalLabel, { color: palette.text }]}>Grand Total:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: palette.primary, marginRight: 2 }}>₹</Text>
                <TextInput
                  value={totalVal}
                  onChangeText={handleTotalChange}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: palette.primary,
                    textAlign: 'right',
                    minWidth: 90,
                    height: 28,
                    paddingVertical: 0,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: isTotalDirty ? palette.primary : palette.border,
                  }}
                />
              </View>
            </View>

            {(isSubtotalDirty || isDiscountDirty || isTaxDirty || isTotalDirty) && (
              <Pressable 
                onPress={handleResetTotals}
                style={{
                  alignSelf: 'flex-end',
                  marginTop: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: palette.primary + '15',
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>
                  Reset to Auto-Calculated
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Payment & Comments */}
        <View style={S.section}>
          <Text style={[S.sectionHeading, { color: palette.text }]}>Additional Settings</Text>
          <View style={S.row}>
            <Pressable 
              style={[
                S.chip, 
                { 
                  borderColor: paymentMethod === 'Paid' ? palette.success : palette.border,
                  backgroundColor: paymentMethod === 'Paid' ? palette.success + '15' : 'transparent'
                }
              ]}
              onPress={() => setPaymentMethod('Paid')}
            >
              <Text style={{ color: paymentMethod === 'Paid' ? palette.success : palette.text, fontWeight: '600' }}>Mark Paid</Text>
            </Pressable>
            <Pressable 
              style={[
                S.chip, 
                { 
                  borderColor: paymentMethod === 'Unpaid' ? palette.warning : palette.border,
                  backgroundColor: paymentMethod === 'Unpaid' ? palette.warning + '15' : 'transparent'
                }
              ]}
              onPress={() => setPaymentMethod('Unpaid')}
            >
              <Text style={{ color: paymentMethod === 'Unpaid' ? palette.warning : palette.text, fontWeight: '600' }}>Mark Unpaid</Text>
            </Pressable>
          </View>

          <View style={[S.inputGroup, { marginTop: 12 }]}>
            <Text style={[S.label, { color: palette.muted }]}>Notes & Terms</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              style={[S.notesArea, { borderColor: palette.border, color: palette.text }]}
              placeholder="E.g., Payment completed via bank transfer"
              placeholderTextColor={palette.muted}
            />
          </View>
        </View>

      </ScrollView>

      {/* Footer Save Action Bar */}
      <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, 20), borderTopColor: palette.border }]}>
        <Button
          mode="contained"
          loading={saving}
          disabled={saving}
          buttonColor={palette.primary}
          textColor="#FFF"
          onPress={() => handleSaveInvoice()}
          contentStyle={{ height: 48 }}
          style={{ flex: 1 }}
        >
          <Text>Confirm & Save</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.background,
    },
    headerDraftButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    headerDraftText: {
      fontSize: 14,
      fontWeight: '700',
    },
    scrollContainer: {
      padding: 16,
    },
    alertsContainer: {
      marginBottom: 16,
    },
    alertCard: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    alertText: {
      fontSize: 13,
      lineHeight: 18,
    },
    alertActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
    },
    imageSection: {
      marginBottom: 20,
    },
    imageToggleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    imageContainer: {
      height: 250,
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 16,
      overflow: 'hidden',
      borderColor: palette.border,
      borderWidth: 1,
      marginTop: 8,
    },
    receiptImage: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    section: {
      marginBottom: 24,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    inputGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 6,
    },
    fieldSubLabel: {
      fontSize: 10,
      color: '#8E8E93',
      marginBottom: 4,
    },
    inputField: {
      height: 44,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: palette.surface,
      borderColor: palette.border,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      backgroundColor: palette.surface,
      borderColor: palette.border,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      height: '100%',
      backgroundColor: 'transparent',
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    categoryChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 6,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    itemInput: {
      height: 38,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      paddingHorizontal: 8,
      fontSize: 13,
    },
    deleteItemBtn: {
      padding: 8,
      marginLeft: 4,
    },
    totalsBlock: {
      marginTop: 16,
      backgroundColor: 'rgba(0,0,0,0.02)',
      borderRadius: 12,
      padding: 12,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    totalLabel: {
      fontSize: 13,
    },
    totalVal: {
      fontSize: 13,
      fontWeight: '500',
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginTop: 8,
      borderTopWidth: 1,
    },
    grandTotalLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    grandTotalVal: {
      fontSize: 17,
      fontWeight: '700',
    },
    chip: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 4,
    },
    notesArea: {
      height: 80,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingTop: 8,
      fontSize: 14,
      textAlignVertical: 'top',
      backgroundColor: palette.surface,
      borderColor: palette.border,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
    },
  });
