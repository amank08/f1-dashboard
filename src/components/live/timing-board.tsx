"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Driver, Position, Interval, Stint, LapData, RaceControlMessage, PitStop } from "@/lib/openf1/types";
import { getTeamColor, getTeamLogoUrl, getTeamLogoStyle } from "@/lib/utils/colors";
import { TyreIcon } from "@/components/ui/tyre-icon";
import { formatLapTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

// Mini-sector status codes from OpenF1
const SEGMENT_YELLOW = 2048;
const SEGMENT_GREEN = 2049;
const SEGMENT_PURPLE = 2051;
const SEGMENT_PIT = 2064;
const PIT_EXIT_DISPLAY_HOLD_MS = 5500;

function upperBound(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

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

interface DriverLapPrefixState {
  latestLapNum: number;
  bestLap: number | null;
  personalBestSectors: SectorBests;
  lastCompletedIndex: number;
  previousCompletedIndex: number;
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

function withFallbackSectorDurations(
  current: [number | null, number | null, number | null],
  previous?: [number | null, number | null, number | null],
  personalBest?: SectorBests
): [number | null, number | null, number | null] {
  return current.map((value, index) => {
    if (value != null && value > 0) return value;
    const previousValue = previous?.[index] ?? null;
    if (previousValue != null && previousValue > 0) return previousValue;
    const pbValue =
      index === 0 ? personalBest?.s1 ?? null :
      index === 1 ? personalBest?.s2 ?? null :
                    personalBest?.s3 ?? null;
    return pbValue != null && pbValue > 0 ? pbValue : null;
  }) as [number | null, number | null, number | null];
}

function isPitSegmentReached(
  lapStartMs: number,
  sectorDurations: [number | null, number | null, number | null],
  segments: (number | null)[][],
  replayTimestamp: number | null | undefined,
  sectorCounts?: [number, number, number]
): boolean {
  if (replayTimestamp == null) {
    return segments.some((sector) => sector.some((segment) => segment === SEGMENT_PIT));
  }

  const elapsed = (replayTimestamp - lapStartMs) / 1000;
  const [d1, d2] = sectorDurations;

  for (let si = 0; si < 3; si++) {
    const sector = segments[si];
    const sectorLen = sectorCounts?.[si] ?? sector.length;
    if (sectorLen === 0) continue;

    const sectorStart =
      si === 0 ? 0 :
      si === 1 ? (d1 ?? Infinity) :
                 (d1 ?? Infinity) + (d2 ?? Infinity);

    const sectorDuration = sectorDurations[si];

    for (let pi = 0; pi < sectorLen; pi++) {
      if (sector[pi] !== SEGMENT_PIT) continue;
      const segStart =
        sectorDuration != null
          ? sectorStart + (pi / sectorLen) * sectorDuration
          : Infinity;
      if (elapsed >= segStart) return true;
    }
  }

  return false;
}

function getPitSegmentStartSeconds(
  sectorDurations: [number | null, number | null, number | null],
  segments: (number | null)[][],
  sectorCounts?: [number, number, number]
): number | null {
  const [d1, d2] = sectorDurations;
  for (let si = 0; si < 3; si++) {
    const sector = segments[si];
    const sectorLen = sectorCounts?.[si] ?? sector.length;
    if (sectorLen === 0) continue;

    const sectorStart =
      si === 0 ? 0 :
      si === 1 ? (d1 ?? Infinity) :
                 (d1 ?? Infinity) + (d2 ?? Infinity);
    const sectorDuration = sectorDurations[si];
    if (sectorDuration == null) continue;

    for (let pi = 0; pi < sectorLen; pi++) {
      if (sector[pi] !== SEGMENT_PIT) continue;
      return sectorStart + (pi / sectorLen) * sectorDuration;
    }
  }
  return null;
}

function getPitSegmentEndSeconds(
  sectorDurations: [number | null, number | null, number | null],
  segments: (number | null)[][],
  sectorCounts?: [number, number, number]
): number | null {
  const [d1, d2] = sectorDurations;
  let lastEnd: number | null = null;

  for (let si = 0; si < 3; si++) {
    const sector = segments[si];
    const sectorLen = sectorCounts?.[si] ?? sector.length;
    if (sectorLen === 0) continue;

    const sectorStart =
      si === 0 ? 0 :
      si === 1 ? (d1 ?? Infinity) :
                 (d1 ?? Infinity) + (d2 ?? Infinity);
    const sectorDuration = sectorDurations[si];
    if (sectorDuration == null) continue;

    for (let pi = 0; pi < sectorLen; pi++) {
      if (sector[pi] !== SEGMENT_PIT) continue;
      lastEnd = sectorStart + ((pi + 1) / sectorLen) * sectorDuration;
    }
  }

  return lastEnd;
}

function hasVisibleNonPitSegmentsByReplay(
  lapStartMs: number,
  sectorDurations: [number | null, number | null, number | null],
  segments: (number | null)[][],
  replayTimestamp: number | null | undefined,
  sectorCounts?: [number, number, number]
): boolean {
  if (replayTimestamp == null) {
    return segments.some((sector) => sector.some((segment) => segment != null && segment !== SEGMENT_PIT));
  }

  const elapsed = (replayTimestamp - lapStartMs) / 1000;
  const [d1, d2] = sectorDurations;

  for (let si = 0; si < 3; si++) {
    const sector = segments[si];
    const sectorLen = sectorCounts?.[si] ?? sector.length;
    if (sectorLen === 0) continue;

    const sectorStart =
      si === 0 ? 0 :
      si === 1 ? (d1 ?? Infinity) :
                 (d1 ?? Infinity) + (d2 ?? Infinity);
    const sectorDuration = sectorDurations[si];
    if (elapsed < sectorStart || sectorDuration == null || sectorDuration <= 0) continue;

    const visibleCount =
      elapsed >= sectorStart + sectorDuration
        ? sectorLen
        : Math.max(0, Math.min(sectorLen, Math.floor(((elapsed - sectorStart) / sectorDuration) * sectorLen)));

    for (let pi = 0; pi < visibleCount; pi++) {
      if (sector[pi] != null && sector[pi] !== SEGMENT_PIT) return true;
    }
  }

  return false;
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

function normalizeSegmentsForCircuit(
  segments: (number | null)[],
  expectedCount: number
): (number | null)[] {
  if (expectedCount === 0) return segments;
  if (segments.length >= expectedCount) return segments.slice(0, expectedCount);

  const padding = Array<null>(expectedCount - segments.length).fill(null);
  if (segments.includes(SEGMENT_PIT)) {
    // Sparse pit sectors from OpenF1 often collapse to the terminal pit marker
    // rather than preserving earlier on-track mini-sectors. Right-align them so
    // replay does not show PIT as soon as the sector begins.
    return [...padding, ...segments];
  }

  return [...segments, ...padding];
}

function cloneSectorBests(value: SectorBests): SectorBests {
  return { s1: value.s1, s2: value.s2, s3: value.s3 };
}

function buildDriverLapPrefixStates(laps: LapData[]): DriverLapPrefixState[] {
  const states: DriverLapPrefixState[] = [];
  let bestLap: number | null = null;
  let personalBestSectors: SectorBests = { s1: null, s2: null, s3: null };
  let lastCompletedIndex = -1;
  let previousCompletedIndex = -1;
  let latestLapNum = 0;

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];
    latestLapNum = Math.max(latestLapNum, lap.lap_number);

    if (!lap.is_pit_out_lap) {
      if (lap.duration_sector_1 != null && (personalBestSectors.s1 == null || lap.duration_sector_1 < personalBestSectors.s1)) {
        personalBestSectors = { ...personalBestSectors, s1: lap.duration_sector_1 };
      }
      if (lap.duration_sector_2 != null && (personalBestSectors.s2 == null || lap.duration_sector_2 < personalBestSectors.s2)) {
        personalBestSectors = { ...personalBestSectors, s2: lap.duration_sector_2 };
      }
      if (lap.duration_sector_3 != null && (personalBestSectors.s3 == null || lap.duration_sector_3 < personalBestSectors.s3)) {
        personalBestSectors = { ...personalBestSectors, s3: lap.duration_sector_3 };
      }
    }

    if (!lap.is_pit_out_lap && lap.lap_duration != null) {
      previousCompletedIndex = lastCompletedIndex;
      lastCompletedIndex = i;
      if (bestLap == null || lap.lap_duration < bestLap) {
        bestLap = lap.lap_duration;
      }
    }

    states.push({
      latestLapNum,
      bestLap,
      personalBestSectors: cloneSectorBests(personalBestSectors),
      lastCompletedIndex,
      previousCompletedIndex,
    });
  }

  return states;
}

export interface TimingEntry {
  position: number;
  gridPosition: number | null;
  positionDelta: number | null;
  driverNumber: number;
  acronym: string;
  teamColour: string;
  teamName: string;
  interval: number | string | null;
  gapToLeader: number | string | null;
  isClosingToAhead: boolean;
  pitElapsed: number | null;
  pitLaneTime: number | null;
  pitStopTime: number | null;
  showRecentPitTime: boolean;
  lastLap: number | null;
  bestLap: number | null;
  compound: string | null;
  pitCount: number;
  sectorTimes: [number | null, number | null, number | null];
  segments: (number | null)[][];
  personalBestSectors: SectorBests;
  currentLap: number;
  isInPit: boolean;
  hasTakenChequered: boolean;
}

export interface TimingDataPreparedInput {
  driverLookup: Map<number, Driver>;
  sortedPositions: Position[];
  sortedIntervals: Interval[];
  lapsByDriver: Map<number, LapData[]>;
  lapStartTimesByDriver: Map<number, number[]>;
  allLapsByDriver: Map<number, LapData[]>;
  allLapStartTimesByDriver: Map<number, number[]>;
  lapPrefixStateByDriver: Map<number, DriverLapPrefixState[]>;
  pitStopsByDriver: Map<number, PitStop[]>;
  pitStopTimesByDriver: Map<number, number[]>;
  sortedRaceControl: RaceControlMessage[];
  sectorCounts: [number, number, number];
}

export function buildTimingDataPreparedInput(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  laps: LapData[],
  pitStops?: PitStop[],
  allLaps?: LapData[],
  raceControl?: RaceControlMessage[]
): TimingDataPreparedInput {
  const driverLookup = new Map<number, Driver>();
  for (const driver of drivers) {
    driverLookup.set(driver.driver_number, driver);
  }

  const sortedPositions = [...positions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const sortedIntervals = [...intervals].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const sortedRaceControl = [...(raceControl ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const lapsByDriver = new Map<number, LapData[]>();
  for (const lap of laps) {
    const driverLaps = lapsByDriver.get(lap.driver_number) ?? [];
    driverLaps.push(lap);
    lapsByDriver.set(lap.driver_number, driverLaps);
  }
  const lapStartTimesByDriver = new Map<number, number[]>();
  for (const [driverNumber, driverLaps] of lapsByDriver) {
    const sortedDriverLaps = [...driverLaps].sort((a, b) => {
        const lapDiff = a.lap_number - b.lap_number;
        if (lapDiff !== 0) return lapDiff;
        return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
      });
    lapsByDriver.set(driverNumber, sortedDriverLaps);
    lapStartTimesByDriver.set(
      driverNumber,
      sortedDriverLaps.map((lap) =>
        lap.date_start ? new Date(lap.date_start).getTime() : Number.POSITIVE_INFINITY
      )
    );
  }

  const allLapsByDriver = new Map<number, LapData[]>();
  for (const lap of allLaps ?? laps) {
    const driverLaps = allLapsByDriver.get(lap.driver_number) ?? [];
    driverLaps.push(lap);
    allLapsByDriver.set(lap.driver_number, driverLaps);
  }
  const allLapStartTimesByDriver = new Map<number, number[]>();
  for (const [driverNumber, driverLaps] of allLapsByDriver) {
    const sortedDriverLaps = [...driverLaps].sort((a, b) => {
      const lapDiff = a.lap_number - b.lap_number;
      if (lapDiff !== 0) return lapDiff;
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
    });
    allLapsByDriver.set(driverNumber, sortedDriverLaps);
    allLapStartTimesByDriver.set(
      driverNumber,
      sortedDriverLaps.map((lap) =>
        lap.date_start ? new Date(lap.date_start).getTime() : Number.POSITIVE_INFINITY
      )
    );
  }
  const lapPrefixStateByDriver = new Map<number, DriverLapPrefixState[]>();
  for (const [driverNumber, driverLaps] of allLapsByDriver) {
    lapPrefixStateByDriver.set(driverNumber, buildDriverLapPrefixStates(driverLaps));
  }

  const pitStopsByDriver = new Map<number, PitStop[]>();
  for (const pit of pitStops ?? []) {
    const driverPitStops = pitStopsByDriver.get(pit.driver_number) ?? [];
    driverPitStops.push(pit);
    pitStopsByDriver.set(pit.driver_number, driverPitStops);
  }
  for (const [driverNumber, driverPitStops] of pitStopsByDriver) {
    pitStopsByDriver.set(
      driverNumber,
      [...driverPitStops].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );
  }
  const pitStopTimesByDriver = new Map<number, number[]>();
  for (const [driverNumber, driverPitStops] of pitStopsByDriver) {
    pitStopTimesByDriver.set(
      driverNumber,
      driverPitStops.map((pit) => new Date(pit.date).getTime())
    );
  }

  const sectorCounts: [number, number, number] = [0, 0, 0];
  const freq: [Map<number, number>, Map<number, number>, Map<number, number>] = [new Map(), new Map(), new Map()];
  for (const lap of (allLaps ?? laps)) {
    const rawS1Len = lap.segments_sector_1?.length ?? 0;
    const s1HasLeadingNull = rawS1Len > 0 && lap.segments_sector_1?.[0] === null;
    const lens = [
      s1HasLeadingNull ? rawS1Len - 1 : rawS1Len,
      lap.segments_sector_2?.length ?? 0,
      lap.segments_sector_3?.length ?? 0,
    ];
    for (let si = 0; si < 3; si++) {
      if (lens[si] > 0) freq[si].set(lens[si], (freq[si].get(lens[si]) ?? 0) + 1);
    }
  }
  for (let si = 0; si < 3; si++) {
    let best = 0;
    let bestCount = 0;
    for (const [len, count] of freq[si]) {
      if (count > bestCount) {
        best = len;
        bestCount = count;
      }
    }
    sectorCounts[si] = best;
  }

  return {
    driverLookup,
    sortedPositions,
    sortedIntervals,
    lapsByDriver,
    lapStartTimesByDriver,
    allLapsByDriver,
    allLapStartTimesByDriver,
    lapPrefixStateByDriver,
    pitStopsByDriver,
    pitStopTimesByDriver,
    sortedRaceControl,
    sectorCounts,
  };
}

export function buildTimingData(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  stints: Stint[],
  laps: LapData[],
  pitStops?: PitStop[],
  replayTimestamp?: number | null,
  /** Full unfiltered laps — used to compute a stable mini-sector grid
   *  layout that doesn't shift as the replay progresses. Only needed
   *  when `laps` is a time-filtered subset. */
  allLaps?: LapData[],
  raceControl?: RaceControlMessage[],
  prepared?: TimingDataPreparedInput
): TimingEntry[] {
  // Get latest position per driver
  const latestPos = new Map<number, number>();
  const gridPos = new Map<number, number>();
  const sortedPositions = prepared?.sortedPositions ?? [...positions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const p of sortedPositions) {
    if (!gridPos.has(p.driver_number)) gridPos.set(p.driver_number, p.position);
    latestPos.set(p.driver_number, p.position);
  }

  // Get latest interval per driver
  const latestInterval = new Map<number, { interval: number | string | null; gap: number | string | null; isClosingToAhead: boolean }>();
  const previousInterval = new Map<number, number | null>();
  const sortedIntervals = prepared?.sortedIntervals ?? [...intervals].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const i of sortedIntervals) {
    const prior = latestInterval.get(i.driver_number)?.interval;
    previousInterval.set(
      i.driver_number,
      typeof prior === "number" ? prior : previousInterval.get(i.driver_number) ?? null
    );
    const previousNumeric =
      typeof prior === "number" ? prior : previousInterval.get(i.driver_number) ?? null;
    latestInterval.set(i.driver_number, {
      interval: i.interval,
      gap: i.gap_to_leader,
      isClosingToAhead:
        typeof i.interval === "number" &&
        previousNumeric != null &&
        i.interval < previousNumeric,
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
  const inPit = new Map<number, boolean>();
  const pitElapsed = new Map<number, number | null>();
  const pitLaneTime = new Map<number, number | null>();
  const pitStopTime = new Map<number, number | null>();
  const showRecentPitTime = new Map<number, boolean>();
  const hasTakenChequered = new Map<number, boolean>();
  // Mini-sector count per sector is a fixed property of the circuit.
  // OpenF1 segment arrays vary in length due to pit laps and partial
  // data, so we use the MODE (most common count) across all session
  // laps rather than the max. Computed from all laps (not the time-
  // filtered subset) so the grid layout is stable during replay.
  const sectorCounts = prepared?.sectorCounts ?? buildTimingDataPreparedInput(
    drivers,
    [],
    [],
    laps,
    undefined,
    allLaps
  ).sectorCounts;

  let activeChequeredAt: number | null = null;
  const sortedRaceControl = prepared?.sortedRaceControl ?? (raceControl && raceControl.length > 0
    ? [...raceControl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : []);
  if (sortedRaceControl.length > 0) {
    const cutoff = replayTimestamp != null ? replayTimestamp : Infinity;
    for (const msg of sortedRaceControl) {
      const messageTime = new Date(msg.date).getTime();
      if (messageTime > cutoff) continue;
      if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
        activeChequeredAt = null;
      }
      if (msg.flag === "CHEQUERED") {
        activeChequeredAt = messageTime;
      }
    }
  }

  // Track latest lap metadata for time-based masking
  const latestLapMeta = new Map<number, { dateStart: string; durations: [number | null, number | null, number | null] }>();

  const lapsByDriver = prepared?.lapsByDriver ?? new Map<number, LapData[]>();
  if (!prepared) {
    for (const lap of laps) {
      const driverLaps = lapsByDriver.get(lap.driver_number) ?? [];
      driverLaps.push(lap);
      lapsByDriver.set(lap.driver_number, driverLaps);
    }
  }

  for (const [dn, driverLaps] of lapsByDriver) {
    const sortedLaps = prepared ? driverLaps : [...driverLaps].sort((a, b) => {
      const lapDiff = a.lap_number - b.lap_number;
      if (lapDiff !== 0) return lapDiff;
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
    });
    const allDriverLaps = prepared?.allLapsByDriver.get(dn) ?? sortedLaps;
    const lapPrefixStates = prepared?.lapPrefixStateByDriver.get(dn);
    const currentDisplayLap = sortedLaps[sortedLaps.length - 1] ?? null;
    if (!currentDisplayLap) continue;
    const canUsePrefixState =
      replayTimestamp != null &&
      prepared != null &&
      lapPrefixStates != null &&
      sortedLaps.length > 0 &&
      sortedLaps[0] === allDriverLaps[0] &&
      currentDisplayLap === allDriverLaps[sortedLaps.length - 1];

    const pb: SectorBests = { s1: null, s2: null, s3: null };
    let lastCompletedLap: LapData | null = null;
    let previousCompletedLap: LapData | null = null;
    if (canUsePrefixState) {
      const priorState = sortedLaps.length > 1 ? lapPrefixStates[sortedLaps.length - 2] : null;
      if (priorState) {
        pb.s1 = priorState.personalBestSectors.s1;
        pb.s2 = priorState.personalBestSectors.s2;
        pb.s3 = priorState.personalBestSectors.s3;
        if (priorState.lastCompletedIndex >= 0) {
          lastCompletedLap = allDriverLaps[priorState.lastCompletedIndex] ?? null;
          if (lastCompletedLap?.lap_duration != null) lastLap.set(dn, lastCompletedLap.lap_duration);
        }
        if (priorState.previousCompletedIndex >= 0) {
          previousCompletedLap = allDriverLaps[priorState.previousCompletedIndex] ?? null;
        }
        if (priorState.bestLap != null) bestLap.set(dn, priorState.bestLap);
      }
      latestLapNum.set(dn, currentDisplayLap.lap_number);

      if (!currentDisplayLap.is_pit_out_lap) {
        if (isSectorCompleteByReplay(currentDisplayLap, 0, replayTimestamp) && currentDisplayLap.duration_sector_1 !== null && (pb.s1 === null || currentDisplayLap.duration_sector_1 < pb.s1)) pb.s1 = currentDisplayLap.duration_sector_1;
        if (isSectorCompleteByReplay(currentDisplayLap, 1, replayTimestamp) && currentDisplayLap.duration_sector_2 !== null && (pb.s2 === null || currentDisplayLap.duration_sector_2 < pb.s2)) pb.s2 = currentDisplayLap.duration_sector_2;
        if (isSectorCompleteByReplay(currentDisplayLap, 2, replayTimestamp) && currentDisplayLap.duration_sector_3 !== null && (pb.s3 === null || currentDisplayLap.duration_sector_3 < pb.s3)) pb.s3 = currentDisplayLap.duration_sector_3;
      }

      if (!currentDisplayLap.is_pit_out_lap && isLapCompleteByReplay(currentDisplayLap, replayTimestamp) && currentDisplayLap.lap_duration != null) {
        previousCompletedLap = lastCompletedLap;
        lastCompletedLap = currentDisplayLap;
        lastLap.set(dn, currentDisplayLap.lap_duration);
        const currentBest = bestLap.get(dn);
        if (currentBest == null || currentDisplayLap.lap_duration < currentBest) {
          bestLap.set(dn, currentDisplayLap.lap_duration);
        }
      }
    } else {
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
    }

    personalBestSectors.set(dn, pb);

    const rawCurrentSegments = getLapSegments(currentDisplayLap);
    const currentSegments = rawCurrentSegments.map((sector, index) =>
      normalizeSegmentsForCircuit(sector, sectorCounts[index])
    ) as (number | null)[][];

    if (activeChequeredAt != null && lastCompletedLap?.lap_duration != null) {
      hasTakenChequered.set(
        dn,
        getLapStartMs(lastCompletedLap) + lastCompletedLap.lap_duration * 1000 >= activeChequeredAt
      );
    }

    const carryOverLap =
      currentDisplayLap === lastCompletedLap ? previousCompletedLap : lastCompletedLap;
    if (carryOverLap) {
      prevLapSectors.set(dn, getLapSectors(carryOverLap));
    }
    const effectiveSectorDurations = withFallbackSectorDurations(
      getLapSectors(currentDisplayLap),
      carryOverLap ? getLapSectors(carryOverLap) : undefined,
      pb
    );

    const pitStopForLap = prepared?.pitStopsByDriver.get(dn) ?? [...(pitStops ?? [])]
      .filter((pit) => pit.driver_number === dn)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pitStopTimes = prepared?.pitStopTimesByDriver.get(dn) ?? pitStopForLap.map((pit) => new Date(pit.date).getTime());
    let latestPitStop: PitStop | undefined;
    if (pitStopForLap.length > 0) {
      const latestPitStopIndex =
        replayTimestamp == null
          ? pitStopForLap.length - 1
          : upperBound(pitStopTimes, replayTimestamp) - 1;
      latestPitStop = latestPitStopIndex >= 0 ? pitStopForLap[latestPitStopIndex] : undefined;
    }
    let visiblePitStopForDisplay: PitStop | undefined = replayTimestamp == null ? latestPitStop : undefined;

    let pitFlag = false;
    if (replayTimestamp != null) {
      const allDriverLapTimes = prepared?.allLapStartTimesByDriver.get(dn) ?? allDriverLaps.map((lap) => new Date(lap.date_start).getTime());
      // A retirement lap has no duration and no segments. Treat it like a
      // pit-out lap so we walk back to the previous lap for pit detection,
      // preserving any pit entry that was detected on that prior lap.
      const isRetirementLap =
        currentDisplayLap.lap_duration == null &&
        (currentDisplayLap.segments_sector_1?.length ?? 0) === 0 &&
        (currentDisplayLap.segments_sector_2?.length ?? 0) === 0 &&
        (currentDisplayLap.segments_sector_3?.length ?? 0) === 0;
      const pitInLap = (currentDisplayLap.is_pit_out_lap || isRetirementLap)
        ? (() => {
            // The immediately preceding lap is always the in-lap for the
            // current out-lap, even if it is also marked is_pit_out_lap (which
            // happens when a driver pits on consecutive laps).
            const candidateIndex = upperBound(allDriverLapTimes, getLapStartMs(currentDisplayLap) - 1) - 1;
            return candidateIndex >= 0 ? allDriverLaps[candidateIndex] : null;
          })()
        : currentDisplayLap;

      if (pitInLap) {
        const priorLapForPit = pitInLap === currentDisplayLap ? carryOverLap : previousCompletedLap;
        const pitInLapDurations = withFallbackSectorDurations(
          getLapSectors(pitInLap),
          priorLapForPit ? getLapSectors(priorLapForPit) : undefined,
          pb
        );
        const pitInLapSegments = getLapSegments(pitInLap).map((sector, index) =>
          normalizeSegmentsForCircuit(sector, sectorCounts[index])
        ) as (number | null)[][];
        const pitEntrySeconds = getPitSegmentStartSeconds(
          pitInLapDurations,
          pitInLapSegments,
          sectorCounts
        );

        if (pitEntrySeconds != null) {
          let pitEntryMs = getLapStartMs(pitInLap) + pitEntrySeconds * 1000;
          let pitExitMs: number | null = null;
          const authoritativePitStop = pitStopForLap.find(
            (pit) => pit.lap_number === pitInLap.lap_number
          );
          if (
            authoritativePitStop &&
            new Date(authoritativePitStop.date).getTime() <= replayTimestamp
          ) {
            visiblePitStopForDisplay = authoritativePitStop;
          }
          const authoritativeLaneDuration =
            authoritativePitStop?.lane_duration ?? authoritativePitStop?.pit_duration ?? null;
          const outLapIndex = upperBound(allDriverLapTimes, getLapStartMs(pitInLap));
          const outLap = allDriverLaps.slice(outLapIndex).find((lap) => lap.is_pit_out_lap);

          if (
            authoritativePitStop
          ) {
            // OpenF1 pit rows line up with the end of the pit-lane window in
            // the real feed. When lane duration is present, derive the
            // corresponding pit-lane entry time from the same authoritative
            // record so the timer starts at the pit-lane line.
            if (authoritativeLaneDuration != null && authoritativeLaneDuration > 0) {
              pitEntryMs = new Date(authoritativePitStop.date).getTime() - authoritativeLaneDuration * 1000;
            }
            pitExitMs = new Date(authoritativePitStop.date).getTime();
          }

          if (pitExitMs == null && outLap) {
            const outLapPrior = pitInLap;
            const outLapDurations = withFallbackSectorDurations(
              getLapSectors(outLap),
              outLapPrior ? getLapSectors(outLapPrior) : undefined,
              pb
            );
            const outLapSegments = getLapSegments(outLap).map((sector, index) =>
              normalizeSegmentsForCircuit(sector, sectorCounts[index])
            ) as (number | null)[][];
            const outLapPitExitSeconds = getPitSegmentEndSeconds(
              outLapDurations,
              outLapSegments,
              sectorCounts
            );

            if (outLapPitExitSeconds != null) {
              pitExitMs = getLapStartMs(outLap) + outLapPitExitSeconds * 1000;
            } else if (hasVisibleNonPitSegmentsByReplay(
              getLapStartMs(outLap),
              outLapDurations,
              outLapSegments,
              replayTimestamp,
              sectorCounts
            )) {
              pitExitMs = getLapStartMs(outLap);
            } else if (replayTimestamp >= getLapStartMs(outLap)) {
              pitExitMs = Number.POSITIVE_INFINITY;
            } else {
              pitExitMs = getLapStartMs(outLap);
            }
          } else if (pitExitMs == null && !isLapCompleteByReplay(pitInLap, replayTimestamp)) {
            pitExitMs = Number.POSITIVE_INFINITY;
          } else if (
            pitExitMs == null &&
            latestPitStop &&
            latestPitStop.lap_number === pitInLap.lap_number &&
            new Date(latestPitStop.date).getTime() <= replayTimestamp
          ) {
            // A completed in-lap with a pit-stop record but no out-lap yet means
            // the driver is still in the box / lane state for replay purposes.
            // Keep PIT active until an out-lap is actually observed.
            pitExitMs = Number.POSITIVE_INFINITY;
          } else if (pitExitMs == null && pitInLap.lap_duration != null) {
            // allDriverLaps is the full unfiltered set, so outLap=null here
            // means no out-lap exists at all (retirement or live feed hasn't
            // emitted one yet). Keep PIT active until an exit signal appears.
            pitExitMs = Number.POSITIVE_INFINITY;
          }

          if (pitExitMs != null && replayTimestamp >= pitEntryMs && replayTimestamp < pitExitMs) {
            pitFlag = true;
            pitElapsed.set(dn, Math.max(0, (replayTimestamp - pitEntryMs) / 1000));
          } else if (
            pitExitMs != null &&
            replayTimestamp >= pitExitMs &&
            replayTimestamp < pitExitMs + PIT_EXIT_DISPLAY_HOLD_MS
          ) {
            pitElapsed.set(dn, Math.max(0, (pitExitMs - pitEntryMs) / 1000));
            showRecentPitTime.set(dn, true);
          }
        } else if (!pitFlag && !showRecentPitTime.has(dn)) {
          // Fallback for drivers whose in-lap has no SEGMENT_PIT data (e.g.
          // Albon at JPN 2026). latestPitStop is already capped to <=
          // replayTimestamp so using it here is live-appropriate.
          if (latestPitStop) {
            const pitExitMs = new Date(latestPitStop.date).getTime();
            // Confirm this pit stop belongs to the current in-lap via timestamp:
            // OpenF1's lap_number field is unreliable (can reference the out-lap),
            // so we check that the pit record arrived after the in-lap started.
            if (pitExitMs > getLapStartMs(pitInLap) && replayTimestamp >= pitExitMs) {
              // Display the result until the out-lap completes, or 90 s after the
              // pit exit record if no out-lap is visible yet.
              const fbOutLapIndex = upperBound(allDriverLapTimes, getLapStartMs(pitInLap));
              const fbOutLap = allDriverLaps.slice(fbOutLapIndex).find((lap) => lap.is_pit_out_lap);
              let holdUntil: number;
              if (fbOutLap) {
                holdUntil = fbOutLap.lap_duration != null
                  ? getLapStartMs(fbOutLap) + fbOutLap.lap_duration * 1000
                  : Number.POSITIVE_INFINITY; // out-lap still in progress
              } else {
                holdUntil = pitExitMs + 90_000; // no out-lap data yet
              }
              if (replayTimestamp < holdUntil) {
                visiblePitStopForDisplay = latestPitStop;
                const laneDuration =
                  latestPitStop.lane_duration ?? latestPitStop.pit_duration ?? null;
                pitElapsed.set(dn, laneDuration);
                showRecentPitTime.set(dn, true);
              }
            }
          }
        }
      }
    } else {
      const pitEntrySeconds = getPitSegmentStartSeconds(
        effectiveSectorDurations,
        currentSegments,
        sectorCounts
      );
      const hasActivePitSegment = pitEntrySeconds != null && isPitSegmentReached(
        getLapStartMs(currentDisplayLap),
        effectiveSectorDurations,
        currentSegments,
        replayTimestamp,
        sectorCounts
      );
      if (currentDisplayLap.is_pit_out_lap) {
        pitFlag = pitEntrySeconds != null || hasActivePitSegment;
      } else {
        pitFlag = hasActivePitSegment;
      }
    }
    inPit.set(dn, pitFlag);
    pitLaneTime.set(dn, visiblePitStopForDisplay?.lane_duration ?? visiblePitStopForDisplay?.pit_duration ?? null);
    pitStopTime.set(dn, visiblePitStopForDisplay?.stop_duration ?? null);
    latestSectors.set(dn, getLapSectors(currentDisplayLap));
    latestSegments.set(dn, currentSegments);
    latestLapMeta.set(dn, {
      dateStart: currentDisplayLap.date_start,
      durations: effectiveSectorDurations,
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
      segs[i] = normalizeSegmentsForCircuit(segs[i], expected);
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

  const driverLookup = prepared?.driverLookup ?? new Map<number, Driver>();
  if (!prepared) {
    for (const d of drivers) driverLookup.set(d.driver_number, d);
  }

  const entries: TimingEntry[] = [];
  for (const [driverNum, pos] of latestPos) {
    const driver = driverLookup.get(driverNum);
    if (!driver) continue;
    const intv = latestInterval.get(driverNum);
    entries.push({
      position: pos,
      gridPosition: gridPos.get(driverNum) ?? null,
      positionDelta: gridPos.has(driverNum) ? (gridPos.get(driverNum)! - pos) : null,
      driverNumber: driverNum,
      acronym: driver.name_acronym,
      teamColour: driver.team_colour,
      teamName: driver.team_name,
      interval: intv?.interval ?? null,
      gapToLeader: intv?.gap ?? null,
      isClosingToAhead: intv?.isClosingToAhead ?? false,
      pitElapsed: pitElapsed.get(driverNum) ?? null,
      pitLaneTime: pitLaneTime.get(driverNum) ?? null,
      pitStopTime: pitStopTime.get(driverNum) ?? null,
      showRecentPitTime: showRecentPitTime.get(driverNum) ?? false,
      lastLap: lastLap.get(driverNum) ?? null,
      bestLap: bestLap.get(driverNum) ?? null,
      compound: currentCompound.get(driverNum) ?? null,
      pitCount: pitCounts.get(driverNum) ?? 0,
      sectorTimes: latestSectors.get(driverNum) ?? [null, null, null],
      segments: latestSegments.get(driverNum) ?? [[], [], []],
      personalBestSectors: personalBestSectors.get(driverNum) ?? { s1: null, s2: null, s3: null },
      currentLap: latestLapNum.get(driverNum) ?? 0,
      isInPit: inPit.get(driverNum) ?? false,
      hasTakenChequered: hasTakenChequered.get(driverNum) ?? false,
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
      const appendedPosition = nextPos++;
      sorted.push({
        position: appendedPosition,
        gridPosition: gridPos.get(driver.driver_number) ?? null,
        positionDelta: gridPos.has(driver.driver_number)
          ? (gridPos.get(driver.driver_number)! - appendedPosition)
          : null,
        driverNumber: driver.driver_number,
        acronym: driver.name_acronym,
        teamColour: driver.team_colour,
        teamName: driver.team_name,
        interval: latestInterval.get(driver.driver_number)?.interval ?? null,
        gapToLeader: latestInterval.get(driver.driver_number)?.gap ?? null,
        isClosingToAhead: latestInterval.get(driver.driver_number)?.isClosingToAhead ?? false,
        pitElapsed: pitElapsed.get(driver.driver_number) ?? null,
        pitLaneTime: pitLaneTime.get(driver.driver_number) ?? null,
        pitStopTime: pitStopTime.get(driver.driver_number) ?? null,
        showRecentPitTime: showRecentPitTime.get(driver.driver_number) ?? false,
        lastLap: lastLap.get(driver.driver_number) ?? null,
        bestLap: bestLap.get(driver.driver_number) ?? null,
        compound: currentCompound.get(driver.driver_number) ?? null,
        pitCount: pitCounts.get(driver.driver_number) ?? 0,
        sectorTimes: latestSectors.get(driver.driver_number) ?? [null, null, null],
        segments: latestSegments.get(driver.driver_number) ?? [[], [], []],
        personalBestSectors: personalBestSectors.get(driver.driver_number) ?? { s1: null, s2: null, s3: null },
        currentLap: latestLapNum.get(driver.driver_number) ?? 0,
        isInPit: inPit.get(driver.driver_number) ?? false,
        hasTakenChequered: hasTakenChequered.get(driver.driver_number) ?? false,
      });
    }
  }

  return sorted;
}

function MiniSectorDotsGroup({ segments }: { segments: (number | null)[] }) {
  if (segments.length === 0) return null;

  return (
    <div className="flex justify-center gap-1">
      {segments.map((seg, mi) => (
        <div
          key={mi}
          className="h-2 w-2 rounded-full ring-1 ring-black/15"
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
  isOut,
}: {
  sectorTimes: [number | null, number | null, number | null];
  segments: (number | null)[][];
  personalBest: SectorBests;
  overallBest: SectorBests;
  isOut: boolean;
}) {
  if (isOut) {
    return (
      <div className="flex items-start justify-center gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className="font-mono text-[11px] leading-none text-f1-text-muted">—</span>
            <MiniSectorDotsGroup segments={[]} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-start justify-center gap-2">
      {sectorTimes.map((value, index) => {
        const pb = index === 0 ? personalBest.s1 : index === 1 ? personalBest.s2 : personalBest.s3;
        const ob = index === 0 ? overallBest.s1 : index === 1 ? overallBest.s2 : overallBest.s3;
        return (
          <div key={index} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className={cn("font-mono text-[12px] font-semibold leading-none whitespace-nowrap", getSectorColor(value, pb, ob))}>
              {value !== null ? value.toFixed(3) : "—"}
            </span>
            <MiniSectorDotsGroup segments={segments[index] ?? []} />
          </div>
        );
      })}
    </div>
  );
}

function DriverStatusBadges({
  isInPit,
  hasTakenChequered,
}: {
  isInPit: boolean;
  hasTakenChequered: boolean;
}) {
  const showPit = isInPit;
  const showChequered = !isInPit && hasTakenChequered;

  return (
    <div className="flex h-4 w-8 items-center justify-center">
      {showChequered && (
        <span
          title="Took chequered flag"
          aria-label="Took chequered flag"
          className="shrink-0 text-[11px] leading-none"
        >
          🏁
        </span>
      )}
      {showPit && (
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded bg-f1-text-muted/15 px-1 py-0.5 text-[9px] font-semibold leading-none tracking-[0.12em] text-f1-text-muted">
          PIT
        </span>
      )}
    </div>
  );
}

function formatTimingValue(value: number | string | null): string {
  if (value == null) return "—";
  if (typeof value === "number") return `+${value.toFixed(3)}`;
  return `${value}`;
}

function formatSeconds(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}s`;
}

function RaceGapCell({
  position,
  interval,
  gapToLeader,
  isClosingToAhead,
  isInPit,
  pitElapsed,
  pitLaneTime,
  pitStopTime,
  showRecentPitTime,
  isOut,
}: {
  position: number;
  interval: number | string | null;
  gapToLeader: number | string | null;
  isClosingToAhead: boolean;
  isInPit: boolean;
  pitElapsed: number | null;
  pitLaneTime: number | null;
  pitStopTime: number | null;
  showRecentPitTime: boolean;
  isOut: boolean;
}) {
  if (isOut) {
    return (
      <div className="flex min-w-[6.25rem] flex-col items-center justify-center leading-none">
        <span className="font-mono text-[14px] text-f1-text-muted">—</span>
      </div>
    );
  }

  if (isInPit || showRecentPitTime) {
    const primaryPitValue = showRecentPitTime
      ? (pitLaneTime ?? pitElapsed)
      : pitElapsed;
    const secondaryText = pitStopTime != null
      ? `STOP ${formatSeconds(pitStopTime)}`
      : (showRecentPitTime ? "PIT EXIT" : "PIT");
    const secondaryClassName = pitStopTime != null
      ? "text-[11px] font-medium text-f1-text-secondary"
      : "text-[10px] font-medium uppercase tracking-[0.1em] text-f1-text-muted";
    return (
      <div className="flex min-w-[6rem] flex-col items-center justify-center gap-0.5 leading-none">
        <span className="font-mono text-[14px] font-semibold text-blue-300">
          {formatSeconds(primaryPitValue)}
        </span>
        <span className={secondaryClassName}>
          {secondaryText}
        </span>
      </div>
    );
  }

  if (position === 1) {
    return (
      <div className="flex min-w-[6rem] flex-col items-center justify-center leading-none">
        <span className="font-mono text-[14px] font-semibold text-f1-text">LEADER</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-f1-text-muted">
          Gap
        </span>
      </div>
    );
  }

  const hasInterval = interval != null;
  const hasGap = gapToLeader != null;

  return (
    <div className="flex min-w-[6rem] flex-col items-center justify-center gap-0.5 leading-none">
      <span
        className={cn(
          "font-mono text-[14px] font-semibold",
          isClosingToAhead ? "text-green-400" : "text-f1-text"
        )}
      >
        {hasInterval ? formatTimingValue(interval) : "—"}
      </span>
      <span className="text-[11px] font-medium text-f1-text-secondary">
        {hasGap ? formatTimingValue(gapToLeader) : "—"}
      </span>
    </div>
  );
}

function RaceLapTimesCell({
  lastLap,
  bestLap,
  overallBest,
}: {
  lastLap: number | null;
  bestLap: number | null;
  overallBest: number;
}) {
  const lastLapClassName =
    lastLap !== null && lastLap === overallBest
      ? "text-purple-400"
      : lastLap !== null && bestLap !== null && lastLap === bestLap
        ? "text-green-400"
        : "text-f1-text";

  return (
    <div className="flex min-w-[6.25rem] flex-col items-center justify-center gap-0.5 leading-none">
      <span className={cn("font-mono text-[14px] font-semibold", lastLapClassName)}>
        {formatLapTime(lastLap)}
      </span>
      <span
        className={cn(
          "text-[11px] font-medium",
          bestLap !== null && bestLap === overallBest ? "text-purple-400" : "text-f1-text-secondary"
        )}
      >
        {formatLapTime(bestLap)}
      </span>
    </div>
  );
}

function PositionDeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return (
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-f1-text-muted">
        —
      </span>
    );
  }

  const isGain = delta > 0;
  return (
    <span
      className={cn(
        "text-sm font-medium tabular-nums",
        isGain ? "text-green-400" : "text-red-400"
      )}
    >
      {isGain ? `+${delta}` : `${delta}`}
    </span>
  );
}

export function TimingBoard({
  entries,
  retiredDrivers,
  isQualifying,
  isPractice,
  knockoutPosition,
  embedded,
}: {
  entries: TimingEntry[];
  retiredDrivers?: Map<number, string>;
  isQualifying?: boolean;
  isPractice?: boolean;
  knockoutPosition?: number;
  embedded?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className={cn(
        "p-8 text-center text-f1-text-muted",
        embedded ? "bg-f1-surface" : "rounded-lg border border-f1-border bg-f1-surface"
      )}>
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

  const usesQualifyingStyleLayout = !!(isQualifying || isPractice);
  const raceCellPadding = usesQualifyingStyleLayout ? "px-0.5 py-2" : "px-0 py-2";
  const driverCellPadding = usesQualifyingStyleLayout ? "px-0.5 py-2" : "px-0 py-2";
  const posCellPadding = usesQualifyingStyleLayout ? "px-0.5 py-2" : "px-0 py-2";

  return (
    <div className={cn(
      "overflow-x-auto bg-f1-bg",
      embedded ? "" : "rounded-lg border border-f1-border"
    )}>
      <table className="w-max text-sm">
        <thead>
          <tr className="border-b border-f1-border bg-f1-surface text-xs font-semibold uppercase text-f1-text-muted">
            <th className="sticky left-0 z-20 bg-f1-surface px-0.5 py-2.5 text-center w-8">Pos</th>
            <th className={cn(
              "sticky left-10 z-20 bg-f1-surface py-2.5 text-left whitespace-nowrap",
              usesQualifyingStyleLayout ? "px-0.5" : "w-[6.5rem] px-0"
            )}>Driver</th>
            {usesQualifyingStyleLayout && <th className="px-0.5 py-2.5 text-center whitespace-nowrap">Best</th>}
            {!usesQualifyingStyleLayout && <th className="px-0.5 py-2.5 text-center whitespace-nowrap">Gap / Int</th>}
            <th className="px-0.5 py-2.5 text-center whitespace-nowrap">Sectors</th>
            <th className="px-0.5 py-2.5 text-center whitespace-nowrap">
              {usesQualifyingStyleLayout ? "Last" : "Last / Best"}
            </th>
            <th className="px-0.5 py-2.5 text-center w-8">Tire</th>
            {!usesQualifyingStyleLayout && <th className="px-0.5 py-2.5 text-center w-8">Pit</th>}
            {!usesQualifyingStyleLayout && <th className="px-0.5 py-2.5 text-center w-6">+/-</th>}
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
                <td className={cn("sticky left-0 z-10 group-hover:bg-f1-card transition-colors text-center font-bold", posCellPadding, inKnockoutZone ? "bg-[#110813] text-red-400/80" : "bg-f1-bg")}>
                  {isOut ? (
                    <span className="text-red-400">{outLabel}</span>
                  ) : (
                    <span>{entry.position}</span>
                  )}
                </td>
                <td className={cn(
                  "sticky left-10 z-10 group-hover:bg-f1-card transition-colors whitespace-nowrap",
                  driverCellPadding,
                  !usesQualifyingStyleLayout && "w-[6.5rem]",
                  inKnockoutZone ? "bg-[#110813]" : "bg-f1-bg"
                )}>
                  <div className={cn("flex items-center", usesQualifyingStyleLayout ? "gap-2" : "gap-1.5")}>
                    <div
                      className={cn(
                        "relative shrink-0 rounded-full flex items-center justify-center",
                        usesQualifyingStyleLayout ? "h-6 w-6" : "h-5.5 w-5.5"
                      )}
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
                            className={cn(
                              "object-contain",
                              usesQualifyingStyleLayout ? "h-4 w-4" : "h-4 w-4"
                            )}
                            style={getTeamLogoStyle(entry.teamName)}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div className={cn("flex items-center", usesQualifyingStyleLayout ? "gap-1.5" : "gap-1")}>
                      <span className={cn("font-bold", usesQualifyingStyleLayout ? "" : "text-[14px] tracking-[0.03em]")}>{entry.acronym}</span>
                      <DriverStatusBadges
                        isInPit={entry.isInPit}
                        hasTakenChequered={entry.hasTakenChequered}
                      />
                    </div>
                  </div>
                </td>
                {!usesQualifyingStyleLayout && (
                  <td className={cn("text-center whitespace-nowrap", raceCellPadding)}>
                    <RaceGapCell
                      position={entry.position}
                      interval={entry.interval}
                      gapToLeader={entry.gapToLeader}
                      isClosingToAhead={entry.isClosingToAhead}
                      isInPit={entry.isInPit}
                      pitElapsed={entry.pitElapsed}
                      pitLaneTime={entry.pitLaneTime}
                      pitStopTime={entry.pitStopTime}
                      showRecentPitTime={entry.showRecentPitTime}
                      isOut={isOut}
                    />
                  </td>
                )}
                {usesQualifyingStyleLayout && (
                  <td
                    className={cn(
                      "text-center font-mono whitespace-nowrap",
                      raceCellPadding,
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
                <td className={cn("text-center", raceCellPadding)}>
                  <SectorBreakdown
                    sectorTimes={[s1, s2, s3]}
                    segments={entry.segments}
                    personalBest={pb}
                    overallBest={ob}
                    isOut={isOut}
                    />
                </td>
                {!usesQualifyingStyleLayout && (
                  <td className={cn("text-center whitespace-nowrap", raceCellPadding)}>
                    <RaceLapTimesCell
                      lastLap={entry.lastLap}
                      bestLap={entry.bestLap}
                      overallBest={overallBest}
                    />
                  </td>
                )}
                {usesQualifyingStyleLayout && (
                  <td className={cn("text-center font-mono whitespace-nowrap", raceCellPadding)}>
                    {formatLapTime(entry.lastLap)}
                  </td>
                )}
                <td className={cn("text-center", raceCellPadding)}>
                  {entry.compound && (
                    <span className="inline-flex items-center justify-center">
                      <TyreIcon compound={entry.compound} size={26} />
                    </span>
                  )}
                </td>
                {!usesQualifyingStyleLayout && (
                  <td className={cn("text-center text-f1-text-muted", raceCellPadding)}>
                    {entry.pitCount}
                  </td>
                )}
                {!usesQualifyingStyleLayout && (
                  <td className={cn("text-center", raceCellPadding)}>
                    <PositionDeltaBadge delta={entry.positionDelta} />
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
