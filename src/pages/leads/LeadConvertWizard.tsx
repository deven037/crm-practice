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
}

export function LeadConvertWizard({ wizard, setWizard, accounts, onFinish }: Props) {
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
            <span className="field-label">Contact name</span>
            <input className="input" value={wizard.contactName} onChange={(e) => setWizard({ ...wizard, contactName: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Email</span>
            <input className="input" value={wizard.contactEmail} onChange={(e) => setWizard({ ...wizard, contactEmail: e.target.value })} />
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
            onClick={() => setWizard({ ...wizard, step: wizard.step + 1 })}
          >
            Next ›
          </button>
        ) : (
          <button className="btn btn-primary" data-testid="wizard-finish" onClick={onFinish}>
            Finish conversion
          </button>
        )}
      </div>
    </Modal>
  );
}
