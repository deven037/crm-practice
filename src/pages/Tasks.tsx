import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, Clock, GripVertical, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { getAll, newId, removeMany, saveAll, upsert } from '../data/store';
import { Meeting, Role, TaskItem, TASK_PRIORITIES, User } from '../types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Spinner';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { TagPicker } from './contacts/contactBits';
import { ChanceRing } from './deals/dealBits';
import {
  addDays, DAY_END, DAY_START, dayLabel, dayOffset, dueText, hm, isoAt, LinkTarget, minutesOf, ownedBy, parseHm, parseQuick, PRIORITY_HUE,
  startOfDay, TASK_GROUPS, TaskGroupId, taskGroup,
} from './activity/activityLogic';
import { findTarget, hue, linkTargets, RecordChip, typeStyle, Face } from './activity/activityBits';

export const canManageTasks = (role: Role | undefined): boolean => role === 'admin' || role === 'rep';

export const ACTIVITY_TOOLBOX_LINKS = [
  { label: 'Activity types and call outcomes', to: '/setup/status-codes' },
  { label: 'Import Data', to: '/setup/import' },
];

/** One task line. Exported for the page tests. */
export function TaskRow({ task, target, owner, canManage, ticking, landed, delay, canMoveUp, canMoveDown, onTick, onEdit, onDelete, onMove, dragProps }: {
  task: TaskItem; target?: LinkTarget; owner?: User; canManage: boolean; ticking: boolean; landed: boolean; delay: number;
  canMoveUp: boolean; canMoveDown: boolean; onTick: () => void; onEdit: () => void; onDelete: () => void; onMove: (by: number) => void;
  dragProps?: { draggable: boolean; onDragStart: (e: DragEvent) => void; onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; onDragEnd: () => void };
}) {
  const due = dueText(task);
  const done = task.completed || ticking;
  return (
    <div className={classNames('act-trow', done && 'done', ticking && 'leaving', landed && 'land')} style={{ animationDelay: `${delay}ms` }} data-testid="task-row" {...dragProps}>
      {canManage && !task.completed ? <span className="act-grip" title="Drag to reorder" aria-hidden="true"><GripVertical size={15} /></span> : <span />}
      <button
        type="button"
        className="act-chk"
        role="checkbox"
        aria-checked={done}
        aria-label={`Complete ${task.title}`}
        disabled={!canManage || ticking}
        onClick={onTick}
      >
        <Check size={13} aria-hidden="true" />
      </button>
      <div className="act-tmain">
        <b>{task.title}</b>
        {target && <RecordChip module={target.module} id={target.id} name={target.name} />}
      </div>
      <span className={classNames('act-due', due.tone)}>{due.tone === 'late' ? <AlertTriangle size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}{due.text}</span>
      <span className="act-prio" style={hue(PRIORITY_HUE[task.priority])}><i />{task.priority} priority</span>
      {owner ? <Face id={owner.id} name={owner.name} small /> : <span />}
      {canManage ? (
        <span className="act-tacts">
          {!task.completed && <button type="button" aria-label={`Move ${task.title} up`} disabled={!canMoveUp} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>}
          {!task.completed && <button type="button" aria-label={`Move ${task.title} down`} disabled={!canMoveDown} onClick={() => onMove(1)}><ArrowDown size={14} /></button>}
          <button type="button" aria-label={`Edit ${task.title}`} onClick={onEdit}><Pencil size={14} /></button>
          <button type="button" aria-label={`Delete ${task.title}`} onClick={onDelete}><Trash2 size={14} /></button>
        </span>
      ) : <span />}
    </div>
  );
}

/** Today's progress ring and the hour-by-hour ribbon of meetings and timed tasks. */
export function DayBand({ tasks, meetings, now }: { tasks: TaskItem[]; meetings: Meeting[]; now: Date }) {
  const today = tasks.filter((t) => dayOffset(t.dueDate, now) === 0);
  const done = today.filter((t) => t.completed).length;
  const late = tasks.filter((t) => taskGroup(t, now) === 'late').length;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const x = (m: number) => `${((Math.max(DAY_START, Math.min(DAY_END, m)) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
  const todays = meetings.filter((m) => dayOffset(m.start, now) === 0).sort((a, b) => a.start.localeCompare(b.start));
  const next = todays.find((m) => minutesOf(m.start) + m.durationMin > minutesNow);
  return (
    <section className="card act-dayband" aria-label="Your day" data-testid="task-day">
      <div className="act-dayring">
        <ChanceRing value={today.length ? (done / today.length) * 100 : 0} size={60} stroke={6} hue="var(--bank-primary)" delay={150} />
        <div>
          <b>{done} of {today.length}</b>
          <small>done today{late > 0 && <span className="act-late"> · {late} overdue</span>}</small>
        </div>
      </div>
      <div className="act-ribbon" aria-label="Today’s meetings and timed tasks">
        <div className="act-past" style={{ width: x(minutesNow) }} />
        {Array.from({ length: 12 }, (_, i) => <div key={i} className="act-hr" style={{ left: `${(i / 11) * 100}%` }}><span>{String(8 + i).padStart(2, '0')}</span></div>)}
        {todays.map((m, i) => (
          <Link
            key={m.id}
            to="/calendar"
            className="act-rb"
            style={{ ...hue(typeStyle(m.type).hue), left: x(minutesOf(m.start)), width: `${(m.durationMin / (DAY_END - DAY_START)) * 100}%`, animationDelay: `${200 + i * 90}ms` }}
            title={`${m.title} · ${hm(minutesOf(m.start))}–${hm(minutesOf(m.start) + m.durationMin)}`}
          >
            <b>{m.title}</b><small>{hm(minutesOf(m.start))}</small>
          </Link>
        ))}
        {today.filter((t) => t.dueTime).map((t) => (
          <i key={t.id} className={classNames('act-rt', t.completed && 'done')} style={{ left: x(parseHm(t.dueTime) ?? DAY_START) }} title={`${t.title} · ${t.dueTime}`} />
        ))}
        {minutesNow >= DAY_START && minutesNow <= DAY_END && <i className="act-rnow" style={{ left: x(minutesNow) }} title={`Now ${hm(minutesNow)}`} />}
      </div>
      <p className="act-nextup">
        <Clock size={15} aria-hidden="true" />
        {next ? <>Next: <b>{next.title}</b> at {hm(minutesOf(next.start))}</> : 'Nothing else on your calendar today.'}
      </p>
    </section>
  );
}

/** Tasks 3.0: the day at a glance, a quick-add box that reads plain text, and tasks grouped by when they are due. */
export function Tasks() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = canManageTasks(user?.role);
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [query, setQuery] = useState('');
  const [owners, setOwners] = useState<string[]>(user?.id ? [user.id] : []);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);
  const [quick, setQuick] = useState('');
  const [ticking, setTicking] = useState<string[]>([]);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TaskItem | null>(null);
  const [busy, setBusy] = useState(false);
  const dragId = useRef<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  // Dashboard tile link: /tasks?due=today shows only today's tasks.
  const onlyToday = params.get('due') === 'today';
  const now = new Date();
  const targets = useMemo(() => linkTargets(), [tasks]);

  const load = async () => {
    setFailed(false);
    try {
      const [t, u, m] = await Promise.all([
        getAll<TaskItem>('tasks'),
        getAll<User>('users').catch((): User[] => []),
        getAll<Meeting>('meetings').catch((): Meeting[] => []),
      ]);
      // Copies: the store keeps its own cache array, and saving updates that array in place.
      setTasks([...t].sort((a, b) => a.order - b.order));
      setUsers(u);
      setMeetings([...m]);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const q = query.trim().toLowerCase();
  const shown = tasks.filter((t) =>
    ownedBy(t, owners) &&
    (!priorities.length || priorities.includes(t.priority)) &&
    (!onlyToday || dayOffset(t.dueDate, now) === 0) &&
    (!q || `${t.title} ${findTarget(targets, t.recordModule, t.recordId)?.name ?? ''}`.toLowerCase().includes(q)));
  const myMeetings = meetings.filter((m) => !owners.length || m.attendeeIds.some((id) => owners.includes(id)));
  const groups = TASK_GROUPS.map((g) => ({ ...g, items: shown.filter((t) => (ticking.includes(t.id) ? taskGroup({ ...t, completed: false }, now) : taskGroup(t, now)) === g.id) }));
  const openCount = shown.filter((t) => !t.completed).length;
  const ownerChoices = [...users].sort((a, b) => a.name.localeCompare(b.name));
  const filtering = q !== '' || priorities.length > 0 || owners.length !== 1 || owners[0] !== user?.id || onlyToday;
  const quickParse = parseQuick(quick, targets, now);

  const addQuick = async () => {
    const text = quick.trim();
    if (!text) {
      toast.push('error', 'Type the task first.');
      quickRef.current?.focus();
      return;
    }
    const p = parseQuick(text, targets, now);
    const offset = p.dueOffset ?? 0;
    const task: TaskItem = {
      id: newId('task'),
      title: p.title || text,
      dueDate: isoAt(addDays(startOfDay(now), offset), 12 * 60),
      dueTime: p.time,
      priority: p.priority ?? 'Medium',
      completed: false,
      order: Math.min(0, ...tasks.map((t) => t.order)) - 1,
      ownerId: user?.id ?? null,
      recordModule: p.record?.module ?? null,
      recordId: p.record?.id ?? null,
    };
    setBusy(true);
    try {
      const saved = await upsert('tasks', task);
      setTasks((list) => [saved, ...list.filter((t) => t.id !== saved.id)]);
      setQuick('');
      setLandedId(saved.id);
      toast.push('success', `Task added to ${offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dayLabel(addDays(now, offset))}.`);
    } catch {
      toast.push('error', 'The task couldn’t be added. Try again.');
    }
    setBusy(false);
    quickRef.current?.focus();
  };

  const tick = async (task: TaskItem) => {
    if (task.completed) {
      const saved = await upsert('tasks', { ...task, completed: false }).catch(() => null);
      if (!saved) return toast.push('error', 'The task couldn’t be reopened. Try again.');
      setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      setLandedId(saved.id);
      return toast.push('success', 'Task reopened.');
    }
    setTicking((list) => [...list, task.id]);
    try {
      const [saved] = await Promise.all([upsert('tasks', { ...task, completed: true }), new Promise((r) => setTimeout(r, 650))]);
      setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      toast.push('success', `Done: ${task.title}`);
    } catch {
      toast.push('error', 'The task couldn’t be saved. Try again.');
    }
    setTicking((list) => list.filter((id) => id !== task.id));
  };

  /** Saves a new order for one group's tasks. */
  const reorder = async (ordered: TaskItem[]) => {
    const changed = ordered.map((t, i) => ({ ...t, order: i }));
    const byId = new Map(changed.map((t) => [t.id, t]));
    const previous = tasks;
    setTasks((list) => list.map((t) => byId.get(t.id) ?? t).sort((a, b) => a.order - b.order));
    try {
      await saveAll('tasks', changed);
      toast.push('success', 'Order saved.');
    } catch {
      setTasks(previous);
      toast.push('error', 'The new order couldn’t be saved.');
    }
  };
  const move = (group: TaskItem[], task: TaskItem, by: number) => {
    const list = [...group];
    const i = list.indexOf(task);
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setLandedId(task.id);
    reorder(list);
  };
  const dragPropsFor = (group: TaskItem[], task: TaskItem) => (canManage && !task.completed ? {
    draggable: true,
    onDragStart: (e: DragEvent) => { dragId.current = task.id; e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e: DragEvent) => { if (dragId.current && group.some((t) => t.id === dragId.current)) e.preventDefault(); },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const moving = group.find((t) => t.id === dragId.current);
      dragId.current = null;
      if (!moving || moving.id === task.id) return;
      const list = group.filter((t) => t !== moving);
      list.splice(list.indexOf(task) + (group.indexOf(moving) < group.indexOf(task) ? 1 : 0), 0, moving);
      setLandedId(moving.id);
      reorder(list);
    },
    onDragEnd: () => { dragId.current = null; },
  } : undefined);

  const confirmDelete = async () => {
    if (!deleting) return;
    const task = deleting;
    setDeleting(null);
    try {
      await removeMany('tasks', [task.id]);
      setTasks((list) => list.filter((t) => t.id !== task.id));
      toast.push('success', 'Task deleted.');
    } catch {
      toast.push('error', 'The task couldn’t be deleted. Try again.');
    }
  };

  const clear = () => {
    setQuery('');
    setPriorities([]);
    setOwners(user?.id ? [user.id] : []);
    if (onlyToday) setParams({});
  };

  let index = 0;
  return (
    <div className="act3 act-tasks-page" data-testid="tasks-page">
      <div className="page-header">
        <div>
          <span className="act-eyebrow">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>Tasks</h1>
          <p className="page-subtitle">What needs doing, by when, and for which customer.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={ACTIVITY_TOOLBOX_LINKS} />
          {canManage && <Link className="btn" to="/activity/new"><CalendarDays size={16} /> Log activity</Link>}
          {canManage && (
            <button className="btn btn-primary contacts-primary" data-testid="new-task" onClick={() => navigate('/tasks/new')}>
              <Plus size={16} /> New task
            </button>
          )}
        </div>
      </div>

      {!loading && !failed && <DayBand tasks={tasks.filter((t) => ownedBy(t, owners))} meetings={myMeetings} now={now} />}

      {canManage ? (
        <section className="card act-qadd" data-testid="task-quick-add">
          <div className="act-qrow">
            <span className="act-plus" aria-hidden="true"><Plus size={18} /></span>
            <input
              ref={quickRef}
              className="act-qinput"
              data-testid="task-title-input"
              aria-label="Add a task"
              placeholder="Add a task. Try “Call Kavya tomorrow 3pm high”"
              value={quick}
              maxLength={200}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } }}
            />
            <button type="button" className="btn btn-primary contacts-primary" data-testid="task-add-btn" disabled={busy} onClick={addQuick}>Add</button>
          </div>
          <div className="act-qchips" aria-live="polite">
            {quick.trim() ? (
              <>
                <span className="act-qc"><CalendarDays size={13} aria-hidden="true" />{(quickParse.dueOffset ?? 0) === 0 ? 'Today' : quickParse.dueOffset === 1 ? 'Tomorrow' : dayLabel(addDays(now, quickParse.dueOffset ?? 0))}</span>
                {quickParse.time && <span className="act-qc"><Clock size={13} aria-hidden="true" />{quickParse.time}</span>}
                <span className="act-qc" style={hue(PRIORITY_HUE[quickParse.priority ?? 'Medium'])}>{quickParse.priority ?? 'Medium'} priority</span>
                {quickParse.record && <span className="act-qc"><Link2 size={13} aria-hidden="true" />{quickParse.record.name}</span>}
                <span>· Enter to add</span>
              </>
            ) : (
              <span>Type a task and press Enter. Dates, times, priority and the customer are picked up as you type.</span>
            )}
          </div>
        </section>
      ) : (
        <p className="act-viewonly">View only. Your role can read tasks but cannot change them.</p>
      )}

      <div className="toolbar contact-tools">
        <div className="contact-find">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="input search-input" aria-label="Search tasks" placeholder="Search tasks or customers…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <TagPicker
          testId="task-owner-filter"
          label={<>{owners.length === 1 && owners[0] === user?.id ? 'Mine' : owners.length ? `Owner · ${owners.length}` : 'Everyone'} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={ownerChoices.map((u) => u.name)}
          selected={ownerChoices.filter((u) => owners.includes(u.id)).map((u) => u.name)}
          onToggle={(name) => {
            const id = ownerChoices.find((u) => u.name === name)?.id;
            if (id) setOwners((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
          }}
        />
        <TagPicker
          testId="task-priority-filter"
          label={<>Priority{priorities.length ? ` · ${priorities.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={[...TASK_PRIORITIES]}
          selected={priorities}
          onToggle={(p) => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
        />
        {onlyToday && <span className="act-daychip">Due today<button type="button" aria-label="Show every day" onClick={() => setParams({})}><X size={13} /></button></span>}
        {filtering && <button type="button" className="btn btn-ghost" data-testid="clear-filters" onClick={clear}>Reset</button>}
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : failed ? (
        <div className="banner banner-error contacts-error" role="alert" data-testid="tasks-load-error">
          <p>Tasks couldn’t load. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={load}>Retry</button>
        </div>
      ) : (
        <section className="card act-tasks" data-testid="task-list">
          {openCount === 0 && (
            <div className="act-cele">
              <b>{shown.length === 0 && !filtering ? 'No tasks yet' : 'All clear'}</b>
              {filtering ? 'Nothing open matches these filters.' : canManage ? 'Add a task above.' : 'Tasks appear here once a rep or admin adds them.'}
            </div>
          )}
          {groups.filter((g) => g.id !== 'done' && (g.items.length || (g.id === 'today' && openCount > 0))).map((g) => (
            <div key={g.id} className={classNames('act-tgrp', g.id === 'late' && 'late')} data-group={g.id}>
              <div className="act-tg-h" style={hue(g.hue)}><i />{g.label}<small>{g.items.length}</small></div>
              {g.items.length === 0 ? <div className="act-tg-none">Nothing else due today.</div> : g.items.map((t, k) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  target={findTarget(targets, t.recordModule, t.recordId)}
                  owner={users.find((u) => u.id === t.ownerId)}
                  canManage={canManage}
                  ticking={ticking.includes(t.id)}
                  landed={landedId === t.id}
                  delay={Math.min(index++, 12) * 30}
                  canMoveUp={k > 0}
                  canMoveDown={k < g.items.length - 1}
                  onTick={() => tick(t)}
                  onEdit={() => navigate(`/tasks/${t.id}/edit`)}
                  onDelete={() => setDeleting(t)}
                  onMove={(by) => move(g.items, t, by)}
                  dragProps={dragPropsFor(g.items, t)}
                />
              ))}
            </div>
          ))}
          {groups[5].items.length > 0 && (
            <div className="act-tgrp" data-group="done">
              <div className="act-tg-h" style={hue(groups[5].hue)}>
                <i />Done<small>{groups[5].items.length}</small>
                <button type="button" className="act-link" aria-expanded={doneOpen} onClick={() => setDoneOpen((v) => !v)}>{doneOpen ? 'Hide' : 'Show'}</button>
              </div>
              {doneOpen && groups[5].items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  target={findTarget(targets, t.recordModule, t.recordId)}
                  owner={users.find((u) => u.id === t.ownerId)}
                  canManage={canManage}
                  ticking={false}
                  landed={landedId === t.id}
                  delay={0}
                  canMoveUp={false}
                  canMoveDown={false}
                  onTick={() => tick(t)}
                  onEdit={() => navigate(`/tasks/${t.id}/edit`)}
                  onDelete={() => setDeleting(t)}
                  onMove={() => undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {deleting && (
        <Modal
          title="Delete this task?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>Keep task</button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={confirmDelete}><Trash2 size={14} /> Delete task</button>
            </>
          }
        >
          <p>“{deleting.title}” goes for good.</p>
        </Modal>
      )}
    </div>
  );
}
