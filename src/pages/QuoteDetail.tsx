import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Copy, Hourglass, MoreHorizontal, Pencil, Printer, Send, ShieldCheck, Trash2, Undo2, X } from 'lucide-react';
import { getAllSync, getById, removeMany } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Account, Contact, Deal, Quote, User } from '../types';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { classNames } from '../utils';
import { UserFace } from './tickets/ticketBits';
import { needsApproval, overLimit } from './quotes/quoteMath';
import { canWriteQuotes, dayText, firstYearOf, isDecided, mayApprove, moneyShort, quoteHue, quoteSettingsNow, shortDay } from './quotes/quoteLogic';
import { QuotePaper, QuoteStatusPill, RejectDialog } from './quotes/quoteBits';

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * A quote as the customer gets it (the paper, with a stamp once decided), beside its status track and the next
 * step, the discount approval, the records it belongs to and its history.
 */
export function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteQuotes(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();
  // The order of these states is relied on by page tests; add new ones at the end.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [stampFresh, setStampFresh] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    getById<Quote>('quotes', id ?? '', true).then(
      (found) => {
        if (!alive) return;
        if (!found) { setState('missing'); removeViews([id ?? '']); return; }
        setQuote(found);
        setState('ready');
      },
      (error) => {
        if (!alive) return;
        if ((error as { status?: number }).status === 404) { setState('missing'); removeViews([id ?? '']); } else setState('failed');
      },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (quote) recordView({ module: 'quotes', id: quote.id, label: quote.quoteNumber, link: `/quotes/${quote.id}`, meta: { Status: quote.status } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [menu]);

  if (state === 'loading') return <Spinner label="Loading quote…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This quote couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !quote) return <div className="empty-cell">Quote not found. <Link to="/quotes">Back to quotes</Link></div>;

  const settings = quoteSettingsNow();
  const account = getAllSync<Account>('accounts').find((a) => a.id === quote.accountId);
  const contact = getAllSync<Contact>('contacts').find((c) => c.accountId === quote.accountId);
  const deal = quote.dealId ? getAllSync<Deal>('deals').find((d) => d.id === quote.dealId) : undefined;
  const users = getAllSync<User>('users');
  const owner = users.find((u) => u.id === quote.ownerId);
  const approver = settings.approverId ? users.find((u) => u.id === settings.approverId) : undefined;
  const approverName = approver?.name ?? 'an admin';
  const needs = needsApproval(quote, settings.discountLimit);
  const over = overLimit(quote.lineItems, settings.discountLimit);
  const canDecide = mayApprove(user, settings);
  const customer = contact?.name ?? account?.name ?? 'the customer';

  const transition = async (status: Quote['status'], reason?: string, note?: string) => {
    setBusy(true);
    try {
      const { quote: saved, deal: closed } = await apiFetch<{ quote: Quote; deal?: Deal }>(`/quotes/${quote.id}/transition`, {
        method: 'POST', body: JSON.stringify({ status, reason, note }),
      });
      if (closed) getById<Deal>('deals', closed.id).catch(() => undefined); // refresh the cached deal
      setQuote(saved);
      setStampFresh(isDecided(saved));
      setRejecting(false);
      if (status === 'Sent') toast.push('success', `${saved.quoteNumber} sent to ${customer}.`);
      else if (status === 'Accepted') toast.push('success', closed ? `${saved.quoteNumber} accepted. “${closed.name}” moved to Closed Won.` : `${saved.quoteNumber} accepted.`);
      else if (status === 'Draft') { toast.push('success', 'Back to draft. Change what you need and send it again.'); navigate(`/quotes/${saved.id}/edit`); }
      else toast.push('success', `${saved.quoteNumber} marked ${status.toLowerCase()}.`);
    } catch (e) {
      toast.push('error', errorText(e, 'The quote couldn’t be updated. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const approval = async (decision: 'ask' | 'approve' | 'return') => {
    setBusy(true);
    try {
      const saved = await apiFetch<Quote>(`/quotes/${quote.id}/approval`, { method: 'POST', body: JSON.stringify({ decision }) });
      setQuote(saved);
      toast.push('success', decision === 'ask' ? `${approverName === 'an admin' ? 'An admin' : approverName} has been asked to approve.` : decision === 'approve' ? 'Approved. It can be sent now.' : 'Sent back to lower the discount.');
    } catch (e) {
      toast.push('error', errorText(e, 'That didn’t work. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await removeMany('quotes', [quote.id]);
      removeViews([quote.id]);
      toast.push('success', `Quote ${quote.quoteNumber} deleted.`);
      navigate('/quotes');
    } catch {
      toast.push('error', 'The quote couldn’t be deleted. Check your connection and try again.');
      setBusy(false);
    }
  };

  const reached = { Draft: 0, Sent: 1, Accepted: 2, Rejected: 2, Expired: 2 }[quote.status];
  const answer = isDecided(quote) ? quote.status : 'Answer';
  const steps = [
    { label: 'Draft', hue: quoteHue('Draft'), at: quote.createdAt, sub: 'Created' },
    { label: 'Sent', hue: quoteHue('Sent'), at: quote.sentAt, sub: `Sent to ${customer}` },
    { label: answer, hue: isDecided(quote) ? quoteHue(quote.status) : '#8a93a6', at: quote.decidedAt, sub: quote.status === 'Rejected' ? quote.rejectReason ?? 'Rejected' : quote.status === 'Accepted' ? 'Customer said yes' : quote.status === 'Expired' ? 'No answer in time' : 'Accepted, rejected or expired' },
  ];

  let actions: JSX.Element | null = null;
  if (canWrite && quote.status === 'Draft') {
    if (needs && quote.approval !== 'approved') {
      actions = quote.approval === 'waiting'
        ? <><button type="button" className="btn btn-primary contacts-primary" disabled><Send size={15} aria-hidden="true" /> Send to customer</button><p className="pq-small pq-muted">Sending opens once {approverName} approves.</p></>
        : <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="ask-approval" onClick={() => approval('ask')}><ShieldCheck size={15} aria-hidden="true" /> Ask {approver ? approver.name.split(' ')[0] : 'an admin'} to approve</button>;
    } else {
      actions = <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="send-quote" onClick={() => transition('Sent')}><Send size={15} aria-hidden="true" /> Send to customer</button>;
    }
  } else if (canWrite && quote.status === 'Sent') {
    actions = (
      <>
        <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="accept-quote" onClick={() => transition('Accepted')}><Check size={15} aria-hidden="true" /> Mark accepted</button>
        <div className="pq-two">
          <button type="button" className="btn" disabled={busy} data-testid="reject-quote" onClick={() => setRejecting(true)}><X size={15} aria-hidden="true" /> Rejected</button>
          <button type="button" className="btn" disabled={busy} data-testid="expire-quote" onClick={() => transition('Expired')}><Hourglass size={15} aria-hidden="true" /> Expired</button>
        </div>
      </>
    );
  } else if (quote.status === 'Accepted') {
    actions = <div className="pq-note ok"><Check size={16} aria-hidden="true" /><span>Accepted {dayText(quote.decidedAt)}.{deal ? ` “${deal.name}” is ${deal.stage}.` : ''} An accepted quote can’t change; duplicate it to quote again.</span></div>;
  } else if (canWrite) {
    actions = <><button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="revise-quote" onClick={() => transition('Draft')}><Undo2 size={15} aria-hidden="true" /> Revise and send again</button><p className="pq-small pq-muted">Goes back to Draft with a new validity date.</p></>;
  }

  return (
    <div className="pq3" data-testid="quote-detail-page">
      <Link to="/quotes" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> All quotes</Link>
      <div className="pq-qph">
        <div>
          <h1>{quote.quoteNumber} <QuoteStatusPill status={quote.status} /></h1>
          <p>{account?.name ?? 'Unknown account'} · {moneyShort(firstYearOf(quote, settings))} first-year value{owner ? ` · ${owner.name}` : ''}</p>
        </div>
        <div className="pq-acts">
          <button type="button" className="btn" onClick={() => window.print()} data-testid="print-quote"><Printer size={15} aria-hidden="true" /> Print or PDF</button>
          {canWrite && <Link to={`/quotes/new?from=${quote.id}`} className="btn" data-testid="duplicate-quote"><Copy size={15} aria-hidden="true" /> Duplicate</Link>}
          {canWrite && quote.status === 'Draft' && <Link to={`/quotes/${quote.id}/edit`} className="btn" data-testid="edit-quote-btn"><Pencil size={14} aria-hidden="true" /> Edit</Link>}
          {canWrite && (
            <div className="pq-menu" ref={menuRef}>
              <button type="button" className="btn pq-sq" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} data-testid="quote-more" onClick={() => setMenu(!menu)}><MoreHorizontal size={17} aria-hidden="true" /></button>
              {menu && (
                <div className="pq-pop right" role="menu">
                  <button type="button" role="menuitem" className="pq-opt danger" data-testid="delete-quote-btn" onClick={() => { setMenu(false); setDeleting(true); }}><Trash2 size={16} aria-hidden="true" /> Delete quote</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pq-qp">
        <div className="pq-paper-col">
          <QuotePaper quote={quote} account={account} contactName={contact?.name} deal={deal} owner={owner} settings={settings} stampFresh={stampFresh} />
        </div>
        <aside className="pq-stack">
          <section className="pq-card-box pq-box">
            <h2>Status</h2>
            <div className="pq-trk">
              {steps.map((s, i) => (
                <div key={s.label + i} className={classNames('pq-st', i < reached && 'done', i === reached && 'done now', i > reached && 'off')} style={{ '--c': s.hue } as CSSProperties}>
                  <i>{i <= reached && (i === 2 && quote.status !== 'Accepted' ? <X size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />)}</i>
                  <div><b>{s.label}</b><small>{i <= reached && s.at ? `${shortDay(s.at)} · ` : ''}{s.sub}</small></div>
                </div>
              ))}
            </div>
            {actions && <div className="pq-sacts">{actions}</div>}
          </section>

          {needs && (
            <section className="pq-card-box pq-box pq-appr" data-testid="quote-approval">
              <div className="pq-box-h"><h2>Discount approval</h2>
                {quote.approval === 'approved' ? <span className="pq-apb ok"><ShieldCheck size={14} aria-hidden="true" />Approved</span> : quote.approval === 'waiting' ? <span className="pq-apb"><ShieldCheck size={14} aria-hidden="true" />Waiting</span> : null}
              </div>
              <ul>{over.map((l) => <li key={l.id}><span>{l.productName}</span><span className="pq-dz over">−{l.discountPct}%</span></li>)}</ul>
              <div className="pq-who2">
                {approver ? <UserFace user={approver} large /> : <i className="tk-cav sm">A</i>}
                <div><b>{approver?.name ?? 'Any admin'}</b><small>approves discounts above {settings.discountLimit}%{quote.approvedBy ? ` · approved by ${quote.approvedBy}` : ''}</small></div>
              </div>
              {quote.status === 'Draft' && quote.approval === 'waiting' && canDecide && (
                <div className="pq-two">
                  <button type="button" className="btn" disabled={busy} data-testid="approve-quote" onClick={() => approval('approve')}><Check size={15} aria-hidden="true" /> Approve</button>
                  <button type="button" className="btn" disabled={busy} data-testid="return-quote" onClick={() => approval('return')}><Undo2 size={15} aria-hidden="true" /> Send back</button>
                </div>
              )}
            </section>
          )}

          <section className="pq-card-box pq-box">
            <h2>Linked</h2>
            <dl className="pq-kv">
              <div><dt>Account</dt><dd>{account ? <Link to={`/accounts/${account.id}`} className="tk-link">{account.name}</Link> : '—'}</dd></div>
              <div><dt>Deal</dt><dd>{deal ? <><Link to={`/deals/${deal.id}`} className="tk-link">{deal.name}</Link><span className="pq-tag">{deal.stage}</span></> : <span className="pq-muted">None</span>}</dd></div>
              <div><dt>Owner</dt><dd>{owner ? <><UserFace user={owner} />{owner.name}</> : '—'}</dd></div>
              <div><dt>Valid until</dt><dd>{dayText(quote.validUntil)}</dd></div>
            </dl>
          </section>

          <section className="pq-card-box pq-box">
            <h2>History</h2>
            <div className="pq-hist">
              {[...(quote.history ?? [])].reverse().map((e, i) => <div key={i}><time>{shortDay(e.at)}</time><span>{e.text}</span></div>)}
              {!quote.history?.length && <p className="pq-muted">No history yet.</p>}
            </div>
          </section>
        </aside>
      </div>

      {rejecting && <RejectDialog who={customer} onCancel={() => setRejecting(false)} onConfirm={(reason, note) => transition('Rejected', reason, note || undefined)} />}
      {deleting && (
        <Modal title={`Delete ${quote.quoteNumber}?`} onClose={() => setDeleting(false)}
          footer={<><button className="btn" onClick={() => setDeleting(false)}>Cancel</button><button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={busy} onClick={doDelete}>Delete quote</button></>}>
          <p>This cannot be undone.{deal ? ` The deal “${deal.name}” keeps its history.` : ''}</p>
        </Modal>
      )}
    </div>
  );
}
