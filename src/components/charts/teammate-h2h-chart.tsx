"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from "recharts";
import type { Driver, LapData } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";
import { formatLapTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

interface TeammateH2HChartProps {
  drivers: Driver[];
  laps: LapData[];
}

interface BestLapData {
  lapTime: number;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  i1Speed: number | null;
  i2Speed: number | null;
  stSpeed: number | null;
}

// Axis config: for time axes lower is better, for speed axes higher is better
interface AxisConfig {
  key: string;
  label: string;
  lowerIsBetter: boolean;
}

const AXES: AxisConfig[] = [
  { key: "s1", label: "S1", lowerIsBetter: true },
  { key: "i1Speed", label: "I1 Speed", lowerIsBetter: false },
  { key: "s2", label: "S2", lowerIsBetter: true },
  { key: "i2Speed", label: "I2 Speed", lowerIsBetter: false },
  { key: "s3", label: "S3", lowerIsBetter: true },
  { key: "stSpeed", label: "Speed Trap", lowerIsBetter: false },
];

export function TeammateH2HChart({ drivers, laps }: TeammateH2HChartProps) {
  // Find best lap per driver (with speed data from that lap)
  const bestLaps = useMemo(() => {
    const map = new Map<number, BestLapData>();
    for (const lap of laps) {
      if (!lap.lap_duration || lap.is_pit_out_lap) continue;
      const cur = map.get(lap.driver_number);
      if (!cur || lap.lap_duration < cur.lapTime) {
        map.set(lap.driver_number, {
          lapTime: lap.lap_duration,
          s1: lap.duration_sector_1 ?? null,
          s2: lap.duration_sector_2 ?? null,
          s3: lap.duration_sector_3 ?? null,
          i1Speed: lap.i1_speed ?? null,
          i2Speed: lap.i2_speed ?? null,
          stSpeed: lap.st_speed ?? null,
        });
      }
    }
    return map;
  }, [laps]);

  // Also find best speeds across ALL laps (not just the fastest lap)
  const bestSpeeds = useMemo(() => {
    const map = new Map<number, { i1: number | null; i2: number | null; st: number | null }>();
    for (const lap of laps) {
      if (lap.is_pit_out_lap) continue;
      const cur = map.get(lap.driver_number) ?? { i1: null, i2: null, st: null };
      if (lap.i1_speed != null && (cur.i1 == null || lap.i1_speed > cur.i1)) cur.i1 = lap.i1_speed;
      if (lap.i2_speed != null && (cur.i2 == null || lap.i2_speed > cur.i2)) cur.i2 = lap.i2_speed;
      if (lap.st_speed != null && (cur.st == null || lap.st_speed > cur.st)) cur.st = lap.st_speed;
      map.set(lap.driver_number, cur);
    }
    return map;
  }, [laps]);

  const sortedDrivers = useMemo(() => {
    return drivers
      .filter((d) => bestLaps.has(d.driver_number))
      .sort((a, b) => bestLaps.get(a.driver_number)!.lapTime - bestLaps.get(b.driver_number)!.lapTime);
  }, [drivers, bestLaps]);

  const [driver1Num, setDriver1Num] = useState<number | null>(null);
  const [driver2Num, setDriver2Num] = useState<number | null>(null);

  const d1 = driver1Num ?? sortedDrivers[0]?.driver_number ?? null;
  const d2 = driver2Num ?? sortedDrivers[1]?.driver_number ?? null;

  const d1Data = d1 != null ? bestLaps.get(d1) : undefined;
  const d2Data = d2 != null ? bestLaps.get(d2) : undefined;
  const d1Speeds = d1 != null ? bestSpeeds.get(d1) : undefined;
  const d2Speeds = d2 != null ? bestSpeeds.get(d2) : undefined;
  const d1Driver = sortedDrivers.find((d) => d.driver_number === d1);
  const d2Driver = sortedDrivers.find((d) => d.driver_number === d2);

  const isTeammates = d1Driver && d2Driver && d1Driver.team_name === d2Driver.team_name;

  // Build radar data: normalize each axis to 0-100 scale across all drivers
  const radarData = useMemo(() => {
    if (!d1Data || !d2Data) return null;

    // Use best speeds from any lap, sector times from fastest lap
    const d1Values: Record<string, number | null> = {
      s1: d1Data.s1,
      s2: d1Data.s2,
      s3: d1Data.s3,
      i1Speed: d1Speeds?.i1 ?? d1Data.i1Speed,
      i2Speed: d1Speeds?.i2 ?? d1Data.i2Speed,
      stSpeed: d1Speeds?.st ?? d1Data.stSpeed,
    };
    const d2Values: Record<string, number | null> = {
      s1: d2Data.s1,
      s2: d2Data.s2,
      s3: d2Data.s3,
      i1Speed: d2Speeds?.i1 ?? d2Data.i1Speed,
      i2Speed: d2Speeds?.i2 ?? d2Data.i2Speed,
      stSpeed: d2Speeds?.st ?? d2Data.stSpeed,
    };

    // Gather all values per axis across ALL drivers for normalization range
    const allDriverValues: Record<string, number[]> = {};
    for (const axis of AXES) allDriverValues[axis.key] = [];

    for (const [dNum] of bestLaps) {
      const data = bestLaps.get(dNum)!;
      const speeds = bestSpeeds.get(dNum);
      const vals: Record<string, number | null> = {
        s1: data.s1,
        s2: data.s2,
        s3: data.s3,
        i1Speed: speeds?.i1 ?? data.i1Speed,
        i2Speed: speeds?.i2 ?? data.i2Speed,
        stSpeed: speeds?.st ?? data.stSpeed,
      };
      for (const axis of AXES) {
        const v = vals[axis.key];
        if (v != null) allDriverValues[axis.key].push(v);
      }
    }

    return AXES.map((axis) => {
      const allVals = allDriverValues[axis.key];
      if (allVals.length === 0) return null;

      const min = Math.min(...allVals);
      const max = Math.max(...allVals);
      const range = max - min || 1;

      // Normalize to 0-100 where 100 = best
      function normalize(v: number | null): number | null {
        if (v == null) return null;
        if (axis.lowerIsBetter) {
          return ((max - v) / range) * 100;
        }
        return ((v - min) / range) * 100;
      }

      const d1Norm = normalize(d1Values[axis.key]);
      const d2Norm = normalize(d2Values[axis.key]);

      return {
        axis: axis.label,
        key: axis.key,
        d1: d1Norm != null ? Math.max(10, d1Norm) : null, // min 10 so the shape is visible
        d2: d2Norm != null ? Math.max(10, d2Norm) : null,
        d1Raw: d1Values[axis.key],
        d2Raw: d2Values[axis.key],
        lowerIsBetter: axis.lowerIsBetter,
      };
    }).filter((d): d is NonNullable<typeof d> => d != null);
  }, [d1Data, d2Data, d1Speeds, d2Speeds, bestLaps, bestSpeeds]);

  if (sortedDrivers.length < 2) return null;

  const d1Color = d1Driver ? getTeamColor(d1Driver.team_colour, d1Driver.team_name) : "#888";
  const d2Color = d2Driver ? getTeamColor(d2Driver.team_colour, d2Driver.team_name) : "#888";
  const d2StrokeColor = isTeammates ? lightenColor(d2Color, 0.4) : d2Color;

  const totalDelta = d1Data && d2Data ? d2Data.lapTime - d1Data.lapTime : 0;

  return (
    <div className="flex h-[560px] flex-col rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Lap Comparison
      </h3>

      {/* Driver selectors */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <DriverSelector
          color={d1Color}
          value={d1}
          drivers={sortedDrivers}
          bestLaps={bestLaps}
          onChange={setDriver1Num}
          dashed={false}
        />
        <span className="text-f1-text-muted font-semibold">vs</span>
        <DriverSelector
          color={isTeammates ? d2StrokeColor : d2Color}
          value={d2}
          drivers={sortedDrivers}
          bestLaps={bestLaps}
          onChange={setDriver2Num}
          dashed={isTeammates ?? false}
        />
        {d1Data && d2Data && (
          <span className="ml-auto font-mono text-sm font-bold text-f1-text-secondary">
            {totalDelta >= 0 ? "+" : ""}
            {totalDelta.toFixed(3)}s
          </span>
        )}
      </div>

      {radarData && d1Driver && d2Driver && (
        <>
          {/* Radar chart */}
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#2E2E42" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "#A0A0B0", fontSize: 11, fontWeight: 600 }}
              />
              <Radar
                dataKey="d1"
                stroke={d1Color}
                fill={d1Color}
                fillOpacity={0.15}
                strokeWidth={2}
                name={d1Driver.name_acronym}
                dot={{ r: 3, fill: d1Color }}
              />
              <Radar
                dataKey="d2"
                stroke={isTeammates ? d2StrokeColor : d2Color}
                fill={isTeammates ? d2StrokeColor : d2Color}
                fillOpacity={0.15}
                strokeWidth={2}
                strokeDasharray={isTeammates ? "6 3" : undefined}
                name={d2Driver.name_acronym}
                dot={{ r: 3, fill: isTeammates ? d2StrokeColor : d2Color }}
              />
              <Tooltip
                content={
                  <RadarTooltip
                    d1Name={d1Driver.name_acronym}
                    d2Name={d2Driver.name_acronym}
                    d1Color={d1Color}
                    d2Color={isTeammates ? d2StrokeColor : d2Color}
                  />
                }
              />
            </RadarChart>
          </ResponsiveContainer>

          {/* Detailed breakdown */}
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {radarData.map((axis) => {
              const d1Raw = axis.d1Raw;
              const d2Raw = axis.d2Raw;
              const delta = d1Raw != null && d2Raw != null
                ? axis.lowerIsBetter ? d2Raw - d1Raw : d1Raw - d2Raw
                : null;
              const d1Better = delta != null && delta > 0;
              const d2Better = delta != null && delta < 0;

              return (
                <div
                  key={axis.key}
                  className="rounded-md bg-f1-card/50 px-2.5 py-2"
                >
                  <div className="text-f1-text-muted font-semibold mb-1">
                    {axis.axis}
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={cn(
                        "font-mono",
                        d1Better && "font-bold"
                      )}
                      style={{ color: d1Color }}
                    >
                      {d1Raw != null
                        ? axis.lowerIsBetter
                          ? d1Raw.toFixed(3)
                          : `${d1Raw}`
                        : "—"}
                    </span>
                    <span
                      className={cn(
                        "font-mono",
                        d2Better && "font-bold"
                      )}
                      style={{ color: isTeammates ? d2StrokeColor : d2Color }}
                    >
                      {d2Raw != null
                        ? axis.lowerIsBetter
                          ? d2Raw.toFixed(3)
                          : `${d2Raw}`
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DriverSelector({
  color,
  value,
  drivers,
  bestLaps,
  onChange,
  dashed,
}: {
  color: string;
  value: number | null;
  drivers: Driver[];
  bestLaps: Map<number, BestLapData>;
  onChange: (num: number) => void;
  dashed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          border: dashed ? `2px dashed ${color}` : "none",
        }}
      />
      <select
        className="rounded-md border border-f1-border bg-f1-card px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-f1-red"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {drivers.map((d) => (
          <option key={d.driver_number} value={d.driver_number}>
            {d.name_acronym} — {formatLapTime(bestLaps.get(d.driver_number)!.lapTime)}
          </option>
        ))}
      </select>
    </div>
  );
}

function RadarTooltip({
  active,
  payload,
  d1Name,
  d2Name,
  d1Color,
  d2Color,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { axis: string; d1Raw: number | null; d2Raw: number | null; lowerIsBetter: boolean };
  }>;
  d1Name: string;
  d2Name: string;
  d1Color: string;
  d2Color: string;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const isTime = data.lowerIsBetter;
  const format = (v: number | null) =>
    v == null ? "—" : isTime ? v.toFixed(3) + "s" : v + " km/h";

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface px-3 py-2 text-xs shadow-lg text-white">
      <div className="font-bold text-f1-text-muted mb-1">{data.axis}</div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d1Color }} />
          <span>{d1Name}</span>
        </div>
        <span className="font-mono">{format(data.d1Raw)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d2Color }} />
          <span>{d2Name}</span>
        </div>
        <span className="font-mono">{format(data.d2Raw)}</span>
      </div>
    </div>
  );
}

function lightenColor(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}
