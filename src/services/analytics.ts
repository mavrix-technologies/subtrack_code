import { getFirebaseBundle } from '@/services/firebase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
// Check if running in Expo (development) vs native build
const isExpoApp = Constants.appOwnership === 'expo';

let nativeAnalytics: any | null | undefined;
let nativeAnalyticsModule: any | null | undefined;
let webAnalytics: any | null | undefined;
let webAnalyticsModule: any | null | undefined;
let analyticsInitialized = false;

function cleanParams(params?: AnalyticsParams) {
  if (!params) return undefined;
  const clean: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    clean[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }

  return Object.keys(clean).length ? clean : undefined;
}

function getNativeAnalytics() {
  // Don't attempt to load native Firebase in Expo development
  if (!isNative || isExpoApp) return null;
  if (nativeAnalytics !== undefined) return nativeAnalytics;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeAnalyticsModule = require('@react-native-firebase/analytics');
    nativeAnalytics = nativeAnalyticsModule.getAnalytics();
  } catch (error) {
    // Firebase native module not available in this environment
    console.debug('[Analytics] Native Firebase unavailable:', (error as Error).message);
    nativeAnalytics = null;
  }

  return nativeAnalytics;
}

async function getWebAnalytics() {
  if (Platform.OS !== 'web') return null;
  if (webAnalytics !== undefined) return webAnalytics;

  const firebase = getFirebaseBundle();
  if (!firebase || !process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    webAnalytics = null;
    return webAnalytics;
  }

  try {
    webAnalyticsModule = await import('firebase/analytics');
    if (await webAnalyticsModule.isSupported()) {
      webAnalytics = webAnalyticsModule.getAnalytics(firebase.app);
    } else {
      webAnalytics = null;
    }
  } catch {
    webAnalytics = null;
  }

  return webAnalytics;
}

export async function initializeAnalytics() {
  try {
    // Prevent double initialization
    if (analyticsInitialized) return;
    analyticsInitialized = true;

    if (isNative) {
      // Retry native analytics initialization with a small delay to allow native bridge setup
      const analytics = getNativeAnalytics();
      if (analytics && nativeAnalyticsModule) {
        try {
          await nativeAnalyticsModule.setAnalyticsCollectionEnabled(analytics, true);
          await nativeAnalyticsModule.logEvent(analytics, 'app_open');
        } catch (error) {
          console.debug('[Analytics] Failed to initialize native analytics:', (error as Error).message);
        }
      }
      return;
    }

    await getWebAnalytics();
  } catch (error) {
    // Analytics should never block the app.
    console.debug('[Analytics] Initialization error:', (error as Error).message);
  }
}

export async function trackEvent(name: string, params?: AnalyticsParams) {
  const eventParams = cleanParams(params);

  try {
    const native = getNativeAnalytics();
    if (native && nativeAnalyticsModule) {
      await nativeAnalyticsModule.logEvent(native, name, eventParams ?? {});
      return;
    }

    const web = await getWebAnalytics();
    if (web && webAnalyticsModule) {
      webAnalyticsModule.logEvent(web, name, eventParams);
    }
  } catch {
    // Ignore reporting failures.
  }
}

export async function trackScreenView(screenName: string) {
  try {
    const native = getNativeAnalytics();
    if (native && nativeAnalyticsModule) {
      await nativeAnalyticsModule.logEvent(native, 'screen_view', {
        firebase_screen: screenName,
        firebase_screen_class: screenName,
      });
      return;
    }

    await trackEvent('screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenName,
    });
  } catch {
    // Ignore reporting failures.
  }
}

export async function setAnalyticsUserId(userId?: string | null) {
  try {
    const native = getNativeAnalytics();
    if (native && nativeAnalyticsModule) {
      await nativeAnalyticsModule.setUserId(native, userId ?? null);
      return;
    }

    const web = await getWebAnalytics();
    if (web && webAnalyticsModule) {
      webAnalyticsModule.setUserId(web, userId ?? null);
    }
  } catch {
    // Ignore reporting failures.
  }
}
