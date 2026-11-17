import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Camera, ChevronLeft, ChevronRight, Copy, Mail, Paperclip, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { getAllSync, getById, newId, removeMany, upsert } from '../data/store';
import { Modal } from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { Account, Contact } from '../types';
import { SearchableSelect } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatDate, formatDateTime } from '../utils';
import { allContactTags, ContactFace, hueStyle, TagInput, TagPicker } from './contacts/contactBits';

export function ContactDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editForm = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'rep';
  const { recordView, removeViews } = useRecentlyViewed();

  useEffect(() => {
    let active = true;
    setContact(null);
    setNotFound(false);
    setLoadError(false);
    setEditing(false);
    getById<Contact>('contacts', id ?? '', true).then(
      (value) => { if (active) { setContact(value ?? null); setNotFound(!value); } },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === 'Contact not found.') setNotFound(true);
        else setLoadError(true);
      },
    );
    return () => { active = false; };
  }, [id, loadAttempt]);

  useEffect(() => {
    if (Object.keys(errors).length) editForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  useEffect(() => {
    if (!deleting) return;
    const opener = document.activeElement;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]') ?? []);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [deleting]);

  useEffect(() => {
    if (contact) recordView({ module: 'contacts', id: contact.id, label: contact.name, link: `/contacts/${contact.id}`, meta: { Title: contact.title } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  if (loadError) return <div className="banner banner-error" role="alert">Contact couldn’t be loaded. <button className="btn" onClick={() => setLoadAttempt((value) => value + 1)}>Retry</button></div>;
  if (notFound) {
    return (
      <div className="empty-cell" role="alert">
        Contact not found. <Link to="/contacts">Back to contacts</Link>
      </div>
    );
  }
  if (!contact) return <Spinner label="Loading contact…" />;

  const accounts = getAllSync<Account>('accounts');
  const accountName = accounts.find((a) => a.id === contact.accountId)?.name;
  const everyone = [...getAllSync<Contact>('contacts')].sort((a, b) => a.name.localeCompare(b.name));
  const colleagues = contact.accountId ? everyone.filter((c) => c.accountId === contact.accountId && c.id !== contact.id) : [];
  const place = everyone.findIndex((c) => c.id === contact.id);
  const step = (by: number) => navigate(`/contacts/${everyone[(place + by + everyone.length) % everyone.length].id}`);
  const tagChoices = allContactTags(everyone);
  const firstName = contact.name.trim().split(/\s+/)[0] || 'this contact';

  const persist = async (next: Contact, message: string) => {
    if (busy || !canWrite) return false;
    setBusy(true);
    setSaveError(false);
    try {
      const saved = await upsert('contacts', next);
      setContact(saved);
      toast.push('success', message);
      return true;
    } catch {
      setSaveError(true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => persist({ ...contact, avatar: String(reader.result) }, 'Avatar updated.');
    reader.readAsDataURL(file);
  };

  const onFileAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    persist(
      { ...contact, files: [...contact.files, { id: newId('file'), name: file.name, size: file.size }] },
      `File "${file.name}" attached.`
    );
    e.target.value = '';
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const saved = await persist(
      { ...contact, notes: [{ id: newId('note'), text: noteText.trim(), createdAt: new Date().toISOString() }, ...contact.notes] },
      'Note added.'
    );
    if (saved) setNoteText('');
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.push('success', `${what} copied.`),
      () => toast.push('error', `${what} could not be copied.`),
    );
  };

  const stopEditing = () => { setSaveError(false); setEditing(false); };
  const formOpen = editing && canWrite && draft;

  return (
    <div className="contact3 contact-record" data-testid="contact-detail-page" style={hueStyle(contact.id)}>
      {formOpen ? (
        <>
          <button type="button" className="contact-back" onClick={stopEditing}>
            <ChevronLeft size={16} aria-hidden="true" /> {contact.name}
          </button>
          <form className="card contact-formcard" ref={editForm} noValidate onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !canWrite) return;
            const nextErrors = validateCustomFields('contacts', 'detail', draft.customFields ?? {});
            if (!draft.name.trim()) nextErrors.name = 'Name is required.';
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) nextErrors.email = 'Enter a valid email.';
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) return;
            if (await persist(draft, 'Contact updated.')) setEditing(false);
          }}>
            <div className="contact-band" />
            <div className="contact-cover-top">
              <ContactFace contact={{ ...contact, name: draft.name }} size="large" />
              <div className="contact-ident">
                <h1>{draft.name.trim() || contact.name}</h1>
                <p>Editing this contact{contact.layoutName ? ` · Layout: ${contact.layoutName}` : ''}</p>
              </div>
            </div>
            {saveError && !deleting && <div className="banner banner-error contact-form-note" role="alert">Changes couldn’t be saved. Your details are still here.</div>}
            <fieldset className="form-grid contact-fields" disabled={busy} aria-live="polite">
              <div className="field">
                <label className="field-label" htmlFor="edit-contact-name">Full name *</label>
                <input id="edit-contact-name" className="input" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'edit-contact-name-error' : undefined} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                {errors.name && <span className="field-error" id="edit-contact-name-error">{errors.name}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-contact-email">Email *</label>
                <input id="edit-contact-email" className="input" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'edit-contact-email-error' : undefined} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                {errors.email && <span className="field-error" id="edit-contact-email-error">{errors.email}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-contact-phone">Phone</label>
                <input id="edit-contact-phone" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-contact-title">Job title</label>
                <input id="edit-contact-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="field field-span">
                <label className="field-label" htmlFor="edit-contact-account">Account</label>
                <SearchableSelect
                  id="edit-contact-account"
                  value={draft.accountId ?? ''}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  onChange={(v) => setDraft({ ...draft, accountId: v })}
                  placeholder="Search accounts…"
                />
              </div>
              <div className="field field-span">
                <label className="field-label" htmlFor="edit-contact-tags">Tags</label>
                <TagInput id="edit-contact-tags" tags={draft.tags} suggestions={tagChoices} onChange={(tags) => setDraft({ ...draft, tags })} />
              </div>
              <CustomFieldsSection
                module="contacts"
                target="detail"
                mode="edit"
                errors={errors}
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </fieldset>
            <div className="form-actions contact-form-actions">
              <button type="button" className="btn" onClick={stopEditing}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary contacts-primary" data-testid="save-contact-btn">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="contact-record-top">
            <Link to="/contacts" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Contacts</Link>
            {everyone.length > 1 && place >= 0 && (
              <div className="contact-nav">
                <button type="button" className="btn" aria-label="Previous contact" onClick={() => step(-1)}><ChevronLeft size={16} /></button>
                <button type="button" className="btn" aria-label="Next contact" onClick={() => step(1)}><ChevronRight size={16} /></button>
              </div>
            )}
          </div>

          <section className="card contact-cover">
            <div className="contact-band" />
            <div className="contact-cover-top">
              <span className="contact-photo">
                <ContactFace contact={contact} size="large" />
                {canWrite && <button type="button" disabled={busy} className="contact-cam" aria-label="Upload photo" title="Upload photo" data-testid="upload-avatar-btn" onClick={() => avatarInput.current?.click()}>
                  <Camera size={15} />
                </button>}
                <input ref={avatarInput} type="file" accept="image/*" hidden data-testid="avatar-input" onChange={onAvatarChange} />
              </span>
              <div className="contact-ident">
                <h1>{contact.name}</h1>
                <p>
                  {contact.title || 'No title'}
                  {contact.accountId && accountName ? <> at <Link to={`/accounts/${contact.accountId}`}>{accountName}</Link></> : ''}
                </p>
                <div className="contact-tags">
                  {contact.tags.map((t) => (
                    <span key={t} className="contact-tag">
                      {t}
                      {canWrite && <button type="button" disabled={busy} aria-label={`Remove tag ${t}`} onClick={() => persist({ ...contact, tags: contact.tags.filter((x) => x !== t) }, 'Tag removed.')}><X size={11} aria-hidden="true" /></button>}
                    </span>
                  ))}
                  {!canWrite && contact.tags.length === 0 && <span className="muted">No tags</span>}
                  {canWrite && (
                    <TagPicker
                      testId="add-tag"
                      allowNew
                      label={<><Plus size={11} aria-hidden="true" /> Tag</>}
                      tags={tagChoices}
                      selected={contact.tags}
                      onToggle={(t) => persist(
                        { ...contact, tags: contact.tags.includes(t) ? contact.tags.filter((x) => x !== t) : [...contact.tags, t] },
                        contact.tags.includes(t) ? 'Tag removed.' : 'Tag added.',
                      )}
                    />
                  )}
                </div>
              </div>
              <div className="page-actions">
                {canWrite && <button
                  disabled={busy}
                  className="btn contact-edit"
                  data-testid="edit-contact-btn"
                  onClick={() => {
                    setSaveError(false);
                    setErrors({});
                    setDraft({ ...contact });
                    setEditing(true);
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>}
                {canWrite && <button disabled={busy} className="btn contact-delete" data-testid="delete-contact-btn" onClick={() => { setSaveError(false); setDeleting(true); }}>
                  <Trash2 size={14} /> Delete
                </button>}
              </div>
            </div>
          </section>

          {saveError && !deleting && <div className="banner banner-error" role="alert">Changes couldn’t be saved. Your details are still here.</div>}

          <div className="contact-cols">
            <div className="contact-side">
              <section className="card contact-box">
                <div className="contact-box-head"><h2>Notes</h2><span className="muted">{contact.notes.length}</span></div>
                {canWrite && <div className="contact-composer">
                  <label className="sr-only" htmlFor="contact-note">Note</label>
                  <textarea
                    id="contact-note"
                    disabled={busy}
                    className="input"
                    rows={1}
                    placeholder={`Write a note about ${firstName}…`}
                    data-testid="note-input"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button disabled={busy || !noteText.trim()} className="btn btn-primary contacts-primary" data-testid="add-note-btn" onClick={addNote}>
                    Add note
                  </button>
                </div>}
                {contact.notes.length === 0 && <p className="muted contact-none">No notes yet. Add a note to keep context with this contact.</p>}
                <div className="contact-timeline">
                  {contact.notes.map((note, i) => (
                    <div key={note.id} className="contact-note" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                      <p>{note.text}</p>
                      <small>
                        {formatDateTime(note.createdAt)}
                        {canWrite && <button
                          disabled={busy}
                          className="link-btn"
                          onClick={() =>
                            persist({ ...contact, notes: contact.notes.filter((n) => n.id !== note.id) }, 'Note deleted.')
                          }
                        >
                          Delete
                        </button>}
                      </small>
                    </div>
                  ))}
                  <div className="contact-note start">
                    <p>Contact created</p>
                    <small>{formatDateTime(contact.createdAt)}</small>
                  </div>
                </div>
              </section>

              <section className="card contact-box">
                <div className="contact-box-head">
                  <h2>Files</h2>
                  {canWrite && <button disabled={busy} className="btn" data-testid="attach-file-btn" onClick={() => fileInput.current?.click()}>
                    <Paperclip size={14} /> Attach file
                  </button>}
                  <input ref={fileInput} type="file" hidden data-testid="file-input" onChange={onFileAttach} />
                </div>
                {contact.files.length === 0 && <p className="muted contact-none">No files attached yet.</p>}
                <ul className="contact-files">
                  {contact.files.map((file) => (
                    <li key={file.id}>
                      <span className="contact-file-ext">{(file.name.includes('.') ? file.name.split('.').pop() ?? '' : 'file').slice(0, 4).toUpperCase()}</span>
                      <div><b>{file.name}</b><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div>
                      {canWrite && <button
                        disabled={busy}
                        className="contact-file-remove"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          persist({ ...contact, files: contact.files.filter((f) => f.id !== file.id) }, 'File removed.')
                        }
                      >
                        <X size={14} />
                      </button>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="contact-side">
              <section className="card contact-box">
                <h2>Reach {firstName}</h2>
                <div className="contact-reach">
                  <div><Mail size={16} aria-hidden="true" /><span>{contact.email}</span><button type="button" className="btn" onClick={() => copy(contact.email, 'Email')}><Copy size={13} /> Copy</button></div>
                  <div><Phone size={16} aria-hidden="true" /><span>{contact.phone || '—'}</span>{contact.phone && <button type="button" className="btn" onClick={() => copy(contact.phone, 'Phone number')}><Copy size={13} /> Copy</button>}</div>
                </div>
              </section>

              <section className="card contact-box">
                <h2>Details</h2>
                <dl className="detail-list contact-details">
                  <dt>Job title</dt>
                  <dd>{contact.title || '—'}</dd>
                  <dt>Account</dt>
                  <dd>{accountName ?? '—'}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(contact.createdAt)}</dd>
                  {contact.layoutName && <><dt>Page layout</dt><dd>{contact.layoutName}</dd></>}
                  <CustomFieldsSection module="contacts" target="detail" mode="view" values={contact.customFields ?? {}} />
                </dl>
              </section>

              <section className="card contact-box">
                <h2>Works at</h2>
                {contact.accountId && accountName ? (
                  <Link className="contact-account" to={`/accounts/${contact.accountId}`}><Building2 size={14} aria-hidden="true" /> {accountName}</Link>
                ) : <p className="muted contact-none">Not linked to an account.</p>}
                {colleagues.length > 0 && (
                  <div className="contact-mates">
                    {colleagues.map((mate) => (
                      <Link key={mate.id} to={`/contacts/${mate.id}`} className="contact-mate">
                        <ContactFace contact={mate} size="small" />
                        <span><b>{mate.name}</b><small>{mate.title || 'No title'}</small></span>
                      </Link>
                    ))}
                  </div>
                )}
                {contact.accountId && accountName && colleagues.length === 0 && <p className="muted contact-none">No one else from this account yet.</p>}
              </section>
            </div>
          </div>
        </>
      )}

      {canWrite && deleting && (
        <Modal
          title={`Delete contact — ${contact.name}`}
          onClose={() => { if (!busy) setDeleting(false); }}
          footer={
            <>
              <button className="btn" disabled={busy} onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  setSaveError(false);
                  try {
                  await removeMany('contacts', [contact.id]);
                  removeViews([contact.id]);
                  toast.push('success', `Contact "${contact.name}" deleted.`);
                  navigate('/contacts');
                  } catch { setSaveError(true); }
                  finally { setBusy(false); }
                }}
              >
                {busy ? 'Deleting…' : 'Delete contact'}
              </button>
            </>
          }
        >
          {saveError && <div className="banner banner-error" role="alert">Contact couldn’t be deleted. Try again.</div>}
          <p>
            Delete “{contact.name}”? Their <strong>{contact.notes.length} note(s)</strong> and{' '}
            <strong>{contact.files.length} file(s)</strong> will be deleted with them. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
