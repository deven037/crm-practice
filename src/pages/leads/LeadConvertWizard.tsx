import { useState } from 'react';
import { Account, DealStage, Lead } from '../../types';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/Select';
import { classNames } from '../../utils';

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
}

interface Props {
  wizard: WizardState;
  setWizard: (w: WizardState | null) => void;
  accounts: Account[];
  onFinish: () => void;
  isFinishing: boolean;
}

export function LeadConvertWizard({ wizard, setWizard, accounts, onFinish, isFinishing }: Props) {
  const [stepOneErrors, setStepOneErrors] = useState<Partial<Record<'contactName' | 'contactEmail', string>>>({});
  const continueFromStepOne = () => {
    const errors: Partial<Record<'contactName' | 'contactEmail', string>> = {};
    if (!wizard.contactName.trim()) errors.contactName = 'Enter a contact name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizard.contactEmail.trim())) errors.contactEmail = 'Enter a valid email address.';
    setStepOneErrors(errors);
    if (Object.keys(errors).length === 0) setWizard({ ...wizard, step: wizard.step + 1 });
  };

  return (
    <Modal title={`Convert lead — Step ${wizard.step} of 3`} onClose={() => setWizard(null)} wide>
      <div className="wizard-steps">
        {['Contact', 'Account', 'Deal'].map((label, i) => (
          <span key={label} className={classNames('wizard-step', wizard.step === i + 1 && 'active', wizard.step > i + 1 && 'done')}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {wizard.step === 1 && (
        <>
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
            <span className="field-label">Phone</span>
            <input className="input" value={wizard.contactPhone} onChange={(e) => setWizard({ ...wizard, contactPhone: e.target.value })} />
          </div>
        </>
      )}

      {wizard.step === 2 && (
        <>
          <div className="field">
            <span className="field-label">Account</span>
            <div className="radio-row">
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="account-mode"
                  checked={wizard.accountMode === 'new'}
                  onChange={() => setWizard({ ...wizard, accountMode: 'new' })}
                />
                Create new account
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="account-mode"
                  checked={wizard.accountMode === 'existing'}
                  onChange={() => setWizard({ ...wizard, accountMode: 'existing' })}
                />
                Link existing account
              </label>
            </div>
          </div>
          {wizard.accountMode === 'new' ? (
            <div className="field">
              <span className="field-label">Account name</span>
              <input className="input" value={wizard.accountName} onChange={(e) => setWizard({ ...wizard, accountName: e.target.value })} />
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
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={wizard.createDeal}
              onChange={(e) => setWizard({ ...wizard, createDeal: e.target.checked })}
            />
            Also create a deal for this conversion
          </label>
          {wizard.createDeal && (
            <>
              <div className="field">
                <span className="field-label">Deal name</span>
                <input className="input" value={wizard.dealName} onChange={(e) => setWizard({ ...wizard, dealName: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Amount ($)</span>
                <input
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

      <div className="modal-footer wizard-footer">
        {wizard.step > 1 && (
          <button className="btn" onClick={() => setWizard({ ...wizard, step: wizard.step - 1 })}>
            ‹ Back
          </button>
        )}
        {wizard.step < 3 ? (
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
    </Modal>
  );
}
