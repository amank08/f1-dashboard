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
import type { LapData, Driver } from "@/lib/openf1/types";
import { formatLapTime } from "@/lib/utils/formatters";
import { getTeamColor } from "@/lib/utils/colors";

interface LapTimeChartProps {
  laps: LapData[];
  drivers: Driver[];
  selectedDriverNumbers: number[];
}

export function LapTimeChart({
  laps,
  drivers,
  selectedDriverNumbers,
}: LapTimeChartProps) {
  // Build chart data: one row per lap, with a column per driver
  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) {
    driverLookup.set(d.driver_number, d);
  }

  const maxLap = Math.max(...laps.map((l) => l.lap_number), 0);
  const chartData = [];

  for (let lap = 1; lap <= maxLap; lap++) {
    const row: Record<string, number | null> = { lap };
    for (const driverNum of selectedDriverNumbers) {
      const lapData = laps.find(
        (l) => l.driver_number === driverNum && l.lap_number === lap
      );
      row[`d${driverNum}`] =
        lapData?.lap_duration && !lapData.is_pit_out_lap
          ? lapData.lap_duration
          : null;
    }
    chartData.push(row);
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
        <XAxis
          dataKey="lap"
          stroke="#6B6B7B"
          tick={{ fontSize: 12 }}
          label={{ value: "Lap", position: "insideBottom", offset: -5, fill: "#A0A0B0" }}
        />
        <YAxis
          stroke="#6B6B7B"
          tick={{ fontSize: 12 }}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => formatLapTime(v)}
          label={{
            value: "Lap Time",
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
          labelStyle={{ color: "#A0A0B0" }}
          formatter={(value?: number) => [formatLapTime(value ?? null), ""]}
          labelFormatter={(lap) => `Lap ${lap}`}
        />
        <Legend />
        {selectedDriverNumbers.map((driverNum) => {
          const driver = driverLookup.get(driverNum);
          return (
            <Line
              key={driverNum}
              type="monotone"
              dataKey={`d${driverNum}`}
              name={driver?.name_acronym ?? String(driverNum)}
              stroke={driver ? getTeamColor(driver.team_colour) : "#888"}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
