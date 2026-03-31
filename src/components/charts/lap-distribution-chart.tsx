"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { LapData, Driver, Stint } from "@/lib/openf1/types";
import { getTeamColor, TIRE_COLORS } from "@/lib/utils/colors";
import { formatLapTime } from "@/lib/utils/formatters";

interface LapDistributionChartProps {
  laps: LapData[];
  drivers: Driver[];
  stints?: Stint[];
}

interface LapPoint {
  name: string;
  lapTime: number;
  teamColour: string;
  lap: number;
  lapNumber: number;
  compound: string | null;
}

function getCompoundForLap(
  stintsByDriver: Map<number, Stint[]>,
  driverNumber: number,
  lapNumber: number
): string | null {
  const driverStints = stintsByDriver.get(driverNumber);
  if (!driverStints) return null;
  const stint = driverStints.find(
    (s) => s.lap_start != null && s.lap_end != null && lapNumber >= s.lap_start && lapNumber <= s.lap_end
  );
  return stint?.compound ?? null;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LapPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const compound = data.compound;
  const compoundColor = compound
    ? TIRE_COLORS[compound as keyof typeof TIRE_COLORS]
    : null;

  return (
    <div
      className="rounded-lg border border-f1-border bg-f1-surface px-3 py-2 text-xs shadow-lg"
      style={{ color: "#fff" }}
    >
      <div className="font-bold">{data.name}</div>
      <div className="mt-1">{formatLapTime(data.lapTime)}</div>
      <div className="text-f1-text-secondary">Lap {data.lapNumber}</div>
      {compound && (
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              color: compoundColor ?? "#888",
              backgroundColor: `${compoundColor ?? "#888"}20`,
            }}
          >
            {compound.charAt(0)}
          </span>
          <span>{compound}</span>
        </div>
      )}
    </div>
  );
}

export function LapDistributionChart({
  laps,
  drivers,
  stints,
}: LapDistributionChartProps) {
  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) driverLookup.set(d.driver_number, d);

  // Build stint lookup by driver
  const stintsByDriver = new Map<number, Stint[]>();
  if (stints) {
    for (const s of stints) {
      if (!stintsByDriver.has(s.driver_number)) {
        stintsByDriver.set(s.driver_number, []);
      }
      stintsByDriver.get(s.driver_number)!.push(s);
    }
  }

  // Get the fastest valid lap to set a baseline for filtering outliers
  const validLaps = laps.filter(
    (l) => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap
  );
  if (validLaps.length === 0) return null;

  const fastest = Math.min(...validLaps.map((l) => l.lap_duration!));
  // Filter out laps > 110% of fastest (SC laps, out laps, etc.)
  const cutoff = fastest * 1.1;

  // Sort drivers by their best lap time
  const bestByDriver = new Map<number, number>();
  for (const l of validLaps) {
    if (l.lap_duration! > cutoff) continue;
    const cur = bestByDriver.get(l.driver_number);
    if (!cur || l.lap_duration! < cur) {
      bestByDriver.set(l.driver_number, l.lap_duration!);
    }
  }
  const sortedDriverNums = [...bestByDriver.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([num]) => num);

  const driverIndex = new Map<number, number>();
  sortedDriverNums.forEach((num, i) => driverIndex.set(num, i));

  const points: LapPoint[] = [];
  for (const l of validLaps) {
    if (l.lap_duration! > cutoff) continue;
    const driver = driverLookup.get(l.driver_number);
    if (!driver || !driverIndex.has(l.driver_number)) continue;
    points.push({
      name: driver.name_acronym,
      lapTime: l.lap_duration!,
      teamColour: driver.team_colour,
      lap: driverIndex.get(l.driver_number)!,
      lapNumber: l.lap_number,
      compound: getCompoundForLap(stintsByDriver, l.driver_number, l.lap_number),
    });
  }

  const acronyms = sortedDriverNums.map(
    (num) => driverLookup.get(num)?.name_acronym ?? String(num)
  );

  const minTime = fastest - 0.2;
  const maxTime = Math.min(
    cutoff,
    Math.max(...points.map((p) => p.lapTime)) + 0.2
  );

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Lap Time Distribution
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
          <XAxis
            type="number"
            dataKey="lap"
            domain={[-0.5, sortedDriverNums.length - 0.5]}
            ticks={sortedDriverNums.map((_, i) => i)}
            tickFormatter={(i: number) => acronyms[i] ?? ""}
            tick={{ fill: "#A0A0B0", fontSize: 11, fontWeight: 600 }}
            stroke="#333"
            interval={0}
          />
          <YAxis
            type="number"
            dataKey="lapTime"
            domain={[minTime, maxTime]}
            tickFormatter={(v: number) => formatLapTime(v)}
            tick={{ fill: "#888", fontSize: 11 }}
            stroke="#333"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={false}
          />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={getTeamColor(p.teamColour)}
                fillOpacity={0.6}
                r={3}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
