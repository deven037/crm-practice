import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getAllSync, getById, newId, upsert } from '../data/store';
import { TaskItem, TaskPriority, TASK_PRIORITIES, User } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { runRecoverable } from './accountRecovery';
import { SearchPicker } from './deals/dealBits';
import { addDays, isoAt, startOfDay } from './activity/activityLogic';
import { KindMark, kindLabel, linkTargets } from './activity/activityBits';

/** The task form as a full page. With no `existing` task it creates one; with one (see TaskEdit) it saves changes. */
export function TaskForm({ existing }: { existing?: TaskItem } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const users = getAllSync<User>('users');
  const targets = linkTargets();
  const [draft, setDraft] = useState<TaskItem>(existing ? { ...existing } : {
    id: newId('task'),
    title: '',
    dueDate: isoAt(addDays(startOfDay(new Date()), 1), 12 * 60),
    dueTime: null,
    priority: 'Medium',
    completed: false,
    order: Math.min(0, ...getAllSync<TaskItem>('tasks').map((t) => t.order)) - 1,
    ownerId: user?.id ?? null,
    recordModule: null,
    recordId: null,
  });
  const [errors, setErrors] = useState<{ title?: string; dueTime?: string }>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (Object.keys(errors).length) document.querySelector<HTMLElement>('[data-testid="task-form-page"] [aria-invalid="true"]')?.focus();
  }, [errors]);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.title.trim()) errs.title = 'Give the task a title.';
    if (draft.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dueTime)) errs.dueTime = 'Use a time like 15:00.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const toSave = { ...draft, title: draft.title.trim(), dueTime: draft.dueTime || null };
    const saved = await runRecoverable(() => upsert('tasks', toSave), { setBusy, setError: setSaveError });
    if (!saved) return;
    toast.push('success', existing ? 'Task updated.' : `Task "${toSave.title}" added.`);
    navigate('/tasks');
  };

  const current = targets.find((t) => t.module === draft.recordModule && t.id === draft.recordId);

  return (
    <div className="act3 act-form-page" data-testid="task-form-page">
      <Link to="/tasks" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Tasks</Link>
      <div className="card act-formcard">
        <div className="acct-fhead">
          <h1>{existing ? 'Edit task' : 'New task'}</h1>
          <p>Something to do, by when, and for which customer.</p>
        </div>
        <div className="acct-fields">
          <div className="form-grid">
            <div className="field field-span">
              <label className="field-label" htmlFor="task-title">Title *</label>
              <input
                id="task-title"
                className="input"
                data-testid="task-form-title"
                maxLength={200}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? 'task-title-error' : undefined}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              {errors.title && <span className="field-error" id="task-title-error">{errors.title}</span>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="task-due">Due date</label>
              <DatePicker id="task-due" value={draft.dueDate} onChange={(iso) => setDraft({ ...draft, dueDate: isoAt(startOfDay(new Date(iso)), 12 * 60) })} testId="task-form-due" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="task-time">Time <span className="muted">(optional)</span></label>
              <input
                id="task-time"
                className="input"
                type="time"
                step={900}
                aria-invalid={errors.dueTime ? true : undefined}
                value={draft.dueTime ?? ''}
                onChange={(e) => setDraft({ ...draft, dueTime: e.target.value || null })}
              />
              {errors.dueTime && <span className="field-error">{errors.dueTime}</span>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="task-priority">Priority</label>
              <Select id="task-priority" value={draft.priority} options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))} onChange={(v) => setDraft({ ...draft, priority: v as TaskPriority })} testId="task-form-priority" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="task-owner">Owner</label>
              <Select id="task-owner" value={draft.ownerId ?? ''} options={users.map((u) => ({ value: u.id, label: u.name }))} onChange={(v) => setDraft({ ...draft, ownerId: v })} testId="task-form-owner" />
            </div>
            <div className="field field-span">
              <span className="field-label">For</span>
              <SearchPicker
                label="Linked record"
                find="Find a contact, account, deal or lead"
                testId="task-form-record"
                value={current ? `${current.module}:${current.id}` : ''}
                options={[
                  { value: '', label: 'Nobody in particular' },
                  ...[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ value: `${t.module}:${t.id}`, label: t.name, hint: kindLabel(t.module), lead: <KindMark module={t.module} /> })),
                ]}
                onPick={(v) => {
                  const [module, id] = v.split(':');
                  setDraft({ ...draft, recordModule: (id ? module : null) as TaskItem['recordModule'], recordId: id || null });
                }}
              />
            </div>
            {existing && (
              <label className="field field-span act-donebox">
                <input type="checkbox" checked={draft.completed} onChange={(e) => setDraft({ ...draft, completed: e.target.checked })} /> Done
              </label>
            )}
          </div>
        </div>
        {saveError && <div className="banner banner-error acct-form-note" role="alert">Task couldn’t be saved. Your entries are kept. Try again.</div>}
        <div className="form-actions contact-form-actions">
          <button className="btn" disabled={busy} onClick={() => navigate('/tasks')}>Cancel</button>
          <button className="btn btn-primary contacts-primary" data-testid="save-task-btn" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Edit a task on the same full page, filled in with what is saved. */
export function TaskEdit() {
  const { id } = useParams();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  useEffect(() => {
    let cancelled = false;
    getById<TaskItem>('tasks', id ?? '').then((found) => {
      if (cancelled) return;
      setTask(found ?? null);
      setState(found ? 'ready' : 'missing');
    });
    return () => { cancelled = true; };
  }, [id]);
  if (state === 'loading') return <Spinner label="Loading task…" />;
  if (!task) return <div className="empty-cell">Task not found. <Link to="/tasks">Back to tasks</Link></div>;
  return <TaskForm key={task.id} existing={task} />;
}
