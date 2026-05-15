import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { isExpenseReminderConfigured, scheduleSplitReminderAlarm, sendSplitExpenseReminderEmail } from '@/services/expenseReminder';
import { deleteExpense } from '@/services/expenseService';
import { useExpenseStore } from '@/store/useExpenseStore';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'food': return 'silverware-fork-knife';
    case 'transport': return 'car-outline';
    case 'utilities': return 'flash-outline';
    case 'shopping': return 'shopping-outline';
    case 'entertainment': return 'television-play';
    case 'health': return 'heart-pulse';
    case 'travel': return 'airplane';
    default: return 'wallet-outline';
  }
};

const getCategoryColor = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'food': return '#F59E0B';
    case 'transport': return '#3B82F6';
    case 'utilities': return '#10B981';
    case 'shopping': return '#EC4899';
    case 'entertainment': return '#8B5CF6';
    case 'health': return '#EF4444';
    case 'travel': return '#14B8A6';
    default: return '#6B7280';
  }
};

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const actionTones = useMemo(
    () => ({
      remindBg: theme === 'dark' ? '#422006' : '#FEF3C7',
      remindBorder: '#D97706',
      remindFg: theme === 'dark' ? '#FDE68A' : '#92400E',
      deleteBg: theme === 'dark' ? '#3F1F1F' : '#FEE2E2',
    }),
    [theme]
  );
  const { expenses } = useExpenseStore();
  const { formatAmount, currency } = useCurrency();

  const [isDeleting, setIsDeleting] = useState(false);

  const expense = expenses.find(e => e.id === id);

  if (!expense) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.text }}>Expense not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteExpense(expense.userId, expense.id);
              useExpenseStore.getState().deleteExpense(expense.id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete expense.');
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleRemindAgain = async () => {
    if (!expense.isSplit || !expense.participants?.length) return;
    const alarmOk = await scheduleSplitReminderAlarm({ expenseName: expense.name, dateIso: expense.date });
    const emailState = await sendSplitExpenseReminderEmail({
      expenseName: expense.name,
      totalAmount: expense.amount,
      currencySymbol: currency.symbol,
      dateIso: expense.date,
      splitType: expense.splitType,
      participants: expense.participants,
    });
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

  const iconName = getCategoryIcon(expense.category);
  const categoryColor = getCategoryColor(expense.category);
  const dateText = new Date(expense.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
  const splitCount = expense.participants?.length || 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={10}>
          <Icon source="chevron-left" size={28} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Expense</Text>
        <Pressable
          onPress={() => router.push(`/expense/edit/${expense.id}`)}
          style={[styles.editBtn, { backgroundColor: palette.surface, borderColor: palette.line }]}
        >
          <Text style={[styles.editBtnText, { color: palette.text }]}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 28 }]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: categoryColor }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconBox}>
              <Icon source={iconName} size={26} color={categoryColor} />
            </View>
            <View style={styles.heroBadge}>
              <Icon source="calendar-month-outline" size={14} color="#475569" />
              <Text style={styles.heroBadgeText} numberOfLines={1}>{dateText}</Text>
            </View>
          </View>

          <View style={styles.heroMiddle}>
            <Text style={styles.heroAmount} numberOfLines={1}>{formatAmount(expense.amount)}</Text>
            <Text style={styles.heroName} numberOfLines={2}>{expense.name}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>{expense.category || 'Uncategorized'}</Text>
          </View>

          {expense.isSplit ? (
            <View style={styles.heroFooter}>
              <View style={styles.heroFooterLeft}>
                <Icon source="account-group-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroFooterText} numberOfLines={1}>
                  {expense.splitType === 'custom' ? 'Custom split' : 'Equal split'} · {splitCount} people
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/expense/invoice/${expense.id}`)}
                style={styles.heroInvoiceBtn}
              >
                <Icon source="receipt-text-outline" size={18} color={categoryColor} />
                <Text style={[styles.heroInvoiceText, { color: categoryColor }]}>Invoice</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Actions — grouped rows, solid fills, minimal chrome */}
        <View style={[styles.actionsGroup, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          {expense.isSplit ? (
            <>
              <Pressable
                style={[styles.actionRowPrimary, { backgroundColor: palette.primary }]}
                onPress={() => router.push(`/expense/invoice/${expense.id}`)}
              >
                <Icon source="receipt-text-outline" size={22} color="#FFFFFF" />
                <Text style={styles.actionRowPrimaryLabel}>View invoice</Text>
              </Pressable>
              <View style={[styles.actionDivider, { backgroundColor: palette.line }]} />
              <Pressable
                style={[styles.actionRowTint, { backgroundColor: actionTones.remindBg }]}
                onPress={handleRemindAgain}
              >
                <Icon source="bell-ring-outline" size={22} color={actionTones.remindFg} />
                <Text style={[styles.actionRowTintLabel, { color: actionTones.remindFg }]}>Remind again</Text>
              </Pressable>
            </>
          ) : null}
          {expense.isSplit ? <View style={[styles.actionDivider, { backgroundColor: palette.line }]} /> : null}
          <Pressable
            style={[styles.actionRowTint, { backgroundColor: actionTones.deleteBg }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={palette.danger} />
            ) : (
              <Icon source="trash-can-outline" size={22} color={palette.danger} />
            )}
            <Text style={[styles.actionRowDangerLabel, { color: palette.danger }]}>Delete expense</Text>
          </Pressable>
        </View>

        {/* Details */}
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: `${palette.primary}12` }]}>
                <Icon source="tag-outline" size={18} color={palette.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: palette.muted }]}>Category</Text>
            </View>
            <Text style={[styles.rowValue, { color: palette.text }]} numberOfLines={1}>{expense.category || 'Uncategorized'}</Text>
          </View>

          <View style={[styles.sep, { backgroundColor: palette.line }]} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: `${palette.primary}12` }]}>
                <Icon source="calendar-month-outline" size={18} color={palette.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: palette.muted }]}>Date</Text>
            </View>
            <Text style={[styles.rowValue, { color: palette.text }]} numberOfLines={2}>{dateText}</Text>
          </View>

          {expense.notes?.trim() ? (
            <>
              <View style={[styles.sep, { backgroundColor: palette.line }]} />
              <View style={styles.noteBlock}>
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIcon, { backgroundColor: `${palette.primary}12` }]}>
                    <Icon source="note-text-outline" size={18} color={palette.primary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: palette.muted }]}>Note</Text>
                </View>
                <Text style={[styles.noteText, { color: palette.text }]}>{expense.notes.trim()}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Split breakdown */}
        {expense.isSplit && expense.participants?.length ? (
          <>
            <Text style={styles.sectionTitle}>Split breakdown</Text>
            <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              {expense.participants.map((p, idx) => (
                <View key={p.id}>
                  <View style={styles.splitRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.splitName, { color: palette.text }]} numberOfLines={1}>{p.name || `Person ${idx + 1}`}</Text>
                      <Text style={[styles.splitSub, { color: palette.muted }]} numberOfLines={1}>
                        {expense.splitType === 'custom' ? 'Custom amount' : 'Equal share'}
                      </Text>
                      {p.email ? (
                        <Text style={[styles.splitSub, { color: palette.muted }]} numberOfLines={1}>{p.email}</Text>
                      ) : null}
                      {p.details ? (
                        <Text style={[styles.splitSub, { color: palette.muted }]} numberOfLines={1}>{p.details}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.splitAmt, { color: palette.text }]} numberOfLines={1}>{formatAmount(p.amount)}</Text>
                  </View>
                  {idx < expense.participants.length - 1 ? <View style={[styles.sep, { backgroundColor: palette.line, marginLeft: 8 }]} /> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    iconButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: palette.text,
    },
    editBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
    },
    editBtnText: {
      fontSize: 14,
      fontWeight: '800',
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },

    /* hero */
    heroCard: {
      borderRadius: 22,
      padding: 22,
      marginTop: 4,
      marginBottom: 18,
      overflow: 'hidden',
      elevation: 4,
      boxShadow: '0 6px 20px rgba(15, 23, 42, 0.1)',
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    heroIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      maxWidth: 210,
    },
    heroBadgeText: {
      color: '#1F2937',
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    heroMiddle: {
      marginTop: 18,
      marginBottom: 14,
      gap: 6,
    },
    heroAmount: {
      color: '#fff',
      fontSize: 38,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    heroName: {
      color: '#fff',
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 26,
    },
    heroSub: {
      color: '#E2E8F0',
      fontSize: 13,
      fontWeight: '600',
    },
    heroFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: 2,
      borderTopColor: '#FFFFFF',
      paddingTop: 14,
    },
    heroFooterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    heroFooterText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    heroInvoiceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      flexShrink: 0,
    },
    heroInvoiceText: {
      fontSize: 13,
      fontWeight: '800',
    },

    /* actions — single grouped control */
    actionsGroup: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      marginBottom: 22,
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth,
    },
    actionRowPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 19,
      paddingHorizontal: 20,
      minHeight: 54,
    },
    actionRowPrimaryLabel: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    actionRowTint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 19,
      paddingHorizontal: 20,
      minHeight: 54,
    },
    actionRowTintLabel: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    actionRowDangerLabel: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },

    /* sections */
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: palette.muted,
      marginTop: 6,
      marginBottom: 10,
      marginLeft: 2,
    },
    sectionCard: {
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
    },
    rowValue: {
      fontSize: 14,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
      textAlign: 'right',
    },
    sep: {
      height: StyleSheet.hairlineWidth,
    },
    noteBlock: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
      gap: 10,
    },
    noteText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },

    /* split */
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    splitName: {
      fontSize: 15,
      fontWeight: '800',
    },
    splitSub: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '600',
    },
    splitAmt: {
      fontSize: 15,
      fontWeight: '900',
      flexShrink: 0,
    },
  });
}
