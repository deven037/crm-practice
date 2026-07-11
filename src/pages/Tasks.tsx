import { DragEvent, useEffect, useState } from 'react';
import { getAll, newId, removeMany, saveAll, upsert } from '../data/store';
import { TaskItem, TaskPriority, TASK_PRIORITIES } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { classNames, formatDate, isOverdue } from '../utils';

type Filter = 'all' | 'open' | 'completed' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

export function Tasks() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newDue, setNewDue] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = async () => {
    const t = await getAll<TaskItem>('tasks');
    setTasks(t.sort((a, b) => a.order - b.order));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = tasks.filter((t) => {
    if (filter === 'open') return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'overdue') return !t.completed && isOverdue(t.dueDate);
    return true;
  });

  const toggleComplete = async (task: TaskItem) => {
    const completing = !task.completed;
    if (completing && isOverdue(task.dueDate)) {
      // Native alert — practices dialog handling.
      window.alert(`Heads up: "${task.title}" was overdue when you completed it.`);
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: completing } : t)));
    await upsert('tasks', { ...task, completed: completing });
    toast.push('success', completing ? 'Task completed.' : 'Task reopened.');
  };

  const deleteTask = async (task: TaskItem) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    await removeMany('tasks', [task.id]);
    toast.push('success', 'Task deleted.');
    load();
  };

  const changePriority = async (task: TaskItem, priority: TaskPriority) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority } : t)));
    await upsert('tasks', { ...task, priority });
  };

  const addTask = async () => {
    if (!newTitle.trim()) {
      toast.push('error', 'Task title is required.');
      return;
    }
    const task: TaskItem = {
      id: newId('task'),
      title: newTitle.trim(),
      dueDate: newDue ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      priority: newPriority,
      completed: false,
      order: -1, // top of the list
    };
    await upsert('tasks', task);
    setNewTitle('');
    setNewDue(null);
    setNewPriority('Medium');
    toast.push('success', `Task "${task.title}" added.`);
    load();
  };

  // Drag to reorder (only meaningful in "All" view where the full order is visible).
  const onDrop = async (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...tasks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    const reordered = next.map((t, i) => ({ ...t, order: i }));
    setTasks(reordered);
    setDragIndex(null);
    await saveAll('tasks', reordered);
  };

  return (
    <div data-testid="tasks-page">
      <div className="page-header">
        <h1>Tasks</h1>
      </div>

      <div className="quick-add" data-testid="task-quick-add">
        <input
          className="input"
          placeholder="What needs doing?"
          data-testid="task-title-input"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <Select
          value={newPriority}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
          onChange={(v) => setNewPriority(v as TaskPriority)}
        />
        <DatePicker value={newDue} onChange={setNewDue} testId="task-due-date" />
        <button className="btn btn-primary" data-testid="task-add-btn" onClick={addTask}>
          + Add task
        </button>
      </div>

      <div className="chip-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={classNames('chip-filter', filter === f.id && 'active')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <ul className="task-list">
          {visible.length === 0 && <li className="empty-cell">No tasks in this view.</li>}
          {visible.map((task) => {
            const index = tasks.indexOf(task);
            const overdue = !task.completed && isOverdue(task.dueDate);
            return (
              <li
                key={task.id}
                className={classNames('task-item', task.completed && 'completed', overdue && 'overdue')}
                draggable={filter === 'all'}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, index)}
              >
                {filter === 'all' && <span className="drag-handle" title="Drag to reorder">⋮⋮</span>}
                <input
                  type="checkbox"
                  aria-label={`Complete ${task.title}`}
                  checked={task.completed}
                  onChange={() => toggleComplete(task)}
                />
                <span className="task-title">{task.title}</span>
                <span className={classNames('pill', overdue ? 'pill-overdue' : 'pill-due')}>
                  {overdue ? 'Overdue · ' : 'Due '}
                  {formatDate(task.dueDate)}
                </span>
                <Select
                  value={task.priority}
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                  onChange={(v) => changePriority(task, v as TaskPriority)}
                />
                <button className="icon-btn" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}>
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
