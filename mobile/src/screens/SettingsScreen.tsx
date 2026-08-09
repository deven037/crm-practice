import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';
import { clearToken } from '../auth/storage';
import { getPrefs, setPrefs, Prefs } from '../utils/prefs';
import { locatorProps, testIds } from '../testIds';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;

export function SettingsScreen() {
  const navigation = useNavigation();
  const { user, refreshUser, logout } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [prefs, setLocalPrefs] = useState<Prefs | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPrefs().then(setLocalPrefs);
  }, []);

  const savePrefs = (next: Prefs) => {
    setLocalPrefs(next);
    setPrefs(next);
  };

  const saveProfile = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (phone && !PHONE_RE.test(phone.trim())) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !user) return;
    setSaving(true);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      await refreshUser();
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    await apiFetch('/reset', { method: 'POST' });
    await clearToken();
    setConfirmReset(false);
    await logout();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('settings'))}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.label}>Full name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('profile-name'))} />
        {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          {...locatorProps(testIds.raw('profile-email'))}
        />
        {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98xxx xxxxx"
          value={phone}
          onChangeText={setPhone}
          {...locatorProps(testIds.raw('profile-phone'))}
        />
        {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}
        <Pressable
          style={[styles.btn, styles.btnPrimary, styles.btnBlock]}
          onPress={saveProfile}
          disabled={saving}
          {...locatorProps(testIds.raw('profile-save-btn'))}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
      </View>

      {prefs && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notification preferences</Text>
          <View style={styles.switchRow}>
            <Switch value={prefs.emailNotifs} onValueChange={(v) => savePrefs({ ...prefs, emailNotifs: v })} />
            <Text>Email notifications</Text>
          </View>
          <View style={styles.switchRow}>
            <Switch value={prefs.pushNotifs} onValueChange={(v) => savePrefs({ ...prefs, pushNotifs: v })} />
            <Text>Push notifications</Text>
          </View>
          <View style={styles.switchRow}>
            <Switch value={prefs.weeklyDigest} onValueChange={(v) => savePrefs({ ...prefs, weeklyDigest: v })} />
            <Text>Weekly digest email</Text>
          </View>

          <Text style={styles.subTitle}>Display density</Text>
          <View style={styles.radioRow}>
            <Pressable style={styles.radioOption} onPress={() => savePrefs({ ...prefs, density: 'comfortable' })}>
              <Text style={prefs.density === 'comfortable' ? styles.radioSelected : undefined}>◉ Comfortable</Text>
            </Pressable>
            <Pressable style={styles.radioOption} onPress={() => savePrefs({ ...prefs, density: 'compact' })}>
              <Text style={prefs.density === 'compact' ? styles.radioSelected : undefined}>◉ Compact</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Help center</Text>
        <Pressable style={styles.btn} onPress={() => navigation.navigate('HelpWebView' as never)}>
          <Text>Open embedded help center</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.cardTitle}>Danger zone</Text>
        <Text style={styles.muted}>
          Reset all CRM data back to the original seed state. Use this to get a clean, repeatable dataset before test
          runs.
        </Text>
        <Pressable
          style={[styles.btn, styles.btnDanger, styles.btnBlock]}
          onPress={() => setConfirmReset(true)}
          {...locatorProps(testIds.raw('reset-data-btn'))}
        >
          <Text style={styles.btnDangerText}>Reset all data</Text>
        </Pressable>
      </View>

      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reset all data?</Text>
            <Text>
              This wipes every change you've made (leads, deals, tickets, users…) and restores the deterministic seed
              data. You will be signed out.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setConfirmReset(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={doReset} {...locatorProps(testIds.raw('reset-confirm-btn'))}>
                <Text style={styles.btnDangerText}>Yes, reset everything</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 4, marginBottom: 16 },
  dangerCard: { borderColor: '#fecaca' },
  cardTitle: { fontWeight: '700', fontSize: 15, marginBottom: 4 },
  subTitle: { fontWeight: '600', fontSize: 13, marginTop: 12 },
  label: { fontSize: 13, color: '#374151', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  radioRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  radioOption: { paddingVertical: 4 },
  radioSelected: { color: '#2563eb', fontWeight: '600' },
  muted: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  btnBlock: { marginTop: 14 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
