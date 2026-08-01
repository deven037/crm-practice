import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { useDeals, useUpdateDeal } from '../../api/hooks/useDeals';
import { useCollection } from '../../api/hooks/useCollection';
import { Spinner } from '../../components/Spinner';
import { Account, Deal, DealStage, DEAL_STAGES } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<DealsStackParamList, 'dealsBoard'>;

/**
 * One stage visible at a time (switched via the tab row) rather than a side-scrolling
 * multi-column board — nesting a horizontal ScrollView of columns around per-column
 * vertical DraggableFlatLists is a known source of gesture conflicts (horizontal scroll
 * vs. vertical drag fighting for the same touch) that's hard to verify without a device in
 * hand. This still delivers the same two automation-practice gestures: drag-reorder within
 * a stage (unlabeled handle, a deliberate trap — see mobile/LOCATORS.md) and a long-press
 * "Move to stage…" picker for moving a card between stages.
 */
export function DealsBoardScreen({ navigation }: Props) {
  const { data, isLoading } = useDeals();
  const updateDeal = useUpdateDeal();
  const accountsQ = useCollection<Account>('accounts');
  const accounts = accountsQ.data?.data ?? [];
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? 'No account';

  const [stage, setStage] = useState<DealStage>('Qualification');
  const [columnDeals, setColumnDeals] = useState<Deal[]>([]);
  const [movingDeal, setMovingDeal] = useState<Deal | null>(null);

  const allDeals = data?.data ?? [];

  useEffect(() => {
    setColumnDeals(allDeals.filter((d) => d.stage === stage));
    // Re-derive whenever the underlying data or selected stage changes; local reorder
    // state is just a display concern (Deal has no persisted `order` field, unlike Tasks).
  }, [allDeals, stage]);

  if (isLoading) return <Spinner label="Loading deals…" />;

  const stageTotal = (s: DealStage) => allDeals.filter((d) => d.stage === s).reduce((sum, d) => sum + d.amount, 0);
  const stageCount = (s: DealStage) => allDeals.filter((d) => d.stage === s).length;

  const moveToStage = async (deal: Deal, newStage: DealStage) => {
    setMovingDeal(null);
    await updateDeal.mutateAsync({ ...deal, stage: newStage });
  };

  const renderCard = ({ item, drag, isActive }: RenderItemParams<Deal>) => (
    <ScaleDecorator>
      <Pressable
        style={[styles.card, isActive && styles.cardActive]}
        onPress={() => navigation.navigate('dealsDetail', { id: item.id })}
        onLongPress={() => setMovingDeal(item)}
        delayLongPress={350}
      >
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{accountName(item.accountId)}</Text>
          <View style={styles.cardFoot}>
            <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.cardProb}>{item.probability}%</Text>
          </View>
          <Text style={styles.cardDate}>Close: {formatDate(item.closeDate)}</Text>
        </View>
        {/* Deliberately no testID/accessibilityLabel on the drag handle — must be located
            by long-press + drag gesture, not a locator, mirroring the web Kanban's trap. */}
        <Pressable onPressIn={drag} style={styles.dragHandle} hitSlop={10}>
          <Text style={styles.dragHandleText}>⠿</Text>
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container} {...locatorProps(testIds.raw('kanban-board'))}>
      <View style={styles.tabRow}>
        {DEAL_STAGES.map((s) => (
          <Pressable key={s} style={[styles.tab, stage === s && styles.tabActive]} onPress={() => setStage(s)}>
            <Text style={[styles.tabText, stage === s && styles.tabTextActive]}>{s}</Text>
            <Text style={[styles.tabMeta, stage === s && styles.tabTextActive]}>
              {stageCount(s)} · {formatCurrency(stageTotal(s))}
            </Text>
          </Pressable>
        ))}
      </View>

      <DraggableFlatList
        data={columnDeals}
        keyExtractor={(d) => d.id}
        onDragEnd={({ data: reordered }) => setColumnDeals(reordered)}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Drop deals here</Text>}
      />

      <Modal visible={!!movingDeal} transparent animationType="fade" onRequestClose={() => setMovingDeal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMovingDeal(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Move "{movingDeal?.name}" to…</Text>
            {DEAL_STAGES.filter((s) => s !== movingDeal?.stage).map((s) => (
              <Pressable key={s} style={styles.moveOption} onPress={() => movingDeal && moveToStage(movingDeal, s)}>
                <Text>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  tab: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  tabMeta: { fontSize: 10, color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  list: { padding: 12, gap: 10 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardActive: { borderColor: '#2563eb', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontWeight: '700', fontSize: 14 },
  cardSub: { fontSize: 12, color: '#6b7280' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardAmount: { fontWeight: '600', fontSize: 13 },
  cardProb: { fontSize: 12, color: '#6b7280' },
  cardDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  dragHandle: { justifyContent: 'center', paddingHorizontal: 8 },
  dragHandleText: { fontSize: 18, color: '#9ca3af' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  modalTitle: { fontWeight: '700', padding: 12 },
  moveOption: { paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
});
