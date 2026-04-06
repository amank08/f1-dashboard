"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Position, Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";

interface PositionChartProps {
  positions: Position[];
  drivers: Driver[];
  selectedDriverNumbers: number[];
  totalLaps: number;
}

export function PositionChart({
  positions,
  drivers,
  selectedDriverNumbers,
  totalLaps,
}: PositionChartProps) {
  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) {
    driverLookup.set(d.driver_number, d);
  }

  // Group positions by driver, take periodic snapshots
  const snapshots = new Map<number, Map<number, number>>();
  for (const driverNum of selectedDriverNumbers) {
    const driverPositions = positions.filter(
      (p) => p.driver_number === driverNum
    );
    const posMap = new Map<number, number>();

    // Map time-based positions to approximate laps
    // Use evenly spaced intervals
    if (driverPositions.length > 0) {
      const interval = Math.max(
        1,
        Math.floor(driverPositions.length / totalLaps)
      );
      for (let i = 0; i < driverPositions.length; i += interval) {
        const lap = Math.min(
          Math.floor((i / driverPositions.length) * totalLaps) + 1,
          totalLaps
        );
        posMap.set(lap, driverPositions[i].position);
      }
    }
    snapshots.set(driverNum, posMap);
  }

  const chartData = [];
  for (let lap = 1; lap <= totalLaps; lap++) {
    const row: Record<string, number | null> = { lap };
    for (const driverNum of selectedDriverNumbers) {
      const posMap = snapshots.get(driverNum);
      row[`d${driverNum}`] = posMap?.get(lap) ?? null;
    }
    chartData.push(row);
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
        <XAxis dataKey="lap" stroke="#6B6B7B" tick={{ fontSize: 12 }} />
        <YAxis
          reversed
          stroke="#6B6B7B"
          tick={{ fontSize: 12 }}
          domain={[1, 20]}
          label={{
            value: "Position",
            angle: -90,
            position: "insideLeft",
            fill: "#A0A0B0",
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1E1E2E",
            border: "1px solid #2E2E42",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(lap) => `Lap ${lap}`}
          formatter={(value?: number) => [`P${value ?? "—"}`, ""]}
        />
        <Legend />
        {selectedDriverNumbers.map((driverNum) => {
          const driver = driverLookup.get(driverNum);
          return (
            <Line
              key={driverNum}
              type="stepAfter"
              dataKey={`d${driverNum}`}
              name={driver?.name_acronym ?? String(driverNum)}
              stroke={driver ? getTeamColor(driver.team_colour, driver.team_name) : "#888"}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
