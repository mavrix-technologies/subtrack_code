import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import {
  userExpenses,
  userInvoices,
  userSubscriptions,
} from '@/services/firestorePaths';

type LegacyCollectionName = 'subscriptions' | 'expenses' | 'invoices';

type MigrationSummary = {
  subscriptions: number;
  expenses: number;
  invoices: number;
  total: number;
};

function targetCollection(
  db: Firestore,
  userId: string,
  name: LegacyCollectionName
): CollectionReference<DocumentData> {
  if (name === 'subscriptions') return userSubscriptions(db, userId);
  if (name === 'expenses') return userExpenses(db, userId);
  return userInvoices(db, userId);
}

async function migrateCollection(
  userId: string,
  name: LegacyCollectionName
): Promise<number> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const legacyQuery = query(
    collection(firebase.db, name),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(legacyQuery);
  if (snapshot.empty) return 0;

  const destination = targetCollection(firebase.db, userId, name);
  let batch = writeBatch(firebase.db);
  let pendingWrites = 0;
  let migrated = 0;

  for (const item of snapshot.docs) {
    batch.set(
      doc(destination, item.id),
      {
        ...item.data(),
        userId,
        migratedFrom: name,
        migratedAt: serverTimestamp(),
      },
      { merge: true }
    );
    pendingWrites += 1;
    migrated += 1;

    if (pendingWrites >= 450) {
      await batch.commit();
      batch = writeBatch(firebase.db);
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  return migrated;
}

export async function migrateLegacyUserData(userId: string): Promise<MigrationSummary> {
  const [subscriptions, expenses, invoices] = await Promise.all([
    migrateCollection(userId, 'subscriptions'),
    migrateCollection(userId, 'expenses'),
    migrateCollection(userId, 'invoices'),
  ]);

  return {
    subscriptions,
    expenses,
    invoices,
    total: subscriptions + expenses + invoices,
  };
}
