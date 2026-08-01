import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { useCreateDeal } from '../../api/hooks/useDeals';
import { useCollection } from '../../api/hooks/useCollection';
import { useAuth } from '../../auth/AuthContext';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { Account, DealStage, DEAL_STAGES, User } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<DealsStackParamList, 'dealsForm'>;

export function DealFormScreen({ navigation }: Props) {
  const { user } = useAuth();
  const createDeal = useCreateDeal();
  const accountsQ = useCollection<Account>('accounts');
  const usersQ = useCollection<User>('users');
  const accounts = accountsQ.data?.data ?? [];
  const users = usersQ.data?.data ?? [];

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [stage, setStage] = useState<DealStage>('Qualification');
  const [closeDate, setCloseDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [ownerId, setOwnerId] = useState(user?.id ?? '');
  const [probabilityText, setProbabilityText] = useState('50');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Deal name is required.');
      return;
    }
    const amount = Math.round(Number(amountText.replace(/[^0-9.]/g, '')) || 0);
    const probability = Math.min(100, Math.max(0, Number(probabilityText) || 0));

    const deal = await createDeal.mutateAsync({
      name: name.trim(),
      accountId: accountId || null,
      amount,
      stage,
      closeDate,
      probability,
      ownerId: ownerId || user?.id || '',
    });
    navigation.replace('dealsDetail', { id: deal.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('deal-form'))}>
      <Text style={styles.title}>New deal</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Deal name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('deal-name'))} />

      <Text style={styles.label}>Account</Text>
      <SelectField
        value={accountId}
        options={[{ value: '', label: 'No account' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        onChange={setAccountId}
        testID="deal-account"
      />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 25000"
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={setAmountText}
        {...locatorProps(testIds.raw('deal-amount'))}
      />

      <Text style={styles.label}>Stage</Text>
      <SelectField
        value={stage}
        options={DEAL_STAGES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => setStage(v as DealStage)}
        testID="deal-stage"
      />

      <Text style={styles.label}>Expected close date</Text>
      <DatePickerField value={closeDate} onChange={setCloseDate} testID="deal-close-date" />

      <Text style={styles.label}>Owner</Text>
      <SelectField value={ownerId} options={users.map((u) => ({ value: u.id, label: u.name }))} onChange={setOwnerId} />

      <Text style={styles.label}>Win probability (%)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={probabilityText} onChangeText={setProbabilityText} />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createDeal.isPending}>
          <Text style={styles.primaryBtnText}>{createDeal.isPending ? 'Creating…' : 'Create deal'}</Text>
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
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});
