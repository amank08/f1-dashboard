import type { Interval, LapData, Position, RaceControlMessage, Stint, Driver, PitStop } from "@/lib/openf1/types";
import {
  buildTimingData,
  buildTimingDataPreparedInput,
  type TimingDataPreparedInput,
  type TimingEntry,
} from "@/components/live/timing-board";

export interface ReplaySessionIndex {
  positionsSorted: Position[];
  positionTimes: number[];
  intervalsSorted: Interval[];
  intervalTimes: number[];
  lapsSorted: LapData[];
  lapStartTimes: number[];
  lapsByDriverSorted: Map<number, LapData[]>;
  lapStartTimesByDriver: Map<number, number[]>;
  raceControlSorted: RaceControlMessage[];
  raceControlTimes: number[];
  timingPreparedBase: TimingDataPreparedInput;
}

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

export function buildReplaySessionIndex(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  laps: LapData[],
  pitStops: PitStop[] | null | undefined,
  raceControl: RaceControlMessage[] | null | undefined
): ReplaySessionIndex {
  const positionsSorted = [...positions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const intervalsSorted = [...intervals].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const lapsSorted = [...laps].sort((a, b) => {
    const aTime = a.date_start ? new Date(a.date_start).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.date_start ? new Date(b.date_start).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  const lapsByDriverSorted = new Map<number, LapData[]>();
  for (const lap of laps) {
    const driverLaps = lapsByDriverSorted.get(lap.driver_number) ?? [];
    driverLaps.push(lap);
    lapsByDriverSorted.set(lap.driver_number, driverLaps);
  }
  for (const [driverNumber, driverLaps] of lapsByDriverSorted) {
    lapsByDriverSorted.set(
      driverNumber,
      [...driverLaps].sort((a, b) => {
        const lapDiff = a.lap_number - b.lap_number;
        if (lapDiff !== 0) return lapDiff;
        const aTime = a.date_start ? new Date(a.date_start).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.date_start ? new Date(b.date_start).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })
    );
  }
  const raceControlSorted = [...(raceControl ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const timingPreparedBase = buildTimingDataPreparedInput(
    drivers,
    positionsSorted,
    intervalsSorted,
    laps,
    pitStops ?? undefined,
    laps,
    raceControlSorted
  );

  return {
    positionsSorted,
    positionTimes: positionsSorted.map((position) => new Date(position.date).getTime()),
    intervalsSorted,
    intervalTimes: intervalsSorted.map((interval) => new Date(interval.date).getTime()),
    lapsSorted,
    lapStartTimes: lapsSorted.map((lap) => lap.date_start ? new Date(lap.date_start).getTime() : Number.POSITIVE_INFINITY),
    lapsByDriverSorted,
    lapStartTimesByDriver: timingPreparedBase.lapStartTimesByDriver,
    raceControlSorted,
    raceControlTimes: raceControlSorted.map((message) => new Date(message.date).getTime()),
    timingPreparedBase,
  };
}

export function filterDeletedLapTimes(
  laps: LapData[] | null | undefined,
  raceControl: RaceControlMessage[] | null | undefined
): LapData[] | null {
  if (!laps) return null;
  if (!raceControl) return laps;

  function parseTimeStr(t: string): number {
    const parts = t.split(":");
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }

  const deletedTimes = new Set<string>();
  for (const msg of raceControl) {
    const carMatch = msg.message.match(/CAR (\d+)/);
    const timeMatch = msg.message.match(/TIME ([\d:]+\.[\d]+)/);
    if (!carMatch || !timeMatch) continue;
    const car = carMatch[1];
    const secs = parseTimeStr(timeMatch[1]).toFixed(3);
    const key = `${car}-${secs}`;

    if (msg.message.includes("DELETED")) {
      deletedTimes.add(key);
    } else if (msg.message.includes("REINSTATED")) {
      deletedTimes.delete(key);
    }
  }

  if (deletedTimes.size === 0) return laps;
  return laps.map((lap) => {
    if (!lap.lap_duration) return lap;
    if (deletedTimes.has(`${lap.driver_number}-${lap.lap_duration.toFixed(3)}`)) {
      return { ...lap, lap_duration: null };
    }
    return lap;
  });
}

export function buildReplayTimingEntries(
  drivers: Driver[],
  positions: Position[],
  intervals: Interval[],
  stints: Stint[],
  laps: LapData[],
  pitStops: PitStop[] | null | undefined,
  replayTime: number | null,
  isQualifyingSession: boolean,
  raceControl: RaceControlMessage[] | null | undefined,
  replayIndex?: ReplaySessionIndex | null
): TimingEntry[] {
  const sortedRaceControl = replayIndex?.raceControlSorted ?? [...(raceControl ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (replayTime === null) {
    return buildTimingData(
      drivers,
      positions,
      intervals,
      stints,
      laps,
      pitStops ?? undefined,
      replayTime,
      laps,
      sortedRaceControl,
      replayIndex?.timingPreparedBase
    );
  }

  const cutoff = new Date(replayTime).toISOString();
  const filteredPositions = replayIndex
    ? replayIndex.positionsSorted.slice(0, upperBound(replayIndex.positionTimes, replayTime))
    : positions.filter((p) => p.date <= cutoff);
  const filteredIntervals = replayIndex
    ? replayIndex.intervalsSorted.slice(0, upperBound(replayIndex.intervalTimes, replayTime))
    : intervals.filter((i) => i.date <= cutoff);
  let filteredLaps = replayIndex
    ? replayIndex.lapsSorted.slice(0, upperBound(replayIndex.lapStartTimes, replayTime))
    : laps.filter((l) => l.date_start <= cutoff);
  let filteredLapsByDriver: Map<number, LapData[]> | null = null;
  let qualifyingPhaseStartMs: number | null = null;

  if (isQualifyingSession && raceControl) {
    let seenChequeredSinceLastStart = false;

    for (const msg of sortedRaceControl) {
      const messageTime = new Date(msg.date).getTime();
      if (messageTime > replayTime) continue;
      if (msg.flag === "CHEQUERED") {
        seenChequeredSinceLastStart = true;
      }
      if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
        if (qualifyingPhaseStartMs === null || seenChequeredSinceLastStart) {
          qualifyingPhaseStartMs = messageTime;
          seenChequeredSinceLastStart = false;
        }
      }
    }
  }

  if (replayIndex) {
    filteredLapsByDriver = new Map<number, LapData[]>();
    for (const [driverNumber, driverLaps] of replayIndex.lapsByDriverSorted) {
      const lapTimes = replayIndex.lapStartTimesByDriver.get(driverNumber) ?? [];
      const visibleCount = upperBound(lapTimes, replayTime);
      if (visibleCount === 0) continue;

      let startIndex = 0;
      if (qualifyingPhaseStartMs != null) {
        startIndex = upperBound(lapTimes, qualifyingPhaseStartMs - 1);
      }

      if (startIndex >= visibleCount) continue;

      const visible = driverLaps.slice(startIndex, visibleCount);
      if (visible.length > 0) filteredLapsByDriver.set(driverNumber, visible);
    }
    filteredLaps = [...filteredLapsByDriver.values()].flat();
  } else if (qualifyingPhaseStartMs != null) {
    filteredLaps = filteredLaps.filter((lap) => new Date(lap.date_start).getTime() >= qualifyingPhaseStartMs);
  }

  const maxLapByDriver = new Map<number, number>();
  for (const lap of filteredLaps) {
    const cur = maxLapByDriver.get(lap.driver_number) ?? 0;
    if (lap.lap_number > cur) maxLapByDriver.set(lap.driver_number, lap.lap_number);
  }

  const filteredStints = stints.filter((s) => {
    const maxLap = maxLapByDriver.get(s.driver_number) ?? 0;
    return s.lap_start != null && s.lap_start <= maxLap;
  });

  let prepared: TimingDataPreparedInput | undefined;
  if (replayIndex) {
    prepared = {
      ...replayIndex.timingPreparedBase,
      sortedPositions: filteredPositions,
      sortedIntervals: filteredIntervals,
      lapsByDriver: filteredLapsByDriver ?? replayIndex.timingPreparedBase.lapsByDriver,
    };
  }

  const entries = buildTimingData(
    drivers,
    filteredPositions,
    filteredIntervals,
    filteredStints,
    filteredLaps,
    pitStops ?? undefined,
    replayTime,
    laps,
    raceControl ?? undefined,
    prepared
  );

  if (!isQualifyingSession) return entries;

  const sorted = [...entries].sort((a, b) => {
    if (a.bestLap !== null && b.bestLap !== null) {
      return a.bestLap - b.bestLap || a.position - b.position;
    }
    if (a.bestLap !== null) return -1;
    if (b.bestLap !== null) return 1;
    return a.position - b.position;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));
}

export function filterReplayRaceControl(
  raceControl: RaceControlMessage[] | null | undefined,
  replayTime: number | null
): RaceControlMessage[] {
  if (!raceControl) return [];
  if (replayTime == null) return raceControl;
  const cutoff = new Date(replayTime).toISOString();
  return raceControl.filter((m) => m.date <= cutoff);
}
