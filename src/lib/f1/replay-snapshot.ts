/**
 * Build a compact, pre-processed replay payload from raw F1 archive samples.
 *
 * The live-timing archive is huge (~75 MB of JSON per race) and the client
 * would otherwise parse, group, sort, downsample, and normalize it on every
 * page load. We do all of that server-side once, cache the result, and ship
 * ~2 MB of parallel arrays the browser can feed straight into
 * `getFrameAtTime`.
 */
import type {
  LapData,
  LocationSample,
  ReplayDriverTrack,
  ReplaySnapshot,
} from "@/lib/openf1/types";

/** Target sample spacing after downsample (ms). ~2 Hz. */
const DOWNSAMPLE_MS = 450;

/**
 * Pre-process raw `LocationSample[]` into a `ReplaySnapshot`. `laps` is
 * optional: if provided, the reference lap window (lap 2–3) is used to
 * trace the track outline; otherwise we fall back to the first ~120 s of
 * the reference driver's data.
 */
export function buildReplaySnapshot(
  raw: LocationSample[],
  laps?: LapData[]
): ReplaySnapshot {
  if (raw.length === 0) {
    return {
      minTime: 0,
      maxTime: 0,
      trackPath: "",
      viewBox: "0 0 100 100",
      drivers: {},
    };
  }

  // Global coordinate bounds for normalization.
  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  let rawMinY = Infinity;
  let rawMaxY = -Infinity;
  for (const s of raw) {
    if (s.x < rawMinX) rawMinX = s.x;
    if (s.x > rawMaxX) rawMaxX = s.x;
    if (s.y < rawMinY) rawMinY = s.y;
    if (s.y > rawMaxY) rawMaxY = s.y;
  }
  const rangeX = rawMaxX - rawMinX || 1;
  const rangeY = rawMaxY - rawMinY || 1;
  const maxRange = Math.max(rangeX, rangeY);
  const padding = 0.05;
  const scale = ((1 - 2 * padding) * 100) / maxRange;
  const offsetX = padding * 100 + ((maxRange - rangeX) / 2) * scale;
  const offsetY = padding * 100 + ((maxRange - rangeY) / 2) * scale;
  const nx = (x: number) => (x - rawMinX) * scale + offsetX;
  // SVG y grows downward → flip so the track renders right-side-up.
  const ny = (y: number) => 100 - ((y - rawMinY) * scale + offsetY);

  // Group by driver.
  const grouped = new Map<number, LocationSample[]>();
  for (const s of raw) {
    let arr = grouped.get(s.driver_number);
    if (!arr) {
      arr = [];
      grouped.set(s.driver_number, arr);
    }
    arr.push(s);
  }

  const drivers: Record<string, ReplayDriverTrack> = {};
  let globalMin = Infinity;
  let globalMax = -Infinity;
  // Reference driver = one with the largest coordinate spread (i.e. who
  // actually drove the most track). Choosing by sample count alone is
  // dangerous: a DNS/garage driver whose telemetry is stuck at one spot
  // can have more samples than anyone who raced (CHN 2026 had a driver
  // with 14,949 stationary samples at (6.5, 95) — picking them as the
  // reference collapsed the track outline to a dot).
  let refNum = 0;
  let refSpread = -Infinity;

  for (const [num, samples] of grouped) {
    samples.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const t: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    let lastKept = -Infinity;
    let dMinX = Infinity;
    let dMaxX = -Infinity;
    let dMinY = Infinity;
    let dMaxY = -Infinity;
    for (const s of samples) {
      const ts = new Date(s.date).getTime();
      if (ts - lastKept >= DOWNSAMPLE_MS) {
        t.push(ts);
        // Round to 2 decimals to shrink JSON further (1 cm precision on a
        // 100-unit viewBox — well beyond what pixels can show).
        const vx = Math.round(nx(s.x) * 100) / 100;
        const vy = Math.round(ny(s.y) * 100) / 100;
        x.push(vx);
        y.push(vy);
        if (vx < dMinX) dMinX = vx;
        if (vx > dMaxX) dMaxX = vx;
        if (vy < dMinY) dMinY = vy;
        if (vy > dMaxY) dMaxY = vy;
        lastKept = ts;
      }
    }
    if (t.length === 0) continue;
    drivers[String(num)] = { t, x, y };
    if (t[0] < globalMin) globalMin = t[0];
    if (t[t.length - 1] > globalMax) globalMax = t[t.length - 1];
    const spread = Math.max(dMaxX - dMinX, dMaxY - dMinY);
    if (spread > refSpread) {
      refSpread = spread;
      refNum = num;
    }
  }

  const trackPath = buildTrackPath(drivers[String(refNum)], laps, refNum);

  return {
    minTime: globalMin === Infinity ? 0 : globalMin,
    maxTime: globalMax === -Infinity ? 0 : globalMax,
    trackPath,
    viewBox: "0 0 100 100",
    drivers,
  };
}

/**
 * Trace a clean lap outline from the reference driver. Uses lap 2→4 (or
 * lap 3's duration) if available to skip formation-lap jitter; otherwise
 * uses the first 120 s of data.
 */
function buildTrackPath(
  ref: ReplayDriverTrack | undefined,
  laps: LapData[] | undefined,
  refDriverNum: number
): string {
  if (!ref || ref.t.length < 2) return "";

  let startIdx = 0;
  let endIdx = ref.t.length;
  let used = false;

  if (laps && laps.length > 0) {
    const refLaps = laps
      .filter((l) => l.driver_number === refDriverNum)
      .sort((a, b) => a.lap_number - b.lap_number);
    const lap2 = refLaps.find((l) => l.lap_number === 2);
    const lap3 = refLaps.find((l) => l.lap_number === 3);
    const lap4 = refLaps.find((l) => l.lap_number === 4);
    let start: number | undefined;
    let end: number | undefined;
    if (lap2?.date_start) start = new Date(lap2.date_start).getTime();
    if (lap4?.date_start) {
      end = new Date(lap4.date_start).getTime();
    } else if (lap3?.date_start && lap3?.lap_duration) {
      end = new Date(lap3.date_start).getTime() + lap3.lap_duration * 1000;
    }
    if (start !== undefined && end !== undefined && end > start) {
      const si = ref.t.findIndex((t) => t >= start!);
      const ei = ref.t.findIndex((t) => t >= end!);
      if (si >= 0 && ei > si) {
        startIdx = si;
        endIdx = ei;
        used = true;
      }
    }
  }

  if (!used) {
    // Skip forward until the reference driver has actually moved away from
    // their first sample — for a race that's the grid/formation period,
    // for practice/qualifying it's the garage. Without this the outline
    // collapses to a tiny blob around the pit box. Once the driver is
    // clearly on track we trace the next ~500 samples (~250 s of driving),
    // guaranteed to contain >1 full lap on any circuit so the closed SVG
    // path covers the whole track.
    const x0 = ref.x[0];
    const y0 = ref.y[0];
    const MOVE_THRESHOLD = 15; // viewBox units (viewBox is 100×100)
    let moveIdx = 0;
    for (let i = 1; i < ref.x.length; i++) {
      const dx = ref.x[i] - x0;
      const dy = ref.y[i] - y0;
      if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
        moveIdx = i;
        break;
      }
    }
    startIdx = moveIdx;
    endIdx = Math.min(ref.x.length, startIdx + 500);
  }

  if (endIdx - startIdx < 2) return "";

  const parts: string[] = [
    `M ${ref.x[startIdx].toFixed(2)} ${ref.y[startIdx].toFixed(2)}`,
  ];
  for (let i = startIdx + 1; i < endIdx; i++) {
    parts.push(`L ${ref.x[i].toFixed(2)} ${ref.y[i].toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
