"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendPoint, RiskLevel } from "@/lib/types";
import { RISK_BAND } from "@/lib/risk";

interface ProviderRiskTrendChartProps {
  trend: TrendPoint[];
  riskLevel: RiskLevel;
}

export function ProviderRiskTrendChart({
  trend,
  riskLevel,
}: ProviderRiskTrendChartProps) {
  const color = RISK_BAND[riskLevel].hex;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={trend} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 88%)" />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }}
          tickLine={false}
          axisLine={false}
        />
        {/* Risk band reference lines */}
        <ReferenceLine y={30} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} label={{ value: "LOW", position: "right", fontSize: 9, fill: "#16a34a" }} />
        <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 2" strokeWidth={1} label={{ value: "MOD", position: "right", fontSize: 9, fill: "#d97706" }} />
        <ReferenceLine y={80} stroke="#ea580c" strokeDasharray="4 2" strokeWidth={1} label={{ value: "HIGH", position: "right", fontSize: 9, fill: "#ea580c" }} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid hsl(214, 32%, 88%)",
            borderRadius: "6px",
          }}
          formatter={(v: number) => [v, "Risk Score"]}
          labelFormatter={(v: string) => v}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={2}
          fill="url(#riskGradient)"
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
