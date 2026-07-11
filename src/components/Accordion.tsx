import { ReactNode, useState } from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export function Accordion({ title, children, defaultOpen = false, badge }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`accordion${open ? ' open' : ''}`}>
      <button type="button" className="accordion-header" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="accordion-chevron" aria-hidden="true">
          ▸
        </span>
        <span className="accordion-title">{title}</span>
        {badge !== undefined && <span className="badge">{badge}</span>}
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}
