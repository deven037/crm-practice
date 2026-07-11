import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAll, getById, upsert } from '../data/store';
import { Account, Contact, Deal } from '../types';
import { Accordion } from '../components/Accordion';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { formatCurrency, formatDate } from '../utils';

export function AccountDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Account | null>(null);

  useEffect(() => {
    (async () => {
      const [a, c, d] = await Promise.all([
        getById<Account>('accounts', id ?? ''),
        getAll<Contact>('contacts'),
        getAll<Deal>('deals'),
      ]);
      if (!a) {
        setNotFound(true);
        return;
      }
      setAccount(a);
      setContacts(c.filter((x) => x.accountId === a.id));
      setDeals(d.filter((x) => x.accountId === a.id));
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Account not found. <Link to="/accounts">Back to accounts</Link>
      </div>
    );
  }
  if (!account) return <Spinner label="Loading account…" />;

  const save = async () => {
    if (!draft) return;
    await upsert('accounts', draft);
    setAccount(draft);
    setEditing(false);
    toast.push('success', 'Account updated.');
  };

  return (
    <div data-testid="account-detail-page">
      <nav className="breadcrumbs">
        <Link to="/accounts">Accounts</Link> <span>/</span> <span>{account.name}</span>
      </nav>

      <div className="page-header">
        <h1>{account.name}</h1>
        <div className="page-actions">
          {!editing ? (
            <button
              className="btn"
              data-testid="edit-account-btn"
              onClick={() => {
                setDraft({ ...account });
                setEditing(true);
              }}
            >
              ✏️ Edit
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-account-btn" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {!editing ? (
          <dl className="detail-list">
            <dt>Industry</dt>
            <dd>{account.industry}</dd>
            <dt>Employees</dt>
            <dd>{account.employees.toLocaleString()}</dd>
            <dt>Annual revenue</dt>
            <dd>{formatCurrency(account.revenue)}</dd>
            <dt>Phone</dt>
            <dd>{account.phone}</dd>
            <dt>Website</dt>
            <dd>
              {account.website ? (
                <a href={account.website} target="_blank" rel="noreferrer">
                  {account.website} ↗
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        ) : (
          draft && (
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Industry</span>
                <input className="input" value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Employees</span>
                <input
                  className="input"
                  type="number"
                  value={draft.employees}
                  onChange={(e) => setDraft({ ...draft, employees: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <span className="field-label">Phone</span>
                <input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Website</span>
                <input className="input" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
              </div>
            </div>
          )
        )}
      </div>

      {/* Nested accordions: outer sections contain inner per-deal accordions */}
      <Accordion title="Related contacts" badge={contacts.length} defaultOpen>
        {contacts.length === 0 && <p className="muted">No contacts linked to this account.</p>}
        <ul className="related-list">
          {contacts.map((c) => (
            <li key={c.id}>
              <Link to={`/contacts/${c.id}`}>{c.name}</Link> <span className="muted">— {c.title || 'No title'}</span>
            </li>
          ))}
        </ul>
      </Accordion>

      <Accordion title="Related deals" badge={deals.length}>
        {deals.length === 0 && <p className="muted">No deals for this account.</p>}
        {deals.map((deal) => (
          <Accordion key={deal.id} title={`${deal.name} — ${formatCurrency(deal.amount)}`}>
            <dl className="detail-list">
              <dt>Stage</dt>
              <dd>{deal.stage}</dd>
              <dt>Probability</dt>
              <dd>{deal.probability}%</dd>
              <dt>Expected close</dt>
              <dd>{formatDate(deal.closeDate)}</dd>
            </dl>
          </Accordion>
        ))}
      </Accordion>
    </div>
  );
}
