import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../../navigation/types';
import { useDeleteLead, useLead, useUpdateLead } from '../../api/hooks/useLeads';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { Campaign, Lead, LEAD_SOURCES, LEAD_STATUSES, LeadStatus, Product, User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<LeadsStackParamList, 'leadsDetail'>;

export function LeadDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const usersQ = useCollection<User>('users');
  const productsQ = useCollection<Product>('products');
  const campaignsQ = useCollection<Campaign>('campaigns');
  const users = usersQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const campaigns = campaignsQ.data?.data ?? [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (lead) navigation.setOptions({ title: lead.name });
  }, [lead, navigation]);

  if (isLoading || !lead) return <Spinner label="Loading lead…" />;

  const ownerName = users.find((u) => u.id === lead.ownerId)?.name ?? '—';
  const product = products.find((p) => p.id === lead.productId);
  const campaign = campaigns.find((c) => c.id === lead.campaignId);

  const startEdit = () => {
    setDraft({ ...lead });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return;
    await updateLead.mutateAsync(draft);
    setEditing(false);
  };

  const confirmDelete = async () => {
    await deleteLead.mutateAsync(id);
    navigation.navigate('leadsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('lead-detail'))}>
      <View style={styles.header}>
        <Text style={[styles.statusPill, statusStyle(lead.status)]} {...locatorProps(testIds.raw('lead-detail-status'))}>
          {lead.status}
        </Text>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'lead'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => setDeleting(true)}
              {...locatorProps(testIds.action('delete', 'lead'))}
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
              disabled={updateLead.isPending}
              {...locatorProps(testIds.action('save', 'lead'))}
            >
              <Text style={styles.btnPrimaryText}>{updateLead.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {lead.status !== 'Converted' && (
        <Pressable
          style={styles.convertBtn}
          onPress={() => navigation.navigate('leadConvertWizard', { id: lead.id })}
          {...locatorProps(testIds.action('convert', 'lead'))}
        >
          <Text style={styles.convertBtnText}>🔄 Convert lead…</Text>
        </Pressable>
      )}

      {!editing ? (
        <View style={styles.card}>
          <Field label="Company" value={lead.company || '—'} />
          <Field label="Email" value={lead.email} />
          <Field label="Phone" value={lead.phone || '—'} />
          <Field label="Source" value={lead.source} />
          <Field label="Owner" value={ownerName} />
          <Field label="Estimated value" value={formatCurrency(lead.value)} />
          <Field label="Interested product" value={product?.name ?? '—'} />
          <Field label="Campaign" value={campaign?.name ?? '—'} />
          <Field label="Created" value={formatDate(lead.createdAt)} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Full name *</Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <Text style={styles.label}>Company</Text>
            <TextInput style={styles.input} value={draft.company} onChangeText={(v) => setDraft({ ...draft, company: v })} />
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} />
            <Text style={styles.label}>Status</Text>
            <SelectField
              value={draft.status}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, status: v as LeadStatus })}
            />
            <Text style={styles.label}>Source</Text>
            <SelectField
              value={draft.source}
              options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, source: v })}
            />
            <Text style={styles.label}>Interested product</Text>
            <SelectField
              value={draft.productId ?? ''}
              options={[{ value: '', label: 'No product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
              onChange={(v) => setDraft({ ...draft, productId: v || null })}
            />
            <Text style={styles.label}>Campaign</Text>
            <SelectField
              value={draft.campaignId ?? ''}
              options={[{ value: '', label: 'No campaign' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
              onChange={(v) => setDraft({ ...draft, campaignId: v || null })}
            />
            <Text style={styles.label}>Owner</Text>
            <SelectField
              value={draft.ownerId}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setDraft({ ...draft, ownerId: v })}
            />
            <Text style={styles.label}>Estimated value ($)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(draft.value)}
              onChangeText={(v) => setDraft({ ...draft, value: Number(v) || 0 })}
            />
          </View>
        )
      )}

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete lead — {lead.name}</Text>
            <Text>Delete "{lead.name}"? This cannot be undone.</Text>
            {lead.status === 'Converted' && (
              <View style={styles.banner} {...locatorProps(testIds.raw('converted-warning'))}>
                <Text style={styles.bannerText}>
                  This lead was already converted — the contact, account, and deal created from it will not be deleted.
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete lead</Text>
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

function statusStyle(status: string) {
  switch (status) {
    case 'Converted':
      return styles.pillConverted;
    case 'Qualified':
      return styles.pillQualified;
    case 'Unqualified':
      return styles.pillUnqualified;
    default:
      return styles.pillDefault;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  statusPill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillDefault: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillQualified: { backgroundColor: '#dcfce7', color: '#166534' },
  pillUnqualified: { backgroundColor: '#fee2e2', color: '#991b1b' },
  pillConverted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
  convertBtn: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 },
  convertBtnText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 12 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  banner: { backgroundColor: '#e0f2fe', borderRadius: 8, padding: 10 },
  bannerText: { color: '#075985', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
});
