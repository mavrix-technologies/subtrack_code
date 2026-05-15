import { collection, doc, Firestore } from 'firebase/firestore';

export const APP_CONFIG_COLLECTION = 'appConfig';
export const USER_COLLECTION = 'users';
export const SUBSCRIPTION_COLLECTION = 'subscriptions';
export const EXPENSE_COLLECTION = 'expenses';
export const INVOICE_COLLECTION = 'invoices';
export const PREFERENCE_COLLECTION = 'preferences';
export const SPLIT_FRIEND_COLLECTION = 'splitFriends';

export function userDoc(db: Firestore, userId: string) {
  return doc(db, USER_COLLECTION, userId);
}

export function appConfigDoc(db: Firestore, configId: string) {
  return doc(db, APP_CONFIG_COLLECTION, configId);
}

export function userSubscriptions(db: Firestore, userId: string) {
  return collection(userDoc(db, userId), SUBSCRIPTION_COLLECTION);
}

export function userSubscriptionDoc(db: Firestore, userId: string, subscriptionId: string) {
  return doc(userSubscriptions(db, userId), subscriptionId);
}

export function userExpenses(db: Firestore, userId: string) {
  return collection(userDoc(db, userId), EXPENSE_COLLECTION);
}

export function userExpenseDoc(db: Firestore, userId: string, expenseId: string) {
  return doc(userExpenses(db, userId), expenseId);
}

export function userInvoices(db: Firestore, userId: string) {
  return collection(userDoc(db, userId), INVOICE_COLLECTION);
}

export function userInvoiceDoc(db: Firestore, userId: string, invoiceId: string) {
  return doc(userInvoices(db, userId), invoiceId);
}

export function userPreferences(db: Firestore, userId: string) {
  return collection(userDoc(db, userId), PREFERENCE_COLLECTION);
}

export function userPreferenceDoc(db: Firestore, userId: string, preferenceId: string) {
  return doc(userPreferences(db, userId), preferenceId);
}

export function userSplitFriends(db: Firestore, userId: string) {
  return collection(userDoc(db, userId), SPLIT_FRIEND_COLLECTION);
}

export function userSplitFriendDoc(db: Firestore, userId: string, friendId: string) {
  return doc(userSplitFriends(db, userId), friendId);
}
