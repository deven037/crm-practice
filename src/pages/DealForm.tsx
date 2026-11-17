import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Campaign, CustomFieldDef, Deal, PageLayout, User } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { applyAssignmentRule } from '../utils/rules';
import { autoCloseDate, classNames } from '../utils';
import { runRecoverable } from './accountRecovery';
import { isOpenStage, stageOf } from './deals/dealLogic';
import { bankStages, MiniCrest, RunwayPreview, SearchPicker } from './deals/dealBits';

/** Fields added after page layouts existed: a layout that does not place them shows them on its first tab. */
const LATER_FIELDS = ['campaignId', 'nextStep'];

/**
 * The deal form, as a full page with the runway preview beside it. With no `existing` deal it creates one;
 * with one (see DealEdit) it saves changes to it.
 */
export function DealForm({ existing }: { existing?: Deal } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const users = getAllSync<User>('users');
  const accounts = getAllSync<Account>('accounts');
  const campaigns = getAllSync<Campaign>('campaigns');
  const stages = bankStages();
  const firstOpen = stages.find((s) => s.kind === 'open') ?? stages[0];

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'deals');
  const layout = layouts.find((l) => l.id === params.get('layout'))
    ?? (existing ? layouts.find((l) => l.name === existing.layoutName) : undefined)
    ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const placed = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  // The order of these states is relied on by form tests; add new ones at the end.
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const onFirstTab = !layout || activeTab?.id === layout.tabs[0]?.id;
  const isVisible = (key: string) =>
    !layout || (activeTab?.fieldKeys.includes(key) ?? true) || (LATER_FIELDS.includes(key) && !placed.has(key) && onFirstTab);
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('deals').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

  const [draft, setDraft] = useState<Deal>(existing ? { ...existing } : {
    id: newId('deal'),
    name: '',
    accountId: params.get('account'),
    amount: 0,
    stage: firstOpen?.name ?? 'Qualification',
    closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    probability: firstOpen?.chance ?? 20,
    ownerId: user?.id ?? 'user-2',
    campaignId: null,
    layoutName: layout?.name ?? null,
    nextStep: '',
    createdAt: new Date().toISOString(),
  });
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [chanceSetByHand, setChanceSetByHand] = useState(!!existing);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; closeDate?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (Object.keys(errors).length || Object.keys(customErrors).length) {
      document.querySelector<HTMLElement>('[data-testid="deal-form-page"] [aria-invalid="true"]')?.focus();
    }
  }, [errors, customErrors]);

  const backTo = existing ? `/deals/${existing.id}` : '/deals';
  const amount = Number(amountText);

  const pickStage = (name: string) => {
    const stage = stageOf(stages, name);
    setDraft((d) => ({ ...d, stage: name, probability: chanceSetByHand && stage.kind === 'open' ? d.probability : stage.chance }));
  };

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Deal name is required.';
    if (amountText.trim() === '') errs.amount = 'Enter the amount.';
    else if (!Number.isFinite(amount) || amount < 0) errs.amount = 'The amount can’t be negative.';
    if (!draft.closeDate) errs.closeDate = 'Pick the expected close date.';
    setErrors(errs);
    const cErrs = validateCustomFields('deals', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) {
      const firstStandard = ['name', 'amount', 'closeDate'].find((key) => Object.keys(errs).includes(key));
      const firstCustom = getAllSync<CustomFieldDef>('customFieldDefs').find((field) => field.module === 'deals' && cErrs[field.key]);
      const firstKey = firstStandard ?? firstCustom?.id;
      const tab = layout?.tabs.find((item) => item.fieldKeys.includes(firstKey ?? ''));
      if (tab) setActiveTabId(tab.id);
      else if (firstStandard && layout) setActiveTabId(layout.tabs[0].id);
      return;
    }
    const ready: Deal = { ...draft, name: draft.name.trim(), amount: Math.round(amount), nextStep: (draft.nextStep ?? '').trim() };
    const stamped = existing ? autoCloseDate(existing.stage, ready) : ready;
    // Setup → Assignment Rules: re-checked on every save, so a rule a change now matches still reassigns.
    const assignedTo = applyAssignmentRule('deals', stamped);
    const toSave = assignedTo ? { ...stamped, ownerId: assignedTo } : stamped;
    const saved = await runRecoverable(() => upsert('deals', toSave), { setBusy, setError: setSaveError });
    if (!saved) return;
    toast.push('success', existing ? 'Deal updated.' : `Deal "${toSave.name}" created.`);
    navigate(`/deals/${toSave.id}`);
  };

  const peers = getAllSync<Deal>('deals').filter((d) => d.stage === draft.stage && d.id !== draft.id).length;
  const largest = Math.max(1, ...getAllSync<Deal>('deals').filter((d) => isOpenStage(d.stage)).map((d) => d.amount));

  return (
    <div className="deal3 deal-form-page" data-testid="deal-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? existing.name : 'Deals'}</Link>

      <div className="deal-fcols">
        <div className="card deal-formcard">
          <div className="acct-fhead">
            <h1>{existing ? 'Edit deal' : 'New deal'}</h1>
            <p>{layout ? `Layout: ${layout.name}` : 'An opportunity, from first conversation to signed facility.'}</p>
          </div>

          {layout && layout.tabs.length > 1 && (
            <div className="contact-layout-tabs" data-testid="deal-form-layout-tabs" aria-label="Form layout sections">
              {layout.tabs.map((tab) => (
                <button type="button" key={tab.id} aria-pressed={tab.id === activeTabId} className={classNames('contact-ltab', tab.id === activeTabId && 'active')} onClick={() => setActiveTabId(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="acct-fields">
            <div className="form-grid">
              {isVisible('name') && (
                <div className="field field-span">
                  <label className="field-label" htmlFor="deal-name-input">Deal name *</label>
                  <input
                    id="deal-name-input"
                    className="input"
                    data-testid="deal-name"
                    placeholder="For example: Working capital renewal"
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'deal-name-error' : undefined}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  {errors.name && <span className="field-error" id="deal-name-error">{errors.name}</span>}
                </div>
              )}
              {isVisible('accountId') && (
                <div className="field">
                  <span className="field-label" id="deal-account-label">Account</span>
                  <SearchPicker
                    label="Account"
                    find="Find an account"
                    testId="deal-account"
                    value={draft.accountId ?? ''}
                    options={[
                      { value: '', label: 'No account', lead: <MiniCrest /> },
                      ...[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name, lead: <MiniCrest account={a} /> })),
                    ]}
                    onPick={(v) => setDraft({ ...draft, accountId: v || null })}
                  />
                </div>
              )}
              {isVisible('amount') && (
                <div className="field">
                  <label className="field-label" htmlFor="deal-amount-input">Amount ($) *</label>
                  <input
                    id="deal-amount-input"
                    className="input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    data-testid="deal-amount"
                    placeholder="0"
                    aria-invalid={errors.amount ? true : undefined}
                    aria-describedby={errors.amount ? 'deal-amount-error' : undefined}
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                  />
                  {errors.amount && <span className="field-error" id="deal-amount-error">{errors.amount}</span>}
                </div>
              )}
              {isVisible('stage') && (
                <div className="field">
                  <span className="field-label">Stage</span>
                  <SearchPicker
                    label="Stage"
                    find="Find a stage"
                    testId="deal-stage"
                    value={draft.stage}
                    options={stages.map((s) => ({ value: s.name, label: s.name, hue: s.hue, hint: `${s.chance}%` }))}
                    onPick={pickStage}
                  />
                </div>
              )}
              {isVisible('closeDate') && (
                <div className="field">
                  <label className="field-label" htmlFor="deal-close-input">Expected close date *</label>
                  <DatePicker
                    id="deal-close-input"
                    value={draft.closeDate}
                    onChange={(iso) => setDraft({ ...draft, closeDate: iso })}
                    testId="deal-close-date"
                    ariaInvalid={errors.closeDate ? true : undefined}
                    ariaDescribedby={errors.closeDate ? 'deal-close-error' : undefined}
                  />
                  {errors.closeDate && <span className="field-error" id="deal-close-error">{errors.closeDate}</span>}
                </div>
              )}
              {isVisible('ownerId') && (
                <div className="field">
                  <label className="field-label" htmlFor="deal-owner-input">Owner</label>
                  <Select id="deal-owner-input" value={draft.ownerId} options={users.map((u) => ({ value: u.id, label: u.name }))} onChange={(v) => setDraft({ ...draft, ownerId: v })} testId="deal-owner" />
                </div>
              )}
              {isVisible('probability') && (
                <div className="field field-span">
                  <label className="field-label" htmlFor="deal-chance-input">
                    Chance to win <b className="deal-chance-val">{draft.probability}%</b>
                    {!chanceSetByHand && <span className="muted deal-chance-hint">follows the stage until you change it</span>}
                  </label>
                  <input
                    id="deal-chance-input"
                    className="deal-range"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    data-testid="deal-probability"
                    value={draft.probability}
                    onChange={(e) => { setChanceSetByHand(true); setDraft({ ...draft, probability: Number(e.target.value) }); }}
                  />
                </div>
              )}
              {isVisible('campaignId') && (
                <div className="field">
                  <label className="field-label" htmlFor="deal-campaign-input">Campaign</label>
                  <Select
                    id="deal-campaign-input"
                    value={draft.campaignId ?? ''}
                    options={[{ value: '', label: 'None' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
                    onChange={(v) => setDraft({ ...draft, campaignId: v || null })}
                    testId="deal-campaign"
                  />
                </div>
              )}
              {isVisible('nextStep') && (
                <div className="field field-span">
                  <label className="field-label" htmlFor="deal-next-input-form">Next step</label>
                  <input
                    id="deal-next-input-form"
                    className="input"
                    data-testid="deal-next-step-input"
                    maxLength={500}
                    placeholder="What happens next, and who does it?"
                    value={draft.nextStep ?? ''}
                    onChange={(e) => setDraft({ ...draft, nextStep: e.target.value })}
                  />
                </div>
              )}
              <CustomFieldsSection
                module="deals"
                target="form"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
                errors={customErrors}
                includeIds={layout ? activeTabCustomIds : undefined}
              />
            </div>
          </div>

          {saveError && (
            <div className="banner banner-error acct-form-note" role="alert" data-testid="save-deal-error">
              Deal couldn’t be saved. Your entries are kept. Try again.
            </div>
          )}
          <div className="form-actions contact-form-actions">
            <button className="btn" disabled={busy} onClick={() => navigate(backTo)}>
              Cancel
            </button>
            <button className="btn btn-primary contacts-primary" data-testid="save-deal-btn" disabled={busy} onClick={submit}>
              {busy ? (existing ? 'Saving…' : 'Creating…') : existing ? 'Save changes' : 'Create deal'}
            </button>
          </div>
        </div>

        <RunwayPreview
          amount={Number.isFinite(amount) ? amount : 0}
          chance={draft.probability}
          closeDate={draft.closeDate}
          stage={draft.stage}
          stages={stages}
          peers={peers}
          largest={largest}
        />
      </div>
    </div>
  );
}
