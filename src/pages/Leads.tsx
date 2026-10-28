import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ListChecks, SlidersHorizontal, Table2 } from 'lucide-react';
import { getAll, getAllSync, newId, removeMany, saveAll, upsert } from '../data/store';
import { Account, Contact, Deal, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, User } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { ContextMenu } from '../components/ContextMenu';
import { LeadTriageMode } from '../components/LeadTriageMode';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { MassUpdateModal } from '../components/MassUpdateModal';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames, downloadCsv, formatDate } from '../utils';
import { applyAssignmentRule, getStatusOptions } from '../utils/rules';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';
import { LeadFilterPanel } from './leads/LeadFilterPanel';
import { LeadsPagination } from './leads/LeadsPagination';
import { LeadsTable, SortKey } from './leads/LeadsTable';
import { beginOnce, canExportLeads, clearSelection } from './leads/leadsGuards';

type SortDir = 'asc' | 'desc';

export function Leads() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    let rows = [...leads];
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
      );
    }
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
  }, [leads, debouncedQuery, statusFilter, sourceFilter, ownerFilter, createdDays, sortKey, sortDir]);

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

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

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
    const next = leads.map((l) => (selected.includes(l.id) ? { ...l, ownerId: assignTo } : l));
    await saveAll('leads', next);
    toast.push('success', `${selected.length} lead(s) assigned to ${ownerName(assignTo)}.`);
    setAssignOpen(false);
    setSelected([]);
    setAssignTo('');
    load();
  };

  // Setup → Mass Update, reusing the existing per-item upsert in a loop (same pattern as bulkAssign).
  const applyMassUpdate = async (fieldKey: string, value: string) => {
    const next = leads.map((l) => {
      if (!selected.includes(l.id)) return l;
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

  const openWizard = (lead: Lead) =>
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
    setWizard(null);
    load();
    } finally {
      convertingRef.current = false;
      setConverting(false);
    }
  };

  const ownerOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const accounts = getAllSync<Account>('accounts');

  return (
    <div data-testid="leads-page">
      <div className="page-header">
        <h1>Leads</h1>
        <div className="page-actions">
          {createdDays && (
            <button className="btn" data-testid="clear-created-filter" onClick={() => setParams({})}>
              Created in the last {createdDays} days · Show all
            </button>
          )}
          {canExportLeads(user?.role) && (
            <button className="btn" onClick={exportCsv} data-testid="export-csv-btn">
              <Download size={14} /> Export CSV
            </button>
          )}
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              className={classNames('btn', mode === 'table' && 'btn-active')}
              aria-label="Table view"
              data-testid="view-table"
              onClick={() => setMode('table')}
            >
              <Table2 size={14} /> Table
            </button>
            <button
              className={classNames('btn', mode === 'triage' && 'btn-active')}
              aria-label="Triage view"
              data-testid="view-triage"
              onClick={() => setMode('triage')}
            >
              <ListChecks size={14} /> Triage
            </button>
          </div>
          <button className="btn btn-create" onClick={() => setLayoutPickerOpen(true)}>
            + New Lead
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="leads"
        links={[
          { label: 'Assignment Rules', to: '/setup/assignment-rules' },
          { label: 'Dedupe Rule', to: '/setup/dedupe-rules' },
          { label: 'Status Codes', to: '/setup/status-codes' },
          { label: 'Import Data', to: '/setup/import' },
          { label: 'Custom Fields', to: '/admin/objects/leads' },
          { label: 'Customise Page Layout', to: '/setup/layouts/leads' },
        ]}
      />

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
      ) : (
        <>
      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search name, company, email…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected([]);
          }}
        />
        <button
          className={classNames('btn', showFilters && 'btn-active')}
          data-testid="filters-toggle"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={14} /> Filters{(statusFilter.length > 0 || sourceFilter || ownerFilter) && ' •'}
        </button>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar" data-testid="bulk-bar" role="status" aria-live="polite">
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
        </div>
      )}

      {showFilters && (
        <LeadFilterPanel
          statusFilter={statusFilter}
          statusOptions={getStatusOptions('leads', 'status', LEAD_STATUSES)}
          sourceFilter={sourceFilter}
          ownerFilter={ownerFilter}
          ownerOptions={ownerOptions}
          onStatusChange={(v) => {
            setStatusFilter(v);
            setSelected([]);
            setPage(1);
          }}
          onSourceChange={(v) => {
            setSourceFilter(v);
            setSelected([]);
            setPage(1);
          }}
          onOwnerChange={(v) => {
            setOwnerFilter(v);
            setSelected([]);
            setPage(1);
          }}
          onClear={() => {
            setStatusFilter([]);
            setSourceFilter('');
            setOwnerFilter('');
            setSelected([]);
            setPage(1);
          }}
        />
      )}

      {loading ? (
        <SkeletonRows rows={8} />
      ) : loadError ? (
        <div role="alert" data-testid="leads-load-error">
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
            sortIndicator={sortIndicator}
            onToggleSort={toggleSort}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))}
            onOpen={(lead) => navigate(`/leads/${lead.id}`)}
            onContextMenu={(e, lead) => {
              e.preventDefault();
              // Without this, right-clicking a second row while the first row's
              // menu is open bubbles to ContextMenu's own document-level listener,
              // which closes the menu we just opened for this row.
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, lead });
            }}
            onConvert={openWizard}
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
        </>
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
            { label: 'Convert lead…', onClick: () => openWizard(menu.lead) },
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

      {wizard && <LeadConvertWizard wizard={wizard} setWizard={setWizard} accounts={accounts} onFinish={finishWizard} isFinishing={converting} />}
    </div>
  );
}
