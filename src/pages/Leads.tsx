import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll, getAllSync, newId, removeMany, saveAll, upsert, logAudit } from '../data/store';
import { Account, Contact, Deal, DealStage, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, User } from '../types';
import { Modal } from '../components/Modal';
import { MultiSelect, SearchableSelect, Select } from '../components/Select';
import { ContextMenu } from '../components/ContextMenu';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames, downloadCsv, formatCurrency, formatDate } from '../utils';

type SortKey = 'name' | 'company' | 'status' | 'source' | 'value' | 'createdAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

interface WizardState {
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

export function Leads() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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

  // interactions
  const [menu, setMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  const load = async () => {
    setLoading(true);
    const [l, u] = await Promise.all([getAll<Lead>('leads'), getAll<User>('users')]);
    setLeads(l);
    setUsers(u);
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
  }, [leads, debouncedQuery, statusFilter, sourceFilter, ownerFilter, sortKey, sortDir]);

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
    logAudit(user?.name ?? 'Unknown', 'lead.delete', `Deleted ${selected.length} leads`);
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
    if (!wizard) return;
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
        createdAt: new Date().toISOString(),
      };
      await upsert('deals', deal);
    }
    await upsert('leads', { ...wizard.lead, status: 'Converted' as LeadStatus });
    logAudit(user?.name ?? 'Unknown', 'lead.convert', `Converted lead ${wizard.lead.name}`);
    toast.push('success', `Lead "${wizard.lead.name}" converted successfully.`);
    setWizard(null);
    load();
  };

  const ownerOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const accounts = getAllSync<Account>('accounts');

  return (
    <div data-testid="leads-page">
      <div className="page-header">
        <h1>Leads</h1>
        <div className="page-actions">
          <button className="btn" onClick={exportCsv} data-testid="export-csv-btn">
            ⬇ Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/leads/new')}>
            + New Lead
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search name, company, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={classNames('btn', showFilters && 'btn-active')}
          data-testid="filters-toggle"
          onClick={() => setShowFilters((s) => !s)}
        >
          ⚙ Filters{(statusFilter.length > 0 || sourceFilter || ownerFilter) && ' •'}
        </button>
        {selected.length > 0 && (
          <div className="bulk-bar" data-testid="bulk-bar">
            <span>{selected.length} selected</span>
            <button className="btn" onClick={() => setAssignOpen(true)}>
              Assign owner
            </button>
            <button className="btn btn-danger" onClick={bulkDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="filter-panel" data-testid="filter-panel">
          <div className="field">
            <span className="field-label">Status</span>
            <MultiSelect
              values={statusFilter}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              placeholder="Any status"
            />
          </div>
          <div className="field">
            <span className="field-label">Source</span>
            <Select
              value={sourceFilter}
              options={[{ value: '', label: 'Any source' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
              onChange={(v) => {
                setSourceFilter(v);
                setPage(1);
              }}
            />
          </div>
          <div className="field">
            <span className="field-label">Owner</span>
            <Select
              value={ownerFilter}
              options={[{ value: '', label: 'Any owner' }, ...ownerOptions]}
              onChange={(v) => {
                setOwnerFilter(v);
                setPage(1);
              }}
            />
          </div>
          <button
            className="link-btn"
            onClick={() => {
              setStatusFilter([]);
              setSourceFilter('');
              setOwnerFilter('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input type="checkbox" aria-label="Select all" checked={allPageSelected} onChange={toggleSelectAll} />
                  </th>
                  <th onClick={() => toggleSort('name')} className="sortable">Name{sortIndicator('name')}</th>
                  <th onClick={() => toggleSort('company')} className="sortable">Company{sortIndicator('company')}</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th onClick={() => toggleSort('status')} className="sortable">Status{sortIndicator('status')}</th>
                  <th onClick={() => toggleSort('source')} className="sortable">Source{sortIndicator('source')}</th>
                  <th>Owner</th>
                  <th onClick={() => toggleSort('value')} className="sortable num">Value{sortIndicator('value')}</th>
                  <th onClick={() => toggleSort('createdAt')} className="sortable">Created{sortIndicator('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-cell">
                      No leads match the current filters.
                    </td>
                  </tr>
                )}
                {pageRows.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`row-clickable${selected.includes(lead.id) ? ' row-selected' : ''}`}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, lead });
                    }}
                  >
                    <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        checked={selected.includes(lead.id)}
                        onChange={() =>
                          setSelected((sel) => (sel.includes(lead.id) ? sel.filter((id) => id !== lead.id) : [...sel, lead.id]))
                        }
                      />
                    </td>
                    <td>{lead.name}</td>
                    <td>{lead.company}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone}</td>
                    <td>
                      <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
                    </td>
                    <td>{lead.source}</td>
                    <td>{ownerName(lead.ownerId)}</td>
                    <td className="num">{formatCurrency(lead.value)}</td>
                    <td>{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination" data-testid="pagination">
            <span className="muted">
              {filtered.length} lead(s) · page {currentPage} of {totalPages}
            </span>
            <div className="pagination-controls">
              <Select
                value={String(pageSize)}
                options={PAGE_SIZES}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              />
              <button className="btn" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => (
                <button
                  key={i}
                  className={classNames('btn btn-page', currentPage === i + 1 && 'btn-active')}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="btn" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                Next ›
              </button>
            </div>
          </div>
        </>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: '👁 View details', onClick: () => navigate(`/leads/${menu.lead.id}`) },
            { label: '🔄 Convert lead…', onClick: () => openWizard(menu.lead) },
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

      {wizard && (
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
              <button className="btn btn-primary" data-testid="wizard-finish" onClick={finishWizard}>
                Finish conversion
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
