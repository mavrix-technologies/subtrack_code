import { getFirebaseBundle } from '@/services/firebase';
import { Platform } from 'react-native';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
let nativeAnalytics: any | null | undefined;
let webAnalytics: any | null | undefined;
let webAnalyticsModule: any | null | undefined;

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
  if (!isNative) return null;
  if (nativeAnalytics !== undefined) return nativeAnalytics;

  try {
    const analyticsModule = require('@react-native-firebase/analytics');
    nativeAnalytics = analyticsModule.default?.() ?? analyticsModule();
  } catch {
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
    if (isNative) {
      await getNativeAnalytics()?.setAnalyticsCollectionEnabled?.(true);
      await getNativeAnalytics()?.logAppOpen?.();
      return;
    }

    await getWebAnalytics();
  } catch {
    // Analytics should never block the app.
  }
}

export async function trackEvent(name: string, params?: AnalyticsParams) {
  const eventParams = cleanParams(params);

  try {
    const native = getNativeAnalytics();
    if (native) {
      await native.logEvent(name, eventParams);
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
    if (native) {
      await native.logScreenView?.({
        screen_name: screenName,
        screen_class: screenName,
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
    if (native) {
      await native.setUserId(userId ?? null);
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
