import SignaturePadModal from '@/components/common/SignaturePadModal';
import { useAppData } from '@/contexts/app-data';
import { useCurrency, useInvoiceBrand } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { createInvoice } from '@/services/invoiceService';
import { InvoiceItem, computeInvoiceTotals, generateInvoiceNumber, useInvoiceStore } from '@/store/useInvoiceStore';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ItemDraft = { id: string; name: string; description: string; priceStr: string; qty: number };

const createItemDraft = (): ItemDraft => ({
  id: `${Date.now()}-${Math.random()}`,
  name: '',
  description: '',
  priceStr: '',
  qty: 1,
});

export default function CreateInvoiceScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const S = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAppData();
  const { currency } = useCurrency();
  const navigation = useNavigation();
  const { invoices } = useInvoiceStore();

  // refs for focus chain
  const refEmail    = useRef<TextInput>(null);
  const refPhone    = useRef<TextInput>(null);
  const refAddress  = useRef<TextInput>(null);
  const refTax      = useRef<TextInput>(null);
  const refDiscount = useRef<TextInput>(null);
  const refNotes    = useRef<TextInput>(null);
  const refTerms    = useRef<TextInput>(null);

  const [clientName, setClientName]       = useState('');
  const [clientEmail, setClientEmail]     = useState('');
  const [clientPhone, setClientPhone]     = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [date, setDate]                   = useState(new Date());
  const [dueDate, setDueDate]             = useState<Date | null>(null);
  const [showIssuePicker, setShowIssuePicker] = useState(false);
  const [showDuePicker, setShowDuePicker]     = useState(false);
  const [items, setItems] = useState<ItemDraft[]>(() => [createItemDraft()]);
  const [taxRate, setTaxRate]             = useState('');
  const [discountType, setDiscountType]   = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [notes, setNotes]   = useState('');
  const [terms, setTerms]   = useState('Payment due within 30 days.');
  const [submitting, setSubmitting] = useState(false);

  // ── Branding ──────────────────────────────────────────────────────────────
  const { brand, saveBrand } = useInvoiceBrand();
  const [brandExpanded, setBrandExpanded] = useState(false);
  const [editName,   setEditName]   = useState('');
  const [editTag,    setEditTag]    = useState('');
  const [editPrefix, setEditPrefix] = useState('');
  const [editLogo,   setEditLogo]   = useState('');
  const [editSig,    setEditSig]    = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [sigLabel, setSigLabel] = useState(brand.signatureLabel || 'Authorized Signature');

  // Sync local edits when brand loads from storage
  // Sync local edits when brand loads from storage
  const [prevBrand, setPrevBrand] = useState(brand);
  if (brand !== prevBrand) {
    setPrevBrand(brand);
    setEditName(brand.businessName);
    setEditTag(brand.tagline);
    setEditPrefix(brand.filePrefix);
    setEditLogo(brand.logoUri);
    setEditSig(brand.signatureUri);
    setSigLabel(brand.signatureLabel || 'Authorized Signature');
  }

  const pickBrandImage = async (type: 'logo' | 'signature') => {
    if (type === 'signature') {
      // Open signature pad modal for signature
      setShowSignaturePad(true);
      return;
    }
    
    // Android uses the system photo picker for one-off image selection without broad media access.
    if (Platform.OS !== 'android') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to pick an image.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext  = asset.uri.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      const uri  = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
      setEditLogo(uri);
    }
  };

  const handleSignatureSave = (signature: string) => {
    setEditSig(signature);
    setShowSignaturePad(false);
  };

  const saveBrandEdits = async () => {
    await saveBrand({
      businessName: editName.trim() || 'SubTrack',
      tagline:      editTag.trim(),
      filePrefix:   editPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'invoice',
      logoUri:      editLogo,
      signatureUri: editSig,
      signatureLabel: sigLabel.trim() || 'Authorized Signature',
    });
    Alert.alert('Saved', 'Branding settings updated.');
  };

  const itemNameRefs  = useRef<(TextInput | null)[]>([]);
  const itemPriceRefs = useRef<(TextInput | null)[]>([]);
  const itemDescRefs  = useRef<(TextInput | null)[]>([]);

  const validItems: InvoiceItem[] = useMemo(() => {
    return items.reduce<InvoiceItem[]>((acc, i) => {
      const name = i.name.trim();
      const price = parseFloat(i.priceStr);
      if (!name || price <= 0) return acc;
      const item: InvoiceItem = { name, price, qty: i.qty };
      const description = i.description.trim();
      if (description) item.description = description;
      acc.push(item);
      return acc;
    }, []);
  }, [items]);

  const totals = useMemo(() =>
    computeInvoiceTotals(validItems, parseFloat(taxRate) || 0, discountType, parseFloat(discountValue) || 0),
    [validItems, taxRate, discountType, discountValue]);

  const invoiceNumber = useMemo(() => generateInvoiceNumber(invoices), [invoices]);

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    if (!clientName.trim()) { Alert.alert('Missing client', 'Enter a client name.'); return; }
    if (validItems.length === 0) { Alert.alert('No items', 'Add at least one item with name and price.'); return; }
    if (!user) return;
    try {
      setSubmitting(true);
      const payload: any = {
        invoiceNumber,
        clientName: clientName.trim(),
        items: validItems,
        subtotal: totals.subtotal,
        taxRate: parseFloat(taxRate) || 0,
        taxAmount: totals.taxAmount,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        discountAmount: totals.discountAmount,
        total: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        status: 'unpaid',
        source: 'manual',
        date: date.toISOString(),
        payments: [],
      };
      // Only include optional string fields if they have a value — Firestore rejects undefined
      if (clientEmail.trim())   payload.clientEmail   = clientEmail.trim();
      if (clientPhone.trim())   payload.clientPhone   = clientPhone.trim();
      if (clientAddress.trim()) payload.clientAddress = clientAddress.trim();
      if (notes.trim())         payload.notes         = notes.trim();
      if (terms.trim())         payload.terms         = terms.trim();
      if (dueDate)              payload.dueDate       = dueDate.toISOString();

      const id = await createInvoice(user.uid, payload);

      // Wait briefly for the Firestore listener to populate the store before navigating
      await new Promise(resolve => setTimeout(resolve, 600));
      router.replace(`/invoice/${id}`);
    } catch (e: any) {
      console.error('createInvoice error:', e);
      Alert.alert('Error', e?.message ?? 'Could not save invoice.');
      setSubmitting(false);
    }
  }, [clientName, clientEmail, clientPhone, clientAddress, validItems, taxRate, discountType, discountValue, notes, terms, date, dueDate, totals, invoiceNumber, user]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleSave} disabled={submitting} style={{ marginRight: 4, padding: 8 }}>
          {submitting
            ? <ActivityIndicator size="small" color={palette.primary} />
            : <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>}
        </Pressable>
      ),
    });
  }, [submitting, handleSave, navigation, palette.primary]);

  const updateItem = (i: number, field: keyof ItemDraft, val: string | number) =>
    setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });

  const openPicker = (which: 'issue' | 'due') => {
    Keyboard.dismiss();
    setTimeout(() => which === 'issue' ? setShowIssuePicker(true) : setShowDuePicker(true), 100);
  };
  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: insets.bottom + 104 }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 104 }}
      >
        {/* Hero */}
        <View style={[S.hero, { backgroundColor: palette.primary }]}>
          <Text style={S.heroInvNum}>{invoiceNumber}</Text>
          <Text style={S.heroAmount}>{currency.symbol}{totals.total.toFixed(2)}</Text>
          <Text style={S.heroSub}>
            {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {dueDate ? `  ·  Due ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
          </Text>
        </View>

        {/* Client */}
        <SLabel text="Client Details" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SField
            icon="account-outline" placeholder="Client name *"
            value={clientName} onChangeText={setClientName}
            returnKeyType="next" onSubmitEditing={() => refEmail.current?.focus()}
            palette={palette}
          />
          <SDivider palette={palette} />
          <SField
            ref={refEmail} icon="email-outline" placeholder="Email address"
            value={clientEmail} onChangeText={setClientEmail}
            keyboardType="email-address" returnKeyType="next"
            onSubmitEditing={() => refPhone.current?.focus()}
            palette={palette}
          />
          <SDivider palette={palette} />
          <SField
            ref={refPhone} icon="phone-outline" placeholder="Phone number"
            value={clientPhone} onChangeText={setClientPhone}
            keyboardType="phone-pad" returnKeyType="next"
            onSubmitEditing={() => refAddress.current?.focus()}
            palette={palette}
          />
          <SDivider palette={palette} />
          <SField
            ref={refAddress} icon="map-marker-outline" placeholder="Address (optional)"
            value={clientAddress} onChangeText={setClientAddress}
            multiline returnKeyType="done"
            palette={palette}
          />
        </View>

        {/* Dates */}
        <SLabel text="Dates" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable style={S.dateRow} onPress={() => openPicker('issue')}>
            <Icon source="calendar-outline" size={20} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[S.dateLabel, { color: palette.muted }]}>Issue Date</Text>
              <Text style={[S.dateValue, { color: palette.text }]}>
                {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <Icon source="chevron-right" size={18} color={palette.muted} />
          </Pressable>
          <SDivider palette={palette} />
          <Pressable style={S.dateRow} onPress={() => openPicker('due')}>
            <Icon source="calendar-clock" size={20} color={palette.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[S.dateLabel, { color: palette.muted }]}>Due Date</Text>
              <Text style={[S.dateValue, { color: dueDate ? palette.text : palette.muted }]}>
                {dueDate ? dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tap to set (optional)'}
              </Text>
            </View>
            {dueDate && (
              <Pressable hitSlop={16} onPress={() => setDueDate(null)} style={{ padding: 4 }}>
                <Icon source="close-circle-outline" size={20} color={palette.muted} />
              </Pressable>
            )}
            <Icon source="chevron-right" size={18} color={palette.muted} />
          </Pressable>
        </View>

        {/* Line Items */}
        <SLabel text="Line Items" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {items.map((item, i) => {
            const lineTotal = (parseFloat(item.priceStr) || 0) * item.qty;
            return (
              <View key={item.id}>
                {i > 0 && <SDivider palette={palette} />}
                <View style={S.itemBlock}>
                  {/* Name row */}
                  <View style={S.itemTopRow}>
                    <TextInput
                      ref={el => { itemNameRefs.current[i] = el; }}
                      style={[S.itemNameInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.inputBg }]}
                      placeholder={`Item ${i + 1} name *`}
                      placeholderTextColor={palette.muted}
                      value={item.name}
                      onChangeText={v => updateItem(i, 'name', v)}
                      returnKeyType="next"
                      onSubmitEditing={() => itemDescRefs.current[i]?.focus()}
                    />
                    <Pressable
                      hitSlop={16} style={S.deleteBtn}
                      onPress={() => setItems(p => p.filter((_, j) => j !== i))}
                      disabled={items.length === 1}
                    >
                      <Icon source="close-circle" size={22} color={items.length === 1 ? palette.line : palette.danger} />
                    </Pressable>
                  </View>
                  {/* Description */}
                  <TextInput
                    ref={el => { itemDescRefs.current[i] = el; }}
                    style={[S.itemDescInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.inputBg }]}
                    placeholder="Description (optional)"
                    placeholderTextColor={palette.muted}
                    value={item.description}
                    onChangeText={v => updateItem(i, 'description', v)}
                    returnKeyType="next"
                    onSubmitEditing={() => itemPriceRefs.current[i]?.focus()}
                  />
                  {/* Price · Qty · Total */}
                  <View style={S.itemBottomRow}>
                    <View style={S.inputGroup}>
                      <Text style={[S.inputLabel, { color: palette.muted }]}>Unit Price</Text>
                      <View style={[S.numBox, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
                        <Text style={[S.numSym, { color: palette.muted }]}>{currency.symbol}</Text>
                        <TextInput
                          ref={el => { itemPriceRefs.current[i] = el; }}
                          style={[S.numField, { color: palette.text }]}
                          placeholder="0.00"
                          placeholderTextColor={palette.muted}
                          keyboardType="decimal-pad"
                          value={item.priceStr}
                          onChangeText={v => updateItem(i, 'priceStr', v)}
                          returnKeyType={i < items.length - 1 ? 'next' : 'done'}
                          onSubmitEditing={() => {
                            if (i < items.length - 1) itemNameRefs.current[i + 1]?.focus();
                            else refTax.current?.focus();
                          }}
                        />
                      </View>
                    </View>
                    <View style={S.inputGroup}>
                      <Text style={[S.inputLabel, { color: palette.muted }]}>Qty</Text>
                      <View style={S.stepper}>
                        <Pressable hitSlop={12} style={[S.stepBtn, { borderColor: palette.border, backgroundColor: palette.inputBg }]} onPress={() => updateItem(i, 'qty', Math.max(1, item.qty - 1))}>
                          <Icon source="minus" size={14} color={palette.text} />
                        </Pressable>
                        <Text style={[S.stepVal, { color: palette.text }]}>{item.qty}</Text>
                        <Pressable hitSlop={12} style={[S.stepBtn, { borderColor: palette.border, backgroundColor: palette.inputBg }]} onPress={() => updateItem(i, 'qty', item.qty + 1)}>
                          <Icon source="plus" size={14} color={palette.text} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={[S.inputGroup, { alignItems: 'flex-end' }]}>
                      <Text style={[S.inputLabel, { color: palette.muted }]}>Amount</Text>
                      <Text style={[S.lineTotal, { color: lineTotal > 0 ? palette.primary : palette.muted }]}>
                        {currency.symbol}{lineTotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
          <SDivider palette={palette} />
          <Pressable style={S.addRow} onPress={() => setItems(p => [...p, createItemDraft()])}>
            <Icon source="plus-circle-outline" size={20} color={palette.primary} />
            <Text style={[S.addRowText, { color: palette.primary }]}>Add line item</Text>
          </Pressable>
        </View>

        {/* Tax & Discount */}
        <SLabel text="Tax & Discount" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={S.taxRow}>
            <Icon source="percent" size={20} color={palette.primary} />
            <Text style={[S.taxLabel, { color: palette.text }]}>Tax Rate</Text>
            <View style={[S.numBox, { borderColor: palette.border, backgroundColor: palette.inputBg, width: 100 }]}>
              <TextInput
                ref={refTax}
                style={[S.numField, { color: palette.text, textAlign: 'right' }]}
                placeholder="0"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={taxRate}
                onChangeText={setTaxRate}
                returnKeyType="next"
                onSubmitEditing={() => refDiscount.current?.focus()}
              />
              <Text style={[S.numSym, { color: palette.muted }]}>%</Text>
            </View>
          </View>
          <SDivider palette={palette} />
          <View style={S.taxRow}>
            <Icon source="tag-outline" size={20} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[S.taxLabel, { color: palette.text }]}>Discount</Text>
              <View style={[S.segmented, { borderColor: palette.border, marginTop: 6 }]}>
                {(['flat', 'percent'] as const).map(t => (
                  <Pressable key={t} onPress={() => setDiscountType(t)}
                    style={[S.segBtn, discountType === t ? { backgroundColor: palette.primary } : { backgroundColor: palette.inputBg }]}>
                    <Text style={[S.segBtnText, { color: discountType === t ? '#fff' : palette.muted }]}>
                      {t === 'flat' ? `${currency.symbol} Flat` : '% Percent'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[S.numBox, { borderColor: palette.border, backgroundColor: palette.inputBg, width: 100 }]}>
              {discountType === 'flat' && <Text style={[S.numSym, { color: palette.muted }]}>{currency.symbol}</Text>}
              <TextInput
                ref={refDiscount}
                style={[S.numField, { color: palette.text, textAlign: 'right' }]}
                placeholder="0"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={discountValue}
                onChangeText={setDiscountValue}
                returnKeyType="next"
                onSubmitEditing={() => refNotes.current?.focus()}
              />
              {discountType === 'percent' && <Text style={[S.numSym, { color: palette.muted }]}>%</Text>}
            </View>
          </View>
        </View>

        {/* Summary */}
        <SLabel text="Summary" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {[
            { label: 'Subtotal', value: totals.subtotal, neg: false },
            ...(totals.discountAmount > 0 ? [{ label: `Discount (${discountType === 'percent' ? (discountValue||'0') + '%' : currency.symbol + (discountValue||'0')})`, value: totals.discountAmount, neg: true }] : []),
            ...(totals.taxAmount > 0 ? [{ label: `Tax (${taxRate||'0'}%)`, value: totals.taxAmount, neg: false }] : []),
          ].map((row, i, arr) => (
            <View key={row.label}>
              <View style={S.summaryRow}>
                <Text style={[S.summaryLabel, { color: palette.muted }]}>{row.label}</Text>
                <Text style={[S.summaryValue, { color: row.neg ? palette.success : palette.text }]}>
                  {row.neg ? '-' : ''}{currency.symbol}{row.value.toFixed(2)}
                </Text>
              </View>
              {i < arr.length - 1 && <SDivider palette={palette} />}
            </View>
          ))}
          <View style={[S.totalDivider, { backgroundColor: palette.border }]} />
          <View style={S.summaryRow}>
            <Text style={[S.totalLabel, { color: palette.text }]}>Total</Text>
            <Text style={[S.totalValue, { color: palette.primary }]}>{currency.symbol}{totals.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        <SLabel text="Notes" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <TextInput
            ref={refNotes}
            style={[S.multilineInput, { color: palette.text }]}
            placeholder="Additional notes for the client..."
            placeholderTextColor={palette.muted}
            value={notes} onChangeText={setNotes}
            multiline numberOfLines={3}
            returnKeyType="next"
            onSubmitEditing={() => refTerms.current?.focus()}
          />
        </View>

        {/* Terms */}
        <SLabel text="Payment Terms" palette={palette} />
        <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <TextInput
            ref={refTerms}
            style={[S.multilineInput, { color: palette.text }]}
            placeholder="e.g. Payment due within 30 days."
            placeholderTextColor={palette.muted}
            value={terms} onChangeText={setTerms}
            multiline numberOfLines={2}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
        </View>

        {/* ── Branding ─────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => { Keyboard.dismiss(); setBrandExpanded(v => !v); }}
          style={[S.brandHeader, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.primary + '18', justifyContent: 'center', alignItems: 'center' }}>
              <Icon source="tune-variant" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>Invoice Branding</Text>
              <Text style={{ fontSize: 12, color: palette.muted, marginTop: 1 }} numberOfLines={1}>
                {brand.businessName || 'SubTrack'}{brand.logoUri ? '  -  Logo saved' : ''}{brand.signatureUri ? '  -  Signature saved' : ''}
              </Text>
            </View>
          </View>
          <Icon source={brandExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.muted} />
        </Pressable>

        {brandExpanded && (
          <View style={[S.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 0, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>

            {/* Business Name */}
            <View style={S.brandField}>
              <Text style={[S.brandLabel, { color: palette.muted }]}>Business Name</Text>
              <TextInput
                style={[S.brandInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.inputBg }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your Business Name"
                placeholderTextColor={palette.muted}
              />
            </View>

            <SDivider palette={palette} />

            {/* Tagline */}
            <View style={S.brandField}>
              <Text style={[S.brandLabel, { color: palette.muted }]}>Tagline</Text>
              <TextInput
                style={[S.brandInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.inputBg }]}
                value={editTag}
                onChangeText={setEditTag}
                placeholder="e.g. Professional Services"
                placeholderTextColor={palette.muted}
              />
            </View>

            <SDivider palette={palette} />

            {/* File Prefix */}
            <View style={S.brandField}>
              <Text style={[S.brandLabel, { color: palette.muted }]}>Export File Prefix</Text>
              <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 6 }}>
                Files: <Text style={{ fontWeight: '700', color: palette.text }}>{(editPrefix || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_')}_{invoiceNumber}.pdf</Text>
              </Text>
              <TextInput
                style={[S.brandInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.inputBg }]}
                value={editPrefix}
                onChangeText={setEditPrefix}
                placeholder="invoice"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
              />
            </View>

            <SDivider palette={palette} />

            {/* Logo */}
            <View style={S.brandField}>
              <Text style={[S.brandLabel, { color: palette.muted }]}>Company Logo</Text>
              <Pressable
                onPress={() => pickBrandImage('logo')}
                style={[S.imagePicker, { borderColor: editLogo ? palette.primary : palette.border, backgroundColor: palette.inputBg }]}
              >
                {editLogo ? (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Image source={{ uri: editLogo }} style={{ width: 140, height: 52, resizeMode: 'contain' }} />
                    <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>Tap to change</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Icon source="image-plus" size={28} color={palette.muted} />
                    <Text style={{ fontSize: 13, color: palette.muted }}>Add logo</Text>
                  </View>
                )}
              </Pressable>
              {editLogo ? (
                <Pressable onPress={() => setEditLogo('')} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: palette.danger, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <SDivider palette={palette} />

            {/* Signature */}
            <View style={S.brandField}>
              <Text style={[S.brandLabel, { color: palette.muted }]}>Authorised Signature</Text>
              
              {/* Signature preview or draw area */}
              <Pressable
                onPress={() => setShowSignaturePad(true)}
                style={[S.imagePicker, { borderColor: editSig ? palette.primary : palette.border, backgroundColor: palette.inputBg }]}
              >
                {editSig ? (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Image source={{ uri: editSig }} style={{ width: 160, height: 60, resizeMode: 'contain' }} />
                    <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>Tap to change</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Icon source="draw" size={28} color={palette.muted} />
                    <Text style={{ fontSize: 13, color: palette.muted, fontWeight: '600' }}>Draw or Upload Signature</Text>
                    <Text style={{ fontSize: 12, color: palette.muted }}>Tap to open signature pad</Text>
                  </View>
                )}
              </Pressable>
              
              {editSig ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Pressable
                    onPress={() => setShowSignaturePad(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Icon source="pencil-outline" size={14} color={palette.primary} />
                    <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditSig('')}>
                    <Text style={{ fontSize: 12, color: palette.danger, fontWeight: '600' }}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <SDivider palette={palette} />

            {/* Save button */}
            <Pressable
              onPress={saveBrandEdits}
              style={{ margin: 16, height: 48, borderRadius: 12, backgroundColor: palette.primary, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Branding</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <DateTimePickerModal
        isVisible={showIssuePicker}
        mode="date" date={date}
        onConfirm={d => { setDate(d); setShowIssuePicker(false); }}
        onCancel={() => setShowIssuePicker(false)}
      />
      <DateTimePickerModal
        isVisible={showDuePicker}
        mode="date" date={dueDate ?? date} minimumDate={date}
        onConfirm={d => { setDueDate(d); setShowDuePicker(false); }}
        onCancel={() => setShowDuePicker(false)}
      />
      
      <SignaturePadModal
        visible={showSignaturePad}
        onSave={handleSignatureSave}
        onClose={() => setShowSignaturePad(false)}
        label={sigLabel}
        onLabelChange={setSigLabel}
        initialSignature={editSig || undefined}
      />
    </KeyboardAvoidingView>
  );
}
// ── Reusable sub-components ───────────────────────────────────────────────────

function SLabel({ text, palette }: { text: string; palette: any }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, color: palette.muted, marginHorizontal: 20, marginTop: 22, marginBottom: 7 }}>
      {text}
    </Text>
  );
}

function SDivider({ palette }: { palette: any }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />;
}

type SFieldProps = {
  icon: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; keyboardType?: any;
  multiline?: boolean; palette: any;
  returnKeyType?: any; onSubmitEditing?: () => void;
  ref?: React.Ref<TextInput>;
};

function SField({ icon, placeholder, value, onChangeText, keyboardType, multiline, palette, returnKeyType, onSubmitEditing, ref }: SFieldProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 }}>
      <View style={{ marginTop: multiline ? 2 : 0 }}>
        <Icon source={icon} size={20} color={palette.primary} />
      </View>
      <TextInput
        ref={ref}
        style={{ flex: 1, fontSize: 15, color: palette.text, paddingVertical: 0, minHeight: multiline ? 64 : 24, textAlignVertical: multiline ? 'top' : 'center' }}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType ?? 'done'}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={!multiline}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function createStyles(palette: any) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: palette.background },
    hero:          { marginHorizontal: 16, marginTop: 10, borderRadius: 20, padding: 24, alignItems: 'center', gap: 4 },
    heroInvNum:    { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    heroAmount:    { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: 0 },
    heroSub:       { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
    card:          { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    dateRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, minHeight: 64 },
    dateLabel:     { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    dateValue:     { fontSize: 15, fontWeight: '500' },
    itemBlock:     { padding: 14, gap: 10 },
    itemTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemNameInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, fontWeight: '500' },
    itemDescInput: { height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 13 },
    deleteBtn:     { padding: 6 },
    itemBottomRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 },
    inputGroup:    { flex: 1, minWidth: 88, gap: 5 },
    inputLabel:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    numBox:        { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
    numSym:        { fontSize: 14 },
    numField:      { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
    stepper:       { flexDirection: 'row', alignItems: 'center', height: 44, gap: 6 },
    stepBtn:       { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    stepVal:       { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
    lineTotal:     { fontSize: 16, fontWeight: '800', textAlign: 'right' },
    addRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
    addRowText:    { fontSize: 14, fontWeight: '600' },
    taxRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
    taxLabel:      { flex: 1, fontSize: 15, fontWeight: '500' },
    segmented:     { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' },
    segBtn:        { paddingHorizontal: 14, paddingVertical: 7 },
    segBtnText:    { fontSize: 12, fontWeight: '700' },
    summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
    summaryLabel:  { fontSize: 14 },
    summaryValue:  { fontSize: 14, fontWeight: '600' },
    totalDivider:  { height: 1, marginHorizontal: 16, marginVertical: 2 },
    totalLabel:    { fontSize: 17, fontWeight: '700' },
    totalValue:    { fontSize: 22, fontWeight: '900' },
    multilineInput:{ paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
    // Branding
    brandHeader:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 22, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
    brandField:    { paddingHorizontal: 16, paddingVertical: 14 },
    brandLabel:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
    brandInput:    { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
    imagePicker:   { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, minHeight: 90, justifyContent: 'center', alignItems: 'center', padding: 16 },
  });
}
