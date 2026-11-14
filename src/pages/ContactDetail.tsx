import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, FileText, Paperclip, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { getAllSync, newId, removeMany, upsert } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Modal } from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { Account, Contact } from '../types';
import { Tabs } from '../components/Tabs';
import { MultiSelect } from '../components/Select';
import { SearchableSelect } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatDate, formatDateTime, initials } from '../utils';

const TAG_OPTIONS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'].map((t) => ({
  value: t,
  label: t,
}));

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
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    let active = true;
    setContact(null);
    setNotFound(false);
    setLoadError(false);
    setEditing(false);
    apiFetch<Contact>(`/contacts/${id ?? ''}`).then(
      (value) => { if (active) setContact(value); },
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

  return (
    <div className="contact-screen contact-record" data-testid="contact-detail-page">
      <nav className="breadcrumbs">
        <Link to="/contacts">Contacts</Link> <span>/</span> <span>{contact.name}</span>
      </nav>

      <div className="detail-header">
        <div className="detail-avatar-wrap">
          <div className="contact-avatar contact-avatar-lg">
            {contact.avatar ? <img src={contact.avatar} alt={contact.name} /> : initials(contact.name)}
          </div>
          <button hidden={!canWrite} disabled={busy} className="btn" data-testid="upload-avatar-btn" onClick={() => avatarInput.current?.click()}>
            Upload photo
          </button>
          <input ref={avatarInput} type="file" accept="image/*" hidden data-testid="avatar-input" onChange={onAvatarChange} />
        </div>
        <div>
          <h1>{contact.name}</h1>
          <p className="muted">
            {contact.title || 'No title'} {accountName ? `· ${accountName}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <button hidden={!canWrite} disabled={busy} className="btn contact-delete" data-testid="delete-contact-btn" onClick={() => { setSaveError(false); setDeleting(true); }}>
            <Trash2 size={14} /> Delete contact
          </button>
        </div>
      </div>

      <div className="key-info-strip">
        <div className="key-info-item">
          <span className="key-info-label">Email</span>
          <span className="key-info-value">{contact.email}</span>
        </div>
        <div className="key-info-item">
          <span className="key-info-label">Phone</span>
          <span className="key-info-value">{contact.phone || '—'}</span>
        </div>
        <div className="key-info-item">
          <span className="key-info-label">Account</span>
          <span className="key-info-value">{accountName ?? '—'}</span>
        </div>
        <div className="key-info-item">
          <span className="key-info-label">Created</span>
          <span className="key-info-value">{formatDate(contact.createdAt)}</span>
        </div>
      </div>

      {saveError && !deleting && <div className="banner banner-error" role="alert">Changes couldn’t be saved. Your details are still here.</div>}
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

      <Tabs
        testId="contact-tabs"
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="contact-section">
                {!editing ? (
                  <>
                    <h2>Contact details</h2>
                    <dl className="detail-list">
                      <dt>Email</dt>
                      <dd>{contact.email}</dd>
                      <dt>Phone</dt>
                      <dd>{contact.phone || '—'}</dd>
                      <dt>Title</dt>
                      <dd>{contact.title || '—'}</dd>
                      <dt>Account</dt>
                      <dd>{accountName ?? '—'}</dd>
                      <dt>Tags</dt>
                      <dd>
                        {contact.tags.length === 0
                          ? '—'
                          : contact.tags.map((t) => (
                              <span key={t} className="chip chip-tag">
                                {t}
                              </span>
                            ))}
                      </dd>
                      <CustomFieldsSection module="contacts" target="detail" mode="view" values={contact.customFields ?? {}} />
                    </dl>
                    <button
                      hidden={!canWrite}
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
                    </button>
                  </>
                ) : (
                  draft && (
                    <form ref={editForm} noValidate onSubmit={async (event) => {
                      event.preventDefault();
                      if (busy || !canWrite) return;
                      const nextErrors = validateCustomFields('contacts', 'detail', draft.customFields ?? {});
                      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) nextErrors.email = 'Enter a valid email.';
                      setErrors(nextErrors);
                      if (Object.keys(nextErrors).length) return;
                      if (await persist(draft, 'Contact updated.')) setEditing(false);
                    }}>
                    <fieldset className="form-grid" disabled={busy} aria-live="polite">
                      <div className="field">
                        <label className="field-label" htmlFor="edit-contact-email">Email</label>
                        <input id="edit-contact-email" className="input" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'edit-contact-email-error' : undefined} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                        {errors.email && <span className="field-error" id="edit-contact-email-error">{errors.email}</span>}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="edit-contact-phone">Phone</label>
                        <input id="edit-contact-phone" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="edit-contact-title">Title</label>
                        <input id="edit-contact-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      </div>
                      <div className="field">
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
                        <MultiSelect
                          id="edit-contact-tags"
                          values={draft.tags}
                          options={TAG_OPTIONS}
                          onChange={(tags) => setDraft({ ...draft, tags })}
                          placeholder="Add tags…"
                        />
                      </div>
                      <CustomFieldsSection
                        module="contacts"
                        target="detail"
                        mode="edit"
                        errors={errors}
                        values={draft.customFields ?? {}}
                        onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
                      />
                      <div className="field-span">
                        <button
                          type="submit"
                          className="btn contacts-primary"
                          data-testid="save-contact-btn"
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>{' '}
                        <button type="button" className="btn" onClick={() => { setSaveError(false); setEditing(false); }}>
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                    </form>
                  )
                )}
              </div>
            ),
          },
          {
            id: 'activity',
            label: 'Activity',
            content: (
              <div className="contact-section">
                <div className="activity-item">
                  <span className="activity-icon"><Calendar size={14} /></span>
                  <span className="activity-text">Contact created</span>
                  <span className="activity-time">{formatDateTime(contact.createdAt)}</span>
                </div>
                {contact.notes.map((n) => (
                  <div key={n.id} className="activity-item">
                    <span className="activity-icon"><StickyNote size={14} /></span>
                    <span className="activity-text">Note added: “{n.text.slice(0, 60)}”</span>
                    <span className="activity-time">{formatDateTime(n.createdAt)}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'notes',
            label: `Notes (${contact.notes.length})`,
            content: (
              <div className="contact-section">
                {canWrite && <div className="note-composer">
                  <label className="field-label" htmlFor="contact-note">Note</label>
                  <textarea
                    id="contact-note"
                    disabled={busy}
                    className="input"
                    rows={3}
                    placeholder="Write a note…"
                    data-testid="note-input"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button disabled={busy || !noteText.trim()} className="btn contacts-primary" data-testid="add-note-btn" onClick={addNote}>
                    Add note
                  </button>
                </div>}
                {contact.notes.length === 0 && <p className="muted">No notes yet. Add a note to keep context with this contact.</p>}
                {contact.notes.map((note) => (
                  <div key={note.id} className="note-item">
                    <p>{note.text}</p>
                    <div className="note-foot">
                      <span className="muted">{formatDateTime(note.createdAt)}</span>
                      <button
                        hidden={!canWrite}
                        disabled={busy}
                        className="link-btn"
                        onClick={() =>
                          persist({ ...contact, notes: contact.notes.filter((n) => n.id !== note.id) }, 'Note deleted.')
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'files',
            label: `Files (${contact.files.length})`,
            content: (
              <div className="contact-section">
                <button hidden={!canWrite} disabled={busy} className="btn" data-testid="attach-file-btn" onClick={() => fileInput.current?.click()}>
                  <Paperclip size={14} /> Attach file
                </button>
                <input ref={fileInput} type="file" hidden data-testid="file-input" onChange={onFileAttach} />
                <ul className="file-list">
                  {contact.files.length === 0 && <li className="muted">No files attached yet.</li>}
                  {contact.files.map((file) => (
                    <li key={file.id}>
                      <FileText size={14} /> {file.name} <span className="muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                      <button
                        hidden={!canWrite}
                        disabled={busy}
                        className="link-btn"
                        onClick={() =>
                          persist({ ...contact, files: contact.files.filter((f) => f.id !== file.id) }, 'File removed.')
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
