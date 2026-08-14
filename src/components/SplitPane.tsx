import { ReactNode } from 'react';

interface SplitPaneProps {
  list: ReactNode;
  detail: ReactNode;
  testId?: string;
}

/** List/editor-left, reading/preview-right — shared by the Tickets inbox and the Quotes live builder. */
export function SplitPane({ list, detail, testId }: SplitPaneProps) {
  return (
    <div className="split-pane" data-testid={testId}>
      <div className="split-pane-list">{list}</div>
      <div className="split-pane-detail">{detail}</div>
    </div>
  );
}
