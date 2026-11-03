import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getAll, getAllSync, removeMany } from '../data/store';
import { Account, Contact, Role } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { useToast } from '../components/Toast';
import { classNames, initials } from '../utils';

export function filterContacts(contacts: Contact[], query: string, role: Role | undefined, accounts: Account[]) {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const showDetails = role === 'admin' || role === 'rep';
  const digits = /^[\d\s\-()+.]+$/.test(q) ? q.replace(/\D/g, '') : '';
  return contacts.filter((c) => c.name.toLowerCase().includes(q) ||
    (accounts.find((a) => a.id === c.accountId)?.name ?? '').toLowerCase().includes(q) ||
    (showDetails && (c.email.toLowerCase().includes(q) || (digits.length >= 2 && c.phone.replace(/\D/g, '').includes(digits)))));
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

  const load = async () => {
    setLoading(true);
    setContacts(await getAll<Contact>('contacts'));
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
    toast.push('success', `${selected.length} contact(s) deleted.`);
    setSelected([]);
    load();
  };

  const accounts = getAllSync<Account>('accounts');
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';

  const filtered = useMemo(() => filterContacts(contacts, query, user?.role, accounts), [contacts, query, user?.role, accounts]);

  return (
    <div data-testid="contacts-page">
      <div className="page-header">
        <h1>Contacts</h1>
        <div className="page-actions">
          <button className="btn btn-create" onClick={() => setLayoutPickerOpen(true)}>
            + New Contact
          </button>
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              className={classNames('btn', view === 'grid' && 'btn-active')}
              aria-label="Grid view"
              data-testid="view-grid"
              onClick={() => {
                setView('grid');
                setSelected([]);
              }}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              className={classNames('btn', view === 'list' && 'btn-active')}
              aria-label="List view"
              data-testid="view-list"
              onClick={() => setView('list')}
            >
              <List size={14} /> List
            </button>
          </div>
        </div>
      </div>

      <ToolBoxPanel
        module="contacts"
        links={[
          { label: 'Dedupe Rule', to: '/setup/dedupe-rules' },
          { label: 'Import Data', to: '/setup/import' },
          { label: 'Custom Fields', to: '/admin/objects/contacts' },
          { label: 'Customise Page Layout', to: '/setup/layouts/contacts' },
        ]}
      />

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : view === 'grid' ? (
        <div className="contact-grid">
          {filtered.map((contact) => (
            <div key={contact.id} className="contact-card" onClick={() => navigate(`/contacts/${contact.id}`)}>
              <div className="contact-avatar">
                {contact.avatar ? <img src={contact.avatar} alt={contact.name} /> : initials(contact.name)}
              </div>
              <div className="contact-name">{contact.name}</div>
              <div className="contact-title muted">{contact.title}</div>
              <div className="contact-company">{accountName(contact.accountId)}</div>
              {/* Custom tooltip on truncated email — hover to reveal */}
              <div className="contact-email truncate has-tooltip" data-tooltip={contact.email}>
                {contact.email}
              </div>
              {contact.tags.length > 0 && (
                <div className="chip-row">
                  {contact.tags.map((tag) => (
                    <span key={tag} className="chip chip-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Actions revealed only on hover */}
              <div className="card-hover-actions">
                <Link to={`/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()} className="btn btn-small">
                  View profile
                </Link>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-cell">No contacts match “{query}”.</div>}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
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
                  </th>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Account</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr
                    key={contact.id}
                    className={classNames('row-clickable', selected.includes(contact.id) && 'row-selected')}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${contact.name}`}
                        checked={selected.includes(contact.id)}
                        onChange={() =>
                          setSelected((sel) => (sel.includes(contact.id) ? sel.filter((id) => id !== contact.id) : [...sel, contact.id]))
                        }
                      />
                    </td>
                    <td>
                      <span className="table-avatar">
                        {contact.avatar ? <img src={contact.avatar} alt="" /> : initials(contact.name)}
                      </span>
                      {contact.name}
                    </td>
                    <td>{contact.title}</td>
                    <td>{accountName(contact.accountId)}</td>
                    <td className="truncate has-tooltip" data-tooltip={contact.email}>
                      {contact.email}
                    </td>
                    <td>{contact.phone}</td>
                    <td>
                      {contact.tags.map((tag) => (
                        <span key={tag} className="chip chip-tag">
                          {tag}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BulkActionsBar count={selected.length} onClear={() => setSelected([])}>
            <button className="btn btn-danger" onClick={bulkDelete}>
              Delete
            </button>
          </BulkActionsBar>
        </>
      )}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="contacts" basePath="/contacts" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
