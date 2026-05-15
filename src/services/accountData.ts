import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { Linking, Platform } from 'react-native';

import { deleteCurrentAuthUser } from '@/services/auth';
import { getFirebaseBundle } from '@/services/firebase';
import {
  EXPENSE_COLLECTION,
  INVOICE_COLLECTION,
  PREFERENCE_COLLECTION,
  SPLIT_FRIEND_COLLECTION,
  SUBSCRIPTION_COLLECTION,
  userDoc,
} from '@/services/firestorePaths';
import type { AppUser } from '@/types/settings';
import { getCrashLogs } from '@/services/crashReporting';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@subtrack.app';
const PLAY_STORE_PACKAGE = 'com.subtrackapp.android';
const APP_STORE_URL = 'https://apps.apple.com/app/subtrack';

const COLLECTIONS = [
  SUBSCRIPTION_COLLECTION,
  EXPENSE_COLLECTION,
  INVOICE_COLLECTION,
  SPLIT_FRIEND_COLLECTION,
  PREFERENCE_COLLECTION,
];

async function readCollection(userId: string, name: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const snapshot = await getDocs(collection(userDoc(firebase.db, userId), name));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function exportUserData(user: AppUser) {
  const data = {
    exportedAt: new Date().toISOString(),
    user,
    subscriptions: await readCollection(user.uid, SUBSCRIPTION_COLLECTION),
    expenses: await readCollection(user.uid, EXPENSE_COLLECTION),
    invoices: await readCollection(user.uid, INVOICE_COLLECTION),
    splitFriends: await readCollection(user.uid, SPLIT_FRIEND_COLLECTION),
    preferences: await readCollection(user.uid, PREFERENCE_COLLECTION),
  };

  const fileName = `subtrack-export-${new Date().toISOString().slice(0, 10)}.json`;
  const uri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export SubTrack data',
      UTI: 'public.json',
    });
  }

  return uri;
}

export async function deleteSignedInUserDataAndAccount(userId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDocs(collection(userDoc(firebase.db, userId), collectionName));
    let batch = writeBatch(firebase.db);
    let pending = 0;

    for (const item of snapshot.docs) {
      batch.delete(item.ref);
      pending += 1;

      if (pending >= 450) {
        await batch.commit();
        batch = writeBatch(firebase.db);
        pending = 0;
      }
    }

    if (pending > 0) await batch.commit();
  }

  await deleteDoc(doc(firebase.db, 'users', userId));
  await deleteCurrentAuthUser();
}

export async function sendDataDeletionRequest(user: AppUser | null) {
  const subject = 'SubTrack data deletion request';
  const body = [
    'Hello SubTrack Support,',
    '',
    'Please delete my SubTrack account data.',
    '',
    `User ID: ${user?.uid || 'Not signed in'}`,
    `Email: ${user?.email || ''}`,
    '',
    'Thank you.',
  ].join('\n');

  const canCompose = await MailComposer.isAvailableAsync();
  if (canCompose) {
    await MailComposer.composeAsync({
      recipients: [SUPPORT_EMAIL],
      subject,
      body,
    });
    return;
  }

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
}

export async function sendSupportRequest(user: AppUser | null) {
  const crashLogs = await getCrashLogs();
  const subject = 'SubTrack support request';
  const body = [
    'Hello SubTrack Support,',
    '',
    'I need help with the app.',
    '',
    `User ID: ${user?.uid || 'Not signed in'}`,
    `Email: ${user?.email || ''}`,
    `Platform: ${Platform.OS}`,
    '',
    'Recent crash logs:',
    crashLogs.length
      ? crashLogs.slice(0, 3).map((log) => `- ${log.createdAt}: ${log.message}`).join('\n')
      : 'No recent crash logs stored on this device.',
    '',
    'Issue details:',
  ].join('\n');

  const canCompose = await MailComposer.isAvailableAsync();
  if (canCompose) {
    await MailComposer.composeAsync({
      recipients: [SUPPORT_EMAIL],
      subject,
      body,
    });
    return;
  }

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
}

export async function openStoreReview() {
  const url = Platform.select({
    android: `market://details?id=${PLAY_STORE_PACKAGE}`,
    ios: APP_STORE_URL,
    default: APP_STORE_URL,
  })!;

  const fallback = Platform.OS === 'android'
    ? `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`
    : APP_STORE_URL;

  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
    return;
  }

  await Linking.openURL(fallback);
}
