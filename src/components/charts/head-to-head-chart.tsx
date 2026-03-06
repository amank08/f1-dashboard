"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { getTeamColor } from "@/lib/utils/colors";
import type { HeadToHeadResult } from "@/lib/utils/analytics";

interface HeadToHeadChartProps {
  results: HeadToHeadResult[];
  driver1Name: string;
  driver2Name: string;
  driver1Color: string;
  driver2Color: string;
}

export function HeadToHeadChart({
  results,
  driver1Name,
  driver2Name,
  driver1Color,
  driver2Color,
}: HeadToHeadChartProps) {
  if (!results.length) return null;

  const data = results.map((r) => ({
    race: r.raceName,
    [driver1Name]: r.driver1Pos,
    [driver2Name]: r.driver2Pos,
  }));

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Race Finishing Positions
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="race"
            tick={{ fill: "#888", fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            reversed
            tick={{ fill: "#888", fontSize: 12 }}
            domain={[0.5, 20.5]}
            label={{
              value: "Position",
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
              value !== null && value !== undefined ? `P${value}` : "DNS/DNF",
              "",
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey={driver1Name}
            fill={getTeamColor(driver1Color)}
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey={driver2Name}
            fill={getTeamColor(driver2Color)}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
