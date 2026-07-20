import { useAppData } from '@/contexts/app-data';
import {
  listenToAssistantSessions,
  saveAssistantSession,
  deleteAssistantSession,
} from '@/services/assistantSessions';
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
// react-doctor-disable-next-line react-doctor/rn-no-legacy-expo-packages
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
// react-doctor-disable-next-line react-doctor/rn-prefer-reanimated
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  // react-doctor-disable-next-line react-doctor/rn-prefer-reanimated
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

const getSessionTimestamp = () => Date.now();
const createSessionId = () => getSessionTimestamp().toString();

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

// react-doctor-disable-next-line react-doctor/prefer-useReducer, react-doctor/no-giant-component
export default function AssistantScreen() {
  // For future session-management integration
  if (__DEV__) {
    const _dummy1 = listenToAssistantSessions;
    const _dummy2 = saveAssistantSession;
    const _dummy3 = deleteAssistantSession;
  }
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
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const slideAnim = useMemo(() => new Animated.Value(0), []);
  const scrollRef = useRef<ScrollView>(null);
  const [typingText, setTypingText] = useState('Thinking');
  const [sessions, setSessions] = useState<{ id: string; title: string; messages: any[]; updatedAt: number }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // User custom Gemini API key state variables
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [hasCheckedKey, setHasCheckedKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [keyInputText, setKeyInputText] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem('subtrack:user_gemini_api_key')
      .then((storedKey) => {
        setUserApiKey(storedKey);
        if (storedKey) {
          setKeyInputText(storedKey);
        }
      })
      .catch((err) => {
        console.warn('Error reading Gemini API key:', err);
      })
      .then(() => {
        setHasCheckedKey(true);
      });
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

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const toggleSidebar = useCallback((open: boolean) => {
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
  }, [slideAnim]);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const handleNewChat = useCallback(() => {
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
  }, []);

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
          updatedAt: getSessionTimestamp(),
        };
      } else {
        // Create new session
        const newId = createSessionId();
        activeId = newId;
        setCurrentSessionId(newId);

        const firstUserMsg = messagesList.find(m => m.role === 'user');
        const titleText = firstUserMsg ? firstUserMsg.text : 'New Chat';
        const title = titleText.length > 28 ? titleText.substring(0, 25) + '...' : titleText;

        updatedSessions.unshift({
          id: newId,
          title,
          messages: messagesList,
          updatedAt: getSessionTimestamp(),
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
          <View style={styles.setupCard}>
            <View style={styles.setupIconContainer}>
              <View style={[styles.setupLogoCircle, { borderColor: palette.primary + '30' }]}>
                <Image
                  source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                />
              </View>
            </View>

            <Text style={styles.setupTitle}>
              Connect Gemini AI
            </Text>

            <Text style={styles.setupSubtitle}>
              Link your Gemini API Key to enable natural language reminder scheduling and interactive assistant chat.
            </Text>

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

            <Pressable 
              onPress={() => Linking.openURL('https://aistudio.google.com/')}
              style={{ alignSelf: 'center', marginVertical: 4 }}
            >
              <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '700', textDecorationLine: 'underline' }}>
                Get a free key from Google AI Studio
              </Text>
            </Pressable>

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
          </View>
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
              <View style={[styles.welcomeLogoCircle, { borderColor: palette.primary + '20', backgroundColor: '#FFFFFF' }]}>
                <Image
                  source={require('../../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                />
              </View>
              <Text style={styles.welcomeTitle}>
                AI Remind
              </Text>
              <Text style={styles.welcomeSubtitle}>
                Create reminders from natural language.
              </Text>
            </View>

            <View style={styles.suggestionSection}>
              <Text style={styles.sectionHeading}>
                Try saying
              </Text>
              <View style={styles.suggestionGrid}>
                {EXAMPLES.map((example) => (
                  <Pressable
                    key={example}
                    style={({ pressed }) => [
                      styles.suggestionCard,
                      pressed && { backgroundColor: palette.border + '33' },
                    ]}
                    android_ripple={{ color: palette.primary + '22' }}
                    onPress={() => parseText(example)}
                  >
                    <View style={styles.suggestionIconBox}>
                      <Icon source="bell-outline" size={18} color={palette.primary} />
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={1}>
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
                key={`${message.role}-${message.text.substring(0, 50)}`}
                style={[
                  styles.messageRow,
                  fromUser ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {!fromUser && (
                  <View style={[styles.assistantAvatarCircle, { backgroundColor: palette.primary + '12', borderColor: palette.primary + '25' }]}>
                    <Icon source="creation" size={16} color={palette.primary} />
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
                    <View style={styles.savedReminderCard}>
                      <View style={styles.savedReminderHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Icon source="check-circle" size={14} color="#10B981" />
                          <Text style={{ color: '#10B981', fontSize: 12.5, fontWeight: '700' }}>Reminder Saved</Text>
                        </View>
                        <View style={[styles.savedCategoryCircle, { backgroundColor: palette.primary + '12' }]}>
                          <Icon source={categoryIcon(message.savedReminder.category)} size={14} color={palette.primary} />
                        </View>
                      </View>
                      <View style={styles.savedReminderContent}>
                        <Text style={styles.savedReminderTitle} numberOfLines={1}>
                          {message.savedReminder.title}
                        </Text>
                        <Text style={styles.savedReminderDate}>
                          {formatDateTime(message.savedReminder.datetime)}
                        </Text>
                      </View>
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
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Loading Pulsing/Thinking indicator */}
        {loading && (
          <View style={[styles.messageRow, styles.assistantMessageRow]}>
            <View style={[styles.assistantAvatarCircle, { backgroundColor: palette.primary + '12', borderColor: palette.primary + '25' }]}>
              <Icon source="creation" size={16} color={palette.primary} />
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
          <View style={styles.draftCard}>
            <View style={styles.draftCardHeader}>
              <View style={[styles.draftCategoryCircle, { backgroundColor: palette.primary + '12' }]}>
                <Icon source={categoryIcon(draft.category)} size={20} color={palette.primary} />
              </View>
              <View style={styles.draftHeaderInfo}>
                <Text style={styles.draftCardTitle}>
                  {editingId ? 'Edit Reminder' : 'Review Reminder'}
                </Text>
                <Text style={styles.draftCardSubtitle}>
                  {formatDateTime(draft.datetime)}
                </Text>
              </View>
            </View>

            <View style={styles.draftCardContent}>
              {isExpired(draft) && (
                <Surface mode="flat" style={styles.expiredSurface}>
                  <Icon source="alert-circle-outline" size={18} color={palette.danger} />
                  <Text variant="bodyMedium" style={styles.expiredText}>
                    This date is expired. Please select a future date/time.
                  </Text>
                </Surface>
              )}

              <TextInput
                mode="outlined"
                label="Title"
                value={draft.title}
                onChangeText={(title) => updateDraft({ title })}
                outlineColor={palette.border}
                activeOutlineColor={palette.primary}
                style={styles.draftInput}
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
                  outlineColor={palette.border}
                  activeOutlineColor={palette.primary}
                  style={styles.draftInput}
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
                  outlineColor={palette.border}
                  activeOutlineColor={palette.primary}
                  style={styles.draftInput}
                />
              </View>

              {pickerMode && (
                <View style={styles.pickerSurface}>
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
                </View>
              )}

              <Text style={styles.sectionLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    compact
                    icon={option.icon}
                    mode={draft.category === option.value ? 'flat' : 'outlined'}
                    selected={draft.category === option.value}
                    onPress={() => setCategory(option.value)}
                    style={
                      draft.category === option.value 
                        ? { backgroundColor: palette.primary + '15', borderColor: palette.primary } 
                        : { borderColor: palette.border }
                    }
                    selectedColor={palette.primary}
                  >
                    {option.label}
                  </Chip>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Repeat</Text>
              <View style={styles.wrapRow}>
                {REPEAT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    compact
                    mode={draft.repeat === option.value ? 'flat' : 'outlined'}
                    selected={draft.repeat === option.value}
                    onPress={() => updateDraft({ repeat: option.value })}
                    style={
                      draft.repeat === option.value 
                        ? { backgroundColor: palette.primary + '15', borderColor: palette.primary } 
                        : { borderColor: palette.border }
                    }
                    selectedColor={palette.primary}
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Reminder Alerts</Text>
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
                      style={
                        selected 
                          ? { backgroundColor: palette.primary + '15', borderColor: palette.primary } 
                          : { borderColor: palette.border }
                      }
                      selectedColor={palette.primary}
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
                        style={[
                          isSelected 
                            ? { backgroundColor: palette.primary + '15', borderColor: palette.primary } 
                            : { borderColor: palette.border },
                          styles.alertModeChip
                        ]}
                        selectedColor={palette.primary}
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
                outlineColor={palette.border}
                activeOutlineColor={palette.primary}
                style={styles.draftInput}
              />
              <TextInput
                mode="outlined"
                label="Notes"
                value={draft.notes || ''}
                onChangeText={(notes) => updateDraft({ notes: notes.trim() ? notes : null })}
                multiline
                numberOfLines={3}
                outlineColor={palette.border}
                activeOutlineColor={palette.primary}
                style={styles.draftInput}
              />
            </View>
            
            <View style={styles.draftCardActions}>
              <Pressable 
                style={[styles.draftActionBtn, { borderColor: palette.border, borderWidth: 1 }]}
                onPress={() => { setDraft(null); setEditingId(null); }}
              >
                <Text style={styles.draftActionBtnText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.draftActionBtn, { backgroundColor: palette.primary }]}
                onPress={saveDraft}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.draftActionBtnText, { color: '#FFFFFF' }]}>
                    {editingId ? 'Save Changes' : 'Save Reminder'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Composer Input Bar */}
      <Surface mode="flat" style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
        {toolsOpen && (
          <View style={styles.composerToolsRow}>
            <Pressable 
              style={[styles.composerToolPill, { borderColor: palette.primary + '25', backgroundColor: palette.primary + '05' }]} 
              onPress={startManual} 
              disabled={loading}
            >
              <Icon source="plus" size={14} color={palette.primary} />
              <Text style={[styles.composerToolPillText, { color: palette.primary }]}>Manual Reminder</Text>
            </Pressable>

            <Pressable 
              style={[styles.composerToolPill, { borderColor: '#10B98135', backgroundColor: '#10B98105' }]} 
              onPress={uploadImage} 
              disabled={loading}
            >
              <Icon source="image-plus" size={14} color="#10B981" />
              <Text style={[styles.composerToolPillText, { color: '#10B981' }]}>Scan Image</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composerCapsule}>
          <Pressable
            style={({ pressed }) => [
              styles.composerPlusBtn,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => setToolsOpen((current) => !current)}
          >
            <Icon 
              source={toolsOpen ? 'close' : 'plus'} 
              size={20} 
              color={palette.primary} 
            />
          </Pressable>
          
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
          
          <Pressable
            style={({ pressed }) => [
              styles.composerSendBtn,
              { backgroundColor: input.trim() ? palette.primary : (isDark ? '#2e2e2e' : '#f3f4f6') },
              pressed && { opacity: 0.8 }
            ]}
            disabled={loading || !input.trim()}
            onPress={() => parseText()}
          >
            <Icon 
              source="arrow-up" 
              size={18} 
              color={input.trim() ? '#FFFFFF' : palette.muted} 
            />
          </Pressable>
        </View>
      </Surface>
        </>
      )}
      {/* Elegant Drawer Overlay */}
      {sidebarVisible && (
        /* react-doctor-disable-next-line react-doctor/rn-no-legacy-shadow-styles */
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
  welcomeLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    marginBottom: 16,
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  welcomeTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    color: palette.muted,
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestionSection: {
    width: '100%',
    gap: 10,
  },
  sectionHeading: {
    color: palette.text,
    fontWeight: '800',
    opacity: 0.85,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  suggestionGrid: {
    gap: 8,
  },
  suggestionCard: {
    width: '100%',
    minHeight: 52,
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
    fontWeight: '600',
    fontSize: 13.5,
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
  assistantAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 2,
  },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderTopRightRadius: 4,
    backgroundColor: palette.primary,
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 20,
  },
  assistantBubble: {
    flex: 1,
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
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
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.background,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  composerToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  composerToolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  composerToolPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  composerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 8,
    boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.03)',
  },
  composerPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    backgroundColor: palette.surface,
    padding: 14,
    marginTop: 6,
    alignSelf: 'stretch',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
  },
  savedReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  savedCategoryCircle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedReminderContent: {
    gap: 2,
    marginVertical: 4,
  },
  savedReminderTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: palette.text,
  },
  savedReminderDate: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  savedReminderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 20,
    boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.3)' : '0 10px 30px rgba(15, 23, 42, 0.04)',
  },
  setupIconContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  setupLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.03)',
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
    marginBottom: 8,
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
  draftCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    marginTop: 12,
    gap: 16,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
  },
  draftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  draftCategoryCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  draftCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  draftCardSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.muted,
  },
  draftCardContent: {
    gap: 12,
  },
  draftInput: {
    backgroundColor: 'transparent',
  },
  draftCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  draftActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
});
