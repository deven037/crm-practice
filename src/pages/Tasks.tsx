import { DragEvent, MutableRefObject, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { getAll, newId, removeMany, saveAll, upsert } from '../data/store';
import { Role, TaskItem, TaskPriority, TASK_PRIORITIES } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames, formatDate, isDueToday, isOverdue } from '../utils';

type Filter = 'all' | 'open' | 'today' | 'completed' | 'overdue';
type TaskRole = Role | undefined;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'today', label: 'Due today' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

const isTaskPriority = (value: string): value is TaskPriority => TASK_PRIORITIES.some((priority) => priority === value);
export const canManageTasks = (role: TaskRole): boolean => role === 'admin' || role === 'rep';

interface TaskRowsProps {
  tasks: TaskItem[];
  filter: Filter;
  canManage: boolean;
  reordering: boolean;
  onToggleComplete: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onChangePriority: (task: TaskItem, priority: TaskPriority) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDragStart: (index: number) => void;
  onDrop: (event: DragEvent, index: number) => void;
}

export function TaskRows({
  tasks,
  filter,
  canManage,
  reordering,
  onToggleComplete,
  onDelete,
  onChangePriority,
  onMove,
  onDragStart,
  onDrop,
}: TaskRowsProps) {
  return (
    <>
      {tasks.map((task, index) => {
        const overdue = !task.completed && isOverdue(task.dueDate);
        const reorderable = canManage && filter === 'all';
        return (
          <li
            key={task.id}
            className={classNames('task-item', task.completed && 'completed', overdue && 'overdue')}
            draggable={reorderable && !reordering}
            onDragStart={() => onDragStart(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, index)}
          >
            {canManage && (
              <>
                <input
                  type="checkbox"
                  aria-label={`Complete ${task.title}`}
                  checked={task.completed}
                  onChange={() => onToggleComplete(task)}
                />
                {reorderable && (
                  <>
                    <span className="drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${task.title} up`}
                      disabled={reordering || index === 0}
                      onClick={() => onMove(index, index - 1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${task.title} down`}
                      disabled={reordering || index === tasks.length - 1}
                      onClick={() => onMove(index, index + 1)}
                    >
                      ▼
                    </button>
                  </>
                )}
              </>
            )}
            <span className="task-title">{task.title}</span>
            <span className={classNames('pill', overdue ? 'pill-overdue' : 'pill-due')}>
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(task.dueDate)}
            </span>
            {canManage ? (
              <Select
                value={task.priority}
                options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: priority }))}
                onChange={(value) => { if (isTaskPriority(value)) onChangePriority(task, value); }}
              />
            ) : (
              <span>{task.priority} priority</span>
            )}
            {canManage && (
              <button className="icon-btn" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>
                <Trash2 size={15} />
              </button>
            )}
          </li>
        );
      })}
    </>
  );
}

interface TaskEmptyStateProps {
  filter: Filter;
  canManage: boolean;
  onAction: () => void;
}

export function TaskEmptyState({ filter, canManage, onAction }: TaskEmptyStateProps) {
  if (filter === 'all') {
    return (
      <li className="empty-cell">
        <h2>No tasks yet</h2>
        <p>{canManage ? 'Add a task to start your list.' : 'Ask a team member to add a task.'}</p>
        {canManage && <button className="btn btn-primary" onClick={onAction}>Add a task</button>}
      </li>
    );
  }

  const content: Record<Exclude<Filter, 'all'>, { title: string; description: string; action: string }> = {
    open: {
      title: 'No open tasks',
      description: canManage ? 'Add a task or check what is completed.' : 'Use the filters to read other tasks.',
      action: canManage ? 'Add a task' : 'Show completed tasks',
    },
    today: {
      title: 'No tasks due today',
      description: 'Check All for tasks with other due dates.',
      action: 'Show all tasks',
    },
    completed: {
      title: 'No completed tasks',
      description: canManage ? 'Open tasks appear here after you complete them.' : 'Use the filters to read other tasks.',
      action: 'Show open tasks',
    },
    overdue: {
      title: 'No overdue tasks',
      description: 'Check All for upcoming work.',
      action: 'Show all tasks',
    },
  };
  const empty = content[filter];
  return (
    <li className="empty-cell">
      <h2>{empty.title}</h2>
      <p>{empty.description}</p>
      <button className="btn btn-primary" onClick={onAction}>{empty.action}</button>
    </li>
  );
}

interface TaskFiltersProps {
  filter: Filter;
  reordering: boolean;
  buttonRefs: MutableRefObject<Partial<Record<Filter, HTMLButtonElement | null>>>;
  onSelect: (filter: Filter) => void;
}

export function TaskFilters({ filter, reordering, buttonRefs, onSelect }: TaskFiltersProps) {
  return (
    <div className="chip-filters">
      {FILTERS.map((item) => (
        <button
          key={item.id}
          ref={(element) => { buttonRefs.current[item.id] = element; }}
          type="button"
          className={classNames('chip-filter', filter === item.id && 'active')}
          aria-pressed={filter === item.id}
          disabled={reordering}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Tasks() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = canManageTasks(user?.role);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [params] = useSearchParams();
  // Dashboard tile link: /tasks?due=today
  const [filter, setFilter] = useState<Filter>(params.get('due') === 'today' ? 'today' : 'all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newDue, setNewDue] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const filterRefs = useRef<Partial<Record<Filter, HTMLButtonElement | null>>>({});

  const load = async () => {
    const t = await getAll<TaskItem>('tasks');
    setTasks(t.sort((a, b) => a.order - b.order));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = tasks.filter((task) => {
    if (filter === 'open') return !task.completed;
    if (filter === 'today') return !task.completed && isDueToday(task.dueDate);
    if (filter === 'completed') return task.completed;
    if (filter === 'overdue') return !task.completed && isOverdue(task.dueDate);
    return true;
  });

  const selectFilter = (nextFilter: Filter) => {
    if (reordering) return;
    setFilter(nextFilter);
    filterRefs.current[nextFilter]?.focus();
  };

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
      order: -1,
    };
    await upsert('tasks', task);
    setNewTitle('');
    setNewDue(null);
    setNewPriority('Medium');
    toast.push('success', `Task "${task.title}" added.`);
    load();
  };

  const reorderTasks = async (fromIndex: number, toIndex: number) => {
    if (reordering || fromIndex < 0 || toIndex < 0 || fromIndex >= tasks.length || toIndex >= tasks.length || fromIndex === toIndex) return;
    const next = [...tasks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const reordered = next.map((task, index) => ({ ...task, order: index }));
    setTasks(reordered);
    setReordering(true);
    try {
      await saveAll('tasks', reordered);
    } finally {
      setReordering(false);
      setDragIndex(null);
    }
  };

  const onDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (dragIndex !== null) void reorderTasks(dragIndex, targetIndex);
  };

  const emptyAction = () => {
    if (filter === 'all' || (filter === 'open' && canManage)) {
      titleInputRef.current?.focus();
      return;
    }
    const nextFilter: Record<Exclude<Filter, 'all' | 'open'> | 'open', Filter> = {
      open: 'completed',
      today: 'all',
      completed: 'open',
      overdue: 'all',
    };
    selectFilter(nextFilter[filter]);
  };

  return (
    <div data-testid="tasks-page">
      <div className="page-header">
        <h1>Tasks</h1>
      </div>

      {canManage ? (
        <div className="quick-add" data-testid="task-quick-add">
          <input
            ref={titleInputRef}
            className="input"
            placeholder="What needs doing?"
            data-testid="task-title-input"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addTask()}
          />
          <Select
            value={newPriority}
            options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: priority }))}
            onChange={(value) => { if (isTaskPriority(value)) setNewPriority(value); }}
          />
          <DatePicker value={newDue} onChange={setNewDue} testId="task-due-date" />
          <button className="btn btn-primary" data-testid="task-add-btn" onClick={addTask}>
            + Add task
          </button>
        </div>
      ) : (
        <p className="task-view-only">View only. Your role can read tasks but cannot change them.</p>
      )}

      <TaskFilters
        filter={filter}
        reordering={reordering}
        buttonRefs={filterRefs}
        onSelect={selectFilter}
      />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <ul className="task-list">
          {visible.length === 0 ? (
            <TaskEmptyState filter={filter} canManage={canManage} onAction={emptyAction} />
          ) : (
            <TaskRows
              tasks={visible}
              filter={filter}
              canManage={canManage}
              reordering={reordering}
              onToggleComplete={toggleComplete}
              onDelete={deleteTask}
              onChangePriority={changePriority}
              onMove={(fromIndex, toIndex) => { void reorderTasks(fromIndex, toIndex); }}
              onDragStart={setDragIndex}
              onDrop={onDrop}
            />
          )}
        </ul>
      )}
    </div>
  );
}
