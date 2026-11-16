import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, Database, Hourglass, LogOut, Moon, PauseCircle, RefreshCw, Search, ShieldCheck, Sun, Users as UsersIcon, XCircle } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  BANK_TYPES, BankAction, BankStatus, clearPlatformToken, ConsoleBank, decideBank, deleteBank, getPlatformToken, platformBankImage,
  platformBanks, platformLogin,
} from '../data/frontDoor';
import { getValue, setValue } from '../data/store';
import { Modal } from '../components/Modal';
import { SlideOver } from '../components/SlideOver';
import { useToast } from '../components/Toast';
import { AnimatedNumber, EmptyState } from '../components/v3';
import { applyBankTheme } from '../theme/bankTheme';
import { ProductMark } from './frontdoor/FrontDoorShell';
import { Field, Notice, PasswordField, SubmitButton } from './frontdoor/fields';
import { countryName } from './register/registration';

const STATUS_LABEL: Record<BankStatus, string> = { pending: 'Pending', active: 'Active', suspended: 'Suspended', rejected: 'Rejected' };
const ADMIN_KEY = 'crm.platformAdmin';
type Filter = BankStatus | 'all';

/** What the platform owner may do to a bank in each state, in the order the buttons are shown. */
export const ACTIONS: Record<BankStatus, BankAction[]> = {
  pending: ['approve', 'reject'],
  active: ['suspend'],
  suspended: ['reactivate'],
  rejected: ['approve'],
};
const ACTION_COPY: Record<BankAction, { label: string; done: string; needsReason: boolean; primary: boolean; ask: string }> = {
  approve: { label: 'Approve', done: 'approved', needsReason: false, primary: true, ask: '' },
  reject: { label: 'Reject', done: 'rejected', needsReason: true, primary: false, ask: 'The bank sees this reason when it checks its registration.' },
  suspend: { label: 'Suspend', done: 'suspended', needsReason: true, primary: false, ask: 'Nobody at the bank can sign in while it is suspended. Its data is kept.' },
  reactivate: { label: 'Reactivate', done: 'reactivated', needsReason: false, primary: true, ask: '' },
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');
const typeLabel = (value: string) => BANK_TYPES.find((t) => t.value === value)?.label ?? value;

/** Filters the console's list by state and by what was typed in the search box. */
export function filterBanks(banks: ConsoleBank[], filter: Filter, query: string): ConsoleBank[] {
  const q = query.trim().toLowerCase();
  return banks.filter(
    (bank) =>
      (filter === 'all' || bank.status === filter) &&
      (!q || [bank.displayName, bank.profile.legalName, bank.adminEmail, ...bank.profile.emailDomains].some((text) => text?.toLowerCase().includes(q)))
  );
}

function StatusPill({ status }: { status: BankStatus }) {
  return <span className={`pill pc-status pc-status-${status}`}>{STATUS_LABEL[status]}</span>;
}

function Initial({ bank }: { bank: ConsoleBank }) {
  return (
    <span className="pc-initial" style={{ background: bank.profile.brandColor || 'var(--bank-primary)' }} aria-hidden="true">
      {bank.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

function SignIn({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const admin = await platformLogin(email.trim(), password);
      onDone(admin.email);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pc-gate" data-testid="platform-login">
      <div className="fd-orb fd-orb-a" />
      <div className="fd-orb fd-orb-b" />
      <motion.form className="pc-gate-card" onSubmit={submit} noValidate initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <ProductMark />
        <span className="fd-badge-icon"><ShieldCheck size={22} /></span>
        <h1>Platform console</h1>
        <p className="fd-sub">For the platform owner: review bank registrations and manage every bank.</p>
        {error && <Notice testId="platform-login-error">{error}</Notice>}
        <Field label="Email" type="email" testId="platform-email" autoFocus autoComplete="username" value={email} onChange={setEmail} />
        <PasswordField label="Password" testId="platform-password" autoComplete="current-password" value={password} onChange={setPassword} />
        <SubmitButton busy={busy} busyLabel="Signing in…" testId="platform-submit">Sign in</SubmitButton>
        <Link to="/login" className="fd-link fd-link-row">Bank sign-in</Link>
      </motion.form>
    </div>
  );
}

/** Everything a bank registered with, its pictures, and the decisions the owner can take. */
function BankPanel({ bank, onClose, onAction, onDelete }: { bank: ConsoleBank; onClose: () => void; onAction: (action: BankAction) => void; onDelete: () => void }) {
  const [images, setImages] = useState<Partial<Record<'logo' | 'login', string>>>({});

  // A pending bank's pictures are not public, so they are fetched with the console's own token.
  useEffect(() => {
    let current = true;
    const made: string[] = [];
    for (const kind of ['logo', 'login'] as const) {
      if (!bank.assets[kind]) continue;
      platformBankImage(bank.id, kind).then(
        (url) => {
          made.push(url);
          if (current) setImages((i) => ({ ...i, [kind]: url }));
        },
        () => undefined
      );
    }
    return () => {
      current = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [bank.id, bank.assets]);

  const p = bank.profile;
  const facts: [string, string | number | undefined][] = [
    ['Legal name', p.legalName], ['Type', typeLabel(p.bankType)], ['Licence or registration', p.registrationNumber], ['Country', countryName(p.country)],
    ['Head office', p.address], ['Website', p.website], ['Contact person', p.contactName], ['Phone', p.contactPhone], ['Contact email', p.contactEmail],
    ['Email domains', p.emailDomains.map((d) => `@${d}`).join(', ')], ['Currency', p.currency], ['Language and region', p.locale], ['Timezone', p.timezone],
    ['Branches', p.branches], ['Expected users', p.expectedUsers], ['Sample data', p.sampleData ? 'Yes' : 'No'],
    ['First admin', bank.adminEmail], ['Registered', day(bank.createdAt)], ['Decided', day(bank.decidedAt)],
  ];

  return (
    <SlideOver
      title={bank.displayName}
      onClose={onClose}
      testId="platform-bank-panel"
      footer={
        <>
          {bank.id !== 'bank-demo' && <button className="btn pc-delete" data-testid="platform-delete" onClick={onDelete}>Delete</button>}
          {ACTIONS[bank.status].map((action) => (
            <button key={action} className={`btn${ACTION_COPY[action].primary ? ' btn-primary' : ''}`} data-testid={`platform-${action}`} onClick={() => onAction(action)}>
              {ACTION_COPY[action].label}
            </button>
          ))}
        </>
      }
    >
      <div className="pc-panel-head">
        {images.logo ? <img className="pc-panel-logo" src={images.logo} alt={`${bank.displayName} logo`} /> : <Initial bank={bank} />}
        <div>
          <StatusPill status={bank.status} />
          <p><i className="pc-swatch" style={{ background: p.brandColor }} /> {p.brandColor} · {bank.users} user{bank.users === 1 ? '' : 's'} · {bank.records.toLocaleString()} records</p>
        </div>
      </div>
      {bank.statusReason && <div className="banner banner-info" data-testid="platform-reason"><strong>Reason: </strong>{bank.statusReason}</div>}
      {images.login && <img className="pc-panel-image" src={images.login} alt={`${bank.displayName} sign-in picture`} />}
      <dl className="pc-facts">
        {facts.filter(([, value]) => value !== undefined && value !== '').map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </SlideOver>
  );
}

export function PlatformConsole() {
  const toast = useToast();
  const [signedIn, setSignedIn] = useState(() => Boolean(getPlatformToken()));
  const [adminEmail, setAdminEmail] = useState(() => sessionStorage.getItem(ADMIN_KEY) ?? '');
  const [banks, setBanks] = useState<ConsoleBank[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ bank: ConsoleBank; action: BankAction } | null>(null);
  const [deleting, setDeleting] = useState<ConsoleBank | null>(null);
  const [reason, setReason] = useState('');
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<string>(() => getValue('theme', 'light'));

  // The console is the platform's own page: always the Harbor colour, never a bank's.
  useEffect(() => {
    applyBankTheme(null, false);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setValue('theme', theme);
  }, [theme]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await platformBanks();
      setBanks(list);
      return list;
    } catch (error) {
      if (!getPlatformToken()) setSignedIn(false);
      else setLoadError((error as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    load().then((list) => {
      // Open on what needs a decision; with nothing pending, show everything.
      if (list && !list.some((bank) => bank.status === 'pending')) setFilter('all');
    });
  }, [signedIn, load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: banks?.length ?? 0, pending: 0, active: 0, suspended: 0, rejected: 0 };
    for (const bank of banks ?? []) c[bank.status]++;
    return c;
  }, [banks]);
  const shown = useMemo(() => filterBanks(banks ?? [], filter, query), [banks, filter, query]);
  const open = banks?.find((bank) => bank.id === openId) ?? null;

  const signOut = () => {
    clearPlatformToken();
    sessionStorage.removeItem(ADMIN_KEY);
    setBanks(null);
    setSignedIn(false);
  };

  const act = async (bank: ConsoleBank, action: BankAction, why?: string) => {
    setBusy(true);
    try {
      await decideBank(bank.id, action, why);
      toast.push('success', `${bank.displayName} ${ACTION_COPY[action].done}.`);
      setAsking(null);
      setReason('');
      await load();
    } catch (error) {
      toast.push('error', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startAction = (bank: ConsoleBank, action: BankAction) => {
    if (ACTION_COPY[action].needsReason) {
      setReason('');
      setAsking({ bank, action });
    } else {
      act(bank, action);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBank(deleting.id);
      toast.push('success', `${deleting.displayName} deleted.`);
      setDeleting(null);
      setOpenId(null);
      await load();
    } catch (error) {
      toast.push('error', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <MotionConfig reducedMotion="user">
        <SignIn onDone={(email) => { sessionStorage.setItem(ADMIN_KEY, email); setAdminEmail(email); setSignedIn(true); }} />
      </MotionConfig>
    );
  }

  const tiles: { key: Filter; label: string; icon: typeof Hourglass; value: number }[] = [
    { key: 'pending', label: 'Waiting for you', icon: Hourglass, value: counts.pending },
    { key: 'active', label: 'Active banks', icon: Check, value: counts.active },
    { key: 'suspended', label: 'Suspended', icon: PauseCircle, value: counts.suspended },
    { key: 'rejected', label: 'Rejected', icon: XCircle, value: counts.rejected },
  ];
  const totalUsers = (banks ?? []).reduce((sum, bank) => sum + bank.users, 0);
  const totalRecords = (banks ?? []).reduce((sum, bank) => sum + bank.records, 0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="pc-shell" data-testid="platform-console">
        <header className="pc-top">
          <ProductMark />
          <span className="pc-top-tag">Platform console</span>
          <div className="pc-top-right">
            <span className="pc-who" title={adminEmail}>{adminEmail}</span>
            <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="btn" data-testid="platform-sign-out" onClick={signOut}><LogOut size={15} /> Sign out</button>
          </div>
        </header>

        <main className="pc-main">
          <div className="pc-heading">
            <div>
              <h1>Banks</h1>
              <p className="page-subtitle">
                <UsersIcon size={14} aria-hidden="true" /> <AnimatedNumber value={totalUsers} /> users · <Database size={14} aria-hidden="true" /> <AnimatedNumber value={totalRecords} /> records across {counts.all} bank{counts.all === 1 ? '' : 's'}
              </p>
            </div>
            <button className="btn" onClick={() => load()} data-testid="platform-refresh"><RefreshCw size={15} /> Refresh</button>
          </div>

          <div className="pc-tiles">
            {tiles.map((tile, i) => (
              <motion.button
                key={tile.key}
                type="button"
                className={`pc-tile pc-tile-${tile.key}${filter === tile.key ? ' is-on' : ''}`}
                aria-pressed={filter === tile.key}
                data-testid={`platform-tile-${tile.key}`}
                onClick={() => setFilter(filter === tile.key ? 'all' : tile.key)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="pc-tile-icon"><tile.icon size={18} /></span>
                <span className="pc-tile-label">{tile.label}</span>
                <strong><AnimatedNumber value={tile.value} /></strong>
                {tile.key === 'pending' && tile.value > 0 && <i className="pc-ping" aria-hidden="true" />}
              </motion.button>
            ))}
          </div>

          <div className="pc-toolbar">
            <div className="segmented" role="tablist" aria-label="Show banks">
              {(['all', 'pending', 'active', 'suspended', 'rejected'] as Filter[]).map((key) => (
                <button key={key} role="tab" aria-selected={filter === key} className={`segmented-option${filter === key ? ' active' : ''}`} data-testid={`platform-filter-${key}`} onClick={() => setFilter(key)}>
                  {key === 'all' ? 'All' : STATUS_LABEL[key]} <span className="pc-count">{counts[key]}</span>
                </button>
              ))}
            </div>
            <div className="input-icon-wrap pc-search">
              <span className="input-icon"><Search size={15} /></span>
              <input type="search" className="input" placeholder="Search name, domain or admin email" aria-label="Search banks" data-testid="platform-search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {loadError ? (
            <div className="banner banner-error" role="alert">
              {loadError} <button className="btn-link" onClick={() => load()}>Try again</button>
            </div>
          ) : banks === null ? (
            <div className="skeleton-list" role="status" aria-label="Loading banks">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-row pc-skeleton" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="card">
              <EmptyState title={filter === 'pending' && !query ? 'Nothing is waiting for you' : 'No banks match'} testId="platform-empty">
                {filter === 'pending' && !query ? 'New bank registrations appear here for you to approve or reject.' : 'Try a different filter or search.'}
              </EmptyState>
            </div>
          ) : (
            <ul className="pc-list" data-testid="platform-banks">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((bank, i) => (
                  <motion.li
                    key={bank.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i, 8) * 0.035, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className={`pc-bank pc-bank-${bank.status}`}
                    data-testid={`platform-bank-${bank.id}`}
                  >
                    <button type="button" className="pc-bank-open" onClick={() => setOpenId(bank.id)} aria-label={`Open ${bank.displayName}`}>
                      <Initial bank={bank} />
                      <span className="pc-bank-name">
                        <strong>{bank.displayName}</strong>
                        <small>{typeLabel(bank.profile.bankType)} · {countryName(bank.profile.country)} · {bank.profile.emailDomains.map((d) => `@${d}`).join(', ')}</small>
                      </span>
                      <span className="pc-bank-meta"><Building2 size={14} aria-hidden="true" /> {bank.profile.branches.toLocaleString()} branch{bank.profile.branches === 1 ? '' : 'es'}</span>
                      <span className="pc-bank-meta"><UsersIcon size={14} aria-hidden="true" /> {bank.users}</span>
                      <span className="pc-bank-meta pc-bank-date">{day(bank.createdAt)}</span>
                      <StatusPill status={bank.status} />
                    </button>
                    {bank.status === 'pending' && (
                      <span className="pc-bank-quick">
                        <button className="btn btn-small" data-testid={`platform-quick-reject-${bank.id}`} onClick={() => startAction(bank, 'reject')}>Reject</button>
                        <button className="btn btn-small btn-primary" data-testid={`platform-quick-approve-${bank.id}`} disabled={busy} onClick={() => startAction(bank, 'approve')}>Approve</button>
                      </span>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </main>

        {open && <BankPanel bank={open} onClose={() => setOpenId(null)} onAction={(action) => startAction(open, action)} onDelete={() => { setTypedName(''); setDeleting(open); }} />}

        {asking && (
          <Modal
            title={`${ACTION_COPY[asking.action].label} ${asking.bank.displayName}`}
            onClose={() => setAsking(null)}
            footer={
              <>
                <button className="btn" onClick={() => setAsking(null)}>Cancel</button>
                <button className="btn btn-danger" data-testid="platform-reason-confirm" disabled={busy || !reason.trim()} onClick={() => act(asking.bank, asking.action, reason.trim())}>
                  {ACTION_COPY[asking.action].label}
                </button>
              </>
            }
          >
            <p className="muted" style={{ marginTop: 0 }}>{ACTION_COPY[asking.action].ask}</p>
            <label className="field">
              <span className="field-label">Reason</span>
              <textarea className="input" rows={4} maxLength={500} autoFocus data-testid="platform-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </Modal>
        )}

        {deleting && (
          <Modal
            title={`Delete ${deleting.displayName}`}
            onClose={() => setDeleting(null)}
            footer={
              <>
                <button className="btn" onClick={() => setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" data-testid="platform-delete-confirm" disabled={busy || typedName.trim() !== deleting.displayName} onClick={confirmDelete}>
                  Delete bank and all its data
                </button>
              </>
            }
          >
            <div className="banner banner-error">
              This removes the bank, its {deleting.users} user{deleting.users === 1 ? '' : 's'} and {deleting.records.toLocaleString()} records for good. It cannot be undone.
            </div>
            <label className="field">
              <span className="field-label">Type the bank's name to confirm: {deleting.displayName}</span>
              <input className="input" autoFocus data-testid="platform-delete-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} />
            </label>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
