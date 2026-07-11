/** Hand-rolled SVG charts — stable structure, deliberately no test IDs. */

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export function BarChart({ data, height = 180, color = 'var(--accent)' }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height / 2.5 + 14}`} className="chart" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 2.5 - 6);
        return (
          <g key={d.label}>
            <rect
              x={i * barWidth + barWidth * 0.15}
              y={height / 2.5 - h}
              width={barWidth * 0.7}
              height={h}
              rx={1.5}
              fill={color}
              opacity={0.85}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text x={i * barWidth + barWidth / 2} y={height / 2.5 + 9} textAnchor="middle" className="chart-label">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = 15.9155; // circumference ≈ 100
  let offset = 25;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="chart donut" role="img" aria-label="Donut chart">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          const el = (
            <circle
              key={d.label}
              cx="21"
              cy="21"
              r={radius}
              fill="transparent"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          offset -= pct;
          return el;
        })}
        <text x="21" y="23" textAnchor="middle" className="donut-total">
          {total}
        </text>
      </svg>
      <ul className="chart-legend">
        {data.map((d, i) => (
          <li key={d.label}>
            <span className="legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            {d.label} ({d.value})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ data, color = '#10b981' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = 100 / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => `${i * stepX},${40 - (d.value / max) * 34}`).join(' ');
  return (
    <svg viewBox="-4 -4 108 56" className="chart" role="img" aria-label="Line chart">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={i * stepX} cy={40 - (d.value / max) * 34} r="1.8" fill={color}>
            <title>{`${d.label}: ${d.value}`}</title>
          </circle>
          <text x={i * stepX} y={49} textAnchor="middle" className="chart-label">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
