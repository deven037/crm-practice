import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll } from '../data/store';
import { AuditEntry } from '../types';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { classNames, formatDateTime } from '../utils';

const AUDIT_PAGE_SIZES = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

export function AuditLog() {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  useEffect(() => {
    (async () => {
      setAudit(await getAll<AuditEntry>('audit'));
      setLoading(false);
    })();
  }, []);

  const filteredAudit = useMemo(
    () => (auditUserFilter ? audit.filter((a) => a.user === auditUserFilter) : audit),
    [audit, auditUserFilter]
  );

  const auditUsers = useMemo(() => [...new Set(audit.map((a) => a.user))], [audit]);

  const auditTotalPages = Math.max(1, Math.ceil(filteredAudit.length / auditPageSize));
  const auditCurrentPage = Math.min(auditPage, auditTotalPages);
  const auditPageRows = filteredAudit.slice((auditCurrentPage - 1) * auditPageSize, auditCurrentPage * auditPageSize);

  return (
    <div data-testid="audit-log-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Audit Log</span>
      </nav>
      <div className="page-header">
        <h1>Audit Log ({audit.length})</h1>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          <div className="toolbar">
            <Select
              value={auditUserFilter}
              options={[{ value: '', label: 'All users' }, ...auditUsers.map((u) => ({ value: u, label: u }))]}
              onChange={(v) => {
                setAuditUserFilter(v);
                setAuditPage(1);
              }}
              testId="audit-user-filter"
            />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditPageRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.when)}</td>
                    <td>{entry.user}</td>
                    <td>
                      <code>{entry.action}</code>
                    </td>
                    <td>{entry.detail}</td>
                  </tr>
                ))}
                {filteredAudit.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      No audit entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAudit.length > 0 && (
            <div className="pagination" data-testid="audit-pagination">
              <span className="muted">
                {filteredAudit.length} entries · page {auditCurrentPage} of {auditTotalPages}
              </span>
              <div className="pagination-controls">
                <Select
                  value={String(auditPageSize)}
                  options={AUDIT_PAGE_SIZES}
                  onChange={(v) => {
                    setAuditPageSize(Number(v));
                    setAuditPage(1);
                  }}
                />
                <button
                  className="btn"
                  disabled={auditCurrentPage <= 1}
                  onClick={() => setAuditPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  ‹ Prev
                </button>
                {Array.from({ length: auditTotalPages })
                  .slice(0, 7)
                  .map((_, i) => (
                    <button
                      key={i}
                      className={classNames('btn btn-page', auditCurrentPage === i + 1 && 'btn-active')}
                      onClick={() => setAuditPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                <button
                  className="btn"
                  disabled={auditCurrentPage >= auditTotalPages}
                  onClick={() => setAuditPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
