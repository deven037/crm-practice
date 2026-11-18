import { CSSProperties, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { getAllSync, newId, upsert } from '../data/store';
import { Activity, LinkedModule, Meeting, TaskItem } from '../types';
import { DatePicker } from '../components/DatePicker';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { SearchPicker } from './deals/dealBits';
import { activityType, addDays, dayLabel, hm, isoAt, minutesOf, parseHm, relativeDay, spanLabel, startOfDay } from './activity/activityLogic';
import { activityTypes, callOutcomes, FeedEntry, KindMark, kindLabel, linkTargets, typeStyle } from './activity/activityBits';

const DURATIONS = [5, 15, 30, 45, 60, 90];
const FOLLOW_UPS: [number, string][] = [[1, 'Tomorrow'], [3, 'In 3 days'], [7, 'Next week']];
const timed = (type: string) => !/^(email|note)$/i.test(type);

/** Log a call, meeting, visit, email or note against a customer, with an optional follow-up task. */
export function LogActivity() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const types = activityTypes();
  const outcomes = callOutcomes();
  const targets = linkTargets();
  // From a meeting's "Log outcome": fill in what the meeting already says.
  const meeting = getAllSync<Meeting>('meetings').find((m) => m.id === params.get('meeting'));
  const [fromModule, fromId] = (params.get('record') ?? '').split(':');
  const now = new Date();
  const [type, setType] = useState(meeting?.type && types.includes(meeting.type) ? meeting.type : types.includes('Call') ? 'Call' : types[0] ?? 'Call');
  const [record, setRecord] = useState(meeting?.recordId ? `${meeting.recordModule}:${meeting.recordId}` : fromId ? `${fromModule}:${fromId}` : '');
  const [when, setWhen] = useState(meeting?.start ?? now.toISOString());
  const [duration, setDuration] = useState(meeting?.durationMin ?? 15);
  const [outcome, setOutcome] = useState(outcomes[0] ?? '');
  const [notes, setNotes] = useState('');
  const [follow, setFollow] = useState(false);
  const [followTitle, setFollowTitle] = useState('');
  const [followIn, setFollowIn] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) document.getElementById('log-record')?.querySelector('button')?.focus();
  }, [error]);

  const [module, id] = record.split(':') as [LinkedModule, string];
  const target = targets.find((t) => t.module === module && t.id === id);
  const meta = type === 'Call' ? `${outcome}${outcome === 'Connected' ? ` · ${spanLabel(duration)}` : ''}` : '';
  const preview: Activity = {
    id: 'preview', type, icon: type, text: '', when, userName: user?.name ?? 'You', recordModule: target?.module ?? null, recordId: target?.id ?? null, recordName: target?.name ?? '',
    outcome: type === 'Call' ? outcome : '', durationMin: timed(type) && (type !== 'Call' || outcome === 'Connected') ? duration : null, notes,
  };
  const history = target ? getAllSync<Activity>('activities').filter((a) => a.recordModule === target.module && a.recordId === target.id).sort((a, b) => b.when.localeCompare(a.when)).slice(0, 3) : [];

  const submit = async () => {
    if (!target) {
      setError('Pick who or what this was with.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await upsert('activities', {
        id: newId('activity'), type, recordModule: target.module, recordId: target.id, when,
        outcome: type === 'Call' ? outcome : undefined, durationMin: preview.durationMin, notes: notes.trim(),
      } as unknown as Activity);
      if (follow) {
        const task: TaskItem = {
          id: newId('task'),
          title: followTitle.trim() || `Follow up with ${target.name}`,
          dueDate: isoAt(addDays(startOfDay(new Date()), followIn), 12 * 60),
          dueTime: null,
          priority: 'Medium',
          completed: false,
          order: Math.min(0, ...getAllSync<TaskItem>('tasks').map((t) => t.order)) - 1,
          ownerId: user?.id ?? null,
          recordModule: target.module,
          recordId: target.id,
        };
        await upsert('tasks', task);
      }
      toast.push('success', follow ? 'Activity logged and follow-up task added.' : 'Activity logged.');
      navigate('/activity');
    } catch {
      setBusy(false);
      toast.push('error', 'The activity couldn’t be saved. Your entries are kept. Try again.');
    }
  };

  return (
    <div className="act3 act-form-page" data-testid="log-activity-page">
      <Link to="/activity" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Activity</Link>
      <div className="act-fcols">
        <div className="card act-formcard">
          <div className="acct-fhead">
            <h1>Log activity</h1>
            <p>{meeting ? `The outcome of “${meeting.title}”.` : 'Record a call, meeting, visit, email or note against a customer.'}</p>
          </div>
          <div className="acct-fields">
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Type</span>
                <SearchPicker label="Type" find="Find a type" testId="log-type" value={type} options={types.map((t) => ({ value: t, label: t, hue: typeStyle(t).hue }))} onPick={setType} />
              </div>
              <div className={classNames('field', error && 'bad')} id="log-record">
                <span className="field-label">With *</span>
                <SearchPicker
                  label="With"
                  find="Find a contact, account, deal or lead"
                  testId="log-record"
                  invalid={!!error}
                  value={record}
                  options={[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ value: `${t.module}:${t.id}`, label: t.name, hint: kindLabel(t.module), lead: <KindMark module={t.module} /> }))}
                  onPick={(v) => { setRecord(v); setError(''); }}
                />
                {error && <span className="field-error" role="alert">{error}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="log-date">Date</label>
                <DatePicker id="log-date" value={when} onChange={(iso) => setWhen(isoAt(startOfDay(new Date(iso)), minutesOf(when)))} testId="log-date" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="log-time">Time</label>
                <input id="log-time" className="input" type="time" step={300} value={hm(minutesOf(when))} onChange={(e) => { const m = parseHm(e.target.value); if (m != null) setWhen(isoAt(startOfDay(new Date(when)), m)); }} />
              </div>
              {timed(type) && (
                <div className="field field-span">
                  <span className="field-label" id="log-length">How long</span>
                  <div className="act-durs" role="group" aria-labelledby="log-length">
                    {DURATIONS.map((d) => <button key={d} type="button" aria-pressed={duration === d} onClick={() => setDuration(d)}>{spanLabel(d)}</button>)}
                  </div>
                </div>
              )}
              {type === 'Call' && (
                <div className="field">
                  <span className="field-label">Outcome</span>
                  <SearchPicker label="Outcome" find="Find an outcome" testId="log-outcome" value={outcome} options={outcomes.map((o) => ({ value: o, label: o }))} onPick={setOutcome} />
                </div>
              )}
              <div className="field field-span">
                <label className="field-label" htmlFor="log-notes">{type === 'Note' ? 'Note' : 'What happened'}</label>
                <textarea id="log-notes" className="input act-textarea" data-testid="log-notes" maxLength={2000} placeholder={type === 'Note' ? 'Write the note' : 'Key points, decisions, what was agreed'} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="field field-span">
                <label className="act-switchrow">
                  <input type="checkbox" role="switch" className="act-switch" checked={follow} data-testid="log-follow-up" onChange={(e) => setFollow(e.target.checked)} />
                  Add a follow-up task
                </label>
                {follow && (
                  <div className="act-followup">
                    <label className="field-label" htmlFor="log-follow-title">Task</label>
                    <input id="log-follow-title" className="input" maxLength={200} placeholder={target ? `Follow up with ${target.name}` : 'For example: Send the revised pricing'} value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} />
                    <div className="act-durs" role="group" aria-label="Follow-up due">
                      {FOLLOW_UPS.map(([d, label]) => <button key={d} type="button" aria-pressed={followIn === d} onClick={() => setFollowIn(d)}>{label}</button>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="form-actions contact-form-actions">
            <button className="btn" disabled={busy} onClick={() => navigate('/activity')}>Cancel</button>
            <button className="btn btn-primary contacts-primary" data-testid="save-activity-btn" disabled={busy} onClick={submit}>
              <Check size={16} aria-hidden="true" /> {busy ? 'Saving…' : `Log ${type.toLowerCase()}`}
            </button>
          </div>
        </div>
        <aside className="card act-preview" aria-label="Preview" data-testid="log-preview">
          <span className="act-eyebrow">In the activity timeline</span>
          {target ? <FeedEntry activity={preview} last /> : <p className="muted act-pnote">Pick who this was with to see the entry.</p>}
          <span className="act-eyebrow act-gap">{target ? `On ${target.name}` : 'On the customer’s history'}</span>
          <div className="act-minirec">
            {target ? (
              <ol>
                <li className="new" style={{ '--c': typeStyle(type).hue } as CSSProperties}>{type} by {user?.name?.split(' ')[0] ?? 'you'} · {relativeDay(new Date(when))} {hm(minutesOf(when))}</li>
                {follow && <li className="new">Task: {followTitle.trim() || `Follow up with ${target.name}`} · {followIn === 1 ? 'Tomorrow' : dayLabel(addDays(new Date(), followIn))}</li>}
                {history.map((a) => <li key={a.id} style={{ '--c': typeStyle(activityType(a)).hue } as CSSProperties}>{activityType(a)} by {(a.userName ?? '').split(' ')[0] || 'the team'} · {relativeDay(new Date(a.when))}</li>)}
                {history.length === 0 && <li>Nothing logged before.</li>}
              </ol>
            ) : <span className="muted">Their history shows here.</span>}
          </div>
        </aside>
      </div>
    </div>
  );
}
