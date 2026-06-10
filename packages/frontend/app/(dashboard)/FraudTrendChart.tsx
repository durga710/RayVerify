"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FraudTrendPoint } from "@/lib/types";

interface FraudTrendChartProps {
  data: FraudTrendPoint[];
}

export function FraudTrendChart({ data }: FraudTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 88%)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }
          interval={2}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid hsl(214, 32%, 88%)",
            borderRadius: "6px",
          }}
          labelFormatter={(v: string) =>
            new Date(v).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="alerts"
          name="Total Alerts"
          stroke="#1d4ed8"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="confirmed"
          name="Confirmed"
          stroke="#dc2626"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="dismissed"
          name="Dismissed"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
