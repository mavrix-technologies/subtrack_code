import { InlineNativeAd } from '@/components/ads/InlineNativeAd';
import { ExpenseItem } from '@/components/expense/ExpenseItem';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { isExpenseReminderConfigured, scheduleSplitReminderAlarm, sendSplitExpenseReminderEmail } from '@/services/expenseReminder';
import { useExpenseStore } from '@/store/useExpenseStore';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from 'react-native-paper';
import Animated, { Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = [
  { id: 'All',           label: 'All',           icon: 'view-grid-outline' },
  { id: 'Food',          label: 'Food',          icon: 'silverware-fork-knife' },
  { id: 'Transport',     label: 'Transport',     icon: 'car-outline' },
  { id: 'Utilities',     label: 'Utilities',     icon: 'flash-outline' },
  { id: 'Shopping',      label: 'Shopping',      icon: 'shopping-outline' },
  { id: 'Entertainment', label: 'Entertainment', icon: 'television-play' },
  { id: 'Health',        label: 'Health',        icon: 'heart-pulse' },
  { id: 'Travel',        label: 'Travel',        icon: 'airplane' },
  { id: 'Other',         label: 'Other',         icon: 'dots-horizontal-circle-outline' },
];

export default function ExpensesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { expenses } = useExpenseStore();
  const { formatAmount, currency } = useCurrency();
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'thisMonth' | 'lastMonth'>('thisMonth');
  const [splitOnly, setSplitOnly] = useState(false);

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;

    // Date range filters
    if (dateFilter !== 'all') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      if (dateFilter === 'lastMonth') {
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
      }
      result = result.filter((e) => {
        const d = new Date(e.date);
        return d >= start && d < end;
      });
    }

    if (selectedCategory !== 'All') {
      result = result.filter(e => e.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (splitOnly) {
      result = result.filter((e) => !!e.isSplit);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.name.toLowerCase().includes(q) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        (e.participants && e.participants.some((p) => (p.name || '').toLowerCase().includes(q)))
      );
    }
    return result;
  }, [dateFilter, expenses, selectedCategory, searchQuery, splitOnly]);

  const expenseReport = useMemo(() => {
    const now = new Date();
    const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        total: 0,
      };
    });
    const monthMap = new Map(lastSixMonths.map((m) => [m.key, m]));
    const categoryTotals = new Map<string, number>();
    let filteredTotal = 0;
    let splitTotal = 0;

    for (const expense of filteredExpenses) {
      filteredTotal += expense.amount;
      if (expense.isSplit) splitTotal += expense.amount;
      categoryTotals.set(expense.category || 'Other', (categoryTotals.get(expense.category || 'Other') || 0) + expense.amount);
    }

    for (const expense of expenses) {
      const d = new Date(expense.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const month = monthMap.get(key);
      if (month) month.total += expense.amount;
    }

    const categories = Array.from(categoryTotals.entries())
      .map(([category, total]) => ({
        category,
        total,
        percentage: filteredTotal > 0 ? Math.round((total / filteredTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const average = filteredExpenses.length > 0 ? filteredTotal / filteredExpenses.length : 0;
    return { categories, months: lastSixMonths, filteredTotal, average, splitTotal };
  }, [expenses, filteredExpenses]);

  const groupedExpenses = useMemo(() => {
    const groups: { title: string; key: string; items: typeof filteredExpenses }[] = [];
    const map = new Map<string, typeof filteredExpenses>();
    const titleMap = new Map<string, string>();
    for (const e of filteredExpenses) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, []);
        titleMap.set(key, d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
      }
      map.get(key)!.push(e);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a > b ? -1 : 1));
    for (const k of keys) {
      groups.push({ key: k, title: titleMap.get(k) || k, items: map.get(k)! });
    }
    return groups;
  }, [filteredExpenses]);

  const toggleExpanded = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
  };

  const remindAgain = async (expense: any) => {
    if (!expense.isSplit || !expense.participants?.length) return;
    const [alarmOk, emailState] = await Promise.all([
      scheduleSplitReminderAlarm({ expenseName: expense.name, dateIso: expense.date }),
      sendSplitExpenseReminderEmail({
        expenseName: expense.name,
        totalAmount: expense.amount,
        currencySymbol: currency.symbol,
        dateIso: expense.date,
        splitType: expense.splitType,
        participants: expense.participants,
      }),
    ]);
    if (emailState === 'sent' && alarmOk) {
      Alert.alert('Reminders sent', 'Alarm set. Each participant with an email got their own reminder.');
      return;
    }
    if (emailState === 'draft' && alarmOk) {
      Alert.alert('Reminders ready', 'Alarm set. Your mail app may open one draft per person (in order).');
      return;
    }
    if (emailState === 'skipped') {
      Alert.alert('No recipient email', 'Add email addresses for participants to send reminders.');
      return;
    }
    if (!isExpenseReminderConfigured()) {
      Alert.alert('Email not configured', 'Email reminder is not configured.');
      return;
    }
    Alert.alert('Partial success', alarmOk ? 'Alarm set, but personal reminders could not be sent or opened.' : 'Reminders attempted, but alarm could not be set.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>{formatAmount(currentMonthTotal)} this month</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            style={[styles.addButton, styles.addButtonNeutral]}
            onPress={() => router.push('/friends')}
            accessibilityLabel="Split friends"
          >
            <Icon source="account-heart-outline" size={22} color={palette.text} />
          </Pressable>
          <Pressable style={[styles.addButton, styles.addButtonPrimary]} onPress={() => router.push('/add-expense')}>
            <Icon source="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <Icon source="magnify" size={20} color={palette.muted} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Search expenses..."
              placeholderTextColor={palette.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Icon source="close-circle" size={20} color={palette.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Date filter */}
            {([
              { id: 'thisMonth', label: 'This month', icon: 'calendar-month-outline' },
              { id: 'lastMonth', label: 'Last month', icon: 'calendar' },
              { id: 'all', label: 'All time', icon: 'infinity' },
            ] as const).map((opt) => {
              const isSelected = dateFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.filterChip,
                    isSelected
                      ? { backgroundColor: palette.primary, borderColor: palette.primary }
                      : { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1 },
                  ]}
                  onPress={() => setDateFilter(opt.id)}
                >
                  <Icon source={opt.icon} size={15} color={isSelected ? '#fff' : palette.muted} />
                  <Text style={[
                    styles.filterText,
                    isSelected ? { color: '#fff', fontWeight: '700' } : { color: palette.muted },
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Split only */}
            <Pressable
              style={[
                styles.filterChip,
                splitOnly
                  ? { backgroundColor: palette.primary, borderColor: palette.primary }
                  : { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1 },
              ]}
              onPress={() => setSplitOnly((v) => !v)}
            >
              <Icon source="account-group-outline" size={15} color={splitOnly ? '#fff' : palette.muted} />
              <Text style={[
                styles.filterText,
                splitOnly ? { color: '#fff', fontWeight: '700' } : { color: palette.muted },
              ]}>
                Split only
              </Text>
            </Pressable>

            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    isSelected
                      ? { backgroundColor: palette.primary, borderColor: palette.primary }
                      : { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1 }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Icon
                    source={cat.icon}
                    size={15}
                    color={isSelected ? '#fff' : palette.muted}
                  />
                  <Text style={[
                    styles.filterText,
                    isSelected ? { color: '#fff', fontWeight: '700' } : { color: palette.muted }
                  ]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {filteredExpenses.length > 0 && (
          <View style={styles.reportOuter}>
            <View style={styles.reportPanel}>
              <View style={styles.reportHeader}>
                <View>
                  <Text style={styles.reportTitle}>Expense report</Text>
                  <Text style={styles.reportSub}>Filtered spend and trends</Text>
                </View>
                <View style={styles.reportTotalBox}>
                  <Text style={styles.reportTotalLabel}>Total</Text>
                  <Text style={styles.reportTotal}>{formatAmount(expenseReport.filteredTotal)}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Average</Text>
                  <Text style={styles.metricValue}>{formatAmount(expenseReport.average)}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Split total</Text>
                  <Text style={styles.metricValue}>{formatAmount(expenseReport.splitTotal)}</Text>
                </View>
              </View>

              <View style={styles.chartBlock}>
                <Text style={styles.chartTitle}>By category</Text>
                {expenseReport.categories.map((item) => (
                  <View key={item.category} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>{item.category}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(6, item.percentage)}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{item.percentage}%</Text>
                  </View>
                ))}
              </View>

              <View style={styles.chartBlock}>
                <Text style={styles.chartTitle}>Last 6 months</Text>
                <View style={styles.monthGraph}>
                  {expenseReport.months.map((month) => {
                    const maxMonth = Math.max(...expenseReport.months.map((m) => m.total), 1);
                    const height = month.total > 0 ? 18 + Math.round((month.total / maxMonth) * 62) : 8;
                    return (
                      <View key={month.key} style={styles.monthColumn}>
                        <View style={[styles.monthBar, { height }]} />
                        <Text style={styles.monthLabel}>{month.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {filteredExpenses.length > 0 && (
          <View style={styles.inlineAdWrap}>
            <InlineNativeAd style={styles.inlineAd} />
          </View>
        )}

        <View style={{ paddingHorizontal: 24 }}>
        {filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="cash-remove" size={48} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No expenses found</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
              {selectedCategory === 'All' ? "You haven't added any expenses yet." : `No expenses in ${selectedCategory}.`}
            </Text>
          </View>
        ) : (
          groupedExpenses.map((group) => (
            <View key={group.key} style={{ marginBottom: 18 }}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupHeaderText, { color: palette.muted }]}>{group.title}</Text>
                <Text style={[styles.groupHeaderText, { color: palette.muted }]}>
                  {formatAmount(group.items.reduce((s, e) => s + e.amount, 0))}
                </Text>
              </View>
              {group.items.map((expense) => {
                const isExpanded = expandedId === expense.id;
                return (
                  <Animated.View
                    key={expense.id}
                    layout={Layout.duration(260)}
                    style={{ overflow: 'hidden', borderRadius: 20, marginBottom: 12 }}
                  >
                    <ExpenseItem
                      expense={expense}
                      expanded={isExpanded}
                      onToggle={() => toggleExpanded(expense.id)}
                      onOpenDetails={() => router.push(`/expense/${expense.id}`)}
                      onRemind={() => remindAgain(expense)}
                      onOpenInvoice={
                        expense.isSplit ? () => router.push(`/expense/invoice/${expense.id}`) : undefined
                      }
                    />
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: palette.text,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonNeutral: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    addButtonPrimary: {
      backgroundColor: palette.primary,
    },
    subtitle: {
      fontSize: 14,
      color: palette.muted,
      marginTop: 2,
    },
    searchContainer: {
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      height: 48,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 15,
    },
    filterContainer: {
      marginBottom: 16,
    },
    filterScroll: {
      paddingHorizontal: 24,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '500',
    },
    reportOuter: {
      paddingHorizontal: 24,
      marginBottom: 18,
    },
    inlineAdWrap: {
      paddingHorizontal: 24,
    },
    inlineAd: {
      marginBottom: 18,
    },
    reportPanel: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      padding: 16,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
    },
    reportTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: palette.text,
    },
    reportSub: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.muted,
      marginTop: 3,
    },
    reportTotalBox: {
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    reportTotalLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: palette.muted,
      textTransform: 'uppercase',
    },
    reportTotal: {
      fontSize: 18,
      fontWeight: '900',
      color: palette.primary,
      marginTop: 2,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    metricBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 10,
      padding: 12,
      backgroundColor: palette.background,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: palette.muted,
      textTransform: 'uppercase',
    },
    metricValue: {
      fontSize: 15,
      fontWeight: '800',
      color: palette.text,
      marginTop: 5,
    },
    chartBlock: {
      marginTop: 16,
      gap: 10,
    },
    chartTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: palette.text,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    barLabel: {
      width: 86,
      fontSize: 12,
      fontWeight: '700',
      color: palette.muted,
    },
    barTrack: {
      flex: 1,
      height: 9,
      borderRadius: 5,
      backgroundColor: palette.background,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor: palette.primary,
    },
    barValue: {
      width: 36,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '800',
      color: palette.text,
    },
    monthGraph: {
      minHeight: 112,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    monthColumn: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    monthBar: {
      width: '70%',
      maxWidth: 28,
      borderRadius: 7,
      backgroundColor: palette.primary,
    },
    monthLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: palette.muted,
    },
    listContent: {
      paddingBottom: 120,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginBottom: 10,
      marginTop: 6,
    },
    groupHeaderText: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
    },
  });
}
