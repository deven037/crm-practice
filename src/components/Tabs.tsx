import { ReactNode, useId, useState } from 'react';
import { motion } from 'motion/react';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, testId }: { tabs: TabDef[]; testId?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const group = useId();

  return (
    <div className="tabs" data-testid={testId}>
      <div className="tab-list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            className={`tab${tab.id === active ? ' active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {/* one pill shared by the group: it glides to the tab that was picked */}
            {tab.id === active && (
              <motion.span className="tab-pill" layoutId={`tab-pill-${group}`} transition={{ type: 'spring', stiffness: 480, damping: 36 }} />
            )}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" key={current?.id}>
        {current?.content}
      </div>
    </div>
  );
}
