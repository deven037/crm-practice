import { DragEvent, ReactNode, useState } from 'react';
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
}

/** Generic drag-and-drop kanban primitive — shared by Deals (stage) and Tickets (priority). */
export function Kanban<T>({ columns, getId, cardRenderer, onCardClick, onDrop, emptyLabel = 'Drop here', testId }: KanbanProps<T>) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (e: DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/kanban-id') || dragId;
    if (id) onDrop(id, columnKey);
    setDragId(null);
  };

  return (
    <div className="kanban" data-testid={testId}>
      {columns.map((col) => (
        <div
          key={col.key}
          className={classNames('kanban-col', dragOver === col.key && 'drag-over')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(col.key);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          <div className="kanban-head">
            <span className="kanban-title">{col.label}</span>
            {col.headerMeta && <span className="kanban-meta">{col.headerMeta}</span>}
          </div>
          <div className="kanban-cards">
            {col.items.map((item) => {
              const id = getId(item);
              return (
                <div
                  key={id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/kanban-id', id);
                    setDragId(id);
                  }}
                  onClick={() => onCardClick?.(item)}
                >
                  {cardRenderer(item)}
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
