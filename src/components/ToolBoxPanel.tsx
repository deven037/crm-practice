import { Link } from 'react-router-dom';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { timeAgo } from '../utils';

interface ToolBoxLink {
  label: string;
  to: string;
}

interface ToolBoxPanelProps {
  module: string;
  links: ToolBoxLink[];
}

/**
 * Landing row on every list page, above the table/board view: "Recently Accessed" (this
 * module's last-viewed records) on the left, "ToolBox" (curated admin/config links — the
 * Setup rules/status-codes/etc. relevant to this module) on the right — two side-by-side
 * panels, not tabs.
 */
export function ToolBoxPanel({ module, links }: ToolBoxPanelProps) {
  const { items } = useRecentlyViewed();
  const recentForModule = items.filter((i) => i.module === module).slice(0, 5);

  return (
    <div className="toolbox-panel-row" data-testid="toolbox-panel">
      <div className="toolbox-col">
        <div className="toolbox-col-head">Recently Accessed</div>
        <div className="toolbox-body">
          {recentForModule.length === 0 ? (
            <div className="search-hint">No recently accessed records yet.</div>
          ) : (
            recentForModule.map((r) => (
              <Link key={r.id} to={r.link} className="recent-item">
                <span className="recent-item-name">{r.label}</span>
                {r.meta && (
                  <div className="recent-item-meta">
                    {Object.entries(r.meta).map(([k, v]) => (
                      <span key={k}>
                        {k}: {v || '—'}
                      </span>
                    ))}
                  </div>
                )}
                <div className="recent-item-meta">
                  <span>Viewed {timeAgo(r.viewedAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
      <div className="toolbox-col">
        <div className="toolbox-col-head">ToolBox</div>
        <div className="toolbox-body">
          {links.length === 0 ? (
            <div className="search-hint">No ToolBox items for this module.</div>
          ) : (
            links.map((l) => (
              <Link key={l.to} to={l.to} className="toolbox-link">
                {l.label}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
