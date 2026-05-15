import {
  addDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import { userSplitFriendDoc, userSplitFriends } from '@/services/firestorePaths';
import type { SplitFriend } from '@/types/splitFriend';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as T;
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

export type SplitFriendInput = {
  displayName: string;
  email?: string;
  note?: string;
  color?: string;
};

export function listenToSplitFriends(
  userId: string,
  onData: (friends: SplitFriend[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(userSplitFriends(firebase.db, userId), orderBy('displayName'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SplitFriend[];
      onData(items);
    },
    (err) => onError(err)
  );
}

export async function createSplitFriend(userId: string, input: SplitFriendInput): Promise<string> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const ref = await addDoc(userSplitFriends(firebase.db, userId), {
    ...stripUndefinedDeep({
      userId,
      displayName: input.displayName.trim(),
      email: input.email?.trim() || undefined,
      note: input.note?.trim() || undefined,
      color: input.color || undefined,
    }),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSplitFriend(
  userId: string,
  friendId: string,
  updates: Partial<SplitFriendInput>
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.displayName !== undefined) payload.displayName = updates.displayName.trim();
  if (updates.email !== undefined) {
    const e = updates.email.trim();
    payload.email = e.length > 0 ? e : deleteField();
  }
  if (updates.note !== undefined) {
    const n = updates.note.trim();
    payload.note = n.length > 0 ? n : deleteField();
  }
  if (updates.color !== undefined) payload.color = updates.color || null;

  await updateDoc(userSplitFriendDoc(firebase.db, userId, friendId), payload as any);
}

export async function deleteSplitFriend(userId: string, friendId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await deleteDoc(userSplitFriendDoc(firebase.db, userId, friendId));
}
