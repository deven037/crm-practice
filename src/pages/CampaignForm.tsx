import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newId, upsert } from '../data/store';
import { Campaign, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '../types';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { CustomFieldsSection, CustomFieldValues, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function CampaignForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState(CAMPAIGN_CHANNELS[0]);
  const [budgetText, setBudgetText] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [status, setStatus] = useState<Campaign['status']>('Planned');
  const [errors, setErrors] = useState<{ name?: string; budget?: string; endDate?: string }>({});
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    const budget = Number(budgetText.replace(/[^0-9.]/g, ''));
    if (!name.trim()) errs.name = 'Campaign name is required.';
    if (!budgetText.trim() || !Number.isFinite(budget) || budget <= 0) errs.budget = 'Enter a valid budget greater than 0.';
    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) errs.endDate = 'End date must be after start date.';
    setErrors(errs);
    const cErrs = validateCustomFields('campaigns', 'form', customFields);
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    const campaign: Campaign = {
      id: newId('campaign'),
      name: name.trim(),
      channel,
      budget: Math.round(budget),
      startDate,
      endDate,
      status,
      createdAt: new Date().toISOString(),
      customFields,
    };
    setBusy(true);
    await upsert('campaigns', campaign);
    toast.push('success', `Campaign "${campaign.name}" created.`);
    navigate(`/campaigns/${campaign.id}`);
  };

  return (
    <div data-testid="campaign-form-page">
      <nav className="breadcrumbs">
        <Link to="/campaigns">Campaigns</Link> <span>/</span> <span>New campaign</span>
      </nav>
      <div className="page-header">
        <h1>New campaign</h1>
      </div>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Campaign name *</span>
            <input className="input" data-testid="campaign-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Channel</span>
            <Select value={channel} options={CAMPAIGN_CHANNELS.map((c) => ({ value: c, label: c }))} onChange={setChannel} testId="campaign-channel" />
          </div>
          <div className="field">
            <span className="field-label">Budget ($) *</span>
            <input
              className="input"
              data-testid="campaign-budget"
              placeholder="e.g. 25000"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
            />
            {errors.budget && <span className="field-error">{errors.budget}</span>}
          </div>
          <div className="field">
            <span className="field-label">Status</span>
            <Select
              value={status}
              options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setStatus(v as Campaign['status'])}
              testId="campaign-status"
            />
          </div>
          <div className="field">
            <span className="field-label">Start date</span>
            <DatePicker value={startDate} onChange={setStartDate} testId="campaign-start-date" />
          </div>
          <div className="field">
            <span className="field-label">End date</span>
            <DatePicker value={endDate} onChange={setEndDate} testId="campaign-end-date" />
            {errors.endDate && <span className="field-error">{errors.endDate}</span>}
          </div>
          <CustomFieldsSection
            module="campaigns"
            target="form"
            mode="edit"
            values={customFields}
            onChange={(k, v) => setCustomFields({ ...customFields, [k]: v })}
            errors={customErrors}
          />
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/campaigns')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
