import type { LapData, RaceControlMessage, ReplaySnapshot } from "@/lib/openf1/types";

/**
 * Binary-search each driver's parallel-array track in a `ReplaySnapshot`
 * for their interpolated (x, y) position at `timestamp`. The snapshot is
 * produced server-side (see `buildReplaySnapshot`) so this is the only
 * per-frame work the client has to do.
 */
export function getFrameAtTime(
  snapshot: ReplaySnapshot,
  timestamp: number
): Map<number, { x: number; y: number }> {
  const result = new Map<number, { x: number; y: number }>();

  for (const [numStr, track] of Object.entries(snapshot.drivers)) {
    const { t, x, y } = track;
    const n = t.length;
    if (n === 0) continue;
    const driverNum = Number(numStr);

    if (timestamp <= t[0]) {
      result.set(driverNum, { x: x[0], y: y[0] });
      continue;
    }
    if (timestamp >= t[n - 1]) {
      result.set(driverNum, { x: x[n - 1], y: y[n - 1] });
      continue;
    }

    let lo = 0;
    let hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= timestamp) lo = mid;
      else hi = mid;
    }

    const dt = t[hi] - t[lo];
    if (dt === 0) {
      result.set(driverNum, { x: x[lo], y: y[lo] });
    } else {
      const f = (timestamp - t[lo]) / dt;
      result.set(driverNum, {
        x: x[lo] + (x[hi] - x[lo]) * f,
        y: y[lo] + (y[hi] - y[lo]) * f,
      });
    }
  }

  return result;
}

/**
 * Determine current lap number from lap date_start timestamps.
 */
export function getLapAtTime(
  timestamp: number,
  laps: LapData[]
): { currentLap: number; totalLaps: number } {
  if (laps.length === 0) return { currentLap: 0, totalLaps: 0 };

  // Get unique lap numbers sorted, using the earliest date_start per lap
  const lapStarts = new Map<number, number>();
  for (const lap of laps) {
    if (!lap.date_start) continue;
    const t = new Date(lap.date_start).getTime();
    const existing = lapStarts.get(lap.lap_number);
    if (existing === undefined || t < existing) {
      lapStarts.set(lap.lap_number, t);
    }
  }

  const sortedLaps = [...lapStarts.entries()].sort((a, b) => a[1] - b[1]);
  const totalLaps = sortedLaps.length > 0 ? sortedLaps[sortedLaps.length - 1][0] : 0;

  let currentLap = 0;
  for (const [lapNum, lapTime] of sortedLaps) {
    if (timestamp >= lapTime) {
      currentLap = lapNum;
    } else {
      break;
    }
  }

  return { currentLap, totalLaps };
}

// --- Session phase detection ---

export interface SessionPhase {
  label: string;   // "Q1", "Q2", "Q3", "SQ1", "SQ2", "SQ3", "Session"
  start: number;   // ms timestamp
  end: number;     // ms timestamp
}

/**
 * Build session phases from race control messages.
 * Qualifying has 3 phases (Q1/Q2/Q3), practice has 1 phase.
 * Phases are delimited by SESSION STARTED / CHEQUERED FLAG pairs.
 */
export function buildSessionPhases(
  raceControl: RaceControlMessage[],
  sessionType: string
): SessionPhase[] {
  // Find all SESSION STARTED and CHEQUERED FLAG timestamps in order
  const starts: number[] = [];
  const ends: number[] = [];

  const sorted = [...raceControl].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const msg of sorted) {
    if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
      starts.push(new Date(msg.date).getTime());
    }
    if (msg.flag === "CHEQUERED") {
      ends.push(new Date(msg.date).getTime());
    }
  }

  const isQualifying = sessionType === "Qualifying";
  const isSprintQualifying = sessionType === "Sprint Qualifying";

  if (isQualifying || isSprintQualifying) {
    const prefix = isSprintQualifying ? "SQ" : "Q";
    const phases: SessionPhase[] = [];
    const count = Math.min(starts.length, ends.length, 3);
    for (let i = 0; i < count; i++) {
      phases.push({
        label: `${prefix}${i + 1}`,
        start: starts[i],
        end: ends[i],
      });
    }
    return phases;
  }

  // Practice or other: single phase
  if (starts.length > 0 && ends.length > 0) {
    return [{ label: "Session", start: starts[0], end: ends[0] }];
  }

  return [];
}

/**
 * Get the status label for the current time based on session phases.
 * Returns e.g. "Q1 — 12:30 / 18:00" or "28:15 / 60:00"
 */
export function getPhaseLabel(
  currentTime: number,
  phases: SessionPhase[]
): string {
  if (phases.length === 0) return "";

  for (const phase of phases) {
    if (currentTime >= phase.start && currentTime <= phase.end) {
      const elapsed = currentTime - phase.start;
      const duration = phase.end - phase.start;
      const prefix = phase.label !== "Session" ? `${phase.label} — ` : "";
      return `${prefix}${formatMs(elapsed)} / ${formatMs(duration)}`;
    }
  }

  // Between phases (qualifying break)
  for (let i = 0; i < phases.length - 1; i++) {
    if (currentTime > phases[i].end && currentTime < phases[i + 1].start) {
      return "Break";
    }
  }

  // Before first phase or after last phase
  if (currentTime < phases[0].start) {
    return "Pre-session";
  }
  return "Session ended";
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
