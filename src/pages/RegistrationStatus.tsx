import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, Check, Hourglass, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';
import { BankStatus, RegistrationStatus as Status, registrationStatus } from '../data/frontDoor';
import { emailProblem } from './Login';
import { FrontDoorShell } from './frontdoor/FrontDoorShell';
import { Field, Notice, SubmitButton } from './frontdoor/fields';
import { rememberSent, sentEmail } from './register/registration';

const COPY: Record<BankStatus, { title: string; text: string; tone: 'wait' | 'ok' | 'bad' }> = {
  pending: { title: 'Waiting for approval', text: 'The platform owner is reviewing the registration. Check back here: this page shows the decision as soon as it is made.', tone: 'wait' },
  active: { title: 'Approved', text: 'Your bank is ready. Sign in with the admin email and the password you chose when registering.', tone: 'ok' },
  rejected: { title: 'Not approved', text: 'The registration was not approved.', tone: 'bad' },
  suspended: { title: 'Suspended', text: 'The bank was approved but is suspended at the moment. Contact the platform owner.', tone: 'bad' },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** The three moments of a registration, with the one it has reached marked. */
function Timeline({ status }: { status: Status }) {
  const decided = status.status !== 'pending';
  const bad = status.status === 'rejected' || status.status === 'suspended';
  const steps = [
    { label: 'Registration received', at: when(status.registeredAt), state: 'done' },
    { label: 'Review by the platform owner', at: decided ? '' : 'In progress', state: decided ? 'done' : 'now' },
    { label: decided ? COPY[status.status].title : 'Decision', at: when(status.decidedAt), state: decided ? (bad ? 'bad' : 'done') : 'todo' },
  ];
  return (
    <ol className="rs-timeline">
      {steps.map((step, i) => (
        <motion.li key={step.label} className={`is-${step.state}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }}>
          <i>{step.state === 'done' ? <Check size={13} strokeWidth={3.2} /> : step.state === 'bad' ? <X size={13} strokeWidth={3.2} /> : null}</i>
          <span><strong>{step.label}</strong>{step.at && <small>{step.at}</small>}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/** Lets the person who registered a bank see whether it has been approved yet. */
export function RegistrationStatus() {
  const justSent = Boolean((useLocation().state as { justSent?: boolean } | null)?.justSent);
  const [email, setEmail] = useState(sentEmail);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (address: string) => {
    setBusy(true);
    setNotice(null);
    try {
      setStatus(await registrationStatus(address.trim()));
      rememberSent(address.trim().toLowerCase());
    } catch (e) {
      const failure = e as Error & { status?: number };
      setStatus(null);
      setNotice(failure.status === 404 ? 'No registration was found for this email. Use the admin email given when the bank was registered.' : failure.message);
    } finally {
      setBusy(false);
    }
  };

  // A registration sent from this device opens straight on its status.
  useEffect(() => {
    if (email && !emailProblem(email)) check(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = emailProblem(email);
    setError(problem);
    if (!problem) check(email);
  };

  const copy = status ? COPY[status.status] : null;
  const Icon = !copy ? Hourglass : copy.tone === 'ok' ? Check : copy.tone === 'bad' ? Ban : Hourglass;

  return (
    <FrontDoorShell bank={null} testId="registration-status-page">
      {status && copy ? (
        <div data-testid="registration-status" data-status={status.status}>
          <motion.span className={`fd-badge-icon rs-icon rs-${copy.tone}`} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
            <Icon size={22} />
          </motion.span>
          {justSent && status.status === 'pending' && <p className="rs-sent">Registration sent</p>}
          <h1>{copy.title}</h1>
          <p className="fd-sub"><strong>{status.name}</strong>. {copy.text}</p>
          {status.reason && <Notice tone={copy.tone === 'bad' ? 'error' : 'info'} title="Reason given" testId="registration-reason">{status.reason}</Notice>}
          <Timeline status={status} />
          {status.status === 'active' ? (
            <Link to="/login" className="fd-btn" data-testid="status-sign-in">Sign in <ArrowRight size={17} aria-hidden="true" /></Link>
          ) : status.status === 'rejected' ? (
            <Link to="/register" className="fd-btn">Register again <ArrowRight size={17} aria-hidden="true" /></Link>
          ) : (
            <button type="button" className="fd-btn fd-btn-quiet" data-testid="status-refresh" disabled={busy} onClick={() => check(email)}>
              <RefreshCw size={16} aria-hidden="true" className={busy ? 'rs-spin' : ''} /> Check again
            </button>
          )}
          <button type="button" className="fd-link fd-link-row" onClick={() => { setStatus(null); rememberSent(null); setEmail(''); }}>
            Check a different registration
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1>Check your registration</h1>
          <p className="fd-sub">Enter the admin email given when the bank was registered.</p>
          {notice && <Notice testId="registration-status-error">{notice}</Notice>}
          <Field label="Admin email" type="email" testId="status-email" autoFocus autoComplete="username" placeholder="you@yourbank.com" value={email} onChange={setEmail} error={error} />
          <SubmitButton busy={busy} busyLabel="Checking…" testId="status-check">Check status</SubmitButton>
          <Link to="/login" className="fd-link fd-link-row"><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</Link>
        </form>
      )}
    </FrontDoorShell>
  );
}
