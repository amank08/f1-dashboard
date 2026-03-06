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

interface PointsProgressionChartProps {
  data: Array<Record<string, number | string>>;
  driverKeys: string[];
  driverColors: Record<string, string>;
}

export function PointsProgressionChart({
  data,
  driverKeys,
  driverColors,
}: PointsProgressionChartProps) {
  if (!data.length || !driverKeys.length) return null;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Points Progression
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="race"
            tick={{ fill: "#888", fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fill: "#888", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1E1E2E",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
          />
          {driverKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getTeamColor(driverColors[key] ?? "888888")}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
