import { ReactNode } from 'react';
import { Columns3, MoreVertical, Search as SearchIcon } from 'lucide-react';

interface ViewsToolbarProps {
  /** The row of View/Filter/Sort controls — pages supply their own, this just provides the shared chrome. */
  children: ReactNode;
  onApply?: () => void;
  testId?: string;
}

/** Shared "Views" list-page toolbar (View/Filter/Sort + Apply + Action icons), reused across every list page. */
export function ViewsToolbar({ children, onApply, testId }: ViewsToolbarProps) {
  return (
    <div className="views-toolbar" data-testid={testId}>
      <div className="views-toolbar-head">
        <span className="views-toolbar-title">Views</span>
        <div className="views-toolbar-tools">
          <button className="icon-btn" aria-label="Search within list" type="button">
            <SearchIcon size={15} />
          </button>
          <button className="icon-btn" aria-label="Column options" type="button">
            <Columns3 size={15} />
          </button>
          <button className="icon-btn" aria-label="More actions" type="button">
            <MoreVertical size={15} />
          </button>
        </div>
      </div>
      <div className="views-toolbar-row">
        {children}
        {onApply && (
          <button className="btn btn-apply" onClick={onApply}>
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
