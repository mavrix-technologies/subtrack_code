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
import { userReminderDoc, userReminders } from '@/services/firestorePaths';
import { Reminder, ReminderDraft } from '@/types/reminder';

export function listenToReminders(
  userId: string,
  onData: (reminders: Reminder[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(userReminders(firebase.db, userId), orderBy('datetime', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Reminder[]);
    },
    onError
  );
}

export async function createReminder(userId: string, draft: ReminderDraft) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const ref = await addDoc(userReminders(firebase.db, userId), {
    ...draft,
    userId,
    status: 'active',
    notificationIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateReminder(userId: string, reminderId: string, updates: Partial<Reminder>) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await updateDoc(userReminderDoc(firebase.db, userId, reminderId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReminder(userId: string, reminderId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await deleteDoc(userReminderDoc(firebase.db, userId, reminderId));
}
