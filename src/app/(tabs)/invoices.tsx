import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { Invoice, InvoiceStatus, getDueDaysLabel, useInvoiceStore } from '@/store/useInvoiceStore';
import { formatShortDate } from '@/utils/dates';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

const CHART_H = 160;

const STATUS_FILTERS = ['All', 'Unpaid', 'Paid', 'Overdue', 'Draft'] as const;
type FilterKey = typeof STATUS_FILTERS[number];

function useStatusCfg(palette: any) {
  return useMemo<Record<InvoiceStatus, { label: string; color: string; icon: string }>>(() => ({
    draft:     { label: 'Draft',     color: palette.muted,   icon: 'file-outline' },
    unpaid:    { label: 'Unpaid',    color: palette.warning, icon: 'clock-outline' },
    paid:      { label: 'Paid',      color: palette.success, icon: 'check-circle-outline' },
    overdue:   { label: 'Overdue',   color: palette.danger,  icon: 'alert-circle-outline' },
    cancelled: { label: 'Cancelled', color: palette.muted,   icon: 'cancel' },
  }), [palette]);
}
function RevenueChart({ invoices, palette, activeIdx, onSelect }: {
  invoices: Invoice[]; palette: any; activeIdx: number; onSelect: (i: number) => void;
}) {
  const { width: chartWidth } = useWindowDimensions();
  const buckets = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString(undefined, { month: 'short' });
      const total = invoices
        .filter(inv => { const id = new Date(inv.date); return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth(); })
        .reduce((s, inv) => s + inv.total, 0);
      return { label, total };
    });
  }, [invoices]);

  const PILL_H = 44;
  const graphH = CHART_H - PILL_H;
  const pad = { t: 10, b: 10 };
  const h = graphH - pad.t - pad.b;
  const maxVal = Math.max(...buckets.map(b => b.total), 1);
  const n = buckets.length;
  // Inset the line so first/last points don't clip at screen edge
  const inset = 24;
  const chartInnerW = chartWidth - inset * 2;

  const pts = buckets.map((b, i) => ({
    x: inset + (i / (n - 1)) * chartInnerW,
    y: pad.t + h - (b.total / maxVal) * h,
    total: b.total,
    label: b.label,
  }));

  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return acc + ` C${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  // Area closes to full width so gradient fills edge-to-edge
  const areaPath = linePath + ` L${chartWidth},${graphH} L0,${graphH} Z`;
  const activePt = pts[activeIdx] ?? pts[n - 1];
  const pillW = 40;
  const pillH = 30;
  // Pills evenly spaced across full width
  const pillSpacing = chartWidth / n;

  return (
    <Svg width={chartWidth} height={CHART_H}>
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={palette.primary} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={palette.primary} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#g)" />
      <Path d={linePath} fill="none" stroke={palette.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Active point marker */}
      <Circle cx={activePt.x} cy={activePt.y} r={6} fill={palette.surface} stroke={palette.primary} strokeWidth={2.5} />
      <Circle cx={activePt.x} cy={activePt.y} r={3} fill={palette.primary} />
      {/* Pill selectors — Rect + SvgText both handle press */}
      {pts.map((pt, i) => {
        const cx = pillSpacing * i + pillSpacing / 2;
        const isActive = i === activeIdx;
        const pillY = graphH + 7;
        return (
          <React.Fragment key={`revenue-${pt.label}`}>
            <Rect
              x={cx - pillW / 2} y={pillY}
              width={pillW} height={pillH} rx={pillH / 2}
              fill={isActive ? palette.text : palette.line}
              onPress={() => onSelect(i)}
            />
            <SvgText
              x={cx} y={pillY + pillH / 2 + 4}
              textAnchor="middle"
              fontSize="11" fontWeight="700"
              fill={isActive ? palette.surface : palette.muted}
              onPress={() => onSelect(i)}
            >
              {pt.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { palette } = useTheme();
  const cfg = useStatusCfg(palette)[status];
  return (
    <View style={[bS.wrap, { borderColor: cfg.color }]}>
      <Icon source={cfg.icon} size={11} color={cfg.color} />
      <Text style={[bS.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const bS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '700' },
});

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const { palette } = useTheme();
  const { formatAmount } = useCurrency();
  const due = getDueDaysLabel(invoice.dueDate);
  const balanceDue = invoice.balanceDue ?? invoice.total;
  const amountPaid = invoice.amountPaid ?? 0;
  const paidPct = invoice.total > 0 ? Math.min(1, amountPaid / invoice.total) : 0;
  return (
    <Pressable style={[cS.card, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => router.push(`/invoice/${invoice.id}`)}>
      <View style={cS.top}>
        <Icon source={invoice.source === 'expense' ? 'receipt-text-outline' : 'file-document-outline'} size={22} color={palette.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[cS.client, { color: palette.text }]} numberOfLines={1}>{invoice.clientName}</Text>
          <Text style={[cS.meta, { color: palette.muted }]} numberOfLines={1}>
            {invoice.invoiceNumber ? invoice.invoiceNumber + '  ·  ' : ''}
            {formatShortDate(invoice.date)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <Text style={[cS.amount, { color: palette.text }]} numberOfLines={1}>{formatAmount(invoice.total)}</Text>
          <StatusBadge status={invoice.status} />
        </View>
      </View>
      {amountPaid > 0 && paidPct < 1 && (
        <View style={[cS.progressWrap, { borderTopColor: palette.border }]}>
          <View style={[cS.progressBg, { backgroundColor: palette.background }]}>
            <View style={[cS.progressFill, { backgroundColor: palette.success, width: `${paidPct * 100}%` as any }]} />
          </View>
          <Text style={[cS.progressLabel, { color: palette.muted }]}>{formatAmount(amountPaid)} paid · {formatAmount(balanceDue)} remaining</Text>
        </View>
      )}
      {due.label ? (
        <View style={[cS.dueRow, { borderTopColor: palette.border }]}>
          <Icon source="calendar-clock" size={12} color={due.overdue ? palette.danger : due.urgent ? palette.warning : palette.muted} />
          <Text style={[cS.dueText, { color: due.overdue ? palette.danger : due.urgent ? palette.warning : palette.muted }]}>{due.label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
const cS = StyleSheet.create({
  card:          { borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  top:           { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  client:        { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  meta:          { fontSize: 12 },
  amount:        { fontSize: 15, fontWeight: '700' },
  progressWrap:  { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  progressBg:    { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11 },
  dueRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  dueText:       { fontSize: 12, fontWeight: '600' },
});
export default function InvoicesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const S = useMemo(() => createStyles(palette), [palette]);
  const { invoices, isLoading } = useInvoiceStore();
  const { formatAmount } = useCurrency();
  const [filter, setFilter] = useState<FilterKey>('All');
  const [chartActiveIdx, setChartActiveIdx] = useState(5);

  const stats = useMemo(() => ({
    outstanding: invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue').reduce((s, i) => s + (i.balanceDue ?? i.total), 0),
    collected:   invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    total:       invoices.reduce((s, i) => s + i.total, 0),
    overdue:     invoices.filter(i => i.status === 'overdue').length,
    draft:       invoices.filter(i => i.status === 'draft').length,
  }), [invoices]);

  const filtered = useMemo(() => {
    if (filter === 'All') return invoices;
    return invoices.filter(i => i.status === filter.toLowerCase() as InvoiceStatus);
  }, [invoices, filter]);

  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { All: invoices.length };
    STATUS_FILTERS.slice(1).forEach(f => { c[f] = invoices.filter(i => i.status === f.toLowerCase()).length; });
    return c;
  }, [invoices]);

  return (
    <View style={S.root}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>

        {/* Hero — title + add btn + big amount + chart + stats, all one surface */}
        <View style={[S.hero, { paddingTop: insets.top }]}>

          {/* Title row */}
          <View style={S.heroTitleRow}>
            <View>
              <Text style={S.heroTitle}>Invoices</Text>
              <Text style={S.heroSubtitle}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</Text>
            </View>
            <Pressable style={[S.addBtn, { backgroundColor: palette.primary }]} onPress={() => router.push('/invoice/create')}>
              <Icon source="plus" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Big total amount */}
          <View style={S.heroAmountRow}>
            <Text style={[S.heroAmount, { color: palette.text }]}>{formatAmount(stats.total)}</Text>
            <Text style={[S.heroAmountLabel, { color: palette.muted }]}>Total invoiced</Text>
          </View>

          <RevenueChart invoices={invoices} palette={palette} activeIdx={chartActiveIdx} onSelect={setChartActiveIdx} />

          {/* 2x2 stat cards */}
          <View style={S.statGrid}>
            {[
              { label: 'Outstanding', value: formatAmount(stats.outstanding), color: palette.warning, icon: 'clock-alert-outline' },
              { label: 'Collected',   value: formatAmount(stats.collected),   color: palette.success, icon: 'check-circle-outline' },
              { label: 'Overdue',     value: String(stats.overdue),           color: palette.danger,  icon: 'alert-circle-outline' },
              { label: 'Draft',       value: String(stats.draft),             color: palette.muted,   icon: 'file-outline' },
            ].reduce<React.ReactElement[][]>((rows, item, i) => {
              if (i % 2 === 0) rows.push([]);
              rows[rows.length - 1].push(
                <View key={item.label} style={[S.statCard, { backgroundColor: palette.line }]}>
                  <View style={S.statCardTop}>
                    <Icon source={item.icon} size={15} color={palette.text} />
                    <Text style={[S.statCardLabel, { color: palette.text }]}>{item.label}</Text>
                  </View>
                  <View style={S.statCardBottom}>
                    <View style={[S.statDot, { backgroundColor: item.color }]} />
                    <Text style={[S.statCardValue, { color: palette.text }]}>{item.value}</Text>
                  </View>
                </View>
              );
              return rows;
            }, []).map((row, i) => (
              <View key={`stats-row-${row.map((child) => child.key).join('-')}`} style={S.statRow}>{row}</View>
            ))}
          </View>
        </View>

        {/* Sticky filter tabs */}
        <View style={[S.filterBar, { backgroundColor: palette.surface }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
            {STATUS_FILTERS.map(f => {
              const active = filter === f;
              const count = filterCounts[f] ?? 0;
              return (
                <Pressable key={f} onPress={() => setFilter(f)}
                  style={[S.filterTab, active ? { borderBottomColor: palette.primary, borderBottomWidth: 2 } : { borderBottomColor: 'transparent', borderBottomWidth: 2 }]}>
                  <Text style={[S.filterTabText, { color: active ? palette.primary : palette.muted }]}>{f}</Text>
                  {count > 0 && (
                    <View style={[S.filterBadge, { backgroundColor: active ? palette.primary : palette.border }]}>
                      <Text style={[S.filterBadgeText, { color: active ? '#fff' : palette.muted }]}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[S.filterDivider, { backgroundColor: palette.border }]} />
        </View>

        {/* List */}
        <View style={S.listWrap}>
          {isLoading ? (
            <View style={S.center}><ActivityIndicator color={palette.primary} /></View>
          ) : filtered.length === 0 ? (
            <View style={S.empty}>
              <Icon source="file-document-outline" size={52} color={palette.border} />
              <Text style={[S.emptyTitle, { color: palette.text }]}>No invoices</Text>
              <Text style={[S.emptySub, { color: palette.muted }]}>
                {filter === 'All' ? 'Create your first invoice or generate one from a split expense.' : `No ${filter.toLowerCase()} invoices yet.`}
              </Text>
              {filter === 'All' && (
                <Pressable style={[S.emptyBtn, { backgroundColor: palette.primary }]} onPress={() => router.push('/invoice/create')}>
                  <Icon source="plus" size={18} color="#fff" />
                  <Text style={S.emptyBtnText}>Create Invoice</Text>
                </Pressable>
              )}
            </View>
          ) : (
            filtered.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: palette.background },

    // ── Unified hero block ──────────────────────────────────────────────
    hero:            { backgroundColor: palette.surface, paddingBottom: 4 },

    // Title row: "Invoices" label + add button
    heroTitleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
    heroTitle:       { fontSize: 28, fontWeight: '700', color: palette.text },
    heroSubtitle:    { fontSize: 14, color: palette.muted, marginTop: 2 },

    // Big amount beneath the title
    heroAmountRow:   { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
    heroAmount:      { fontSize: 40, fontWeight: '900', letterSpacing: 0 },
    heroAmountLabel: { fontSize: 13, fontWeight: '500', marginTop: 2 },

    addBtn:          { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    statGrid:        { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 10 },
    statRow:         { flexDirection: 'row', gap: 10 },
    statCard:        { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    statCardTop:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statCardLabel:   { fontSize: 13, fontWeight: '500' },
    statCardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statDot:         { width: 10, height: 10, borderRadius: 5 },
    statCardValue:   { fontSize: 20, fontWeight: '800', letterSpacing: 0 },
    filterBar:       { paddingTop: 4 },
    filterScroll:    { paddingHorizontal: 16, gap: 0 },
    filterTab:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12 },
    filterTabText:   { fontSize: 14, fontWeight: '600' },
    filterBadge:     { minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    filterBadgeText: { fontSize: 10, fontWeight: '700' },
    filterDivider:   { height: StyleSheet.hairlineWidth },
    listWrap:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
    center:          { paddingTop: 60, alignItems: 'center' },
    empty:           { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle:      { fontSize: 18, fontWeight: '600' },
    emptySub:        { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
    emptyBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    emptyBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
