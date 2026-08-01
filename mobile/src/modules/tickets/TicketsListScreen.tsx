import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TicketsStackParamList } from '../../navigation/types';
import { useTickets } from '../../api/hooks/useTickets';
import { Spinner } from '../../components/Spinner';
import { formatDate, isOverdue } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<TicketsStackParamList, 'ticketsList'>;

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function TicketsListScreen({ navigation }: Props) {
  const { data, isLoading, isRefetching, refetch } = useTickets();
  const [statusFilter, setStatusFilter] = useState('All');
  const tickets = data?.data ?? [];

  const visible = useMemo(
    () => (statusFilter === 'All' ? tickets : tickets.filter((t) => t.status === statusFilter)),
    [tickets, statusFilter]
  );

  return (
    <View style={styles.container} {...locatorProps(testIds.page('tickets'))}>
      <View style={styles.chipRow}>
        {STATUS_FILTERS.map((s) => (
          <Pressable key={s} style={[styles.chip, statusFilter === s && styles.chipActive]} onPress={() => setStatusFilter(s)}>
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <Spinner label="Loading tickets…" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No tickets match this filter.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('ticketsDetail', { id: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.subject}</Text>
                <Text style={styles.rowSub}>
                  {item.requester} · {item.priority} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={[styles.pill, statusStyle(item.status)]}>{item.status}</Text>
                {isOverdue(item.slaDue) && (item.status === 'Open' || item.status === 'In Progress') ? (
                  <Text style={styles.overdue}>SLA overdue</Text>
                ) : null}
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
    case 'Open':
      return styles.pillOpen;
    case 'In Progress':
      return styles.pillProgress;
    case 'Resolved':
      return styles.pillResolved;
    default:
      return styles.pillClosed;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
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
  pill: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pillOpen: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillProgress: { backgroundColor: '#fef3c7', color: '#92400e' },
  pillResolved: { backgroundColor: '#dcfce7', color: '#166534' },
  pillClosed: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  overdue: { fontSize: 10, color: '#dc2626', fontWeight: '600' },
});
