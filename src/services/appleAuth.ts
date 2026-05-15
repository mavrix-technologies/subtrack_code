import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { getFirebaseBundle } from '@/services/firebase';

/**
 * Generates a random string of the given length.
 */
function generateNonce(length: number): string {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export async function signInWithApple(): Promise<void> {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  try {
    // Check if Apple Sign-In is available on the device
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign-In is not available on this device');
    }

    // Generate a random string as the raw nonce
    const rawNonce = generateNonce(32);

    // Hash the raw nonce using SHA-256
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    // Trigger Apple Sign-In with the hashed nonce
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken, fullName } = credential;

    if (!identityToken) {
      throw new Error('Apple Sign-In failed - no identity token returned');
    }

    // Build a Firebase credential using the token and the RAW (unhashed) nonce
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: identityToken,
      rawNonce,
    });

    // Sign in to Firebase
    const userCredential = await signInWithCredential(firebase.auth, firebaseCredential);

    // If Apple provided a name (only happens on the FIRST sign-in), update the Firebase profile
    if (fullName?.givenName || fullName?.familyName) {
      const displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
        // The ensureUserProfile from auth.ts will eventually catch up, but doing it here guarantees
        // the user has the name set right away.
      }
    }
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      // User canceled the sign-in flow
      throw new Error('User cancelled Apple Sign-In');
    } else if (
      error.message && 
      error.message.includes('host.exp.Exponent') && 
      error.message.includes('audience')
    ) {
      throw new Error(
        'Apple Sign-In in Expo Go uses the bundle ID "host.exp.Exponent", which Firebase rejects.\n\nTo test Apple Sign-In, you must either test on a standalone Development Build, or temporarily change your Firebase Apple Service ID to "host.exp.Exponent".'
      );
    } else {
      console.error('Apple Sign-In Error:', error);
      throw error;
    }
  }
}
