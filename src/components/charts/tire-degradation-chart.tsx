"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TIRE_COLORS } from "@/lib/utils/colors";
import { formatLapTime } from "@/lib/utils/formatters";
import type { DegradationPoint } from "@/lib/utils/tire-degradation";
import type { TireCompound } from "@/lib/openf1/types";

export function TireDegradationChart({
  data,
}: {
  data: DegradationPoint[];
}) {
  if (!data.length) return null;

  const compounds = [...new Set(data.map((d) => d.compound))];

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Tire Degradation
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            type="number"
            dataKey="stintLap"
            name="Stint Lap"
            tick={{ fill: "#888", fontSize: 12 }}
            label={{
              value: "Laps on Tire",
              position: "insideBottom",
              offset: -5,
              fill: "#888",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="lapTime"
            name="Lap Time"
            tick={{ fill: "#888", fontSize: 12 }}
            tickFormatter={(v) => formatLapTime(v)}
            domain={["auto", "auto"]}
            label={{
              value: "Lap Time",
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
            formatter={(value?: number, name?: string) => {
              if (name === "Lap Time") return [formatLapTime(value ?? null), name];
              return [value ?? "—", name ?? ""];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {compounds.map((compound) => (
            <Scatter
              key={compound}
              name={compound}
              data={data.filter((d) => d.compound === compound)}
              fill={TIRE_COLORS[compound as TireCompound] ?? "#888"}
              r={3}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-2 text-center text-xs text-f1-text-muted">
        Shows how lap times increase as tires wear — steeper = more degradation
      </div>
    </div>
  );
}
