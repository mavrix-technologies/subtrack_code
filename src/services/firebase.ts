import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuthReactNative from '@firebase/auth';
import {
  Auth,
  getAuth,
  initializeAuth,
} from '@firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

type FirebaseBundle = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

const nativeFirebaseConfig = {
  apiKey: 'AIzaSyDPF-4MVpblQhLF2sYlbPEBCPDAnM8tkNg',
  authDomain: 'subscription-tracker-bd3fb.firebaseapp.com',
  projectId: 'subscription-tracker-bd3fb',
  storageBucket: 'subscription-tracker-bd3fb.firebasestorage.app',
  messagingSenderId: '178143403316',
  appId: '1:178143403316:android:eaf3a7c7aecfc2bb94d961',
};

function getFirebaseConfig() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || nativeFirebaseConfig.apiKey,
    authDomain:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || nativeFirebaseConfig.authDomain,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || nativeFirebaseConfig.projectId,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || nativeFirebaseConfig.storageBucket,
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      nativeFirebaseConfig.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || nativeFirebaseConfig.appId,
  };
}

const getAnalyticsMeasurementId = () => process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

type RequiredFirebaseConfig = ReturnType<typeof getFirebaseConfig>;

const firebaseConfigKeys: (keyof RequiredFirebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const getRequiredFirebaseConfig = () => {
  const config = getFirebaseConfig();
  return {
    config,
    missingKeys: firebaseConfigKeys.filter((key) => !config[key]),
  };
};

let bundle: FirebaseBundle | null = null;
let analyticsStarted = false;

type AuthPersistence = NonNullable<
  Parameters<typeof initializeAuth>[1]
>['persistence'];

const getReactNativePersistence = (
  FirebaseAuthReactNative as typeof FirebaseAuthReactNative & {
    getReactNativePersistence: (storage: typeof AsyncStorage) => AuthPersistence;
  }
).getReactNativePersistence;

export function getMissingFirebaseKeys() {
  return getRequiredFirebaseConfig().missingKeys;
}

export function getFirebaseBundle() {
  const { config, missingKeys } = getRequiredFirebaseConfig();
  if (missingKeys.length > 0) return null;
  if (bundle) return bundle;

  const app = getApps().length
    ? getApp()
    : initializeApp({
        ...config,
        measurementId: getAnalyticsMeasurementId(),
      });
  let auth: Auth;

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }

  bundle = {
    app,
    auth,
    db: getFirestore(app),
  };

  void initializeWebAnalytics(app);

  return bundle;
}

async function initializeWebAnalytics(app: FirebaseApp) {
  if (analyticsStarted) return;
  if (process.env.EXPO_OS !== 'web') return;
  if (!getAnalyticsMeasurementId()) return;

  analyticsStarted = true;

  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) {
      getAnalytics(app);
    }
  } catch {
    analyticsStarted = false;
  }
}
