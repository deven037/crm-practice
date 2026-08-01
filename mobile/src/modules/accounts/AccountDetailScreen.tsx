import { ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AccountsStackParamList } from '../../navigation/types';
import { useAccount, useDeleteAccount, useUpdateAccount } from '../../api/hooks/useAccounts';
import { apiFetch, ListEnvelope } from '../../api/client';
import { Spinner } from '../../components/Spinner';
import { Contact, Deal, Quote } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<AccountsStackParamList, 'accountsDetail'>;

export function AccountDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: account, isLoading } = useAccount(id);
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const contactsQ = useQuery({
    queryKey: ['contacts', 'byAccount', id],
    queryFn: () => apiFetch<ListEnvelope<Contact>>(`/contacts?accountId=${id}&pageSize=200`),
  });
  const dealsQ = useQuery({
    queryKey: ['deals', 'byAccount', id],
    queryFn: () => apiFetch<ListEnvelope<Deal>>(`/deals?accountId=${id}&pageSize=200`),
  });
  const quotesQ = useQuery({
    queryKey: ['quotes', 'byAccount', id],
    queryFn: () => apiFetch<ListEnvelope<Quote>>(`/quotes?accountId=${id}&pageSize=200`),
  });
  const contacts = contactsQ.data?.data ?? [];
  const deals = dealsQ.data?.data ?? [];
  const quotes = quotesQ.data?.data ?? [];
  const openDeals = deals.filter((d) => !d.stage.startsWith('Closed'));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ industry: string; employees: number; revenue: number; website: string; phone: string } | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [cascade, setCascade] = useState<'unlink' | 'cascade'>('unlink');
  const [openSection, setOpenSection] = useState<'contacts' | 'deals' | 'quotes' | null>('contacts');

  useEffect(() => {
    if (account) navigation.setOptions({ title: account.name });
  }, [account, navigation]);

  if (isLoading || !account) return <Spinner label="Loading account…" />;

  const startEdit = () => {
    setDraft({ industry: account.industry, employees: account.employees, revenue: account.revenue, website: account.website, phone: account.phone });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    await updateAccount.mutateAsync({ id: account.id, ...draft });
    setEditing(false);
  };

  const confirmDelete = async () => {
    await deleteAccount.mutateAsync({ id: account.id, cascade: cascade === 'cascade' });
    navigation.navigate('accountsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('account-detail'))}>
      <View style={styles.header}>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'account'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => setDeleting(true)}
              {...locatorProps(testIds.action('delete', 'account'))}
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
              disabled={updateAccount.isPending}
              {...locatorProps(testIds.action('save', 'account'))}
            >
              <Text style={styles.btnPrimaryText}>{updateAccount.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!editing ? (
        <View style={styles.card}>
          <Field label="Industry" value={account.industry} />
          <Field label="Employees" value={account.employees.toLocaleString()} />
          <Field label="Annual revenue" value={formatCurrency(account.revenue)} />
          <Field label="Phone" value={account.phone || '—'} />
          <Field label="Website" value={account.website || '—'} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Industry</Text>
            <TextInput style={styles.input} value={draft.industry} onChangeText={(v) => setDraft({ ...draft, industry: v })} />
            <Text style={styles.label}>Employees</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(draft.employees)}
              onChangeText={(v) => setDraft({ ...draft, employees: Number(v) || 0 })}
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} />
            <Text style={styles.label}>Website</Text>
            <TextInput style={styles.input} value={draft.website} onChangeText={(v) => setDraft({ ...draft, website: v })} />
          </View>
        )
      )}

      <Section
        title="Related contacts"
        badge={contacts.length}
        open={openSection === 'contacts'}
        onToggle={() => setOpenSection((s) => (s === 'contacts' ? null : 'contacts'))}
      >
        {contacts.length === 0 && <Text style={styles.muted}>No contacts linked to this account.</Text>}
        {contacts.map((c) => (
          <Text key={c.id} style={styles.relatedItem}>
            {c.name} <Text style={styles.muted}>— {c.title || 'No title'}</Text>
          </Text>
        ))}
      </Section>

      <Section
        title="Related deals"
        badge={deals.length}
        open={openSection === 'deals'}
        onToggle={() => setOpenSection((s) => (s === 'deals' ? null : 'deals'))}
      >
        {deals.length === 0 && <Text style={styles.muted}>No deals for this account.</Text>}
        {deals.map((d) => (
          <View key={d.id} style={styles.dealItem}>
            <Text style={styles.relatedItem}>
              {d.name} — {formatCurrency(d.amount)}
            </Text>
            <Text style={styles.muted}>
              {d.stage} · {d.probability}% · closes {formatDate(d.closeDate)}
            </Text>
          </View>
        ))}
      </Section>

      <Section
        title="Quotes"
        badge={quotes.length}
        open={openSection === 'quotes'}
        onToggle={() => setOpenSection((s) => (s === 'quotes' ? null : 'quotes'))}
      >
        {quotes.length === 0 && <Text style={styles.muted}>No quotes for this account.</Text>}
        {quotes.map((q) => (
          <Text key={q.id} style={styles.relatedItem}>
            {q.quoteNumber} <Text style={styles.muted}>— {q.status}</Text>
          </Text>
        ))}
      </Section>

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {openDeals.length > 0 ? (
              <>
                <Text style={styles.modalTitle}>Cannot delete account</Text>
                <View style={styles.bannerError} {...locatorProps(testIds.raw('delete-blocked-banner'))}>
                  <Text style={styles.bannerErrorText}>
                    This account has {openDeals.length} open deal(s). Close or delete them first.
                  </Text>
                </View>
                <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                  <Text>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Delete account — {account.name}</Text>
                <Text>
                  This account has {contacts.length} contact(s) and {deals.length} closed deal(s). What should happen to
                  them?
                </Text>
                <Pressable style={styles.radioOption} onPress={() => setCascade('unlink')}>
                  <Text style={cascade === 'unlink' ? styles.radioSelected : undefined}>◉ Keep them, but unlink from this account</Text>
                </Pressable>
                <Pressable style={styles.radioOption} onPress={() => setCascade('cascade')}>
                  <Text style={cascade === 'cascade' ? styles.radioSelected : undefined}>◉ Delete the related contacts and closed deals too</Text>
                </Pressable>
                <View style={styles.modalActions}>
                  <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                    <Text>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnDanger]}
                    onPress={confirmDelete}
                    {...locatorProps(testIds.raw('confirm-delete-btn'))}
                  >
                    <Text style={styles.btnDangerText}>Delete account</Text>
                  </Pressable>
                </View>
              </>
            )}
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

function Section({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <Text style={styles.sectionTitle}>
          {title} <Text style={styles.sectionBadge}>{badge}</Text>
        </Text>
        <Text style={styles.sectionCaret}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 12, marginBottom: 16 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  label: { fontSize: 13, color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  section: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  sectionTitle: { fontWeight: '700', fontSize: 14 },
  sectionBadge: { color: '#6b7280', fontWeight: '400' },
  sectionCaret: { color: '#9ca3af' },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  relatedItem: { fontSize: 14 },
  dealItem: { gap: 2 },
  muted: { color: '#9ca3af', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  bannerError: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 },
  bannerErrorText: { color: '#991b1b', fontSize: 13 },
  radioOption: { paddingVertical: 6 },
  radioSelected: { color: '#2563eb', fontWeight: '600' },
});
