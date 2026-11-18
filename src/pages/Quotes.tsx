import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Hourglass, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { getAll, getAllSync, removeMany } from '../data/store';
import { Account, Deal, Quote, User } from '../types';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { needsApproval } from './quotes/quoteMath';
import {
  canWriteQuotes, expiringSoon, filterTest, FILTER_TITLE, firstYearOf, isDecided, matchesQuote, moneyShort, plural, QuoteFilter, quoteGroups, quoteSettingsNow,
  shortDay, validityOf, waitingApproval,
} from './quotes/quoteLogic';
import { QuoteFan, QuoteStatusPill, QuoteThumb, ValidityRing } from './quotes/quoteBits';

export const QUOTE_TOOLBOX_LINKS = [
  { label: 'Quote settings', to: '/setup/quote-settings' },
  { label: 'Rejection reasons', to: '/setup/status-codes' },
  { label: 'Custom fields', to: '/admin/objects/quotes' },
  { label: 'Customise page layout', to: '/setup/layouts/quotes' },
];

/**
 * The quotes desk: a fan chart of where quote value stands (each status a filter), the quotes waiting for
 * approval and those about to expire, then every quote grouped by who has to act next.
 */
export function Quotes() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteQuotes(user?.role);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QuoteFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getAll<Quote>('quotes');
        if (alive) setQuotes([...list]);
      } catch {
        if (alive) setFailed(true);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const settings = quoteSettingsNow();
  const accounts = getAllSync<Account>('accounts');
  const deals = getAllSync<Deal>('deals');
  const users = getAllSync<User>('users');
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Unknown account';
  const dealName = (id?: string | null) => (id ? deals.find((d) => d.id === id)?.name ?? '' : '');
  const now = Date.now();

  const searched = useMemo(
    () => quotes.filter((q) => matchesQuote(q, query, accountName(q.accountId), dealName(q.dealId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, query],
  );
  const shown = filter === 'all' ? searched : searched.filter(filterTest(filter, now, settings.discountLimit));
  const waiting = quotes.filter((q) => waitingApproval(q, settings.discountLimit));
  const soon = quotes.filter((q) => expiringSoon(q, now)).sort((a, b) => Date.parse(a.validUntil) - Date.parse(b.validUntil));
  const open = quotes.filter((q) => !isDecided(q));
  const openValue = open.reduce((t, q) => t + firstYearOf(q, settings), 0);

  const pick = (f: QuoteFilter) => setFilter(filter === f && f !== 'all' ? 'all' : f);
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const bulkDelete = async () => {
    setBusy(true);
    try {
      await removeMany('quotes', selected);
      setQuotes(quotes.filter((q) => !selected.includes(q.id)));
      toast.push('success', `${plural(selected.length, 'quote')} deleted.`);
      setSelected([]);
      setConfirming(false);
    } catch {
      toast.push('error', 'The quotes couldn’t be deleted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  let n = 0;
  const row = (q: Quote) => {
    const v = validityOf(q, now);
    const owner = users.find((u) => u.id === q.ownerId);
    const appr = q.status === 'Draft' && needsApproval(q, settings.discountLimit)
      ? (q.approval === 'approved' ? <span className="pq-apb ok"><ShieldCheck size={13} aria-hidden="true" />Approved</span>
        : q.approval === 'waiting' ? <span className="pq-apb"><ShieldCheck size={13} aria-hidden="true" />Waiting for approval</span>
          : <span className="pq-apb"><ShieldCheck size={13} aria-hidden="true" />Needs approval</span>)
      : null;
    return (
      <div key={q.id} className={classNames('pq-qr', selected.includes(q.id) && 'sel')} style={{ animationDelay: `${Math.min(n++, 14) * 30}ms` }}
        role="link" tabIndex={0} data-testid={`quote-row-${q.id}`}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('label, button, input')) navigate(`/quotes/${q.id}`); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/quotes/${q.id}`); }}>
        {canWrite ? (
          <label className="pq-ck"><input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} aria-label={`Select ${q.quoteNumber}`} /></label>
        ) : <span />}
        <QuoteThumb quote={q} />
        <span className="pq-qm">
          <span className="t"><b>{q.quoteNumber}</b><span>{accountName(q.accountId)}</span></span>
          <small>{dealName(q.dealId) || 'No deal'} · {plural(q.lineItems.length, 'line')}{owner ? ` · ${owner.name}` : ''}</small>
        </span>
        <span className={classNames('pq-vd', v.tone)}>
          {v.kind === 'draft' && <><Clock size={15} aria-hidden="true" /><span>Valid till <b>{shortDay(q.validUntil, now)}</b></span></>}
          {v.kind === 'left' && <><ValidityRing v={v} /><span><b>{plural(v.days, 'day')}</b> left</span></>}
          {v.kind === 'lapsed' && <><Hourglass size={15} aria-hidden="true" /><span><b>Past its date</b> · mark it expired</span></>}
          {v.kind === 'decided' && (q.status === 'Rejected'
            ? <span>{q.rejectReason || 'Rejected'}</span>
            : <span>{q.status} <b>{shortDay(q.decidedAt ?? q.validUntil, now)}</b></span>)}
        </span>
        <span className="pq-amt"><b>{moneyShort(firstYearOf(q, settings))}</b><small>first-year value</small></span>
        <span className="pq-stc"><QuoteStatusPill status={q.status} />{appr}</span>
      </div>
    );
  };

  const watchItem = (q: Quote, right: JSX.Element) => (
    <button key={q.id} type="button" className="pq-witem" onClick={() => navigate(`/quotes/${q.id}`)}><b>{q.quoteNumber}</b><span>{accountName(q.accountId)}</span>{right}</button>
  );

  return (
    <div className="pq3" data-testid="quotes-page">
      <div className="page-header">
        <div>
          <h1>Quotes</h1>
          <p className="pq-sub">{moneyShort(openValue)} first-year value still open across {plural(open.length, 'quote')}.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={QUOTE_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-quote" onClick={() => navigate('/quotes/new')}>
              <Plus size={16} aria-hidden="true" /> New quote
            </button>
          )}
        </div>
      </div>

      {failed && <div className="banner banner-error" role="alert">Quotes couldn’t load. Check your connection and reload the page.</div>}

      {!loading && !failed && quotes.length > 0 && (
        <div className="pq-qtop">
          <section className="pq-card-box pq-fanc">
            <div className="pq-box-h"><h2>Where quotes stand</h2><span className="pq-muted">by first-year value · pick a status to filter</span></div>
            <QuoteFan quotes={quotes} settings={settings} picked={filter} onPick={(s) => pick(s as QuoteFilter)} />
          </section>
          <div className="pq-watch">
            <section className="pq-card-box pq-wcard">
              <button type="button" className="pq-wh" aria-pressed={filter === 'approval'} data-testid="quote-filter-approval" onClick={() => pick('approval')}>
                <i className="ico warn"><ShieldCheck size={17} aria-hidden="true" /></i><span>Needs approval</span><b>{waiting.length}</b>
              </button>
              {waiting.slice(0, 3).map((q) => watchItem(q, <em className="warn">{Math.max(...q.lineItems.map((l) => l.discountPct))}% off</em>))}
              {waiting.length === 0 && <p className="pq-muted pq-small">Nothing waiting.</p>}
            </section>
            <section className="pq-card-box pq-wcard">
              <button type="button" className="pq-wh" aria-pressed={filter === 'soon'} data-testid="quote-filter-soon" onClick={() => pick('soon')}>
                <i className="ico late"><Hourglass size={17} aria-hidden="true" /></i><span>Expiring within 7 days</span><b>{soon.length}</b>
              </button>
              {soon.slice(0, 3).map((q) => {
                const v = validityOf(q, now);
                return watchItem(q, <em className={v.tone === 'late' || v.kind === 'lapsed' ? 'late' : 'warn'}>{v.kind === 'lapsed' ? 'past its date' : plural(v.days, 'day')}</em>);
              })}
              {soon.length === 0 && <p className="pq-muted pq-small">Nothing about to expire.</p>}
            </section>
          </div>
        </div>
      )}

      <div className="pq-tools">
        <div className="contact-find pq-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quote number, account or deal" aria-label="Search quotes" data-testid="quote-search" />
        </div>
        {filter !== 'all' && (
          <button type="button" className="pq-fchip set" onClick={() => setFilter('all')} data-testid="quote-filter-clear">{FILTER_TITLE[filter] ?? filter}<X size={14} aria-hidden="true" /></button>
        )}
      </div>

      {loading && <div className="pq-card-box pq-empty">Loading quotes…</div>}
      {!loading && !failed && quotes.length === 0 && (
        <div className="pq-card-box pq-empty"><b>No quotes yet</b>{canWrite ? 'Make the first one with New quote.' : ''}</div>
      )}
      {!loading && quotes.length > 0 && filter !== 'all' && (
        <section className="pq-grp">
          <div className="pq-grp-h"><h2>{FILTER_TITLE[filter] ?? filter}</h2><span>{shown.length}</span><button type="button" className="tk-link pq-right" onClick={() => setFilter('all')}>Show all quotes</button></div>
          <div className="pq-card-box pq-q">{shown.map(row)}{shown.length === 0 && <div className="pq-empty"><b>No quotes here</b></div>}</div>
        </section>
      )}
      {!loading && quotes.length > 0 && filter === 'all' && (
        <>
          {quoteGroups(shown).map((g) => (
            <section key={g.id} className="pq-grp" data-testid={`quote-group-${g.id}`}>
              <div className="pq-grp-h"><h2>{g.title}</h2><span>{g.sub}</span><span className="pq-gv">{g.list.length} · <b>{moneyShort(g.list.reduce((t, q) => t + firstYearOf(q, settings), 0))}</b></span></div>
              <div className="pq-card-box pq-q">{g.list.map(row)}</div>
            </section>
          ))}
          {shown.length === 0 && <div className="pq-card-box pq-empty"><b>No quote matches “{query}”</b></div>}
        </>
      )}

      {selected.length > 0 && (
        <div className="pq-selbar" role="region" aria-label="Selected quotes">
          <b>{selected.length} selected</b>
          <button type="button" className="btn" onClick={() => setSelected([])}>Clear</button>
          <button type="button" className="btn danger" data-testid="bulk-delete-quotes" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden="true" /> Delete</button>
        </div>
      )}
      {confirming && (
        <Modal title={`Delete ${plural(selected.length, 'quote')}?`} onClose={() => setConfirming(false)}
          footer={<><button className="btn" onClick={() => setConfirming(false)}>Cancel</button><button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={busy} onClick={bulkDelete}>Delete</button></>}>
          <p>{selected.map((id) => quotes.find((q) => q.id === id)?.quoteNumber).filter(Boolean).join(', ')}. This cannot be undone; the linked deals keep their history.</p>
        </Modal>
      )}
    </div>
  );
}
