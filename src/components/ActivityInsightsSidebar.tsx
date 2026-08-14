import { Deal } from '../types';
import { formatDate } from '../utils';

interface ActivityInsightsSidebarProps {
  deal: Deal;
}

/** Computed purely from deal.stage/closeDate/createdAt — no new backend dependency. */
export function ActivityInsightsSidebar({ deal }: ActivityInsightsSidebarProps) {
  const isClosed = deal.stage.startsWith('Closed');
  const daysOpen = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000);
  const daysToClose = Math.floor((new Date(deal.closeDate).getTime() - Date.now()) / 86400000);

  return (
    <div className="card">
      <h3>Insights</h3>
      <dl className="detail-list">
        <dt>Days in pipeline</dt>
        <dd>{daysOpen} day(s)</dd>
        {isClosed ? (
          <>
            <dt>Closed on</dt>
            <dd>{formatDate(deal.closeDate)}</dd>
          </>
        ) : (
          <>
            <dt>{daysToClose >= 0 ? 'Days to close' : 'Days overdue'}</dt>
            <dd style={daysToClose < 0 ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{Math.abs(daysToClose)} day(s)</dd>
          </>
        )}
        <dt>Win probability</dt>
        <dd>{deal.probability}%</dd>
      </dl>
      <div className="status-board-progress-track" style={{ marginTop: 4 }}>
        <div className="status-board-progress-fill" style={{ width: `${deal.probability}%` }} />
      </div>
    </div>
  );
}
