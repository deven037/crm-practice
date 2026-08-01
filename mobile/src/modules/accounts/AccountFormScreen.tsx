import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AccountsStackParamList } from '../../navigation/types';
import { useCreateAccount } from '../../api/hooks/useAccounts';
import { useCollection } from '../../api/hooks/useCollection';
import { useAuth } from '../../auth/AuthContext';
import { SelectField } from '../../components/SelectField';
import { User } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<AccountsStackParamList, 'accountsForm'>;

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics', 'Media'];
const URL_RE = /^https?:\/\/.+\..+/;

export function AccountFormScreen({ navigation }: Props) {
  const { user } = useAuth();
  const createAccount = useCreateAccount();
  const usersQ = useCollection<User>('users');
  const users = usersQ.data?.data ?? [];

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [employeesText, setEmployeesText] = useState('0');
  const [revenueText, setRevenueText] = useState('0');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerId, setOwnerId] = useState(user?.id ?? '');
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Account name is required.';
    if (website && !URL_RE.test(website.trim())) errs.website = 'Enter a valid URL (starting with http:// or https://).';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const account = await createAccount.mutateAsync({
      name: name.trim(),
      industry,
      employees: Number(employeesText) || 0,
      revenue: Number(revenueText) || 0,
      website: website.trim(),
      phone: phone.trim(),
      ownerId: ownerId || user?.id || '',
    });
    navigation.replace('accountsDetail', { id: account.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('account-form'))}>
      <Text style={styles.title}>New account</Text>

      <Text style={styles.label}>Account name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('account-name'))} />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>Industry</Text>
      <SelectField
        value={industry}
        options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
        onChange={setIndustry}
        testID="account-industry"
      />

      <Text style={styles.label}>Employees</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={employeesText}
        onChangeText={setEmployeesText}
        {...locatorProps(testIds.raw('account-employees'))}
      />

      <Text style={styles.label}>Annual revenue ($)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={revenueText}
        onChangeText={setRevenueText}
        {...locatorProps(testIds.raw('account-revenue'))}
      />

      <Text style={styles.label}>Website</Text>
      <TextInput
        style={styles.input}
        placeholder="https://…"
        autoCapitalize="none"
        value={website}
        onChangeText={setWebsite}
        {...locatorProps(testIds.raw('account-website'))}
      />
      {errors.website ? <Text style={styles.error}>{errors.website}</Text> : null}

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} {...locatorProps(testIds.raw('account-phone'))} />

      <Text style={styles.label}>Owner</Text>
      <SelectField value={ownerId} options={users.map((u) => ({ value: u.id, label: u.name }))} onChange={setOwnerId} />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createAccount.isPending}>
          <Text style={styles.primaryBtnText}>{createAccount.isPending ? 'Creating…' : 'Create account'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});
