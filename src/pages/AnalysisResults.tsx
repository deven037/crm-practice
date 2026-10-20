import { ArrowLeft, Clock3, FileSpreadsheet } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AnalysisReport, AnalysisReportView } from '../components/AnalysisReportView';

interface AnalysisLocationState {
  report?: AnalysisReport;
  datasetPath?: string;
  datasetName?: string;
  completedAt?: string;
}

export function AnalysisResults() {
  const location = useLocation();
  const state = (location.state ?? {}) as AnalysisLocationState;

  if (!state.report) {
    return (
      <div className="analysis-results-page">
        <div className="page-header"><div><span className="data-studio-eyebrow">PYTHON OUTPUT</span><h1>Analysis results</h1></div></div>
        <div className="card analysis-results-empty">
          <h2>No analysis run is open</h2>
          <p className="muted">Run an analysis from Data Studio to see its report here. Results are kept for this browser navigation session.</p>
          <Link to="/data-studio" className="btn btn-primary"><ArrowLeft size={15} /> Back to Data Studio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-results-page" data-testid="analysis-results-page">
      <div className="page-header analysis-results-header">
        <div>
          <span className="data-studio-eyebrow">PYTHON OUTPUT</span>
          <h1>{state.report.title ?? 'Analysis results'}</h1>
          <div className="analysis-results-meta">
            {state.datasetPath && <span><FileSpreadsheet size={14} /> {state.datasetName ?? 'Dataset'} · <code>{state.datasetPath}</code></span>}
            {state.completedAt && <span><Clock3 size={14} /> {new Date(state.completedAt).toLocaleString()}</span>}
          </div>
        </div>
        <Link to="/data-studio" className="btn"><ArrowLeft size={15} /> Back to Data Studio</Link>
      </div>
      <section className="data-studio-analysis" data-testid="python-analysis-results">
        <div className="data-studio-analysis-heading">
          <div><span className="data-studio-kicker">ANALYSIS REPORT</span><h2>{state.datasetName ?? 'Dataset'}</h2></div>
          <span className="analysis-script-tag"><Clock3 size={13} /> {state.completedAt ? new Date(state.completedAt).toLocaleTimeString() : 'Completed'}</span>
        </div>
        {state.report.processed_dataset && (
          <div className="processed-dataset-panel" data-testid="processed-dataset-panel">
            <div className="processed-dataset-copy">
              <span className="data-studio-kicker">CLEANED DATASET</span>
              <strong>{state.report.processed_dataset_info?.name ?? state.datasetName ?? 'Processed dataset'}</strong>
              <span className="muted">{state.report.processed_dataset_info?.rows ?? '—'} rows · {state.report.processed_dataset_info?.fields.length ?? '—'} fields</span>
              <code>{state.report.processed_dataset}</code>
            </div>
            <Link to="/data-studio" state={{ selectDatasetPath: state.report.processed_dataset }} className="btn btn-primary">Use cleaned dataset</Link>
          </div>
        )}
        <AnalysisReportView report={state.report} />
      </section>
    </div>
  );
}
