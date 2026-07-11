import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll, getAllSync } from '../data/store';
import { Account, Contact } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { classNames, initials } from '../utils';

export function Contacts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      setContacts(await getAll<Contact>('contacts'));
      setLoading(false);
    })();
  }, []);

  const accounts = getAllSync<Account>('accounts');
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, query]);

  return (
    <div data-testid="contacts-page">
      <div className="page-header">
        <h1>Contacts</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/contacts/new')}>
            + New Contact
          </button>
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              className={classNames('btn', view === 'grid' && 'btn-active')}
              aria-label="Grid view"
              data-testid="view-grid"
              onClick={() => setView('grid')}
            >
              ▦ Grid
            </button>
            <button
              className={classNames('btn', view === 'list' && 'btn-active')}
              aria-label="List view"
              data-testid="view-list"
              onClick={() => setView('list')}
            >
              ☰ List
            </button>
          </div>
        </div>
      </div>

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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
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
                <tr key={contact.id} className="row-clickable" onClick={() => navigate(`/contacts/${contact.id}`)}>
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
      )}
    </div>
  );
}
