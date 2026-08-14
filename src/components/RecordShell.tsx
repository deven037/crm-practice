import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabDef } from './Tabs';

export interface KeyInfoItem {
  label: string;
  value: ReactNode;
}

interface Breadcrumb {
  label: string;
  to?: string;
}

interface RecordShellProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  actions: ReactNode;
  keyInfo: KeyInfoItem[];
  tabs: TabDef[];
  testId: string;
}

/**
 * Shared record-detail shell: breadcrumb → title → key-info strip → tab bar → sectioned content.
 * Reused by Leads, Contacts, Products, Campaigns, Accounts detail pages.
 * Whichever tab hosts CustomFieldsSection must still wrap it in a `.detail-list`/`.form-grid`
 * container itself — this shell only supplies the outer chrome, not per-tab layout.
 */
export function RecordShell({ breadcrumbs, title, actions, keyInfo, tabs, testId }: RecordShellProps) {
  return (
    <div data-testid={testId}>
      <nav className="breadcrumbs">
        {breadcrumbs.map((b, i) => (
          <span key={i}>
            {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
            {i < breadcrumbs.length - 1 && <span>/</span>}
          </span>
        ))}
      </nav>

      <div className="page-header">
        <h1>{title}</h1>
        <div className="page-actions">{actions}</div>
      </div>

      {keyInfo.length > 0 && (
        <div className="key-info-strip">
          {keyInfo.map((item) => (
            <div key={item.label} className="key-info-item">
              <span className="key-info-label">{item.label}</span>
              <span className="key-info-value">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs tabs={tabs} testId={`${testId}-tabs`} />
    </div>
  );
}
