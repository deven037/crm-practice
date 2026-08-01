import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QuotesStackParamList } from '../../navigation/types';
import { useCreateQuote } from '../../api/hooks/useQuotes';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { DatePickerField } from '../../components/DatePickerField';
import { QuoteLineItemsEditor } from './QuoteLineItems';
import { Account, Deal, Product, QuoteLineItem } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<QuotesStackParamList, 'quotesForm'>;

export function QuoteFormScreen({ navigation }: Props) {
  const createQuote = useCreateQuote();
  const accountsQ = useCollection<Account>('accounts');
  const productsQ = useCollection<Product>('products');
  const dealsQ = useCollection<Deal>('deals');
  const accounts = accountsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const allDeals = dealsQ.data?.data ?? [];

  const [accountId, setAccountId] = useState('');
  const [dealId, setDealId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Cascading select: options scoped to the chosen account; changing the account resets
  // dealId in the same update, so a stale deal from a different account can't be submitted
  // (deliberate trap — see mobile/LOCATORS.md).
  const accountDeals = useMemo(() => allDeals.filter((d) => d.accountId === accountId), [allDeals, accountId]);

  const submit = async () => {
    if (!accountId) {
      setError('Account is required.');
      return;
    }
    const validItems = lineItems.filter((li) => li.productId && li.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item with a product and a quantity greater than 0.');
      return;
    }
    setError(null);

    const quote = await createQuote.mutateAsync({
      quoteNumber: quoteNumber.trim() || undefined,
      accountId,
      dealId: dealId || null,
      lineItems: validItems,
      status: 'Draft',
      validUntil,
    });
    navigation.replace('quotesDetail', { id: quote.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('quote-form'))}>
      <Text style={styles.title}>New quote</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Account *</Text>
      <SelectField
        value={accountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(v) => {
          setAccountId(v);
          setDealId('');
        }}
        testID="quote-account"
      />

      <Text style={styles.label}>Linked deal</Text>
      <SelectField
        value={dealId}
        options={[{ value: '', label: 'No deal (optional)' }, ...accountDeals.map((d) => ({ value: d.id, label: d.name }))]}
        onChange={setDealId}
        testID="quote-deal"
      />

      <Text style={styles.label}>Quote number</Text>
      <TextInput
        style={styles.input}
        placeholder="Auto-generated if left empty"
        value={quoteNumber}
        onChangeText={setQuoteNumber}
        {...locatorProps(testIds.raw('quote-number'))}
      />

      <Text style={styles.label}>Valid until</Text>
      <DatePickerField value={validUntil} onChange={setValidUntil} testID="quote-valid-until" />

      <Text style={styles.sectionTitle}>Line items</Text>
      <QuoteLineItemsEditor lineItems={lineItems} onChange={setLineItems} products={products} />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createQuote.isPending}>
          <Text style={styles.primaryBtnText}>{createQuote.isPending ? 'Creating…' : 'Create quote'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});
