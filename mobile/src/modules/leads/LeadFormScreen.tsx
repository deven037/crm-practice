import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../../navigation/types';
import { useCreateLead } from '../../api/hooks/useLeads';
import { useCollection } from '../../api/hooks/useCollection';
import { useAuth } from '../../auth/AuthContext';
import { SelectField } from '../../components/SelectField';
import { Campaign, LEAD_SOURCES, LEAD_STATUSES, LeadStatus, Product, User } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<LeadsStackParamList, 'leadsForm'>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LeadFormScreen({ navigation }: Props) {
  const { user } = useAuth();
  const createLead = useCreateLead();
  const productsQ = useCollection<Product>('products');
  const campaignsQ = useCollection<Campaign>('campaigns');
  const usersQ = useCollection<User>('users');
  const products = productsQ.data?.data ?? [];
  const campaigns = campaignsQ.data?.data ?? [];
  const users = usersQ.data?.data ?? [];

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<LeadStatus>('New');
  const [source, setSource] = useState(LEAD_SOURCES[0]);
  const [productId, setProductId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [ownerId, setOwnerId] = useState(user?.id ?? '');
  const [valueText, setValueText] = useState('0');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const lead = await createLead.mutateAsync({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      status,
      source,
      ownerId: ownerId || user?.id || '',
      value: Number(valueText) || 0,
      productId: productId || null,
      campaignId: campaignId || null,
    });
    navigation.replace('leadsDetail', { id: lead.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('lead-form'))}>
      <Text style={styles.title}>New lead</Text>

      <Text style={styles.label}>Full name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('lead-name'))} />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>Company</Text>
      <TextInput style={styles.input} value={company} onChangeText={setCompany} {...locatorProps(testIds.raw('lead-company'))} />

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        {...locatorProps(testIds.raw('lead-email'))}
      />
      {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} {...locatorProps(testIds.raw('lead-phone'))} />

      <Text style={styles.label}>Status</Text>
      <SelectField
        value={status}
        options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => setStatus(v as LeadStatus)}
        testID="lead-status"
      />

      <Text style={styles.label}>Source</Text>
      <SelectField value={source} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} onChange={setSource} />

      <Text style={styles.label}>Interested product</Text>
      <SelectField
        value={productId}
        options={[{ value: '', label: 'No product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
        onChange={setProductId}
        testID="lead-product"
      />

      <Text style={styles.label}>Campaign</Text>
      <SelectField
        value={campaignId}
        options={[{ value: '', label: 'No campaign' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
        onChange={setCampaignId}
      />

      <Text style={styles.label}>Owner</Text>
      <SelectField value={ownerId} options={users.map((u) => ({ value: u.id, label: u.name }))} onChange={setOwnerId} />

      <Text style={styles.label}>Estimated value ($)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={valueText}
        onChangeText={setValueText}
        {...locatorProps(testIds.raw('lead-value'))}
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createLead.isPending}>
          <Text style={styles.primaryBtnText}>{createLead.isPending ? 'Creating…' : 'Create lead'}</Text>
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
