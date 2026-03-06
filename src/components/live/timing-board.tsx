"use client";

import type { Driver, Position, Interval, Stint, LapData } from "@/lib/openf1/types";
import { getTeamColor, TIRE_COLORS } from "@/lib/utils/colors";
import { formatLapTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

// Mini-sector status codes from OpenF1
const SEGMENT_YELLOW = 2048;
const SEGMENT_GREEN = 2049;
const SEGMENT_PURPLE = 2051;
const SEGMENT_PIT = 2064;

function getSegmentColor(value: number | null): string {
  switch (value) {
    case SEGMENT_GREEN:
      return "#00FF00";
    case SEGMENT_PURPLE:
      return "#A855F7";
    case SEGMENT_YELLOW:
      return "#FACC15";
    case SEGMENT_PIT:
      return "#3B82F6";
    default:
      return "#4B5563"; // gray for null/unknown
  }
}

function getSectorColor(
  duration: number | null,
  bestPersonal: number | null,
  bestOverall: number | null
): string {
  if (duration === null) return "text-f1-text-muted";
  if (bestOverall !== null && duration <= bestOverall) return "text-purple-400";
  if (bestPersonal !== null && duration <= bestPersonal) return "text-green-400";
  return "text-yellow-400";
}

interface SectorBests {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

interface TimingEntry {
  position: number;
  driverNumber: number;
  acronym: string;
  teamColour: string;
  interval: number | string | null;
  gapToLeader: number | string | null;
  lastLap: number | null;
  bestLap: number | null;
  compound: string | null;
  pitCount: number;
  sectorTimes: [number | null, number | null, number | null];
  segments: (number | null)[][];
  personalBestSectors: SectorBests;
}

export function buildTimingData(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  stints: Stint[],
  laps: LapData[]
): TimingEntry[] {
  // Get latest position per driver
  const latestPos = new Map<number, number>();
  for (const p of positions) {
    latestPos.set(p.driver_number, p.position);
  }

  // Get latest interval per driver
  const latestInterval = new Map<number, { interval: number | string | null; gap: number | string | null }>();
  for (const i of intervals) {
    latestInterval.set(i.driver_number, {
      interval: i.interval,
      gap: i.gap_to_leader,
    });
  }

  // Get current compound per driver (last stint)
  const currentCompound = new Map<number, string>();
  const pitCounts = new Map<number, number>();
  for (const s of stints) {
    currentCompound.set(s.driver_number, s.compound);
    pitCounts.set(s.driver_number, Math.max((pitCounts.get(s.driver_number) ?? 0), s.stint_number - 1));
  }

  // Get last lap, best lap, latest sectors, segments, and personal best sectors per driver
  const lastLap = new Map<number, number>();
  const bestLap = new Map<number, number>();
  const latestSectors = new Map<number, [number | null, number | null, number | null]>();
  const latestSegments = new Map<number, (number | null)[][]>();
  const personalBestSectors = new Map<number, SectorBests>();

  for (const l of laps) {
    const dn = l.driver_number;

    // Track personal best sectors
    const pb = personalBestSectors.get(dn) ?? { s1: null, s2: null, s3: null };
    if (l.duration_sector_1 !== null && (pb.s1 === null || l.duration_sector_1 < pb.s1)) pb.s1 = l.duration_sector_1;
    if (l.duration_sector_2 !== null && (pb.s2 === null || l.duration_sector_2 < pb.s2)) pb.s2 = l.duration_sector_2;
    if (l.duration_sector_3 !== null && (pb.s3 === null || l.duration_sector_3 < pb.s3)) pb.s3 = l.duration_sector_3;
    personalBestSectors.set(dn, pb);

    // Track latest sector times and segments (last lap in array)
    latestSectors.set(dn, [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3]);
    latestSegments.set(dn, [
      l.segments_sector_1 ?? [],
      l.segments_sector_2 ?? [],
      l.segments_sector_3 ?? [],
    ]);

    if (l.lap_duration === null || l.lap_duration <= 0) continue;
    lastLap.set(dn, l.lap_duration);
    const current = bestLap.get(dn);
    if (!current || l.lap_duration < current) {
      bestLap.set(dn, l.lap_duration);
    }
  }

  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) driverLookup.set(d.driver_number, d);

  const entries: TimingEntry[] = [];
  for (const [driverNum, pos] of latestPos) {
    const driver = driverLookup.get(driverNum);
    if (!driver) continue;
    const intv = latestInterval.get(driverNum);
    entries.push({
      position: pos,
      driverNumber: driverNum,
      acronym: driver.name_acronym,
      teamColour: driver.team_colour,
      interval: intv?.interval ?? null,
      gapToLeader: intv?.gap ?? null,
      lastLap: lastLap.get(driverNum) ?? null,
      bestLap: bestLap.get(driverNum) ?? null,
      compound: currentCompound.get(driverNum) ?? null,
      pitCount: pitCounts.get(driverNum) ?? 0,
      sectorTimes: latestSectors.get(driverNum) ?? [null, null, null],
      segments: latestSegments.get(driverNum) ?? [[], [], []],
      personalBestSectors: personalBestSectors.get(driverNum) ?? { s1: null, s2: null, s3: null },
    });
  }

  return entries.sort((a, b) => a.position - b.position);
}

function MiniSectors({ segments }: { segments: (number | null)[][] }) {
  const allSegments = segments.flat();
  if (allSegments.length === 0 || allSegments.every((s) => s === null)) return null;

  return (
    <div className="flex gap-px">
      {segments.map((sector, si) => (
        <div key={si} className={cn("flex gap-px", si > 0 && "ml-1")}>
          {sector.map((seg, mi) => (
            <div
              key={`${si}-${mi}`}
              className="h-3 w-1.5 rounded-[1px]"
              style={{ backgroundColor: getSegmentColor(seg) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TimingBoard({ entries }: { entries: TimingEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-f1-border bg-f1-surface p-8 text-center text-f1-text-muted">
        No timing data available
      </div>
    );
  }

  // Find overall best lap and sector times
  const overallBest = Math.min(
    ...entries.filter((e) => e.bestLap !== null).map((e) => e.bestLap!)
  );
  const overallBestSectors: SectorBests = { s1: null, s2: null, s3: null };
  for (const e of entries) {
    const pb = e.personalBestSectors;
    if (pb.s1 !== null && (overallBestSectors.s1 === null || pb.s1 < overallBestSectors.s1)) overallBestSectors.s1 = pb.s1;
    if (pb.s2 !== null && (overallBestSectors.s2 === null || pb.s2 < overallBestSectors.s2)) overallBestSectors.s2 = pb.s2;
    if (pb.s3 !== null && (overallBestSectors.s3 === null || pb.s3 < overallBestSectors.s3)) overallBestSectors.s3 = pb.s3;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-f1-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-f1-border bg-f1-surface text-xs font-semibold uppercase text-f1-text-muted">
            <th className="px-2 py-2.5 text-center w-10">Pos</th>
            <th className="px-2 py-2.5 text-left">Driver</th>
            <th className="px-2 py-2.5 text-right">Int</th>
            <th className="px-2 py-2.5 text-right">Gap</th>
            <th className="px-2 py-2.5 text-right">S1</th>
            <th className="px-2 py-2.5 text-right">S2</th>
            <th className="px-2 py-2.5 text-right">S3</th>
            <th className="px-2 py-2.5 text-center">Mini Sectors</th>
            <th className="px-2 py-2.5 text-right">Last</th>
            <th className="px-2 py-2.5 text-right">Best</th>
            <th className="px-2 py-2.5 text-center">Tire</th>
            <th className="px-2 py-2.5 text-center">Pit</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const [s1, s2, s3] = entry.sectorTimes;
            const pb = entry.personalBestSectors;
            const ob = overallBestSectors;

            return (
              <tr
                key={entry.driverNumber}
                className="border-b border-f1-border/50 transition-colors hover:bg-f1-card/50"
              >
                <td className="px-2 py-2 text-center font-bold">
                  {entry.position}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-1 rounded-full"
                      style={{ backgroundColor: getTeamColor(entry.teamColour) }}
                    />
                    <span className="font-bold">{entry.acronym}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-f1-text-secondary">
                  {entry.position === 1
                    ? "—"
                    : entry.interval !== null
                      ? typeof entry.interval === "number"
                        ? `+${entry.interval.toFixed(3)}`
                        : `${entry.interval}`
                      : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono text-f1-text-secondary">
                  {entry.position === 1
                    ? "LEADER"
                    : entry.gapToLeader !== null
                      ? typeof entry.gapToLeader === "number"
                        ? `+${entry.gapToLeader.toFixed(3)}`
                        : `${entry.gapToLeader}`
                      : "—"}
                </td>
                <td className={cn("px-2 py-2 text-right font-mono text-xs", getSectorColor(s1, pb.s1, ob.s1))}>
                  {s1 !== null ? s1.toFixed(3) : "—"}
                </td>
                <td className={cn("px-2 py-2 text-right font-mono text-xs", getSectorColor(s2, pb.s2, ob.s2))}>
                  {s2 !== null ? s2.toFixed(3) : "—"}
                </td>
                <td className={cn("px-2 py-2 text-right font-mono text-xs", getSectorColor(s3, pb.s3, ob.s3))}>
                  {s3 !== null ? s3.toFixed(3) : "—"}
                </td>
                <td className="px-2 py-2">
                  <MiniSectors segments={entry.segments} />
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatLapTime(entry.lastLap)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right font-mono",
                    entry.bestLap === overallBest && "text-purple-400 font-bold"
                  )}
                >
                  {formatLapTime(entry.bestLap)}
                </td>
                <td className="px-2 py-2 text-center">
                  {entry.compound && (
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
                      style={{
                        color: TIRE_COLORS[entry.compound as keyof typeof TIRE_COLORS] ?? "#888",
                        backgroundColor: `${TIRE_COLORS[entry.compound as keyof typeof TIRE_COLORS] ?? "#888"}20`,
                      }}
                    >
                      {entry.compound.charAt(0)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-f1-text-muted">
                  {entry.pitCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
