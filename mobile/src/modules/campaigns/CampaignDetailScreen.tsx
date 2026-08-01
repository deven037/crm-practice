import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CampaignsStackParamList } from '../../navigation/types';
import { useCampaign, useDeleteCampaign, useUpdateCampaign } from '../../api/hooks/useCampaigns';
import { apiFetch, ListEnvelope } from '../../api/client';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { Spinner } from '../../components/Spinner';
import { Campaign, CampaignStatus, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, Deal, Lead } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<CampaignsStackParamList, 'campaignsDetail'>;

export function CampaignDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: campaign, isLoading } = useCampaign(id);
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const leadsQ = useQuery({
    queryKey: ['leads', 'byCampaign', id],
    queryFn: () => apiFetch<ListEnvelope<Lead>>(`/leads?campaignId=${id}&pageSize=200`),
  });
  const dealsQ = useQuery({
    queryKey: ['deals', 'byCampaign', id],
    queryFn: () => apiFetch<ListEnvelope<Deal>>(`/deals?campaignId=${id}&pageSize=200`),
  });
  const leads = leadsQ.data?.data ?? [];
  const deals = dealsQ.data?.data ?? [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (campaign) navigation.setOptions({ title: campaign.name });
  }, [campaign, navigation]);

  if (isLoading || !campaign) return <Spinner label="Loading campaign…" />;

  const wonRevenue = deals.filter((d) => d.stage === 'Closed Won').reduce((sum, d) => sum + d.amount, 0);
  const roi = campaign.budget > 0 ? (wonRevenue / campaign.budget) * 100 : null;
  const hasDependents = leads.length > 0 || deals.length > 0;

  const startEdit = () => {
    setDraft({ ...campaign });
    setEditing(true);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    await updateCampaign.mutateAsync(draft);
    setEditing(false);
  };

  const confirmDelete = async () => {
    await deleteCampaign.mutateAsync(id);
    navigation.navigate('campaignsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('campaign-detail'))}>
      <View style={styles.header}>
        <Text style={[styles.statusPill, statusStyle(campaign.status)]} {...locatorProps(testIds.raw('campaign-status'))}>
          {campaign.status}
        </Text>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'campaign'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                setConfirmName('');
                setDeleting(true);
              }}
              {...locatorProps(testIds.action('delete', 'campaign'))}
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
              disabled={updateCampaign.isPending}
              {...locatorProps(testIds.action('save', 'campaign'))}
            >
              <Text style={styles.btnPrimaryText}>{updateCampaign.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!editing ? (
        <View style={styles.card}>
          <Field label="Channel" value={campaign.channel} />
          <Field label="Budget" value={formatCurrency(campaign.budget)} />
          <Field label="Start date" value={formatDate(campaign.startDate)} />
          <Field label="End date" value={formatDate(campaign.endDate)} />
          <Field label="Created" value={formatDate(campaign.createdAt)} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Campaign name *</Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <Text style={styles.label}>Channel</Text>
            <SelectField
              value={draft.channel}
              options={CAMPAIGN_CHANNELS.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setDraft({ ...draft, channel: v })}
            />
            <Text style={styles.label}>Budget ($)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(draft.budget)}
              onChangeText={(v) => setDraft({ ...draft, budget: Number(v) || 0 })}
            />
            <Text style={styles.label}>Status</Text>
            <SelectField
              value={draft.status}
              options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, status: v as CampaignStatus })}
            />
            <Text style={styles.label}>Start date</Text>
            <DatePickerField value={draft.startDate} onChange={(iso) => setDraft({ ...draft, startDate: iso })} />
            <Text style={styles.label}>End date</Text>
            <DatePickerField value={draft.endDate} onChange={(iso) => setDraft({ ...draft, endDate: iso })} />
          </View>
        )
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Return on investment</Text>
        <Field label="Won revenue (from converted leads)" value={formatCurrency(wonRevenue)} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ROI</Text>
          <Text style={styles.fieldValue} {...locatorProps(testIds.raw('campaign-roi'))}>
            {roi === null ? '— (no budget set)' : `${roi.toFixed(1)}%`}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Leads generated ({leads.length})</Text>
        </View>
        {leads.length === 0 ? (
          <Text style={styles.muted}>No leads yet for this campaign.</Text>
        ) : (
          leads.map((lead) => (
            <Text key={lead.id} style={styles.relatedItem}>
              {lead.name} <Text style={styles.muted}>— {lead.company} · {lead.status}</Text>
            </Text>
          ))
        )}
      </View>

      {deals.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deals attributed ({deals.length})</Text>
          {deals.map((deal) => (
            <Text key={deal.id} style={styles.relatedItem}>
              {deal.name} <Text style={styles.muted}>— {formatCurrency(deal.amount)} · {deal.stage}</Text>
            </Text>
          ))}
        </View>
      )}

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete campaign — {campaign.name}</Text>
            {!hasDependents ? (
              <Text>Delete "{campaign.name}"? This cannot be undone.</Text>
            ) : (
              <>
                <View style={styles.bannerError}>
                  <Text style={styles.bannerErrorText}>
                    {leads.length} lead(s) and {deals.length} deal(s) reference this campaign. Deleting it will unlink
                    the campaign from those records — they are kept.
                  </Text>
                </View>
                <Text style={styles.label}>Type the campaign name to confirm</Text>
                <TextInput
                  style={styles.input}
                  placeholder={campaign.name}
                  value={confirmName}
                  onChangeText={setConfirmName}
                  {...locatorProps(testIds.raw('delete-confirm-input'))}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                disabled={hasDependents && confirmName !== campaign.name}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete campaign</Text>
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
    case 'Active':
      return styles.pillActive;
    case 'Completed':
      return styles.pillCompleted;
    case 'Cancelled':
      return styles.pillCancelled;
    default:
      return styles.pillPlanned;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  statusPill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillPlanned: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillActive: { backgroundColor: '#dcfce7', color: '#166534' },
  pillCompleted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
  pillCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 10, marginBottom: 16 },
  cardTitle: { fontWeight: '700', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  muted: { color: '#9ca3af', fontSize: 12 },
  relatedItem: { fontSize: 14, marginBottom: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  bannerError: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 },
  bannerErrorText: { color: '#991b1b', fontSize: 13 },
});
