import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { createInvoice } from '@/services/invoiceService';
import { useExpenseStore } from '@/store/useExpenseStore';
import { formatShortDate } from '@/utils/dates';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GenerateInvoiceScreen() {
  "use no memo";

  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { expenses } = useExpenseStore();
  const { formatAmount, currency } = useCurrency();
  const { user } = useAppData();

  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const expense = expenses.find((e) => e.id === id);

  if (!expense || !expense.isSplit || !expense.participants) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.text }}>Valid split expense not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const invoiceTitle = expense.category
    ? expense.category.charAt(0).toUpperCase() + expense.category.slice(1)
    : 'General';

  const items = expense.participants.map((p) => ({
    name: `${expense.name} — ${p.name}`,
    price: p.amount,
    qty: 1,
  }));

  const generateHtml = () => {
    const itemRows = items
      .map(
        (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #F3F4F6;color:#374151;font-size:15px;">${item.name}</td>
          <td style="padding:14px 0;border-bottom:1px solid #F3F4F6;text-align:center;color:#6B7280;font-size:15px;">1</td>
          <td style="padding:14px 0;border-bottom:1px solid #F3F4F6;text-align:right;color:#374151;font-size:15px;">${currency.symbol}${item.price.toFixed(2)}</td>
          <td style="padding:14px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:700;color:#111827;font-size:15px;">${currency.symbol}${item.price.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            @page { margin: 0; size: A4 portrait; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111827; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 48px 40px; display: flex; flex-direction: column; background: #fff; }
            @media print { .page { width: 100%; min-height: 0; height: auto; margin: 0; padding: 0; } }
            .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
            .brand { font-size: 22px; font-weight: 800; color: #4F46E5; letter-spacing: -0.5px; }
            .brand-sub { font-size: 13px; color: #9CA3AF; margin-top: 2px; }
            .invoice-label { font-size: 36px; font-weight: 900; color: #111827; letter-spacing: -1px; }
            .invoice-num { font-size: 14px; color: #9CA3AF; margin-top: 4px; }
            .meta { display: flex; gap: 48px; margin-bottom: 40px; padding: 24px; background: #F9FAFB; border-radius: 16px; }
            .meta-block label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #9CA3AF; display: block; margin-bottom: 4px; }
            .meta-block span { font-size: 16px; font-weight: 600; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            thead th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #9CA3AF; padding-bottom: 12px; border-bottom: 2px solid #E5E7EB; }
            thead th.right { text-align: right; }
            thead th.center { text-align: center; }
            .total-section { display: flex; justify-content: flex-end; }
            .total-box { background: #F9FAFB; border-radius: 16px; padding: 20px 28px; min-width: 240px; }
            .total-final { display: flex; justify-content: space-between; gap: 40px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #111827; }
            .footer { margin-top: auto; padding-top: 48px; text-align: center; font-size: 13px; color: #D1D5DB; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="top">
              <div>
                <div class="brand">SubTrack</div>
                <div class="brand-sub">Split Expense Invoice</div>
              </div>
              <div style="text-align:right;">
                <div class="invoice-label">INVOICE</div>
                <div class="invoice-num">#${expense.id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>

            <div class="meta">
              <div class="meta-block">
                <label>Bill To</label>
                <span>Split Group</span>
              </div>
              <div class="meta-block">
                <label>Date</label>
                <span>${new Date(expense.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div class="meta-block">
                <label>Category</label>
                <span>${invoiceTitle}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="center">Qty</th>
                  <th class="right">Unit Price</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <div class="total-section">
              <div class="total-box">
                <div class="total-final">
                  <span>Total</span>
                  <span>${currency.symbol}${expense.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div class="footer">Generated by SubTrack • Automated Split Invoice</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const html = generateHtml();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      setExporting(false);
    } catch {
      Alert.alert('Error', 'Failed to generate PDF.');
      setExporting(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const invoiceId = await createInvoice(user.uid, {
        invoiceNumber: `INV-${new Date().getTime().toString().slice(-4)}`,
        clientName: 'Split Group',
        items,
        subtotal: expense.amount,
        taxRate: 0,
        taxAmount: 0,
        discountType: 'flat',
        discountValue: 0,
        discountAmount: 0,
        total: expense.amount,
        amountPaid: 0,
        balanceDue: expense.amount,
        status: 'unpaid',
        source: 'expense',
        linkedExpenseId: expense.id,
        notes: expense.notes,
        date: expense.date,
        payments: [],
      });
      router.replace(`/invoice/${invoiceId}`);
    } catch {
      Alert.alert('Error', 'Could not save invoice.');
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon source="arrow-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Invoice Preview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Preview card — uses palette.surface, no glass/transparency */}
        <View style={[styles.previewCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          {/* Card header */}
          <View style={[styles.cardHeader, { borderBottomColor: palette.line }]}>
            <View>
              <Text style={[styles.brandName, { color: palette.primary }]}>SubTrack</Text>
              <Text style={[styles.brandSub, { color: palette.muted }]}>Split Expense Invoice</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.invoiceLabel, { color: palette.text }]}>INVOICE</Text>
              <Text style={[styles.invoiceNum, { color: palette.muted }]}>
                #{expense.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={[styles.metaRow, { borderBottomColor: palette.line }]}>
            <View style={styles.metaBlock}>
              <Text style={[styles.metaLabel, { color: palette.muted }]}>Bill To</Text>
              <Text style={[styles.metaValue, { color: palette.text }]}>Split Group</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={[styles.metaLabel, { color: palette.muted }]}>Date</Text>
              <Text style={[styles.metaValue, { color: palette.text }]}>
                {formatShortDate(expense.date)}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={[styles.metaLabel, { color: palette.muted }]}>Category</Text>
              <Text style={[styles.metaValue, { color: palette.text }]}>{invoiceTitle}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.itemsSection}>
            <View style={styles.itemHeaderRow}>
              <Text style={[styles.colHeader, { color: palette.muted, flex: 1 }]}>Description</Text>
              <Text style={[styles.colHeader, { color: palette.muted, width: 80, textAlign: 'right' }]}>Amount</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.line }]} />

            {items.map((item, i) => (
              <View key={`${item.name}-${item.price}`}>
                <View style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: palette.text, flex: 1 }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemAmt, { color: palette.text }]}>
                    {currency.symbol}{item.price.toFixed(2)}
                  </Text>
                </View>
                {i < items.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: palette.line }]} />
                )}
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: palette.line }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: palette.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: palette.text }]}>
                {formatAmount(expense.amount)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable
          style={[styles.secondaryBtn, { borderColor: palette.primary }]}
          onPress={handleExportPdf}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Icon source="file-pdf-box" size={20} color={palette.primary} />
              <Text style={[styles.secondaryBtnText, { color: palette.primary }]}>Export PDF</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={handleSaveInvoice}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon source="content-save-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Save Invoice</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: palette.background },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
    iconBtn:      { padding: 8 },
    headerTitle:  { fontSize: 18, fontWeight: '600', color: palette.text },
    content:      { padding: 24, paddingBottom: 32 },
    previewCard:  { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
    cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
    brandName:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    brandSub:     { fontSize: 12, marginTop: 2 },
    invoiceLabel: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    invoiceNum:   { fontSize: 12, marginTop: 2 },
    metaRow:      { flexDirection: 'row', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16 },
    metaBlock:    { flex: 1 },
    metaLabel:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    metaValue:    { fontSize: 14, fontWeight: '600' },
    itemsSection: { padding: 20 },
    itemHeaderRow:{ flexDirection: 'row', marginBottom: 10 },
    colHeader:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    divider:      { height: StyleSheet.hairlineWidth, marginVertical: 2 },
    itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    itemName:     { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    itemAmt:      { fontSize: 14, fontWeight: '600', width: 80, textAlign: 'right' },
    totalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
    totalLabel:   { fontSize: 14, fontWeight: '700' },
    totalValue:   { fontSize: 16, fontWeight: '800' },
    footer:       { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
    secondaryBtn: { flex: 1, flexDirection: 'row', height: 52, borderRadius: 26, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', gap: 8 },
    secondaryBtnText: { fontSize: 15, fontWeight: '700' },
    primaryBtn:   { flex: 1, flexDirection: 'row', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', gap: 8 },
    primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
