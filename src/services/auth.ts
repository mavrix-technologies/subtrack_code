import {
    createUserWithEmailAndPassword,
    deleteUser,
    sendPasswordResetEmail,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    Unsubscribe,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { trackEvent } from '@/services/analytics';
import { getFirebaseBundle } from '@/services/firebase';
import { AppUser } from '@/types/settings';

export type AuthBootstrapResult =
  | { status: 'missing-config' }
  | { status: 'ready'; unsubscribe: Unsubscribe };

export function bootstrapAuth(
  onUser: (user: AppUser | null) => void,
  onError: (error: Error) => void
): AuthBootstrapResult {
  const firebase = getFirebaseBundle();
  if (!firebase) return { status: 'missing-config' };

  const unsubscribe = onAuthStateChanged(firebase.auth, async (user) => {
    try {
      if (!user) {
        // Not signed in — let the UI handle it (show login screen)
        onUser(null);
        return;
      }
      onUser(toFallbackAppUser(user));
      ensureUserProfile(user)
        .then(onUser)
        .catch((error) => console.warn('User profile sync failed:', error));
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return { status: 'ready', unsubscribe };
}

/** @deprecated use bootstrapAuth */
export function bootstrapAnonymousAuth(
  onUser: (user: AppUser | null) => void,
  onError: (error: Error) => void
): AuthBootstrapResult {
  return bootstrapAuth(onUser, onError);
}

export async function signInWithEmail(email: string, password: string): Promise<AppUser> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  const { user } = await signInWithEmailAndPassword(firebase.auth, email, password);
  ensureUserProfile(user).catch((error) => console.warn('User profile sync failed:', error));
  void trackEvent('login', { method: 'email' });
  return toFallbackAppUser(user);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await sendPasswordResetEmail(firebase.auth, email);
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AppUser> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  const { user } = await createUserWithEmailAndPassword(firebase.auth, email, password);
  await updateProfile(user, { displayName: name });
  ensureUserProfile(user, name).catch((error) => console.warn('User profile sync failed:', error));
  void trackEvent('sign_up', { method: 'email' });
  return toFallbackAppUser(user, name);
}

export async function continueAsGuest(): Promise<AppUser> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  const { user } = await signInAnonymously(firebase.auth);
  ensureUserProfile(user).catch((error) => console.warn('User profile sync failed:', error));
  void trackEvent('login', { method: 'guest' });
  return toFallbackAppUser(user);
}

export async function signOut(): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');
  await firebaseSignOut(firebase.auth);
  void trackEvent('logout');
}

export async function deleteCurrentAuthUser(): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase?.auth.currentUser) throw new Error('No signed-in user');
  await deleteUser(firebase.auth.currentUser);
}

function toFallbackAppUser(user: User, nameOverride?: string): AppUser {
  return {
    uid: user.uid,
    name: nameOverride || user.displayName || 'User',
    email: user.email || '',
    photoURL: user.photoURL || '',
  };
}

async function ensureUserProfile(user: User, nameOverride?: string): Promise<AppUser> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  const fallbackName  = nameOverride || user.displayName || 'User';
  const fallbackEmail = user.email || '';
  const fallbackPhoto = user.photoURL || '';
  const ref = doc(firebase.db, 'users', user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    await updateDoc(ref, {
      ...(nameOverride ? { name: nameOverride } : {}),
      updatedAt: serverTimestamp(),
    });
    const data = snapshot.data();
    return {
      uid: user.uid,
      name: String(nameOverride || data.name || fallbackName),
      email: String(data.email || fallbackEmail),
      photoURL: String(data.photoURL || fallbackPhoto || ''),
    };
  }

  await setDoc(ref, {
    uid: user.uid,
    name: fallbackName,
    email: fallbackEmail,
    photoURL: fallbackPhoto,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { uid: user.uid, name: fallbackName, email: fallbackEmail, photoURL: fallbackPhoto };
}
