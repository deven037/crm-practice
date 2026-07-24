import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllSync, getById, newId, removeMany, upsert } from '../data/store';
import { Modal } from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { Account, Contact } from '../types';
import { Tabs } from '../components/Tabs';
import { MultiSelect } from '../components/Select';
import { SearchableSelect } from '../components/Select';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { formatDateTime, initials } from '../utils';

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
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const c = await getById<Contact>('contacts', id ?? '');
      if (!c) setNotFound(true);
      else setContact(c);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Contact not found. <Link to="/contacts">Back to contacts</Link>
      </div>
    );
  }
  if (!contact) return <Spinner label="Loading contact…" />;

  const accounts = getAllSync<Account>('accounts');
  const accountName = accounts.find((a) => a.id === contact.accountId)?.name;

  const persist = async (next: Contact, message: string) => {
    await upsert('contacts', next);
    setContact(next);
    toast.push('success', message);
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

  const addNote = () => {
    if (!noteText.trim()) return;
    persist(
      { ...contact, notes: [{ id: newId('note'), text: noteText.trim(), createdAt: new Date().toISOString() }, ...contact.notes] },
      'Note added.'
    );
    setNoteText('');
  };

  return (
    <div data-testid="contact-detail-page">
      <nav className="breadcrumbs">
        <Link to="/contacts">Contacts</Link> <span>/</span> <span>{contact.name}</span>
      </nav>

      <div className="detail-header">
        <div className="detail-avatar-wrap">
          <div className="contact-avatar contact-avatar-lg">
            {contact.avatar ? <img src={contact.avatar} alt={contact.name} /> : initials(contact.name)}
          </div>
          <button className="btn btn-small" data-testid="upload-avatar-btn" onClick={() => avatarInput.current?.click()}>
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
        <div className="page-actions" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-danger" data-testid="delete-contact-btn" onClick={() => setDeleting(true)}>
            🗑 Delete
          </button>
        </div>
      </div>

      {deleting && (
        <Modal
          title={`Delete contact — ${contact.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                onClick={async () => {
                  await removeMany('contacts', [contact.id]);
                  toast.push('success', `Contact "${contact.name}" deleted.`);
                  navigate('/contacts');
                }}
              >
                Delete contact
              </button>
            </>
          }
        >
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
              <div className="card">
                {!editing ? (
                  <>
                    <dl className="detail-list">
                      <dt>Email</dt>
                      <dd>{contact.email}</dd>
                      <dt>Phone</dt>
                      <dd>{contact.phone}</dd>
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
                      className="btn"
                      data-testid="edit-contact-btn"
                      onClick={() => {
                        setDraft({ ...contact });
                        setEditing(true);
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </>
                ) : (
                  draft && (
                    <div className="form-grid">
                      <div className="field">
                        <span className="field-label">Email</span>
                        <input className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                      </div>
                      <div className="field">
                        <span className="field-label">Phone</span>
                        <input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                      </div>
                      <div className="field">
                        <span className="field-label">Title</span>
                        <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      </div>
                      <div className="field">
                        <span className="field-label">Account</span>
                        <SearchableSelect
                          value={draft.accountId ?? ''}
                          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                          onChange={(v) => setDraft({ ...draft, accountId: v })}
                          placeholder="Search accounts…"
                        />
                      </div>
                      <div className="field field-span">
                        <span className="field-label">Tags</span>
                        <MultiSelect
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
                        values={draft.customFields ?? {}}
                        onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
                      />
                      <div className="field-span">
                        <button
                          className="btn btn-primary"
                          data-testid="save-contact-btn"
                          onClick={() => {
                            persist(draft, 'Contact updated.');
                            setEditing(false);
                          }}
                        >
                          Save
                        </button>{' '}
                        <button className="btn" onClick={() => setEditing(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            ),
          },
          {
            id: 'activity',
            label: 'Activity',
            content: (
              <div className="card">
                <div className="activity-item">
                  <span className="activity-icon">📅</span>
                  <span className="activity-text">Contact created</span>
                  <span className="activity-time">{formatDateTime(contact.createdAt)}</span>
                </div>
                {contact.notes.map((n) => (
                  <div key={n.id} className="activity-item">
                    <span className="activity-icon">📝</span>
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
              <div className="card">
                <div className="note-composer">
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Write a note…"
                    data-testid="note-input"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button className="btn btn-primary" data-testid="add-note-btn" onClick={addNote}>
                    Add note
                  </button>
                </div>
                {contact.notes.map((note) => (
                  <div key={note.id} className="note-item">
                    <p>{note.text}</p>
                    <div className="note-foot">
                      <span className="muted">{formatDateTime(note.createdAt)}</span>
                      <button
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
              <div className="card">
                <button className="btn" data-testid="attach-file-btn" onClick={() => fileInput.current?.click()}>
                  📎 Attach file
                </button>
                <input ref={fileInput} type="file" hidden data-testid="file-input" onChange={onFileAttach} />
                <ul className="file-list">
                  {contact.files.length === 0 && <li className="muted">No files attached yet.</li>}
                  {contact.files.map((file) => (
                    <li key={file.id}>
                      📄 {file.name} <span className="muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                      <button
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
