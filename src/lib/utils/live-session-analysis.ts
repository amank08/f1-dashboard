import type { Interval, LapData, Position, RaceControlMessage, Stint, Driver, PitStop } from "@/lib/openf1/types";
import { buildTimingData, type TimingEntry } from "@/components/live/timing-board";

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
  raceControl: RaceControlMessage[] | null | undefined
): TimingEntry[] {
  if (replayTime === null) {
    return buildTimingData(drivers, positions, intervals, stints, laps, pitStops ?? undefined, replayTime, laps, raceControl ?? undefined);
  }

  const cutoff = new Date(replayTime).toISOString();
  const filteredPositions = positions.filter((p) => p.date <= cutoff);
  const filteredIntervals = intervals.filter((i) => i.date <= cutoff);
  let filteredLaps = laps.filter((l) => l.date_start <= cutoff);

  if (isQualifyingSession && raceControl) {
    let currentPhaseStart: string | null = null;
    let seenChequeredSinceLastStart = false;
    const sortedRaceControl = [...raceControl].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const msg of sortedRaceControl) {
      if (msg.date > cutoff) continue;
      if (msg.flag === "CHEQUERED") {
        seenChequeredSinceLastStart = true;
      }
      if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
        if (currentPhaseStart === null || seenChequeredSinceLastStart) {
          currentPhaseStart = msg.date;
          seenChequeredSinceLastStart = false;
        }
      }
    }

    if (currentPhaseStart) {
      filteredLaps = filteredLaps.filter((lap) => lap.date_start >= currentPhaseStart);
    }
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

  const entries = buildTimingData(
    drivers,
    filteredPositions,
    filteredIntervals,
    filteredStints,
    filteredLaps,
    pitStops ?? undefined,
    replayTime,
    laps,
    raceControl ?? undefined
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
