import { getFirebaseBundle } from '@/services/firebase';
import { trackEvent } from '@/services/analytics';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Alert, Platform, TurboModuleRegistry } from 'react-native';

// Web client ID — used by @react-native-google-signin to get an ID token
// that Firebase can verify. Must be the type-3 (web) client.
const GOOGLE_WEB_CLIENT_ID =
  '178143403316-nt6hd89gpapr7enr6sgpa6cjl3sttp11.apps.googleusercontent.com';

let configured = false;

function isDeveloperConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  return /DEVELOPER_ERROR|statusCode=10|code: 10|\b10\b/i.test(`${code} ${message}`);
}

async function getGoogleSignin() {
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;

  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  return GoogleSignin;
}

export async function signInWithGoogle(): Promise<void> {
  const GoogleSignin = await getGoogleSignin();

  if (!GoogleSignin) {
    Alert.alert('Error', 'Google Sign-In is not available on this device.');
    return;
  }

  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo?.data?.idToken ?? (userInfo as { idToken?: string })?.idToken;
    if (!idToken) throw new Error('Google sign in was cancelled');

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(firebase.auth, credential);
    void trackEvent('login', { method: 'google' });
  } catch (error) {
    if (isDeveloperConfigError(error)) {
      console.warn('Google Sign-In Android configuration error:', error);
      throw new Error('Google sign-in is not configured for this app build yet. Please use email sign-in for now.');
    }
    throw error;
  }
}
