import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import {
  userSubscriptionDoc,
  userSubscriptions,
} from '@/services/firestorePaths';
import { Subscription, SubscriptionInput } from '@/types/subscription';

export function listenToSubscriptions(
  userId: string,
  onData: (subscriptions: Subscription[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(
    userSubscriptions(firebase.db, userId),
    orderBy('nextBillingDate', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const subscriptions = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Subscription[];
      onData(subscriptions);
    },
    (error) => onError(error)
  );
}

export async function createSubscription(
  userId: string,
  input: SubscriptionInput
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const ref = await addDoc(userSubscriptions(firebase.db, userId), {
    ...input,
    userId,
    currency: 'INR',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateSubscription(
  userId: string,
  subscriptionId: string,
  input: SubscriptionInput
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await updateDoc(userSubscriptionDoc(firebase.db, userId, subscriptionId), {
    ...input,
    currency: 'INR',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSubscription(userId: string, subscriptionId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await deleteDoc(userSubscriptionDoc(firebase.db, userId, subscriptionId));
}
