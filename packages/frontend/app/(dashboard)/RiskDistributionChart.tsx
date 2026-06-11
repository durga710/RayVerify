"use client";

import { RiskDistribution } from "@/lib/types";
import { RISK_BAND } from "@/lib/risk";
import { RiskLevel } from "@/lib/types";

interface RiskDistributionChartProps {
  data: RiskDistribution[];
}

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const size = 160;
  const radius = 58;
  const strokeWidth = 18;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, data.reduce((sum, item) => sum + item.count, 0));

  let offset = 0;
  const segments = data.map((item) => {
    const band = RISK_BAND[item.level as RiskLevel];
    const length = (item.count / total) * circumference;
    const segment = {
      label: band.label,
      count: item.count,
      pct: item.pct,
      color: band.hex,
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
    };
    offset += length;
    return segment;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[160px] w-[160px] shrink-0" role="img" aria-label="Risk distribution chart">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(214, 32%, 92%)"
          strokeWidth={strokeWidth}
        />
        {segments.map((segment, index) => (
          <circle
            key={segment.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.dasharray}
            strokeDashoffset={segment.dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            opacity={index === 0 ? 1 : 0.96}
          />
        ))}
        <text x={center} y={center - 2} textAnchor="middle" className="fill-slate-900 text-[14px] font-semibold">
          {total.toLocaleString()}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" className="fill-slate-500 text-[9px] uppercase tracking-[0.18em]">
          visits
        </text>
      </svg>

      <div className="space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {segment.count.toLocaleString()} ({segment.pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
