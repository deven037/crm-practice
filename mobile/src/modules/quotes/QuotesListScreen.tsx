import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QuotesStackParamList } from '../../navigation/types';
import { useQuotes } from '../../api/hooks/useQuotes';
import { useCollection } from '../../api/hooks/useCollection';
import { Spinner } from '../../components/Spinner';
import { Account, Product } from '../../types';
import { formatDate } from '../../utils';
import { computeQuoteTotals } from './quoteMath';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<QuotesStackParamList, 'quotesList'>;

export function QuotesListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useQuotes(query);
  const accountsQ = useCollection<Account>('accounts');
  const productsQ = useCollection<Product>('products');
  const quotes = data?.data ?? [];
  const accounts = accountsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  return (
    <View style={styles.container} {...locatorProps(testIds.page('quotes'))}>
      {/* Deliberately no testID — locate by placeholder text */}
      <TextInput style={styles.search} placeholder="Search quote number, account…" value={query} onChangeText={setQuery} />

      {isLoading ? (
        <Spinner label="Loading quotes…" />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No quotes match "{query}".</Text>}
          renderItem={({ item }) => {
            const { total } = computeQuoteTotals(item.lineItems);
            return (
              <Pressable style={styles.row} onPress={() => navigation.navigate('quotesDetail', { id: item.id })}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.quoteNumber}</Text>
                  <Text style={styles.rowSub}>
                    {accountName(item.accountId)} · {formatDate(item.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowEnd}>
                  <Text style={styles.rowValue}>${total.toFixed(2)}</Text>
                  <Text style={[styles.pill, statusStyle(item.status)]}>{item.status}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
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
  search: { margin: 16, marginBottom: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rowMain: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  rowValue: { fontWeight: '600' },
  pill: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pillDraft: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillSent: { backgroundColor: '#fef3c7', color: '#92400e' },
  pillAccepted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
  pillRejected: { backgroundColor: '#fee2e2', color: '#991b1b' },
  pillExpired: { backgroundColor: '#f3f4f6', color: '#6b7280' },
});
