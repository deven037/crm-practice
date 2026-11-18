import { CSSProperties, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown, ChevronLeft, Trash2 } from 'lucide-react';
import { getAllSync, getById, newId, removeMany, upsert } from '../data/store';
import { Contact, Meeting, User } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { runRecoverable } from './accountRecovery';
import { TagPicker } from './contacts/contactBits';
import { SearchPicker } from './deals/dealBits';
import { addDays, DAY_END, DAY_START, findClash, hm, isoAt, lanes, meetingsOn, minutesOf, parseHm, relativeDay, spanLabel, startOfDay } from './activity/activityLogic';
import { activityTypes, hue, KindMark, kindLabel, linkTargets, REMINDERS, typeStyle } from './activity/activityBits';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const SLOT = 30;

/** Beside the form: that day's calendar with the new meeting in it, and a warning when it overlaps another. */
export function DayPreview({ draft, others }: { draft: Meeting; others: Meeting[] }) {
  const day = startOfDay(new Date(draft.start));
  const theirs = meetingsOn(others, day).filter((m) => m.id !== draft.id);
  const clash = findClash(theirs, draft.start, draft.durationMin);
  const all = [...theirs, draft];
  const placed = lanes(all.map((m) => ({ id: m.id, start: minutesOf(m.start), dur: m.durationMin })));
  const y = (min: number) => ((Math.max(DAY_START, min) - DAY_START) / 60) * SLOT;
  return (
    <aside className="card act-preview" aria-label="Your day" data-testid="meeting-preview">
      <span className="act-eyebrow">{relativeDay(day)} · your day</span>
      <div className="act-dcol" style={{ height: ((DAY_END - DAY_START) / 60) * SLOT }}>
        {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => i > 0 && <span key={i} className="act-dl" style={{ top: i * SLOT }}>{String(8 + i).padStart(2, '0')}</span>)}
        {all.map((m) => {
          const lane = placed.get(m.id) ?? { lane: 0, of: 1 };
          const mine = m.id === draft.id;
          return (
            <div
              key={m.id}
              className={mine ? 'act-ev new' : 'act-ev'}
              style={{ ...hue(typeStyle(m.type).hue), left: `calc(40px + (100% - 46px) * ${lane.lane / lane.of})`, width: `calc((100% - 46px) / ${lane.of} - 3px)`, top: y(minutesOf(m.start)), height: Math.max(18, (m.durationMin / 60) * SLOT - 2), opacity: mine ? 1 : 0.75 } as CSSProperties}
            >
              <b>{m.title || 'New meeting'}</b>
              {mine && m.durationMin >= 90 && <small>{hm(minutesOf(m.start))}–{hm(minutesOf(m.start) + m.durationMin)}</small>}
            </div>
          );
        })}
      </div>
      {clash ? (
        <div className="act-clash" role="status"><AlertTriangle size={15} aria-hidden="true" /><span>Clashes with <b>{clash.title}</b>, {hm(minutesOf(clash.start))}–{hm(minutesOf(clash.start) + clash.durationMin)}. You can still save it.</span></div>
      ) : (
        <div className="act-okline" role="status"><Check size={15} aria-hidden="true" /><span>No clash with your other meetings{theirs.length ? '' : ' (nothing else that day)'}.</span></div>
      )}
    </aside>
  );
}

/** The meeting form as a full page. With no `existing` meeting it creates one; with one (see MeetingEdit) it saves changes. */
export function MeetingForm({ existing }: { existing?: Meeting } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const users = getAllSync<User>('users');
  const contacts = getAllSync<Contact>('contacts');
  const targets = linkTargets();
  const types = activityTypes();
  const firstDay = params.get('date') ? new Date(`${params.get('date')}T00:00`) : addDays(startOfDay(new Date()), 1);
  const firstStart = parseHm(params.get('start')) ?? 10 * 60;
  const [draft, setDraft] = useState<Meeting>(existing ? { ...existing } : {
    id: newId('meeting'),
    title: '',
    type: types.includes('Meeting') ? 'Meeting' : types[0] ?? 'Meeting',
    start: isoAt(Number.isNaN(firstDay.getTime()) ? addDays(startOfDay(new Date()), 1) : firstDay, firstStart),
    durationMin: 60,
    ownerId: user?.id ?? '',
    attendeeIds: user?.id ? [user.id] : [],
    contactIds: [],
    recordModule: null,
    recordId: null,
    location: '',
    reminder: '15 minutes before',
    notes: '',
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (errors.title) document.getElementById('meeting-title')?.focus();
  }, [errors]);

  const others = getAllSync<Meeting>('meetings').filter((m) => m.attendeeIds.some((id) => draft.attendeeIds.includes(id)));
  const startMin = minutesOf(draft.start);
  const setDay = (iso: string) => setDraft({ ...draft, start: isoAt(startOfDay(new Date(iso)), startMin) });
  const setTime = (text: string) => { const m = parseHm(text); if (m != null) setDraft({ ...draft, start: isoAt(startOfDay(new Date(draft.start)), m) }); };
  const current = targets.find((t) => t.module === draft.recordModule && t.id === draft.recordId);

  const submit = async () => {
    if (!draft.title.trim()) {
      setErrors({ title: 'Give the meeting a title.' });
      return;
    }
    setErrors({});
    const toSave = { ...draft, title: draft.title.trim() };
    const saved = await runRecoverable(() => upsert('meetings', toSave), { setBusy, setError: setSaveError });
    if (!saved) return;
    toast.push('success', existing ? 'Meeting updated.' : 'Added to your calendar.');
    navigate('/calendar');
  };

  const remove = async () => {
    if (!existing) return;
    setDeleting(false);
    try {
      await removeMany('meetings', [existing.id]);
      toast.push('success', 'Meeting deleted.');
      navigate('/calendar');
    } catch {
      toast.push('error', 'The meeting couldn’t be deleted. Try again.');
    }
  };

  const contactChoices = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const userChoices = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="act3 act-form-page" data-testid="meeting-form-page">
      <Link to="/calendar" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Calendar</Link>
      <div className="act-fcols">
        <div className="card act-formcard">
          <div className="acct-fhead">
            <h1>{existing ? 'Edit meeting' : 'New meeting'}</h1>
            <p>A meeting, call or visit on your calendar.</p>
          </div>
          <div className="acct-fields">
            <div className="form-grid">
              <div className="field field-span">
                <label className="field-label" htmlFor="meeting-title">Title *</label>
                <input
                  id="meeting-title"
                  className="input"
                  data-testid="meeting-title"
                  maxLength={160}
                  placeholder="For example: Pricing review with Kavya Anand"
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? 'meeting-title-error' : undefined}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                {errors.title && <span className="field-error" id="meeting-title-error">{errors.title}</span>}
              </div>
              <div className="field">
                <span className="field-label">Type</span>
                <SearchPicker label="Type" find="Find a type" testId="meeting-type" value={draft.type} options={types.map((t) => ({ value: t, label: t, hue: typeStyle(t).hue }))} onPick={(v) => setDraft({ ...draft, type: v })} />
              </div>
              <div className="field">
                <span className="field-label">Related to</span>
                <SearchPicker
                  label="Related record"
                  find="Find a contact, account, deal or lead"
                  testId="meeting-record"
                  value={current ? `${current.module}:${current.id}` : ''}
                  options={[{ value: '', label: 'Nothing in particular' }, ...[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ value: `${t.module}:${t.id}`, label: t.name, hint: kindLabel(t.module), lead: <KindMark module={t.module} /> }))]}
                  onPick={(v) => { const [module, id] = v.split(':'); setDraft({ ...draft, recordModule: (id ? module : null) as Meeting['recordModule'], recordId: id || null }); }}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="meeting-date">Date</label>
                <DatePicker id="meeting-date" value={draft.start} onChange={setDay} testId="meeting-date" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="meeting-start">Starts</label>
                <input id="meeting-start" className="input" type="time" step={900} data-testid="meeting-start" value={hm(startMin)} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="field field-span">
                <span className="field-label" id="meeting-length">How long</span>
                <div className="act-durs" role="group" aria-labelledby="meeting-length">
                  {DURATIONS.map((d) => <button key={d} type="button" aria-pressed={draft.durationMin === d} onClick={() => setDraft({ ...draft, durationMin: d })}>{spanLabel(d)}</button>)}
                </div>
              </div>
              <div className="field">
                <span className="field-label">Colleagues</span>
                <TagPicker
                  testId="meeting-colleagues"
                  label={<>{draft.attendeeIds.map((id) => userChoices.find((u) => u.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ') || 'Add colleagues'} <ChevronDown size={14} aria-hidden="true" /></>}
                  tags={userChoices.map((u) => u.name)}
                  selected={userChoices.filter((u) => draft.attendeeIds.includes(u.id)).map((u) => u.name)}
                  onToggle={(name) => {
                    const id = userChoices.find((u) => u.name === name)?.id;
                    if (!id || id === draft.ownerId) return;
                    setDraft({ ...draft, attendeeIds: draft.attendeeIds.includes(id) ? draft.attendeeIds.filter((x) => x !== id) : [...draft.attendeeIds, id] });
                  }}
                />
              </div>
              <div className="field">
                <span className="field-label">Customers</span>
                <TagPicker
                  testId="meeting-contacts"
                  label={<>{draft.contactIds.map((id) => contactChoices.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || 'Add customers'} <ChevronDown size={14} aria-hidden="true" /></>}
                  tags={contactChoices.map((c) => c.name)}
                  selected={contactChoices.filter((c) => draft.contactIds.includes(c.id)).map((c) => c.name)}
                  onToggle={(name) => {
                    const id = contactChoices.find((c) => c.name === name)?.id;
                    if (id) setDraft({ ...draft, contactIds: draft.contactIds.includes(id) ? draft.contactIds.filter((x) => x !== id) : [...draft.contactIds, id] });
                  }}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="meeting-where">Where</label>
                <input id="meeting-where" className="input" maxLength={300} placeholder="Room, address or video link" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="meeting-reminder">Reminder</label>
                <Select id="meeting-reminder" value={draft.reminder} options={REMINDERS.map((r) => ({ value: r, label: r }))} onChange={(v) => setDraft({ ...draft, reminder: v })} />
              </div>
              <div className="field field-span">
                <label className="field-label" htmlFor="meeting-notes">Agenda</label>
                <textarea id="meeting-notes" className="input act-textarea" maxLength={2000} placeholder="What you want to cover" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
          </div>
          {saveError && <div className="banner banner-error acct-form-note" role="alert">Meeting couldn’t be saved. Your entries are kept. Try again.</div>}
          <div className="form-actions contact-form-actions">
            {existing && <button className="btn btn-ghost act-delete" disabled={busy} onClick={() => setDeleting(true)}><Trash2 size={14} /> Delete</button>}
            <button className="btn" disabled={busy} onClick={() => navigate('/calendar')}>Cancel</button>
            <button className="btn btn-primary contacts-primary" data-testid="save-meeting-btn" disabled={busy} onClick={submit}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Add to calendar'}</button>
          </div>
        </div>
        <DayPreview draft={draft} others={others} />
      </div>
      {deleting && (
        <Modal title="Delete this meeting?" onClose={() => setDeleting(false)} footer={<><button className="btn" onClick={() => setDeleting(false)}>Keep meeting</button><button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={remove}><Trash2 size={14} /> Delete meeting</button></>}>
          <p>“{existing?.title}” comes off everyone’s calendar.</p>
        </Modal>
      )}
    </div>
  );
}

/** Edit a meeting on the same full page, filled in with what is saved. */
export function MeetingEdit() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [state, setState] = useState<'loading' | 'done'>('loading');
  useEffect(() => {
    let cancelled = false;
    getById<Meeting>('meetings', id ?? '').then((found) => {
      if (cancelled) return;
      setMeeting(found ?? null);
      setState('done');
    });
    return () => { cancelled = true; };
  }, [id]);
  if (state === 'loading') return <Spinner label="Loading meeting…" />;
  if (!meeting) return <div className="empty-cell">Meeting not found. <Link to="/calendar">Back to the calendar</Link></div>;
  return <MeetingForm key={meeting.id} existing={meeting} />;
}
