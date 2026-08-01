import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../../navigation/types';
import { useLeads } from '../../api/hooks/useLeads';
import { useCollection } from '../../api/hooks/useCollection';
import { Spinner } from '../../components/Spinner';
import { User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';
import { shareCsv } from '../../utils/csvShare';

type Props = NativeStackScreenProps<LeadsStackParamList, 'leadsList'>;

export function LeadsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useLeads(query);
  const usersQ = useCollection<User>('users');
  const leads = data?.data ?? [];
  const users = usersQ.data?.data ?? [];

  const ownerName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (id: string) => map.get(id) ?? '—';
  }, [users]);

  const exportCsv = () => {
    shareCsv('leads-export.csv', [
      ['Name', 'Company', 'Email', 'Phone', 'Status', 'Source', 'Owner', 'Value', 'Created'],
      ...leads.map((l) => [l.name, l.company, l.email, l.phone, l.status, l.source, ownerName(l.ownerId), l.value, formatDate(l.createdAt)]),
    ]);
  };

  return (
    <View style={styles.container} {...locatorProps(testIds.page('leads'))}>
      <View style={styles.toolbar}>
        {/* Deliberately no testID — locate by placeholder text */}
        <TextInput style={styles.search} placeholder="Search name, company, email…" value={query} onChangeText={setQuery} />
        <Pressable style={styles.exportBtn} onPress={exportCsv} {...locatorProps(testIds.raw('export-csv-btn'))}>
          <Text style={styles.exportBtnText}>⬇ Export</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Spinner label="Loading leads…" />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No leads match the current search.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('leadsDetail', { id: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.company} · {item.email}
                </Text>
                <Text style={styles.rowSub}>
                  {ownerName(item.ownerId)} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={styles.rowValue}>{formatCurrency(item.value)}</Text>
                <Text style={[styles.pill, statusStyle(item.status)]}>{item.status}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
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
  toolbar: { flexDirection: 'row', gap: 8, padding: 16, alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  exportBtnText: { fontWeight: '600' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rowMain: { flex: 1, paddingRight: 8, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280', fontSize: 12 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  rowValue: { fontWeight: '600' },
  pill: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pillDefault: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillQualified: { backgroundColor: '#dcfce7', color: '#166534' },
  pillUnqualified: { backgroundColor: '#fee2e2', color: '#991b1b' },
  pillConverted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
});
