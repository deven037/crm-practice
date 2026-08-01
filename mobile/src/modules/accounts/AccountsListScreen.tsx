import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AccountsStackParamList } from '../../navigation/types';
import { useAccounts } from '../../api/hooks/useAccounts';
import { Spinner } from '../../components/Spinner';
import { formatCurrency } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<AccountsStackParamList, 'accountsList'>;

export function AccountsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useAccounts(query);
  const accounts = data?.data ?? [];

  return (
    <View style={styles.container} {...locatorProps(testIds.page('accounts'))}>
      {/* Deliberately no testID — locate by placeholder text */}
      <TextInput style={styles.search} placeholder="Search account name…" value={query} onChangeText={setQuery} />

      {isLoading ? (
        <Spinner label="Loading accounts…" />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No accounts match "{query}".</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('accountsDetail', { id: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.industry} · {item.employees.toLocaleString()} employees
                </Text>
              </View>
              <Text style={styles.rowValue}>{formatCurrency(item.revenue)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  search: { margin: 16, marginBottom: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rowMain: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  rowValue: { fontWeight: '600' },
});
