import type { SplitFriend } from '@/types/splitFriend';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';

type Palette = {
  text: string;
  muted: string;
  line: string;
  surface: string;
  primary: string;
  background: string;
};

export function SplitFriendPickerStrip({
  friends,
  palette,
  onPickFriend,
  onOpenFriends,
}: {
  friends: SplitFriend[];
  palette: Palette;
  onPickFriend: (friend: SplitFriend) => void;
  onOpenFriends: () => void;
}) {
  const primaryColor = palette.primary;
  return (
    <View style={styles.wrap}>
      <View style={styles.rowTitle}>
        <Icon source="account-heart-outline" size={22} color={primaryColor} />
        <Text style={[styles.title, { color: palette.muted }]}>Saved split friends</Text>
        <Pressable onPress={onOpenFriends} hitSlop={8} style={styles.manageBtn}>
          <Text style={[styles.manageTxt, { color: primaryColor }]}>Manage</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={onOpenFriends}
          style={[styles.chip, { borderColor: palette.line, backgroundColor: palette.surface }]}
        >
          <Icon source="plus" size={20} color={primaryColor} />
          <Text style={[styles.chipTxt, { color: primaryColor }]}>New profile</Text>
        </Pressable>
        {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
        {friends.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => onPickFriend(f)}
            style={[styles.chip, { borderColor: palette.line, backgroundColor: palette.background }]}
          >
            <Text style={[styles.chipTxt, { color: palette.text }]} numberOfLines={1}>
              {f.displayName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 16, paddingBottom: 6, paddingTop: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  manageBtn: { paddingVertical: 6, paddingLeft: 8 },
  manageTxt: { fontSize: 14, fontWeight: '700' },
  scroll: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 240,
    minHeight: 46,
    justifyContent: 'center',
  },
  chipTxt: { fontSize: 14, fontWeight: '700' },
});
