import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import { createSplitFriend } from '@/services/splitFriendService';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6'];

export default function CreateSplitFriendScreen() {
  "use no memo";

  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAppData();
  const navigation = useNavigation();
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const save = useCallback(async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter how you call this person.');
      return;
    }
    if (!user) return;
    try {
      setSaving(true);
      await createSplitFriend(user.uid, {
        displayName: name,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        color,
      });
      setSaving(false);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save profile.');
      setSaving(false);
    }
  }, [color, displayName, email, note, user]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        saving ? (
          <ActivityIndicator style={{ marginRight: 12 }} color={palette.primary} />
        ) : (
          <Pressable onPress={save} style={{ marginRight: 12 }}>
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 16 }}>Save</Text>
          </Pressable>
        ),
    });
  }, [navigation, palette.primary, save, saving]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInset={{ bottom: insets.bottom + 32 }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 32 }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: palette.muted }]}>Display name</Text>
        <TextInput
          style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Alex"
          placeholderTextColor={palette.muted}
        />

        <Text style={[styles.label, { color: palette.muted }]}>Email (optional)</Text>
        <TextInput
          style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface }]}
          value={email}
          onChangeText={setEmail}
          placeholder="For payment reminders"
          placeholderTextColor={palette.muted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: palette.muted }]}>Note (optional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface },
          ]}
          value={note}
          onChangeText={setNote}
          placeholder="Bank details, handle, etc."
          placeholderTextColor={palette.muted}
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
                color === c && { borderWidth: 3, borderColor: palette.text },
              ]}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: any) {
  return StyleSheet.create({
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
    input: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      fontSize: 16,
    },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    colorDot: { width: 36, height: 36, borderRadius: 18 },
  });
}
