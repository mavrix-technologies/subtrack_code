import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { Expense } from '@/store/useExpenseStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface ExpenseItemProps {
  expense: Expense;
  expanded?: boolean;
  onToggle?: () => void;
  onOpenDetails?: () => void;
  onOpenInvoice?: () => void;
  onRemind?: () => void;
}

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'food': return 'silverware-fork-knife';
    case 'transport': return 'car-outline';
    case 'utilities': return 'flash-outline';
    case 'shopping': return 'shopping-outline';
    case 'entertainment': return 'television-play';
    default: return 'wallet-outline';
  }
};

const getCategoryColor = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'food': return '#F59E0B'; // amber
    case 'transport': return '#3B82F6'; // blue
    case 'utilities': return '#10B981'; // green
    case 'shopping': return '#EC4899'; // pink
    case 'entertainment': return '#8B5CF6'; // purple
    default: return '#6B7280'; // gray
  }
};

export const ExpenseItem: React.FC<ExpenseItemProps> = ({
  expense,
  expanded = false,
  onToggle,
  onOpenDetails,
  onOpenInvoice,
  onRemind,
}) => {
  const { palette } = useTheme();
  const { formatAmount } = useCurrency();
  const iconName = getCategoryIcon(expense.category);
  const color = getCategoryColor(expense.category);
  const isExpanded = expanded;

  const fullDate = new Date(expense.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const shortDate = new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const splitCount = expense.participants?.length || 0;

  if (!isExpanded) {
    return (
      <Pressable
        style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.line }]}
        onPress={onToggle}
      >
        <View style={styles.left}>
          <View style={styles.iconBox}>
            <Icon source={iconName} size={24} color={color} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{expense.name}</Text>
            <Text style={[styles.date, { color: palette.muted }]} numberOfLines={1}>
              {shortDate}
              {expense.category ? ` • ${expense.category}` : ''}
            </Text>
            {expense.isSplit && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                <Icon source="account-group" size={14} color={palette.primary} />
                <Text style={{ flex: 1, fontSize: 12, color: palette.primary, fontWeight: '500' }} numberOfLines={1}>
                  Split between {splitCount} people
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.right, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.amount, { color: palette.text }]}>{formatAmount(expense.amount)}</Text>
          </View>
          <Icon source="chevron-down" size={20} color={palette.muted} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.expandedCard, { backgroundColor: palette.surface, borderColor: palette.line }]}
      onPress={onToggle}
    >
      <View style={styles.expandedTop}>
        <View style={styles.left}>
          <View style={[styles.expandedIconBox, { backgroundColor: `${color}18` }]}>
            <Icon source={iconName} size={22} color={color} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={2}>{expense.name}</Text>
            <Text style={[styles.date, { color: palette.muted }]} numberOfLines={2}>
              {fullDate}
              {expense.category ? ` • ${expense.category}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[styles.amount, { color: palette.text }]}>{formatAmount(expense.amount)}</Text>
          <Icon source="chevron-up" size={20} color={palette.muted} />
        </View>
      </View>

      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
        <View style={[styles.detailsBlock, { borderTopColor: palette.line }]}>
          {expense.notes?.trim() ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.muted }]}>Note</Text>
              <Text style={[styles.detailValue, { color: palette.text }]} numberOfLines={4}>{expense.notes.trim()}</Text>
            </View>
          ) : null}

          {expense.isSplit ? (
            <View style={[styles.detailRow, { marginTop: expense.notes?.trim() ? 12 : 0 }]}>
              <Text style={[styles.detailLabel, { color: palette.muted }]}>Split</Text>
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                <Text style={[styles.detailValue, { color: palette.text }]} numberOfLines={1}>
                  {expense.splitType === 'custom' ? 'Custom' : 'Equal'} · {splitCount} people
                </Text>
                {(expense.participants || []).slice(0, 4).map((p) => (
                  <Text key={p.id} style={[styles.detailSub, { color: palette.muted }]} numberOfLines={1}>
                    {p.name || 'Person'} · {formatAmount(p.amount)}
                  </Text>
                ))}
                {(expense.participants?.length || 0) > 4 ? (
                  <Text style={[styles.detailSub, { color: palette.muted }]}>
                    +{(expense.participants?.length || 0) - 4} more
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { borderColor: palette.line, backgroundColor: palette.background }]}
            onPress={(e) => { e.stopPropagation(); onOpenDetails?.(); }}
          >
            <Icon source="open-in-new" size={16} color={palette.text} />
            <Text style={[styles.actionTxt, { color: palette.text }]}>Open</Text>
          </Pressable>

          {expense.isSplit && onOpenInvoice ? (
            <Pressable
              style={[styles.actionBtn, { borderColor: `${palette.primary}55`, backgroundColor: `${palette.primary}10` }]}
              onPress={(e) => { e.stopPropagation(); onOpenInvoice(); }}
            >
              <Icon source="receipt-text-outline" size={16} color={palette.primary} />
              <Text style={[styles.actionTxt, { color: palette.primary }]}>Invoice</Text>
            </Pressable>
          ) : null}
          {expense.isSplit && onRemind ? (
            <Pressable
              style={[styles.actionBtn, { borderColor: `${palette.warning ?? '#F59E0B'}55`, backgroundColor: `${palette.warning ?? '#F59E0B'}12` }]}
              onPress={(e) => { e.stopPropagation(); onRemind(); }}
            >
              <Icon source="bell-ring-outline" size={16} color={palette.warning ?? '#F59E0B'} />
              <Text style={[styles.actionTxt, { color: palette.warning ?? '#F59E0B' }]}>Remind</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expandedCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  expandedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  expandedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 0,
    width: 60,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailSub: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
  },
  actionTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
});
