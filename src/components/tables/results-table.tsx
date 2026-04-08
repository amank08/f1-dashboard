"use client";

import type { Driver, LapData, Position, Interval, Stint, RaceControlMessage } from "@/lib/openf1/types";
import { formatLapTime } from "@/lib/utils/formatters";
import { getTeamColor, getTeamLogoUrl, getTeamLogoStyle } from "@/lib/utils/colors";
import { TyreIcon } from "@/components/ui/tyre-icon";
import { KNOWN_EARLY_STARTERS } from "@/lib/utils/constants";
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
  sessionType?: string,
  raceControl?: RaceControlMessage[],
  sessionKey?: number
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

  // Drivers with no position data at all (DNS for qualifying/practice) —
  // add them at the end so they appear on the timing board.
  let nextPos = finalPositions.size + 1;
  for (const d of drivers) {
    if (!finalPositions.has(d.driver_number)) {
      finalPositions.set(d.driver_number, nextPos++);
    }
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

  // Calculate fastest lap per driver + its sector times + lap number
  const fastestLaps = new Map<number, number>();
  const fastestLapSectors = new Map<number, [number | null, number | null, number | null]>();
  const fastestLapNumbers = new Map<number, number>();
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
        fastestLapNumbers.set(lap.driver_number, lap.lap_number);
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

  // Max lap per driver (only count laps with actual timing data;
  // OpenF1 creates phantom post-race entries with null durations)
  const maxLaps = new Map<number, number>();
  for (const lap of laps) {
    if (
      !lap.lap_duration &&
      !lap.duration_sector_1 &&
      !lap.duration_sector_2 &&
      !lap.duration_sector_3 &&
      lap.i1_speed == null &&
      lap.i2_speed == null &&
      lap.st_speed == null
    ) continue;
    const cur = maxLaps.get(lap.driver_number) ?? 0;
    if (lap.lap_number > cur) maxLaps.set(lap.driver_number, lap.lap_number);
  }

  // Actual race distance from stint data (max lap_end). More reliable than lap
  // entries because phantom laps are inconsistent — some races have phantoms matching
  // race distance (AUS 2026 lap 58), others have bogus post-race entries beyond it
  // (SIN 2023 lap 63 in a 62-lap race). Used for display only.
  const totalRaceLaps = stints
    ? Math.max(...stints.filter((s) => s.lap_end != null).map((s) => s.lap_end!), 0)
    : 0;

  // DNF/DNS detection — use maxLaps (timed) for internally consistent classification.
  // All lead-lap finishers share the same maxLaps value, so comparisons are safe.
  const leaderLaps = Math.max(...maxLaps.values(), 0);
  const dnfThreshold = Math.floor(leaderLaps * 0.9);
  // DNS detection: drivers with no timed racing data (lap duration, sector times, or speed traps).
  // Speed traps (i1/i2/st) only activate once the race starts, so DNS drivers won't have them.
  // Stints alone are NOT sufficient — formation lap crashers (e.g. Hadjar AUS 2025) get a
  // stint entry but never took the race start. Require at least one counted lap (maxLaps >= 1)
  // to also count stint data as proof of starting.
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
  // Drivers with stint data AND at least one counted lap started the race —
  // covers drivers who crash before the first speed trap (e.g. Doohan AUS 2025).
  // If a driver has NO lap entries at all but has a stint with actual lap numbers,
  // they started but crashed before any lap was recorded (e.g. Doohan MIA 2025).
  // Drivers WITH lap entries but no timing data are handled by the segments check
  // below (avoids false positives for grid stalls like Hulkenberg AUS 2026).
  if (stints) {
    for (const s of stints) {
      // Only mark as started if the driver has at least one counted lap.
      // Drivers with stint-only and NO lap data default to DNS — OpenF1 sometimes
      // creates erroneous lap_start:1 stints for DNS drivers (e.g. CHN 2026).
      // Genuine early-crash starters with no lap data are handled via
      // KNOWN_EARLY_STARTERS below.
      if (maxLaps.has(s.driver_number)) {
        hasRacingData.add(s.driver_number);
      }
    }
  }
  // Formation lap completion check: if a driver completed ALL mini-sectors on the
  // track (not pit lane) on any lap, they were on the grid for the race start.
  // Segment value 2064 = pit lane; drivers who pit at end of formation lap are DNS
  // (e.g. Sainz AUT 2025). DNS drivers who crash during formation lap have zeros
  // (e.g. Hadjar AUS 2025). This catches drivers who started but crashed before
  // any timing data was recorded (e.g. Gasly SAU 2025 — crashed T5 on lap 1).
  for (const lap of laps) {
    if (hasRacingData.has(lap.driver_number)) continue;
    const segs = [
      ...(lap.segments_sector_1 ?? []),
      ...(lap.segments_sector_2 ?? []),
      ...(lap.segments_sector_3 ?? []),
    ];
    if (segs.length > 0 && segs.every((s) => s > 0 && s !== 2064)) {
      hasRacingData.add(lap.driver_number);
    }
  }

  // Apply known early-starter overrides — drivers who genuinely started but
  // have zero lap entries in OpenF1 (crashed before any timing was recorded).
  if (sessionKey) {
    const starters = KNOWN_EARLY_STARTERS[sessionKey];
    if (starters) {
      for (const dn of starters) hasRacingData.add(dn);
    }
  }

  // Parse unserved time penalties so we can detect live penalty jumps in the gap data.
  // OpenF1 applies penalties live to gap_to_leader (e.g., gap jumps +5s after the flag).
  // We undo these jumps to recover the on-track finishing order.
  const isRace = sessionType === "Race" || sessionType === "Sprint";
  const livePenalties = new Map<number, number>();
  if (isRace && raceControl) {
    const all = new Map<number, number>();
    const served = new Map<number, number>();
    for (const msg of raceControl) {
      const m = msg.message.match(/(\d+) SECOND TIME PENALTY FOR CAR (\d+)/);
      if (!m) continue;
      const secs = parseInt(m[1], 10);
      const car = parseInt(m[2], 10);
      if (msg.message.includes("SERVED")) {
        served.set(car, (served.get(car) ?? 0) + secs);
      } else {
        all.set(car, (all.get(car) ?? 0) + secs);
      }
    }
    for (const [car, total] of all) {
      const s = served.get(car) ?? 0;
      if (total - s > 0) livePenalties.set(car, total - s);
    }
  }

  // Latest interval per driver (sort by date to ensure we get the final value)
  // Prefer non-null values: post-race entries sometimes have null gap_to_leader
  // Skip entries where the gap jumps by a live penalty amount (OpenF1 bakes penalties into gaps)
  const latestInterval = new Map<number, { interval: number | string | null; gap: number | string | null }>();
  if (intervals) {
    const sorted = [...intervals].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const i of sorted) {
      const prev = latestInterval.get(i.driver_number);
      const gap = i.gap_to_leader ?? prev?.gap ?? null;

      // Detect live penalty application: gap suddenly increases by ~penalty amount
      const penalty = livePenalties.get(i.driver_number);
      if (penalty && typeof gap === "number" && typeof prev?.gap === "number") {
        const jump = gap - (prev.gap as number);
        if (Math.abs(jump - penalty) < 0.5) {
          // Skip — this is the timing system applying the penalty to the gap
          continue;
        }
      }

      latestInterval.set(i.driver_number, {
        interval: i.interval ?? prev?.interval ?? null,
        gap,
      });
    }
  }

  // Current compound and pit count per driver
  // Ghost stints are same compound with tyre_age > 0, or preceded by a ≤2 lap stint.
  const currentCompound = new Map<number, string>();
  const fastestLapCompound = new Map<number, string>();
  const pitCounts = new Map<number, number>();
  if (stints) {
    const stintsByDriver = new Map<number, Stint[]>();
    for (const s of stints) {
      if (s.compound) currentCompound.set(s.driver_number, s.compound);
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
        const prevDuration = (prev.lap_end ?? 0) - (prev.lap_start ?? 0) + 1;
        const isGhost = sameCompound && (curr.tyre_age_at_start > 0 || prevDuration <= 2);
        if (!isGhost) realStops++;
      }
      pitCounts.set(dn, realStops);
    }

    // For non-race sessions, find the compound used on the fastest lap
    if (isNonRace) {
      for (const [driverNum, lapNum] of fastestLapNumbers) {
        const driverStints = stintsByDriver.get(driverNum);
        if (!driverStints) continue;
        const stint = driverStints.find(
          (s) =>
            s.lap_start != null &&
            s.lap_end != null &&
            lapNum >= s.lap_start &&
            lapNum <= s.lap_end
        );
        if (stint?.compound) fastestLapCompound.set(driverNum, stint.compound);
      }
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
      row.compound = (isNonRace ? fastestLapCompound.get(driverNum) : currentCompound.get(driverNum)) ?? null;
      row.pitCount = pitCounts.get(driverNum) ?? null;
      row.bestS1 = bestS1.get(driverNum) ?? null;
      row.bestS2 = bestS2.get(driverNum) ?? null;
      row.bestS3 = bestS3.get(driverNum) ?? null;
      const driverLaps = maxLaps.get(driverNum) ?? 0;
      if (isRace && leaderLaps > 0) {
        if (!hasRacingData.has(driverNum)) {
          row.status = "DNS";
        } else if (driverLaps < dnfThreshold) {
          row.status = "DNF";
        } else if (driverLaps < leaderLaps) {
          row.status = "Lapped";
        } else {
          row.status = "Finished";
        }
      }
      // Display: finishers show totalRaceLaps (actual race distance from stints),
      // others show their timed max lap. Fixes races where the leader's final lap
      // has no timing data (e.g. AUS 2026: 57 timed laps but race was 58).
      row.lapsCompleted = row.status === "Finished" && totalRaceLaps > 0
        ? totalRaceLaps
        : driverLaps || null;
      const flSectors = fastestLapSectors.get(driverNum);
      if (flSectors) {
        row.fastestLapS1 = flSectors[0];
        row.fastestLapS2 = flSectors[1];
        row.fastestLapS3 = flSectors[2];
      }
    }

    results.push(row);
  }

  // For race sessions with corrected gaps, re-sort classified drivers by gap
  // (position data may still reflect the live penalty order)
  const statusOrder = (s?: string) => s === "DNS" ? 2 : s === "DNF" ? 1 : 0;
  if (isRace && livePenalties.size > 0) {
    const classified = results.filter(r => r.status === "Finished" || r.status === "Lapped");
    // Sort by gap: numeric gaps first (ascending), then lapped drivers by
    // laps completed (descending) then position (ascending) as tiebreaker.
    function gapSortKey(r: ResultRow): number {
      if (typeof r.gapToLeader === "number") return r.gapToLeader;
      if (r.gapToLeader == null) return -1; // leader
      // String gaps like "+1 LAP", "+2 LAPS" — parse lap count
      const m = r.gapToLeader.match(/\+(\d+)\s+LAP/);
      if (m) return 1e6 + parseInt(m[1], 10) * 1e3 + r.position;
      return Infinity;
    }
    classified.sort((a, b) => gapSortKey(a) - gapSortKey(b));
    // Recalculate intervals from sorted gaps
    if (classified.length > 0) {
      classified[0].gapToLeader = null;
      classified[0].interval = null;
      for (let i = 1; i < classified.length; i++) {
        const prevGap = typeof classified[i - 1].gapToLeader === "number" ? (classified[i - 1].gapToLeader as number) : 0;
        const curGap = typeof classified[i].gapToLeader === "number" ? (classified[i].gapToLeader as number) : 0;
        classified[i].interval = +(curGap - prevGap).toFixed(3);
      }
    }
    const dnf = results.filter(r => r.status === "DNF").sort((a, b) => a.position - b.position);
    const dns = results.filter(r => r.status === "DNS").sort((a, b) => a.position - b.position);
    results.length = 0;
    results.push(...classified, ...dnf, ...dns);
  } else {
    results.sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.position - b.position);
  }

  // Renumber positions and recalculate positionsGained
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
        <span className="ml-2 text-f1-text-secondary text-xs hidden sm:inline">
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
    /** Best lap time per driver per segment (Q1=0, Q2=1, Q3=2) */
    segBests: Map<number, number>[];
    segCount: number;
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
              <th className="px-3 py-3 text-right hidden sm:table-cell">S1</th>
              <th className="px-3 py-3 text-right hidden sm:table-cell">S2</th>
              <th className="px-3 py-3 text-right hidden sm:table-cell">S3</th>
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
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs hidden sm:table-cell", getSectorColor(row.fastestLapS1 ?? null, isFinite(overallBestS1) ? overallBestS1 : null, row.bestS1 ?? null))}>
                  {row.fastestLapS1 != null ? row.fastestLapS1.toFixed(3) : "—"}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs hidden sm:table-cell", getSectorColor(row.fastestLapS2 ?? null, isFinite(overallBestS2) ? overallBestS2 : null, row.bestS2 ?? null))}>
                  {row.fastestLapS2 != null ? row.fastestLapS2.toFixed(3) : "—"}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-mono text-xs hidden sm:table-cell", getSectorColor(row.fastestLapS3 ?? null, isFinite(overallBestS3) ? overallBestS3 : null, row.bestS3 ?? null))}>
                  {row.fastestLapS3 != null ? row.fastestLapS3.toFixed(3) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {row.compound && (
                    <TyreIcon compound={row.compound} size={26} />
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

    const segBests = qualiCutoffs?.segBests ?? [];
    const segCount = qualiCutoffs?.segCount ?? 0;

    // Best time per segment for purple highlighting
    const segFastestTimes: (number | null)[] = [];
    for (let s = 0; s < segCount; s++) {
      const times = [...(segBests[s]?.values() ?? [])];
      segFastestTimes.push(times.length ? Math.min(...times) : null);
    }

    const colCount = 3 + segCount + 1; // POS + DRIVER + GAP + Q1/Q2/Q3 + TIRE
    // Qualifying layout: POS | DRIVER | GAP | Q1 | Q2 | Q3 | TIRE
    // with Q1/Q2 knockout separator rows
    return (
      <div className="overflow-x-auto rounded-lg border border-f1-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border bg-f1-card text-xs font-semibold uppercase text-f1-text-muted">
              <th className="px-3 py-3 text-center w-10">POS</th>
              <th className="px-3 py-3 text-left">DRIVER</th>
              <th className="px-3 py-3 text-right">GAP</th>
              {Array.from({ length: segCount }, (_, i) => {
                const s = segCount - 1 - i;
                return <th key={s} className="px-3 py-3 text-right">Q{s + 1}</th>;
              })}
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
                      Knocked out in Q2{q2CutoffTime != null && <span className="ml-2 font-mono">{formatLapTime(q2CutoffTime)}</span>}
                    </td>
                  </tr>
                );
              }
              if (qualiCutoffs?.q1KnockoutPos != null && row.position === qualiCutoffs.q1KnockoutPos && idx > 0) {
                elements.push(
                  <tr key="q1-sep" className="bg-f1-card/60">
                    <td colSpan={colCount} className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-f1-text-muted">
                      Knocked out in Q1{q1CutoffTime != null && <span className="ml-2 font-mono">{formatLapTime(q1CutoffTime)}</span>}
                    </td>
                  </tr>
                );
              }
              const dNum = row.driver.driver_number;
              const lastSeg = qualiCutoffs?.driverLastSeg?.get(dNum) ?? -1;
              elements.push(
                <tr
                  key={dNum}
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
                  {Array.from({ length: segCount }, (_, i) => {
                    const s = segCount - 1 - i;
                    const time = segBests[s]?.get(dNum) ?? null;
                    const fastest = segFastestTimes[s];
                    const participated = lastSeg >= s;
                    if (!participated) {
                      return <td key={s} className="px-3 py-2.5 text-right font-mono text-xs text-f1-text-muted">—</td>;
                    }
                    if (time == null) {
                      return <td key={s} className="px-3 py-2.5 text-right font-mono text-xs text-f1-text-muted">NO TIME</td>;
                    }
                    return (
                      <td
                        key={s}
                        className={cn(
                          "px-3 py-2.5 text-right font-mono text-xs",
                          fastest != null && time === fastest && "text-purple-400 font-bold"
                        )}
                      >
                        {formatLapTime(time)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    {row.compound && (
                      <TyreIcon compound={row.compound} size={26} />
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
            <th className="px-3 py-3 text-center hidden sm:table-cell">GRID</th>
            <th className="px-3 py-3 text-center hidden sm:table-cell">+/-</th>
            <th className="px-3 py-3 text-center hidden sm:table-cell">LAPS</th>
            <th className="px-3 py-3 text-right">FASTEST LAP</th>
            <th className="px-3 py-3 text-center">TIRE</th>
            <th className="px-3 py-3 text-center hidden sm:table-cell">PITS</th>
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
                <td className="px-3 py-2.5 text-center font-mono text-f1-text-secondary hidden sm:table-cell">
                  {row.gridPosition ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-center hidden sm:table-cell">
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
                <td className="px-3 py-2.5 text-center font-mono text-f1-text-secondary hidden sm:table-cell">
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
                    <TyreIcon compound={row.compound} size={26} />
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-f1-text-muted hidden sm:table-cell">
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
