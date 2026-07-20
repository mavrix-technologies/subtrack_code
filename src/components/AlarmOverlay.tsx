/**
 * AlarmOverlay
 *
 * Full-screen foreground alarm UI shown when an 'ai_reminder_alarm' notification
 * fires while the app is open. Designed to match the visual quality of a native
 * Android/iOS alarm clock screen.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  // react-doctor-disable-next-line react-doctor/rn-prefer-reanimated
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, Text } from 'react-native-paper';
// react-doctor-disable-next-line react-doctor/rn-no-legacy-expo-packages
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

type AlarmInfo = {
  title: string;
  body:  string;
};

// Live clock helpers
function pad(n: number) { return n.toString().padStart(2, '0'); }
function getTime() {
  const now = new Date();
  return {
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    secs: pad(now.getSeconds()),
    date: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

export function AlarmOverlay() {
  const [alarm,    setAlarm]    = useState<AlarmInfo | null>(null);
  const [clock,    setClock]    = useState(() => getTime());
  const [snoozed,  setSnoozed]  = useState(false);
  const soundRef   = useRef<InstanceType<typeof Audio.Sound> | null>(null);
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const ringAnim   = useMemo(() => new Animated.Value(0), []);   // icon ring glow
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const fadeAnim   = useMemo(() => new Animated.Value(0), []);   // screen fade-in
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const shakeAnim  = useMemo(() => new Animated.Value(0), []);   // icon shake
  const hapticRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSound = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/alarm_preview.wav'),
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
    } catch {}
  };

  const stopSound = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  };

  const startHaptics = () => {
    hapticRef.current = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 900);
  };

  const stopHaptics = () => {
    if (hapticRef.current) { clearInterval(hapticRef.current); hapticRef.current = null; }
  };

  const dismiss = async () => {
    await stopSound();
    stopHaptics();
    ringAnim.stopAnimation();
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setAlarm(null);
      fadeAnim.setValue(0);
      ringAnim.setValue(0);
      shakeAnim.setValue(0);
    });
  };

  const snooze = async () => {
    await stopSound();
    stopHaptics();
    setSnoozed(true);
    // Re-fire in 5 minutes
    setTimeout(async () => {
      setSnoozed(false);
      startSound();
      startHaptics();
    }, 5 * 60 * 1000);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  /* ── Clock tick ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!alarm) return;
    clockRef.current = setInterval(() => setClock(getTime()), 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, [alarm]);

  /* ── Animations when alarm fires ────────────────────────────────────────── */
  useEffect(() => {
    if (!alarm) return;

    // Fade in screen
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();

    // Rotating / pulsing ring around the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Shake the alarm icon
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
      ]).start();
    };
    shake();
    const shakeInterval = setInterval(shake, 2400);

    return () => clearInterval(shakeInterval);
  }, [alarm]);

  /* ── Foreground notification listener ───────────────────────────────────── */
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as any;
        if (data?.type === 'ai_reminder_alarm') {
          setAlarm({
            title: notification.request.content.title ?? 'Alarm',
            body:  notification.request.content.body  ?? '',
          });
          setSnoozed(false);
          startSound();
          startHaptics();
        }
    });
    return () => { sub?.remove(); };
  }, []);

  if (!alarm) return null;

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>

        {/* ── Background radial glow ── */}
        <View style={styles.bgGlow} />

        {/* ── Live clock ── */}
        <View style={styles.clockBlock}>
          <Text style={styles.clockTime}>{clock.time}</Text>
          <Text style={styles.clockSecs}>{clock.secs}</Text>
        </View>
        <Text style={styles.clockDate}>{clock.date}</Text>

        {/* ── Pulsing icon ring ── */}
        <View style={styles.iconWrapper}>
          {/* Outer pulsing ring */}
          <Animated.View
            style={[
              styles.ringOuter,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          {/* Inner ring */}
          <View style={styles.ringInner} />
          {/* Icon container with shake */}
          <Animated.View
            style={[styles.iconCircle, { transform: [{ translateX: shakeAnim }] }]}
          >
            <Icon source="alarm" size={52} color="#ffffff" />
          </Animated.View>
        </View>

        {/* ── Alarm label ── */}
        <View style={styles.labelBlock}>
          <Text style={styles.alarmLabel}>ALARM</Text>
          <Text style={styles.title} numberOfLines={2}>{alarm.title}</Text>
          {!!alarm.body && (
            <Text style={styles.body} numberOfLines={2}>{alarm.body}</Text>
          )}
        </View>

        {snoozed ? (
          <View style={styles.snoozedBadge}>
            <Icon source="alarm-snooze" size={18} color="#f59e0b" />
            <Text style={styles.snoozedText}>Snoozed · rings in 5 min</Text>
          </View>
        ) : (
          /* ── Action buttons ── */
          <View style={styles.actions}>
            {/* Snooze */}
            <Pressable
              style={({ pressed }) => [styles.snoozeBtn, pressed && { opacity: 0.8 }]}
              onPress={snooze}
            >
              <Icon source="alarm-snooze" size={20} color="#f59e0b" />
              <Text style={styles.snoozeBtnText}>Snooze 5 min</Text>
            </Pressable>

            {/* Dismiss */}
            <Pressable
              style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.88 }]}
              onPress={dismiss}
            >
              <Icon source="alarm-off" size={22} color="#ffffff" />
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#050510',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingBottom: Platform.OS === 'android' ? 48 : 56,
  },

  /* Background radial glow */
  bgGlow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#4338CA',
    opacity: 0.08,
    top: '15%',
    alignSelf: 'center',
  },

  /* ── Clock ── */
  clockBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  clockTime: {
    fontSize: 72,
    fontWeight: '200',
    color: '#ffffff',
    letterSpacing: -2,
    lineHeight: 80,
  },
  clockSecs: {
    fontSize: 22,
    fontWeight: '300',
    color: '#6366f1',
    paddingBottom: 10,
    letterSpacing: -0.5,
  },
  clockDate: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: -8,
  },

  /* ── Icon ring ── */
  iconWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  ringInner: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
      },
      android: { elevation: 20 },
    }),
  },

  /* ── Label block ── */
  labelBlock: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  alarmLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#6366f1',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },

  /* ── Snoozed badge ── */
  snoozedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 40,
  },
  snoozedText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
  },

  /* ── Action buttons ── */
  actions: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.08)',
    width: '100%',
    justifyContent: 'center',
  },
  snoozeBtnText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    width: '100%',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: { elevation: 10 },
    }),
  },
  dismissText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
