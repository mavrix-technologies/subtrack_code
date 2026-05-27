import { subtrackTheme } from '@/constants/subtrack-theme';
import { getGoogleMobileAdsModule } from '@/components/ads/mobileAdsModule';
import { StartupRewardedInterstitialAd } from '@/components/ads/StartupRewardedInterstitialAd';
import { AppOpenAdManager } from '@/components/ads/AppOpenAdManager';
import { LegacyUpdateAlert } from '@/components/messaging/LegacyUpdateAlert';
import { AppOnboarding } from '@/components/onboarding/AppOnboarding';
import { AppDataProvider, useAppData } from '@/contexts/app-data';
import { CurrencyProvider, InvoiceBrandProvider } from '@/contexts/currency';
import { ThemeProvider, useTheme } from '@/contexts/theme';
import { initializeAnalytics, trackScreenView } from '@/services/analytics';
import { installCrashReporting } from '@/services/crashReporting';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, Stack, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform, Text, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';

// Keep splash visible until auth resolves when the native splash is available.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
installCrashReporting();

function AuthGate() {
  const { status, user } = useAppData();
  const segments = useSegments();
  const didHideSplash = useRef(false);

  useEffect(() => {
    if (status === 'booting') return;
    if (!didHideSplash.current) {
      didHideSplash.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    }
    const inAuthGroup = segments[0] === 'login';
    if (!user && !inAuthGroup) router.replace('/login');
    else if (user && inAuthGroup) router.replace('/(tabs)');
  }, [status, user, segments]);

  return null;
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  "use no memo";

  const [unlocked, setUnlocked] = useState(false);
  const lockState = useState<boolean | undefined>(undefined);
  const isLockEnabled = lockState[0];
  const setIsLockEnabled = lockState[1];
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);
  const authResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authenticate = useCallback(async () => {
    if (isAuthenticating.current) return;
    const enabled = await AsyncStorage.getItem('biometric_lock_enabled');
    if (enabled !== 'true') {
      setIsLockEnabled(false);
      setUnlocked(true);
      return;
    }
    setIsLockEnabled(true);
    setUnlocked(false);
    isAuthenticating.current = true;
    try {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock SubTrack',
        disableDeviceFallback: false,
      });
      if (auth.success) setUnlocked(true);
      if (authResetTimer.current) clearTimeout(authResetTimer.current);
      authResetTimer.current = setTimeout(() => {
        isAuthenticating.current = false;
        authResetTimer.current = null;
      }, 500);
    } catch {
      if (authResetTimer.current) clearTimeout(authResetTimer.current);
      authResetTimer.current = setTimeout(() => {
        isAuthenticating.current = false;
        authResetTimer.current = null;
      }, 500);
    }
  }, [setIsLockEnabled]);

  useEffect(() => {
    authenticate();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'background' && nextAppState === 'active') authenticate();
      appState.current = nextAppState;
    });
    const timerId = authResetTimer.current;
    return () => {
      subscription.remove();
      if (timerId) clearTimeout(timerId);
    };
  }, [authenticate]);

  if (isLockEnabled === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!unlocked && isLockEnabled) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>App Locked</Text>
      </View>
    );
  }
  return <>{children}</>;
}

function AdsInitializer() {
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    const ads = getGoogleMobileAdsModule();
    if (!ads) return;

    const { default: mobileAds, MaxAdContentRating } = ads;
    mobileAds()
      .setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      })
      .then(() => mobileAds().initialize())
      .catch(() => undefined);
  }, []);

  return null;
}

function AnalyticsInitializer() {
  const pathname = usePathname();
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    void initializeAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname || lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    void trackScreenView(pathname);
  }, [pathname]);

  return null;
}

/** Reads live palette so native headers always match the app theme */
function ThemedStack() {
  const { palette, theme } = useTheme();
  const { status, user } = useAppData();

  if (status === 'booting') {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  return (
    <>
      <StatusBar
        style={theme === 'dark' ? 'light' : 'dark'}
        backgroundColor={palette.surface}
        translucent={false}
      />
      <Stack
        initialRouteName={user ? '(tabs)' : 'login'}
        screenOptions={{
          headerShadowVisible: false,
          headerBackTitle: '',
          headerStyle:      { backgroundColor: palette.surface },
          headerTitleStyle: { fontWeight: '700', color: palette.text, fontSize: 17 },
          headerTintColor:  palette.primary,
          contentStyle:     { backgroundColor: palette.surface },
          /** Native push/pop — was `none`, which made every screen change an instant cut */
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
          /** Edge-only swipe (iOS). Full-screen gestures fire during horizontal scroll/drag elsewhere. */
          fullScreenGestureEnabled: false,
          animationTypeForReplace: 'push',
        }}
      >
        <Stack.Screen name="login"                options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"               options={{ headerShown: false }} />
        <Stack.Screen name="add"                  options={{ title: 'Add Subscription' }} />
        <Stack.Screen name="subscription/[id]"    options={{ headerShown: false }} />
        <Stack.Screen name="edit/[id]"            options={{ headerShown: false }} />
        <Stack.Screen name="add-expense"          options={{ title: 'New Expense' }} />
        <Stack.Screen name="friends/index"       options={{ headerShown: false }} />
        <Stack.Screen name="friend/create"       options={{ title: 'New split friend' }} />
        <Stack.Screen name="friend/[id]"         options={{ headerShown: false }} />
        <Stack.Screen name="expense/[id]"         options={{ headerShown: false }} />
        <Stack.Screen name="expense/edit/[id]"    options={{ title: 'Edit Expense' }} />
        <Stack.Screen name="expense/invoice/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/create"       options={{ title: 'New Invoice' }} />
        <Stack.Screen name="invoice/[id]"         options={{ headerShown: false }} />
        <Stack.Screen name="legal/[page]"         options={{ title: 'Legal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <PaperProvider theme={subtrackTheme}>
        <BottomSheetModalProvider>
          <AppDataProvider>
            <CurrencyProvider>
              <ThemeProvider>
                <InvoiceBrandProvider>
                  <AppLockGate>
                    <AdsInitializer />
                    <AppOpenAdManager />
                    <StartupRewardedInterstitialAd />
                    <AnalyticsInitializer />
                    <AuthGate />
                    <ThemedStack />
                    <AppOnboarding />
                    <LegacyUpdateAlert />
                  </AppLockGate>
                </InvoiceBrandProvider>
              </ThemeProvider>
            </CurrencyProvider>
          </AppDataProvider>
        </BottomSheetModalProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
