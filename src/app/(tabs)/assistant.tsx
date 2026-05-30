import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import { AssistantChatMessage, sendAssistantChat } from '@/services/assistantChat';
import { parseReminderWithAi } from '@/services/reminderAi';
import { createReminder, deleteReminder, listenToReminders, updateReminder } from '@/services/reminders';
import { cancelReminderNotifications, scheduleReminderNotifications } from '@/services/notifications';
import {
  Reminder,
  ReminderAlertMode,
  ReminderCategory,
  ReminderDraft,
  ReminderLead,
  ReminderRepeat,
  ReminderType,
} from '@/types/reminder';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Animated,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Switch,
  Keyboard,
  TextInput as RNTextInput,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  IconButton,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';

const EXAMPLES = [
  'Remind me to pay Netflix on June 5',
  'Call mom tomorrow at 8 PM',
  'Medicine reminder every day at 9 PM',
  'Create a bill reminder for Friday',
];

const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const CATEGORY_OPTIONS: { value: ReminderCategory; label: string; icon: string }[] = [
  { value: 'personal', label: 'Personal', icon: 'account-outline' },
  { value: 'work', label: 'Work', icon: 'briefcase-outline' },
  { value: 'health', label: 'Health', icon: 'pill' },
  { value: 'travel', label: 'Travel', icon: 'airplane' },
  { value: 'subscription', label: 'Subscription', icon: 'repeat' },
  { value: 'utility', label: 'Bills', icon: 'flash' },
  { value: 'education', label: 'Study', icon: 'school-outline' },
  { value: 'finance', label: 'Money', icon: 'cash' },
  { value: 'family', label: 'Family', icon: 'account-group-outline' },
];

const QUICK_LEADS: { label: string; minutesBefore: number }[] = [
  { label: 'At time', minutesBefore: 0 },
  { label: '10 min', minutesBefore: 10 },
  { label: '30 min', minutesBefore: 30 },
  { label: '1 hour', minutesBefore: 60 },
  { label: '1 day', minutesBefore: 1440 },
  { label: '3 days', minutesBefore: 4320 },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 300);

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Needs date and time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Needs date and time';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isExpired(reminder: Pick<ReminderDraft, 'datetime'>) {
  if (!reminder.datetime) return false;
  const date = new Date(reminder.datetime);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function categoryIcon(category: string) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.icon || 'calendar-clock';
}

function createManualDraft(): ReminderDraft {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30, 0, 0);
  return {
    title: 'New reminder',
    type: 'task',
    category: 'personal',
    datetime: date.toISOString(),
    location: null,
    notes: null,
    repeat: 'none',
    source: 'manual',
    alertMode: 'sound',
    confidence: 1,
    smartReminders: [{ label: 'At time', minutesBefore: 0 }],
  };
}

function inferType(category: ReminderCategory): ReminderType {
  if (category === 'travel') return 'travel';
  if (category === 'subscription') return 'subscription';
  if (category === 'utility') return 'bill';
  if (category === 'work') return 'meeting';
  if (category === 'health') return 'medicine';
  if (category === 'education') return 'exam';
  return 'task';
}

export default function AssistantScreen() {
  const { user } = useAppData();
  const { palette, theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = createStyles(palette, isDark);
  const router = useRouter();
  const navigation = useNavigation();
  const keyboardAvoidingBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 52 : 0;

  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState<(AssistantChatMessage & { savedReminder?: ReminderDraft & { id?: string } })[]>([
    {
      role: 'assistant',
      text: 'Tell me what to remember, or ask a question.',
    },
  ]);
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [previewingMode, setPreviewingMode] = useState<'sound' | 'alarm' | null>(null);
  const previewSoundRef = useRef<InstanceType<typeof Audio.Sound> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sidebar state and animations
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [expandedReminderId, setExpandedReminderId] = useState<string | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [typingText, setTypingText] = useState('Thinking');
  const [sessions, setSessions] = useState<{ id: string; title: string; messages: any[]; updatedAt: number }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [remindersFolderOpen, setRemindersFolderOpen] = useState(false);
  const [statsFolderOpen, setStatsFolderOpen] = useState(false);

  // User custom Gemini API key state variables
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [hasCheckedKey, setHasCheckedKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [keyInputText, setKeyInputText] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const storedKey = await AsyncStorage.getItem('subtrack:user_gemini_api_key');
        setUserApiKey(storedKey);
        if (storedKey) {
          setKeyInputText(storedKey);
        }
      } catch (err) {
        console.warn('Error reading Gemini API key:', err);
      } finally {
        setHasCheckedKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSaveApiKey = async () => {
    const trimmed = keyInputText.trim();
    if (!trimmed) {
      Alert.alert('Key Required', 'Please enter a valid Gemini API key.');
      return;
    }

    if (!trimmed.startsWith('AIzaSy')) {
      Alert.alert(
        'Invalid Key Format',
        'Gemini API keys typically start with "AIzaSy". Please double-check your key before connecting.'
      );
      return;
    }

    try {
      await AsyncStorage.setItem('subtrack:user_gemini_api_key', trimmed);
      setUserApiKey(trimmed);
      setEditingApiKey(false);
      Alert.alert('Connected', 'Mavrix is now connected to your Gemini API key!');
    } catch {
      Alert.alert('Storage Error', 'Could not save your API key. Please try again.');
    }
  };

  const handleResetApiKey = async () => {
    Alert.alert(
      'Disconnect Key',
      'Are you sure you want to disconnect your Gemini API key? You won\'t be able to chat with Mavrix until you connect again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('subtrack:user_gemini_api_key');
              setUserApiKey(null);
              setKeyInputText('');
              setEditingApiKey(false);
            } catch {
              Alert.alert('Error', 'Could not disconnect API key.');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!user) return;

    return listenToReminders(
      user.uid,
      setReminders,
      (error) => console.warn('Reminder sync failed:', error)
    );
  }, [user]);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Auto-scroll chat to end when software keyboard shows up
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Loading animation dot ticker
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setTypingText((cur) => {
        if (cur === 'Thinking...') return 'Thinking';
        return cur + '.';
      });
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll to end when tools tray or active draft opens to prevent overlap/obscured content
  useEffect(() => {
    if (toolsOpen || draft) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [toolsOpen, draft]);

  // Cleanup preview sound on unmount
  useEffect(() => {
    return () => {
      previewSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playPreview = async (mode: 'sound' | 'alarm') => {
    try {
      // Unload any previous preview
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
      // If tapping same mode that is already previewing, just stop
      if (previewingMode === mode) {
        setPreviewingMode(null);
        return;
      }
      setPreviewingMode(mode);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const asset =
        mode === 'sound'
          ? require('../../../assets/sound_preview.wav')
          : require('../../../assets/alarm_preview.wav');
      const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true });
      previewSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPreviewingMode(null);
          sound.unloadAsync().catch(() => {});
          previewSoundRef.current = null;
        }
      });
    } catch (e) {
      setPreviewingMode(null);
      Alert.alert('Preview unavailable', 'Could not play sound preview on this device.');
    }
  };

  const toggleSidebar = (open: boolean) => {
    if (open) {
      Keyboard.dismiss();
      setSidebarVisible(true);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setSidebarVisible(false);
      });
    }
  };

  const handleNewChat = () => {
    setChatMessages([
      {
        role: 'assistant',
        text: 'Tell me what to remember, or ask a question.',
      },
    ]);
    setDraft(null);
    setEditingId(null);
    setInput('');
    setToolsOpen(false);
    toggleSidebar(false);
    setCurrentSessionId(null);
  };

  const storageKey = user ? `subtrack:chat_history:${user.uid}` : 'subtrack:chat_history:guest';

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          setSessions(JSON.parse(stored));
        } else {
          setSessions([]);
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      }
    };
    loadHistory();
  }, [storageKey]);

  const saveSession = async (messagesList: any[], sessionId: string | null) => {
    try {
      let updatedSessions = [...sessions];
      let activeId = sessionId;

      const index = updatedSessions.findIndex(s => s.id === activeId);
      const hasUserMsg = messagesList.some(m => m.role === 'user');
      if (!hasUserMsg) return sessionId;

      if (index > -1 && activeId) {
        // Update existing
        updatedSessions[index] = {
          ...updatedSessions[index],
          messages: messagesList,
          updatedAt: Date.now(),
        };
      } else {
        // Create new session
        const newId = Date.now().toString();
        activeId = newId;
        setCurrentSessionId(newId);

        const firstUserMsg = messagesList.find(m => m.role === 'user');
        const titleText = firstUserMsg ? firstUserMsg.text : 'New Chat';
        const title = titleText.length > 28 ? titleText.substring(0, 25) + '...' : titleText;

        updatedSessions.unshift({
          id: newId,
          title,
          messages: messagesList,
          updatedAt: Date.now(),
        });
      }

      setSessions(updatedSessions);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSessions));
      return activeId;
    } catch (err) {
      console.warn('Failed to save chat session:', err);
      return sessionId;
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const filtered = sessions.filter(s => s.id !== id);
      setSessions(filtered);
      await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));

      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.warn('Failed to delete chat session:', err);
    }
  };

  const applyDraft = (nextDraft: ReminderDraft, editId: string | null = null) => {
    setDraft({
      ...nextDraft,
      alertMode: nextDraft.alertMode || 'sound',
      smartReminders: nextDraft.smartReminders?.length
        ? nextDraft.smartReminders
        : [{ label: 'At time', minutesBefore: 0 }],
    });
    setEditingId(editId);
    // Scroll to bottom so draft card is visible
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const updateDraft = (updates: Partial<ReminderDraft>) => {
    setDraft((current) => current ? { ...current, ...updates } : current);
  };

  const getDraftDate = () => {
    if (!draft?.datetime) return new Date();
    const date = new Date(draft.datetime);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };

  const handlePickerChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!draft || !pickerMode || !selectedDate) return;

    const next = getDraftDate();
    if (pickerMode === 'date') {
      next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    } else {
      next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    }

    updateDraft({ datetime: next.toISOString() });
  };

  const setCategory = (category: ReminderCategory) => {
    updateDraft({ category, type: inferType(category) });
  };

  const toggleLead = (lead: ReminderLead) => {
    if (!draft) return;
    const exists = draft.smartReminders.some((item) => item.minutesBefore === lead.minutesBefore);
    const smartReminders = exists
      ? draft.smartReminders.filter((item) => item.minutesBefore !== lead.minutesBefore)
      : [...draft.smartReminders, lead].sort((a, b) => b.minutesBefore - a.minutesBefore);
    updateDraft({ smartReminders: smartReminders.length ? smartReminders : [{ label: 'At time', minutesBefore: 0 }] });
  };

  const parseText = async (text = input, source: 'text' = 'text') => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const history = chatMessages.slice(-8);

    const userMsg = { role: 'user', text: trimmed } as const;
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setInput('');
    setLoading(true);

    const activeId = await saveSession(nextMessages, currentSessionId);

    try {
      const result = await sendAssistantChat({ message: trimmed, history }, userApiKey || undefined);
      if (result.intent === 'reminder') {
        const nextDraft = result.reminder || await parseReminderWithAi({ text: trimmed, source });
        applyDraft({ ...nextDraft, source });
      }

      const replyMsg = { role: 'assistant', text: result.reply } as const;
      const finalMessages = [...nextMessages, replyMsg];
      setChatMessages(finalMessages);
      await saveSession(finalMessages, activeId);

      setToolsOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
    } catch (error: any) {
      Alert.alert('AI parser failed', error?.message ?? 'Could not understand this reminder.');
      const errorMsg = { role: 'assistant', text: 'I could not reach the assistant right now. Please try again.' } as const;
      const finalMessages = [...nextMessages, errorMsg];
      setChatMessages(finalMessages);
      await saveSession(finalMessages, activeId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  };

  const uploadImage = async () => {
    setToolsOpen(false);
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
      applyDraft(nextDraft);
      const userMsg = { role: 'user', text: 'Uploaded image' } as const;
      const assistantMsg = { role: 'assistant', text: 'I extracted a reminder from the image. Please review it before saving.' } as const;
      const nextMessages = [...chatMessages, userMsg, assistantMsg];
      setChatMessages(nextMessages);
      await saveSession(nextMessages, currentSessionId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
    } catch (error: any) {
      Alert.alert('Image extraction failed', error?.message ?? 'Could not extract a reminder from this image.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  };

  const startManual = async () => {
    applyDraft(createManualDraft());
    const userMsg = { role: 'user', text: 'Create a reminder manually' } as const;
    const assistantMsg = { role: 'assistant', text: 'Manual reminder draft is ready. Fill in the details and save it.' } as const;
    const nextMessages = [...chatMessages, userMsg, assistantMsg];
    setChatMessages(nextMessages);
    setToolsOpen(false);
    await saveSession(nextMessages, currentSessionId);
  };

  const startEdit = (reminder: Reminder) => {
    applyDraft({
      title: reminder.title,
      type: reminder.type,
      category: reminder.category,
      datetime: reminder.datetime,
      location: reminder.location,
      notes: reminder.notes,
      repeat: reminder.repeat,
      source: reminder.source,
      alertMode: reminder.alertMode || 'sound',
      confidence: reminder.confidence,
      smartReminders: reminder.smartReminders,
    }, reminder.id);
  };

  const handleEditReminder = (reminder: Reminder) => {
    startEdit(reminder);
    toggleSidebar(false);
  };

  const saveDraft = async () => {
    if (!user || !draft) return;
    if (!draft.title.trim()) {
      Alert.alert('Title required', 'Add a short title for this reminder.');
      return;
    }
    if (!draft.datetime) {
      Alert.alert('Date required', 'Add a date and time before saving.');
      return;
    }

    setSaving(true);
    try {
      let savedId = editingId;
      if (editingId) {
        const existing = reminders.find((item) => item.id === editingId);
        const [, notificationIds] = await Promise.all([
          cancelReminderNotifications(existing?.notificationIds),
          scheduleReminderNotifications({ ...draft, id: editingId }),
        ]);
        await updateReminder(user.uid, editingId, {
          ...draft,
          status: 'active',
          notificationIds,
        });
      } else {
        const id = await createReminder(user.uid, draft);
        savedId = id;
        const notificationIds = await scheduleReminderNotifications({ ...draft, id });
        if (notificationIds.length > 0) {
          await updateReminder(user.uid, id, { notificationIds });
        }
      }
      
      const savedReminderData = { ...draft, id: savedId ?? undefined };
      const assistantMsg = {
        role: 'assistant',
        text: editingId
          ? `Successfully updated reminder: "${draft.title}"`
          : `Successfully created reminder: "${draft.title}"`,
        savedReminder: savedReminderData,
      } as const;
      const nextMessages = [...chatMessages, assistantMsg];
      setChatMessages(nextMessages);
      await saveSession(nextMessages, currentSessionId);

      setDraft(null);
      setEditingId(null);
      setInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaving(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (error: any) {
      Alert.alert('Could not save reminder', error?.message ?? 'Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaving(false);
    }
  };

  const updateStatus = async (reminder: Reminder, status: Reminder['status']) => {
    if (!user) return;
    await cancelReminderNotifications(reminder.notificationIds);
    await updateReminder(user.uid, reminder.id, { status, notificationIds: [] });
  };

  const removeReminder = (reminder: Reminder) => {
    if (!user) return;
    Alert.alert('Delete reminder?', reminder.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelReminderNotifications(reminder.notificationIds);
          await deleteReminder(user.uid, reminder.id);
        },
      },
    ]);
  };

  const userReminders = user ? reminders : [];
  const activeCount = userReminders.filter((item) => item.status === 'active').length;
  const expiredCount = userReminders.filter((reminder) => reminder.status === 'active' && isExpired(reminder)).length;

  const sidebarTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });


  // We show welcoming starters when user has no active conversation details yet (just initial assistant prompt)
  const isWelcomeState = chatMessages.length <= 1;
  const visibleMessages = chatMessages.slice(1);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'AI Remind',
      headerLeft: () => (
        <IconButton
          icon="menu"
          iconColor={palette.text}
          size={24}
          onPress={() => toggleSidebar(true)}
        />
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {userApiKey ? (
            <IconButton
              icon="chat-plus-outline"
              iconColor={palette.text}
              size={22}
              onPress={handleNewChat}
            />
          ) : null}
          <IconButton
            icon="home-outline"
            iconColor={palette.text}
            size={22}
            onPress={() => router.push('/(tabs)')}
          />
        </View>
      ),
    });
  }, [handleNewChat, navigation, palette.text, router, toggleSidebar, userApiKey]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={keyboardAvoidingBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {/* Main Content Area */}
      {!hasCheckedKey ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (!userApiKey || editingApiKey) ? (
        <ScrollView
          style={styles.setupScroll}
          contentContainerStyle={styles.setupScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.setupCard} mode="outlined">
            <Card.Content style={styles.setupCardContent}>
              <View style={styles.setupIconContainer}>
                <Surface style={styles.setupLogoCircle} mode="flat">
                  <Image
                    source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                    style={{ width: 64, height: 64, borderRadius: 16 }}
                  />
                </Surface>
              </View>

              <Text variant="headlineSmall" style={styles.setupTitle}>
                Connect Gemini AI (Beta)
              </Text>

              <Text variant="bodyMedium" style={styles.setupSubtitle}>
                To chat with Mavrix and unlock smart features like automated reminder scheduling, please link your Gemini API Key. It takes less than a minute and is 100% free.
              </Text>

              {/* Steps */}
              <View style={styles.stepsContainer}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text variant="titleSmall" style={styles.stepTitleText}>Get Your Free API Key</Text>
                    <Text variant="bodySmall" style={styles.stepDescriptionText}>
                      {"Tap the button below to visit Google AI Studio. Click \"Create API key\"."}
                    </Text>
                  </View>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text variant="titleSmall" style={styles.stepTitleText}>Copy & Paste It Here</Text>
                    <Text variant="bodySmall" style={styles.stepDescriptionText}>
                      {"Copy the generated key (typically starting with \"AIzaSy\") and paste it in the field below."}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Get Key Button */}
              <Button
                mode="contained-tonal"
                icon="open-in-new"
                onPress={() => Linking.openURL('https://aistudio.google.com/')}
                style={styles.getKeyButton}
                textColor={palette.primary}
              >
                Get Free Gemini Key
              </Button>

              <Divider style={{ marginVertical: 16 }} />

              {/* Input Field */}
              <TextInput
                label="Gemini API Key"
                value={keyInputText}
                onChangeText={setKeyInputText}
                secureTextEntry={!showKeyText}
                right={
                  <TextInput.Icon
                    icon={showKeyText ? "eye-off" : "eye"}
                    onPress={() => setShowKeyText(!showKeyText)}
                  />
                }
                mode="outlined"
                outlineColor={palette.border}
                activeOutlineColor={palette.primary}
                style={styles.keyInput}
                placeholder="Paste AIzaSy..."
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Action Buttons */}
              <View style={styles.setupActions}>
                <Button
                  mode="contained"
                  onPress={handleSaveApiKey}
                  style={styles.saveButton}
                  buttonColor={palette.primary}
                  textColor="#FFFFFF"
                >
                  Save & Connect
                </Button>

                {userApiKey && (
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setEditingApiKey(false);
                      setKeyInputText(userApiKey);
                    }}
                    style={styles.cancelButton}
                    textColor={palette.muted}
                  >
                    Cancel
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={[
              styles.chatScrollContent,
              isWelcomeState && { justifyContent: 'center' },
              { paddingBottom: draft ? (toolsOpen ? 220 : 140) : (toolsOpen ? 120 : 24) }
            ]}
            keyboardShouldPersistTaps="handled"
          >
        {isWelcomeState ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeHeader}>
              <Surface style={styles.logoCircle} mode="flat">
                <Image
                  source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                  style={{ width: 34, height: 34, borderRadius: 9 }}
                />
              </Surface>
              <View style={styles.welcomeCopy}>
                <Text variant="headlineSmall" style={styles.welcomeTitle}>
                  AI Remind
                </Text>
                <Text variant="bodyMedium" style={styles.welcomeSubtitle}>
                  Create reminders from natural language.
                </Text>
              </View>
            </View>

            <View style={styles.suggestionSection}>
              <View style={styles.suggestionHeaderRow}>
                <Text variant="labelLarge" style={styles.sectionHeading}>
                  Try saying
                </Text>
                <Text variant="labelSmall" style={styles.suggestionHint}>
                  Tap to start
                </Text>
              </View>
              <View style={styles.suggestionGrid}>
                {EXAMPLES.map((example) => (
                  <Pressable
                    key={example}
                    style={({ pressed }) => [
                      styles.suggestionCard,
                      pressed && { backgroundColor: palette.border + '66' },
                    ]}
                    android_ripple={{ color: palette.primary + '22' }}
                    onPress={() => parseText(example)}
                  >
                    <View style={styles.suggestionIconBox}>
                      <Icon source="bell-outline" size={18} color={palette.primary} />
                    </View>
                    <Text variant="bodyMedium" style={styles.suggestionText} numberOfLines={2}>
                      {example}
                    </Text>
                    <Icon source="chevron-right" size={18} color={palette.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          visibleMessages.map((message, index) => {
            const fromUser = message.role === 'user';
            return (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.messageRow,
                  fromUser ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {!fromUser && (
                  <View style={styles.assistantAvatar}>
                    <Image
                      source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4, alignItems: fromUser ? 'flex-end' : 'flex-start' }}>
                  <View style={fromUser ? styles.userBubble : styles.assistantBubble}>
                    <Text
                      variant="bodyMedium"
                      style={fromUser ? styles.userBubbleText : styles.bubbleText}
                    >
                      {message.text}
                    </Text>
                  </View>
                  {message.savedReminder && (
                    <Surface mode="elevated" style={styles.savedReminderCard}>
                      <View style={styles.savedReminderHeader}>
                        <View style={styles.savedReminderBadge}>
                          <Icon source="check-circle" size={12} color="#FFFFFF" />
                          <Text style={styles.savedReminderBadgeText}>Saved Successfully</Text>
                        </View>
                        <Icon source={categoryIcon(message.savedReminder.category)} size={18} color={palette.primary} />
                      </View>
                      <View style={styles.savedReminderContent}>
                        <Text style={styles.savedReminderTitle} numberOfLines={1}>
                          {message.savedReminder.title}
                        </Text>
                        <Text style={styles.savedReminderDate}>
                          {formatDateTime(message.savedReminder.datetime)}
                        </Text>
                      </View>
                      <Divider style={{ marginVertical: 8, opacity: 0.5 }} />
                      <View style={styles.savedReminderFooter}>
                        <View style={styles.savedReminderPill}>
                          <Icon source={message.savedReminder.alertMode === 'alarm' ? 'alarm' : 'volume-high'} size={12} color={palette.muted} />
                          <Text style={styles.savedReminderPillText}>
                            {message.savedReminder.alertMode === 'alarm' ? 'Alarm' : 'Sound'}
                          </Text>
                        </View>
                        {message.savedReminder.repeat !== 'none' && (
                          <View style={styles.savedReminderPill}>
                            <Icon source="sync" size={12} color={palette.muted} />
                            <Text style={styles.savedReminderPillText}>{message.savedReminder.repeat}</Text>
                          </View>
                        )}
                      </View>
                    </Surface>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Loading Pulsing/Thinking indicator */}
        {loading && (
          <View style={[styles.messageRow, styles.assistantMessageRow]}>
            <View style={styles.assistantAvatar}>
              <Image
                source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            </View>
            <View style={styles.assistantBubble}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={styles.loadingText}>{typingText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Inline Active Reminder Draft card */}
        {draft && (
          <Card mode="elevated" style={styles.card}>
            <Card.Title
              title={editingId ? 'Edit reminder' : 'Review reminder'}
              subtitle={`${formatDateTime(draft.datetime)} · ${Math.round(draft.confidence * 100)}% confidence`}
              left={(props) => (
                <Icon {...props} source={categoryIcon(draft.category)} color={palette.primary} />
              )}
            />
            <Card.Content style={styles.cardContent}>
              {isExpired(draft) && (
                <Surface mode="flat" style={styles.expiredSurface}>
                  <Icon source="alert-circle-outline" size={20} color={palette.danger} />
                  <Text variant="bodyMedium" style={styles.expiredText}>
                    This date is expired. Change the date/time before saving.
                  </Text>
                </Surface>
              )}

              <TextInput
                mode="outlined"
                label="Title"
                value={draft.title}
                onChangeText={(title) => updateDraft({ title })}
              />

              <View style={styles.twoColumn}>
                <TextInput
                  mode="outlined"
                  label="Date"
                  value={toDateInput(draft.datetime)}
                  editable={false}
                  showSoftInputOnFocus={false}
                  onPressIn={() => setPickerMode('date')}
                  right={<TextInput.Icon icon="calendar-month-outline" onPress={() => setPickerMode('date')} />}
                  placeholder="YYYY-MM-DD"
                  style={styles.flexItem}
                />
                <TextInput
                  mode="outlined"
                  label="Time"
                  value={toTimeInput(draft.datetime)}
                  editable={false}
                  showSoftInputOnFocus={false}
                  onPressIn={() => setPickerMode('time')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerMode('time')} />}
                  placeholder="HH:mm"
                  style={styles.timeInput}
                />
              </View>

              {pickerMode && (
                <Surface mode="flat" style={styles.pickerSurface}>
                  <DateTimePicker
                    value={getDraftDate()}
                    mode={pickerMode}
                    display="spinner"
                    onChange={handlePickerChange}
                  />
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() => setPickerMode(null)}
                    style={{ alignSelf: 'flex-end', marginTop: 4, marginRight: 4 }}
                  >
                    Done
                  </Button>
                </Surface>
              )}

              <Text variant="labelLarge" style={styles.sectionLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    compact
                    icon={option.icon}
                    mode={draft.category === option.value ? 'flat' : 'outlined'}
                    selected={draft.category === option.value}
                    onPress={() => setCategory(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </ScrollView>

              <Text variant="labelLarge" style={styles.sectionLabel}>Repeat</Text>
              <View style={styles.wrapRow}>
                {REPEAT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    compact
                    mode={draft.repeat === option.value ? 'flat' : 'outlined'}
                    selected={draft.repeat === option.value}
                    onPress={() => updateDraft({ repeat: option.value })}
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>

              <Text variant="labelLarge" style={styles.sectionLabel}>Reminder alerts</Text>
              <View style={styles.wrapRow}>
                {QUICK_LEADS.map((lead) => {
                  const selected = draft.smartReminders.some((item) => item.minutesBefore === lead.minutesBefore);
                  return (
                    <Chip
                      key={lead.minutesBefore}
                      compact
                      mode={selected ? 'flat' : 'outlined'}
                      selected={selected}
                      onPress={() => toggleLead(lead)}
                    >
                      {lead.label}
                    </Chip>
                  );
                })}
              </View>

              <View style={styles.alertModeRow}>
                {(['sound', 'alarm'] as ReminderAlertMode[]).map((mode) => {
                  const isSelected = (draft.alertMode || 'sound') === mode;
                  const isPreviewing = previewingMode === mode;
                  return (
                    <View key={mode} style={styles.alertModeItem}>
                      <Chip
                        compact
                        icon={mode === 'alarm' ? 'alarm' : 'volume-high'}
                        mode={isSelected ? 'flat' : 'outlined'}
                        selected={isSelected}
                        onPress={() => updateDraft({ alertMode: mode })}
                        style={styles.alertModeChip}
                      >
                        {mode === 'alarm' ? 'Alarm' : 'Sound'}
                      </Chip>
                      <Pressable
                        style={[styles.previewButton, isPreviewing && styles.previewButtonActive]}
                        onPress={() => playPreview(mode)}
                      >
                        <Icon
                          source={isPreviewing ? 'stop-circle-outline' : 'play-circle-outline'}
                          size={18}
                          color={isPreviewing ? palette.primary : (isDark ? '#a3a3a3' : '#6b7280')}
                        />
                        <Text style={[styles.previewButtonText, isPreviewing && { color: palette.primary }]}>
                          {isPreviewing ? 'Playing…' : 'Preview'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <TextInput
                mode="outlined"
                label="Location"
                value={draft.location || ''}
                onChangeText={(location) => updateDraft({ location: location.trim() ? location : null })}
              />
              <TextInput
                mode="outlined"
                label="Notes"
                value={draft.notes || ''}
                onChangeText={(notes) => updateDraft({ notes: notes.trim() ? notes : null })}
                multiline
                numberOfLines={3}
              />
            </Card.Content>
            <Card.Actions style={styles.formActions}>
              <Button onPress={() => { setDraft(null); setEditingId(null); }}>
                Cancel
              </Button>
              <Button mode="contained" onPress={saveDraft} loading={saving} buttonColor={palette.primary}>
                <Text style={styles.containedButtonText}>
                  {editingId ? 'Save changes' : 'Save reminder'}
                </Text>
              </Button>
            </Card.Actions>
          </Card>
        )}
      </ScrollView>

      {/* Composer Input Bar */}
      <Surface mode="flat" style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
        {toolsOpen && (
          <View style={styles.toolTray}>
            <Pressable style={styles.toolTile} onPress={startManual} disabled={loading}>
              <View style={[styles.toolIconCircle, { backgroundColor: palette.primary + '18' }]}>
                <Icon source="plus" size={22} color={palette.primary} />
              </View>
              <Text variant="labelSmall" style={styles.toolTileLabel}>Manual</Text>
            </Pressable>

            <Pressable style={styles.toolTile} onPress={uploadImage} disabled={loading}>
              <View style={[styles.toolIconCircle, { backgroundColor: '#10B98118' }]}>
                <Icon source="image-plus" size={22} color="#10B981" />
              </View>
              <Text variant="labelSmall" style={styles.toolTileLabel}>Image</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composerRow}>
          <IconButton
            icon={toolsOpen ? 'close' : 'plus'}
            mode="contained"
            size={20}
            iconColor={toolsOpen ? (isDark ? '#ffffff' : '#171717') : palette.primary}
            containerColor={
              toolsOpen 
                ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)') 
                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
            }
            style={styles.composerPlusButton}
            onPress={() => setToolsOpen((current) => !current)}
          />
          <View style={styles.inputShell}>
            <RNTextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message AI Remind..."
              placeholderTextColor={palette.muted}
              multiline
              style={styles.chatInput}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />
          </View>
          <IconButton
            icon="arrow-up"
            mode="contained"
            size={20}
            iconColor="#FFFFFF"
            containerColor={palette.primary}
            disabled={loading || !input.trim()}
            onPress={() => parseText()}
            style={styles.composerSendButton}
          />
        </View>
      </Surface>
        </>
      )}
      {/* Elegant Drawer Overlay */}
      {sidebarVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}>
          <Pressable style={styles.backdrop} onPress={() => toggleSidebar(false)}>
            <Animated.View style={[styles.backdropBg, { opacity: backdropOpacity }]} />
          </Pressable>

          <Animated.View
            style={[
              styles.sidebarContainer,
              { transform: [{ translateX: sidebarTranslateX }] },
            ]}
          >
            {/* Sidebar Header */}
            <View style={[styles.sidebarHeader, { paddingTop: insets.top + 6 }]}>
              <View style={styles.sidebarHeaderTitle}>
                <Image
                  source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                  style={{ width: 22, height: 22, borderRadius: 5, marginRight: 6 }}
                />
                <Text variant="titleMedium" style={styles.sidebarTitle}>
                  SubTrack AI (Beta)
                </Text>
              </View>
              <IconButton
                icon="chevron-left"
                iconColor={isDark ? '#a3a3a3' : '#6b7280'}
                size={22}
                onPress={() => toggleSidebar(false)}
                style={{ margin: 0 }}
              />
            </View>

            {/* Sidebar Scroll Items */}
            <ScrollView
              style={styles.sidebarScroll}
              contentContainerStyle={styles.sidebarScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Actions (ChatGPT styling) */}
              <View style={styles.sidebarNewChatRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sidebarNewChatButton,
                    pressed && { backgroundColor: isDark ? '#2c2c2c' : '#ececec' }
                  ]}
                  android_ripple={{ color: isDark ? '#444' : '#e5e5e5' }}
                  onPress={handleNewChat}
                >
                  <Icon source="message-plus-outline" size={18} color={isDark ? '#ffffff' : '#171717'} />
                  <Text style={styles.sidebarNewChatButtonText}>New chat</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.sidebarNewReminderButton,
                    pressed && { backgroundColor: isDark ? '#3a3a3a' : '#d9d9d9' }
                  ]}
                  android_ripple={{ color: isDark ? '#444' : '#e5e5e5' }}
                  onPress={() => {
                    startManual();
                    toggleSidebar(false);
                  }}
                >
                  <Icon source="plus" size={16} color={isDark ? '#ffffff' : '#171717'} />
                  <Text style={styles.sidebarNewReminderButtonText}>New Reminder</Text>
                </Pressable>
              </View>

              {/* Chat History Section */}
              <View style={styles.sidebarSection}>
                <View style={styles.sidebarSectionHeader}>
                  <Text variant="labelMedium" style={styles.sidebarSectionTitle}>
                    CHAT HISTORY
                  </Text>
                </View>
                {sessions.length === 0 ? (
                  <Text variant="bodySmall" style={styles.noHistoryText}>
                    No recent chats
                  </Text>
                ) : (
                  sessions.map((session) => (
                    <View key={session.id} style={styles.historyRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.historyItem,
                          session.id === currentSessionId && styles.historyItemActive,
                          pressed && { backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5' },
                        ]}
                        android_ripple={{ color: isDark ? '#444' : '#e5e5e5' }}
                        onPress={() => {
                          setCurrentSessionId(session.id);
                          setChatMessages(session.messages);
                          toggleSidebar(false);
                          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                        }}
                      >
                        <Icon source="chat-outline" size={16} color={session.id === currentSessionId ? palette.primary : (isDark ? '#b4b4b4' : '#6b7280')} />
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.historyText,
                            session.id === currentSessionId && styles.historyTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {session.title}
                        </Text>
                      </Pressable>
                      <IconButton
                        icon="trash-can-outline"
                        iconColor={isDark ? '#a3a3a3' : '#6b7280'}
                        size={16}
                        onPress={() => deleteSession(session.id)}
                        style={styles.deleteHistoryIcon}
                      />
                    </View>
                  ))
                )}
              </View>

              {/* Collapsible Summary Stats Folder */}
              <View style={styles.sidebarSection}>
                <Pressable
                  style={styles.folderHeader}
                  android_ripple={{ color: isDark ? '#333' : '#e5e5e5' }}
                  onPress={() => setStatsFolderOpen(!statsFolderOpen)}
                >
                  <Text variant="labelMedium" style={styles.sidebarSectionTitle}>
                    SUMMARY STATS
                  </Text>
                  <Icon
                    source={statsFolderOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isDark ? '#a3a3a3' : '#6b7280'}
                  />
                </Pressable>

                {statsFolderOpen && (
                  <View style={styles.statsPanel}>
                    <View style={styles.statCol}>
                      <Text style={styles.statVal}>{activeCount}</Text>
                      <Text style={styles.statLbl}>Active</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCol}>
                      <Text style={[styles.statVal, expiredCount > 0 && { color: palette.danger }]}>
                        {expiredCount}
                      </Text>
                      <Text style={styles.statLbl}>Expired</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Collapsible Manage Reminders Folder */}
              <View style={styles.sidebarSection}>
                <Pressable
                  style={styles.folderHeader}
                  android_ripple={{ color: isDark ? '#333' : '#e5e5e5' }}
                  onPress={() => setRemindersFolderOpen(!remindersFolderOpen)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="labelMedium" style={styles.sidebarSectionTitle}>
                      MY REMINDERS
                    </Text>
                    <View style={styles.reminderCountBadge}>
                      <Text style={styles.reminderCountText}>
                        {userReminders.length}
                      </Text>
                    </View>
                  </View>
                  <Icon
                    source={remindersFolderOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isDark ? '#a3a3a3' : '#6b7280'}
                  />
                </Pressable>

                {remindersFolderOpen && (
                  <View style={{ marginTop: 6 }}>
                    {userReminders.length === 0 ? (
                      <View style={styles.sidebarEmptyState}>
                        <Icon source="calendar-clock" size={20} color={isDark ? '#a3a3a3' : '#6b7280'} />
                        <Text style={styles.sidebarEmptyText}>No reminders set yet</Text>
                      </View>
                    ) : (
                      userReminders.map((reminder) => {
                        const expired = reminder.status === 'active' && isExpired(reminder);
                        const isExpanded = expandedReminderId === reminder.id;
                        const statusText = expired ? 'Expired' : reminder.status === 'active' ? 'Active' : reminder.status;
                        return (
                          <View
                            key={reminder.id}
                            style={[
                              styles.reminderItem,
                              expired && styles.expiredReminderItem,
                            ]}
                          >
                            <Pressable
                              style={styles.reminderItemHeader}
                              android_ripple={{ color: '#444' }}
                              onPress={() => {
                                setExpandedReminderId(isExpanded ? null : reminder.id);
                                setDropdownOpenId(null);
                              }}
                            >
                              <Icon
                                source={categoryIcon(reminder.category)}
                                color={expired ? palette.danger : palette.primary}
                                size={18}
                              />
                              <View style={styles.reminderItemHeaderMain}>
                                <Text
                                  variant="bodyMedium"
                                  numberOfLines={1}
                                  style={[
                                    styles.reminderItemTitle,
                                    expired && { color: palette.danger },
                                  ]}
                                >
                                  {reminder.title}
                                </Text>
                                <Text variant="bodySmall" style={styles.reminderItemDate}>
                                  {formatDateTime(reminder.datetime)}
                                </Text>
                              </View>
                              <Icon
                                source={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={isDark ? '#a3a3a3' : '#6b7280'}
                              />
                            </Pressable>

                            {isExpanded && (
                              <View style={styles.reminderExpandedContent}>
                                {reminder.notes && (
                                  <Text style={styles.reminderDetailsText}>
                                    Note: {reminder.notes}
                                  </Text>
                                )}
                                <View style={styles.reminderDetailsMeta}>
                                  <Chip
                                    compact
                                    mode="outlined"
                                    icon={reminder.alertMode === 'alarm' ? 'alarm' : 'volume-high'}
                                    style={styles.reminderChip}
                                    textStyle={{ fontSize: 9, color: isDark ? '#ececec' : '#374151' }}
                                  >
                                    {reminder.alertMode === 'alarm' ? 'Alarm' : 'Sound'}
                                  </Chip>
                                  {reminder.repeat !== 'none' && (
                                    <Chip
                                      compact
                                      mode="outlined"
                                      icon="sync"
                                      style={styles.reminderChip}
                                      textStyle={{ fontSize: 9, color: isDark ? '#ececec' : '#374151' }}
                                    >
                                      {reminder.repeat}
                                    </Chip>
                                  )}
                                  <Chip
                                    compact
                                    mode="outlined"
                                    style={styles.reminderChip}
                                    textStyle={{ fontSize: 9, color: expired ? palette.danger : (isDark ? '#ececec' : '#374151') }}
                                  >
                                    {statusText}
                                  </Chip>
                                </View>

                                <View style={styles.actionDropdownContainer}>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.actionDropdownTrigger,
                                      pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }
                                    ]}
                                    onPress={() => setDropdownOpenId(dropdownOpenId === reminder.id ? null : reminder.id)}
                                  >
                                    <Text style={styles.actionDropdownTriggerText}>Actions</Text>
                                    <Icon
                                      source={dropdownOpenId === reminder.id ? 'chevron-up' : 'chevron-down'}
                                      size={14}
                                      color={isDark ? '#ffffff' : '#171717'}
                                    />
                                  </Pressable>

                                  {dropdownOpenId === reminder.id && (
                                    <View style={styles.actionDropdownMenu}>
                                      {reminder.status === 'active' && (
                                        <>
                                          <Pressable
                                            style={({ pressed }) => [
                                              styles.actionDropdownItem,
                                              pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
                                            ]}
                                            onPress={() => {
                                              updateStatus(reminder, 'done');
                                              setDropdownOpenId(null);
                                            }}
                                          >
                                            <Icon source="check" size={16} color={palette.success} />
                                            <Text style={[styles.actionDropdownItemText, { color: isDark ? '#ececec' : '#171717' }]}>Mark Done</Text>
                                          </Pressable>
                                          <Divider style={{ marginVertical: 4, backgroundColor: isDark ? '#2f2f2f' : '#e5e5e5' }} />
                                          <Pressable
                                            style={({ pressed }) => [
                                              styles.actionDropdownItem,
                                              pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
                                            ]}
                                            onPress={() => {
                                              updateStatus(reminder, 'dismissed');
                                              setDropdownOpenId(null);
                                            }}
                                          >
                                            <Icon source="bell-off" size={16} color={palette.warning} />
                                            <Text style={[styles.actionDropdownItemText, { color: isDark ? '#ececec' : '#171717' }]}>Dismiss Alert</Text>
                                          </Pressable>
                                          <Divider style={{ marginVertical: 4, backgroundColor: isDark ? '#2f2f2f' : '#e5e5e5' }} />
                                        </>
                                      )}
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.actionDropdownItem,
                                          pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
                                        ]}
                                        onPress={() => {
                                          handleEditReminder(reminder);
                                          setDropdownOpenId(null);
                                        }}
                                      >
                                        <Icon source="pencil" size={16} color={palette.primary} />
                                        <Text style={[styles.actionDropdownItemText, { color: isDark ? '#ececec' : '#171717' }]}>Edit</Text>
                                      </Pressable>
                                      <Divider style={{ marginVertical: 4, backgroundColor: isDark ? '#2f2f2f' : '#e5e5e5' }} />
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.actionDropdownItem,
                                          pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
                                        ]}
                                        onPress={() => {
                                          removeReminder(reminder);
                                          setDropdownOpenId(null);
                                        }}
                                      >
                                        <Icon source="trash-can" size={16} color={palette.danger} />
                                        <Text style={[styles.actionDropdownItemText, { color: palette.danger, fontWeight: '700' }]}>Delete</Text>
                                      </Pressable>
                                    </View>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
             {/* Theme Toggle & API Key Footer (ChatGPT footer layout) */}
            <View style={styles.sidebarFooter}>
              {/* API Key management inside Sidebar Footer */}
              <Pressable
                style={({ pressed }) => [
                  styles.sidebarApiKeyButton,
                  pressed && { backgroundColor: isDark ? '#212121' : '#f3f4f6' }
                ]}
                android_ripple={{ color: isDark ? '#444' : '#e5e5e5' }}
                onPress={() => {
                  toggleSidebar(false);
                  setEditingApiKey(true);
                }}
              >
                <Icon source="key-outline" size={18} color={palette.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="labelMedium" style={styles.footerButtonTitle}>
                    Gemini API Key
                  </Text>
                  <Text variant="bodySmall" style={styles.footerButtonSubtitle}>
                    {userApiKey ? 'Connected (Tap to change)' : 'Not Connected'}
                  </Text>
                </View>
                <Icon source="chevron-right" size={16} color={isDark ? '#a3a3a3' : '#6b7280'} />
              </Pressable>

              {userApiKey && (
                <Button
                  mode="text"
                  onPress={handleResetApiKey}
                  textColor={palette.danger}
                  style={{ marginTop: 2, alignSelf: 'flex-start' }}
                  labelStyle={{ fontSize: 11 }}
                  icon="link-off"
                >
                  Disconnect Key
                </Button>
              )}

              <Divider style={{ marginVertical: 8, backgroundColor: isDark ? '#2e2e2e' : '#e5e5e5' }} />

              <View style={styles.themeRow}>
                <View style={styles.themeInfo}>
                  <Icon
                    source={theme === 'dark' ? 'weather-night' : 'weather-sunny'}
                    size={18}
                    color={isDark ? '#ffffff' : '#171717'}
                  />
                  <Text variant="bodyMedium" style={styles.themeText}>
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                </View>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={(val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTheme(val ? 'dark' : 'light');
                  }}
                  trackColor={{ false: isDark ? '#333' : '#e5e5e5', true: palette.primary + '88' }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any, isDark: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    zIndex: 10,
  },
  customHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 18,
    marginLeft: 4,
  },
  customHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderButton: {
    margin: 0,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 16,
    paddingBottom: 24,
  },
  welcomeContainer: {
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 22,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    boxShadow: isDark ? '0 8px 20px rgba(0, 0, 0, 0.28)' : '0 8px 20px rgba(15, 23, 42, 0.06)',
  },
  welcomeCopy: {
    flex: 1,
    gap: 3,
  },
  welcomeTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: 0,
  },
  welcomeSubtitle: {
    color: palette.muted,
    fontSize: 13.5,
    lineHeight: 19,
  },
  suggestionSection: {
    width: '100%',
    gap: 10,
  },
  suggestionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeading: {
    color: palette.text,
    fontWeight: '800',
    opacity: 0.85,
    fontSize: 14,
  },
  suggestionHint: {
    color: palette.muted,
    fontWeight: '700',
    fontSize: 11,
  },
  suggestionGrid: {
    gap: 8,
  },
  suggestionCard: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.18)' : '0 4px 14px rgba(15, 23, 42, 0.04)',
  },
  suggestionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary + '14',
  },
  suggestionText: {
    flex: 1,
    color: palette.text,
    fontWeight: '700',
    fontSize: 13.5,
    lineHeight: 18,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
    gap: 10,
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopRightRadius: 4,
    backgroundColor: palette.primary,
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
  },
  assistantBubble: {
    flex: 1,
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
  },
  bubbleText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  card: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
    marginTop: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  cardContent: {
    gap: 12,
    paddingTop: 8,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  expiredSurface: {
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? '#3A1D1D' : '#FEF2F2',
  },
  expiredText: {
    flex: 1,
    color: palette.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  twoColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  flexItem: {
    flex: 1,
  },
  timeInput: {
    width: '100%',
  },
  pickerSurface: {
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  sectionLabel: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 4,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  alertModeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertModeItem: {
    flex: 1,
    gap: 6,
  },
  alertModeChip: {
    alignSelf: 'flex-start',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    alignSelf: 'flex-start',
  },
  previewButtonActive: {
    backgroundColor: palette.primary + '15',
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#a3a3a3' : '#6b7280',
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 8,
  },
  containedButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  composerWrap: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)',
  },
  toolTray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  toolTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 76,
  },
  toolIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerPlusButton: {
    margin: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  composerSendButton: {
    margin: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  inputShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    maxHeight: 116,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 21,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    maxHeight: 104,
    minHeight: 34,
    color: palette.text,
    paddingVertical: 6,
    fontSize: 15,
    textAlignVertical: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  backdropBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: isDark ? '#171717' : '#F9F9F9',
    zIndex: 100,
    borderRightWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    boxShadow: isDark ? '8px 0 24px rgba(0, 0, 0, 0.3)' : '8px 0 24px rgba(0, 0, 0, 0.05)',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
  },
  sidebarHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidebarTitle: {
    fontWeight: '800',
    color: isDark ? '#ffffff' : '#171717',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  sidebarNewChatRow: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  sidebarNewChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#444444' : '#d9d9d9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: 'transparent',
  },
  sidebarNewChatButtonText: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '600',
    fontSize: 13,
  },
  sidebarNewReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#2e2e2e' : '#e5e5e5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  sidebarNewReminderButtonText: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '600',
    fontSize: 13,
  },
  sidebarSection: {
    paddingHorizontal: 12,
    gap: 6,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sidebarSectionTitle: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 14.5,
  },
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#212121' : '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    paddingVertical: 12,
    marginTop: 4,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statVal: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '800',
    fontSize: 17,
  },
  statLbl: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    fontSize: 11,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: isDark ? '#2e2e2e' : '#e5e5e5',
    alignSelf: 'center',
  },
  reminderCountBadge: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reminderCountText: {
    color: isDark ? '#ffffff' : '#171717',
    fontSize: 11,
    fontWeight: '700',
  },
  sidebarEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
    backgroundColor: isDark ? '#212121' : '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
  },
  sidebarEmptyText: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    fontSize: 12.5,
    fontWeight: '500',
  },
  reminderItem: {
    backgroundColor: isDark ? '#212121' : '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    overflow: 'hidden',
    marginBottom: 8,
  },
  expiredReminderItem: {
    borderColor: '#ef4444',
    backgroundColor: isDark ? '#3A1E1E' : '#fef2f2',
  },
  reminderItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  reminderItemHeaderMain: {
    flex: 1,
    gap: 2,
  },
  reminderItemTitle: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '700',
    fontSize: 13.5,
  },
  reminderItemDate: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    fontSize: 11.5,
  },
  reminderExpandedContent: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    gap: 10,
  },
  reminderDetailsText: {
    fontSize: 12.5,
    color: isDark ? '#ececec' : '#374151',
    lineHeight: 18,
  },
  reminderChip: {
    height: 24,
    backgroundColor: isDark ? '#2e2e2e' : '#f3f4f6',
    borderColor: isDark ? '#444444' : '#d9d9d9',
  },
  reminderDetailsMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reminderItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  reminderMiniButton: {
    margin: 0,
    height: 32,
    width: 32,
  },
  sidebarFooter: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#2e2e2e' : '#e5e5e5',
    paddingTop: 16,
    backgroundColor: isDark ? '#171717' : '#F9F9F9',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeText: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '600',
  },
  actionDropdownContainer: {
    position: 'relative',
    marginTop: 4,
    zIndex: 50,
  },
  actionDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    minWidth: 92,
  },
  actionDropdownTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#ffffff' : '#171717',
  },
  actionDropdownMenu: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
    backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
    padding: 4,
    alignSelf: 'stretch',
  },
  actionDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  actionDropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  savedReminderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 12,
    marginTop: 6,
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  savedReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  savedReminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  savedReminderBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  savedReminderContent: {
    gap: 2,
    marginVertical: 4,
  },
  savedReminderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: palette.text,
  },
  savedReminderDate: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.primary,
  },
  savedReminderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedReminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  savedReminderPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.muted,
  },
  noHistoryText: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
    borderRadius: 8,
    marginVertical: 2,
  },
  historyItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  historyItemActive: {
    backgroundColor: isDark ? '#2a2a2a' : '#ececec',
  },
  historyText: {
    flex: 1,
    color: isDark ? '#ececec' : '#171717',
    fontSize: 14,
  },
  historyTextActive: {
    fontWeight: '700',
    color: isDark ? '#ffffff' : '#171717',
  },
  deleteHistoryIcon: {
    margin: 0,
    padding: 0,
  },
  setupScroll: {
    flex: 1,
  },
  setupScrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  setupCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  setupCardContent: {
    gap: 16,
  },
  setupIconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  setupLogoCircle: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  setupTitle: {
    color: palette.text,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 22,
  },
  setupSubtitle: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  stepsContainer: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitleText: {
    color: palette.text,
    fontWeight: '700',
  },
  stepDescriptionText: {
    color: palette.muted,
    lineHeight: 16,
  },
  getKeyButton: {
    marginTop: 4,
    borderRadius: 8,
  },
  keyInput: {
    backgroundColor: palette.surface,
  },
  setupActions: {
    gap: 8,
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 8,
  },
  cancelButton: {
    borderRadius: 8,
    borderColor: palette.border,
  },
  sidebarApiKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: isDark ? '#212121' : '#ffffff',
    borderWidth: 1,
    borderColor: isDark ? '#2e2e2e' : '#e5e5e5',
  },
  footerButtonTitle: {
    color: isDark ? '#ffffff' : '#171717',
    fontWeight: '600',
    fontSize: 13,
  },
  footerButtonSubtitle: {
    color: isDark ? '#a3a3a3' : '#6b7280',
    fontSize: 11.5,
  },
});
