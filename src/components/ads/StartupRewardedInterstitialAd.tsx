import { showStartupRewardedInterstitialAd } from '@/components/ads/rewardedAds';
import { useAppData } from '@/contexts/app-data';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';

const ONBOARDING_VERSION = 'v1';
const STARTUP_AD_DELAY_MS = 9000;

export function StartupRewardedInterstitialAd() {
  const { status, user } = useAppData();
  const pathname = usePathname();
  const didSchedule = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (status !== 'ready' || !user) return;
    if (pathname?.startsWith('/login')) return;
    if (didSchedule.current) return;

    didSchedule.current = true;
    let isActive = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const schedule = async () => {
      const onboardingKey = `subtrack:onboarding:${ONBOARDING_VERSION}:${user.uid}`;
      const hasCompletedOnboarding = await AsyncStorage.getItem(onboardingKey);
      if (!isActive || hasCompletedOnboarding !== 'done') return;

      const interaction = InteractionManager.runAfterInteractions(() => {
        timeout = setTimeout(() => {
          if (!isActive || AppState.currentState !== 'active') return;
          void showStartupRewardedInterstitialAd(user.uid);
        }, STARTUP_AD_DELAY_MS);
      });

      return () => interaction.cancel();
    };

    let cancelInteraction: (() => void) | undefined;
    schedule()
      .then((cancel) => {
        cancelInteraction = cancel;
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      if (timeout) clearTimeout(timeout);
      cancelInteraction?.();
    };
  }, [pathname, status, user]);

  return null;
}
