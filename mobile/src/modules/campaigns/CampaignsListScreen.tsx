import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CampaignsStackParamList } from '../../navigation/types';
import { useCampaigns } from '../../api/hooks/useCampaigns';
import { Spinner } from '../../components/Spinner';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<CampaignsStackParamList, 'campaignsList'>;

export function CampaignsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useCampaigns(query);
  const campaigns = data?.data ?? [];

  return (
    <View style={styles.container} {...locatorProps(testIds.page('campaigns'))}>
      {/* Deliberately no testID — locate by placeholder text */}
      <TextInput style={styles.search} placeholder="Search campaign name…" value={query} onChangeText={setQuery} />

      {isLoading ? (
        <Spinner label="Loading campaigns…" />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No campaigns match "{query}".</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('campaignsDetail', { id: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.channel} · {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={styles.rowValue}>{formatCurrency(item.budget)}</Text>
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
  pillPlanned: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillActive: { backgroundColor: '#dcfce7', color: '#166534' },
  pillCompleted: { backgroundColor: '#ede9fe', color: '#5b21b6' },
  pillCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
});
