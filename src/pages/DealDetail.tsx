import { CSSProperties, MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock, Flag, Pencil, Plus, Trash2, Trophy, Undo2, XCircle } from 'lucide-react';
import { getAll, getAllSync, getById, removeMany, upsert } from '../data/store';
import { Account, Contact, Deal, PageLayout, Quote, User } from '../types';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { classNames, formatCurrency, formatDate } from '../utils';
import { ContactFace } from './contacts/contactBits';
import { AccountCrest, CountUp, industryHue, shortMoney } from './accounts/accountBits';
import { canWriteDeals } from './Deals';
import { daysUntil, dueInfo, historyLines, isOpenStage, PlacedCard, placeCards, StageInfo, stageOf } from './deals/dealLogic';
import { bankStages, celebrate, ChanceRing, hueStyle, LostReasonDialog, movedDeal } from './deals/dealBits';

/**
 * The deal room: the deal's stage path you can click to move it, its four key figures, and the record page cards
 * the bank's page layout lists (next step, history, account, quotes and details as standard).
 */
export function DealDetail() {
  const { id } = useParams();
  const toast = useToast();
  // The order of these states is relied on by the page tests; add new ones at the end.
  const [deal, setDeal] = useState<Deal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [siblings, setSiblings] = useState<Deal[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [losing, setLosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = canWriteDeals(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      try {
        const [d, accounts, allContacts, allQuotes, allUsers, allDeals] = await Promise.all([
          getById<Deal>('deals', id ?? ''),
          // Everything around the deal is extra: the page still opens without it.
          getAll<Account>('accounts').catch((): Account[] => []),
          getAll<Contact>('contacts').catch((): Contact[] => []),
          getAll<Quote>('quotes').catch((): Quote[] => []),
          getAll<User>('users').catch((): User[] => []),
          getAll<Deal>('deals').catch((): Deal[] => []),
        ]);
        if (!d) {
          setNotFound(true);
          removeViews([id ?? '']);
          return;
        }
        setNotFound(false);
        setLoadError(false);
        setDeal(d);
        setAccount(accounts.find((a) => a.id === d.accountId) ?? null);
        setContacts(allContacts.filter((c) => d.accountId && c.accountId === d.accountId));
        setQuotes(allQuotes.filter((q) => q.dealId === d.id));
        setUsers(allUsers);
        setSiblings([...allDeals].sort((a, b) => Number(isOpenStage(b.stage)) - Number(isOpenStage(a.stage)) || a.closeDate.localeCompare(b.closeDate)));
      } catch {
        setLoadError(true);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (deal) recordView({ module: 'deals', id: deal.id, label: deal.name, link: `/deals/${deal.id}`, meta: { Stage: deal.stage } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Deal not found. <Link to="/deals">Back to deals</Link>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="banner banner-error" role="alert" data-testid="deal-load-error">
        This deal couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (!deal || deal.id !== id) return <Spinner label="Loading deal…" />;

  const stages = bankStages();
  const stage = stageOf(stages, deal.stage);
  const open = stages.filter((s) => s.kind === 'open');
  const at = open.findIndex((s) => s.name === deal.stage);
  const due = dueInfo(deal);
  const owner = users.find((u) => u.id === deal.ownerId)?.name ?? '—';
  const position = siblings.findIndex((d) => d.id === deal.id);
  const step = (by: number) => (position < 0 || siblings.length < 2 ? null : siblings[(position + by + siblings.length) % siblings.length]);
  const previous = step(-1);
  const next = step(1);
  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'deals');
  const layout = layouts.find((l) => l.name === deal.layoutName) ?? layouts.find((l) => l.isDefault);
  const cards = placeCards(layout?.cards, stage.kind === 'open' ? [] : ['nextStep']);
  const wonDeal = stage.kind === 'won';
  const isWonStage = (name: string) => stageOf(stages, name).kind === 'won';

  const store = async (updated: Deal, message: string) => {
    setBusy(true);
    try {
      const saved = await upsert('deals', updated);
      setDeal(saved);
      setSiblings((list) => list.map((d) => (d.id === saved.id ? saved : d)));
      toast.push('success', message);
    } catch {
      toast.push('error', 'The deal couldn’t be saved. Check your connection and try again.');
    }
    setBusy(false);
  };

  const moveTo = (target: StageInfo, e?: ReactMouseEvent) => {
    if (!canWrite || busy || target.name === deal.stage) return;
    if (target.kind === 'lost') {
      setLosing(true);
      return;
    }
    if (target.kind === 'won' && e) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      celebrate(r.left + r.width / 2, r.top + r.height / 2);
    }
    const updated = movedDeal(deal, target, stages);
    const reopened = !isOpenStage(deal.stage);
    store(updated, target.kind === 'won' ? 'Deal won. Nice work.' : `${reopened ? 'Reopened in' : 'Moved to'} ${target.name} · ${updated.probability}% chance.`);
  };

  const confirmLost = (reason: string) => {
    setLosing(false);
    const lostStage = stages.find((s) => s.kind === 'lost');
    if (lostStage) store(movedDeal(deal, lostStage, stages, reason), 'Marked as lost.');
  };

  const card = (c: PlacedCard) => {
    const style = { '--row': c.row } as CSSProperties;
    const cls = classNames('card deal-box', c.zone === 'main' ? 'deal-main' : 'deal-side', c.fill && 'deal-fill');
    switch (c.id) {
      case 'nextStep':
        return <NextStepCard key={c.id} className={cls} style={style} deal={deal} canWrite={canWrite} onSave={(text) => store({ ...deal, nextStep: text }, 'Next step saved.')} />;
      case 'history':
        return <HistoryCard key={c.id} className={cls} style={style} deal={deal} stages={stages} />;
      case 'account':
        return <AccountCard key={c.id} className={cls} style={style} account={account} contacts={contacts} />;
      case 'quotes':
        return <QuotesCard key={c.id} className={cls} style={style} quotes={quotes} canWrite={canWrite} dealId={deal.id} />;
      case 'details':
        return <DetailsCard key={c.id} className={cls} style={style} deal={deal} owner={owner} />;
    }
  };

  return (
    <div className="deal3 deal-page" data-testid="deal-detail-page">
      <Link to="/deals" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Deals</Link>

      <section className="card deal-hero" style={{ '--h': stage.hue } as CSSProperties}>
        {account ? <AccountCrest account={account} /> : <span className="acct-crest" style={{ '--h': '#8a93a6' } as CSSProperties} aria-hidden="true">–</span>}
        <div className="deal-hero-id">
          <h1>{deal.name}</h1>
          <p>
            <span className="deal-pill" style={hueStyle(stage.hue)} data-testid="deal-detail-stage"><i />{deal.stage}</span>
            {account ? <Link className="acct-link" to={`/accounts/${account.id}`}>{account.name}</Link> : <span>No account</span>}
            <span className={classNames('deal-due', due.tone)}>{due.tone === 'late' ? <AlertTriangle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}{due.text}</span>
          </p>
        </div>
        <div className="deal-hero-acts">
          {previous && <Link className="btn acct-sq" to={`/deals/${previous.id}`} aria-label="Previous deal" title={previous.name}><ChevronLeft size={16} /></Link>}
          {next && <Link className="btn acct-sq" to={`/deals/${next.id}`} aria-label="Next deal" title={next.name}><ChevronRight size={16} /></Link>}
          {canWrite && (
            <>
              <Link className="btn" data-testid="edit-deal-btn" to={`/deals/${deal.id}/edit`}>
                <Pencil size={14} /> Edit
              </Link>
              <button className="btn btn-danger" data-testid="delete-deal-btn" onClick={() => { setConfirmText(''); setDeleting(true); }}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card deal-pathcard" aria-label="Stage">
        <div className="deal-path" data-testid="deal-stage-path">
          {open.map((s, k) => {
            const state = wonDeal ? 'done' : stage.kind === 'lost' ? '' : k < at ? 'done' : k === at ? 'now' : '';
            return (
              <button
                type="button"
                key={s.name}
                className={classNames('deal-step', k === 0 && 'first', state)}
                style={{ '--c': wonDeal ? stage.hue : open[Math.max(0, at)]?.hue ?? stage.hue, animationDelay: `${k * 90}ms` } as CSSProperties}
                aria-current={state === 'now' ? 'step' : undefined}
                title={state === 'now' ? 'Current stage' : canWrite ? `Move to ${s.name}` : s.name}
                disabled={!canWrite || busy}
                onClick={(e) => moveTo(s, e)}
              >
                {state === 'done' && <Check size={15} aria-hidden="true" />}{s.name}
              </button>
            );
          })}
        </div>
        {stage.kind === 'open' ? (
          canWrite && (
            <div className="deal-closers">
              {stages.filter((s) => s.kind === 'won').map((s) => (
                <button key={s.name} type="button" className="btn deal-won-btn" data-testid="mark-won" disabled={busy} onClick={(e) => moveTo(s, e)}>
                  <Trophy size={16} aria-hidden="true" /> Mark won
                </button>
              ))}
              {stages.some((s) => s.kind === 'lost') && (
                <button type="button" className="btn deal-lost-btn" data-testid="mark-lost" disabled={busy} onClick={() => setLosing(true)}>
                  <XCircle size={16} aria-hidden="true" /> Mark lost
                </button>
              )}
            </div>
          )
        ) : (
          <div className={classNames('deal-outcome', stage.kind)} data-testid="deal-outcome">
            {wonDeal ? <Trophy size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" />}
            <span>{wonDeal ? 'Won' : 'Lost'} {daysUntil(deal.closeDate) === 0 ? 'today' : `on ${formatDate(deal.closeDate)}`}{!wonDeal && `: ${deal.lostReason || 'no reason given'}`}</span>
            {canWrite && open.length > 0 && (
              <button type="button" className="btn" data-testid="reopen-deal" disabled={busy} onClick={(e) => moveTo(open[open.length - 1], e)}>
                <Undo2 size={15} aria-hidden="true" /> Reopen
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card deal-figs" aria-label="Key figures">
        <div className="deal-fig"><b title={formatCurrency(deal.amount)}><CountUp value={deal.amount} format={shortMoney} /></b><small>Amount</small></div>
        <div className="deal-fig deal-fig-ring">
          <ChanceRing value={deal.probability} size={46} stroke={5} hue={stage.hue} delay={200} />
          <div><b><CountUp value={deal.probability} format={(n) => `${Math.round(n)}%`} /></b><small>Chance to win</small></div>
        </div>
        <div className="deal-fig"><b><CountUp value={(deal.amount * deal.probability) / 100} format={shortMoney} /></b><small>Weighted value</small></div>
        <div className="deal-fig">
          <b>{deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</b>
          <small>{isOpenStage(deal.stage) ? 'Expected close' : 'Closed'}{deal.closeDate ? `, ${new Date(deal.closeDate).getFullYear()}` : ''}</small>
        </div>
      </section>

      <div className="deal-grid">{cards.map(card)}</div>

      {losing && <LostReasonDialog deal={deal} onCancel={() => setLosing(false)} onConfirm={confirmLost} />}

      {canWrite && deleting && (
        <Modal
          title={`Delete ${deal.name}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" disabled={deleteBusy} onClick={() => setDeleting(false)}>
                Keep deal
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                disabled={deleteBusy || (isWonStage(deal.stage) && confirmText !== 'DELETE')}
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await removeMany('deals', [deal.id], isWonStage(deal.stage) ? 'DELETE' : undefined);
                    removeViews([deal.id]);
                    toast.push('success', `Deal "${deal.name}" deleted.`);
                    navigate('/deals');
                  } catch {
                    setDeleteBusy(false);
                    toast.push('error', 'The deal couldn’t be deleted. Reload the page and try again.');
                  }
                }}
              >
                {deleteBusy ? 'Deleting…' : 'Delete deal'}
              </button>
            </>
          }
        >
          <p>
            This can’t be undone. The deal and its history go.
            {quotes.length > 0 && ` Its ${quotes.length} ${quotes.length === 1 ? 'quote stays' : 'quotes stay'}, without a link to a deal.`}
          </p>
          {isWonStage(deal.stage) && (
            <>
              <div className="banner banner-error" role="alert" data-testid="closed-won-warning">
                This deal is won. Deleting it removes {formatCurrency(deal.amount)} from won totals and reports.
              </div>
              <div className="field">
                <label className="field-label" htmlFor="deal-delete-confirm">Type DELETE to confirm</label>
                <input id="deal-delete-confirm" className="input" data-testid="delete-confirm-input" placeholder="DELETE" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

interface CardProps {
  className: string;
  style: CSSProperties;
}

function NextStepCard({ className, style, deal, canWrite, onSave }: CardProps & { deal: Deal; canWrite: boolean; onSave: (text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(deal.nextStep ?? '');
  return (
    <section className={className} style={style} data-testid="deal-next-step">
      <div className="deal-box-h"><h2>Next step</h2></div>
      {editing ? (
        <form
          className="deal-next-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(text.trim());
            setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor="deal-next-input">Next step</label>
          <input id="deal-next-input" className="input" autoFocus maxLength={500} placeholder="What happens next, and who does it?" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="deal-acts">
            <button type="button" className="btn" onClick={() => { setText(deal.nextStep ?? ''); setEditing(false); }}>Cancel</button>
            <button type="submit" className="btn btn-primary contacts-primary">Save</button>
          </div>
        </form>
      ) : (
        <>
          <p className="deal-next"><Flag size={16} aria-hidden="true" /><span>{deal.nextStep || 'No next step yet. Add one so the deal keeps moving.'}</span></p>
          {canWrite && (
            <div className="deal-acts">
              <button type="button" className="btn" data-testid="change-next-step" onClick={() => { setText(deal.nextStep ?? ''); setEditing(true); }}>
                {deal.nextStep ? <><Pencil size={14} aria-hidden="true" /> Change next step</> : <><Plus size={15} aria-hidden="true" /> Add a next step</>}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function HistoryCard({ className, style, deal, stages }: CardProps & { deal: Deal; stages: StageInfo[] }) {
  const lines = historyLines(deal);
  return (
    <section className={className} style={style} data-testid="deal-history">
      <div className="deal-box-h"><h2>History</h2><span className="muted">{lines.length} {lines.length === 1 ? 'event' : 'events'}</span></div>
      <ol className="deal-tl deal-scroll" tabIndex={0} aria-label="Deal history">
        {lines.map((line, k) => (
          <li key={`${line.at}-${k}`} style={{ ...hueStyle(stageOf(stages, line.stage).hue), animationDelay: `${120 + Math.min(k, 8) * 60}ms` }}>
            <i />
            <b>{line.text}</b>
            <small>{formatDate(line.at)}{line.by ? ` · ${line.by}` : ''}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AccountCard({ className, style, account, contacts }: CardProps & { account: Account | null; contacts: Contact[] }) {
  return (
    <section className={className} style={style} data-testid="deal-account">
      <div className="deal-box-h"><h2>Account</h2></div>
      {!account ? <p className="muted deal-none">This deal is not linked to an account.</p> : (
        <>
          <div className="deal-accb">
            <AccountCrest account={account} />
            <div><b>{account.name}</b><span className="muted">{account.industry || 'No industry'}</span></div>
            <Link className="btn" to={`/accounts/${account.id}`}>Open <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
          {contacts.slice(0, 3).map((c) => (
            <Link key={c.id} className="acct-person" to={`/contacts/${c.id}`} style={{ '--h': industryHue(account.industry) } as CSSProperties}>
              <ContactFace contact={c} size="small" />
              <div><b>{c.name}</b><small>{c.title || 'No title'}</small></div>
            </Link>
          ))}
          {contacts.length > 3 && <Link className="acct-link deal-more" to={`/accounts/${account.id}`}>{contacts.length - 3} more people on the account</Link>}
        </>
      )}
    </section>
  );
}

function QuotesCard({ className, style, quotes, canWrite, dealId }: CardProps & { quotes: Quote[]; canWrite: boolean; dealId: string }) {
  return (
    <section className={className} style={style} data-testid="deal-quotes">
      <div className="deal-box-h"><h2>Quotes</h2><span className="muted">{quotes.length}</span></div>
      {quotes.length === 0 ? (
        <>
          <p className="muted deal-none">No quotes for this deal yet.</p>
          {canWrite && <Link className="btn deal-new-quote" to={`/quotes/new?deal=${dealId}`}><Plus size={15} aria-hidden="true" /> New quote</Link>}
        </>
      ) : quotes.map((q) => (
        <div className="acct-qrow" key={q.id}>
          <Link className="acct-link" to={`/quotes/${q.id}`}>{q.quoteNumber}</Link>
          <span className={`pill ${QUOTE_STATUS_PILL[q.status]}`}>{q.status}</span>
          <b>{formatCurrency(computeQuoteTotals(q.lineItems).total)}</b>
        </div>
      ))}
    </section>
  );
}

function DetailsCard({ className, style, deal, owner }: CardProps & { deal: Deal; owner: string }) {
  const campaign = getAllSync<{ id: string; name: string }>('campaigns').find((c) => c.id === deal.campaignId);
  return (
    <section className={className} style={style} data-testid="deal-details">
      <div className="deal-box-h"><h2>Details</h2></div>
      <dl className="detail-list acct-details">
        <dt>Owner</dt>
        <dd>{owner}</dd>
        <dt>Amount</dt>
        <dd>{formatCurrency(deal.amount)}</dd>
        <dt>Created</dt>
        <dd>{formatDate(deal.createdAt)}</dd>
        <dt>Campaign</dt>
        <dd>{campaign ? <Link className="acct-link" to={`/campaigns/${campaign.id}`}>{campaign.name}</Link> : '—'}</dd>
        <dt>Page layout</dt>
        <dd>{deal.layoutName || '—'}</dd>
        <CustomFieldsSection module="deals" target="detail" mode="view" values={deal.customFields ?? {}} />
      </dl>
    </section>
  );
}
