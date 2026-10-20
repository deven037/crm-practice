import { Activity } from 'lucide-react';

export interface AnalysisChart {
  title: string;
  type: 'bar' | 'line';
  labels: string[];
  values: number[];
}

export interface AnalysisReport {
  title?: string;
  summary?: { label: string; value: string | number }[];
  processed_dataset?: string;
  processed_dataset_info?: { name: string; rows: number; fields: string[]; size_bytes: number };
  charts?: AnalysisChart[];
  tables?: { title: string; columns: string[]; rows: (string | number)[][] }[];
  logs?: string[];
  artifacts?: { name: string; path: string }[];
}

const BRIDGE_URL = 'http://127.0.0.1:8765';

function AnalysisChartView({ chart }: { chart: AnalysisChart }) {
  const values = chart.values.map((value) => Number(value) || 0);
  const max = Math.max(1, ...values);
  const width = 620;
  const height = 220;
  const left = 34;
  const right = 14;
  const top = 14;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = values.map((value, index) => ({
    x: values.length <= 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (values.length - 1),
    y: top + plotHeight - (value / max) * plotHeight,
  }));

  return (
    <div className="analysis-chart">
      <h4>{chart.title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title}>
        <line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} className="analysis-chart-axis" />
        {chart.type === 'bar' ? values.map((value, index) => {
          const slot = plotWidth / Math.max(values.length, 1);
          const barWidth = Math.min(44, slot * 0.58);
          const barHeight = (value / max) * plotHeight;
          const point = points[index];
          return (
            <g key={`${chart.labels[index]}-${index}`}>
              <rect x={point.x - barWidth / 2} y={point.y} width={barWidth} height={barHeight} rx="3" className="analysis-chart-bar">
                <title>{`${chart.labels[index]}: ${value}`}</title>
              </rect>
              <text x={point.x} y={height - 11} textAnchor="middle" className="analysis-chart-label">{chart.labels[index]}</text>
            </g>
          );
        }) : (
          <>
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} className="analysis-chart-line" />
            {points.map((point, index) => (
              <g key={`${chart.labels[index]}-${index}`}>
                <circle cx={point.x} cy={point.y} r="4" className="analysis-chart-point"><title>{`${chart.labels[index]}: ${values[index]}`}</title></circle>
                <text x={point.x} y={height - 11} textAnchor="middle" className="analysis-chart-label">{chart.labels[index]}</text>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

export function AnalysisReportView({ report }: { report: AnalysisReport }) {
  return (
    <>
      {report.summary && report.summary.length > 0 && (
        <div className="analysis-summary">
          {report.summary.map((item, index) => <div key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}
        </div>
      )}
      {report.charts?.map((chart, index) => <AnalysisChartView key={`${chart.title}-${index}`} chart={chart} />)}
      {report.tables?.map((table, index) => (
        <div className="analysis-result-table" key={`${table.title}-${index}`}>
          <h3>{table.title}</h3>
          <div className="table-wrap"><table className="table">
            <thead><tr>{table.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`}>{column}</th>)}</tr></thead>
            <tbody>{table.rows.slice(0, 100).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{String(cell)}</td>)}</tr>)}</tbody>
          </table></div>
        </div>
      ))}
      {report.artifacts?.length ? (
        <div className="analysis-artifacts">
          <h3>Saved charts</h3>
          <div>{report.artifacts.map((artifact) => <figure key={artifact.path}><img src={`${BRIDGE_URL}/api/artifact?path=${encodeURIComponent(artifact.path)}`} alt={artifact.name} /><figcaption>{artifact.name}</figcaption></figure>)}</div>
        </div>
      ) : null}
      {report.logs?.length ? (
        <div className="analysis-logs"><h3><Activity size={14} /> Run log</h3><pre>{report.logs.join('\n')}</pre></div>
      ) : null}
    </>
  );
}
