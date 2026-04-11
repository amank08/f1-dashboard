"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Driver, Position, Interval, Stint, LapData } from "@/lib/openf1/types";
import { getTeamColor, getTeamLogoUrl, getTeamLogoStyle } from "@/lib/utils/colors";
import { TyreIcon } from "@/components/ui/tyre-icon";
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
  if (bestOverall !== null && duration === bestOverall) return "text-purple-400";
  if (bestPersonal !== null && duration <= bestPersonal) return "text-green-400";
  return "text-yellow-400";
}

interface SectorBests {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

function getLapSectors(lap: LapData): [number | null, number | null, number | null] {
  return [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3];
}

function getLapSegments(lap: LapData): (number | null)[][] {
  const rawS1 = lap.segments_sector_1 ?? [];
  const s1 = rawS1.length > 0 && rawS1[0] === null ? rawS1.slice(1) : rawS1;
  return [
    s1,
    lap.segments_sector_2 ?? [],
    lap.segments_sector_3 ?? [],
  ];
}

function getLapStartMs(lap: LapData): number {
  return new Date(lap.date_start).getTime();
}

function isLapCompleteByReplay(lap: LapData, replayTimestamp?: number | null): boolean {
  if (lap.lap_duration == null || lap.lap_duration <= 0) return false;
  if (replayTimestamp == null) return true;
  return getLapStartMs(lap) + lap.lap_duration * 1000 <= replayTimestamp;
}

function isSectorCompleteByReplay(
  lap: LapData,
  sectorIndex: 0 | 1 | 2,
  replayTimestamp?: number | null
): boolean {
  const durations = [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3] as const;
  const sectorDuration = durations[sectorIndex];
  if (sectorDuration == null || sectorDuration <= 0) return false;
  if (replayTimestamp == null) return true;

  let cumulative = 0;
  for (let i = 0; i <= sectorIndex; i++) {
    const duration = durations[i];
    if (duration == null || duration <= 0) return false;
    cumulative += duration;
  }

  return getLapStartMs(lap) + cumulative * 1000 <= replayTimestamp;
}

function fillCompletedSectorGaps(
  segments: (number | null)[],
  expectedCount: number
): (number | null)[] {
  const normalized = segments.slice(0, expectedCount);
  if (normalized.length < expectedCount) {
    normalized.push(...Array<null>(expectedCount - normalized.length).fill(null));
  }

  const lastKnownIndex = [...normalized].findLastIndex((value) => value !== null);
  if (lastKnownIndex === -1) return normalized;

  const lastKnown = normalized[lastKnownIndex];
  if (lastKnown == null) return segments;

  return normalized.map((value, index) => (index > lastKnownIndex && value === null ? lastKnown : value));
}

export interface TimingEntry {
  position: number;
  driverNumber: number;
  acronym: string;
  teamColour: string;
  teamName: string;
  interval: number | string | null;
  gapToLeader: number | string | null;
  lastLap: number | null;
  bestLap: number | null;
  compound: string | null;
  pitCount: number;
  sectorTimes: [number | null, number | null, number | null];
  segments: (number | null)[][];
  personalBestSectors: SectorBests;
  currentLap: number;
}

export function buildTimingData(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  stints: Stint[],
  laps: LapData[],
  replayTimestamp?: number | null,
  /** Full unfiltered laps — used to compute a stable mini-sector grid
   *  layout that doesn't shift as the replay progresses. Only needed
   *  when `laps` is a time-filtered subset. */
  allLaps?: LapData[]
): TimingEntry[] {
  // Get latest position per driver
  const latestPos = new Map<number, number>();
  const sortedPositions = [...positions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const p of sortedPositions) {
    latestPos.set(p.driver_number, p.position);
  }

  // Get latest interval per driver
  const latestInterval = new Map<number, { interval: number | string | null; gap: number | string | null }>();
  const sortedIntervals = [...intervals].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const i of sortedIntervals) {
    latestInterval.set(i.driver_number, {
      interval: i.interval,
      gap: i.gap_to_leader,
    });
  }

  // Get current compound per driver (last stint)
  const currentCompound = new Map<number, string>();
  const pitCounts = new Map<number, number>();
  for (const s of stints) {
    if (s.compound) currentCompound.set(s.driver_number, s.compound);
    pitCounts.set(s.driver_number, Math.max((pitCounts.get(s.driver_number) ?? 0), s.stint_number - 1));
  }

  // Get last lap, best lap, latest sectors, segments, and personal best sectors per driver
  const lastLap = new Map<number, number>();
  const bestLap = new Map<number, number>();
  const latestLapNum = new Map<number, number>();
  const latestSectors = new Map<number, [number | null, number | null, number | null]>();
  const prevLapSectors = new Map<number, [number | null, number | null, number | null]>();
  const latestSegments = new Map<number, (number | null)[][]>();
  const personalBestSectors = new Map<number, SectorBests>();
  // Mini-sector count per sector is a fixed property of the circuit.
  // OpenF1 segment arrays vary in length due to pit laps and partial
  // data, so we use the MODE (most common count) across all session
  // laps rather than the max. Computed from all laps (not the time-
  // filtered subset) so the grid layout is stable during replay.
  const sectorCounts: [number, number, number] = [0, 0, 0];
  {
    const freq: [Map<number, number>, Map<number, number>, Map<number, number>] = [new Map(), new Map(), new Map()];
    for (const l of (allLaps ?? laps)) {
      // Strip S1 leading null (OpenF1 detection point) before counting
      const rawS1Len = l.segments_sector_1?.length ?? 0;
      const s1HasLeadingNull = rawS1Len > 0 && l.segments_sector_1?.[0] === null;
      const lens = [
        s1HasLeadingNull ? rawS1Len - 1 : rawS1Len,
        l.segments_sector_2?.length ?? 0,
        l.segments_sector_3?.length ?? 0,
      ];
      for (let si = 0; si < 3; si++) {
        if (lens[si] > 0) freq[si].set(lens[si], (freq[si].get(lens[si]) ?? 0) + 1);
      }
    }
    for (let si = 0; si < 3; si++) {
      let best = 0;
      let bestCount = 0;
      for (const [len, count] of freq[si]) {
        if (count > bestCount) { best = len; bestCount = count; }
      }
      sectorCounts[si] = best;
    }
  }

  // Track latest lap metadata for time-based masking
  const latestLapMeta = new Map<number, { dateStart: string; durations: [number | null, number | null, number | null] }>();

  const lapsByDriver = new Map<number, LapData[]>();
  for (const lap of laps) {
    const driverLaps = lapsByDriver.get(lap.driver_number) ?? [];
    driverLaps.push(lap);
    lapsByDriver.set(lap.driver_number, driverLaps);
  }

  for (const [dn, driverLaps] of lapsByDriver) {
    const sortedLaps = [...driverLaps].sort((a, b) => {
      const lapDiff = a.lap_number - b.lap_number;
      if (lapDiff !== 0) return lapDiff;
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
    });

    const pb: SectorBests = { s1: null, s2: null, s3: null };
    let lastCompletedLap: LapData | null = null;
    let previousCompletedLap: LapData | null = null;

    for (const lap of sortedLaps) {
      latestLapNum.set(dn, Math.max(latestLapNum.get(dn) ?? 0, lap.lap_number));

      if (!lap.is_pit_out_lap) {
        if (isSectorCompleteByReplay(lap, 0, replayTimestamp) && lap.duration_sector_1 !== null && (pb.s1 === null || lap.duration_sector_1 < pb.s1)) pb.s1 = lap.duration_sector_1;
        if (isSectorCompleteByReplay(lap, 1, replayTimestamp) && lap.duration_sector_2 !== null && (pb.s2 === null || lap.duration_sector_2 < pb.s2)) pb.s2 = lap.duration_sector_2;
        if (isSectorCompleteByReplay(lap, 2, replayTimestamp) && lap.duration_sector_3 !== null && (pb.s3 === null || lap.duration_sector_3 < pb.s3)) pb.s3 = lap.duration_sector_3;
      }

      if (lap.is_pit_out_lap || !isLapCompleteByReplay(lap, replayTimestamp)) continue;

      const lapDuration = lap.lap_duration;
      if (lapDuration == null) continue;

      previousCompletedLap = lastCompletedLap;
      lastCompletedLap = lap;
      lastLap.set(dn, lapDuration);

      const currentBest = bestLap.get(dn);
      if (!currentBest || lapDuration < currentBest) {
        bestLap.set(dn, lapDuration);
      }
    }

    personalBestSectors.set(dn, pb);

    const currentDisplayLap = sortedLaps[sortedLaps.length - 1] ?? null;
    if (!currentDisplayLap) continue;

    const carryOverLap =
      currentDisplayLap === lastCompletedLap ? previousCompletedLap : lastCompletedLap;
    if (carryOverLap) {
      prevLapSectors.set(dn, getLapSectors(carryOverLap));
    }

    if (currentDisplayLap.is_pit_out_lap) {
      latestSectors.set(dn, [null, null, null]);
      latestSegments.set(dn, [[], [], []]);
      continue;
    }

    latestSectors.set(dn, getLapSectors(currentDisplayLap));
    latestSegments.set(dn, getLapSegments(currentDisplayLap));
    latestLapMeta.set(dn, {
      dateStart: currentDisplayLap.date_start,
      durations: getLapSectors(currentDisplayLap),
    });
  }

  // Pad/trim segments to the fixed circuit mini-sector count and apply
  // time-based masking for replay.
  for (const [dn, segs] of latestSegments) {
    // Normalize each sector to the fixed count: pad short arrays with
    // null and trim long ones (data noise from pit laps).
    for (let i = 0; i < 3; i++) {
      const expected = sectorCounts[i];
      if (expected === 0) continue;
      if (segs[i].length < expected) {
        segs[i] = [
          ...segs[i],
          ...Array<null>(expected - segs[i].length).fill(null),
        ];
      } else if (segs[i].length > expected) {
        segs[i] = segs[i].slice(0, expected);
      }
    }

    // Time-based masking: during replay, reveal mini-sectors progressively
    if (replayTimestamp != null) {
      const meta = latestLapMeta.get(dn);
      if (meta) {
        const lapStart = new Date(meta.dateStart).getTime();
        const elapsed = (replayTimestamp - lapStart) / 1000; // seconds into the lap

        const [d1, d2] = meta.durations;
        // Cumulative sector boundaries (seconds)
        const s1End = d1 ?? Infinity;
        const s2End = s1End + (d2 ?? Infinity);
        // s3End would be the full lap — anything past s2End is in sector 3

        for (let si = 0; si < 3; si++) {
          const sectorStart = si === 0 ? 0 : si === 1 ? s1End : s2End;
          const sectorDuration = meta.durations[si];
          const sectorLen = sectorCounts[si];
          if (sectorLen === 0) continue;

          if (elapsed <= sectorStart) {
            // Haven't reached this sector yet — all gray
            segs[si] = Array<null>(sectorLen).fill(null);
          } else if (sectorDuration != null && elapsed < sectorStart + sectorDuration) {
            // Partially through this sector — reveal proportionally
            const inSector = elapsed - sectorStart;
            const fraction = inSector / sectorDuration;
            const revealCount = Math.floor(fraction * sectorLen);
            segs[si] = segs[si].map((v, idx) => (idx < revealCount ? v : null));
          }
          // If OpenF1 delivered a short segment array for an already
          // completed sector, preserve the circuit's full mini-sector grid by
          // extending the tail with the last known state instead of leaving a
          // permanently gray final cell.
          else if (sectorDuration != null) {
            segs[si] = fillCompletedSectorGaps(segs[si], sectorLen);
          }
        }
      }
    }
  }

  // Time-based masking for sector duration columns (S1/S2/S3)
  // F1-style: each sector time persists until a new one replaces it.
  // When a driver starts a new lap and is in S1, S2/S3 from the previous
  // lap remain visible. S1 resets only when the driver completes S1.
  if (replayTimestamp != null) {
    for (const [dn, sectors] of latestSectors) {
      const meta = latestLapMeta.get(dn);
      if (!meta) continue;

      const lapStart = new Date(meta.dateStart).getTime();
      const elapsed = (replayTimestamp - lapStart) / 1000;
      const prev = prevLapSectors.get(dn);

      const [d1, d2, d3] = meta.durations;
      const s1End = d1 ?? Infinity;
      const s2End = s1End + (d2 ?? Infinity);
      const s3End = s2End + (d3 ?? Infinity);

      if (elapsed < s1End) {
        // Still in S1: carry over all three from previous lap
        sectors[0] = prev?.[0] ?? null;
        sectors[1] = prev?.[1] ?? null;
        sectors[2] = prev?.[2] ?? null;
      } else {
        // S1 completed: show new S1, blank S2/S3 until completed
        if (elapsed < s2End) sectors[1] = null;
        if (elapsed < s3End) sectors[2] = null;
      }
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
      teamName: driver.team_name,
      interval: intv?.interval ?? null,
      gapToLeader: intv?.gap ?? null,
      lastLap: lastLap.get(driverNum) ?? null,
      bestLap: bestLap.get(driverNum) ?? null,
      compound: currentCompound.get(driverNum) ?? null,
      pitCount: pitCounts.get(driverNum) ?? 0,
      sectorTimes: latestSectors.get(driverNum) ?? [null, null, null],
      segments: latestSegments.get(driverNum) ?? [[], [], []],
      personalBestSectors: personalBestSectors.get(driverNum) ?? { s1: null, s2: null, s3: null },
      currentLap: latestLapNum.get(driverNum) ?? 0,
    });
  }

  const sorted = entries.sort((a, b) => a.position - b.position);

  // Append drivers with no position data at all (DNS) at the end.
  // Guard against duplicate driver entries in OpenF1 data (e.g. AUS 2026 Q).
  const appendedDrivers = new Set<number>();
  let nextPos = (sorted[sorted.length - 1]?.position ?? 0) + 1;
  for (const driver of drivers) {
    if (!latestPos.has(driver.driver_number) && !appendedDrivers.has(driver.driver_number)) {
      appendedDrivers.add(driver.driver_number);
      sorted.push({
        position: nextPos++,
        driverNumber: driver.driver_number,
        acronym: driver.name_acronym,
        teamColour: driver.team_colour,
        teamName: driver.team_name,
        interval: latestInterval.get(driver.driver_number)?.interval ?? null,
        gapToLeader: latestInterval.get(driver.driver_number)?.gap ?? null,
        lastLap: lastLap.get(driver.driver_number) ?? null,
        bestLap: bestLap.get(driver.driver_number) ?? null,
        compound: currentCompound.get(driver.driver_number) ?? null,
        pitCount: pitCounts.get(driver.driver_number) ?? 0,
        sectorTimes: latestSectors.get(driver.driver_number) ?? [null, null, null],
        segments: latestSegments.get(driver.driver_number) ?? [[], [], []],
        personalBestSectors: personalBestSectors.get(driver.driver_number) ?? { s1: null, s2: null, s3: null },
        currentLap: latestLapNum.get(driver.driver_number) ?? 0,
      });
    }
  }

  return sorted;
}

function MiniSectorDotsGroup({ segments }: { segments: (number | null)[] }) {
  if (segments.length === 0) return null;

  return (
    <div className="flex justify-center gap-0.5">
      {segments.map((seg, mi) => (
        <div
          key={mi}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: getSegmentColor(seg) }}
        />
      ))}
    </div>
  );
}

function SectorBreakdown({
  sectorTimes,
  segments,
  personalBest,
  overallBest,
}: {
  sectorTimes: [number | null, number | null, number | null];
  segments: (number | null)[][];
  personalBest: SectorBests;
  overallBest: SectorBests;
}) {
  return (
    <div className="flex items-start justify-center gap-1.5">
      {sectorTimes.map((value, index) => {
        const pb = index === 0 ? personalBest.s1 : index === 1 ? personalBest.s2 : personalBest.s3;
        const ob = index === 0 ? overallBest.s1 : index === 1 ? overallBest.s2 : overallBest.s3;
        return (
          <div key={index} className="flex min-w-0 flex-col items-center gap-1">
            <span className={cn("font-mono text-[10px] leading-none whitespace-nowrap", getSectorColor(value, pb, ob))}>
              {value !== null ? value.toFixed(3) : "—"}
            </span>
            <MiniSectorDotsGroup segments={segments[index] ?? []} />
          </div>
        );
      })}
    </div>
  );
}

export function TimingBoard({ entries, retiredDrivers, isQualifying, knockoutPosition }: { entries: TimingEntry[]; retiredDrivers?: Map<number, string>; isQualifying?: boolean; knockoutPosition?: number }) {
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
    <div className="overflow-x-auto rounded-lg border border-f1-border bg-f1-bg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-f1-border bg-f1-surface text-xs font-semibold uppercase text-f1-text-muted">
            <th className="sticky left-0 z-20 bg-f1-surface px-2 py-2.5 text-center w-10">Pos</th>
            <th className="sticky left-10 z-20 bg-f1-surface px-2 py-2.5 text-left whitespace-nowrap">Driver</th>
            {isQualifying && <th className="px-2 py-2.5 text-center whitespace-nowrap">Best</th>}
            {!isQualifying && <th className="px-2 py-2.5 text-center whitespace-nowrap">Int</th>}
            {!isQualifying && <th className="px-2 py-2.5 text-center whitespace-nowrap">Gap</th>}
            <th className="px-2 py-2.5 text-center whitespace-nowrap">Sectors</th>
            <th className="px-2 py-2.5 text-center whitespace-nowrap">Last</th>
            {!isQualifying && <th className="px-2 py-2.5 text-center whitespace-nowrap">Best</th>}
            <th className="px-2 py-2.5 text-center w-10">Tire</th>
            {!isQualifying && <th className="px-2 py-2.5 text-center w-10">Pit</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const [s1, s2, s3] = entry.sectorTimes;
            const pb = entry.personalBestSectors;
            const ob = overallBestSectors;
            const outLabel = retiredDrivers?.get(entry.driverNumber);
            const isOut = !!outLabel;
            const inKnockoutZone = knockoutPosition != null && !isOut && entry.position > knockoutPosition;
            const isKnockoutBoundary = knockoutPosition != null && idx > 0 && entries[idx - 1] && !retiredDrivers?.get(entries[idx - 1].driverNumber) && entries[idx - 1].position <= knockoutPosition && entry.position > knockoutPosition;

            return (
              <motion.tr
                key={entry.driverNumber}
                layout="position"
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                  "group border-b border-f1-border/50 transition-colors hover:bg-f1-card/50",
                  isOut && "opacity-40",
                  inKnockoutZone && "bg-red-500/5",
                  isKnockoutBoundary && "border-t-2 border-t-red-500/40"
                )}
              >
                <td className={cn("sticky left-0 z-10 group-hover:bg-f1-card transition-colors px-2 py-2 text-center font-bold", inKnockoutZone ? "bg-[#110813] text-red-400/80" : "bg-f1-bg")}>
                  {isOut ? (
                    <span className="text-red-400">{outLabel}</span>
                  ) : (
                    entry.position
                  )}
                </td>
                <td className={cn("sticky left-10 z-10 group-hover:bg-f1-card transition-colors px-2 py-2 whitespace-nowrap", inKnockoutZone ? "bg-[#110813]" : "bg-f1-bg")}>
                  <div className="flex items-center gap-2">
                    <div
                      className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: getTeamColor(entry.teamColour, entry.teamName) }}
                    >
                      {(() => {
                        const logoUrl = getTeamLogoUrl(entry.teamName);
                        return logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={entry.teamName}
                            width={16}
                            height={16}
                            className="h-4 w-4 object-contain"
                            style={getTeamLogoStyle(entry.teamName)}
                          />
                        ) : null;
                      })()}
                    </div>
                    <span className="font-bold">{entry.acronym}</span>
                  </div>
                </td>
                {!isQualifying && (
                  <td className="px-2 py-2 text-center font-mono text-f1-text-secondary whitespace-nowrap">
                    {entry.position === 1
                      ? "—"
                      : entry.interval !== null
                        ? typeof entry.interval === "number"
                          ? `+${entry.interval.toFixed(3)}`
                          : `${entry.interval}`
                        : "—"}
                  </td>
                )}
                {!isQualifying && (
                  <td className="px-2 py-2 text-center font-mono text-f1-text-secondary whitespace-nowrap">
                    {entry.position === 1
                      ? "LEADER"
                      : entry.gapToLeader !== null
                        ? typeof entry.gapToLeader === "number"
                          ? `+${entry.gapToLeader.toFixed(3)}`
                          : `${entry.gapToLeader}`
                        : "—"}
                  </td>
                )}
                {isQualifying && (
                  <td
                    className={cn(
                      "px-2 py-2 text-center font-mono whitespace-nowrap",
                      entry.bestLap !== null && entry.bestLap === overallBest && "text-purple-400 font-bold"
                    )}
                  >
                    {entry.bestLap === null
                      ? "—"
                      : entry.position === 1
                        ? formatLapTime(entry.bestLap)
                        : `+${(entry.bestLap - overallBest).toFixed(3)}`}
                  </td>
                )}
                <td className="px-2 py-2 text-center">
                  <SectorBreakdown
                    sectorTimes={[s1, s2, s3]}
                    segments={entry.segments}
                      personalBest={pb}
                      overallBest={ob}
                    />
                  </td>
                <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
                  {formatLapTime(entry.lastLap)}
                </td>
                {!isQualifying && (
                  <td
                    className={cn(
                      "px-2 py-2 text-center font-mono whitespace-nowrap",
                      entry.bestLap !== null && entry.bestLap === overallBest && "text-purple-400 font-bold"
                    )}
                  >
                    {formatLapTime(entry.bestLap)}
                  </td>
                )}
                <td className="px-2 py-2 text-center">
                  {entry.compound && (
                    <span className="inline-flex items-center justify-center">
                      <TyreIcon compound={entry.compound} size={26} />
                    </span>
                  )}
                </td>
                {!isQualifying && (
                  <td className="px-2 py-2 text-center text-f1-text-muted">
                    {entry.pitCount}
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
