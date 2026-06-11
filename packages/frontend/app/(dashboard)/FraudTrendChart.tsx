"use client";

import { FraudTrendPoint } from "@/lib/types";

interface FraudTrendChartProps {
  data: FraudTrendPoint[];
}

export function FraudTrendChart({ data }: FraudTrendChartProps) {
  const width = 920;
  const height = 220;
  const padding = { top: 20, right: 18, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.flatMap((point) => [point.alerts, point.confirmed, point.dismissed]);
  const maxValue = Math.max(1, ...values);
  const xStep = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const series = [
    { key: "alerts" as const, label: "Total Alerts", color: "#1d4ed8", width: 2, dashed: false },
    { key: "confirmed" as const, label: "Confirmed", color: "#dc2626", width: 2, dashed: false },
    { key: "dismissed" as const, label: "Dismissed", color: "#6b7280", width: 1.5, dashed: true },
  ];

  const scaleX = (index: number) => padding.left + index * xStep;
  const scaleY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;

  const buildPath = (key: keyof FraudTrendPoint) =>
    data
      .map((point, index) => `${index === 0 ? "M" : "L"}${scaleX(index)},${scaleY(point[key] as number)}`)
      .join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible" role="img" aria-label="Fraud alert trend chart">
        <defs>
          <linearGradient id="trend-grid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(148,163,184,0.2)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.05)" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - chartHeight * tick;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="url(#trend-grid)" strokeWidth={1} />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
                {Math.round(maxValue * tick)}
              </text>
            </g>
          );
        })}

        {data.map((point, index) => {
          if (index % 2 !== 0 && index !== data.length - 1) return null;
          return (
            <text
              key={point.date}
              x={scaleX(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          );
        })}

        {series.map((item) => (
          <path
            key={item.key}
            d={buildPath(item.key)}
            fill="none"
            stroke={item.color}
            strokeWidth={item.width}
            strokeDasharray={item.dashed ? "5 4" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {series.map((item) =>
          data.map((point, index) => {
            const x = scaleX(index);
            const y = scaleY(point[item.key]);
            return <circle key={`${item.key}-${point.date}`} cx={x} cy={y} r={3.5} fill={item.color} />;
          })
        )}

        <g transform={`translate(${padding.left}, ${18})`}>
          {series.map((item, index) => (
            <g key={item.key} transform={`translate(${index * 130}, 0)`}>
              <line x1={0} x2={18} y1={0} y2={0} stroke={item.color} strokeWidth={item.width + 1} strokeDasharray={item.dashed ? "5 4" : undefined} strokeLinecap="round" />
              <text x={26} y={4} className="fill-slate-700 text-[11px]">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
