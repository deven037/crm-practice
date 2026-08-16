import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { AutoFlowEdge, AutoFlowNode, AutoFlowProcess, Campaign, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, PageLayout, Product, User } from '../types';
import { SearchableSelect, Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { applyAssignmentRule, findDuplicate, getStatusOptions, matchesCondition } from '../utils/rules';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';

/** First outgoing edge from `nodeId` whose condition matches `record`, falling back to the
 * first condition-less ("else") edge — shared by decision/gateway routing and plain single-edge
 * pass-through (start/wait nodes have exactly one condition-less edge, so this handles both). */
function pickEdge(process: AutoFlowProcess, nodeId: string, record: object): AutoFlowEdge | null {
  const outs = process.edges.filter((e) => e.source === nodeId);
  if (outs.length === 0) return null;
  const matched = outs.find((e) => e.condition && matchesCondition(record, e.condition));
  if (matched) return matched;
  return outs.find((e) => !e.condition) ?? null;
}

type WizardStep =
  | { kind: 'state'; node: AutoFlowNode }
  | { kind: 'end' }
  | { kind: 'blocked'; message: string };

/** Walks forward from `nodeId`, auto-resolving start/wait/decision/gateway nodes (no interactive
 * step of their own in v1 — see AutoFlow plan's Phase 6 for real Wait-node async semantics) until
 * landing on a 'state' node (the next visible wizard step), 'end' (finalize), or a broken graph. */
function resolveStep(process: AutoFlowProcess, nodeId: string, record: object, visited = new Set<string>()): WizardStep {
  if (visited.has(nodeId)) return { kind: 'blocked', message: 'This process has a loop and cannot continue.' };
  visited.add(nodeId);
  const node = process.nodes.find((n) => n.id === nodeId);
  if (!node) return { kind: 'blocked', message: 'This process references a missing step.' };
  if (node.type === 'end') return { kind: 'end' };
  if (node.type === 'state') return { kind: 'state', node };
  const edge = pickEdge(process, nodeId, record);
  if (!edge) return { kind: 'blocked', message: `"${node.data.label}" has no next step for this data.` };
  return resolveStep(process, edge.target, record, visited);
}

export function LeadForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const users = getAllSync<User>('users');
  const products = getAllSync<Product>('products');
  const campaigns = getAllSync<Campaign>('campaigns');

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'leads');
  const layout = layouts.find((l) => l.id === params.get('layout')) ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const allLayoutKeys = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('leads').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

  const autoflowId = params.get('autoflow');
  const autoflowProcess = autoflowId
    ? getAllSync<AutoFlowProcess>('autoFlowProcesses').find((p) => p.id === autoflowId && p.status === 'published')
    : undefined;
  const [cursor, setCursor] = useState<string | null>(() => autoflowProcess?.nodes.find((n) => n.type === 'start')?.id ?? null);

  const [draft, setDraft] = useState<Lead>({
    id: newId('lead'),
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'New',
    source: 'Web',
    ownerId: user?.id ?? 'user-2',
    value: 0,
    productId: params.get('productId'),
    campaignId: params.get('campaignId'),
    layoutName: layout?.name ?? null,
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<Lead | null>(null);

  const step = autoflowProcess && cursor ? resolveStep(autoflowProcess, cursor, draft) : null;
  const currentNode = step?.kind === 'state' ? step.node : null;
  const isVisible = (key: string) =>
    currentNode ? (currentNode.data.fieldKeys ?? []).includes(key) : !layout || (activeTab?.fieldKeys.includes(key) ?? true);
  const currentNodeCustomIds = currentNode?.data.fieldKeys?.filter((k) => customFieldIds.has(k)) ?? [];

  const previewEdge = autoflowProcess && currentNode ? pickEdge(autoflowProcess, currentNode.id, draft) : null;
  const previewStep = autoflowProcess && previewEdge ? resolveStep(autoflowProcess, previewEdge.target, draft) : null;
  const isLastWizardStep = previewStep?.kind === 'end';

  // Debounced, non-blocking — a Setup → Dedupe Rule match just surfaces a warning banner.
  useEffect(() => {
    const t = setTimeout(() => {
      setDuplicate(findDuplicate('leads', draft, getAllSync<Lead>('leads')));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.email, draft.name, draft.company]);

  const submit = async () => {
    const errs: typeof errors = {};
    if (allLayoutKeys.has('name') && !draft.name.trim()) errs.name = 'Name is required.';
    if (allLayoutKeys.has('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    const cErrs = validateCustomFields('leads', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    // Setup → Assignment Rules: first active, priority-ordered match sets the owner.
    const assignedTo = applyAssignmentRule('leads', draft);
    const toSave = assignedTo ? { ...draft, ownerId: assignedTo } : draft;

    setBusy(true);
    await upsert('leads', toSave);
    toast.push('success', assignedTo ? `Lead "${draft.name}" created and auto-assigned.` : `Lead "${draft.name}" created.`);
    navigate(`/leads/${toSave.id}`);
  };

  // Walks the AutoFlow graph one step at a time: validates the current node's visible fields,
  // runs its action (dedupe/assign) by calling straight into rules.ts (never reimplemented),
  // then resolves the next node — finalizing with a real upsert if that lands on 'end'.
  const advance = async () => {
    if (!autoflowProcess || !currentNode) return;
    const keys = new Set(currentNode.data.fieldKeys ?? []);
    const errs: typeof errors = {};
    if (keys.has('name') && !draft.name.trim()) errs.name = 'Name is required.';
    if (keys.has('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    const cErrs = validateCustomFields('leads', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    let working = draft;
    if (currentNode.data.action === 'dedupe') {
      setDuplicate(findDuplicate('leads', working, getAllSync<Lead>('leads')));
    }
    if (currentNode.data.action === 'assign') {
      const assignedTo = applyAssignmentRule('leads', working);
      if (assignedTo) {
        working = { ...working, ownerId: assignedTo };
        setDraft(working);
      }
    }

    const edge = pickEdge(autoflowProcess, currentNode.id, working);
    if (!edge) {
      toast.push('error', `"${currentNode.data.label}" has no next step configured for this data.`);
      return;
    }
    const result = resolveStep(autoflowProcess, edge.target, working);
    if (result.kind === 'blocked') {
      toast.push('error', result.message);
      return;
    }
    if (result.kind === 'end') {
      setBusy(true);
      await upsert('leads', working);
      setBusy(false);
      toast.push('success', `Lead "${working.name}" created.`);
      navigate(`/leads/${working.id}`);
      return;
    }
    setCursor(edge.target);
  };

  return (
    <div data-testid="lead-form-page">
      <nav className="breadcrumbs">
        <Link to="/leads">Leads</Link> <span>/</span> <span>New lead</span>
      </nav>
      <div className="page-header">
        <h1>New lead</h1>
      </div>
      {autoflowProcess ? (
        <p className="muted" style={{ marginTop: -8 }} data-testid="autoflow-wizard-subtitle">
          AutoFlow: {autoflowProcess.name}
          {currentNode && ` — ${currentNode.data.label}`}
        </p>
      ) : (
        layout && <p className="muted" style={{ marginTop: -8 }}>Layout: {layout.name}</p>
      )}

      <div className="card form-card">
        {autoflowProcess && step?.kind === 'blocked' && (
          <div className="banner banner-error" role="alert" data-testid="autoflow-blocked-banner">
            {step.message}
          </div>
        )}
        {duplicate && (
          <div className="banner banner-info" role="alert" data-testid="duplicate-warning">
            A lead with matching details already exists —{' '}
            <Link to={`/leads/${duplicate.id}`}>View "{duplicate.name}"</Link>. You can still save this one.
          </div>
        )}
        {!autoflowProcess && layout && layout.tabs.length > 1 && (
          <div className="chip-filters" data-testid="lead-form-layout-tabs" style={{ marginBottom: 16 }}>
            {layout.tabs.map((tab) => (
              <span
                key={tab.id}
                className={classNames('chip-filter', tab.id === activeTabId && 'active')}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </span>
            ))}
          </div>
        )}
        <div className="form-grid">
          {isVisible('name') && (
            <div className="field">
              <span className="field-label">Full name *</span>
              <input className="input" data-testid="lead-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          )}
          {isVisible('company') && (
            <div className="field">
              <span className="field-label">Company</span>
              <input className="input" data-testid="lead-company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </div>
          )}
          {isVisible('email') && (
            <div className="field">
              <span className="field-label">Email *</span>
              <input className="input" data-testid="lead-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          )}
          {isVisible('phone') && (
            <div className="field">
              <span className="field-label">Phone</span>
              <input className="input" data-testid="lead-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
          )}
          {isVisible('status') && (
            <div className="field">
              <span className="field-label">Status</span>
              <Select
                value={draft.status}
                options={getStatusOptions('leads', 'status', LEAD_STATUSES).map((s) => ({ value: s, label: s }))}
                onChange={(v) => setDraft({ ...draft, status: v as LeadStatus })}
                testId="lead-status"
              />
            </div>
          )}
          {isVisible('source') && (
            <div className="field">
              <span className="field-label">Source</span>
              <Select
                value={draft.source}
                options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => setDraft({ ...draft, source: v })}
              />
            </div>
          )}
          <div className="field">
            <span className="field-label">Interested product</span>
            <SearchableSelect
              value={draft.productId ?? ''}
              options={[{ value: '', label: 'No product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
              onChange={(v) => setDraft({ ...draft, productId: v || null })}
              placeholder="Search products…"
              testId="lead-product"
            />
          </div>
          <div className="field">
            <span className="field-label">Campaign</span>
            <SearchableSelect
              value={draft.campaignId ?? ''}
              options={[{ value: '', label: 'No campaign' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
              onChange={(v) => setDraft({ ...draft, campaignId: v || null })}
              placeholder="Search campaigns…"
              testId="lead-campaign"
            />
          </div>
          {isVisible('ownerId') && (
            <div className="field">
              <span className="field-label">Owner</span>
              <Select
                value={draft.ownerId}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                onChange={(v) => setDraft({ ...draft, ownerId: v })}
              />
            </div>
          )}
          {isVisible('value') && (
            <div className="field">
              <span className="field-label">Estimated value ($)</span>
              <input
                className="input"
                type="number"
                data-testid="lead-value"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
              />
            </div>
          )}
          <CustomFieldsSection
            module="leads"
            target="form"
            mode="edit"
            values={draft.customFields ?? {}}
            onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
            errors={customErrors}
            includeIds={currentNode ? currentNodeCustomIds : layout ? activeTabCustomIds : undefined}
          />
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/leads')}>
            Cancel
          </button>
          {autoflowProcess ? (
            <button className="btn btn-primary" disabled={busy || !currentNode} onClick={advance} data-testid="autoflow-next-btn">
              {busy ? 'Saving…' : isLastWizardStep ? 'Finish' : 'Next'}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? 'Creating…' : 'Create lead'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
