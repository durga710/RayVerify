"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { TrendPoint, RiskLevel } from "@/lib/types";
import { RISK_BAND } from "@/lib/risk";

interface ProviderTrendSparklineProps {
  trend: TrendPoint[];
  riskLevel: RiskLevel;
}

export function ProviderTrendSparkline({
  trend,
  riskLevel,
}: ProviderTrendSparklineProps) {
  const color = RISK_BAND[riskLevel].hex;

  return (
    <div style={{ width: 80, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "2px 6px" }}
            formatter={(v: number) => [v, "Score"]}
            labelFormatter={(label: string) => label.slice(5)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
