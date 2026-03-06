import type { LocationSample, LapData, RaceControlMessage } from "@/lib/openf1/types";

export interface ProcessedReplayData {
  byDriver: Map<number, { time: number; x: number; y: number }[]>;
  minTime: number;
  maxTime: number;
  trackPath: string;
  viewBox: string;
}

/**
 * Process raw location data into replay-ready structures.
 * Downsamples from ~3.7 Hz to ~2 Hz, normalizes coordinates to 0-100 range,
 * and extracts a reference track path from one driver's data.
 */
export function processLocationData(
  raw: LocationSample[],
  laps: LapData[],
  driverNumbers: number[]
): ProcessedReplayData {
  if (raw.length === 0) {
    return {
      byDriver: new Map(),
      minTime: 0,
      maxTime: 0,
      trackPath: "",
      viewBox: "0 0 100 100",
    };
  }

  // Group by driver
  const grouped = new Map<number, LocationSample[]>();
  for (const sample of raw) {
    let arr = grouped.get(sample.driver_number);
    if (!arr) {
      arr = [];
      grouped.set(sample.driver_number, arr);
    }
    arr.push(sample);
  }

  // Find global coordinate bounds across all samples
  let rawMinX = Infinity,
    rawMaxX = -Infinity,
    rawMinY = Infinity,
    rawMaxY = -Infinity;
  for (const sample of raw) {
    if (sample.x < rawMinX) rawMinX = sample.x;
    if (sample.x > rawMaxX) rawMaxX = sample.x;
    if (sample.y < rawMinY) rawMinY = sample.y;
    if (sample.y > rawMaxY) rawMaxY = sample.y;
  }

  // Normalize to 0-100 with 5% padding, preserving aspect ratio
  const rangeX = rawMaxX - rawMinX || 1;
  const rangeY = rawMaxY - rawMinY || 1;
  const maxRange = Math.max(rangeX, rangeY);
  const padding = 0.05;
  const scale = (1 - 2 * padding) * 100 / maxRange;
  const offsetX = padding * 100 + ((maxRange - rangeX) / 2) * scale;
  const offsetY = padding * 100 + ((maxRange - rangeY) / 2) * scale;

  function normalizeX(x: number): number {
    return (x - rawMinX) * scale + offsetX;
  }
  function normalizeY(y: number): number {
    // Flip Y axis so track renders correctly (SVG y increases downward)
    return 100 - ((y - rawMinY) * scale + offsetY);
  }

  // Process each driver: parse timestamps, sort, downsample to ~2 Hz
  const byDriver = new Map<number, { time: number; x: number; y: number }[]>();
  let globalMinTime = Infinity;
  let globalMaxTime = -Infinity;

  for (const driverNum of driverNumbers) {
    const samples = grouped.get(driverNum);
    if (!samples || samples.length === 0) continue;

    // Parse and sort by time
    const parsed = samples
      .map((s) => ({
        time: new Date(s.date).getTime(),
        x: normalizeX(s.x),
        y: normalizeY(s.y),
      }))
      .sort((a, b) => a.time - b.time);

    // Downsample to ~2 Hz (keep one sample per 500ms window)
    const downsampled: { time: number; x: number; y: number }[] = [];
    let lastKeptTime = -Infinity;
    for (const p of parsed) {
      if (p.time - lastKeptTime >= 450) {
        downsampled.push(p);
        lastKeptTime = p.time;
      }
    }

    if (downsampled.length > 0) {
      byDriver.set(driverNum, downsampled);
      if (downsampled[0].time < globalMinTime)
        globalMinTime = downsampled[0].time;
      if (downsampled[downsampled.length - 1].time > globalMaxTime)
        globalMaxTime = downsampled[downsampled.length - 1].time;
    }
  }

  // Extract track path from reference driver (the one with most samples)
  const trackPath = buildTrackPath(byDriver, laps);

  return {
    byDriver,
    minTime: globalMinTime === Infinity ? 0 : globalMinTime,
    maxTime: globalMaxTime === -Infinity ? 0 : globalMaxTime,
    trackPath,
    viewBox: "0 0 100 100",
  };
}

/**
 * Build an SVG path string from a reference driver's lap data.
 * Uses laps 2-3 if available (avoid formation lap), otherwise uses the driver
 * with the most data points.
 */
function buildTrackPath(
  byDriver: Map<number, { time: number; x: number; y: number }[]>,
  laps: LapData[]
): string {
  // Find the driver with the most samples as reference
  let refDriver = 0;
  let maxSamples = 0;
  for (const [driverNum, samples] of byDriver) {
    if (samples.length > maxSamples) {
      maxSamples = samples.length;
      refDriver = driverNum;
    }
  }

  const refSamples = byDriver.get(refDriver);
  if (!refSamples || refSamples.length === 0) return "";

  // Try to find lap 2-3 time boundaries for cleaner track outline
  const refLaps = laps
    .filter((l) => l.driver_number === refDriver)
    .sort((a, b) => a.lap_number - b.lap_number);

  let startTime: number | undefined;
  let endTime: number | undefined;

  if (refLaps.length >= 3) {
    const lap2 = refLaps.find((l) => l.lap_number === 2);
    const lap3 = refLaps.find((l) => l.lap_number === 3);
    const lap4 = refLaps.find((l) => l.lap_number === 4);
    if (lap2?.date_start) startTime = new Date(lap2.date_start).getTime();
    if (lap4?.date_start) {
      endTime = new Date(lap4.date_start).getTime();
    } else if (lap3?.date_start && lap3?.lap_duration) {
      endTime =
        new Date(lap3.date_start).getTime() + lap3.lap_duration * 1000;
    }
  }

  // Filter to reference lap range, or use first ~120 seconds of data
  let pathSamples: { x: number; y: number }[];
  if (startTime && endTime) {
    pathSamples = refSamples.filter(
      (s) => s.time >= startTime! && s.time <= endTime!
    );
  } else {
    // Fallback: use first ~120s
    const cutoff = refSamples[0].time + 120_000;
    pathSamples = refSamples.filter((s) => s.time <= cutoff);
  }

  if (pathSamples.length < 2) {
    pathSamples = refSamples.slice(0, Math.min(refSamples.length, 500));
  }

  // Build SVG path
  const parts = [`M ${pathSamples[0].x.toFixed(2)} ${pathSamples[0].y.toFixed(2)}`];
  for (let i = 1; i < pathSamples.length; i++) {
    parts.push(
      `L ${pathSamples[i].x.toFixed(2)} ${pathSamples[i].y.toFixed(2)}`
    );
  }
  parts.push("Z"); // Close path for circuit loop

  return parts.join(" ");
}

/**
 * Binary search to find each driver's position at a given timestamp.
 * Returns interpolated positions for smooth animation.
 */
export function getFrameAtTime(
  processedData: ProcessedReplayData,
  timestamp: number
): Map<number, { x: number; y: number }> {
  const result = new Map<number, { x: number; y: number }>();

  for (const [driverNum, samples] of processedData.byDriver) {
    if (samples.length === 0) continue;

    // Binary search for the closest sample at or before timestamp
    let lo = 0;
    let hi = samples.length - 1;

    if (timestamp <= samples[0].time) {
      result.set(driverNum, { x: samples[0].x, y: samples[0].y });
      continue;
    }
    if (timestamp >= samples[hi].time) {
      result.set(driverNum, { x: samples[hi].x, y: samples[hi].y });
      continue;
    }

    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].time <= timestamp) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    // Interpolate between lo and hi for smooth movement
    const a = samples[lo];
    const b = samples[hi];
    const dt = b.time - a.time;
    if (dt === 0) {
      result.set(driverNum, { x: a.x, y: a.y });
    } else {
      const t = (timestamp - a.time) / dt;
      result.set(driverNum, {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
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
