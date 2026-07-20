import { subtrackTheme } from '@/constants/subtrack-theme';
import { getGoogleMobileAdsModule } from '../components/ads/mobileAdsModule';
import { StartupRewardedInterstitialAd } from '@/components/ads/StartupRewardedInterstitialAd';
import { LegacyUpdateAlert } from '@/components/messaging/LegacyUpdateAlert';
import { AlarmOverlay } from '@/components/AlarmOverlay';
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
import { AppState, Platform, Text, View, ActivityIndicator, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Keep splash visible until auth resolves when the native splash is available.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AppOpenAdManager = (() => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return () => null;
  const ads = getGoogleMobileAdsModule();
  if (!ads) return () => null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/components/ads/AppOpenAdManager').AppOpenAdManager;
})();
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

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
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
    Promise.resolve().then(() => {
      void authenticate();
    });
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'background' && nextAppState === 'active') void authenticate();
      appState.current = nextAppState;
    });
    const timerId = authResetTimer.current;
    return () => {
      subscription.remove();
      if (timerId) clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [launchVisible, setLaunchVisible] = useState(true);

  // Animation values
  const { height: screenHeight } = Dimensions.get('window');
  
  const sOpacity = useRef(new Animated.Value(0)).current;
  const sScale = useRef(new Animated.Value(0.7)).current;
  const restTextWidth = useRef(new Animated.Value(0)).current;
  const restTextOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const dotTranslateY = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native splash screen immediately
    SplashScreen.hideAsync().catch(() => undefined);

    const anim = Animated.sequence([
      // 1. Fade in and scale up the "s" letter
      Animated.parallel([
        Animated.timing(sOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(sScale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
      // Small pause
      Animated.delay(300),

      // 2. Expand "ubtrack" from left to right (width 0 -> 200)
      Animated.parallel([
        Animated.timing(restTextWidth, {
          toValue: 200,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(restTextOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: false,
        }),
      ]),

      // 3. Pause to display full name
      Animated.delay(1000),

      // 4. Minimize back to "s" (width 200 -> 0)
      Animated.parallel([
        Animated.timing(restTextWidth, {
          toValue: 0,
          duration: 550,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(restTextOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),

      // Small pause
      Animated.delay(200),

      // 5. Convert "s" into dot (fade out "s", fade/scale in dot)
      Animated.parallel([
        Animated.timing(sOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(sScale, {
          toValue: 0.5,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
      ]),

      // Small pause before move
      Animated.delay(200),

      // 6. Move dot to the top
      Animated.timing(dotTranslateY, {
        toValue: -(screenHeight / 2 - 80),
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),

      // Small delay at the top
      Animated.delay(150),

      // 7. Explode dot to reveal screen (circular mask scale up)
      Animated.parallel([
        Animated.timing(dotScale, {
          toValue: 180,
          duration: 650,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(450),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]),
      ]),
    ]);

    anim.start(() => {
      setLaunchVisible(false);
    });

    return () => {
      anim.stop();
    };
  }, []);

  const mainStack = (
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
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
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
        <Stack.Screen name="invoice/scan"         options={{ title: 'Scan Invoice' }} />
        <Stack.Screen name="invoice/review"       options={{ title: 'Review Invoice' }} />
        <Stack.Screen name="invoice/[id]"         options={{ headerShown: false }} />
        <Stack.Screen name="legal/[page]"         options={{ title: 'Legal' }} />
      </Stack>
    </>
  );

  if (!launchVisible) {
    return mainStack;
  }

  const gradientColors = ['#F97316', '#EA580C'] as const;

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Main app is mounted underneath and ready to display once launch completes */}
      {status === 'ready' && mainStack}

      {/* Animated Minimal Launch Screen Overlay */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          zIndex: 9999,
          opacity: screenOpacity,
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Decorative Professional Watermark Icons */}
          <View style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }} pointerEvents="none">
            {/* Top row */}
            <View style={{ position: 'absolute', top: '13%', left: '10%', transform: [{ rotate: '-15deg' }] }}>
              <MaterialCommunityIcons name="spotify" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', top: '6%', left: '42%', transform: [{ rotate: '5deg' }] }}>
              <MaterialCommunityIcons name="apple" size={30} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', top: '10%', right: '12%', transform: [{ rotate: '12deg' }] }}>
              <MaterialCommunityIcons name="netflix" size={34} color="rgba(255, 255, 255, 0.12)" />
            </View>

            {/* Upper-mid row */}
            <View style={{ position: 'absolute', top: '20%', left: '26%', transform: [{ rotate: '-8deg' }] }}>
              <MaterialCommunityIcons name="google" size={30} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', top: '18%', right: '28%', transform: [{ rotate: '15deg' }] }}>
              <MaterialCommunityIcons name="microsoft" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', top: '27%', left: '7%', transform: [{ rotate: '15deg' }] }}>
              <MaterialCommunityIcons name="facebook" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', top: '24%', right: '8%', transform: [{ rotate: '-10deg' }] }}>
              <MaterialCommunityIcons name="youtube" size={30} color="rgba(255, 255, 255, 0.12)" />
            </View>

            {/* Lower-mid row */}
            <View style={{ position: 'absolute', bottom: '26%', left: '8%', transform: [{ rotate: '10deg' }] }}>
              <MaterialCommunityIcons name="linkedin" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', bottom: '20%', left: '26%', transform: [{ rotate: '12deg' }] }}>
              <MaterialCommunityIcons name="nintendo-switch" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', bottom: '22%', right: '28%', transform: [{ rotate: '-12deg' }] }}>
              <MaterialCommunityIcons name="steam" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', bottom: '24%', right: '9%', transform: [{ rotate: '-15deg' }] }}>
              <MaterialCommunityIcons name="dropbox" size={30} color="rgba(255, 255, 255, 0.12)" />
            </View>

            {/* Bottom row */}
            <View style={{ position: 'absolute', bottom: '14%', left: '11%', transform: [{ rotate: '-12deg' }] }}>
              <MaterialCommunityIcons name="slack" size={34} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', bottom: '5%', left: '45%', transform: [{ rotate: '-5deg' }] }}>
              <MaterialCommunityIcons name="github" size={32} color="rgba(255, 255, 255, 0.12)" />
            </View>
            <View style={{ position: 'absolute', bottom: '11%', right: '11%', transform: [{ rotate: '18deg' }] }}>
              <MaterialCommunityIcons name="twitch" size={34} color="rgba(255, 255, 255, 0.12)" />
            </View>
          </View>

          <View style={{ justifyContent: 'center', alignItems: 'center', width: 280, height: 140, overflow: 'visible' }}>
            {/* Logo Text container */}
            <View style={{ flexDirection: 'row', alignItems: 'center', overflow: 'visible' }}>
              <Animated.Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 48,
                  fontWeight: '900',
                  letterSpacing: -1.5,
                  opacity: sOpacity,
                  transform: [{ scale: sScale }],
                }}
              >
                s
              </Animated.Text>
              <Animated.View
                style={{
                  width: restTextWidth,
                  opacity: restTextOpacity,
                  overflow: 'hidden',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 48,
                    fontWeight: '900',
                    letterSpacing: -1.5,
                    width: 220,
                  }}
                >
                  ubtrack
                </Text>
              </Animated.View>
            </View>

            {/* Premium Brand Tagline */}
            <Animated.Text
              style={{
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 4,
                marginTop: 8,
                textTransform: 'uppercase',
                opacity: restTextOpacity,
              }}
            >
              smart manager
            </Animated.Text>

            {/* Converting Dot Overlay */}
            <Animated.View
              style={{
                position: 'absolute',
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: theme === 'dark' ? '#090D16' : '#FFFFFF',
                transform: [
                  { translateY: dotTranslateY },
                  { scale: dotScale }
                ],
              }}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
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
                    <AlarmOverlay />
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
