import { useTheme } from '@/contexts/theme';
import { signInWithApple } from '@/services/appleAuth';
import {
  continueAsGuest,
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from '@/services/auth';
import { signInWithGoogle } from '@/services/googleAuth';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as RNImage } from 'expo-image';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const { palette, theme } = useTheme();
  const styles = useMemo(() => createStyles(palette, theme), [palette, theme]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const maxWidth = Math.min(width, 480);
  const horizontalPad = width > 480 ? (width - maxWidth) / 2 : 0;

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);
  const goHomeAfterAuth = () => {
    setTimeout(() => router.replace('/(tabs)'), 120);
  };

  const handleSubmit = async () => {
    clearError();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(name.trim(), email.trim(), password);
      }
      goHomeAfterAuth();
    } catch (err: any) {
      setError(friendlyError(err?.code || err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearError();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(trimmedEmail);
      Alert.alert('Reset email sent', 'Check your inbox for a password reset link.');
    } catch (err: any) {
      setError(friendlyError(err?.code || err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    clearError();
    setLoading(true);
    try {
      await continueAsGuest();
      goHomeAfterAuth();
    } catch (err: any) {
      setError(friendlyError(err?.code || err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearError();
    setLoading(true);
    try {
      await signInWithGoogle();
      goHomeAfterAuth();
    } catch (err: any) {
      if (err?.message !== 'Google sign in was cancelled') {
        setError(err?.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    clearError();
    setLoading(true);
    try {
      await signInWithApple();
      goHomeAfterAuth();
    } catch (err: any) {
      if (err.message !== 'User cancelled Apple Sign-In') {
        setError(err?.message || 'Failed to sign in with Apple');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: horizontalPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme === 'dark' ? '#111827' : '#FFFFFF',
              borderColor: theme === 'dark' ? '#273244' : palette.line,
            },
          ]}
        >
          <View style={styles.logoRing}>
            <RNImage
              source={require('../../assets/SubTrack_Assets/SubTrack_Android_Icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.heroKicker, { color: theme === 'dark' ? '#FDBA74' : '#EA580C' }]}>Subscription Manager</Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>SubTrack</Text>
          <Text style={[styles.heroSub, { color: palette.muted }]}>Track renewals, spending, invoices, and reminders in one calm place.</Text>

          {/* Version badge */}
          <View style={[styles.versionBadge, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F9FAFB', borderColor: theme === 'dark' ? '#374151' : palette.line }]}>
            <Text style={[styles.versionText, { color: theme === 'dark' ? '#FDBA74' : '#C2410C' }]}>v1.2.1</Text>
          </View>
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>
          {/* Mode toggle */}
          <View style={styles.toggle}>
            <Pressable
              style={[styles.toggleBtn, mode === 'signin' && styles.toggleBtnActive]}
              onPress={() => { clearError(); setMode('signin'); }}
            >
              <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
              onPress={() => { clearError(); setMode('signup'); }}
            >
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Icon source="alert-circle-outline" size={15} color={palette.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Social buttons */}
          <View style={styles.socialRow}>
            {Platform.OS === 'ios' && (
              <Pressable
                style={[styles.socialBtn, styles.appleBtn]}
                onPress={handleApple}
                disabled={loading}
              >
                <Icon source="apple" size={18} color="#fff" />
                <Text style={styles.appleBtnText}>Apple</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.socialBtn, styles.googleBtn, { borderColor: palette.line }]}
              onPress={handleGoogle}
              disabled={loading}
            >
              <Icon source="google" size={18} color={palette.text} />
              <Text style={[styles.googleBtnText, { color: palette.text }]}>Google</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.guestBtn, { borderColor: `${palette.primary}55`, backgroundColor: `${palette.primary}12` }]}
            onPress={handleGuest}
            disabled={loading}
          >
            <Icon source="incognito" size={18} color={palette.primary} />
            <Text style={[styles.guestBtnText, { color: palette.primary }]}>Continue as Guest</Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: palette.line }]} />
            <Text style={[styles.dividerText, { color: palette.muted }]}>
              or {mode === 'signin' ? 'sign in' : 'sign up'} with email
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: palette.line }]} />
          </View>

          {/* Name (signup only) */}
          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>Full Name</Text>
              <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Icon source="account-outline" size={17} color={palette.muted} />
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  placeholder="Your name"
                  placeholderTextColor={palette.muted}
                  value={name}
                  onChangeText={(t) => { clearError(); setName(t); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.text }]}>Email</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Icon source="email-outline" size={17} color={palette.muted} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder="you@example.com"
                placeholderTextColor={palette.muted}
                value={email}
                onChangeText={(t) => { clearError(); setEmail(t); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <View style={styles.passwordLabelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Password</Text>
              {mode === 'signin' && (
                <Pressable onPress={handleForgotPassword} disabled={loading} hitSlop={8}>
                  <Text style={[styles.forgotText, { color: palette.primary }]}>Forgot password?</Text>
                </Pressable>
              )}
            </View>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Icon source="lock-outline" size={17} color={palette.muted} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                placeholderTextColor={palette.muted}
                value={password}
                onChangeText={(t) => { clearError(); setPassword(t); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                <Icon
                  source={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={palette.muted}
                />
              </Pressable>
            </View>
          </View>

          {/* Primary CTA */}
          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>

          {/* Switch mode */}
          <Pressable style={styles.switchRow} onPress={() => { clearError(); setMode(m => m === 'signin' ? 'signup' : 'signin'); }}>
            <Text style={[styles.switchText, { color: palette.muted }]}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={[styles.switchLink, { color: palette.primary }]}>
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default: return code || 'Something went wrong. Please try again.';
  }
}

const createStyles = (palette: any, theme: 'light' | 'dark') => StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'stretch',
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 236,
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoRing: {
    width: 86, height: 86, borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  logoImage: {
    width: 74,
    height: 74,
    borderRadius: 8,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34, fontWeight: '900',
    letterSpacing: 0, marginBottom: 8,
  },
  heroSub: {
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600', textAlign: 'center',
  },
  versionBadge: {
    position: 'absolute', top: 14, right: 14,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  versionText: { fontSize: 11, fontWeight: '800' },

  // ── Card ──────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
    ...(theme === 'dark' ? {} : {
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }),
  },

  // ── Toggle ────────────────────────────────────────────────────────────
  toggle: {
    flexDirection: 'row',
    backgroundColor: palette.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.line,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: palette.surface,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: palette.muted },
  toggleTextActive: { color: palette.text },

  // ── Error ─────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${palette.danger}12`,
    borderWidth: 1, borderColor: `${palette.danger}25`,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: palette.danger, fontWeight: '500' },

  // ── Social ────────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14,
  },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  googleBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600' },
  guestBtn: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 2,
  },
  guestBtnText: { fontSize: 15, fontWeight: '800' },

  // ── Divider ───────────────────────────────────────────────────────────
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500' },

  // ── Fields ────────────────────────────────────────────────────────────
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  passwordLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },

  // ── Buttons ───────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: palette.primary,
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Switch ────────────────────────────────────────────────────────────
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 14 },
  switchLink: { fontWeight: '700' },
});
