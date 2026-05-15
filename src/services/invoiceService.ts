import {
    addDoc,
    arrayUnion,
    deleteDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';

import { getFirebaseBundle } from '@/services/firebase';
import { userInvoiceDoc, userInvoices } from '@/services/firestorePaths';
import { trackEvent } from '@/services/analytics';
import { Invoice, PaymentRecord } from '@/store/useInvoiceStore';

export function listenToInvoices(
  userId: string,
  onData: (invoices: Invoice[]) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const q = query(userInvoices(firebase.db, userId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice);
      onData(items);
    },
    (error) => onError(error)
  );
}

export async function createInvoice(
  userId: string,
  input: Omit<Invoice, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  const ref = await addDoc(userInvoices(firebase.db, userId), {
    ...input,
    userId,
    createdAt: serverTimestamp(),
  });
  void trackEvent('invoice_created', {
    total: input.total,
    status: input.status,
    source: input.source,
    item_count: input.items.length,
  });
  return ref.id;
}

export async function updateInvoice(
  userId: string,
  id: string,
  data: Partial<Omit<Invoice, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await updateDoc(userInvoiceDoc(firebase.db, userId, id), { ...data });
  void trackEvent('invoice_updated', {
    status: data.status,
    total: data.total,
  });
}

export async function deleteInvoice(userId: string, id: string): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await deleteDoc(userInvoiceDoc(firebase.db, userId, id));
  void trackEvent('invoice_deleted');
}

export async function recordPayment(
  userId: string,
  invoiceId: string,
  payment: PaymentRecord,
  newAmountPaid: number,
  newBalanceDue: number,
  newStatus: Invoice['status']
): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await updateDoc(userInvoiceDoc(firebase.db, userId, invoiceId), {
    payments: arrayUnion(payment),
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    status: newStatus,
  });
  void trackEvent('invoice_payment_recorded', {
    amount: payment.amount,
    method: payment.method,
    status: newStatus,
    balance_due: newBalanceDue,
  });
}
