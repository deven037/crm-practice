import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../../navigation/types';
import { useConvertLead, useLead } from '../../api/hooks/useLeads';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { Account, DealStage, DEAL_STAGES } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<LeadsStackParamList, 'leadConvertWizard'>;

export function LeadConvertWizard({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: lead, isLoading } = useLead(id);
  const accountsQ = useCollection<Account>('accounts');
  const convertLead = useConvertLead();
  const accounts = accountsQ.data?.data ?? [];

  const [step, setStep] = useState(1);
  const [contactName, setContactName] = useState(lead?.name ?? '');
  const [contactEmail, setContactEmail] = useState(lead?.email ?? '');
  const [contactPhone, setContactPhone] = useState(lead?.phone ?? '');
  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [accountName, setAccountName] = useState(lead?.company ?? '');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [createDeal, setCreateDeal] = useState(false);
  const [dealName, setDealName] = useState(lead ? `${lead.company} New Business` : '');
  const [dealAmount, setDealAmount] = useState(String(lead?.value ?? 0));
  const [dealStage, setDealStage] = useState<DealStage>('Qualification');

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !lead) return;
    hydrated.current = true;
    setContactName(lead.name);
    setContactEmail(lead.email);
    setContactPhone(lead.phone);
    setAccountName(lead.company);
    setDealName(`${lead.company} New Business`);
    setDealAmount(String(lead.value));
  }, [lead]);

  if (isLoading || !lead) return <Spinner label="Loading lead…" />;

  const finish = async () => {
    await convertLead.mutateAsync({
      id: lead.id,
      accountMode,
      existingAccountId: accountMode === 'existing' ? existingAccountId : undefined,
      accountName: accountMode === 'new' ? accountName : undefined,
      contactName,
      contactEmail,
      contactPhone,
      createDeal,
      dealName: createDeal ? dealName : undefined,
      dealAmount: createDeal ? Number(dealAmount) || 0 : undefined,
      dealStage: createDeal ? dealStage : undefined,
    });
    navigation.navigate('leadsDetail', { id: lead.id });
  };

  const canGoNext = !(step === 2 && accountMode === 'existing' && !existingAccountId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Convert lead — Step {step} of 3</Text>
      <View style={styles.stepsRow}>
        {['Contact', 'Account', 'Deal'].map((label, i) => (
          <Text key={label} style={[styles.stepPill, step === i + 1 && styles.stepPillActive]}>
            {i + 1}. {label}
          </Text>
        ))}
      </View>

      {step === 1 && (
        <View>
          <Text style={styles.label}>Contact name</Text>
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName} />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} />
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.label}>Account</Text>
          <View style={styles.radioRow}>
            <Pressable style={styles.radioOption} onPress={() => setAccountMode('new')}>
              <Text style={accountMode === 'new' ? styles.radioSelected : undefined}>◉ Create new account</Text>
            </Pressable>
            <Pressable style={styles.radioOption} onPress={() => setAccountMode('existing')}>
              <Text style={accountMode === 'existing' ? styles.radioSelected : undefined}>◉ Link existing account</Text>
            </Pressable>
          </View>
          {accountMode === 'new' ? (
            <>
              <Text style={styles.label}>Account name</Text>
              <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Existing account</Text>
              <SelectField
                value={existingAccountId}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                onChange={setExistingAccountId}
              />
            </>
          )}
        </View>
      )}

      {step === 3 && (
        <View>
          <View style={styles.switchRow}>
            <Switch value={createDeal} onValueChange={setCreateDeal} />
            <Text>Also create a deal for this conversion</Text>
          </View>
          {createDeal && (
            <>
              <Text style={styles.label}>Deal name</Text>
              <TextInput style={styles.input} value={dealName} onChangeText={setDealName} />
              <Text style={styles.label}>Amount ($)</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={dealAmount} onChangeText={setDealAmount} />
              <Text style={styles.label}>Stage</Text>
              <SelectField
                value={dealStage}
                options={DEAL_STAGES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => setDealStage(v as DealStage)}
              />
            </>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {step > 1 && (
          <Pressable style={styles.btn} onPress={() => setStep((s) => s - 1)}>
            <Text>‹ Back</Text>
          </Pressable>
        )}
        {step < 3 ? (
          <Pressable style={[styles.btn, styles.btnPrimary]} disabled={!canGoNext} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.btnPrimaryText}>Next ›</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={finish}
            disabled={convertLead.isPending}
            {...locatorProps(testIds.raw('wizard-finish'))}
          >
            <Text style={styles.btnPrimaryText}>{convertLead.isPending ? 'Converting…' : 'Finish conversion'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  stepsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stepPill: { fontSize: 12, color: '#9ca3af', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#f3f4f6' },
  stepPillActive: { color: '#2563eb', backgroundColor: '#eff6ff', fontWeight: '700' },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  radioRow: { gap: 8, marginTop: 4 },
  radioOption: { paddingVertical: 8 },
  radioSelected: { color: '#2563eb', fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
});
