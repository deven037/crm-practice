import { AppNotification } from '../types';
import { timeAgo } from '../utils';

export function NotificationsPanel({
  items,
  onMarkAllRead,
}: {
  items: AppNotification[];
  onMarkAllRead: () => void;
}) {
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="notif-panel">
      <div className="notif-head">
        <strong>Notifications</strong>
        <button className="link-btn" onClick={onMarkAllRead} disabled={unread === 0}>
          Mark all read
        </button>
      </div>
      {unread === 0 ? (
        <div className="search-hint">No notifications</div>
      ) : (
        items.map((n) => (
          <div key={n.id} className={`notif-item${n.read ? '' : ' unread'}`}>
            <span>{n.text}</span>
            <span className="notif-time">{timeAgo(n.when)}</span>
          </div>
        ))
      )}
    </div>
  );
}
