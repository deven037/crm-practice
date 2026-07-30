import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';
import { locatorProps, testIds } from '../testIds';

type Mode = 'login' | 'forgot-email' | 'forgot-code' | 'forgot-password';

const delay = (min: number, max: number) => new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginScreen() {
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Behavioral no-op on mobile — SecureStore always persists the token (no localStorage/
  // sessionStorage split to mirror). Kept as a locatable UI element for parity with the
  // web app's remember-me checkbox, per mobile/LOCATORS.md.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    setBusy(true);
    const err = await login(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  const handleForgotEmail = async () => {
    setError(null);
    if (!EMAIL_RE.test(resetEmail.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    await delay(500, 1200);
    setBusy(false);
    setMode('forgot-code');
  };

  const handleForgotCode = async () => {
    setError(null);
    setBusy(true);
    await delay(300, 700);
    setBusy(false);
    if (code.trim() !== '123456') {
      setError('Incorrect code. Try again.');
      return;
    }
    setMode('forgot-password');
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, newPassword }),
      });
      setMode('login');
      setEmail(resetEmail);
      setPassword('');
      setCode('');
      setNewPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      {...locatorProps(testIds.page('login'))}
    >
      <Text style={styles.brand}>◆ Practice CRM</Text>

      {mode === 'login' && (
        <View>
          <Text style={styles.title}>Sign in</Text>
          {error ? (
            <Text style={styles.errorBanner} {...locatorProps(testIds.raw('login-error'))}>
              {error}
            </Text>
          ) : null}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            {...locatorProps(testIds.raw('login-email'))}
          />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              {...locatorProps(testIds.raw('login-password'))}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text>{showPassword ? '🙈' : '👁️'}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <View style={styles.rememberRow}>
              <Switch value={remember} onValueChange={setRemember} {...locatorProps(testIds.raw('login-remember'))} />
              <Text>Remember me</Text>
            </View>
            <Pressable onPress={() => setMode('forgot-email')}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={handleLogin}
            disabled={busy}
            {...locatorProps(testIds.raw('login-submit'))}
          >
            <Text style={styles.primaryBtnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
        </View>
      )}

      {mode === 'forgot-email' && (
        <View>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.muted}>Step 1 of 3 — enter your account email.</Text>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={resetEmail}
            onChangeText={setResetEmail}
          />
          <Pressable style={styles.primaryBtn} onPress={handleForgotEmail} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? 'Sending…' : 'Send reset code'}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('login')}>
            <Text style={[styles.link, styles.center]}>Back to sign in</Text>
          </Pressable>
        </View>
      )}

      {mode === 'forgot-code' && (
        <View>
          <Text style={styles.title}>Enter code</Text>
          <Text style={styles.muted}>Step 2 of 3 — enter the 6-digit code we sent.</Text>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          <Text style={styles.label}>Reset code</Text>
          <TextInput style={styles.input} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <Pressable style={styles.primaryBtn} onPress={handleForgotCode} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? 'Verifying…' : 'Verify code'}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('login')}>
            <Text style={[styles.link, styles.center]}>Back to sign in</Text>
          </Pressable>
        </View>
      )}

      {mode === 'forgot-password' && (
        <View>
          <Text style={styles.title}>New password</Text>
          <Text style={styles.muted}>Step 3 of 3 — choose a new password.</Text>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          <Text style={styles.label}>New password</Text>
          <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          <Pressable style={styles.primaryBtn} onPress={handleForgotPassword} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? 'Saving…' : 'Save password'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.hints}>
        <Text style={styles.hintsTitle}>Demo credentials (password for all: Pass@123)</Text>
        <Text>admin@crm.com — full access</Text>
        <Text>rep@crm.com — sales rep (read-only admin)</Text>
        <Text>viewer@crm.com — viewer (no admin)</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  brand: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  muted: { color: '#6b7280', marginBottom: 12 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: '#2563eb' },
  center: { textAlign: 'center', marginTop: 12 },
  errorBanner: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 12 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, marginTop: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  hints: { marginTop: 32, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8 },
  hintsTitle: { fontWeight: '600', marginBottom: 6 },
});
