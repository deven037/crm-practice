import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search } from 'lucide-react';
import { getAll, getAllSync, newId, removeMany, saveAll, upsert } from '../data/store';
import { Account, Contact, Deal, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, Role, User } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { ContextMenu } from '../components/ContextMenu';
import { LeadTriageMode } from '../components/LeadTriageMode';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { MassUpdateModal } from '../components/MassUpdateModal';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { downloadCsv, formatDate } from '../utils';
import { applyAssignmentRule, getStatusOptions } from '../utils/rules';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';
import { StatusPicker, statusClass, toggleStatus } from './leads/StatusPicker';
import { LeadsPagination } from './leads/LeadsPagination';
import { LeadsTable, SortKey } from './leads/LeadsTable';
import { beginOnce, canCreateLeads, canExportLeads, clearSelection } from './leads/leadsGuards';

type SortDir = 'asc' | 'desc';

/** The module's set-up shortcuts, shown under the ToolBox button. */
export const LEAD_TOOLBOX_LINKS = [
  { label: 'Assignment Rules', to: '/setup/assignment-rules' },
  { label: 'Dedupe Rule', to: '/setup/dedupe-rules' },
  { label: 'Status Codes', to: '/setup/status-codes' },
  { label: 'Import Data', to: '/setup/import' },
  { label: 'Custom Fields', to: '/admin/objects/leads' },
  { label: 'Customise Page Layout', to: '/setup/layouts/leads' },
];

/** How many leads sit in each of the standard statuses, for the bar above the list. */
export function leadFlow(leads: Pick<Lead, 'status'>[]) {
  return LEAD_STATUSES.map((status) => ({ status, count: leads.filter((l) => l.status === status).length }));
}

export function filterLeads(leads: Lead[], query: string, role: Role | undefined) {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  const showDetails = role === 'admin' || role === 'rep';
  const digits = /^[\d\s\-()+.]+$/.test(q) ? q.replace(/\D/g, '') : '';
  return leads.filter((l) => (
    l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) ||
    (showDetails && (l.email.toLowerCase().includes(q) || (digits.length >= 2 && l.phone.replace(/\D/g, '').includes(digits))))
  ));
}

export function Leads() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // Dashboard tile link: /leads?created=30d shows leads created in the last 30 days.
  const createdMatch = /^(\d{1,3})d$/.exec(params.get('created') ?? '');
  const createdDays = createdMatch && Number(createdMatch[1]) > 0 ? Number(createdMatch[1]) : null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [mode, setMode] = useState<'table' | 'triage'>('table');

  // table state
  // Header search "See all": /leads?q=term opens the list already filtered.
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const convertingRef = useRef(false);

  // interactions
  const [menu, setMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    // Users are only needed for owner names; a role that can't list them (403) still sees its leads.
    const [l, u] = await Promise.allSettled([getAll<Lead>('leads'), getAll<User>('users')]);
    if (l.status === 'fulfilled') setLeads(l.value);
    else setLoadError(true);
    if (u.status === 'fulfilled') setUsers(u.value);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    setQuery(urlQuery);
    setDebouncedQuery(urlQuery);
    setPage(1);
  }, [urlQuery, location.state]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    let rows = [...filterLeads(leads, debouncedQuery, user?.role)];
    if (createdDays) {
      const since = Date.now() - createdDays * 24 * 60 * 60 * 1000;
      rows = rows.filter((l) => new Date(l.createdAt).getTime() >= since);
    }
    if (statusFilter.length > 0) rows = rows.filter((l) => statusFilter.includes(l.status));
    if (sourceFilter) rows = rows.filter((l) => l.source === sourceFilter);
    if (ownerFilter) rows = rows.filter((l) => l.ownerId === ownerFilter);
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [leads, debouncedQuery, user?.role, statusFilter, sourceFilter, ownerFilter, createdDays, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));
  const toggleSelectAll = () => {
    setSelected((sel) =>
      allPageSelected ? sel.filter((id) => !pageRows.some((r) => r.id === id)) : [...new Set([...sel, ...pageRows.map((r) => r.id)])]
    );
  };

  const bulkDelete = async () => {
    // Native confirm dialog — practices dialog handling.
    if (!window.confirm(`Delete ${selected.length} selected lead(s)? This cannot be undone.`)) return;
    await removeMany('leads', selected);
    toast.push('success', `${selected.length} lead(s) deleted.`);
    setSelected([]);
    load();
  };

  const bulkAssign = async () => {
    if (!assignTo) return;
    const freshLeads = await getAll<Lead>('leads');
    const next = freshLeads.filter((l) => selected.includes(l.id)).map((l) => ({ ...l, ownerId: assignTo }));
    await saveAll('leads', next);
    toast.push('success', `${selected.length} lead(s) assigned to ${ownerName(assignTo)}.`);
    setAssignOpen(false);
    setSelected([]);
    setAssignTo('');
    load();
  };

  // Setup → Mass Update, reusing the existing per-item upsert in a loop (same pattern as bulkAssign).
  const applyMassUpdate = async (fieldKey: string, value: string) => {
    const freshLeads = await getAll<Lead>('leads');
    const next = freshLeads.filter((l) => selected.includes(l.id)).map((l) => {
      const updated = { ...l, [fieldKey]: fieldKey === 'value' ? Number(value) : value };
      const assignedTo = applyAssignmentRule('leads', updated);
      return assignedTo ? { ...updated, ownerId: assignedTo } : updated;
    });
    await saveAll('leads', next);
    toast.push('success', `${selected.length} lead(s) updated.`);
    setSelected([]);
    load();
  };

  const triageSetStatus = async (lead: Lead, status: LeadStatus) => {
    const updated = { ...lead, status };
    const assignedTo = applyAssignmentRule('leads', updated);
    await upsert('leads', assignedTo ? { ...updated, ownerId: assignedTo } : updated);
    toast.push('success', `${lead.name} marked ${status}.`);
    load();
  };

  const exportCsv = () => {
    downloadCsv('leads-export.csv', [
      ['Name', 'Company', 'Email', 'Phone', 'Status', 'Source', 'Owner', 'Value', 'Created'],
      ...filtered.map((l) => [l.name, l.company, l.email, l.phone, l.status, l.source, ownerName(l.ownerId), l.value, formatDate(l.createdAt)]),
    ]);
    toast.push('info', `Exported ${filtered.length} leads to CSV.`);
  };

  const openWizard = (lead: Lead) => {
    if (lead.status === 'Converted') {
      toast.push('info', 'This lead is already converted.');
      return;
    }
    setWizard({
      lead,
      step: 1,
      contactName: lead.name,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      accountMode: 'new',
      accountName: lead.company,
      existingAccountId: '',
      createDeal: false,
      dealName: `${lead.company} New Business`,
      dealAmount: lead.value,
      dealStage: 'Qualification',
    });
  };

  const finishWizard = async () => {
    if (!wizard || !beginOnce(convertingRef)) return;
    setConverting(true);
    try {
    const accounts = getAllSync<Account>('accounts');
    let accountId: string;
    if (wizard.accountMode === 'existing' && wizard.existingAccountId) {
      accountId = wizard.existingAccountId;
    } else {
      const account: Account = {
        id: newId('account'),
        name: wizard.accountName || wizard.lead.company,
        industry: 'Technology',
        employees: 0,
        revenue: 0,
        website: '',
        phone: wizard.contactPhone,
        ownerId: wizard.lead.ownerId,
        createdAt: new Date().toISOString(),
      };
      await upsert('accounts', account);
      accountId = account.id;
    }
    const contact: Contact = {
      id: newId('contact'),
      name: wizard.contactName,
      email: wizard.contactEmail,
      phone: wizard.contactPhone,
      accountId,
      title: '',
      tags: ['imported'],
      avatar: null,
      notes: [],
      files: [],
      createdAt: new Date().toISOString(),
    };
    await upsert('contacts', contact);
    if (wizard.createDeal) {
      const deal: Deal = {
        id: newId('deal'),
        name: wizard.dealName,
        accountId,
        amount: wizard.dealAmount,
        stage: wizard.dealStage,
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        probability: 20,
        ownerId: wizard.lead.ownerId,
        campaignId: wizard.lead.campaignId ?? null,
        createdAt: new Date().toISOString(),
      };
      const dealAssignedTo = applyAssignmentRule('deals', deal);
      await upsert('deals', dealAssignedTo ? { ...deal, ownerId: dealAssignedTo } : deal);
    }
    const convertedLead = { ...wizard.lead, status: 'Converted' as LeadStatus };
    const leadAssignedTo = applyAssignmentRule('leads', convertedLead);
    await upsert('leads', leadAssignedTo ? { ...convertedLead, ownerId: leadAssignedTo } : convertedLead);
    toast.push('success', `Lead "${wizard.lead.name}" converted successfully.`);
    setWizard({ ...wizard, done: true });
    load();
    } finally {
      convertingRef.current = false;
      setConverting(false);
    }
  };

  const ownerOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const accounts = getAllSync<Account>('accounts');

  const statusOptions = getStatusOptions('leads', 'status', LEAD_STATUSES);
  const filtersOn = statusFilter.length > 0 || Boolean(sourceFilter) || Boolean(ownerFilter);
  const resetPaging = () => {
    setSelected([]);
    setPage(1);
  };
  const onlyStatus = statusFilter.length === 1 ? statusFilter[0] : null;

  return (
    <div className="leads-screen lead3" data-testid="leads-page">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          {!loading && !loadError && (
            <p className="page-subtitle">{leads.length} {leads.length === 1 ? 'lead' : 'leads'}, newest first.</p>
          )}
        </div>
        <div className="page-actions">
          {createdDays && (
            <button className="btn" data-testid="clear-created-filter" onClick={() => setParams({})}>
              Created in the last {createdDays} days · Show all
            </button>
          )}
          <ToolBoxMenu links={LEAD_TOOLBOX_LINKS} />
          {canExportLeads(user?.role) && (
            <button className="btn" onClick={exportCsv} data-testid="export-csv-btn">
              <Download size={16} /> Export CSV
            </button>
          )}
          {canCreateLeads(user?.role) && (
            <button className="btn btn-primary leads-primary" data-testid="new-lead-btn" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} /> New lead
            </button>
          )}
        </div>
      </div>

      {!loading && !loadError && (
        <div className="card lead-flow" role="group" aria-label="Leads by status" data-testid="lead-flow">
          {leadFlow(leads).map(({ status, count }, i) => (
            <button
              type="button"
              key={status}
              className={`lead-flow-step ${statusClass(status)}`}
              aria-pressed={onlyStatus === status}
              style={{ flexGrow: Math.min(Math.max(count, 1), 6), animationDelay: `${i * 70}ms` }}
              onClick={() => {
                setStatusFilter(onlyStatus === status ? [] : [status]);
                resetPaging();
              }}
            >
              <b>{count}</b>
              <span>{status}</span>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar lead-tools">
        <div className="leads-find">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            className="input search-input"
            aria-label="Search leads"
            placeholder="Search name, company, email…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected([]);
            }}
          />
        </div>
        <StatusPicker
          options={statusOptions}
          selected={statusFilter}
          multi
          label="Filter by status"
          testId="status-filter"
          className={`lead-chip${statusFilter.length > 0 ? ' set' : ''}`}
          onPick={(status) => {
            setStatusFilter(toggleStatus(statusFilter, status));
            resetPaging();
          }}
        >
          Status{statusFilter.length > 0 && ` · ${statusFilter.length}`}
        </StatusPicker>
        <div className={`lead-filter${ownerFilter ? ' set' : ''}`}>
          <Select
            value={ownerFilter}
            options={[{ value: '', label: 'Any owner' }, ...ownerOptions]}
            onChange={(v) => {
              setOwnerFilter(v);
              resetPaging();
            }}
            testId="owner-filter"
          />
        </div>
        <div className={`lead-filter${sourceFilter ? ' set' : ''}`}>
          <Select
            value={sourceFilter}
            options={[{ value: '', label: 'Any source' }, ...LEAD_SOURCES.map((source) => ({ value: source, label: source }))]}
            onChange={(v) => {
              setSourceFilter(v);
              resetPaging();
            }}
            testId="source-filter"
          />
        </div>
        {filtersOn && (
          <button
            className="btn btn-ghost"
            data-testid="clear-filters"
            onClick={() => {
              setStatusFilter([]);
              setSourceFilter('');
              setOwnerFilter('');
              resetPaging();
            }}
          >
            Clear filters
          </button>
        )}
        <div className="seg lead-view" role="group" aria-label="View mode">
          <button type="button" aria-pressed={mode === 'table'} aria-label="Table view" data-testid="view-table" onClick={() => setMode('table')}>
            Table
          </button>
          <button type="button" aria-pressed={mode === 'triage'} aria-label="Triage view" data-testid="view-triage" onClick={() => setMode('triage')}>
            Triage
          </button>
        </div>
      </div>

      {mode === 'triage' ? (
        loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <LeadTriageMode
            leads={filtered}
            ownerName={ownerName}
            onQualify={(lead) => triageSetStatus(lead, 'Qualified')}
            onDisqualify={(lead) => triageSetStatus(lead, 'Unqualified')}
            onExit={() => setMode('table')}
          />
        )
      ) : loading ? (
        <SkeletonRows rows={8} />
      ) : loadError ? (
        <div className="card lead-load-error" role="alert" data-testid="leads-load-error">
          <p>Leads could not be loaded.</p>
          <button type="button" className="btn btn-primary" onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <LeadsTable
            rows={pageRows}
            totalLeads={leads.length}
            selected={selected}
            allPageSelected={allPageSelected}
            sortKey={sortKey}
            sortDir={sortDir}
            ownerName={ownerName}
            onToggleSort={toggleSort}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))}
            onOpen={(lead) => navigate(`/leads/${lead.id}`)}
            onRowMenu={(e, lead) => {
              e.stopPropagation();
              const box = e.currentTarget.getBoundingClientRect();
              setMenu({ x: Math.max(8, box.right - 200), y: box.bottom + 4, lead });
            }}
            onContextMenu={(e, lead) => {
              e.preventDefault();
              // Without this, right-clicking a second row while the first row's
              // menu is open bubbles to ContextMenu's own document-level listener,
              // which closes the menu we just opened for this row.
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, lead });
            }}
          />

          <LeadsPagination
            total={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
              setSelected(clearSelection());
            }}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setSelected([]);
            }}
          />
        </>
      )}

      {mode === 'table' && selected.length > 0 && (
        <div className="bulk-bar lead-bulk" data-testid="bulk-bar" role="status" aria-live="polite">
          <span>{selected.length} selected</span>
          <button className="btn" onClick={() => setAssignOpen(true)}>
            Assign owner
          </button>
          <button className="btn" data-testid="mass-update-btn" onClick={() => setMassUpdateOpen(true)}>
            Mass update
          </button>
          <button className="btn btn-danger" onClick={bulkDelete}>
            Delete
          </button>
          <button className="btn lead-bulk-clear" aria-label="Clear selection" onClick={() => setSelected([])}>
            ✕
          </button>
        </div>
      )}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="leads" basePath="/leads" onClose={() => setLayoutPickerOpen(false)} />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'View details', onClick: () => navigate(`/leads/${menu.lead.id}`) },
            { label: 'Convert lead…', onClick: () => openWizard(menu.lead),
              disabled: menu.lead.status === 'Converted',
              disabledReason: menu.lead.status === 'Converted' ? 'This lead is already converted.' : undefined },
          ]}
        />
      )}

      {assignOpen && (
        <Modal
          title="Assign owner"
          onClose={() => setAssignOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setAssignOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!assignTo} onClick={bulkAssign}>
                Assign {selected.length} lead(s)
              </button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">New owner</span>
            <Select value={assignTo} options={ownerOptions} onChange={setAssignTo} placeholder="Choose owner…" />
          </div>
        </Modal>
      )}

      {massUpdateOpen && (
        <MassUpdateModal
          count={selected.length}
          onClose={() => setMassUpdateOpen(false)}
          fields={[
            { key: 'status', label: 'Status', options: getStatusOptions('leads', 'status', LEAD_STATUSES).map((s) => ({ value: s, label: s })) },
            { key: 'source', label: 'Source', options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) },
            { key: 'ownerId', label: 'Owner', options: ownerOptions },
          ]}
          onApply={applyMassUpdate}
        />
      )}

      {wizard && (
        <LeadConvertWizard
          wizard={wizard}
          setWizard={setWizard}
          accounts={accounts}
          onFinish={finishWizard}
          isFinishing={converting}
          doneActions={
            <>
              <button className="btn" onClick={() => setWizard(null)}>Back to leads</button>
              <button className="btn btn-primary" onClick={() => navigate(`/leads/${wizard.lead.id}`)}>Open the lead</button>
            </>
          }
        />
      )}
    </div>
  );
}
