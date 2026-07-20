import {
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import {
  userAssistantSessionDoc,
  userAssistantSessions,
} from '@/services/firestorePaths';

export type AssistantSession = {
  id: string;
  title: string;
  messages: any[];
  updatedAt: number;
  createdAt?: number;
};

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
  );
}

export function listenToAssistantSessions(
  userId: string,
  onData: (sessions: AssistantSession[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(userAssistantSessions(firebase.db, userId), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as AssistantSession[]);
    },
    onError
  );
}

export async function saveAssistantSession(userId: string, session: AssistantSession) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await setDoc(
    userAssistantSessionDoc(firebase.db, userId, session.id),
    removeUndefined({
      ...session,
      userId,
      updatedAt: session.updatedAt || Date.now(),
      createdAt: session.createdAt || Date.now(),
    }) as Record<string, unknown>,
    { merge: true }
  );
}

export async function deleteAssistantSession(userId: string, sessionId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await deleteDoc(userAssistantSessionDoc(firebase.db, userId, sessionId));
}
