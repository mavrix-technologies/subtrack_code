import SignaturePadModal from '@/components/common/SignaturePadModal';
import { showInvoiceExportRewardAd } from '@/components/ads/rewardedAds';
import { InvoiceBrand, useCurrency, useInvoiceBrand } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { deleteInvoice, recordPayment, updateInvoice } from '@/services/invoiceService';
import { sendInvoiceShareEmail } from '@/services/invoiceShareEmail';
import { getDueDaysLabel, InvoiceStatus, useInvoiceStore } from '@/store/useInvoiceStore';
import { generateInvoiceHtml, InvoiceData, TEMPLATES } from '@/utils/invoiceTemplates';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator, Alert, Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    Image as RNImage,
    ScrollView, StatusBar,
    StyleSheet, Text, TextInput,
    View
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath, SvgXml } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';

const { width: SW } = Dimensions.get('window');

// ── Preview WebView JS ────────────────────────────────────────────────────────
// Injected into every template preview WebView to:
//  1. Scale the 794px-wide page to fit the container width
//  2. Set the body height to match the scaled page height
//  3. Disable all user zoom / scroll interaction
const PREVIEW_JS = `
(function() {
  function scaleToFit() {
    var PAGE_W = 794;
    var PAGE_H = 1123;
    var vw = window.innerWidth || document.documentElement.clientWidth || PAGE_W;
    var scale = vw / PAGE_W;
    var scaledH = Math.ceil(PAGE_H * scale);

    var el = document.querySelector('.page') || document.body;
    el.style.transformOrigin = 'top left';
    el.style.transform = 'scale(' + scale + ')';
    el.style.width = PAGE_W + 'px';
    el.style.minHeight = PAGE_H + 'px';

    // Shrink wrapper to scaled size so no scrollbar appears
    document.documentElement.style.width = vw + 'px';
    document.documentElement.style.height = scaledH + 'px';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.width = vw + 'px';
    document.body.style.height = scaledH + 'px';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = '#fff';

    // Tell React Native the real rendered height
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'height', value: scaledH })
    );
  }

  if (document.readyState === 'complete') {
    scaleToFit();
  } else {
    window.addEventListener('load', scaleToFit);
  }
  window.addEventListener('resize', scaleToFit);

  // Block pinch-zoom
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  }, false);
  true;
})();
`;

// ── Torn edge ─────────────────────────────────────────────────────────────────
function TornEdge({ palette, flip }: { palette: any; flip: boolean }) {
  const h = 16; const w = SW - 32; const teeth = 14; const step = w / teeth;
  let d = 'M0,' + (flip ? 0 : h);
  for (let i = 0; i < teeth; i++) {
    const x1 = i * step + step * 0.3, x2 = i * step + step * 0.7, x3 = (i + 1) * step;
    d += flip
      ? ` L${x1},${h} L${x2},0 L${x3},0`
      : ` L${x1},0 L${x2},${h} L${x3},${h}`;
  }
  d += ` L${w},${flip ? 0 : h} Z`;
  return <Svg width={w} height={h} style={{ alignSelf: 'center' }}><SvgPath d={d} fill={palette.surface} /></Svg>;
}

// ── Dashed divider ────────────────────────────────────────────────────────────
function DashedLine({ palette }: { palette: any }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 1, backgroundColor: i % 2 === 0 ? palette.border : 'transparent' }} />
      ))}
    </View>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────
type StatusCfg = { label: string; color: string; icon: string; next: InvoiceStatus; nextLabel: string };
function useStatusConfig(p: any): Record<InvoiceStatus, StatusCfg> {
  return useMemo(() => ({
    draft:     { label: 'Draft',     color: p.muted,   icon: 'file-outline',        next: 'unpaid',  nextLabel: 'Send Invoice'   },
    unpaid:    { label: 'Unpaid',    color: p.warning, icon: 'clock-outline',        next: 'paid',    nextLabel: 'Mark as Paid'   },
    paid:      { label: 'Paid',      color: p.success, icon: 'check-circle-outline', next: 'unpaid',  nextLabel: 'Mark as Unpaid' },
    overdue:   { label: 'Overdue',   color: p.danger,  icon: 'alert-circle-outline', next: 'paid',    nextLabel: 'Mark as Paid'   },
    cancelled: { label: 'Cancelled', color: p.muted,   icon: 'cancel',               next: 'unpaid',  nextLabel: 'Reopen'         },
  } as Record<InvoiceStatus, StatusCfg>), [p]);
}

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'UPI', 'Card', 'Cheque', 'Other'];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function InvoiceDetailScreen() {
  const { id }        = useLocalSearchParams<{ id: string }>();
  const { palette }   = useTheme();
  const insets        = useSafeAreaInsets();
  const S             = useMemo(() => createStyles(palette), [palette]);
  const { invoices, updateInvoice: updateStore, deleteInvoice: deleteStore } = useInvoiceStore();
  const { formatAmount, currency } = useCurrency();
  const { brand } = useInvoiceBrand();
  const statusConfig  = useStatusConfig(palette);

  const [toggling, setToggling]         = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [templateId, setTemplateId]     = useState('classic');
  const bottomSheetRef                  = useRef<BottomSheet>(null);
  const snapPoints                      = useMemo(() => ['55%', '75%'], []);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount]       = useState('');
  const [payMethod, setPayMethod]       = useState('Bank Transfer');
  const [payNote, setPayNote]           = useState('');
  const [recordingPay, setRecordingPay] = useState(false);

  const invoice = invoices.find((inv: any) => inv.id === id);

  if (!invoice) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Icon source="file-document-outline" size={48} color={palette.muted} />
        <Text style={{ color: palette.text, marginTop: 12, fontSize: 16 }}>Invoice not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary, fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const cfg            = statusConfig[invoice.status];
  const due            = getDueDaysLabel(invoice.dueDate);
  const subtotal       = invoice.subtotal       ?? invoice.total;
  const taxAmount      = invoice.taxAmount      ?? 0;
  const discountAmount = invoice.discountAmount ?? 0;
  const taxRate        = invoice.taxRate        ?? 0;
  const amountPaid     = invoice.amountPaid     ?? 0;
  const balanceDue     = invoice.balanceDue     ?? invoice.total;
  const payments       = invoice.payments       ?? [];

  // Build InvoiceData for templates — includes brand identity
  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber, id: invoice.id,
    clientName: invoice.clientName, clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone, clientAddress: invoice.clientAddress,
    date: invoice.date, dueDate: invoice.dueDate, status: invoice.status,
    items: invoice.items, subtotal, taxRate, taxAmount, discountAmount,
    total: invoice.total, amountPaid, balanceDue, payments,
    notes: invoice.notes, terms: invoice.terms,
    businessName: brand.businessName,
    businessTagline: brand.tagline,
    logoUri: brand.logoUri || undefined,
    signatureUri: brand.signatureUri || undefined,
    signatureLabel: brand.signatureLabel || 'Authorized Signature',
  };

  const handleToggleStatus = async () => {
    try {
      setToggling(true);
      await updateInvoice(invoice.userId, invoice.id, { status: cfg.next });
      updateStore(invoice.id, { status: cfg.next });
    } catch { Alert.alert('Error', 'Could not update status.'); }
    finally { setToggling(false); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Invoice', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setDeleting(true);
          await deleteInvoice(invoice.userId, invoice.id);
          deleteStore(invoice.id);
          router.back();
        } catch { Alert.alert('Error', 'Could not delete.'); setDeleting(false); }
      }},
    ]);
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (amt > balanceDue + 0.01) { Alert.alert('Too much', `Balance due is only ${currency.symbol}${balanceDue.toFixed(2)}`); return; }
    try {
      setRecordingPay(true);
      const payment: any = { id: Date.now().toString(), amount: amt, date: new Date().toISOString(), method: payMethod };
      if (payNote.trim()) payment.note = payNote.trim();
      const newPaid    = amountPaid + amt;
      const newBalance = Math.max(0, invoice.total - newPaid);
      const newStatus: InvoiceStatus = newBalance <= 0.01 ? 'paid' : 'unpaid';
      await recordPayment(invoice.userId, invoice.id, payment, newPaid, newBalance, newStatus);
      updateStore(invoice.id, { payments: [...payments, payment], amountPaid: newPaid, balanceDue: newBalance, status: newStatus });
      setShowPayModal(false); setPayAmount(''); setPayNote('');
    } catch { Alert.alert('Error', 'Could not record payment.'); }
    finally { setRecordingPay(false); }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} style={S.iconBtn}>
          <Icon source="arrow-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={[S.headerTitle, { color: palette.text }]}>Invoice</Text>
        <Pressable onPress={handleDelete} style={S.iconBtn} disabled={deleting}>
          {deleting ? <ActivityIndicator size="small" color={palette.danger} />
            : <Icon source="trash-can-outline" size={22} color={palette.danger} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <View style={S.receiptWrap}>
          <TornEdge palette={palette} flip={false} />
          <View style={[S.paper, { backgroundColor: palette.surface }]}>

            {/* Brand + invoice number */}
            <View style={S.paperHeader}>
              <Text style={[S.brandName, { color: palette.primary }]}>SubTrack</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[S.invLabel, { color: palette.muted }]}>INVOICE</Text>
                <Text style={[S.invNum, { color: palette.text }]}>
                  {invoice.invoiceNumber || '#' + invoice.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Status + due */}
            <View style={[S.statusRow, { borderColor: cfg.color }]}>
              <Icon source={cfg.icon} size={13} color={cfg.color} />
              <Text style={[S.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              {due.label ? (
                <>
                  <View style={[S.statusSep, { backgroundColor: palette.border }]} />
                  <Icon source="calendar-clock" size={13} color={due.overdue ? palette.danger : due.urgent ? palette.warning : palette.muted} />
                  <Text style={[S.dueText, { color: due.overdue ? palette.danger : due.urgent ? palette.warning : palette.muted }]}>{due.label}</Text>
                </>
              ) : null}
            </View>

            {/* Amount hero */}
            <View style={S.amountSection}>
              <Text style={[S.amountLabel, { color: palette.muted }]}>Total Amount</Text>
              <Text style={[S.amountValue, { color: palette.text }]}>{formatAmount(invoice.total)}</Text>
              {amountPaid > 0 && (
                <View style={S.paidRow}>
                  <View style={[S.paidBar, { backgroundColor: palette.border }]}>
                    <View style={[S.paidFill, { backgroundColor: palette.success, width: `${Math.min(100, (amountPaid / invoice.total) * 100)}%` as any }]} />
                  </View>
                  <Text style={[S.paidLabel, { color: palette.muted }]}>{formatAmount(amountPaid)} paid · {formatAmount(balanceDue)} due</Text>
                </View>
              )}
            </View>

            <DashedLine palette={palette} />

            {/* Bill to + dates */}
            <View style={S.billSection}>
              <View style={S.billCol}>
                <Text style={[S.fieldLabel, { color: palette.muted }]}>Bill To</Text>
                <Text style={[S.fieldValue, { color: palette.text }]}>{invoice.clientName}</Text>
                {invoice.clientEmail   ? <Text style={[S.fieldSub, { color: palette.muted }]}>{invoice.clientEmail}</Text>   : null}
                {invoice.clientPhone   ? <Text style={[S.fieldSub, { color: palette.muted }]}>{invoice.clientPhone}</Text>   : null}
                {invoice.clientAddress ? <Text style={[S.fieldSub, { color: palette.muted }]}>{invoice.clientAddress}</Text> : null}
              </View>
              <View style={[S.billCol, { alignItems: 'flex-end' }]}>
                <Text style={[S.fieldLabel, { color: palette.muted }]}>Issue Date</Text>
                <Text style={[S.fieldValue, { color: palette.text }]}>
                  {new Date(invoice.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                {invoice.dueDate ? (
                  <>
                    <Text style={[S.fieldLabel, { color: palette.muted, marginTop: 10 }]}>Due Date</Text>
                    <Text style={[S.fieldValue, { color: due.overdue ? palette.danger : due.urgent ? palette.warning : palette.text }]}>
                      {new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            <DashedLine palette={palette} />

            {/* Items */}
            <View style={S.itemsSection}>
              <View style={S.itemHeaderRow}>
                <Text style={[S.colHead, { color: palette.muted, flex: 1 }]}>Description</Text>
                <Text style={[S.colHead, { color: palette.muted, width: 30, textAlign: 'center' }]}>Qty</Text>
                <Text style={[S.colHead, { color: palette.muted, width: 80, textAlign: 'right' }]}>Amount</Text>
              </View>
              {invoice.items.map((item: any, i: number) => (
                <View key={i} style={S.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.itemName, { color: palette.text }]}>{item.name}</Text>
                    {item.description ? <Text style={[S.itemDesc, { color: palette.muted }]}>{item.description}</Text> : null}
                  </View>
                  <Text style={[S.itemQty, { color: palette.muted }]}>×{item.qty}</Text>
                  <Text style={[S.itemAmt, { color: palette.text }]}>{currency.symbol}{(item.price * item.qty).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            <DashedLine palette={palette} />

            {/* Totals */}
            <View style={S.totalsSection}>
              {subtotal !== invoice.total && (
                <View style={S.totalRow}><Text style={[S.totalLbl, { color: palette.muted }]}>Subtotal</Text><Text style={[S.totalVal, { color: palette.text }]}>{currency.symbol}{subtotal.toFixed(2)}</Text></View>
              )}
              {discountAmount > 0 && (
                <View style={S.totalRow}><Text style={[S.totalLbl, { color: palette.muted }]}>Discount</Text><Text style={[S.totalVal, { color: palette.success }]}>-{currency.symbol}{discountAmount.toFixed(2)}</Text></View>
              )}
              {taxAmount > 0 && (
                <View style={S.totalRow}><Text style={[S.totalLbl, { color: palette.muted }]}>Tax ({taxRate}%)</Text><Text style={[S.totalVal, { color: palette.text }]}>{currency.symbol}{taxAmount.toFixed(2)}</Text></View>
              )}
              <View style={[S.totalRow, S.grandRow]}>
                <Text style={[S.grandLbl, { color: palette.text }]}>Total</Text>
                <Text style={[S.grandVal, { color: palette.text }]}>{formatAmount(invoice.total)}</Text>
              </View>
              {amountPaid > 0 && (
                <View style={S.totalRow}><Text style={[S.totalLbl, { color: palette.success }]}>Paid</Text><Text style={[S.totalVal, { color: palette.success }]}>-{currency.symbol}{amountPaid.toFixed(2)}</Text></View>
              )}
              {balanceDue > 0.01 && (
                <View style={[S.totalRow, S.balanceRow, { borderColor: palette.warning }]}>
                  <Text style={[S.grandLbl, { color: palette.warning }]}>Balance Due</Text>
                  <Text style={[S.grandVal, { color: palette.warning }]}>{currency.symbol}{balanceDue.toFixed(2)}</Text>
                </View>
              )}
            </View>

            {/* Notes / Terms */}
            {(invoice.notes || invoice.terms) && (
              <>
                <DashedLine palette={palette} />
                <View style={S.notesSection}>
                  {invoice.notes ? <><Text style={[S.fieldLabel, { color: palette.muted }]}>Notes</Text><Text style={[S.notesText, { color: palette.text }]}>{invoice.notes}</Text></> : null}
                  {invoice.terms ? <><Text style={[S.fieldLabel, { color: palette.muted, marginTop: invoice.notes ? 10 : 0 }]}>Payment Terms</Text><Text style={[S.notesText, { color: palette.muted }]}>{invoice.terms}</Text></> : null}
                </View>
              </>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <>
                <DashedLine palette={palette} />
                <View style={S.notesSection}>
                  <Text style={[S.fieldLabel, { color: palette.muted }]}>Payment History</Text>
                  {payments.map((pay: any, i: number) => (
                    <View key={pay.id} style={[S.payHistRow, i > 0 && { marginTop: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[S.itemName, { color: palette.text }]}>{pay.method}</Text>
                        <Text style={[S.itemDesc, { color: palette.muted }]}>
                          {new Date(pay.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          {pay.note ? '  ·  ' + pay.note : ''}
                        </Text>
                      </View>
                      <Text style={[S.itemAmt, { color: palette.success }]}>+{currency.symbol}{pay.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <DashedLine palette={palette} />
            <View style={S.receiptFooter}>
              <Text style={[S.footerText, { color: palette.muted }]}>SubTrack</Text>
              <Text style={[S.footerText, { color: palette.muted }]}>{invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>
          <TornEdge palette={palette} flip={true} />

          {/* Action buttons */}
          <View style={S.actionsRow}>
            <Pressable style={[S.actionBtn, { borderColor: cfg.color }]} onPress={handleToggleStatus} disabled={toggling}>
              {toggling ? <ActivityIndicator size="small" color={cfg.color} />
                : <><Icon source={cfg.icon} size={16} color={cfg.color} /><Text style={[S.actionBtnText, { color: cfg.color }]}>{cfg.nextLabel}</Text></>}
            </Pressable>
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <Pressable style={[S.actionBtn, { borderColor: palette.success }]}
                onPress={() => { setShowPayModal(true); setTimeout(() => bottomSheetRef.current?.expand(), 50); }}>
                <Icon source="cash-plus" size={16} color={palette.success} />
                <Text style={[S.actionBtnText, { color: palette.success }]}>Record Payment</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Export footer */}
      <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, 20), borderTopColor: palette.border }]}>
        <Pressable style={[S.exportBtn, { backgroundColor: palette.primary }]} onPress={() => setShowPreview(true)}>
          <Icon source="file-pdf-box" size={20} color="#fff" />
          <Text style={S.exportText}>Preview & Export PDF</Text>
        </Pressable>
      </View>

      {/* PDF Preview Modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowPreview(false)}>
        <PdfPreviewModal
          invoice={invoiceData}
          currency={currency}
          palette={palette}
          templateId={templateId}
          onSelectTemplate={setTemplateId}
          onClose={() => setShowPreview(false)}
          brand={brand}
        />
      </Modal>

      {/* Record Payment Bottom Sheet */}
      {showPayModal && (
        <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={() => setShowPayModal(false)}
          backgroundStyle={{ backgroundColor: palette.surface }} handleIndicatorStyle={{ backgroundColor: palette.border }}>
          <BottomSheetScrollView>
            <View style={[S.sheetHeader, { borderBottomColor: palette.border }]}>
              <View>
                <Text style={[S.sheetTitle, { color: palette.text }]}>Record Payment</Text>
                <Text style={[S.sheetSub, { color: palette.muted }]}>Balance due: {currency.symbol}{balanceDue.toFixed(2)}</Text>
              </View>
              <Pressable onPress={() => setShowPayModal(false)}><Icon source="close" size={22} color={palette.muted} /></Pressable>
            </View>
            <Text style={[S.sheetLabel, { color: palette.muted }]}>AMOUNT</Text>
            <View style={[S.sheetAmtRow, { borderColor: palette.border }]}>
              <Text style={[S.sheetCurrency, { color: palette.muted }]}>{currency.symbol}</Text>
              <BottomSheetTextInput style={[S.sheetAmtInput, { color: palette.text }]} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={palette.muted} />
            </View>
            <View style={S.quickFillRow}>
              {[balanceDue, balanceDue / 2, balanceDue / 4].map((amt, i) => (
                <Pressable key={i} style={[S.quickFillBtn, { borderColor: palette.border }]} onPress={() => setPayAmount(amt.toFixed(2))}>
                  <Text style={[S.quickFillText, { color: palette.text }]}>{i === 0 ? 'Full' : i === 1 ? '½' : '¼'}</Text>
                  <Text style={[S.quickFillAmt, { color: palette.muted }]}>{currency.symbol}{amt.toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[S.sheetLabel, { color: palette.muted }]}>METHOD</Text>
            <View style={S.methodGrid}>
              {PAYMENT_METHODS.map(m => (
                <Pressable key={m} style={[S.methodChip, { borderColor: payMethod === m ? palette.primary : palette.border, backgroundColor: payMethod === m ? palette.primary + '18' : 'transparent' }]} onPress={() => setPayMethod(m)}>
                  <Text style={[S.methodText, { color: payMethod === m ? palette.primary : palette.text }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[S.sheetLabel, { color: palette.muted }]}>NOTE (optional)</Text>
            <View style={[S.sheetNoteBox, { borderColor: palette.border }]}>
              <BottomSheetTextInput style={[S.sheetNoteInput, { color: palette.text }]} value={payNote} onChangeText={setPayNote} placeholder="Add a note..." placeholderTextColor={palette.muted} />
            </View>
            <Pressable style={[S.sheetSaveBtn, { backgroundColor: palette.primary }]} onPress={handleRecordPayment} disabled={recordingPay}>
              {recordingPay ? <ActivityIndicator color="#fff" /> : <Text style={S.sheetSaveTxt}>Save Payment</Text>}
            </Pressable>
          </BottomSheetScrollView>
        </BottomSheet>
      )}
    </View>
  );
}

// ── PDF Preview Modal with swipe to change ──────────────────────────────────
function PdfPreviewModal({ invoice, currency, palette, templateId, onSelectTemplate, onClose, brand }: {
  invoice: InvoiceData; currency: any; palette: any;
  templateId: string; onSelectTemplate: (id: string) => void;
  onClose: () => void;
  brand: InvoiceBrand;
}) {
  const insets = useSafeAreaInsets();
  const sym = currency.symbol;
  const scrollRef = useRef<ScrollView>(null);
  const activeWebViewRef = useRef<View>(null);
  const [isGridMode, setIsGridMode] = useState(false);
  const [shareLoading, setShareLoading] = useState<string | null>(null);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [emailRecipientModal, setEmailRecipientModal] = useState(false);
  const [emailRecipientDraft, setEmailRecipientDraft] = useState('');

  // Local editable brand state (saved on confirm)
  const { saveBrand } = useInvoiceBrand();
  const [editName, setEditName]   = useState(brand.businessName);
  const [editTag, setEditTag]     = useState(brand.tagline);
  const [editPrefix, setEditPrefix] = useState(brand.filePrefix);
  const [editLogo, setEditLogo]   = useState(brand.logoUri);
  const [editSig, setEditSig]     = useState(brand.signatureUri);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [sigLabel, setSigLabel] = useState(brand.signatureLabel || 'Authorized Signature');

  // Keep local state in sync when brand prop changes
  React.useEffect(() => {
    setEditName(brand.businessName);
    setEditTag(brand.tagline);
    setEditPrefix(brand.filePrefix);
    setEditLogo(brand.logoUri);
    setEditSig(brand.signatureUri);
    setSigLabel(brand.signatureLabel || 'Authorized Signature');
  }, [brand]);

  const pickImage = async (type: 'logo' | 'signature') => {
    if (type === 'signature') {
      // Must close the brand modal first — iOS won't stack two modals
      setShowBrandModal(false);
      // Small delay so the brand modal finishes dismissing before the signature pad opens
      setTimeout(() => setShowSignaturePad(true), 350);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to pick an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUri = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
      setEditLogo(dataUri);
    }
  };

  const handleSignatureSave = (signature: string) => {
    setEditSig(signature);
    setShowSignaturePad(false);
    // Persist both the signature and its label to brand storage
    saveBrand({ signatureUri: signature, signatureLabel: sigLabel.trim() || 'Authorized Signature' });
    setTimeout(() => setShowBrandModal(true), 350);
  };

  const saveBrandSettings = async () => {
    await saveBrand({
      businessName: editName.trim() || 'SubTrack',
      tagline: editTag.trim(),
      filePrefix: editPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'invoice',
      logoUri: editLogo,
      signatureUri: editSig,
      signatureLabel: sigLabel.trim() || 'Authorized Signature',
    });
    setShowBrandModal(false);
  };

  // Safe file name prefix from brand
  const filePrefix = (brand.filePrefix || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
  const invSuffix  = (invoice.invoiceNumber || invoice.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '_');

  // ── Share as PDF ────────────────────────────────────────────────────────────
  const handleSharePdf = async () => {
    setShareLoading('pdf');
    try {
      const html = generateInvoiceHtml(templateId, invoice, sym);
      const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
      const cacheDir = FileSystem.cacheDirectory ?? '';
      if (!cacheDir) throw new Error('Cache directory not available on this device.');
      const dest = `${cacheDir}${filePrefix}_${invSuffix}.pdf`;
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: dest });
      const check = await FileSystem.getInfoAsync(dest);
      if (!check.exists) throw new Error('PDF file could not be written to device storage.');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');

      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `${invoice.invoiceNumber} — Invoice PDF`,
      });
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not generate PDF.');
    } finally {
      setShareLoading(null);
    }
  };

  // ── Email summary: prompt for recipient then send ───────────────────────────
  const handleShareEmail = () => {
    setEmailRecipientDraft((invoice.clientEmail || '').trim());
    setEmailRecipientModal(true);
  };

  const validateEmailBasic = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const submitInvoiceShareEmail = async () => {
    Keyboard.dismiss();
    const to = emailRecipientDraft.trim();
    if (!validateEmailBasic(to)) {
      Alert.alert('Invalid email', 'Enter a valid address (example: client@company.com).');
      return;
    }
    setEmailRecipientModal(false);
    setShareLoading('email');
    try {
      const result = await sendInvoiceShareEmail({ invoice, currencySymbol: sym, toEmail: to });
      if (result === 'sent') {
        Alert.alert('Email sent', `Invoice summary was sent to ${to}.`);
      } else if (result === 'draft') {
        Alert.alert('Compose email', 'Your mail app opened with this invoice summary as a draft.');
      } else if (result === 'skipped') {
        Alert.alert('Invalid email', 'Check the address and try again.');
      } else {
        Alert.alert('Could not email', 'Set EXPO_PUBLIC_GOOGLE_MAIL_SCRIPT_URL in .env or try again.');
      }
    } finally {
      setShareLoading(null);
    }
  };

  // ── Save as PNG image ───────────────────────────────────────────────────────
  const handleShareImage = async () => {
    setShareLoading('image');
    try {
      // Capture the visible WebView container as a PNG
      if (!activeWebViewRef.current) throw new Error('Preview not ready. Please wait a moment and try again.');
      const pngUri = await captureRef(activeWebViewRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
      const cacheDir = FileSystem.cacheDirectory ?? '';
      if (!cacheDir) throw new Error('Cache directory not available on this device.');
      const dest = `${cacheDir}${filePrefix}_${invSuffix}.png`;
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: pngUri, to: dest });
      const check = await FileSystem.getInfoAsync(dest);
      if (!check.exists) throw new Error('Image file could not be written to device storage.');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');

      await Sharing.shareAsync(dest, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `${invoice.invoiceNumber} — Invoice Image`,
      });
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not capture invoice image.');
    } finally {
      setShareLoading(null);
    }
  };

  // ── Export as CSV ───────────────────────────────────────────────────────────
  const handleShareExcel = async () => {
    setShareLoading('excel');
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) throw new Error('Cache directory not available on this device.');
      const dest = `${cacheDir}${filePrefix}_${invSuffix}.csv`;

      // Build CSV content
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows: string[] = [];

      // ── Summary ──
      rows.push([
        'Invoice Number', 'Client', 'Client Email', 'Client Phone',
        'Issue Date', 'Due Date', 'Status',
        'Subtotal', 'Tax Rate %', 'Tax Amount', 'Discount',
        'Total', 'Amount Paid', 'Balance Due',
        'Notes', 'Terms',
      ].join(','));
      rows.push([
        esc(invoice.invoiceNumber || invoice.id.slice(0, 8)),
        esc(invoice.clientName),
        esc(invoice.clientEmail ?? ''),
        esc(invoice.clientPhone ?? ''),
        esc(invoice.date ? new Date(invoice.date).toLocaleDateString() : ''),
        esc(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''),
        esc(invoice.status),
        esc(invoice.subtotal.toFixed(2)),
        esc(invoice.taxRate.toFixed(2)),
        esc(invoice.taxAmount.toFixed(2)),
        esc(invoice.discountAmount.toFixed(2)),
        esc(invoice.total.toFixed(2)),
        esc(invoice.amountPaid.toFixed(2)),
        esc(invoice.balanceDue.toFixed(2)),
        esc(invoice.notes ?? ''),
        esc(invoice.terms ?? ''),
      ].join(','));

      // ── Line items ──
      rows.push('');
      rows.push('Line Items');
      rows.push(['#', 'Description', 'Notes', 'Unit Price', 'Qty', 'Line Total'].join(','));
      invoice.items.forEach((item, i) => {
        rows.push([
          esc(i + 1),
          esc(item.name),
          esc(item.description ?? ''),
          esc(item.price.toFixed(2)),
          esc(item.qty),
          esc((item.price * item.qty).toFixed(2)),
        ].join(','));
      });

      // ── Payment history ──
      if (invoice.payments && invoice.payments.length > 0) {
        rows.push('');
        rows.push('Payment History');
        rows.push(['Date', 'Method', 'Amount', 'Note'].join(','));
        invoice.payments.forEach(pay => {
          rows.push([
            esc(new Date(pay.date).toLocaleDateString()),
            esc(pay.method),
            esc(pay.amount.toFixed(2)),
            esc(pay.note ?? ''),
          ].join(','));
        });
      }

      const csv = rows.join('\r\n');

      // Delete stale file if exists, then write fresh
      const existing = await FileSystem.getInfoAsync(dest);
      if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.writeAsStringAsync(dest, csv, { encoding: 'utf8' });

      // Confirm file was written before sharing
      const check = await FileSystem.getInfoAsync(dest);
      if (!check.exists) throw new Error('CSV file could not be written to device storage.');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Invoice as CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Sharing unavailable', 'Your device does not support file sharing.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not generate CSV. Please try again.');
    } finally {
      setShareLoading(null);
    }
  };

  // ── Copy Link ───────────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    setShareLoading('link');
    try {
      const link = `subscriptiontracker://invoice/${invoice.id}`;
      await Clipboard.setStringAsync(link);
      Alert.alert('Link Copied!', 'Invoice deep link has been copied to your clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy link.');
    } finally {
      setShareLoading(null);
    }
  };

  const openExportOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Export Invoice',
          options: ['Cancel', 'Share as PDF', 'Email summary to client', 'Share as Image', 'Export as CSV', 'Copy Link'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleSharePdf();
          if (buttonIndex === 2) handleShareEmail();
          if (buttonIndex === 3) handleShareImage();
          if (buttonIndex === 4) handleShareExcel();
          if (buttonIndex === 5) handleCopyLink();
        }
      );
      return;
    }

    const openMoreExportOptions = () => {
      Alert.alert(
        'More Export Options',
        'Choose another export action.',
        [
          { text: 'Email summary to client', onPress: handleShareEmail },
          { text: 'Export as CSV', onPress: handleShareExcel },
          { text: 'Copy Link', onPress: handleCopyLink },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    };

    Alert.alert(
      'Export Invoice',
      'Choose how to share this invoice.',
      [
        { text: 'Share as PDF', onPress: handleSharePdf },
        { text: 'Email summary to client', onPress: handleShareEmail },
        { text: 'Share as Image', onPress: handleShareImage },
        { text: 'More', onPress: openMoreExportOptions },
      ],
      { cancelable: true }
    );
  };

  const handleNativeShare = async () => {
    if (shareLoading) return;

    setShareLoading('ad');
    try {
      await showInvoiceExportRewardAd();
    } catch {
      // Export should still work if the ad has no fill or cannot load.
    } finally {
      setShareLoading(null);
      setTimeout(openExportOptions, 120);
    }
  };

  const currentTemplate = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SW);
    if (index >= 0 && index < TEMPLATES.length) {
      if (TEMPLATES[index].id !== templateId) {
        onSelectTemplate(TEMPLATES[index].id);
      }
    }
  };

  const toggleGridMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGridMode(!isGridMode);
  };

  const handleSelectFromGrid = (id: string) => {
    onSelectTemplate(id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGridMode(false);
    setTimeout(() => {
      const idx = TEMPLATES.findIndex(t => t.id === id);
      scrollRef.current?.scrollTo({ x: idx * SW, animated: false });
    }, 50);
  };

  // Capture the active preview container when exporting a PNG.
  const activeHtml = generateInvoiceHtml(templateId, invoice, sym);
  const initialIndex = TEMPLATES.findIndex(t => t.id === templateId);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Toolbar */}
      <View style={[pvS.toolbar, { paddingTop: insets.top + 16, paddingBottom: 16 }]}>
        <Pressable onPress={onClose} style={pvS.toolbarClose} hitSlop={12}>
          <Icon source="close" size={24} color="#374151" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'capitalize', letterSpacing: 0.5 }}>
            {isGridMode ? 'Select Template' : currentTemplate.name}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
            {isGridMode ? 'All Layouts' : 'Template'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[pvS.toolbarClose, { backgroundColor: '#e5e7eb' }]} onPress={() => setShowBrandModal(true)} hitSlop={8}>
            <Icon source="tune-variant" size={20} color="#374151" />
          </Pressable>
          <Pressable
            style={[pvS.exportBtn, { backgroundColor: palette.primary }]}
            onPress={handleNativeShare}
            disabled={!!shareLoading}
          >
            {shareLoading ? <ActivityIndicator size="small" color="#fff" />
              : <Icon source="export-variant" size={20} color="#fff" />}
          </Pressable>
        </View>
      </View>

      {/* Swipeable Previews */}
      {!isGridMode && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentOffset={{ x: initialIndex * SW, y: 0 }}
          style={{ flex: 1 }}
        >
          {TEMPLATES.map(t => (
            <View key={t.id} style={{ width: SW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
              {t.id === templateId ? (
                <View
                  ref={activeWebViewRef}
                  style={{ width: '100%', aspectRatio: 210 / 297, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  collapsable={false}
                >
                  <WebView
                    source={{ html: activeHtml }}
                    style={{ flex: 1 }}
                    scalesPageToFit={false}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    injectedJavaScript={PREVIEW_JS}
                    onMessage={() => {}}
                  />
                </View>
              ) : (
                <View style={{ width: '100%', aspectRatio: 210 / 297, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <WebView
                    source={{ html: generateInvoiceHtml(t.id, invoice, sym) }}
                    style={{ flex: 1 }}
                    scalesPageToFit={false}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    injectedJavaScript={PREVIEW_JS}
                    onMessage={() => {}}
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Grid View Inline */}
      {isGridMode && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {TEMPLATES.map(t => {
              const isActive = t.id === templateId;
              return (
                <View key={t.id} style={{ width: '48%', marginBottom: 20 }}>
                  <Pressable
                    onPress={() => handleSelectFromGrid(t.id)}
                    style={{
                      aspectRatio: 210 / 297,
                      backgroundColor: '#fff',
                      borderRadius: 10,
                      borderWidth: 2.5,
                      borderColor: isActive ? palette.primary : '#e5e7eb',
                      overflow: 'hidden',
                      boxShadow: isActive ? '0 4px 8px rgba(0,0,0,0.14)' : '0 2px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    {/* pointer-events none so taps reach the Pressable */}
                    <View style={{ flex: 1, pointerEvents: 'none' }}>
                      <WebView
                        source={{ html: generateInvoiceHtml(t.id, invoice, sym) }}
                        style={{ flex: 1 }}
                        scalesPageToFit={false}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        injectedJavaScript={PREVIEW_JS}
                        onMessage={() => {}}
                      />
                    </View>
                    {/* selected overlay */}
                    {isActive && (
                      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: `${palette.primary}10`, pointerEvents: 'none' }} />
                    )}
                    {/* checkmark badge */}
                    {isActive && (
                      <View style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon source="check" size={14} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? palette.primary : '#4b5563', textAlign: 'center', marginTop: 8 }}>
                    {t.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }}>
                    {t.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Floating Action Button for Template Selection */}
      <View style={{ alignItems: 'center', paddingVertical: 16, paddingBottom: insets.bottom + 16, backgroundColor: '#FFFFFF', zIndex: 10 }}>
        <Pressable
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.18)' }}
          onPress={toggleGridMode}
        >
          <Icon source={isGridMode ? "close" : "view-grid-outline"} size={28} color="#fff" />
        </Pressable>
      </View>

      {/* ── Recipient email for invoice summary ───────────────────────────── */}
      <Modal
        visible={emailRecipientModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailRecipientModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(17,24,39,0.48)' }]}
              onPress={() => {
                Keyboard.dismiss();
                setEmailRecipientModal(false);
              }}
            />
            <View style={{ paddingHorizontal: 24, zIndex: 1 }}>
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Send invoice summary</Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 18 }}>
                  Enter the recipient&apos;s email. This does not update the invoice &quot;Bill to&quot; field.
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', marginTop: 16, letterSpacing: 0.06, textTransform: 'uppercase' }}>
                  Recipient email
                </Text>
                <TextInput
                  value={emailRecipientDraft}
                  onChangeText={setEmailRecipientDraft}
                  placeholder="name@company.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={submitInvoiceShareEmail}
                  style={{
                    marginTop: 8,
                    backgroundColor: '#f9fafb',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
                    fontSize: 16,
                    color: '#111827',
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setEmailRecipientModal(false);
                    }}
                    style={{ paddingVertical: 12, paddingHorizontal: 16 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#6b7280' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitInvoiceShareEmail}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: 24,
                      backgroundColor: palette.primary,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Send</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Brand / Identity Settings Modal ─────────────────────────────── */}
      <Modal visible={showBrandModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBrandModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <Pressable onPress={() => setShowBrandModal(false)} hitSlop={12}>
              <Icon source="close" size={24} color="#374151" />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Invoice Branding</Text>
            <Pressable onPress={saveBrandSettings} style={{ backgroundColor: palette.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} showsVerticalScrollIndicator={false}>

            {/* Business Name */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Business Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your Business Name"
                placeholderTextColor="#9ca3af"
                style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '600', color: '#111827' }}
              />
            </View>

            {/* Tagline */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Tagline / Subtitle</Text>
              <TextInput
                value={editTag}
                onChangeText={setEditTag}
                placeholder="e.g. Professional Services"
                placeholderTextColor="#9ca3af"
                style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' }}
              />
            </View>

            {/* File Name Prefix */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Export File Name Prefix</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Files will be named: <Text style={{ fontWeight: '700', color: '#374151' }}>{(editPrefix || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_')}_INV-001.pdf</Text></Text>
              <TextInput
                value={editPrefix}
                onChangeText={setEditPrefix}
                placeholder="invoice"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' }}
              />
            </View>

            {/* Logo */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Company Logo</Text>
              <Pressable
                onPress={() => pickImage('logo')}
                style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: editLogo ? '#4f46e5' : '#e5e7eb', borderStyle: editLogo ? 'solid' : 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}
              >
                {editLogo ? (
                  <View style={{ width: '100%', alignItems: 'center', padding: 16 }}>
                    <RNImage source={{ uri: editLogo }} style={{ width: 160, height: 64, resizeMode: 'contain' }} />
                    <Text style={{ marginTop: 10, fontSize: 13, color: '#4f46e5', fontWeight: '600' }}>Tap to change</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
                    <Icon source="image-plus" size={32} color="#9ca3af" />
                    <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '600' }}>Tap to add logo</Text>
                    <Text style={{ fontSize: 12, color: '#9ca3af' }}>PNG or JPG, shown on all invoices</Text>
                  </View>
                )}
              </Pressable>
              {editLogo ? (
                <Pressable onPress={() => setEditLogo('')} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: '600' }}>Remove logo</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Signature */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Authorised Signature</Text>
              <Pressable
                onPress={() => pickImage('signature')}
                style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: editSig ? '#4f46e5' : '#e5e7eb', borderStyle: editSig ? 'solid' : 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}
              >
                {editSig ? (
                  <View style={{ width: '100%', alignItems: 'center', padding: 16 }}>
                    {editSig.startsWith('data:image/svg+xml;base64,') ? (
                      <SvgXml
                        xml={atob(editSig.replace('data:image/svg+xml;base64,', ''))}
                        width={200}
                        height={72}
                      />
                    ) : (
                      <RNImage source={{ uri: editSig }} style={{ width: 200, height: 72, resizeMode: 'contain' }} />
                    )}
                    <Text style={{ marginTop: 10, fontSize: 13, color: '#4f46e5', fontWeight: '600' }}>Tap to change</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
                    <Icon source="draw" size={32} color="#9ca3af" />
                    <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '600' }}>Tap to add signature</Text>
                    <Text style={{ fontSize: 12, color: '#9ca3af' }}>Appears at the bottom of invoices</Text>
                  </View>
                )}
              </Pressable>
              {editSig ? (
                <Pressable onPress={() => setEditSig('')} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: '600' }}>Remove signature</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Preview note */}
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon source="information-outline" size={18} color="#3b82f6" />
              <Text style={{ flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 20 }}>
                Changes apply to all invoice exports. Swipe the preview to see your branding live.
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <SignaturePadModal
        visible={showSignaturePad}
        onSave={handleSignatureSave}
        onClose={() => {
          setShowSignaturePad(false);
          setTimeout(() => setShowBrandModal(true), 350);
        }}
        label={sigLabel}
        onLabelChange={setSigLabel}
        initialSignature={editSig || undefined}
      />
    </View>
  );
}

// ── Preview styles ────────────────────────────────────────────────────────────
const pvS = StyleSheet.create({
  toolbar:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  toolbarClose:       { padding: 8, backgroundColor: '#e5e7eb', borderRadius: 20 },
  exportBtn:          { padding: 8, borderRadius: 20, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});

// ── Main screen styles ────────────────────────────────────────────────────────
function createStyles(palette: any) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: palette.background },
    container:     { flex: 1, backgroundColor: palette.background },
    scroll:        { paddingBottom: 32 },
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    iconBtn:       { padding: 8 },
    headerTitle:   { fontSize: 16, fontWeight: '700' },
    receiptWrap:   { paddingHorizontal: 16, paddingTop: 20 },
    paper:         { paddingHorizontal: 16, paddingVertical: 4 },
    paperHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 14 },
    brandName:     { fontSize: 19, fontWeight: '900' },
    invLabel:      { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    invNum:        { fontSize: 15, fontWeight: '800', marginTop: 2 },
    statusRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
    statusSep:     { width: 1, height: 12, marginHorizontal: 4 },
    statusText:    { fontSize: 12, fontWeight: '700' },
    dueText:       { fontSize: 12, fontWeight: '600' },
    amountSection: { alignItems: 'center', paddingVertical: 14, gap: 4 },
    amountLabel:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
    amountValue:   { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
    paidRow:       { width: '100%', gap: 5, marginTop: 4 },
    paidBar:       { height: 4, borderRadius: 2, overflow: 'hidden' },
    paidFill:      { height: 4, borderRadius: 2 },
    paidLabel:     { fontSize: 12, textAlign: 'center' },
    billSection:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    billCol:       { flex: 1 },
    fieldLabel:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
    fieldValue:    { fontSize: 14, fontWeight: '600' },
    fieldSub:      { fontSize: 12, marginTop: 2 },
    itemsSection:  { paddingVertical: 6 },
    itemHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 7 },
    colHead:       { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
    itemName:      { fontSize: 14, fontWeight: '600' },
    itemDesc:      { fontSize: 12, marginTop: 2 },
    itemQty:       { fontSize: 13, width: 26, textAlign: 'center' },
    itemAmt:       { fontSize: 14, fontWeight: '600', width: 80, textAlign: 'right' },
    totalsSection: { paddingVertical: 6 },
    totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
    totalLbl:      { fontSize: 13 },
    totalVal:      { fontSize: 13, fontWeight: '600' },
    grandRow:      { paddingVertical: 8, marginTop: 3, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
    grandLbl:      { fontSize: 14, fontWeight: '700' },
    grandVal:      { fontSize: 16, fontWeight: '800' },
    balanceRow:    { marginTop: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, borderWidth: 1 },
    notesSection:  { paddingVertical: 6 },
    notesText:     { fontSize: 13, lineHeight: 20, marginTop: 4 },
    payHistRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    receiptFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    footerText:    { fontSize: 11 },
    actionsRow:    { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 8 },
    actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11 },
    actionBtnText: { fontSize: 13, fontWeight: '700' },
    footer:        { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    exportBtn:     { flexDirection: 'row', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', gap: 10 },
    exportText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
    // payment sheet
    sheetHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
    sheetTitle:    { fontSize: 20, fontWeight: '800' },
    sheetSub:      { fontSize: 13, marginTop: 3 },
    sheetLabel:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 8, marginTop: 16 },
    sheetAmtRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
    sheetCurrency: { fontSize: 22, fontWeight: '700' },
    sheetAmtInput: { flex: 1, fontSize: 32, fontWeight: '900', paddingVertical: 0 },
    quickFillRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 10 },
    quickFillBtn:  { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    quickFillText: { fontSize: 13, fontWeight: '700' },
    quickFillAmt:  { fontSize: 11, marginTop: 2 },
    methodGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
    methodChip:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
    methodText:    { fontSize: 13, fontWeight: '600' },
    sheetNoteBox:  { marginHorizontal: 20, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
    sheetNoteInput:{ fontSize: 15, paddingVertical: 0 },
    sheetSaveBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 20, marginTop: 20, marginBottom: 32, height: 54, borderRadius: 27 },
    sheetSaveTxt:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  });
}
