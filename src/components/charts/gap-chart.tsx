"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getTeamColor } from "@/lib/utils/colors";

interface GapChartProps {
  data: Array<Record<string, number | string>>;
  driverKeys: string[];
  driverColors: Record<string, string>;
}

export function GapChart({ data, driverKeys, driverColors }: GapChartProps) {
  if (!data.length || !driverKeys.length) return null;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Gap to Leader
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="lap"
            tick={{ fill: "#888", fontSize: 12 }}
            label={{
              value: "Lap",
              position: "insideBottom",
              offset: -5,
              fill: "#888",
              fontSize: 12,
            }}
          />
          <YAxis
            tick={{ fill: "#888", fontSize: 12 }}
            reversed
            label={{
              value: "Gap (s)",
              angle: -90,
              position: "insideLeft",
              fill: "#888",
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1E1E2E",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(value?: number) => [
              value !== undefined ? `+${value.toFixed(3)}s` : "—",
              "",
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {driverKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getTeamColor(driverColors[key] ?? "888888")}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
