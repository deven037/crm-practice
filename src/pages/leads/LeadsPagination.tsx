import { Select } from '../../components/Select';
import { classNames } from '../../utils';

const PAGE_SIZES = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
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
        {total} lead(s) · page {currentPage} of {totalPages}
      </span>
      <div className="pagination-controls">
        <Select value={String(pageSize)} options={PAGE_SIZES} onChange={(v) => onPageSizeChange(Number(v))} />
        <button className="btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
          ‹ Prev
        </button>
        {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => (
          <button
            key={i}
            className={classNames('btn btn-page', currentPage === i + 1 && 'btn-active')}
            onClick={() => onPageChange(i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button className="btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
          Next ›
        </button>
      </div>
    </div>
  );
}
