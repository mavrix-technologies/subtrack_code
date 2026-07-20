import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ONBOARDING_VERSION = 'v1';

const slides = [
  {
    icon: 'calendar-refresh',
    title: 'Track subscriptions',
    body: 'Add Netflix, Spotify, bills, or any recurring payment and see what is coming up next.',
  },
  {
    icon: 'bell-ring-outline',
    title: 'Never miss renewals',
    body: 'Use reminders to stay ahead of renewal dates and avoid surprise charges.',
  },
  {
    icon: 'account-cash-outline',
    title: 'Split expenses',
    body: 'Create shared expenses, add friends, and keep payment details organized.',
  },
  {
    icon: 'file-document-edit-outline',
    title: 'Create invoices',
    body: 'Prepare invoices with items, taxes, payment terms, notes, and share-ready summaries.',
  },
  {
    icon: 'chart-line',
    title: 'Review your spending',
    body: 'Use Home, Subs, Expenses, and Invoices to understand monthly costs and pending totals.',
  },
];

export function AppOnboarding() {
  const { status, user } = useAppData();
  if (status !== 'ready' || !user) return null;

  return <OnboardingDialog key={user.uid} userId={user.uid} />;
}

function OnboardingDialog({ userId }: { userId: string }) {
  "use no memo";

  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const storageKey = `subtrack:onboarding:${ONBOARDING_VERSION}:${userId}`;

    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (isMounted && value !== 'done') setVisible(true);
      })
      .catch(() => {
        if (isMounted) setVisible(true);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const finish = async () => {
    await AsyncStorage.setItem(`subtrack:onboarding:${ONBOARDING_VERSION}:${userId}`, 'done');
    setVisible(false);
    setIndex(0);
  };

  const current = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.topRow}>
            <View style={styles.brandMark}>
              <Icon source="alpha-s-box-outline" size={22} color="#FFFFFF" />
            </View>
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.iconCircle}>
            <Icon source={current.icon} size={42} color={palette.primary} />
          </View>

          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots}>
            {slides.map((slide, slideIndex) => (
              <View
                key={slide.title}
                style={[
                  styles.dot,
                  slideIndex === index && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.secondaryButton, index === 0 && styles.hiddenButton]}
              onPress={() => setIndex((value) => Math.max(value - 1, 0))}
              disabled={index === 0}
            >
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (isLast) finish();
                else setIndex((value) => Math.min(value + 1, slides.length - 1));
              }}
            >
              <Text style={styles.primaryText}>{isLast ? 'Get started' : 'Next'}</Text>
              <Icon source={isLast ? 'check' : 'chevron-right'} size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    maxWidth: 430,
    padding: 22,
    width: '100%',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  skip: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  iconCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: `${palette.primary}14`,
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    marginTop: 30,
    width: 88,
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 32,
    marginTop: 24,
    textAlign: 'center',
  },
  body: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 10,
    minHeight: 70,
    textAlign: 'center',
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    backgroundColor: palette.line,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: palette.primary,
    width: 24,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 28,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  hiddenButton: {
    opacity: 0,
  },
  secondaryText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 140,
    paddingHorizontal: 18,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
