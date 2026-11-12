import { DragEvent, KeyboardEvent, ReactNode, useState } from 'react';
import { classNames } from '../utils';

export interface KanbanColumn<T> {
  key: string;
  label: string;
  items: T[];
  headerMeta?: ReactNode;
}

interface KanbanProps<T> {
  columns: KanbanColumn<T>[];
  getId: (item: T) => string;
  cardRenderer: (item: T) => ReactNode;
  onCardClick?: (item: T) => void;
  /** Called with (itemId, targetColumnKey) — all business logic (e.g. autoCloseDate) stays in the caller. */
  onDrop: (itemId: string, columnKey: string) => void;
  emptyLabel?: string;
  testId?: string;
  /** Accessible name of a card. When set, cards are focusable and get a "Move to…" menu (the non-drag path). */
  getLabel?: (item: T) => string;
  /** Turns off dragging and the move menu (read-only roles). */
  readOnly?: boolean;
}

/** Generic drag-and-drop kanban primitive — shared by Deals (stage) and Tickets (priority). */
export function Kanban<T>({
  columns,
  getId,
  cardRenderer,
  onCardClick,
  onDrop,
  emptyLabel = 'Drop here',
  testId,
  getLabel,
  readOnly = false,
}: KanbanProps<T>) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (e: DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/kanban-id') || dragId;
    if (id) onDrop(id, columnKey);
    setDragId(null);
  };

  const onCardKey = (e: KeyboardEvent, item: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCardClick?.(item);
    }
  };

  return (
    <div className="kanban" data-testid={testId}>
      {columns.map((col) => (
        <div
          key={col.key}
          className={classNames('kanban-col', dragOver === col.key && 'drag-over')}
          role={getLabel ? 'group' : undefined}
          aria-label={getLabel ? `${col.label}, ${col.items.length} deals` : undefined}
          onDragOver={(e) => {
            if (readOnly) return;
            e.preventDefault();
            setDragOver(col.key);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            if (!readOnly) handleDrop(e, col.key);
          }}
        >
          <div className="kanban-head">
            <span className="kanban-title">{col.label}</span>
            {col.headerMeta && <span className="kanban-meta">{col.headerMeta}</span>}
          </div>
          <div className="kanban-cards">
            {col.items.map((item) => {
              const id = getId(item);
              const label = getLabel?.(item);
              return (
                <div
                  key={id}
                  className="kanban-card"
                  draggable={!readOnly}
                  tabIndex={getLabel ? 0 : undefined}
                  role={getLabel ? 'button' : undefined}
                  aria-label={label}
                  onKeyDown={getLabel ? (e) => onCardKey(e, item) : undefined}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/kanban-id', id);
                    setDragId(id);
                  }}
                  onClick={() => onCardClick?.(item)}
                >
                  {cardRenderer(item)}
                  {label && !readOnly && (
                    <select
                      className="kanban-move"
                      aria-label={`Move ${label} to…`}
                      value=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (e.target.value) onDrop(id, e.target.value);
                      }}
                    >
                      <option value="">Move to…</option>
                      {columns
                        .filter((c) => c.key !== col.key)
                        .map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              );
            })}
            {col.items.length === 0 && <div className="kanban-empty">{emptyLabel}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
