import { useTheme } from '@/contexts/theme';
import { useSplitFriendStore } from '@/store/useSplitFriendStore';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SplitFriendsListScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { friends, isLoading } = useSplitFriendStore();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.line }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Icon source="arrow-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Split friends</Text>
        <Pressable
          onPress={() => router.push('/friend/create')}
          style={[styles.addBtn, { backgroundColor: palette.primary }]}
        >
          <Icon source="plus" size={22} color="#fff" />
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: palette.muted }]}>
        Create a profile once, then add them to any split. Open a friend to see shared expense history and totals.
      </Text>

      {isLoading && friends.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.empty}>
          <Icon source="account-group-outline" size={48} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No saved friends yet</Text>
          <Text style={[styles.emptySub, { color: palette.muted }]}>
            Add people from a split expense, or tap + to create a profile.
          </Text>
          <Pressable style={[styles.cta, { backgroundColor: palette.primary }]} onPress={() => router.push('/friend/create')}>
            <Text style={styles.ctaTxt}>Create profile</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentInset={{ bottom: insets.bottom + 24 }}
          scrollIndicatorInsets={{ bottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.line }]}
              onPress={() => router.push(`/friend/${item.id}`)}
            >
              <View style={[styles.avatar, { backgroundColor: item.color || palette.primary }]}>
                <Text style={styles.avatarTxt}>{(item.displayName[0] || '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.email ? (
                  <Text style={[styles.email, { color: palette.muted }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                ) : null}
              </View>
              <Icon source="chevron-right" size={22} color={palette.muted} />
            </Pressable>
          )}
        />
      )}
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
    iconBtn: { padding: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center', marginRight: 40 },
    addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    hint: { fontSize: 13, lineHeight: 18, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    cta: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
    name: { fontSize: 16, fontWeight: '700' },
    email: { fontSize: 13, marginTop: 2 },
  });
}
