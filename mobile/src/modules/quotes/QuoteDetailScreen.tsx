import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QuotesStackParamList } from '../../navigation/types';
import { useDeleteQuote, useQuote, useTransitionQuote, useUpdateQuote } from '../../api/hooks/useQuotes';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { Spinner } from '../../components/Spinner';
import { QuoteLineItemsEditor, QuoteLineItemsView } from './QuoteLineItems';
import { Account, Deal, Product, Quote, QuoteStatus, QUOTE_TRANSITIONS } from '../../types';
import { formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<QuotesStackParamList, 'quotesDetail'>;

export function QuoteDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: quote, isLoading } = useQuote(id);
  const updateQuote = useUpdateQuote();
  const transitionQuote = useTransitionQuote();
  const deleteQuote = useDeleteQuote();
  const accountsQ = useCollection<Account>('accounts');
  const dealsQ = useCollection<Deal>('deals');
  const productsQ = useCollection<Product>('products');
  const accounts = accountsQ.data?.data ?? [];
  const allDeals = dealsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dealAlreadyClosedNote, setDealAlreadyClosedNote] = useState(false);

  useEffect(() => {
    if (quote) navigation.setOptions({ title: quote.quoteNumber });
  }, [quote, navigation]);

  const accountDeals = useMemo(
    () => allDeals.filter((d) => d.accountId === (draft?.accountId ?? quote?.accountId)),
    [allDeals, draft?.accountId, quote?.accountId]
  );

  if (isLoading || !quote) return <Spinner label="Loading quote…" />;

  const account = accounts.find((a) => a.id === quote.accountId);
  const linkedDeal = allDeals.find((d) => d.id === quote.dealId);

  const startEdit = () => {
    setDraft({ ...quote });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    await updateQuote.mutateAsync(draft);
    setEditing(false);
  };

  const transition = async (next: QuoteStatus) => {
    const result = await transitionQuote.mutateAsync({ id: quote.id, status: next });
    if (next === 'Accepted' && quote.dealId) {
      setDealAlreadyClosedNote(!result.deal);
    }
  };

  const confirmDelete = async () => {
    await deleteQuote.mutateAsync(id);
    navigation.navigate('quotesList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('quote-detail'))}>
      <View style={styles.header}>
        <Text style={[styles.statusPill, statusStyle(quote.status)]} {...locatorProps(testIds.raw('quote-status'))}>
          {quote.status}
        </Text>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'quote'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => setDeleting(true)}
              {...locatorProps(testIds.action('delete', 'quote'))}
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
              disabled={updateQuote.isPending}
              {...locatorProps(testIds.action('save', 'quote'))}
            >
              <Text style={styles.btnPrimaryText}>{updateQuote.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!editing ? (
        <View style={styles.card}>
          <Field label="Account" value={account?.name ?? '—'} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Linked deal</Text>
            <Text style={styles.fieldValue}>
              {linkedDeal?.name ?? '—'}
              {dealAlreadyClosedNote ? ' — this quote\'s linked deal was already closed when accepted.' : ''}
            </Text>
          </View>
          <Field label="Valid until" value={formatDate(quote.validUntil)} />
          <Field label="Created" value={formatDate(quote.createdAt)} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Account</Text>
            <SelectField
              value={draft.accountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              onChange={(v) => setDraft({ ...draft, accountId: v, dealId: null })}
            />
            <Text style={styles.label}>Linked deal</Text>
            <SelectField
              value={draft.dealId ?? ''}
              options={[{ value: '', label: 'No deal (optional)' }, ...accountDeals.map((d) => ({ value: d.id, label: d.name }))]}
              onChange={(v) => setDraft({ ...draft, dealId: v || null })}
            />
            <Text style={styles.label}>Valid until</Text>
            <DatePickerField value={draft.validUntil} onChange={(iso) => setDraft({ ...draft, validUntil: iso })} />
          </View>
        )
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Line items</Text>
        {!editing ? (
          <QuoteLineItemsView lineItems={quote.lineItems} products={products} />
        ) : (
          draft && (
            <QuoteLineItemsEditor
              lineItems={draft.lineItems}
              onChange={(items) => setDraft({ ...draft, lineItems: items })}
              products={products}
            />
          )
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.muted}>Move to:</Text>
        <View style={styles.transitionRow}>
          {QUOTE_TRANSITIONS[quote.status].map((next) => (
            <Pressable key={next} style={styles.btn} onPress={() => transition(next)}>
              <Text>{next}</Text>
            </Pressable>
          ))}
          {QUOTE_TRANSITIONS[quote.status].length === 0 && (
            <Text style={styles.muted}>No further transitions (terminal status).</Text>
          )}
        </View>
      </View>

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete quote — {quote.quoteNumber}</Text>
            <Text>Delete "{quote.quoteNumber}"? This cannot be undone.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete quote</Text>
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
    case 'Sent':
      return styles.pillSent;
    case 'Accepted':
      return styles.pillAccepted;
    case 'Rejected':
      return styles.pillRejected;
    case 'Expired':
      return styles.pillExpired;
    default:
      return styles.pillDraft;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  statusPill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillDraft: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillSent: { backgroundColor: '#fef3c7', color: '#92400e' },
  pillAccepted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
  pillRejected: { backgroundColor: '#fee2e2', color: '#991b1b' },
  pillExpired: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 10, marginBottom: 16 },
  cardTitle: { fontWeight: '700', fontSize: 14, marginBottom: 4 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  label: { fontSize: 13, color: '#374151', marginTop: 8, marginBottom: 4 },
  muted: { color: '#9ca3af', fontSize: 12 },
  transitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
