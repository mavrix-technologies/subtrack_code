import { SplitExpenseEditor, type SplitParticipantDraft } from '@/components/expense/SplitExpenseEditor';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { scheduleSplitReminderAlarm, sendSplitExpenseReminderEmail } from '@/services/expenseReminder';
import { addExpense } from '@/services/expenseService';
import { createSplitFriend } from '@/services/splitFriendService';
import { useSplitFriendStore } from '@/store/useSplitFriendStore';
import type { SplitFriend } from '@/types/splitFriend';
import { router, Stack, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable, ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = [
  { id: 'food',          label: 'Food',          icon: 'food-fork-drink'                },
  { id: 'transport',     label: 'Transport',      icon: 'car-outline'                    },
  { id: 'shopping',      label: 'Shopping',       icon: 'shopping-outline'               },
  { id: 'utilities',     label: 'Utilities',      icon: 'lightning-bolt'                 },
  { id: 'entertainment', label: 'Entertainment',  icon: 'television-play'                },
  { id: 'health',        label: 'Health',         icon: 'heart-pulse'                    },
  { id: 'travel',        label: 'Travel',         icon: 'airplane'                       },
  { id: 'other',         label: 'Other',          icon: 'dots-horizontal-circle-outline' },
];

const COLORS = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#14B8A6'];

export default function AddExpenseScreen() {
  const { palette, theme } = useTheme();
  const { currency }  = useCurrency();
  const insets        = useSafeAreaInsets();
  const styles        = useMemo(() => createStyles(palette), [palette]);

  /** Keep bottom padding sane: avoid stacking with keyboard insets API (fixes white gap / dead scroll zone). */
  const scrollPaddingBottom = useMemo(() => Math.max(insets.bottom, 12) + 24, [insets.bottom]);
  const { user }      = useAppData();
  const navigation    = useNavigation();
  const splitFriends  = useSplitFriendStore((s) => s.friends);

  const [amount,       setAmount]       = useState('');
  const [name,         setName]         = useState('');
  const [category,     setCategory]     = useState('food');
  const [notes,        setNotes]        = useState('');
  const [date,         setDate]         = useState(new Date());
  const [showDate,     setShowDate]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [isSplit,      setIsSplit]      = useState(false);
  const [splitType,    setSplitType]    = useState<'equal' | 'custom'>('equal');
  const [participants, setParticipants] = useState<SplitParticipantDraft[]>([
    { id: '1', name: 'You', amount: 0, email: '', details: '', color: COLORS[0] },
  ]);

  const totalAmt    = parseFloat(amount) || 0;
  const equalShare  = participants.length > 0 ? totalAmt / participants.length : 0;
  const customTotal = participants.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining   = parseFloat((totalAmt - customTotal).toFixed(2));

  const handleSave = useCallback(async () => {
    const num = parseFloat(amount);
    if (!name.trim()) { Alert.alert('Missing name', 'Please enter what this expense was for.'); return; }
    if (isNaN(num) || num <= 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
    if (!user) return;

    // Split validation — only when split is enabled
    if (isSplit) {
      if (participants.length < 2) {
        Alert.alert('Add at least 2 people', 'To split an expense, add at least one more person.');
        return;
      }
      if (splitType === 'custom') {
        const customTotal = participants.reduce((s, p) => s + (p.amount || 0), 0);
        const rem = parseFloat((num - customTotal).toFixed(2));
        if (Math.abs(rem) > 0.01) {
          Alert.alert(
            'Split not balanced',
            rem > 0
              ? `${currency.symbol}${rem.toFixed(2)} is still unallocated. Adjust the amounts to match the total.`
              : `Amounts exceed the total by ${currency.symbol}${Math.abs(rem).toFixed(2)}. Please reduce them.`
          );
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      let finalParticipants = participants;
      if (isSplit && splitType === 'equal') {
        const share = parseFloat(equalShare.toFixed(2));
        finalParticipants = participants.map((p, idx) => ({
          ...p,
          name: (p.name || '').trim() || (idx === 0 ? 'You' : `Person ${idx + 1}`),
          email: (p.email || '').trim() || undefined,
          details: (p.details || '').trim() || undefined,
          amount: share,
        }));
      } else if (isSplit) {
        finalParticipants = participants.map((p, idx) => ({
          ...p,
          name: (p.name || '').trim() || (idx === 0 ? 'You' : `Person ${idx + 1}`),
          email: (p.email || '').trim() || undefined,
          details: (p.details || '').trim() || undefined,
          amount: Number(p.amount) || 0,
        }));
      }
      await addExpense(user.uid, {
        name: name.trim(),
        amount: num,
        category: CATEGORIES.find(c => c.id === category)?.label ?? 'Other',
        notes: notes.trim() || undefined,
        date: date.toISOString(),
        isSplit,
        ...(isSplit ? { splitType, participants: finalParticipants } : {}),
      });

      if (isSplit) {
        void scheduleSplitReminderAlarm({
          expenseName: name.trim(),
          dateIso: date.toISOString(),
        });
        await sendSplitExpenseReminderEmail({
          expenseName: name.trim(),
          totalAmount: num,
          currencySymbol: currency.symbol,
          dateIso: date.toISOString(),
          splitType,
          participants: finalParticipants,
        });
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save expense.');
      setSubmitting(false);
    }
  }, [amount, category, currency.symbol, date, equalShare, isSplit, name, notes, participants, splitType, user]);

  const addParticipant = () => {
    const color = COLORS[participants.length % COLORS.length];
    setParticipants(prev => [...prev, { id: String(Math.random()), name: '', amount: 0, email: '', details: '', color }]);
  };

  const pickFriendForSplit = (f: SplitFriend) => {
    if (participants.some((p) => p.friendId === f.id)) {
      Alert.alert('Already added', `${f.displayName} is already on this split.`);
      return;
    }
    const color = f.color || COLORS[participants.length % COLORS.length];
    setParticipants((prev) => [
      ...prev,
      {
        id: String(Math.random()),
        name: f.displayName,
        email: f.email || '',
        details: f.note || '',
        amount: 0,
        color,
        friendId: f.id,
      },
    ]);
  };

  const saveRowAsFriend = async (i: number) => {
    if (!user || i === 0) return;
    const p = participants[i];
    const dn = (p.name || '').trim();
    const em = (p.email || '').trim();
    if (!dn && !em) {
      Alert.alert('Add name or email', 'Enter at least a name or email to save a profile.');
      return;
    }
    try {
      const id = await createSplitFriend(user.uid, {
        displayName: dn || em || 'Friend',
        email: em || undefined,
        note: (p.details || '').trim() || undefined,
        color: p.color,
      });
      const n = [...participants];
      n[i] = {
        ...n[i],
        friendId: id,
        name: dn || n[i].name || 'Friend',
        email: em || n[i].email,
      };
      setParticipants(n);
      Alert.alert('Profile saved', `${n[i].name} can be re-used on future splits.`);
    } catch {
      Alert.alert('Error', 'Could not save profile.');
    }
  };

  // Wire Save button into the native header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleSave}
          disabled={submitting}
          style={{ marginRight: 4 }}
        >
          {submitting
            ? <ActivityIndicator size="small" color={palette.primary} />
            : <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>}
        </Pressable>
      ),
    });
  }, [submitting, handleSave, navigation, palette.primary]);

  return (
    <>
      <Stack.Screen options={{ contentStyle: { backgroundColor: palette.background } }} />
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <ScrollView
        style={[styles.scroll, { backgroundColor: palette.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
        nestedScrollEnabled
        {...(Platform.OS === 'android' ? ({ overScrollMode: 'never' } as const) : {})}
        contentInset={{ bottom: scrollPaddingBottom }}
        scrollIndicatorInsets={{ bottom: scrollPaddingBottom }}
        contentContainerStyle={{
          backgroundColor: palette.background,
        }}
        >
        {/* ── Amount Hero ── */}
        <View style={[styles.amountHero, { backgroundColor: palette.primary }]}>
          <Text style={styles.amountHeroLabel}>Total Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currency.symbol}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              selectionColor="#fff"
            />
          </View>
          <Text style={styles.amountDate}>
            {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* ── Description ── */}
        <Text style={[styles.groupLabel, { color: palette.muted }]}>Title</Text>
        <View style={[styles.fieldCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <TextInput
            style={[styles.fieldCardInput, { color: palette.text }]}
            placeholder="What was this for?"
            placeholderTextColor={palette.muted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            maxLength={60}
          />
          <Text style={[styles.fieldCardCount, { color: palette.muted }]}>{name.length}/60</Text>
        </View>

        {/* ── Date ── */}
        <Text style={[styles.groupLabel, { color: palette.muted }]}>Date</Text>
        <Pressable
          style={[styles.fieldCard, styles.fieldCardRow, { backgroundColor: palette.surface, borderColor: palette.line }]}
          onPress={() => setShowDate(true)}
        >
          <Icon source="calendar-month-outline" size={22} color={palette.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldCardRowVal, { color: palette.text }]}>
              {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={[styles.fieldCardRowSub, { color: palette.muted }]}>Tap to change</Text>
          </View>
          <Icon source="chevron-right" size={20} color={palette.muted} />
        </Pressable>

        {/* ── Note ── */}
        <Text style={[styles.groupLabel, { color: palette.muted }]}>Note</Text>
        <View style={[styles.fieldCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <TextInput
            style={[styles.fieldCardInput, styles.fieldCardMultiline, { color: palette.text }]}
            placeholder="Add a note (optional)"
            placeholderTextColor={palette.muted}
            value={notes}
            onChangeText={setNotes}
            returnKeyType="done"
            multiline
            numberOfLines={3}
            blurOnSubmit
          />
        </View>

        {/* ── Category – full-width 4-column grid ── */}
        <Text style={[styles.groupLabel, { color: palette.muted }]}>Category</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(cat => {
            const active = cat.id === category;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                style={[
                  styles.catCell,
                  active
                    ? { backgroundColor: palette.primary, borderColor: palette.primary }
                    : { backgroundColor: palette.surface, borderColor: palette.line },
                ]}
              >
                <Icon source={cat.icon} size={22} color={active ? '#fff' : palette.primary} />
                <Text style={[styles.catCellLabel, { color: active ? '#fff' : palette.text }]} numberOfLines={2}>
                  {cat.label}
                </Text>
                {active && (
                  <View style={[styles.catCellDot, { backgroundColor: '#fff' }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        <SplitExpenseEditor
          palette={palette}
          themeMode={theme}
          currencySymbol={currency.symbol}
          splitFriends={splitFriends}
          isSplit={isSplit}
          onToggleSplit={(v) => {
            setIsSplit(v);
            if (!v) {
              setParticipants([{ id: '1', name: 'You', amount: 0, email: '', details: '', color: COLORS[0] }]);
              setSplitType('equal');
            }
          }}
          splitType={splitType}
          onSplitType={setSplitType}
          participants={participants}
          setParticipants={setParticipants}
          totalAmt={totalAmt}
          equalShare={equalShare}
          remaining={remaining}
          onPickFriend={pickFriendForSplit}
          onOpenFriends={() => router.push('/friends')}
          onAddParticipant={addParticipant}
          onRemoveParticipant={(participantId) =>
            setParticipants((prev) => prev.filter((p) => p.id !== participantId))
          }
          onSaveRowAsFriend={saveRowAsFriend}
        />

      </ScrollView>

      <DateTimePickerModal
        isVisible={showDate}
        mode="date"
        date={date}
        onConfirm={d => { setShowDate(false); setDate(d); }}
        onCancel={() => setShowDate(false)}
        textColor={palette.text}
      />
      </View>
    </>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    root:        { flex: 1 },
    scroll:      { flex: 1 },

    /* header */
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: palette.text },
    saveBtn:     { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    /* amount */
    amountHero:      { marginHorizontal: 16, borderRadius: 20, padding: 22, marginBottom: 16 },
    amountHeroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    amountRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    amountCurrency:  { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 44 },
    amountInput:     { flex: 1, minWidth: 0, color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: 0, paddingVertical: 0 },
    amountDate:      { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },

    groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: palette.muted, marginHorizontal: 16, marginBottom: 6, marginTop: 18 },

    /* standalone field cards */
    fieldCard:         { marginHorizontal: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 16 },
    fieldCardInput:    { fontSize: 17, fontWeight: '500', paddingVertical: 0 },
    fieldCardMultiline:{ minHeight: 72, textAlignVertical: 'top' },
    fieldCardCount:    { fontSize: 12, color: palette.muted, textAlign: 'right', marginTop: 6 },
    fieldCardRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    fieldCardRowVal:   { fontSize: 16, fontWeight: '600' },
    fieldCardRowSub:   { fontSize: 12, marginTop: 2 },

    /* category grid */
    catGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
    catCell:      { width: '22%', flexGrow: 1, minHeight: 86, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, position: 'relative' },
    catCellLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
    catCellDot:   { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },
  });
}
