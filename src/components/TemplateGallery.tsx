import { ReactNode } from 'react';
import { Plus } from 'lucide-react';

export interface TemplateGalleryItem {
  id: string;
  name: string;
  meta?: string;
  rows?: { label: string; onClick?: () => void }[];
  onClick?: () => void;
}

interface TemplateGalleryProps {
  items: TemplateGalleryItem[];
  createLabel: string;
  createHint: string;
  onCreate: () => void;
  createIcon?: ReactNode;
}

/** Dashed create-tile + named cards grid — used for Layout Designer, Assignment Rules, Dedupe Rules, Status Codes. */
export function TemplateGallery({ items, createLabel, createHint, onCreate, createIcon }: TemplateGalleryProps) {
  return (
    <div className="template-gallery">
      <div className="template-create-tile" onClick={onCreate} role="button">
        <span className="template-create-icon">{createIcon ?? <Plus size={24} />}</span>
        <p>{createHint}</p>
        <button className="btn btn-create" type="button">
          <Plus size={14} /> {createLabel}
        </button>
      </div>
      {items.map((item) => (
        <div key={item.id} className="template-card">
          <div className="template-card-head" onClick={item.onClick} style={{ cursor: item.onClick ? 'pointer' : 'default' }}>
            <div>
              <div className="template-card-name">{item.name}</div>
              {item.meta && <div className="template-card-meta">{item.meta}</div>}
            </div>
          </div>
          {item.rows?.map((row) => (
            <div key={row.label} className="template-card-row" onClick={row.onClick} style={{ cursor: row.onClick ? 'pointer' : 'default' }}>
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
