"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { RiskDistribution } from "@/lib/types";
import { RISK_BAND } from "@/lib/risk";
import { RiskLevel } from "@/lib/types";

interface RiskDistributionChartProps {
  data: RiskDistribution[];
}

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const chartData = data.map((d) => ({
    name: RISK_BAND[d.level as RiskLevel].label,
    value: d.count,
    pct: d.pct,
    fill: RISK_BAND[d.level as RiskLevel].hex,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={72}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid hsl(214, 32%, 88%)",
            borderRadius: "6px",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: number, _name: string, props: any) => [
            `${(value as number).toLocaleString()} (${(props?.payload?.pct as number | undefined)?.toFixed(1)}%)`,
            "Visits",
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
