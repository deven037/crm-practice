import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, LayoutGrid, List, Mail, Phone, Plus, Search, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getAll, getAllSync, removeMany } from '../data/store';
import { Account, Contact, Role } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { useToast } from '../components/Toast';
import { removeRecentViews } from '../hooks/useRecentlyViewed';
import { classNames, formatDate } from '../utils';
import { allContactTags, ContactFace, filterByTags, groupContacts, hueStyle, TagPicker } from './contacts/contactBits';

/** The module's set-up shortcuts, shown under the ToolBox button. */
export const CONTACT_TOOLBOX_LINKS = [
  { label: 'Dedupe Rule', to: '/setup/dedupe-rules' },
  { label: 'Import Data', to: '/setup/import' },
  { label: 'Custom Fields', to: '/admin/objects/contacts' },
  { label: 'Customise Page Layout', to: '/setup/layouts/contacts' },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function filterContacts(contacts: Contact[], query: string, role: Role | undefined, accounts: Account[]) {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const showDetails = role === 'admin' || role === 'rep';
  const digits = /^[\d\s\-()+.]+$/.test(q) ? q.replace(/\D/g, '') : '';
  return contacts.filter((c) => c.name.toLowerCase().includes(q) ||
    (accounts.find((a) => a.id === c.accountId)?.name ?? '').toLowerCase().includes(q) ||
    (showDetails && (c.email.toLowerCase().includes(q) || (digits.length >= 2 && c.phone.replace(/\D/g, '').includes(digits)))));
}

export function canWriteContacts(role: Role | undefined) {
  return role === 'admin' || role === 'rep';
}

export function contactsEmptyKind(total: number, query: string): 'none-yet' | 'no-match' {
  return total === 0 && !query.trim() ? 'none-yet' : 'no-match';
}

// Focusable so keyboard users get the same full-email tooltip as hover (AIO-144 AC3).
export function EmailTooltip({ email, as: Tag, className }: { email: string; as: 'div' | 'td'; className?: string }) {
  return (
    <Tag className={classNames(className, 'truncate has-tooltip')} data-tooltip={email} tabIndex={0}>
      {email}
    </Tag>
  );
}

/** The quick look that stays beside the directory: who this is and how to reach them, without leaving the list. */
function ContactPeek({ contact, account, onCopy, onClose }: { contact: Contact; account: string | null; onCopy: (text: string, what: string) => void; onClose: () => void }) {
  const note = contact.notes[0];
  return (
    <aside className="card contact-peek" aria-label={`Quick look at ${contact.name}`} data-testid="contact-peek" style={hueStyle(contact.id)}>
      <div className="contact-band" />
      <button type="button" className="contact-peek-close" aria-label="Close quick look" data-testid="contact-peek-close" onClick={onClose}><X size={15} /></button>
      <ContactFace contact={contact} size="large" />
      <h2>{contact.name}</h2>
      <p className="muted">{contact.title || 'No title'}</p>
      {contact.accountId && account && (
        <Link className="contact-account" to={`/accounts/${contact.accountId}`}><Building2 size={14} aria-hidden="true" /> {account}</Link>
      )}
      <div className="contact-peek-acts">
        <button type="button" className="btn" onClick={() => onCopy(contact.email, 'Email')}><Mail size={15} aria-hidden="true" /> Copy email</button>
        <button type="button" className="btn" disabled={!contact.phone} onClick={() => onCopy(contact.phone, 'Phone number')}><Phone size={15} aria-hidden="true" /> Copy phone</button>
      </div>
      <dl className="contact-kv">
        <div><dt>Email</dt><dd>{contact.email}</dd></div>
        <div><dt>Phone</dt><dd>{contact.phone || '—'}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(contact.createdAt)}</dd></div>
      </dl>
      {contact.tags.length > 0 && <div className="contact-tags">{contact.tags.map((t) => <span key={t} className="contact-tag">{t}</span>)}</div>}
      <div className="contact-last">
        <span className="contact-eyebrow">Latest note</span>
        <p>{note ? <>{note.text} <span className="muted">· {formatDate(note.createdAt)}</span></> : <span className="muted">Nothing written yet.</span>}</p>
      </div>
      <Link className="btn btn-primary contact-wide" to={`/contacts/${contact.id}`}>Open profile <ChevronRight size={15} aria-hidden="true" /></Link>
    </aside>
  );
}

export function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [params] = useSearchParams();
  // Header search "See all": /contacts?q=term opens the list already filtered.
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const [loadError, setLoadError] = useState(false);
  const [groupBy, setGroupBy] = useState<'letter' | 'account'>('letter');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [peekId, setPeekId] = useState<string | null>(null);
  const canWrite = canWriteContacts(user?.role);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setContacts(await getAll<Contact>('contacts'));
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery, location.state]);

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected contact(s)? This cannot be undone.`)) return;
    await removeMany('contacts', selected);
    removeRecentViews(selected);
    toast.push('success', `${selected.length} contact(s) deleted.`);
    setSelected([]);
    load();
  };

  const accounts = getAllSync<Account>('accounts');
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';

  const filtered = useMemo(
    () => [...filterByTags(filterContacts(contacts, query, user?.role, accounts), tagFilter)].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts, query, user?.role, accounts, tagFilter],
  );
  const groups = groupContacts(filtered, groupBy, accountName);
  const letters = new Set(groupBy === 'letter' ? groups.map((g) => g.key) : []);
  const showRail = view === 'grid' && groupBy === 'letter';
  // The quick look stays closed until a person is clicked (owner, 2026-11-17).
  const peek = filtered.find((c) => c.id === peekId) ?? null;
  const ready = !loading && !loadError;

  /** On a wide screen a click shows the person in the quick look; on a narrow one, where it is hidden, it opens the profile. */
  const pick = (contact: Contact) => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1020px)').matches) navigate(`/contacts/${contact.id}`);
    else setPeekId(contact.id);
  };
  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.push('success', `${what} copied.`),
      () => toast.push('error', `${what} could not be copied.`),
    );
  };

  return (
    <div className={classNames('contact3 contact-list', !canWrite && 'viewer')} data-testid="contacts-page">
      <div className="page-header">
        <div>
          <h1>Contacts</h1>
          <p className="page-subtitle">People connected to your accounts.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={CONTACT_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-contact" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} /> New contact
            </button>
          )}
        </div>
      </div>

      <div className="toolbar contact-tools">
        <div className="contact-find">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            className="input search-input"
            aria-label="Search contacts"
            placeholder="Search name, account, email or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <TagPicker
          testId="tag-filter"
          label={<>Tags{tagFilter.length ? ` · ${tagFilter.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={allContactTags(contacts, false)}
          selected={tagFilter}
          onToggle={(tag) => setTagFilter((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]))}
        />
        {tagFilter.length > 0 && (
          <button type="button" className="btn btn-ghost" data-testid="clear-filters" onClick={() => setTagFilter([])}>
            Clear filters
          </button>
        )}
        <span className="contact-tools-gap" />
        {view === 'grid' && (
          <div className="seg contact-seg" role="group" aria-label="Group by">
            <button type="button" aria-pressed={groupBy === 'letter'} data-testid="group-letter" onClick={() => setGroupBy('letter')}>A to Z</button>
            <button type="button" aria-pressed={groupBy === 'account'} data-testid="group-account" onClick={() => setGroupBy('account')}>By account</button>
          </div>
        )}
        <div className="seg contact-seg" role="group" aria-label="View mode">
          <button
            type="button"
            aria-pressed={view === 'grid'}
            aria-label="Grid view"
            data-testid="view-grid"
            onClick={() => {
              setView('grid');
              setSelected([]);
            }}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button type="button" aria-pressed={view === 'list'} aria-label="List view" data-testid="view-list" onClick={() => setView('list')}>
            <List size={14} /> List
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : loadError ? (
        <div className="banner banner-error contacts-error" role="alert" data-testid="contacts-load-error">
          <p>Contacts couldn’t load. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={load}>
            Retry
          </button>
        </div>
      ) : filtered.length > 0 && (
        <div className={classNames('contact-dir', !showRail && 'no-rail', !peek && 'no-peek')}>
          <div className="contact-dir-main">
            {view === 'grid' ? (
              groups.map((group) => (
                <section key={group.key} className="contact-group" id={`contact-group-${group.key}`}>
                  <h2 className="contact-group-head">
                    {groupBy === 'account' && <Building2 size={15} aria-hidden="true" />}
                    <b>{group.key}</b>
                    <small>{group.contacts.length} {group.contacts.length === 1 ? 'person' : 'people'}</small>
                  </h2>
                  <div className="contact-people">
                    {group.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="contact-card"
                        tabIndex={0}
                        aria-current={peek?.id === contact.id ? 'true' : undefined}
                        style={{ animationDelay: `${Math.min(filtered.indexOf(contact), 14) * 30}ms` }}
                        onClick={() => pick(contact)}
                        onDoubleClick={() => navigate(`/contacts/${contact.id}`)}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            pick(contact);
                          }
                        }}
                      >
                        <ContactFace contact={contact} />
                        <div className="contact-card-text">
                          <Link to={`/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()} className="contact-name">
                            {contact.name}
                          </Link>
                          <small>{groupBy === 'letter' && contact.accountId ? accountName(contact.accountId) : contact.title || 'No title'}</small>
                          {contact.tags.length > 0 && (
                            <div className="contact-tags">
                              <span className="contact-tag">{contact.tags[0]}</span>
                              {contact.tags.length > 1 && <span className="contact-tag">+{contact.tags.length - 1}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="card table-wrap contact-table">
                <table className="table">
                  <thead>
                    <tr>
                      {canWrite && <th className="checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={filtered.length > 0 && filtered.every((c) => selected.includes(c.id))}
                          onChange={() =>
                            setSelected((sel) =>
                              filtered.every((c) => sel.includes(c.id)) ? sel.filter((id) => !filtered.some((c) => c.id === id)) : [...new Set([...sel, ...filtered.map((c) => c.id)])]
                            )
                          }
                        />
                      </th>}
                      <th>Name</th>
                      <th>Account</th>
                      <th>Email</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((contact) => (
                      <tr
                        key={contact.id}
                        className={classNames('row-clickable', selected.includes(contact.id) && 'row-selected', peek?.id === contact.id && 'row-current')}
                        onClick={() => pick(contact)}
                      >
                        {canWrite && <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${contact.name}`}
                            checked={selected.includes(contact.id)}
                            onChange={() =>
                              setSelected((sel) => (sel.includes(contact.id) ? sel.filter((id) => id !== contact.id) : [...sel, contact.id]))
                            }
                          />
                        </td>}
                        <td>
                          <div className="contact-who">
                            <ContactFace contact={contact} size="small" />
                            <div>
                              <Link to={`/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()}>
                                {contact.name}
                              </Link>
                              <small>{contact.title || 'No title'}</small>
                            </div>
                          </div>
                        </td>
                        <td>{accountName(contact.accountId)}</td>
                        <EmailTooltip as="td" email={contact.email} />
                        <td className="contact-phone">{contact.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {showRail && (
            <nav className="contact-rail" aria-label="Jump to letter">
              {LETTERS.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  disabled={!letters.has(letter)}
                  onClick={() => document.getElementById(`contact-group-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {letter}
                </button>
              ))}
            </nav>
          )}
          {peek && <ContactPeek key={peek.id} contact={peek} account={peek.accountId ? accountName(peek.accountId) : null} onCopy={copy} onClose={() => setPeekId(null)} />}
        </div>
      )}

      {ready && view === 'list' && canWrite && (
        <BulkActionsBar count={selected.length} onClear={() => setSelected([])}>
          <button className="btn btn-danger" onClick={bulkDelete}>
            Delete
          </button>
        </BulkActionsBar>
      )}

      {ready && filtered.length === 0 &&
        (contactsEmptyKind(contacts.length, query) === 'none-yet' && tagFilter.length === 0 ? (
          <div className="empty-cell" data-testid="contacts-empty">
            <strong>No contacts yet</strong>
            <p>When you add a contact, they’ll appear here.</p>
            {canWrite && (
              <button className="btn btn-primary contacts-primary" onClick={() => setLayoutPickerOpen(true)}>
                <Plus size={16} /> New contact
              </button>
            )}
          </div>
        ) : (
          <div className="empty-cell" data-testid="contacts-no-match">
            {query.trim() ? `No contacts match “${query}”.` : 'No contacts have these tags.'}
          </div>
        ))}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="contacts" basePath="/contacts" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
