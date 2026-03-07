"use client";

import type { Driver, LapData, Position, Interval, Stint } from "@/lib/openf1/types";
import { formatLapTime } from "@/lib/utils/formatters";
import { getTeamColor, TIRE_COLORS, getTeamLogoUrl, getTeamLogoStyle } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

interface ResultRow {
  position: number;
  driver: Driver;
  fastestLap: number | null;
  totalTime: number | null;
  // Enriched fields (optional)
  interval?: number | string | null;
  gapToLeader?: number | string | null;
  gridPosition?: number | null;
  positionsGained?: number | null;
  lapsCompleted?: number | null;
  compound?: string | null;
  pitCount?: number | null;
  // Sector times from the fastest lap
  fastestLapS1?: number | null;
  fastestLapS2?: number | null;
  fastestLapS3?: number | null;
  // Personal best sector times (across all laps)
  bestS1?: number | null;
  bestS2?: number | null;
  bestS3?: number | null;
  // DNF/DNS detection
  status?: "Finished" | "Lapped" | "DNF" | "DNS";
}

export function buildResults(
  positions: Position[],
  drivers: Driver[],
  laps: LapData[],
  intervals?: Interval[],
  stints?: Stint[],
  sessionType?: string
): ResultRow[] {
  // Get final position for each driver
  const finalPositions = new Map<number, number>();
  const gridPositions = new Map<number, number>();

  if (intervals || stints) {
    // When enriched: earliest position = grid, latest = finish
    const sorted = [...positions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const p of sorted) {
      if (!gridPositions.has(p.driver_number)) {
        gridPositions.set(p.driver_number, p.position);
      }
      finalPositions.set(p.driver_number, p.position);
    }
  } else {
    for (const pos of positions) {
      finalPositions.set(pos.driver_number, pos.position);
    }
  }

  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) {
    driverLookup.set(d.driver_number, d);
  }

  // For non-race sessions, compute a 107% threshold to discard in-laps / out-laps.
  // These have valid sector times but inflated durations from slowing into the pits.
  const isNonRace = sessionType !== "Race" && sessionType !== "Sprint";
  let threshold107 = Infinity;
  if (isNonRace) {
    let globalBest = Infinity;
    for (const lap of laps) {
      if (lap.lap_duration && !lap.is_pit_out_lap && lap.lap_duration < globalBest) {
        globalBest = lap.lap_duration;
      }
    }
    if (isFinite(globalBest)) threshold107 = globalBest * 1.07;
  }

  // Calculate fastest lap per driver + its sector times
  const fastestLaps = new Map<number, number>();
  const fastestLapSectors = new Map<number, [number | null, number | null, number | null]>();
  for (const lap of laps) {
    if (lap.lap_duration && !lap.is_pit_out_lap && lap.lap_duration <= threshold107) {
      const current = fastestLaps.get(lap.driver_number);
      if (!current || lap.lap_duration < current) {
        fastestLaps.set(lap.driver_number, lap.lap_duration);
        fastestLapSectors.set(lap.driver_number, [
          lap.duration_sector_1 ?? null,
          lap.duration_sector_2 ?? null,
          lap.duration_sector_3 ?? null,
        ]);
      }
    }
  }

  // Best sector times per driver (same filters as fastest lap)
  const bestS1 = new Map<number, number>();
  const bestS2 = new Map<number, number>();
  const bestS3 = new Map<number, number>();
  for (const lap of laps) {
    if (isNonRace && lap.lap_duration && lap.lap_duration > threshold107) continue;
    if (lap.is_pit_out_lap) continue;
    const dn = lap.driver_number;
    if (lap.duration_sector_1 !== null && lap.duration_sector_1 !== undefined) {
      const cur = bestS1.get(dn);
      if (!cur || lap.duration_sector_1 < cur) bestS1.set(dn, lap.duration_sector_1);
    }
    if (lap.duration_sector_2 !== null && lap.duration_sector_2 !== undefined) {
      const cur = bestS2.get(dn);
      if (!cur || lap.duration_sector_2 < cur) bestS2.set(dn, lap.duration_sector_2);
    }
    if (lap.duration_sector_3 !== null && lap.duration_sector_3 !== undefined) {
      const cur = bestS3.get(dn);
      if (!cur || lap.duration_sector_3 < cur) bestS3.set(dn, lap.duration_sector_3);
    }
  }

  // Max lap per driver
  const maxLaps = new Map<number, number>();
  for (const lap of laps) {
    const cur = maxLaps.get(lap.driver_number) ?? 0;
    if (lap.lap_number > cur) maxLaps.set(lap.driver_number, lap.lap_number);
  }

  // DNF/DNS detection
  const leaderLaps = Math.max(...maxLaps.values(), 0);
  const dnfThreshold = Math.floor(leaderLaps * 0.9);
  // DNS detection: drivers with no timed racing data (lap duration, sector times, or speed traps).
  // Mini-sector segments are excluded — they record during formation laps too.
  // Speed traps (i1/i2/st) only activate once the race starts, so DNS drivers won't have them.
  const hasRacingData = new Set<number>();
  for (const lap of laps) {
    if (
      lap.lap_duration ||
      lap.duration_sector_1 != null ||
      lap.duration_sector_2 != null ||
      lap.duration_sector_3 != null ||
      lap.i1_speed != null ||
      lap.i2_speed != null ||
      lap.st_speed != null
    ) {
      hasRacingData.add(lap.driver_number);
    }
  }

  // Latest interval per driver (sort by date to ensure we get the final value)
  // Prefer non-null values: post-race entries sometimes have null gap_to_leader
  const latestInterval = new Map<number, { interval: number | string | null; gap: number | string | null }>();
  if (intervals) {
    const sorted = [...intervals].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const i of sorted) {
      const prev = latestInterval.get(i.driver_number);
      latestInterval.set(i.driver_number, {
        interval: i.interval ?? prev?.interval ?? null,
        gap: i.gap_to_leader ?? prev?.gap ?? null,
      });
    }
  }

  // Current compound and pit count per driver
  // Ghost stints are same compound with tyre_age > 0, or preceded by a ≤2 lap stint.
  const currentCompound = new Map<number, string>();
  const pitCounts = new Map<number, number>();
  if (stints) {
    const stintsByDriver = new Map<number, Stint[]>();
    for (const s of stints) {
      currentCompound.set(s.driver_number, s.compound);
      if (!stintsByDriver.has(s.driver_number)) stintsByDriver.set(s.driver_number, []);
      stintsByDriver.get(s.driver_number)!.push(s);
    }
    for (const [dn, driverStints] of stintsByDriver) {
      driverStints.sort((a, b) => a.stint_number - b.stint_number);
      let realStops = 0;
      for (let i = 1; i < driverStints.length; i++) {
        const prev = driverStints[i - 1];
        const curr = driverStints[i];
        const sameCompound = curr.compound === prev.compound;
        const prevDuration = prev.lap_end - prev.lap_start + 1;
        const isGhost = sameCompound && (curr.tyre_age_at_start > 0 || prevDuration <= 2);
        if (!isGhost) realStops++;
      }
      pitCounts.set(dn, realStops);
    }
  }

  const enriched = !!(intervals || stints);

  const results: ResultRow[] = [];
  for (const [driverNum, position] of finalPositions) {
    const driver = driverLookup.get(driverNum);
    if (!driver) continue;

    const row: ResultRow = {
      position,
      driver,
      fastestLap: fastestLaps.get(driverNum) ?? null,
      totalTime: null,
    };

    if (enriched) {
      const intv = latestInterval.get(driverNum);
      const gridPos = gridPositions.get(driverNum) ?? null;
      row.interval = intv?.interval ?? null;
      row.gapToLeader = intv?.gap ?? null;
      // For non-race sessions, compute gap from fastest lap times
      if (row.gapToLeader == null && row.fastestLap != null) {
        const leaderFastest = Math.min(
          ...Array.from(fastestLaps.values())
        );
        if (isFinite(leaderFastest) && row.fastestLap > leaderFastest) {
          row.gapToLeader = +(row.fastestLap - leaderFastest).toFixed(3);
        }
      }
      row.gridPosition = gridPos;
      row.positionsGained = gridPos !== null ? gridPos - position : null;
      row.lapsCompleted = maxLaps.get(driverNum) ?? null;
      row.compound = currentCompound.get(driverNum) ?? null;
      row.pitCount = pitCounts.get(driverNum) ?? null;
      row.bestS1 = bestS1.get(driverNum) ?? null;
      row.bestS2 = bestS2.get(driverNum) ?? null;
      row.bestS3 = bestS3.get(driverNum) ?? null;
      const laps = row.lapsCompleted ?? 0;
      const isRace = sessionType === "Race" || sessionType === "Sprint";
      if (isRace && leaderLaps > 0) {
        if (!hasRacingData.has(driverNum)) {
          row.status = "DNS";
        } else if (laps < dnfThreshold) {
          row.status = "DNF";
        } else if (laps < leaderLaps) {
          row.status = "Lapped";
        } else {
          row.status = "Finished";
        }
      }
      const flSectors = fastestLapSectors.get(driverNum);
      if (flSectors) {
        row.fastestLapS1 = flSectors[0];
        row.fastestLapS2 = flSectors[1];
        row.fastestLapS3 = flSectors[2];
      }
    }

    results.push(row);
  }

  // Sort: Finished/Lapped by position, then DNF by position, then DNS by position
  const statusOrder = (s?: string) => s === "DNS" ? 2 : s === "DNF" ? 1 : 0;
  results.sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.position - b.position);
  // Renumber positions and recalculate positionsGained after status-based reordering
  for (let i = 0; i < results.length; i++) {
    results[i].position = i + 1;
    if (results[i].gridPosition != null) {
      results[i].positionsGained = results[i].gridPosition! - results[i].position;
    }
  }
  return results;
}

function formatInterval(value: number | string | null | undefined, isLeader: boolean): string {
  if (isLeader) return "—";
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return `+${value.toFixed(3)}`;
  return `${value}`;
}

function getSectorColor(
  value: number | null,
  bestOverall: number | null,
  personalBest: number | null
): string {
  if (value === null) return "text-f1-text-muted";
  if (bestOverall !== null && value === bestOverall) return "text-purple-400";
  if (personalBest !== null && value <= personalBest) return "text-green-400";
  return "text-yellow-400";
}

function DriverCell({ driver, size = "sm" }: { driver: Driver; size?: "sm" | "md" }) {
  const logoUrl = getTeamLogoUrl(driver.team_name);
  const circleSize = size === "md" ? "h-7 w-7" : "h-6 w-6";
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn("relative flex items-center justify-center rounded-full", circleSize)}
        style={{ backgroundColor: getTeamColor(driver.team_colour, driver.team_name) }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt={driver.team_name}
            className="h-4 w-4 object-contain"
            style={getTeamLogoStyle(driver.team_name)}
          />
        )}
      </div>
      <div>
        <span className="font-bold">{driver.name_acronym}</span>
        <span className="ml-2 text-f1-text-secondary text-xs">
          {driver.first_name} {driver.last_name}
        </span>
      </div>
    </div>
  );
}

function PositionCell({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "font-bold",
        position === 1 && "text-yellow-400",
        position === 2 && "text-gray-300",
        position === 3 && "text-amber-600"
      )}
    >
      {position}
    </span>
  );
}

export function ResultsTable({
  results,
  sessionType,
  qualiCutoffs,
}: {
  results: ResultRow[];
  sessionType?: string;
  qualiCutoffs?: {
    q1CutoffTime: number | null;
    q2CutoffTime: number | null;
    segmentTimes: Map<number, number>;
    /** Maps driver_number → last segment index they participated in */
    driverLastSeg: Map<number, number>;
    q2KnockoutPos: number | null;
    q1KnockoutPos: number | null;
  };
}) {
  const overallFastest = Math.min(
    ...results.filter((r) => r.fastestLap).map((r) => r.fastestLap!)
  );

  const hasEnrichedData = results.some(
    (r) => r.interval !== undefined || r.compound !== undefined
  );

  const isPractice = sessionType === "Practice";
  const isQualifying = sessionType === "Qualifying" || sessionType === "Sprint Qualifying" || sessionType === "Sprint Shootout";

  // Overall best sectors for coloring
  const overallBestS1 = Math.min(...results.filter((r) => r.bestS1).map((r) => r.bestS1!));
  const overallBestS2 = Math.min(...results.filter((r) => r.bestS2).map((r) => r.bestS2!));
  const overallBestS3 = Math.min(...results.filter((r) => r.bestS3).map((r) => r.bestS3!));

  if (!hasEnrichedData) {
    // Original 4-column layout
    return (
      <div className="overflow-x-auto rounded-lg border border-f1-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border bg-f1-card text-f1-text-muted">
              <th className="px-4 py-3 text-left font-semibold">POS</th>
              <th className="px-4 py-3 text-left font-semibold">DRIVER</th>
              <th className="px-4 py-3 text-left font-semibold">TEAM</th>
              <th className="px-4 py-3 text-right font-semibold">FASTEST LAP</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.driver.driver_number}
                className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
              >
                <td className="px-4 py-3">
                  <PositionCell position={row.position} />
                </td>
                <td className="px-4 py-3">
                  <DriverCell driver={row.driver} size="md" />
                </td>
                <td className="px-4 py-3 text-f1-text-secondary">
                  {row.driver.team_name}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.fastestLap === overallFastest && "text-purple-400"
                    )}
                  >
                    {formatLapTime(row.fastestLap)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isPractice) {
    // Practice layout: POS | DRIVER | GAP | LAPS | FASTEST LAP | S1 | S2 | S3 | TIRE
    return (
      <div className="overflow-x-auto rounded-lg border border-f1-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border bg-f1-card text-xs font-semibold uppercase text-f1-text-muted">
              <th className="px-3 py-3 text-center w-10">POS</th>
              <th className="px-3 py-3 text-left">DRIVER</th>
              <th className="px-3 py-3 text-right">GAP</th>
              <th className="px-3 py-3 text-center">LAPS</th>
              <th className="px-3 py-3 text-right">FASTEST LAP</th>
              <th className="px-3 py-3 text-right">S1</th>
              <th className="px-3 py-3 text-right">S2</th>
              <th className="px-3 py-3 text-right">S3</th>
              <th className="px-3 py-3 text-center">TIRE</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.driver.driver_number}
                className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
              >
                <td className="px-3 py-2.5 text-center">
                  <PositionCell position={row.position} />
                </td>
                <td className="px-3 py-2.5">
                  <DriverCell driver={row.driver} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-f1-text-secondary">
                  {row.position === 1
                    ? "LEADER"
                    : formatInterval(row.gapToLeader, false)}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-f1-text-secondary">
                  {row.lapsCompleted ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.fastestLap === overallFastest && "text-purple-400 font-bold"
                    )}
                  >
                    {formatLapTime(row.fastestLap)}
                  </span>
                </td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs", getSectorColor(row.fastestLapS1 ?? null, isFinite(overallBestS1) ? overallBestS1 : null, row.bestS1 ?? null))}>
                  {row.fastestLapS1 != null ? row.fastestLapS1.toFixed(3) : "—"}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs", getSectorColor(row.fastestLapS2 ?? null, isFinite(overallBestS2) ? overallBestS2 : null, row.bestS2 ?? null))}>
                  {row.fastestLapS2 != null ? row.fastestLapS2.toFixed(3) : "—"}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs", getSectorColor(row.fastestLapS3 ?? null, isFinite(overallBestS3) ? overallBestS3 : null, row.bestS3 ?? null))}>
                  {row.fastestLapS3 != null ? row.fastestLapS3.toFixed(3) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {row.compound && (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        color:
                          TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888",
                        backgroundColor: `${TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888"}20`,
                      }}
                    >
                      {row.compound.charAt(0)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isQualifying) {
    // Compute segment reference times for gaps using dynamic knockout positions
    const segTimes = qualiCutoffs?.segmentTimes;
    const q2KO = qualiCutoffs?.q2KnockoutPos ?? Infinity;
    const q1KO = qualiCutoffs?.q1KnockoutPos ?? Infinity;
    const poleTime = segTimes?.get(results.find((r) => r.position === 1)?.driver.driver_number ?? -1) ?? null;
    const q2CutoffTime = qualiCutoffs?.q2CutoffTime ?? null;
    const q1CutoffTime = qualiCutoffs?.q1CutoffTime ?? null;

    function getQualiLapTime(row: ResultRow): number | null {
      const t = segTimes?.get(row.driver.driver_number);
      if (t != null) return t;
      // If driver participated in a segment but has no valid time (e.g. deleted),
      // return null ("NO TIME") instead of falling back to an earlier segment's time.
      const driverLastSeg = qualiCutoffs?.driverLastSeg;
      if (driverLastSeg?.has(row.driver.driver_number)) return null;
      return row.fastestLap;
    }

    function getQualiGap(row: ResultRow): string {
      if (row.position === 1) return "POLE";
      const lapTime = getQualiLapTime(row);
      if (lapTime == null) return "—";

      let refTime: number | null;
      if (row.position < q2KO) {
        // Q3 participants — gap to pole
        refTime = poleTime;
      } else if (row.position < q1KO) {
        // Q2 knockouts — gap to Q2 cutoff
        refTime = q2CutoffTime;
      } else {
        // Q1 knockouts — gap to Q1 cutoff
        refTime = q1CutoffTime;
      }

      if (refTime == null) return "—";
      const delta = lapTime - refTime;
      return `+${delta.toFixed(3)}`;
    }

    // Fastest segment time for purple highlighting
    const segFastest = segTimes
      ? Math.min(...results.map((r) => segTimes.get(r.driver.driver_number) ?? Infinity))
      : overallFastest;

    const colCount = 8;
    // Qualifying layout: POS | DRIVER | GAP | FASTEST LAP | S1 | S2 | S3 | TIRE
    // with Q1/Q2 knockout separator rows
    return (
      <div className="overflow-x-auto rounded-lg border border-f1-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border bg-f1-card text-xs font-semibold uppercase text-f1-text-muted">
              <th className="px-3 py-3 text-center w-10">POS</th>
              <th className="px-3 py-3 text-left">DRIVER</th>
              <th className="px-3 py-3 text-right">GAP</th>
              <th className="px-3 py-3 text-right">FASTEST LAP</th>
              <th className="px-3 py-3 text-right">S1</th>
              <th className="px-3 py-3 text-right">S2</th>
              <th className="px-3 py-3 text-right">S3</th>
              <th className="px-3 py-3 text-center">TIRE</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => {
              const elements: React.ReactNode[] = [];
              // Insert knockout separator at dynamic positions
              if (qualiCutoffs?.q2KnockoutPos != null && row.position === qualiCutoffs.q2KnockoutPos && idx > 0) {
                elements.push(
                  <tr key="q2-sep" className="bg-f1-card/60">
                    <td colSpan={colCount} className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-f1-text-muted">
                      Knocked out in Q2
                    </td>
                  </tr>
                );
              }
              if (qualiCutoffs?.q1KnockoutPos != null && row.position === qualiCutoffs.q1KnockoutPos && idx > 0) {
                elements.push(
                  <tr key="q1-sep" className="bg-f1-card/60">
                    <td colSpan={colCount} className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-f1-text-muted">
                      Knocked out in Q1
                    </td>
                  </tr>
                );
              }
              elements.push(
                <tr
                  key={row.driver.driver_number}
                  className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
                >
                  <td className="px-3 py-2.5 text-center">
                    <PositionCell position={row.position} />
                  </td>
                  <td className="px-3 py-2.5">
                    <DriverCell driver={row.driver} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-f1-text-secondary">
                    {getQualiGap(row)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(() => {
                      const qualiTime = getQualiLapTime(row);
                      if (qualiTime == null && qualiCutoffs?.driverLastSeg?.has(row.driver.driver_number)) {
                        return <span className="font-mono text-f1-text-muted">NO TIME</span>;
                      }
                      return (
                        <span
                          className={cn(
                            "font-mono",
                            qualiTime === segFastest && "text-purple-400 font-bold"
                          )}
                        >
                          {formatLapTime(qualiTime)}
                        </span>
                      );
                    })()}
                  </td>
                  {(() => {
                    const noTime = getQualiLapTime(row) == null && qualiCutoffs?.driverLastSeg?.has(row.driver.driver_number);
                    return (
                      <>
                        <td className={cn("px-3 py-2.5 text-right font-mono text-xs", !noTime && getSectorColor(row.fastestLapS1 ?? null, isFinite(overallBestS1) ? overallBestS1 : null, row.bestS1 ?? null))}>
                          {noTime ? "—" : row.fastestLapS1 != null ? row.fastestLapS1.toFixed(3) : "—"}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right font-mono text-xs", !noTime && getSectorColor(row.fastestLapS2 ?? null, isFinite(overallBestS2) ? overallBestS2 : null, row.bestS2 ?? null))}>
                          {noTime ? "—" : row.fastestLapS2 != null ? row.fastestLapS2.toFixed(3) : "—"}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right font-mono text-xs", !noTime && getSectorColor(row.fastestLapS3 ?? null, isFinite(overallBestS3) ? overallBestS3 : null, row.bestS3 ?? null))}>
                          {noTime ? "—" : row.fastestLapS3 != null ? row.fastestLapS3.toFixed(3) : "—"}
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-3 py-2.5 text-center">
                    {row.compound && (
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          color:
                            TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888",
                          backgroundColor: `${TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888"}20`,
                        }}
                      >
                        {row.compound.charAt(0)}
                      </span>
                    )}
                  </td>
                </tr>
              );
              return elements;
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Race/Sprint enriched layout: POS | DRIVER | GAP | GRID | +/- | LAPS | FASTEST LAP | TIRE | PITS
  return (
    <div className="overflow-x-auto rounded-lg border border-f1-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-f1-border bg-f1-card text-xs font-semibold uppercase text-f1-text-muted">
            <th className="px-3 py-3 text-center w-10">POS</th>
            <th className="px-3 py-3 text-left">DRIVER</th>
            <th className="px-3 py-3 text-right">GAP</th>
            <th className="px-3 py-3 text-center">GRID</th>
            <th className="px-3 py-3 text-center">+/-</th>
            <th className="px-3 py-3 text-center">LAPS</th>
            <th className="px-3 py-3 text-right">FASTEST LAP</th>
            <th className="px-3 py-3 text-center">TIRE</th>
            <th className="px-3 py-3 text-center">PITS</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => {
            const gained = row.positionsGained ?? 0;
            const isDNF = row.status === "DNF";
            const isDNS = row.status === "DNS";
            const isRetired = isDNF || isDNS;
            return (
              <tr
                key={row.driver.driver_number}
                className={cn(
                  "border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors",
                  isRetired && "opacity-50"
                )}
              >
                <td className="px-3 py-2.5 text-center">
                  <PositionCell position={row.position} />
                </td>
                <td className="px-3 py-2.5">
                  <DriverCell driver={row.driver} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-f1-text-secondary">
                  {isDNS ? (
                    <span className="text-red-400 font-semibold">DNS</span>
                  ) : isDNF ? (
                    <div>
                      <span className="text-red-400 font-semibold">DNF</span>
                      <div className="text-[11px] text-f1-text-muted">Lap {row.lapsCompleted}</div>
                    </div>
                  ) : row.position === 1
                    ? "LEADER"
                    : formatInterval(row.gapToLeader, false)}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-f1-text-secondary">
                  {row.gridPosition ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {gained > 0 ? (
                    <span className="text-green-400 font-semibold">
                      ▲ {gained}
                    </span>
                  ) : gained < 0 ? (
                    <span className="text-red-400 font-semibold">
                      ▼ {Math.abs(gained)}
                    </span>
                  ) : (
                    <span className="text-f1-text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-f1-text-secondary">
                  {isDNS ? 0 : row.lapsCompleted ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.fastestLap === overallFastest && "text-purple-400 font-bold"
                    )}
                  >
                    {formatLapTime(row.fastestLap)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {row.compound && (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        color:
                          TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888",
                        backgroundColor: `${TIRE_COLORS[row.compound as keyof typeof TIRE_COLORS] ?? "#888"}20`,
                      }}
                    >
                      {row.compound.charAt(0)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-f1-text-muted">
                  {row.pitCount ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
