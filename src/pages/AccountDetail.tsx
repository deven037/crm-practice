import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { getAll, getById, removeMany } from '../data/store';
import { Account, Contact, Deal, DEAL_STAGES, Quote, User } from '../types';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { canWriteAccounts } from './Accounts';
import { runRecoverable } from './accountRecovery';
import { formatCurrency, formatDate } from '../utils';
import { ContactFace } from './contacts/contactBits';
import { AccountCrest, CountUp, industryStyle, isOpenDeal, openPipeline, shortMoney } from './accounts/accountBits';

const STAGE_TONE: Record<string, string> = {
  Qualification: '#2f6fe0',
  Proposal: '#c98a12',
  Negotiation: '#6d4fd6',
  'Closed Won': '#17936a',
  'Closed Lost': '#8a93a6',
};

/** The account page: who the organisation is, its key figures, its deals by stage, and the people and quotes tied to it. */
export function AccountDetail() {
  const { id } = useParams();
  const toast = useToast();
  // The order of these states is relied on by the page tests; add new ones at the end.
  const [account, setAccount] = useState<Account | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [owner, setOwner] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascade, setCascade] = useState<'unlink' | 'cascade'>('unlink');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [siblings, setSiblings] = useState<Account[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = canWriteAccounts(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      try {
        const [a, c, d, q, users, all] = await Promise.all([
          getById<Account>('accounts', id ?? ''),
          getAll<Contact>('contacts'),
          getAll<Deal>('deals'),
          getAll<Quote>('quotes'),
          // Owner name and the previous/next arrows are extras: the page still opens without them.
          getAll<User>('users').catch((): User[] => []),
          getAll<Account>('accounts').catch((): Account[] => []),
        ]);
        if (!a) {
          setNotFound(true);
          removeViews([id ?? '']);
          return;
        }
        setNotFound(false);
        setLoadError(false);
        setAccount(a);
        setContacts(c.filter((x) => x.accountId === a.id));
        setDeals(d.filter((x) => x.accountId === a.id));
        setQuotes(q.filter((x) => x.accountId === a.id));
        setOwner(users.find((u) => u.id === a.ownerId) ?? null);
        setSiblings([...all].sort((x, y) => x.name.localeCompare(y.name)));
      } catch {
        setLoadError(true);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (account) recordView({ module: 'accounts', id: account.id, label: account.name, link: `/accounts/${account.id}`, meta: { Industry: account.industry } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Account not found. <Link to="/accounts">Back to accounts</Link>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="banner banner-error" role="alert" data-testid="account-load-error">
        This account couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (!account || account.id !== id) return <Spinner label="Loading account…" />;

  const openDeals = deals.filter(isOpenDeal);
  const won = deals.filter((d) => d.stage === 'Closed Won').reduce((sum, d) => sum + d.amount, 0);
  const position = siblings.findIndex((a) => a.id === account.id);
  const step = (by: number) => (position < 0 || siblings.length < 2 ? null : siblings[(position + by + siblings.length) % siblings.length]);
  const previous = step(-1);
  const next = step(1);
  const site = account.website.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const copyPhone = () => {
    navigator.clipboard?.writeText(account.phone).then(
      () => toast.push('success', 'Phone number copied.'),
      () => toast.push('error', 'Phone number could not be copied.'),
    );
  };

  const doDelete = () => runRecoverable(runDelete, { setBusy: setDeleteBusy, setError: setDeleteError });

  const runDelete = async () => {
    if (cascade === 'cascade') {
      // Delete related contacts and (closed) deals along with the account.
      await removeMany('contacts', contacts.map((c) => c.id));
      await removeMany('deals', deals.map((d) => d.id));
      removeViews([...contacts.map((c) => c.id), ...deals.map((d) => d.id)]);
    }
    await removeMany('accounts', [account.id]);
    removeViews([account.id]);
    toast.push('success', 'Account deleted.');
    navigate('/accounts');
  };

  return (
    <div className="acct3 acct-page" data-testid="account-detail-page" style={industryStyle(account.industry)}>
      <Link to="/accounts" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Accounts</Link>

      <section className="card acct-hero">
        <AccountCrest account={account} size="large" />
        <div className="acct-hero-id">
          <h1>{account.name}</h1>
          <p>
            <span className="acct-pill"><i />{account.industry || 'No industry'}</span>
            <span>Owner: <b>{owner?.name ?? '—'}</b></span>
            {account.website && (
              <a className="acct-link" href={account.website} target="_blank" rel="noreferrer">
                {site} <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            )}
          </p>
        </div>
        <div className="acct-hero-acts">
          {previous && <Link className="btn acct-sq" to={`/accounts/${previous.id}`} aria-label="Previous account" title={previous.name}><ChevronLeft size={16} /></Link>}
          {next && <Link className="btn acct-sq" to={`/accounts/${next.id}`} aria-label="Next account" title={next.name}><ChevronRight size={16} /></Link>}
          {canWrite && (
            <>
              <Link className="btn" data-testid="edit-account-btn" to={`/accounts/${account.id}/edit`}>
                <Pencil size={14} /> Edit
              </Link>
              <button className="btn btn-danger" data-testid="delete-account-btn" onClick={() => setDeleting(true)}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card acct-figs" aria-label="Key figures">
        <div className="acct-fig"><b title={formatCurrency(account.revenue)}><CountUp value={account.revenue} format={shortMoney} /></b><small>Annual revenue</small></div>
        <div className="acct-fig"><b><CountUp value={account.employees} format={(n) => Math.round(n).toLocaleString()} /></b><small>Employees</small></div>
        <div className="acct-fig"><b><CountUp value={openPipeline(deals)} format={shortMoney} /></b><small>Open pipeline · {openDeals.length} {openDeals.length === 1 ? 'deal' : 'deals'}</small></div>
        <div className="acct-fig"><b><CountUp value={won} format={shortMoney} /></b><small>Won to date</small></div>
      </section>

      <div className="acct-stack">
          <section className="card acct-box" data-testid="account-deals">
            <div className="acct-box-h"><h2>Deals</h2><span className="muted">{deals.length}</span></div>
            {deals.length === 0 ? <p className="muted acct-none">No deals for this account.</p> : (
              <div className="acct-track">
                {DEAL_STAGES.map((stage) => {
                  const inStage = deals.filter((d) => d.stage === stage);
                  return (
                    <div className="acct-lane" key={stage}>
                      <div className="acct-lane-h">
                        <i style={{ background: STAGE_TONE[stage] }} />{stage}
                        {inStage.length > 0 && <span>{shortMoney(inStage.reduce((sum, d) => sum + d.amount, 0))}</span>}
                      </div>
                      {inStage.length === 0 ? <div className="acct-lane-none">None</div> : inStage.map((deal, index) => (
                        <Link key={deal.id} className="acct-deal" to={`/deals/${deal.id}`} style={{ animationDelay: `${index * 70 + 120}ms` }}>
                          <b>{deal.name}</b>
                          <span>{formatCurrency(deal.amount)}</span>
                          <small>{isOpenDeal(deal) ? `${deal.probability}% · closes ${formatDate(deal.closeDate)}` : `Closed ${formatDate(deal.closeDate)}`}</small>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        <div className="acct-trio">
          <section className="card acct-box acct-fit" data-testid="account-quotes">
            <div className="acct-box-h"><h2>Quotes</h2><span className="muted">{quotes.length}</span></div>
            {quotes.length === 0 ? <p className="muted acct-none">No quotes for this account.</p> : (
              <div className="acct-scroll" tabIndex={0} role="group" aria-label="Quotes">
              {quotes.map((q) => (
              <div className="acct-qrow" key={q.id}>
                <Link className="acct-link" to={`/quotes/${q.id}`}>{q.quoteNumber}</Link>
                <span className={`pill ${QUOTE_STATUS_PILL[q.status]}`}>{q.status}</span>
                <b>{formatCurrency(computeQuoteTotals(q.lineItems).total)}</b>
              </div>
              ))}
              </div>
            )}
          </section>

          <section className="card acct-box acct-fit" data-testid="account-people">
            <div className="acct-box-h"><h2>People</h2><span className="muted">{contacts.length}</span></div>
            {contacts.length === 0 ? <p className="muted acct-none">No contacts linked to this account.</p> : (
              <div className="acct-people acct-scroll" tabIndex={0} role="group" aria-label="People">
                {contacts.map((c) => (
                  <Link key={c.id} className="acct-person" to={`/contacts/${c.id}`}>
                    <ContactFace contact={c} size="small" />
                    <div><b>{c.name}</b><small>{c.title || 'No title'}</small></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card acct-box">
            <div className="acct-box-h"><h2>Details</h2></div>
            <dl className="detail-list acct-details">
              <dt>Phone</dt>
              <dd className="acct-phone">
                <span>{account.phone || '—'}</span>
                {account.phone && <button type="button" className="btn acct-copy" onClick={copyPhone}><Copy size={13} aria-hidden="true" /> Copy</button>}
              </dd>
              <dt>Website</dt>
              <dd>
                {account.website ? (
                  <a className="acct-link" href={account.website} target="_blank" rel="noreferrer">
                    {site} <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Annual revenue</dt>
              <dd>{formatCurrency(account.revenue)}</dd>
              <dt>Page layout</dt>
              <dd>{account.layoutName || '—'}</dd>
              <dt>Added</dt>
              <dd>{formatDate(account.createdAt)}</dd>
              <CustomFieldsSection module="accounts" target="detail" mode="view" values={account.customFields ?? {}} />
            </dl>
          </section>
        </div>
      </div>

      {canWrite && deleting && openDeals.length > 0 && (
        <Modal
          title={`Can’t delete ${account.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <button className="btn" onClick={() => setDeleting(false)}>
              Close
            </button>
          }
        >
          <div className="banner banner-error" role="alert" data-testid="delete-blocked-banner">
            Close or reassign these {openDeals.length} open deal(s) first. The account stays as it is.
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

      {canWrite && deleting && openDeals.length === 0 && (
        <Modal
          title={`Delete ${account.name}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" disabled={deleteBusy} onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={deleteBusy} onClick={doDelete}>
                {deleteBusy ? 'Deleting…' : 'Delete account'}
              </button>
            </>
          }
        >
          {deleteError && (
            <div className="banner banner-error" role="alert">
              Account couldn’t be deleted. Some related records may have changed. Reload the page and check before you try again.
            </div>
          )}
          <p>
            This can’t be undone. Choose what happens to its <strong>{contacts.length} contact(s)</strong> and{' '}
            <strong>{deals.length} closed deal(s)</strong>.
          </p>
          <label className={`acct-choice${cascade === 'unlink' ? ' on' : ''}`}>
            <input type="radio" name="delete-mode" checked={cascade === 'unlink'} onChange={() => setCascade('unlink')} />
            Keep them, but unlink from this account
          </label>
          <label className={`acct-choice${cascade === 'cascade' ? ' on' : ''}`}>
            <input type="radio" name="delete-mode" checked={cascade === 'cascade'} onChange={() => setCascade('cascade')} />
            Delete the related contacts and closed deals too
          </label>
        </Modal>
      )}
    </div>
  );
}
