import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { deleteSplitFriend, updateSplitFriend } from '@/services/splitFriendService';
import { useExpenseStore } from '@/store/useExpenseStore';
import { formatShortDate } from '@/utils/dates';
import { useSplitFriendStore } from '@/store/useSplitFriendStore';
import {
  getSplitExpensesForFriend,
  sumFriendShareInExpense,
} from '@/utils/splitFriendExpenses';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6'];

export default function SplitFriendDetailScreen() {
  "use no memo";

  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAppData();
  const { formatAmount } = useCurrency();
  const { expenses } = useExpenseStore();
  const { friends } = useSplitFriendStore();
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const styles = useMemo(() => createStyles(palette), [palette]);

  const friend = friends.find((f) => f.id === id);
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const related = useMemo(() => (friend ? getSplitExpensesForFriend(expenses, friend) : []), [expenses, friend]);
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const sortedRelated = useMemo(
    () => related.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [related]
  );
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const totalShare = useMemo(() => {
    if (!friend) return 0;
    return related.reduce((s, e) => s + sumFriendShareInExpense(e, friend), 0);
  }, [friend, related]);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(friend?.displayName ?? '');
  const [email, setEmail] = useState(friend?.email ?? '');
  const [note, setNote] = useState(friend?.note ?? '');
  const [color, setColor] = useState(friend?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);

  const [prevFriend, setPrevFriend] = useState(friend);
  if (friend !== prevFriend) {
    setPrevFriend(friend);
    if (friend) {
      setName(friend.displayName);
      setEmail(friend.email ?? '');
      setNote(friend.note ?? '');
      setColor(friend.color ?? COLORS[0]);
    }
  }

  const persist = async () => {
    if (!user || !friend) return;
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter a display name.');
      return;
    }
    try {
      setSaving(true);
      await updateSplitFriend(user.uid, friend.id, {
        displayName: n,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        color,
      });
      setSaving(false);
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not update profile.');
      setSaving(false);
    }
  };

  const remove = () => {
    if (!user || !friend) return;
    Alert.alert('Remove friend', 'Their name stays on past expenses, but the saved profile will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSplitFriend(user.uid, friend.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  };

  if (!friend) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.muted }}>Profile not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary, fontWeight: '700' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.line }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon source="arrow-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {friend.displayName}
        </Text>
        <Pressable onPress={() => (editing ? persist() : setEditing(true))} style={styles.iconBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Text style={{ color: palette.primary, fontWeight: '800' }}>{editing ? 'Save' : 'Edit'}</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={sortedRelated}
        keyExtractor={(item) => item.id}
        contentInset={{ bottom: insets.bottom + 24 }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { backgroundColor: friend.color || palette.primary }]}>
              <Text style={styles.heroLetter}>{(friend.displayName[0] || '?').toUpperCase()}</Text>
              <Text style={styles.heroSub}>Total recorded share (all splits)</Text>
              <Text style={styles.heroAmt}>{formatAmount(totalShare)}</Text>
              <Text style={styles.heroCount}>{related.length} shared expense{related.length === 1 ? '' : 's'}</Text>
            </View>

            {editing ? (
              <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                <Text style={[styles.label, { color: palette.muted }]}>Name</Text>
                <TextInput
                  style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface }]}
                  value={name}
                  onChangeText={setName}
                />
                <Text style={[styles.label, { color: palette.muted }]}>Email</Text>
                <TextInput
                  style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface }]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={[styles.label, { color: palette.muted }]}>Note</Text>
                <TextInput
                  style={[
                    styles.input,
                    { minHeight: 72, textAlignVertical: 'top' },
                    { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                <Text style={[styles.label, { color: palette.muted }]}>Color</Text>
                <View style={styles.colorRow}>
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        color === c && { borderWidth: 3, borderColor: '#fff' },
                      ]}
                    />
                  ))}
                </View>
                <Pressable onPress={() => setEditing(false)} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                  <Text style={{ color: palette.muted, fontWeight: '600' }}>Cancel edit</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                {friend.email ? (
                  <Text style={[styles.meta, { color: palette.text }]}>
                    <Text style={{ color: palette.muted }}>Email </Text>
                    {friend.email}
                  </Text>
                ) : null}
                {friend.note ? (
                  <Text style={[styles.meta, { color: palette.text, marginTop: 8 }]}>
                    <Text style={{ color: palette.muted }}>Note </Text>
                    {friend.note}
                  </Text>
                ) : null}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: palette.muted }]}>History</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyHist, { color: palette.muted }]}>
            No split expenses yet. Add them from a shared expense with this person.
          </Text>
        }
        renderItem={({ item }) => {
          const share = sumFriendShareInExpense(item, friend);
          return (
            <Pressable
              style={[styles.histRow, { backgroundColor: palette.surface, borderColor: palette.line }]}
              onPress={() => router.push(`/expense/${item.id}`)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.histName, { color: palette.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.histDate, { color: palette.muted }]}>
                  {formatShortDate(item.date)}
                </Text>
              </View>
              <Text style={[styles.histAmt, { color: palette.text }]}>{formatAmount(share)}</Text>
              <Icon source="chevron-right" size={20} color={palette.muted} />
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={remove} style={styles.deleteBtn}>
            <Icon source="trash-can-outline" size={20} color={palette.danger} />
            <Text style={[styles.deleteTxt, { color: palette.danger }]}>Delete saved profile</Text>
          </Pressable>
        }
      />
    </View>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconBtn: { padding: 8, minWidth: 56 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
    hero: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 20 },
    heroLetter: { color: '#fff', fontSize: 40, fontWeight: '900', opacity: 0.95 },
    heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 12, fontWeight: '600' },
    heroAmt: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
    heroCount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 8 },
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
    input: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorDot: { width: 36, height: 36, borderRadius: 18 },
    meta: { fontSize: 15, lineHeight: 22 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginHorizontal: 16, marginTop: 24, marginBottom: 10 },
    emptyHist: { marginHorizontal: 16, fontSize: 14, lineHeight: 20 },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    histName: { fontSize: 15, fontWeight: '700' },
    histDate: { fontSize: 12, marginTop: 2 },
    histAmt: { fontSize: 15, fontWeight: '800' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 28 },
    deleteTxt: { fontSize: 15, fontWeight: '700' },
  });
}
