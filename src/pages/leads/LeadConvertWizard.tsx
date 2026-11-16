import { ReactNode, useState } from 'react';
import { Building2, Check, TrendingUp, User } from 'lucide-react';
import { Account, DealStage, Lead } from '../../types';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/Select';
import { classNames, formatCurrency } from '../../utils';
import { StepOneErrors, validateStepOne } from './convertValidation';

export interface WizardState {
  lead: Lead;
  step: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  accountMode: 'new' | 'existing';
  accountName: string;
  existingAccountId: string;
  createDeal: boolean;
  dealName: string;
  dealAmount: number;
  dealStage: DealStage;
  /** Set once the conversion is saved: the wizard then shows what was made. */
  done?: boolean;
}

export const CONVERT_STEPS = ['Contact', 'Account', 'Deal', 'Review'];

/** What the conversion makes (or made), for the Review step and the closing screen. */
export function conversionSummary(wizard: WizardState, accounts: Pick<Account, 'id' | 'name'>[]) {
  const existing = accounts.find((a) => a.id === wizard.existingAccountId)?.name;
  const useExisting = wizard.accountMode === 'existing' && Boolean(wizard.existingAccountId);
  return {
    contact: wizard.contactName,
    account: useExisting ? existing ?? 'Existing account' : wizard.accountName || wizard.lead.company,
    accountIsNew: !useExisting,
    deal: wizard.createDeal ? { name: wizard.dealName, amount: wizard.dealAmount } : null,
  };
}

interface Props {
  wizard: WizardState;
  setWizard: (w: WizardState | null) => void;
  accounts: Account[];
  onFinish: () => void;
  isFinishing: boolean;
  error?: string;
  /** Buttons for the closing screen, for example "Back to leads". */
  doneActions?: ReactNode;
}

function Summary({ wizard, accounts, made }: { wizard: WizardState; accounts: Account[]; made: boolean }) {
  const summary = conversionSummary(wizard, accounts);
  return (
    <div className="convert-made" data-testid="convert-summary">
      <div style={{ animationDelay: made ? '120ms' : '0ms' }}>
        <span><User size={14} /> Contact</span>
        <b>{summary.contact}</b>
      </div>
      <div style={{ animationDelay: made ? '240ms' : '80ms' }}>
        <span><Building2 size={14} /> Account · {summary.accountIsNew ? 'new' : 'existing'}</span>
        <b>{summary.account}</b>
      </div>
      {summary.deal && (
        <div style={{ animationDelay: made ? '360ms' : '160ms' }}>
          <span><TrendingUp size={14} /> Deal</span>
          <b>{summary.deal.name} · {formatCurrency(summary.deal.amount)}</b>
        </div>
      )}
    </div>
  );
}

export function LeadConvertWizard({ wizard, setWizard, accounts, onFinish, isFinishing, error, doneActions }: Props) {
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});
  const last = CONVERT_STEPS.length;
  const continueFromStepOne = () => {
    const errors = validateStepOne(wizard.contactName, wizard.contactEmail);
    setStepOneErrors(errors);
    if (Object.keys(errors).length === 0) setWizard({ ...wizard, step: wizard.step + 1 });
  };

  if (wizard.done) {
    return (
      <Modal title="Lead converted" onClose={() => setWizard(null)} wide>
        <div className="convert-wizard" data-testid="convert-done">
          <div className="convert-done-head">
            <span className="lead-okmark"><Check size={26} /></span>
            <h3>{wizard.lead.name} is now a customer record</h3>
            <p className="muted">The lead is kept and marked Converted.</p>
          </div>
          <Summary wizard={wizard} accounts={accounts} made />
          <div className="modal-footer wizard-footer">{doneActions ?? <button className="btn btn-primary" onClick={() => setWizard(null)}>Close</button>}</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Convert lead — Step ${wizard.step} of ${last}`} onClose={() => setWizard(null)} wide>
      <div className="convert-wizard">
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="wizard-steps convert-steps">
        {CONVERT_STEPS.map((label, i) => (
          <span key={label} className={classNames('wizard-step', wizard.step === i + 1 && 'active', wizard.step > i + 1 && 'done')} aria-current={wizard.step === i + 1 ? 'step' : undefined}>
            {label}
          </span>
        ))}
      </div>

      <div className="convert-body" key={wizard.step}>
      {wizard.step === 1 && (
        <>
          <p className="muted convert-hint">A contact is made from the lead. Check the details.</p>
          <div className="field">
            <label className="field-label" htmlFor="convert-contact-name">Contact name</label>
            <input id="convert-contact-name" className="input" value={wizard.contactName} aria-invalid={Boolean(stepOneErrors.contactName)} aria-describedby={stepOneErrors.contactName ? 'convert-contact-name-error' : undefined} onChange={(e) => setWizard({ ...wizard, contactName: e.target.value })} />
            {stepOneErrors.contactName && <div id="convert-contact-name-error" className="field-error" role="alert">{stepOneErrors.contactName}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="convert-contact-email">Email</label>
            <input id="convert-contact-email" className="input" type="email" value={wizard.contactEmail} aria-invalid={Boolean(stepOneErrors.contactEmail)} aria-describedby={stepOneErrors.contactEmail ? 'convert-contact-email-error' : undefined} onChange={(e) => setWizard({ ...wizard, contactEmail: e.target.value })} />
            {stepOneErrors.contactEmail && <div id="convert-contact-email-error" className="field-error" role="alert">{stepOneErrors.contactEmail}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="convert-contact-phone">Phone</label>
            <input id="convert-contact-phone" className="input" value={wizard.contactPhone} onChange={(e) => setWizard({ ...wizard, contactPhone: e.target.value })} />
          </div>
        </>
      )}

      {wizard.step === 2 && (
        <>
          <div className="convert-choice" role="radiogroup" aria-label="Account">
            <label className={classNames('convert-option', wizard.accountMode === 'new' && 'chosen')}>
              <input
                type="radio"
                name="account-mode"
                checked={wizard.accountMode === 'new'}
                onChange={() => setWizard({ ...wizard, accountMode: 'new' })}
              />
              <b>Create new account</b>
              <small>{wizard.accountName || wizard.lead.company || 'Named after the lead’s company'}</small>
            </label>
            <label className={classNames('convert-option', wizard.accountMode === 'existing' && 'chosen')}>
              <input
                type="radio"
                name="account-mode"
                checked={wizard.accountMode === 'existing'}
                onChange={() => setWizard({ ...wizard, accountMode: 'existing' })}
              />
              <b>Link existing account</b>
              <small>Pick one you already have</small>
            </label>
          </div>
          {wizard.accountMode === 'new' ? (
            <div className="field">
              <label className="field-label" htmlFor="convert-account-name">Account name</label>
              <input id="convert-account-name" className="input" value={wizard.accountName} onChange={(e) => setWizard({ ...wizard, accountName: e.target.value })} />
            </div>
          ) : (
            <div className="field">
              <span className="field-label">Existing account</span>
              <SearchableSelect
                value={wizard.existingAccountId}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                onChange={(v) => setWizard({ ...wizard, existingAccountId: v })}
                placeholder="Search accounts…"
              />
            </div>
          )}
        </>
      )}

      {wizard.step === 3 && (
        <>
          <label className={classNames('convert-option convert-deal', wizard.createDeal && 'chosen')}>
            <input
              type="checkbox"
              checked={wizard.createDeal}
              onChange={(e) => setWizard({ ...wizard, createDeal: e.target.checked })}
            />
            <b>Also create a deal for this conversion</b>
            <small>Track it as business in progress. Leave it off for only a contact and an account.</small>
          </label>
          {wizard.createDeal && (
            <>
              <div className="field">
                <label className="field-label" htmlFor="convert-deal-name">Deal name</label>
                <input id="convert-deal-name" className="input" value={wizard.dealName} onChange={(e) => setWizard({ ...wizard, dealName: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="convert-deal-amount">Amount ($)</label>
                <input
                  id="convert-deal-amount"
                  className="input"
                  type="number"
                  value={wizard.dealAmount}
                  onChange={(e) => setWizard({ ...wizard, dealAmount: Number(e.target.value) })}
                />
              </div>
            </>
          )}
        </>
      )}

      {wizard.step === last && (
        <>
          <p className="muted convert-hint">This is what will be made. Nothing is saved until you finish.</p>
          <Summary wizard={wizard} accounts={accounts} made={false} />
        </>
      )}
      </div>

      <div className="modal-footer wizard-footer">
        {wizard.step > 1 && (
          <button className="btn" onClick={() => setWizard({ ...wizard, step: wizard.step - 1 })}>
            ‹ Back
          </button>
        )}
        {wizard.step < last ? (
          <button
            className="btn btn-primary"
            disabled={wizard.step === 2 && wizard.accountMode === 'existing' && !wizard.existingAccountId}
            onClick={wizard.step === 1 ? continueFromStepOne : () => setWizard({ ...wizard, step: wizard.step + 1 })}
          >
            Next ›
          </button>
        ) : (
          <button className="btn btn-primary" data-testid="wizard-finish" disabled={isFinishing} onClick={onFinish}>
            {isFinishing ? 'Converting…' : 'Finish conversion'}
          </button>
        )}
      </div>
      </div>
    </Modal>
  );
}
