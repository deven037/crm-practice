import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCollection } from '../api/hooks/useCollection';
import { SelectField } from '../components/SelectField';
import { Spinner } from '../components/Spinner';
import { Activity, Deal, DEAL_STAGES, Lead, LEAD_STATUSES, TaskItem, Ticket } from '../types';
import { formatCurrency, timeAgo } from '../utils';
import { locatorProps, testIds } from '../testIds';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

const PAGE_SIZE = 12;

export function DashboardScreen() {
  const [range, setRange] = useState('30');
  const [visibleActivities, setVisibleActivities] = useState(PAGE_SIZE);

  const leadsQ = useCollection<Lead>('leads');
  const dealsQ = useCollection<Deal>('deals');
  const tasksQ = useCollection<TaskItem>('tasks');
  const ticketsQ = useCollection<Ticket>('tickets');
  const activitiesQ = useCollection<Activity>('activities');

  const loading = leadsQ.isLoading || dealsQ.isLoading || tasksQ.isLoading || ticketsQ.isLoading || activitiesQ.isLoading;

  const leads = leadsQ.data?.data ?? [];
  const deals = dealsQ.data?.data ?? [];
  const tasks = tasksQ.data?.data ?? [];
  const tickets = ticketsQ.data?.data ?? [];
  const activities = activitiesQ.data?.data ?? [];

  const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
  const rangedLeads = useMemo(() => leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff), [leads, cutoff]);
  const rangedDeals = useMemo(() => deals.filter((d) => new Date(d.createdAt).getTime() >= cutoff), [deals, cutoff]);

  const openPipeline = deals.filter((d) => !d.stage.startsWith('Closed')).reduce((sum, d) => sum + d.amount, 0);
  const dueToday = tasks.filter((t) => {
    if (t.completed) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  }).length;
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const dealsByStage = DEAL_STAGES.map((stage) => ({
    label: stage.replace('Closed ', ''),
    value: rangedDeals.filter((d) => d.stage === stage).length,
  }));
  const leadsByStatus = LEAD_STATUSES.filter((s) => s !== 'Converted').map((status) => ({
    label: status,
    value: rangedLeads.filter((l) => l.status === status).length,
  }));

  if (loading) return <Spinner label="Loading dashboard…" />;

  return (
    <ScrollView style={styles.container} {...locatorProps(testIds.page('dashboard'))}>
      <View style={styles.rangeRow}>
        <SelectField value={range} options={RANGES} onChange={setRange} testID="dashboard-range" />
      </View>

      <View style={styles.statGrid}>
        <StatTile testId="stat-leads" label="Total leads" value={String(leads.length)} hint={`${rangedLeads.length} in selected range`} />
        <StatTile
          testId="stat-pipeline"
          label="Open pipeline"
          value={formatCurrency(openPipeline)}
          hint={`${deals.filter((d) => !d.stage.startsWith('Closed')).length} open deals`}
        />
        <StatTile testId="stat-tasks" label="Tasks due today" value={String(dueToday)} hint={`${tasks.filter((t) => !t.completed).length} open total`} />
        <StatTile testId="stat-tickets" label="Open tickets" value={String(openTickets)} hint={`of ${tickets.length} total`} />
      </View>

      <Breakdown title="Deals by stage" rows={dealsByStage} />
      <Breakdown title="Leads by status" rows={leadsByStatus} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent activity</Text>
        <FlatList
          data={activities.slice(0, visibleActivities)}
          keyExtractor={(a) => a.id}
          scrollEnabled={false}
          {...locatorProps(testIds.raw('activity-feed'))}
          renderItem={({ item }) => (
            <View style={styles.activityRow}>
              <Text style={styles.activityIcon}>{item.icon}</Text>
              <Text style={styles.activityText}>{item.text}</Text>
              <Text style={styles.activityTime}>{timeAgo(item.when)}</Text>
            </View>
          )}
          ListFooterComponent={
            visibleActivities < activities.length ? (
              <Text style={styles.loadMore} onPress={() => setVisibleActivities((v) => v + PAGE_SIZE)}>
                Load more…
              </Text>
            ) : (
              <Text style={styles.caughtUp}>You're all caught up 🎉</Text>
            )
          }
        />
      </View>
    </ScrollView>
  );
}

function StatTile({ testId, label, value, hint }: { testId: string; label: string; value: string; hint: string }) {
  return (
    <View style={styles.statTile} {...locatorProps(testIds.raw(testId))}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{r.label}</Text>
          <View style={styles.breakdownBarTrack}>
            <View style={[styles.breakdownBarFill, { width: `${(r.value / max) * 100}%` }]} />
          </View>
          <Text style={styles.breakdownValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  rangeRow: { padding: 16, alignItems: 'flex-start' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  statTile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#6b7280' },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  statHint: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  card: { margin: 16, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  breakdownLabel: { width: 90, fontSize: 12, color: '#374151' },
  breakdownBarTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden' },
  breakdownBarFill: { height: 8, backgroundColor: '#2563eb', borderRadius: 999 },
  breakdownValue: { width: 24, fontSize: 12, textAlign: 'right', color: '#111827' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  activityIcon: { fontSize: 16 },
  activityText: { flex: 1, fontSize: 13 },
  activityTime: { fontSize: 11, color: '#9ca3af' },
  loadMore: { color: '#2563eb', textAlign: 'center', paddingVertical: 10, fontWeight: '600' },
  caughtUp: { textAlign: 'center', color: '#9ca3af', paddingVertical: 10 },
});
