import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSync } from '../data/store';
import { AutoFlowProcess, CustomFieldModule, PageLayout } from '../types';
import { SlideOver } from './SlideOver';
import { useAuth } from '../auth/AuthContext';

export function LayoutPickerPanel({
  module,
  basePath,
  onClose,
}: {
  module: CustomFieldModule;
  basePath: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const layouts = [...getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === module)].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault)
  );
  const autoFlows = getAllSync<AutoFlowProcess>('autoFlowProcesses').filter(
    (p) => p.targetModule === module && p.status === 'published' && (!user || p.allowedRoles.includes(user.role))
  );

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]') ?? []);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const choose = (layout: PageLayout) => {
    onClose();
    navigate(`${basePath}/new?layout=${layout.id}`);
  };

  const chooseAutoFlow = (process: AutoFlowProcess) => {
    onClose();
    navigate(`${basePath}/new?autoflow=${process.id}`);
  };

  return (
    <SlideOver title="Choose a layout" onClose={onClose} side="right" testId="layout-picker-panel">
      <p className="muted" style={{ marginTop: 0 }}>
        Pick the layout to use for this new record.
      </p>
      <div className="layout-picker-list">
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            className="layout-picker-item"
            data-testid={`layout-picker-item-${l.id}`}
            onClick={() => choose(l)}
          >
            <span className="layout-picker-item-name">{l.name}</span>
            <span className="muted">
              {l.tabs.length} tab{l.tabs.length === 1 ? '' : 's'}
              {l.isDefault ? ' · Default' : ''}
            </span>
          </button>
        ))}
      </div>

      {autoFlows.length > 0 && (
        <>
          <p className="muted" style={{ marginTop: 20 }}>
            Or use an AutoFlow process — a guided, multi-step flow instead of a single form.
          </p>
          <div className="layout-picker-list">
            {autoFlows.map((p) => (
              <button
                key={p.id}
                type="button"
                className="layout-picker-item"
                data-testid={`autoflow-picker-item-${p.id}`}
                onClick={() => chooseAutoFlow(p)}
              >
                <span className="layout-picker-item-name">{p.name}</span>
                <span className="muted">
                  {p.nodes.length} step{p.nodes.length === 1 ? '' : 's'} · AutoFlow
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </SlideOver>
  );
}
