import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import { parseReminderWithAi } from '@/services/reminderAi';
import { createReminder, listenToReminders, updateReminder } from '@/services/reminders';
import { scheduleReminderNotifications } from '@/services/notifications';
import { Reminder, ReminderDraft } from '@/types/reminder';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
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
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EXAMPLES = [
  'kal meeting hai 12 baje',
  'mom ko 8 baje call karna',
  'netflix renew 5 june',
  'Tomorrow medicine 9 PM remind me',
];

function formatDateTime(value: string | null) {
  if (!value) return 'Needs time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Needs time';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function categoryIcon(category: string) {
  switch (category) {
    case 'travel': return 'airplane';
    case 'subscription': return 'repeat';
    case 'utility': return 'flash';
    case 'work': return 'briefcase-outline';
    case 'health': return 'pill';
    case 'education': return 'school-outline';
    case 'finance': return 'cash';
    default: return 'sparkles';
  }
}

export default function AssistantScreen() {
  const { user } = useAppData();
  const { palette, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette, theme === 'dark'), [palette, theme]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }

    return listenToReminders(
      user.uid,
      setReminders,
      (error) => console.warn('Reminder sync failed:', error)
    );
  }, [user]);

  const parseText = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const nextDraft = await parseReminderWithAi({ text: trimmed, source: 'text' });
      setDraft(nextDraft);
      setInput(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('AI parser failed', error?.message ?? 'Could not understand this reminder.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.75,
    });

    if (result.canceled || !result.assets[0]) return;
    const imageBase64 = result.assets[0].base64;
    if (!imageBase64) {
      Alert.alert('Image unavailable', 'Could not read image data. Try another image.');
      return;
    }

    setLoading(true);
    try {
      const asset = result.assets[0];
      const nextDraft = await parseReminderWithAi({
        text: 'Extract reminder details from this uploaded image.',
        source: 'image',
        imageBase64,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setDraft(nextDraft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Image extraction failed', error?.message ?? 'Could not extract a reminder from this image.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!user || !draft) return;
    setSaving(true);
    try {
      const id = await createReminder(user.uid, draft);
      const notificationIds = await scheduleReminderNotifications({ ...draft, id });
      if (notificationIds.length > 0) {
        await updateReminder(user.uid, id, { notificationIds });
      }
      setDraft(null);
      setInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Could not save reminder', error?.message ?? 'Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const upcoming = reminders
    .filter((reminder) => reminder.status === 'active')
    .slice(0, 6);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 10 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 110 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Mavrix AI</Text>
            <Text style={styles.title}>Reminder Assistant</Text>
          </View>
          <View style={styles.aiOrb}>
            <Icon source="sparkles" size={24} color="#FFF" />
          </View>
        </View>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type naturally: kal subah bill bharna..."
            placeholderTextColor={palette.muted}
            multiline
            style={styles.input}
          />
          <View style={styles.actions}>
            <Pressable style={styles.iconButton} onPress={uploadImage} disabled={loading}>
              <Icon source="image-plus" size={22} color={palette.text} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => Alert.alert('Voice reminders', 'Voice input is ready for the next build phase.')} disabled={loading}>
              <Icon source="microphone-outline" size={22} color={palette.text} />
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => parseText()} disabled={loading || !input.trim()}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Icon source="arrow-up" size={22} color="#FFF" />}
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examples}>
          {EXAMPLES.map((example) => (
            <Pressable key={example} style={styles.exampleChip} onPress={() => parseText(example)}>
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {draft && (
          <View style={styles.confirmCard}>
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Icon source={categoryIcon(draft.category)} size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{draft.title}</Text>
                <Text style={styles.cardMeta}>{formatDateTime(draft.datetime)} • {draft.category}</Text>
              </View>
              <Text style={styles.confidence}>{Math.round(draft.confidence * 100)}%</Text>
            </View>
            {!!draft.notes && <Text style={styles.notes}>{draft.notes}</Text>}
            <View style={styles.leads}>
              {draft.smartReminders.map((lead) => (
                <View key={`${lead.label}-${lead.minutesBefore}`} style={styles.leadPill}>
                  <Text style={styles.leadText}>{lead.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.confirmActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setDraft(null)}>
                <Text style={styles.secondaryText}>Dismiss</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveDraft} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Confirm</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Upcoming AI reminders</Text>
        {upcoming.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="calendar-clock" size={28} color={palette.muted} />
            <Text style={styles.emptyText}>No AI reminders yet</Text>
          </View>
        ) : upcoming.map((reminder) => (
          <View key={reminder.id} style={styles.reminderRow}>
            <View style={styles.rowIcon}>
              <Icon source={categoryIcon(reminder.category)} size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{reminder.title}</Text>
              <Text style={styles.rowMeta}>{formatDateTime(reminder.datetime)} • {reminder.smartReminders.length} alerts</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any, isDark: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  aiOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  composer: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  input: {
    color: palette.text,
    minHeight: 88,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#2A2A2C' : '#F3F4F6',
  },
  primaryButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  examples: {
    gap: 10,
    paddingVertical: 16,
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: isDark ? '#222224' : '#F3F4F6',
    borderColor: palette.border,
    borderWidth: 1,
  },
  exampleText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: palette.surface,
    borderColor: palette.primary + '55',
    borderWidth: 1,
    marginBottom: 18,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '900',
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  confidence: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  notes: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  leads: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  leadPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.primary + '18',
  },
  leadText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: isDark ? '#2A2A2C' : '#F3F4F6',
  },
  secondaryText: {
    color: palette.text,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  saveText: {
    color: '#FFF',
    fontWeight: '900',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  emptyState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  emptyText: {
    color: palette.muted,
    fontWeight: '700',
    marginTop: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary + '16',
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
});
