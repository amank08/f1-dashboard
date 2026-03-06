"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getTeamColor } from "@/lib/utils/colors";

interface GridVsFinishData {
  name: string;
  gridPos: number;
  finishPos: number;
  teamColour: string;
  change: number;
}

export function GridVsFinishChart({ data }: { data: GridVsFinishData[] }) {
  if (!data.length) return null;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Grid vs Finish Position
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            type="number"
            dataKey="gridPos"
            name="Grid"
            domain={[0.5, 20.5]}
            tick={{ fill: "#888", fontSize: 12 }}
            label={{
              value: "Grid Position",
              position: "insideBottom",
              offset: -5,
              fill: "#888",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="finishPos"
            name="Finish"
            domain={[0.5, 20.5]}
            reversed
            tick={{ fill: "#888", fontSize: 12 }}
            label={{
              value: "Finish Position",
              angle: -90,
              position: "insideLeft",
              fill: "#888",
              fontSize: 12,
            }}
          />
          <ReferenceLine
            segment={[
              { x: 1, y: 1 },
              { x: 20, y: 20 },
            ]}
            stroke="#555"
            strokeDasharray="5 5"
            label={{ value: "No change", fill: "#555", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1E1E2E",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: 12,
            }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload as GridVsFinishData;
              if (!d) return null;
              return (
                <div className="rounded-lg border border-f1-border bg-f1-surface p-3 text-sm shadow-lg">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-f1-text-secondary">
                    Grid: P{d.gridPos} → Finish: P{d.finishPos}
                  </p>
                  <p
                    className={
                      d.change > 0
                        ? "text-green-400"
                        : d.change < 0
                          ? "text-red-400"
                          : "text-f1-text-muted"
                    }
                  >
                    {d.change > 0
                      ? `+${d.change} positions gained`
                      : d.change < 0
                        ? `${d.change} positions lost`
                        : "No change"}
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            fill="#E10600"
            shape={(props: any) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={getTeamColor(payload.teamColour)}
                  stroke="#15151E"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-2 text-center text-xs text-f1-text-muted">
        Below diagonal = gained positions, Above = lost positions
      </div>
    </div>
  );
}
