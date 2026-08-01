import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ContactsStackParamList } from '../../navigation/types';
import { useCreateContact } from '../../api/hooks/useContacts';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { MultiSelectChips } from '../../components/MultiSelectChips';
import { Account } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ContactsStackParamList, 'contactsForm'>;

const TAG_OPTIONS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'].map((t) => ({
  value: t,
  label: t,
}));

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ContactFormScreen({ navigation }: Props) {
  const createContact = useCreateContact();
  const accountsQ = useCollection<Account>('accounts');
  const accounts = accountsQ.data?.data ?? [];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const contact = await createContact.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      title: title.trim(),
      accountId: accountId || null,
      tags,
      avatar: null,
      notes: [],
      files: [],
    });
    navigation.replace('contactsDetail', { id: contact.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('contact-form'))}>
      <Text style={styles.title}>New contact</Text>

      <Text style={styles.label}>Full name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('contact-name'))} />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        {...locatorProps(testIds.raw('contact-email'))}
      />
      {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} {...locatorProps(testIds.raw('contact-phone'))} />

      <Text style={styles.label}>Job title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} {...locatorProps(testIds.raw('contact-title'))} />

      <Text style={styles.label}>Account</Text>
      <SelectField
        value={accountId}
        options={[{ value: '', label: 'No account' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        onChange={setAccountId}
        testID="contact-account"
      />

      <Text style={styles.label}>Tags</Text>
      <MultiSelectChips values={tags} options={TAG_OPTIONS} onChange={setTags} testID="contact-tags" />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createContact.isPending}>
          <Text style={styles.primaryBtnText}>{createContact.isPending ? 'Creating…' : 'Create contact'}</Text>
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
