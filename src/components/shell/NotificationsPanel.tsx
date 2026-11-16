import { useEffect, useRef, useState } from 'react';
import { Bell, CheckSquare, Clock, Receipt, Target, TrendingUp, User, X, type LucideIcon } from 'lucide-react';
import { apiFetch } from '../../data/apiFetch';
import { AppNotification } from '../../types';
import { timeAgo } from '../../utils';
import { closeWithExit } from '../v3';

export type NotificationTab = 'all' | 'unread';

export interface NotificationDay {
  day: 'Today' | 'Earlier';
  items: AppNotification[];
}

/** Newest first, split into today and everything before it. */
export function groupNotifications(items: AppNotification[], tab: NotificationTab, now = new Date()): NotificationDay[] {
  const today = now.toDateString();
  const shown = items
    .filter((n) => tab === 'all' || !n.read)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  const groups: NotificationDay[] = [
    { day: 'Today', items: shown.filter((n) => new Date(n.when).toDateString() === today) },
    { day: 'Earlier', items: shown.filter((n) => new Date(n.when).toDateString() !== today) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

const LOOKS: { match: RegExp; icon: LucideIcon; tone?: 'warn' }[] = [
  { match: /overdue|sla|breach|time limit|due/i, icon: Clock, tone: 'warn' },
  { match: /ticket/i, icon: Clock },
  { match: /lead/i, icon: Target },
  { match: /deal/i, icon: TrendingUp },
  { match: /quote/i, icon: Receipt },
  { match: /task/i, icon: CheckSquare },
  { match: /contact|user|team|joined/i, icon: User },
];

/** Picks the picture for a notification from its words, since notifications carry text only. */
export function lookFor(text: string): { icon: LucideIcon; tone?: 'warn' } {
  return LOOKS.find((l) => l.match.test(text)) ?? { icon: Bell };
}

interface Props {
  items: AppNotification[];
  onChange: (next: AppNotification[]) => void;
  onClose: () => void;
}

/** Notifications as a panel that slides in from the right, grouped by day. */
export function NotificationsPanel({ items, onChange, onClose }: Props) {
  const [tab, setTab] = useState<NotificationTab>('all');
  const overlay = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const unread = items.filter((n) => !n.read).length;
  const groups = groupNotifications(items, tab);
  const close = () => closeWithExit(overlay.current, onClose);

  useEffect(() => {
    const opener = document.activeElement;
    closeBtn.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const markRead = (id: string) => {
    onChange(items.map((n) => (n.id === id ? { ...n, read: true } : n)));
    apiFetch(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
  };
  const markAllRead = () => {
    onChange(items.map((n) => ({ ...n, read: true })));
    apiFetch('/notifications/mark-all-read', { method: 'POST' }).catch(() => undefined);
  };

  let row = 0;
  return (
    <div className="notif-overlay" ref={overlay} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="notif-panel" role="dialog" aria-label="Notifications" data-testid="notifications-panel">
        <div className="notif-head">
          <h2>Notifications</h2>
          <button ref={closeBtn} className="icon-btn" aria-label="Close notifications" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="notif-tools">
          <div className="notif-tabs" role="tablist" aria-label="Which notifications to show">
            {(['all', 'unread'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'all' ? 'All' : `Unread${unread ? ` ${unread}` : ''}`}
              </button>
            ))}
          </div>
          <button className="link-btn" onClick={markAllRead} disabled={unread === 0}>
            Mark all read
          </button>
        </div>
        <div className="notif-list">
          {groups.length === 0 && (
            <div className="notif-empty">
              <strong>You're all caught up</strong>
              New assignments, deadlines and updates show here.
            </div>
          )}
          {groups.map((group) => (
            <div key={group.day}>
              <div className="notif-day">{group.day}</div>
              {group.items.map((n) => {
                const look = lookFor(n.text);
                return (
                  <button
                    key={n.id}
                    className={`notif-item${n.read ? '' : ' unread'}`}
                    style={{ animationDelay: `${Math.min(row++, 8) * 35}ms` }}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <span className={`notif-chip${look.tone ? ` ${look.tone}` : ''}`}><look.icon size={17} /></span>
                    <span className="notif-text">
                      <span>{n.text}</span>
                      <small>{timeAgo(n.when)}</small>
                    </span>
                    <span className="notif-unread-dot" aria-label={n.read ? undefined : 'Unread'} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
