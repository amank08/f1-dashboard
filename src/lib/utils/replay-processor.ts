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
  /** Red flag pause intervals within this phase (SESSION ABORTED → SESSION STARTED). */
  pauses: Array<{ from: number; to: number }>;
}

/**
 * Build session phases from race control messages.
 * Qualifying has 3 phases (Q1/Q2/Q3), practice has 1 phase.
 * Phases are delimited by the first SESSION STARTED (per phase) and CHEQUERED FLAG.
 * Red flag pauses (SESSION ABORTED → SESSION STARTED) are collected per phase.
 */
export function buildSessionPhases(
  raceControl: RaceControlMessage[],
  sessionType: string
): SessionPhase[] {
  const sorted = [...raceControl].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Build phase boundaries: each phase starts at the first SESSION STARTED
  // after the previous CHEQUERED FLAG (red-flag resumptions are not phase starts).
  // Pauses within a phase are SESSION ABORTED → next SESSION STARTED pairs.
  const buildPhase = (label: string, start: number, end: number): SessionPhase => {
    const pauses: Array<{ from: number; to: number }> = [];
    for (const msg of sorted) {
      const t = new Date(msg.date).getTime();
      if (t <= start || t >= end) continue;
      if (msg.category === "SessionStatus" && msg.message === "SESSION ABORTED") {
        const resumeMsg = sorted.find(
          (m) =>
            new Date(m.date).getTime() > t &&
            new Date(m.date).getTime() <= end &&
            m.category === "SessionStatus" &&
            m.message === "SESSION STARTED"
        );
        if (resumeMsg) {
          pauses.push({ from: t, to: new Date(resumeMsg.date).getTime() });
        }
      }
    }
    return { label, start, end, pauses };
  };

  const isQualifying = sessionType === "Qualifying";
  const isSprintQualifying = sessionType === "Sprint Qualifying";

  if (isQualifying || isSprintQualifying) {
    const prefix = isSprintQualifying ? "SQ" : "Q";
    const phases: SessionPhase[] = [];
    let searchAfter = 0;
    let phaseNum = 1;

    for (const msg of sorted) {
      if (phases.length >= 3) break;
      const t = new Date(msg.date).getTime();
      if (msg.flag === "CHEQUERED" && t > searchAfter) {
        // Find the first SESSION STARTED that begins this phase
        const startMsg = sorted.find(
          (m) =>
            new Date(m.date).getTime() > searchAfter &&
            new Date(m.date).getTime() < t &&
            m.category === "SessionStatus" &&
            m.message === "SESSION STARTED"
        );
        if (startMsg) {
          phases.push(buildPhase(`${prefix}${phaseNum++}`, new Date(startMsg.date).getTime(), t));
          searchAfter = t;
        }
      }
    }
    return phases;
  }

  // Practice or other: single phase
  const firstStart = sorted.find(
    (m) => m.category === "SessionStatus" && m.message === "SESSION STARTED"
  );
  const firstEnd = sorted.find((m) => m.flag === "CHEQUERED");
  if (firstStart && firstEnd) {
    return [buildPhase("Session", new Date(firstStart.date).getTime(), new Date(firstEnd.date).getTime())];
  }

  return [];
}

/**
 * Get the status label for the current time based on session phases.
 * Returns a countdown e.g. "Q1 — 05:30" while active.
 * Holds at "Q1 — 00:00" until all drivers complete their flying lap after the
 * chequered flag, then transitions to "Break" or "Session ended".
 */
export function getPhaseLabel(
  currentTime: number,
  phases: SessionPhase[],
  laps?: LapData[]
): string {
  if (phases.length === 0) return "";

  // Active phase: count down to chequered, freezing during red flag pauses
  for (const phase of phases) {
    if (currentTime >= phase.start && currentTime <= phase.end) {
      const prefix = phase.label !== "Session" ? `${phase.label} — ` : "";
      // If currently in a red flag pause, freeze at the abort time
      const activePause = phase.pauses.find(
        (p) => currentTime >= p.from && currentTime < p.to
      );
      const activeTime = activePause ? activePause.from : currentTime;
      // Subtract durations of pauses that haven't started yet (from activeTime onward)
      const pauseAfter = phase.pauses
        .filter((p) => p.from >= activeTime)
        .reduce((sum, p) => sum + (p.to - p.from), 0);
      const remaining = phase.end - activeTime - pauseAfter;
      return `${prefix}${formatMs(remaining)}`;
    }
  }

  // Just after chequered: hold at 00:00 while any flying lap is still running
  if (laps) {
    for (const phase of phases) {
      if (currentTime > phase.end) {
        const anyStillRunning = laps.some((l) => {
          if (!l.lap_duration || l.is_pit_out_lap) return false;
          const lapStart = new Date(l.date_start).getTime();
          if (lapStart < phase.start || lapStart >= phase.end) return false;
          return lapStart + l.lap_duration * 1000 > currentTime;
        });
        if (anyStillRunning) {
          const prefix = phase.label !== "Session" ? `${phase.label} — ` : "";
          return `${prefix}00:00`;
        }
      }
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

export function getQualifyingKnockoutPosition(
  raceControl: RaceControlMessage[],
  replayTime: number | null
): number | undefined {
  if (replayTime == null) return undefined;

  const cutoff = new Date(replayTime).toISOString();
  let phasesStarted = 0;
  let seenChequeredSinceLastStart = false;

  const sorted = [...raceControl]
    .filter((m) => m.date <= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const msg of sorted) {
    if (msg.flag === "CHEQUERED") seenChequeredSinceLastStart = true;
    if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
      if (phasesStarted === 0 || seenChequeredSinceLastStart) {
        phasesStarted++;
        seenChequeredSinceLastStart = false;
      }
    }
  }

  if (phasesStarted === 1) return 16;
  if (phasesStarted === 2) return 10;
  return undefined;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
