import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useCreateTask, useDeleteTask, useReorderTasks, useTasks, useUpdateTask } from '../api/hooks/useTasks';
import { SelectField } from '../components/SelectField';
import { DatePickerField } from '../components/DatePickerField';
import { Spinner } from '../components/Spinner';
import { TaskItem, TaskPriority, TASK_PRIORITIES } from '../types';
import { formatDate, isOverdue } from '../utils';
import { locatorProps, testIds } from '../testIds';

type Filter = 'all' | 'open' | 'completed' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

export function TasksScreen() {
  const { data, isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();

  const [filter, setFilter] = useState<Filter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newDue, setNewDue] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  const tasks = [...(data?.data ?? [])].sort((a, b) => a.order - b.order);
  const visible = tasks.filter((t) => {
    if (filter === 'open') return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'overdue') return !t.completed && isOverdue(t.dueDate);
    return true;
  });

  const toggleComplete = (task: TaskItem) => {
    const completing = !task.completed;
    if (completing && isOverdue(task.dueDate)) {
      Alert.alert('Heads up', `"${task.title}" was overdue when you completed it.`);
    }
    updateTask.mutate({ ...task, completed: completing });
  };

  const confirmDelete = (task: TaskItem) => {
    Alert.alert('Delete task', `Delete task "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask.mutate(task.id) },
    ]);
  };

  const changePriority = (task: TaskItem, priority: TaskPriority) => updateTask.mutate({ ...task, priority });

  const addTask = () => {
    if (!newTitle.trim()) return;
    createTask.mutate(
      { title: newTitle.trim(), dueDate: newDue, priority: newPriority, completed: false, order: -1 },
      { onSuccess: () => setNewTitle('') }
    );
  };

  const onDragEnd = ({ data: reordered }: { data: TaskItem[] }) => {
    reorderTasks.mutate(reordered.map((t, i) => ({ ...t, order: i })));
  };

  if (isLoading) return <Spinner label="Loading tasks…" />;

  const renderItem = ({ item, drag, isActive }: RenderItemParams<TaskItem>) => {
    const overdue = !item.completed && isOverdue(item.dueDate);
    return (
      <Swipeable
        renderLeftActions={() => (
          <Pressable style={[styles.swipeAction, styles.swipeComplete]} onPress={() => toggleComplete(item)}>
            <Text style={styles.swipeActionText}>{item.completed ? 'Reopen' : 'Complete'}</Text>
          </Pressable>
        )}
        renderRightActions={() => (
          <Pressable style={[styles.swipeAction, styles.swipeDelete]} onPress={() => confirmDelete(item)}>
            <Text style={styles.swipeActionText}>Delete</Text>
          </Pressable>
        )}
      >
        <Pressable
          style={[styles.row, item.completed && styles.rowCompleted, isActive && styles.rowActive]}
          onLongPress={filter === 'all' ? drag : undefined}
          delayLongPress={300}
        >
          <Pressable
            style={[styles.checkbox, item.completed && styles.checkboxChecked]}
            onPress={() => toggleComplete(item)}
            hitSlop={8}
          >
            {item.completed ? <Text style={styles.checkmark}>✓</Text> : null}
          </Pressable>
          <View style={styles.rowMain}>
            <Text style={[styles.rowTitle, item.completed && styles.rowTitleCompleted]}>{item.title}</Text>
            <Text style={[styles.duePill, overdue && styles.duePillOverdue]}>
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(item.dueDate)}
            </Text>
          </View>
          <SelectField
            value={item.priority}
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
            onChange={(v) => changePriority(item, v as TaskPriority)}
          />
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container} {...locatorProps(testIds.page('tasks'))}>
      <View style={styles.quickAdd} {...locatorProps(testIds.raw('task-quick-add'))}>
        <TextInput
          style={styles.input}
          placeholder="What needs doing?"
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={addTask}
          {...locatorProps(testIds.raw('task-title-input'))}
        />
        <View style={styles.quickAddRow}>
          <SelectField
            value={newPriority}
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
            onChange={(v) => setNewPriority(v as TaskPriority)}
          />
          <DatePickerField value={newDue} onChange={setNewDue} testID="task-due-date" />
          <Pressable style={styles.addBtn} onPress={addTask} {...locatorProps(testIds.raw('task-add-btn'))}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chipRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.id} style={[styles.chip, filter === f.id && styles.chipActive]} onPress={() => setFilter(f.id)}>
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <DraggableFlatList
        data={visible}
        keyExtractor={(t) => t.id}
        onDragEnd={onDragEnd}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No tasks in this view.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  quickAdd: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  quickAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowActive: { borderColor: '#2563eb' },
  rowCompleted: { opacity: 0.6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowTitleCompleted: { textDecorationLine: 'line-through' },
  duePill: { fontSize: 11, color: '#075985' },
  duePillOverdue: { color: '#dc2626', fontWeight: '600' },
  swipeAction: { justifyContent: 'center', alignItems: 'center', width: 90, marginBottom: 8, borderRadius: 10 },
  swipeComplete: { backgroundColor: '#16a34a' },
  swipeDelete: { backgroundColor: '#dc2626' },
  swipeActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
