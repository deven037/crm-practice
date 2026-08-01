import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductsStackParamList } from '../../navigation/types';
import { useProducts } from '../../api/hooks/useProducts';
import { Spinner } from '../../components/Spinner';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ProductsStackParamList, 'productsList'>;

export function ProductsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useProducts(query);
  const products = data?.data ?? [];

  return (
    <View style={styles.container} {...locatorProps(testIds.page('products'))}>
      {/* Deliberately no testID — locate by placeholder text */}
      <TextInput
        style={styles.search}
        placeholder="Search name, SKU, category…"
        value={query}
        onChangeText={setQuery}
      />

      {isLoading ? (
        <Spinner label="Loading products…" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No products match "{query}".</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('productsDetail', { id: item.id })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.sku} · {item.category} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
                <Text style={[styles.pill, item.active ? styles.pillActive : styles.pillInactive]}>
                  {item.active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  search: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
  rowSub: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  rowPrice: { fontWeight: '600' },
  pill: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pillActive: { backgroundColor: '#dcfce7', color: '#166534' },
  pillInactive: { backgroundColor: '#f3f4f6', color: '#6b7280' },
});
