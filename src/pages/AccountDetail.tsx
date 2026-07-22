import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAll, getAllSync, getById, logAudit, removeMany, saveAll, upsert } from '../data/store';
import { Account, Contact, Deal, Quote } from '../types';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { Accordion } from '../components/Accordion';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency, formatDate } from '../utils';

export function AccountDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascade, setCascade] = useState<'unlink' | 'cascade'>('unlink');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const [a, c, d, q] = await Promise.all([
        getById<Account>('accounts', id ?? ''),
        getAll<Contact>('contacts'),
        getAll<Deal>('deals'),
        getAll<Quote>('quotes'),
      ]);
      if (!a) {
        setNotFound(true);
        return;
      }
      setAccount(a);
      setContacts(c.filter((x) => x.accountId === a.id));
      setDeals(d.filter((x) => x.accountId === a.id));
      setQuotes(q.filter((x) => x.accountId === a.id));
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

  const openDeals = deals.filter((d) => !d.stage.startsWith('Closed'));

  const doDelete = async () => {
    if (cascade === 'cascade') {
      // Delete related contacts and (closed) deals along with the account.
      await removeMany('contacts', contacts.map((c) => c.id));
      await removeMany('deals', deals.map((d) => d.id));
    } else {
      // Unlink: related records survive without an account.
      const allContacts = getAllSync<Contact>('contacts').map((c) =>
        c.accountId === account.id ? { ...c, accountId: null } : c
      );
      const allDeals = getAllSync<Deal>('deals').map((d) =>
        d.accountId === account.id ? { ...d, accountId: null } : d
      );
      await saveAll('contacts', allContacts);
      await saveAll('deals', allDeals);
    }
    await removeMany('accounts', [account.id]);
    logAudit(user?.name ?? 'Unknown', 'account.delete', `Deleted account ${account.name} (${cascade})`);
    toast.push('success', `Account "${account.name}" deleted.`);
    navigate('/accounts');
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
            <>
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
              <button className="btn btn-danger" data-testid="delete-account-btn" onClick={() => setDeleting(true)}>
                🗑 Delete
              </button>
            </>
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
            <CustomFieldsSection module="accounts" target="detail" mode="view" values={account.customFields ?? {}} />
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
              <CustomFieldsSection
                module="accounts"
                target="detail"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
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
            <Link to={`/deals/${deal.id}`}>View deal →</Link>
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

      <Accordion title="Quotes" badge={quotes.length}>
        {quotes.length === 0 && <p className="muted">No quotes for this account.</p>}
        <ul className="related-list">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link to={`/quotes/${q.id}`}>{q.quoteNumber}</Link>{' '}
              <span className="muted">
                — <span className={`pill ${QUOTE_STATUS_PILL[q.status]}`}>{q.status}</span> ·{' '}
                {formatCurrency(computeQuoteTotals(q.lineItems).total)}
              </span>
            </li>
          ))}
        </ul>
      </Accordion>

      {deleting && openDeals.length > 0 && (
        <Modal
          title="Cannot delete account"
          onClose={() => setDeleting(false)}
          footer={
            <button className="btn" onClick={() => setDeleting(false)}>
              Close
            </button>
          }
        >
          <div className="banner banner-error" role="alert" data-testid="delete-blocked-banner">
            This account has {openDeals.length} open deal(s). Close or delete them first.
          </div>
          <ul className="related-list">
            {openDeals.map((d) => (
              <li key={d.id}>
                <Link to={`/deals/${d.id}`} onClick={() => setDeleting(false)}>
                  {d.name}
                </Link>{' '}
                <span className="muted">— {d.stage} · {formatCurrency(d.amount)}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {deleting && openDeals.length === 0 && (
        <Modal
          title={`Delete account — ${account.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={doDelete}>
                Delete account
              </button>
            </>
          }
        >
          <p>
            This account has <strong>{contacts.length} contact(s)</strong> and <strong>{deals.length} closed deal(s)</strong>.
            What should happen to them?
          </p>
          <div className="field">
            <label className="checkbox-label">
              <input type="radio" name="delete-mode" checked={cascade === 'unlink'} onChange={() => setCascade('unlink')} />
              Keep them, but unlink from this account
            </label>
          </div>
          <div className="field">
            <label className="checkbox-label">
              <input type="radio" name="delete-mode" checked={cascade === 'cascade'} onChange={() => setCascade('cascade')} />
              Delete the related contacts and closed deals too
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
