import { KeyboardEvent, ReactNode, useId, useState } from 'react';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, testId }: { tabs: TabDef[]; testId?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const baseId = useId();
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    document.getElementById(tabId(tabs[next].id))?.focus();
  };

  return (
    <div className="tabs" data-testid={testId}>
      <div className="tab-list" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            role="tab"
            aria-selected={tab.id === current?.id}
            aria-controls={panelId(tab.id)}
            tabIndex={tab.id === current?.id ? 0 : -1}
            className={`tab${tab.id === current?.id ? ' active' : ''}`}
            onClick={() => setActive(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="tab-panel" role="tabpanel" id={panelId(current.id)} aria-labelledby={tabId(current.id)}>
          {current.content}
        </div>
      )}
    </div>
  );
}
