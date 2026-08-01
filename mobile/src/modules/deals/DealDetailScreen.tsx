import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { useDeal, useDeleteDeal, useUpdateDeal } from '../../api/hooks/useDeals';
import { useCollection } from '../../api/hooks/useCollection';
import { apiFetch, ListEnvelope } from '../../api/client';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { Spinner } from '../../components/Spinner';
import { Account, Deal, DealStage, DEAL_STAGES, Quote, User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<DealsStackParamList, 'dealsDetail'>;

export function DealDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: deal, isLoading } = useDeal(id);
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const accountsQ = useCollection<Account>('accounts');
  const usersQ = useCollection<User>('users');
  const accounts = accountsQ.data?.data ?? [];
  const users = usersQ.data?.data ?? [];

  const linkedQuoteQ = useQuery({
    queryKey: ['quotes', 'byDeal', id],
    queryFn: () => apiFetch<ListEnvelope<Quote>>(`/quotes?dealId=${id}&pageSize=1`),
  });
  const linkedQuote = linkedQuoteQ.data?.data?.[0];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (deal) navigation.setOptions({ title: deal.name });
  }, [deal, navigation]);

  if (isLoading || !deal) return <Spinner label="Loading deal…" />;

  const account = accounts.find((a) => a.id === deal.accountId);
  const ownerName = users.find((u) => u.id === deal.ownerId)?.name ?? '—';

  const startEdit = () => {
    setDraft({ ...deal });
    setEditing(true);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    await updateDeal.mutateAsync(draft);
    setEditing(false);
  };

  const confirmDelete = async () => {
    await deleteDeal.mutateAsync({ id, confirm: deal.stage === 'Closed Won' });
    navigation.navigate('dealsBoard');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('deal-detail'))}>
      <View style={styles.header}>
        <Text style={styles.stagePill} {...locatorProps(testIds.raw('deal-detail-stage'))}>
          {deal.stage}
        </Text>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'deal'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                setConfirmText('');
                setDeleting(true);
              }}
              {...locatorProps(testIds.action('delete', 'deal'))}
            >
              <Text style={styles.btnDangerText}>🗑 Delete</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={() => setEditing(false)}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={save}
              disabled={updateDeal.isPending}
              {...locatorProps(testIds.action('save', 'deal'))}
            >
              <Text style={styles.btnPrimaryText}>{updateDeal.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!editing ? (
        <View style={styles.card}>
          <Field label="Account" value={account?.name ?? '—'} />
          <Field label="Amount" value={formatCurrency(deal.amount)} />
          <Field label="Stage" value={deal.stage} />
          <Field label="Win probability" value={`${deal.probability}%`} />
          <Field label="Expected close" value={formatDate(deal.closeDate)} />
          <Field label="Owner" value={ownerName} />
          <Field label="Created" value={formatDate(deal.createdAt)} />
          <Field label="Linked quote" value={linkedQuote?.quoteNumber ?? '—'} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Deal name *</Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <Text style={styles.label}>Account</Text>
            <SelectField
              value={draft.accountId ?? ''}
              options={[{ value: '', label: 'No account' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              onChange={(v) => setDraft({ ...draft, accountId: v || null })}
            />
            <Text style={styles.label}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(draft.amount)}
              onChangeText={(v) => setDraft({ ...draft, amount: Number(v) || 0 })}
            />
            <Text style={styles.label}>Stage</Text>
            <SelectField
              value={draft.stage}
              options={DEAL_STAGES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, stage: v as DealStage })}
            />
            <Text style={styles.label}>Expected close date</Text>
            <DatePickerField value={draft.closeDate} onChange={(iso) => setDraft({ ...draft, closeDate: iso })} />
            <Text style={styles.label}>Win probability (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(draft.probability)}
              onChangeText={(v) => setDraft({ ...draft, probability: Math.min(100, Math.max(0, Number(v) || 0)) })}
            />
          </View>
        )
      )}

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete deal — {deal.name}</Text>
            {deal.stage === 'Closed Won' ? (
              <>
                <View style={styles.bannerError} {...locatorProps(testIds.raw('closed-won-warning'))}>
                  <Text style={styles.bannerErrorText}>
                    This deal is Closed Won — deleting it removes {formatCurrency(deal.amount)} from won revenue and
                    your dashboard history.
                  </Text>
                </View>
                <Text style={styles.label}>Type DELETE to confirm</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DELETE"
                  value={confirmText}
                  onChangeText={setConfirmText}
                  {...locatorProps(testIds.raw('delete-confirm-input'))}
                />
              </>
            ) : (
              <Text>
                Delete "{deal.name}" ({formatCurrency(deal.amount)}, {deal.stage})? This cannot be undone.
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                disabled={deal.stage === 'Closed Won' && confirmText !== 'DELETE'}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete deal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  stagePill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#e0f2fe', color: '#075985', overflow: 'hidden' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 12 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  label: { fontSize: 13, color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  bannerError: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 },
  bannerErrorText: { color: '#991b1b', fontSize: 13 },
});
