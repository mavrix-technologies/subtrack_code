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
import { userExpenseDoc, userExpenses } from '@/services/firestorePaths';
import { trackEvent } from '@/services/analytics';
import { Expense } from '@/store/useExpenseStore';

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

export function listenToExpenses(
  userId: string,
  onData: (expenses: Expense[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(
    userExpenses(firebase.db, userId),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Expense[];
      onData(items);
    },
    (error) => onError(error)
  );
}

export async function addExpense(userId: string, input: Omit<Expense, 'id' | 'userId'>) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const ref = await addDoc(userExpenses(firebase.db, userId), {
    ...stripUndefinedDeep(input),
    userId,
    createdAt: serverTimestamp(),
  });

  void trackEvent('expense_created', {
    amount: input.amount,
    category: input.category,
    is_split: Boolean(input.isSplit),
    participant_count: input.participants?.length ?? 0,
  });

  return ref.id;
}

export async function updateExpense(
  userId: string,
  expenseId: string,
  updates: Partial<Omit<Expense, 'id' | 'userId'>>
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await updateDoc(
    userExpenseDoc(firebase.db, userId, expenseId),
    stripUndefinedDeep({
      ...updates,
      updatedAt: serverTimestamp(),
    }) as any
  );
  void trackEvent('expense_updated', {
    category: updates.category,
    is_split: updates.isSplit,
  });
}

export async function deleteExpense(userId: string, expenseId: string) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  await deleteDoc(userExpenseDoc(firebase.db, userId, expenseId));
  void trackEvent('expense_deleted');
}
