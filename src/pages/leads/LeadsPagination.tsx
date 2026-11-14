import { Select } from '../../components/Select';
import { classNames } from '../../utils';
import { pageWindow } from './leadsGuards';

const PAGE_SIZES = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
];

interface Props {
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
}

export function LeadsPagination({ total, currentPage, totalPages, pageSize, onPageSizeChange, onPageChange }: Props) {
  return (
    <div className="pagination" data-testid="pagination">
      <span className="muted">
        {total} {total === 1 ? 'lead' : 'leads'}, page {currentPage} of {totalPages}
      </span>
      <div className="pagination-controls">
        <span className="muted">Rows</span>
        <Select value={String(pageSize)} options={PAGE_SIZES} onChange={(v) => onPageSizeChange(Number(v))} />
        <button className="btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
          ‹ Prev
        </button>
        {pageWindow(currentPage, totalPages).map((p) => (
          <button
            key={p}
            className={classNames('btn btn-page', currentPage === p && 'btn-active')}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button className="btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
          Next ›
        </button>
      </div>
    </div>
  );
}
