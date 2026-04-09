import type {
  LapData,
  Position,
  RaceControlMessage,
  ReplaySnapshot,
} from "@/lib/openf1/types";

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

export interface ReplayTimingSnapshot {
  position: number;
  driverNumber: number;
  currentLap: number;
}

export interface QualifyingResultSnapshot {
  position: number;
  driverNumber: number;
}

export interface QualifyingCutoffs {
  q1CutoffTime: number | null;
  q2CutoffTime: number | null;
  segmentTimes: Map<number, number>;
  driverLastSeg: Map<number, number>;
  q2KnockoutPos: number | null;
  q1KnockoutPos: number | null;
  segBests: Map<number, number>[];
  segCount: number;
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

export function getRetiredDrivers(
  replayTimingEntries: ReplayTimingSnapshot[],
  laps: LapData[],
  replayTime: number | null,
  isQualifyingSession: boolean,
  raceControl: RaceControlMessage[],
  positions: Position[]
): Map<number, string> {
  const map = new Map<number, string>();
  if (replayTimingEntries.length === 0) return map;

  if (isQualifyingSession && replayTime != null) {
    const cutoff = new Date(replayTime).toISOString();
    const finishedTimes: number[] = [];

    for (const msg of raceControl) {
      if (msg.date > cutoff) continue;
      if (msg.category === "SessionStatus" && msg.message === "SESSION FINISHED") {
        finishedTimes.push(new Date(msg.date).getTime() + 90_000);
      }
    }

    const q1EndTime = finishedTimes[0] ?? null;
    const q2EndTime = finishedTimes[1] ?? null;

    const positionsAt = (time: number): Map<number, number> => {
      const latest = new Map<number, { pos: number; date: number }>();
      for (const p of positions) {
        const t = new Date(p.date).getTime();
        if (t > time) continue;
        const prev = latest.get(p.driver_number);
        if (!prev || t > prev.date) {
          latest.set(p.driver_number, { pos: p.position, date: t });
        }
      }
      return new Map([...latest].map(([dn, v]) => [dn, v.pos]));
    };

    if (q1EndTime && replayTime >= q1EndTime) {
      const noData = replayTimingEntries.filter(
        (e) => !positions.some((p) => p.driver_number === e.driverNumber)
      );
      for (const e of noData) map.set(e.driverNumber, "Q1");
      const q1Pos = positionsAt(q1EndTime);
      const sorted = [...q1Pos.entries()].sort((a, b) => a[1] - b[1]);
      const remaining = Math.max(0, 6 - noData.length);
      for (const [dn] of sorted.slice(-remaining)) map.set(dn, "Q1");
    }

    if (q2EndTime && replayTime >= q2EndTime) {
      const q2Pos = positionsAt(q2EndTime);
      const remaining = [...q2Pos.entries()]
        .filter(([dn]) => !map.has(dn))
        .sort((a, b) => a[1] - b[1]);
      for (const [dn] of remaining.slice(-6)) {
        map.set(dn, "Q2");
      }
    }

    return map;
  }

  const leaderEntry = replayTimingEntries.find((e) => e.position === 1);
  const leaderLap = leaderEntry?.currentLap ?? 0;
  const dnfThreshold = Math.floor(leaderLap * 0.9);
  if (leaderLap <= 2) return map;

  const latestLapStart = new Map<number, number>();
  if (replayTime != null) {
    for (const l of laps) {
      const t = new Date(l.date_start).getTime();
      if (t <= replayTime) {
        const prev = latestLapStart.get(l.driver_number) ?? 0;
        if (t > prev) latestLapStart.set(l.driver_number, t);
      }
    }
  }

  for (const e of replayTimingEntries) {
    if (map.has(e.driverNumber)) continue;
    if (!positions.some((p) => p.driver_number === e.driverNumber)) {
      map.set(e.driverNumber, "DNS");
      continue;
    }
    if (e.position === 1) continue;
    if (e.currentLap >= dnfThreshold) continue;
    const lastStart = latestLapStart.get(e.driverNumber);
    if (replayTime != null && lastStart != null) {
      const staleness = replayTime - lastStart;
      if (staleness < 180_000) continue;
    }
    map.set(e.driverNumber, "OUT");
  }

  return map;
}

export function getQualifyingCutoffs(
  validLaps: LapData[],
  laps: LapData[],
  raceControl: RaceControlMessage[],
  resultRows: QualifyingResultSnapshot[]
): QualifyingCutoffs | undefined {
  if (resultRows.length === 0) return undefined;

  const segments: { start: string; end: string }[] = [];
  let pendingStart: string | null = null;
  for (const msg of raceControl) {
    if (msg.message === "SESSION STARTED" && pendingStart === null) {
      pendingStart = msg.date;
    }
    if (msg.message === "CHEQUERED FLAG" && pendingStart !== null) {
      segments.push({ start: pendingStart, end: msg.date });
      pendingStart = null;
    }
  }

  const segCount = Math.min(segments.length, 3);
  if (segCount < 2) return undefined;

  const starts = segments.map((s) => s.start);
  const ends = segments.map((s) => s.end);

  function bestInSegment(
    segStart: string,
    segEnd: string,
    nextSegStart?: string
  ): Map<number, number> {
    const best = new Map<number, number>();
    let segFastest = Infinity;
    const boundary = nextSegStart ?? segEnd;

    for (const lap of validLaps) {
      if (!lap.lap_duration || lap.is_pit_out_lap) continue;
      if (
        lap.date_start >= segStart &&
        lap.date_start < boundary &&
        lap.lap_duration < segFastest
      ) {
        segFastest = lap.lap_duration;
      }
    }

    const segThreshold = isFinite(segFastest) ? segFastest * 1.07 : Infinity;
    for (const lap of validLaps) {
      if (!lap.lap_duration || lap.is_pit_out_lap) continue;
      if (lap.lap_duration > segThreshold) continue;
      if (lap.date_start >= segStart && lap.date_start < boundary) {
        const cur = best.get(lap.driver_number);
        if (!cur || lap.lap_duration < cur) {
          best.set(lap.driver_number, lap.lap_duration);
        }
      }
    }

    return best;
  }

  const segBests: Map<number, number>[] = [];
  for (let i = 0; i < segCount; i++) {
    segBests.push(bestInSegment(starts[i], ends[i], starts[i + 1]));
  }

  const driverLastSeg = new Map<number, number>();
  for (const row of resultRows) {
    for (let s = segCount - 1; s >= 0; s--) {
      const segStart = starts[s];
      const boundary = starts[s + 1] ?? ends[s];
      const hasLap = laps.some(
        (l) =>
          l.driver_number === row.driverNumber &&
          l.date_start >= segStart &&
          l.date_start < boundary
      );
      if (hasLap) {
        driverLastSeg.set(row.driverNumber, s);
        break;
      }
    }
  }

  const advancement = [15, 10];
  for (let s = 0; s < segCount - 1; s++) {
    const times = [...segBests[s].entries()].sort((a, b) => a[1] - b[1]);
    const advanceCount = advancement[s] ?? 10;
    const advancedDrivers = times.slice(0, advanceCount).map(([dNum]) => dNum);
    for (const dNum of advancedDrivers) {
      const cur = driverLastSeg.get(dNum);
      if (cur === undefined || cur <= s) {
        driverLastSeg.set(dNum, s + 1);
      }
    }
  }

  for (const row of resultRows) {
    if (!driverLastSeg.has(row.driverNumber)) {
      driverLastSeg.set(row.driverNumber, 0);
    }
  }

  const segmentTimes = new Map<number, number>();
  for (const row of resultRows) {
    const seg = driverLastSeg.get(row.driverNumber);
    if (seg != null) {
      const t = segBests[seg].get(row.driverNumber);
      if (t != null) segmentTimes.set(row.driverNumber, t);
    }
  }

  const sortedByPos = [...resultRows].sort((a, b) => a.position - b.position);
  let q2KnockoutPos: number | null = null;
  let q1KnockoutPos: number | null = null;
  for (const row of sortedByPos) {
    const seg = driverLastSeg.get(row.driverNumber);
    if (seg === segCount - 2 && q2KnockoutPos === null) {
      q2KnockoutPos = row.position;
    }
    if (seg === 0 && q1KnockoutPos === null && segCount >= 2) {
      q1KnockoutPos = row.position;
    }
  }

  let q2CutoffTime: number | null = null;
  let q1CutoffTime: number | null = null;

  if (segCount >= 3) {
    let worstQ2ofQ3 = -Infinity;
    for (const [dNum, seg] of driverLastSeg) {
      if (seg === segCount - 1) {
        const q2Time = segBests[segCount - 2].get(dNum);
        if (q2Time != null && q2Time > worstQ2ofQ3) worstQ2ofQ3 = q2Time;
      }
    }
    if (worstQ2ofQ3 > 0) q2CutoffTime = worstQ2ofQ3;
  }

  if (segCount >= 2) {
    let worstQ1ofQ2 = -Infinity;
    for (const [dNum, seg] of driverLastSeg) {
      if (seg >= 1) {
        const q1Time = segBests[0].get(dNum);
        if (q1Time != null && q1Time > worstQ1ofQ2) worstQ1ofQ2 = q1Time;
      }
    }
    if (worstQ1ofQ2 > 0) q1CutoffTime = worstQ1ofQ2;
  }

  return {
    q1CutoffTime,
    q2CutoffTime,
    segmentTimes,
    driverLastSeg,
    q2KnockoutPos,
    q1KnockoutPos,
    segBests,
    segCount,
  };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
