import {
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import { userPreferenceDoc } from '@/services/firestorePaths';

export type AppPreferences = {
  currencyCode?: string;
  theme?: 'light' | 'dark';
};

export type InvoiceBrandPreference = {
  businessName?: string;
  tagline?: string;
  logoUri?: string;
  signatureUri?: string;
  signatureLabel?: string;
  filePrefix?: string;
};

const APP_PREF_ID = 'app';
const INVOICE_BRAND_PREF_ID = 'invoiceBrand';

export function listenToAppPreferences(
  userId: string,
  onData: (preferences: AppPreferences | null) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  return onSnapshot(
    userPreferenceDoc(firebase.db, userId, APP_PREF_ID),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() as AppPreferences : null),
    (error) => onError(error)
  );
}

export async function saveAppPreferences(
  userId: string,
  preferences: AppPreferences
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await setDoc(
    userPreferenceDoc(firebase.db, userId, APP_PREF_ID),
    {
      ...preferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function listenToInvoiceBrandPreference(
  userId: string,
  onData: (brand: InvoiceBrandPreference | null) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  return onSnapshot(
    userPreferenceDoc(firebase.db, userId, INVOICE_BRAND_PREF_ID),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() as InvoiceBrandPreference : null),
    (error) => onError(error)
  );
}

export async function saveInvoiceBrandPreference(
  userId: string,
  brand: InvoiceBrandPreference
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await setDoc(
    userPreferenceDoc(firebase.db, userId, INVOICE_BRAND_PREF_ID),
    {
      ...brand,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

