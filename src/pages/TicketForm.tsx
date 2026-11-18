import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronLeft, Clock, MessageCircle, Paperclip, Plus, X } from 'lucide-react';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact, CustomFieldDef, PageLayout, Ticket, TicketPriority, User } from '../types';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { runRecoverable } from './accountRecovery';
import { SearchPicker } from './deals/dealBits';
import {
  hoursText, PRIORITY_ORDER, priorityHue, promiseFor, similarTickets, slaRulesNow, staffOf, ticketCategories, ticketChannels, ticketRef, whenText,
} from './tickets/ticketLogic';
import { PriorityMark, UserFace } from './tickets/ticketBits';

/**
 * New ticket and Edit ticket, as a full page. Beside the form: the SLA promise the priority makes (when the first
 * reply and the fix are due) and how the ticket will look in the queue. The server works out the real due times.
 */
export function TicketForm({ existing }: { existing?: Ticket } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const contacts = getAllSync<Contact>('contacts');
  const accounts = getAllSync<Account>('accounts');
  const staff = staffOf(getAllSync<User>('users'));
  const allTickets = getAllSync<Ticket>('tickets');
  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'tickets');
  const layout = layouts.find((l) => l.id === params.get('layout'))
    ?? (existing ? layouts.find((l) => l.name === existing.layoutName) : undefined)
    ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const customIds = new Set(getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === 'tickets').map((d) => d.id));
  const layoutCustomIds = layout ? layout.tabs.flatMap((t) => t.fieldKeys).filter((k) => customIds.has(k)) : undefined;
  const channels = ticketChannels();
  const categories = ticketCategories();

  // The order of these states is relied on by form tests; add new ones at the end.
  const [draft, setDraft] = useState<Ticket>(() => existing ? { ...existing } : {
    id: newId('ticket'),
    subject: '',
    description: '',
    requester: '',
    priority: 'Medium',
    status: 'New',
    slaDue: '',
    createdAt: new Date().toISOString(),
    comments: [],
    attachments: [],
    customFields: {},
    contactId: params.get('contact'),
    accountId: null,
    ownerId: null,
    channel: channels[0] ?? '',
    category: '',
    layoutName: layout?.name ?? null,
  });
  const [errors, setErrors] = useState<{ subject?: string; requester?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A contact passed in the address (from a contact page) fills the name.
  useEffect(() => {
    if (existing || !draft.contactId || draft.requester) return;
    const c = contacts.find((x) => x.id === draft.contactId);
    if (c) setDraft((d) => ({ ...d, requester: c.name, accountId: c.accountId ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Object.keys(errors).length || Object.keys(customErrors).length) {
      document.querySelector<HTMLElement>('[data-testid="ticket-form-page"] [aria-invalid="true"]')?.focus();
    }
  }, [errors, customErrors]);

  const backTo = existing ? `/tickets/${existing.id}` : '/tickets';
  const similar = draft.subject.trim().length >= 3 ? similarTickets(draft.subject, allTickets, existing?.id) : [];
  const theirOpen = draft.contactId || draft.requester.trim()
    ? allTickets.filter((t) => t.id !== existing?.id && !['Resolved', 'Closed'].includes(t.status) && ((draft.contactId && t.contactId === draft.contactId) || (draft.requester.trim() && t.requester === draft.requester.trim())))
    : [];
  const set = (patch: Partial<Ticket>) => setDraft((d) => ({ ...d, ...patch }));

  const pickContact = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) { set({ contactId: null, accountId: null }); return; }
    set({ contactId: c.id, requester: c.name, accountId: c.accountId ?? null });
    setErrors((e) => ({ ...e, requester: undefined }));
  };

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    set({ attachments: [...draft.attachments, ...files.map((f) => ({ id: newId('file'), name: f.name, size: f.size }))] });
    e.target.value = '';
  };

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.subject.trim()) errs.subject = 'A subject helps the team pick the ticket up.';
    if (!draft.requester.trim()) errs.requester = 'Say who raised this ticket.';
    setErrors(errs);
    const cErrs = validateCustomFields('tickets', 'form', draft.customFields ?? {}, layoutCustomIds);
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;
    const ready: Ticket = {
      ...draft,
      subject: draft.subject.trim(),
      requester: draft.requester.trim(),
      description: draft.description.trim(),
      status: existing ? existing.status : draft.ownerId ? 'Open' : 'New',
    };
    const result: { saved?: Ticket } = {};
    const ok = await runRecoverable(async () => { result.saved = await upsert('tickets', ready); }, { setBusy, setError: setSaveError });
    if (!ok || !result.saved) return;
    const done = result.saved;
    if (existing) {
      toast.push('success', done.slaDue !== existing.slaDue ? `Saved. Resolve by ${whenText(done.slaDue)}.` : 'Changes saved.');
      navigate(`/tickets/${done.id}`);
    } else {
      toast.push('success', `${ticketRef(done)} created. First reply due ${whenText(done.firstReplyDue ?? done.slaDue)}.`);
      navigate('/tickets', { state: { landed: done.id } });
    }
  };

  const from = existing ? Date.parse(existing.createdAt) : Date.now();
  const promise = promiseFor(draft.priority, from);
  const rules = slaRulesNow();
  const owner = staff.find((u) => u.id === draft.ownerId);

  return (
    <div className="deal3 tk3 tk-form-page" data-testid="ticket-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? ticketRef(existing) : 'Tickets'}</Link>
      <div className="deal-fcols tk-fcols">
        <div className="card deal-formcard">
          <div className="acct-fhead">
            <h1>{existing ? `Edit ${ticketRef(existing)}` : 'New ticket'}</h1>
            <p>{existing ? 'Changing the priority moves the due times. Everything else keeps the clock as it is.' : layout ? `Layout: ${layout.name}` : 'A customer’s problem, from first message to fix.'}</p>
          </div>

          <div className="tk-sect">
            <h2><span className="tk-n">1</span>Customer</h2>
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Contact</span>
                <SearchPicker
                  label="Contact"
                  find="Type a name"
                  testId="ticket-contact"
                  value={draft.contactId ?? ''}
                  options={[{ value: '', label: 'Not a saved contact' }, ...[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name, hint: accounts.find((a) => a.id === c.accountId)?.name }))]}
                  onPick={pickContact}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ticket-requester-input">Name *</label>
                <input id="ticket-requester-input" className="input" data-testid="ticket-requester" value={draft.requester} placeholder="Who raised it"
                  aria-invalid={errors.requester ? true : undefined} aria-describedby={errors.requester ? 'ticket-requester-error' : undefined}
                  onChange={(e) => set({ requester: e.target.value })} />
                {errors.requester && <span className="field-error" id="ticket-requester-error">{errors.requester}</span>}
              </div>
            </div>
            {theirOpen.length > 0 && (
              <p className="tk-hint">{draft.requester.split(' ')[0]} already has {theirOpen.length} open {theirOpen.length === 1 ? 'ticket' : 'tickets'}:{' '}
                {theirOpen.slice(0, 3).map((t, i) => <span key={t.id}>{i ? ', ' : ''}<Link to={`/tickets/${t.id}`} className="tk-link">{ticketRef(t)}</Link></span>)}
              </p>
            )}
          </div>

          <div className="tk-sect">
            <h2><span className="tk-n">2</span>Issue</h2>
            <div className="form-grid">
              <div className="field field-span">
                <label className="field-label" htmlFor="ticket-subject-input">Subject *</label>
                <input id="ticket-subject-input" className="input" data-testid="ticket-subject" value={draft.subject} placeholder="What is going wrong, in a few words" autoComplete="off"
                  aria-invalid={errors.subject ? true : undefined} aria-describedby={errors.subject ? 'ticket-subject-error' : undefined}
                  onChange={(e) => set({ subject: e.target.value })} />
                {errors.subject && <span className="field-error" id="ticket-subject-error">{errors.subject}</span>}
                {similar.length > 0 && (
                  <div className="tk-sim" data-testid="ticket-similar">
                    <b><AlertTriangle size={14} aria-hidden="true" />Looks like {similar.length === 1 ? 'an open ticket' : `${similar.length} open tickets`} already {similar.length === 1 ? 'covers' : 'cover'} this</b>
                    {similar.map((t) => <Link key={t.id} to={`/tickets/${t.id}`}><span>{ticketRef(t)} · {t.subject}</span>{t.requester}</Link>)}
                  </div>
                )}
              </div>
              <div className="field">
                <span className="field-label">Category</span>
                <SearchPicker label="Category" find="Find a category" testId="ticket-category" value={draft.category ?? ''}
                  options={[{ value: '', label: 'None' }, ...categories.map((c) => ({ value: c, label: c }))]} onPick={(v) => set({ category: v })} />
              </div>
              <div className="field">
                <span className="field-label">Channel</span>
                <SearchPicker label="Channel" find="Find a channel" testId="ticket-channel" value={draft.channel ?? ''}
                  options={channels.map((c) => ({ value: c, label: c }))} onPick={(v) => set({ channel: v })} />
              </div>
            </div>
          </div>

          <div className="tk-sect">
            <h2><span className="tk-n">3</span>Priority and owner</h2>
            <div className="tk-prio-cards" role="radiogroup" aria-label="Priority">
              {PRIORITY_ORDER.map((p) => {
                const pol = promiseFor(p, from).policy;
                return (
                  <button key={p} type="button" role="radio" aria-checked={draft.priority === p} className="tk-pcard" style={{ '--c': priorityHue(p) } as CSSProperties}
                    data-testid={`ticket-priority-${p.toLowerCase()}`} onClick={() => set({ priority: p as TicketPriority })}>
                    <PriorityMark priority={p} />
                    <small>reply {hoursText(pol.firstReplyMinutes / 60)} · fix {hoursText(pol.resolveMinutes / 60)}</small>
                  </button>
                );
              })}
            </div>
            <div className="form-grid tk-gap">
              <div className="field">
                <span className="field-label">Owner</span>
                <SearchPicker label="Owner" find="Find a person" testId="ticket-owner" value={draft.ownerId ?? ''}
                  options={[{ value: '', label: 'Leave unassigned', hint: rules.autoAssign ? `auto-assigned after ${rules.autoAssignMinutes} m` : undefined }, ...staff.map((u) => ({ value: u.id, label: u.name, lead: <UserFace user={u} /> }))]}
                  onPick={(v) => set({ ownerId: v || null })} />
              </div>
              {!existing && user && draft.ownerId !== user.id && (
                <div className="field tk-me"><button type="button" className="btn" onClick={() => set({ ownerId: user.id })}><Plus size={14} aria-hidden="true" /> Take it myself</button></div>
              )}
            </div>
          </div>

          <div className="tk-sect">
            <h2><span className="tk-n">4</span>Description and files</h2>
            <div className="field">
              <label className="field-label" htmlFor="ticket-description-input">What the customer told you</label>
              <textarea id="ticket-description-input" className="input tk-ta" data-testid="ticket-description" value={draft.description}
                placeholder="Steps, reference numbers, what they expect" onChange={(e) => set({ description: e.target.value })} />
            </div>
            <button type="button" className="tk-drop" onClick={() => fileInput.current?.click()}><Paperclip size={15} aria-hidden="true" /> Add a statement, screenshot or form</button>
            <input ref={fileInput} type="file" multiple hidden onChange={addFiles} data-testid="ticket-file-input" />
            {draft.attachments.length > 0 && (
              <div className="tk-files">
                {draft.attachments.map((f) => (
                  <span key={f.id} className="tk-att"><Paperclip size={13} aria-hidden="true" />{f.name}
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => set({ attachments: draft.attachments.filter((x) => x.id !== f.id) })}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <CustomFieldsSection module="tickets" target="form" mode="edit" values={draft.customFields ?? {}} onChange={(key, value) => set({ customFields: { ...(draft.customFields ?? {}), [key]: value } })} errors={customErrors} includeIds={layoutCustomIds} />
          </div>

          {saveError && <div className="banner banner-error" role="alert">The ticket couldn’t be saved. Check your connection and try again.</div>}
          <div className="form-actions deal-savebar">
            <Link to={backTo} className="btn">Cancel</Link>
            <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="save-ticket">
              <Check size={15} aria-hidden="true" /> {busy ? 'Saving…' : existing ? 'Save changes' : 'Create ticket'}
            </button>
          </div>
        </div>

        <aside className="card tk-prev" aria-label="SLA promise">
          <h3>SLA promise</h3>
          <div className="tk-promise">
            <div className="tk-pstep" style={{ '--c': 'var(--bank-ink)' } as CSSProperties}><i><Plus size={12} /></i><div><b>{existing ? `Created ${whenText(from)}` : `Now · ${whenText(from, from, true)}`}</b><small>{existing ? 'the clock started then' : 'the clock starts when you create it'}</small></div></div>
            <div className="tk-pstep" style={{ '--c': '#d9a21a' } as CSSProperties}><i><MessageCircle size={12} /></i><div><b data-testid="promise-first-reply">{whenText(promise.firstReplyDue)}</b><small>first reply within {hoursText(promise.policy.firstReplyMinutes / 60)}</small></div></div>
            <div className="tk-pstep" style={{ '--c': priorityHue(draft.priority) } as CSSProperties}><i><Check size={12} /></i><div><b data-testid="promise-resolve">{whenText(promise.slaDue)}</b><small>resolve within {hoursText(promise.policy.resolveMinutes / 60)}</small></div></div>
          </div>
          <p className="tk-clockn"><Clock size={13} aria-hidden="true" /> <b>{draft.priority}</b>{' '}
            {promise.policy.clock === '24x7' ? 'runs round the clock, nights and Sundays included.' : `counts working hours only: ${rules.workFrom} to ${rules.workTo} on working days.`} The clock pauses while the ticket waits on the customer.
          </p>
          <h3>In the queue</h3>
          <div className="tk-qprev">
            <div className="tk-qprev-t">{draft.subject.trim() || 'Subject'}</div>
            <div className="tk-qs"><span className="tk-who"><b>{draft.requester.trim() || 'Customer'}</b></span><PriorityMark priority={draft.priority} />{owner && <UserFace user={owner} />}</div>
            <div className="tk-fz" style={{ '--c': '#1f9d63' } as CSSProperties}><div className="tk-fuse ok"><i style={{ width: '0%' }} /></div><div className="tk-fuse-t"><b>{hoursText(promise.policy.resolveMinutes / 60)} to fix</b><span>due {whenText(promise.slaDue, from, true)}</span></div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
