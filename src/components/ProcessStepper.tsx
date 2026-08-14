export interface ProcessStepDef {
  id: string;
  label: string;
  state: 'current' | 'completed' | 'locked' | 'unlocked';
  onClick?: () => void;
}

interface ProcessStepperProps {
  steps: ProcessStepDef[];
  testId?: string;
  showLegend?: boolean;
}

const STATE_LABEL: Record<ProcessStepDef['state'], string> = {
  current: 'Running',
  completed: 'Completed',
  locked: 'Locked',
  unlocked: 'Unlocked',
};

/** Chevron-shaped process stepper (reference-derived) — used for Deals' stage progression and Quotes' workflow. */
export function ProcessStepper({ steps, testId, showLegend }: ProcessStepperProps) {
  return (
    <div data-testid={testId}>
      <div className="process-stepper">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`process-step ${step.state}`}
            onClick={step.onClick}
            style={{ cursor: step.onClick ? 'pointer' : 'default' }}
          >
            <div>
              <span className="process-step-label">{step.label}</span>
              <span className="process-step-status">{STATE_LABEL[step.state]}</span>
            </div>
          </div>
        ))}
      </div>
      {showLegend && (
        <div className="process-legend">
          <span><span className="process-legend-dot" style={{ background: 'var(--accent)' }} />Current stage</span>
          <span><span className="process-legend-dot" style={{ background: 'var(--success)' }} />Completed</span>
          <span><span className="process-legend-dot" style={{ background: 'var(--surface-3)' }} />Locked</span>
        </div>
      )}
    </div>
  );
}
