import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CampaignsStackParamList } from '../../navigation/types';
import { useCreateCampaign } from '../../api/hooks/useCampaigns';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { CampaignStatus, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<CampaignsStackParamList, 'campaignsForm'>;

export function CampaignFormScreen({ navigation }: Props) {
  const createCampaign = useCreateCampaign();

  const [name, setName] = useState('');
  const [channel, setChannel] = useState(CAMPAIGN_CHANNELS[0]);
  const [budgetText, setBudgetText] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [status, setStatus] = useState<CampaignStatus>('Planned');
  const [errors, setErrors] = useState<{ name?: string; budget?: string; endDate?: string }>({});

  const submit = async () => {
    const budget = Number(budgetText.replace(/[^0-9.]/g, ''));
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Campaign name is required.';
    if (!budgetText.trim() || !Number.isFinite(budget) || budget <= 0) errs.budget = 'Enter a valid budget greater than 0.';
    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) errs.endDate = 'End date must be after start date.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const campaign = await createCampaign.mutateAsync({
      name: name.trim(),
      channel,
      budget: Math.round(budget),
      startDate,
      endDate,
      status,
    });
    navigation.replace('campaignsDetail', { id: campaign.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('campaign-form'))}>
      <Text style={styles.title}>New campaign</Text>

      <Text style={styles.label}>Campaign name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('campaign-name'))} />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>Channel</Text>
      <SelectField
        value={channel}
        options={CAMPAIGN_CHANNELS.map((c) => ({ value: c, label: c }))}
        onChange={setChannel}
        testID="campaign-channel"
      />

      <Text style={styles.label}>Budget ($) *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 25000"
        keyboardType="decimal-pad"
        value={budgetText}
        onChangeText={setBudgetText}
        {...locatorProps(testIds.raw('campaign-budget'))}
      />
      {errors.budget ? <Text style={styles.error}>{errors.budget}</Text> : null}

      <Text style={styles.label}>Status</Text>
      <SelectField
        value={status}
        options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => setStatus(v as CampaignStatus)}
        testID="campaign-status"
      />

      <Text style={styles.label}>Start date</Text>
      <DatePickerField value={startDate} onChange={setStartDate} testID="campaign-start-date" />

      <Text style={styles.label}>End date</Text>
      <DatePickerField value={endDate} onChange={setEndDate} testID="campaign-end-date" />
      {errors.endDate ? <Text style={styles.error}>{errors.endDate}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createCampaign.isPending}>
          <Text style={styles.primaryBtnText}>{createCampaign.isPending ? 'Creating…' : 'Create campaign'}</Text>
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
