/**
 * Build a compact, pre-processed replay payload from raw F1 archive samples.
 *
 * The live-timing archive is huge (~75 MB of JSON per race) and the client
 * would otherwise parse, group, sort, downsample, and normalize it on every
 * page load. We do all of that server-side once, cache the result, and ship
 * ~2 MB of parallel arrays the browser can feed straight into
 * `getFrameAtTime`.
 *
 * Track outline comes from MultiViewer's authoritative circuit geometry
 * when available — tracing the outline from telemetry is unreliable (DNS
 * drivers with stuck-at-pit samples, formation-lap jitter, missing laps
 * metadata). MV's x/y share F1's native coordinate system with the
 * telemetry feed, so we rotate both with the same angle and normalize to
 * a shared viewBox to keep driver dots aligned with the drawn track.
 */
import type {
  LocationSample,
  ReplayDriverTrack,
  ReplaySnapshot,
} from "@/lib/openf1/types";
import {
  findSfOffsetRatio,
  getSectorRatios,
} from "@/lib/utils/sector-ratios";

/** Target sample spacing after downsample (ms). ~2 Hz. */
const DOWNSAMPLE_MS = 450;

export interface CircuitGeometry {
  /** MultiViewer circuit x samples in F1 native coords. */
  x: number[];
  /** MultiViewer circuit y samples in F1 native coords. */
  y: number[];
  /** MV rotation in degrees. Applied as `(rotation - 180)` around the origin. */
  rotation: number;
}

/**
 * Pre-process raw `LocationSample[]` into a `ReplaySnapshot`.
 *
 * When `circuit` is provided (MultiViewer geometry), the track outline is
 * drawn from its authoritative points and both the outline and telemetry
 * samples share the same rotation + viewBox normalization. Without it we
 * fall back to normalizing from the telemetry bounding box and leaving
 * the outline empty (the map still renders driver dots).
 */
export function buildReplaySnapshot(
  raw: LocationSample[],
  circuit?: CircuitGeometry,
  circuitShortName?: string
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

  // Rotation: MultiViewer stores circuit rotation in degrees and F1's
  // convention is `(rotation - 180)` around the origin with SVG y flipped.
  // When no MV data is available we fall back to a straight y-flip (angle
  // 0 after the -180 offset ⇒ negate y) so at least the telemetry renders
  // right-side-up.
  const angleDeg = circuit ? circuit.rotation - 180 : -180;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = (px: number, py: number) => ({
    x: px * cos - py * sin,
    y: -(px * sin + py * cos),
  });

  // Rotate circuit outline (if any) and collect bounds. Prefer computing
  // bounds from the MV outline: it's a clean closed lap, whereas telemetry
  // often includes pit-lane excursions that stretch the bbox.
  let rotatedCircuit: { x: number; y: number }[] | null = null;
  let boundsMinX = Infinity;
  let boundsMaxX = -Infinity;
  let boundsMinY = Infinity;
  let boundsMaxY = -Infinity;

  if (circuit && circuit.x.length > 0) {
    rotatedCircuit = circuit.x.map((cx, i) => rotate(cx, circuit.y[i]));
    for (const p of rotatedCircuit) {
      if (p.x < boundsMinX) boundsMinX = p.x;
      if (p.x > boundsMaxX) boundsMaxX = p.x;
      if (p.y < boundsMinY) boundsMinY = p.y;
      if (p.y > boundsMaxY) boundsMaxY = p.y;
    }
  } else {
    // No MV data — bound from telemetry itself (rotated the same way).
    for (const s of raw) {
      const p = rotate(s.x, s.y);
      if (p.x < boundsMinX) boundsMinX = p.x;
      if (p.x > boundsMaxX) boundsMaxX = p.x;
      if (p.y < boundsMinY) boundsMinY = p.y;
      if (p.y > boundsMaxY) boundsMaxY = p.y;
    }
  }

  const rangeX = boundsMaxX - boundsMinX || 1;
  const rangeY = boundsMaxY - boundsMinY || 1;
  const maxRange = Math.max(rangeX, rangeY);
  const padding = 0.05;
  const scale = ((1 - 2 * padding) * 100) / maxRange;
  const offsetX = padding * 100 + ((maxRange - rangeX) / 2) * scale;
  const offsetY = padding * 100 + ((maxRange - rangeY) / 2) * scale;
  const project = (px: number, py: number) => ({
    x: (px - boundsMinX) * scale + offsetX,
    y: (py - boundsMinY) * scale + offsetY,
  });

  // Group telemetry by driver.
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

  for (const [num, samples] of grouped) {
    samples.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const t: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    let lastKept = -Infinity;
    for (const s of samples) {
      const ts = new Date(s.date).getTime();
      if (ts - lastKept >= DOWNSAMPLE_MS) {
        const r = rotate(s.x, s.y);
        const p = project(r.x, r.y);
        t.push(ts);
        // Round to 2 decimals — 1 cm precision on a 100-unit viewBox is
        // well beyond sub-pixel.
        x.push(Math.round(p.x * 100) / 100);
        y.push(Math.round(p.y * 100) / 100);
        lastKept = ts;
      }
    }
    if (t.length === 0) continue;
    drivers[String(num)] = { t, x, y };
    if (t[0] < globalMin) globalMin = t[0];
    if (t[t.length - 1] > globalMax) globalMax = t[t.length - 1];
  }

  // Build the outline path + sector splits + S/F tick from the (rotated,
  // projected) MV circuit — mirrors the logic used by the static circuit
  // map on the calendar/results views so the replay matches visually.
  let trackPath = "";
  let sectors: [string, string, string] | undefined;
  let sfLine: ReplaySnapshot["sfLine"];

  if (rotatedCircuit && rotatedCircuit.length > 1) {
    const projected = rotatedCircuit.map((p) => project(p.x, p.y));
    const nPoints = projected.length;

    const parts: string[] = [];
    for (let i = 0; i < nPoints; i++) {
      const cmd = i === 0 ? "M" : "L";
      parts.push(
        `${cmd} ${projected[i].x.toFixed(2)} ${projected[i].y.toFixed(2)}`
      );
    }
    parts.push("Z");
    trackPath = parts.join(" ");

    // Arc length along the closed lap.
    const cumulative: number[] = [0];
    for (let i = 1; i < nPoints; i++) {
      const dx = projected[i].x - projected[i - 1].x;
      const dy = projected[i].y - projected[i - 1].y;
      cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
    }
    const totalLen = cumulative[cumulative.length - 1];

    const ratios = circuitShortName ? getSectorRatios(circuitShortName) : null;
    const sfRatio = circuitShortName
      ? findSfOffsetRatio(circuitShortName, projected) ?? 0
      : 0;
    const sfDist = sfRatio * totalLen;

    const indexAtDist = (dist: number): number => {
      const d = ((dist % totalLen) + totalLen) % totalLen;
      for (let i = 0; i < nPoints; i++) {
        if (cumulative[i] >= d) return i;
      }
      return nPoints - 1;
    };

    const s1EndDist = sfDist + (ratios ? ratios.s1End : 1 / 3) * totalLen;
    const s2EndDist = sfDist + (ratios ? ratios.s2End : 2 / 3) * totalLen;
    const sfIdx = indexAtDist(sfDist);
    const s1EndIdx = indexAtDist(s1EndDist);
    const s2EndIdx = indexAtDist(s2EndDist);

    const buildWrappedPath = (start: number, end: number): string => {
      const segParts: string[] = [];
      let i = start;
      segParts.push(
        `${projected[i].x.toFixed(2)},${projected[i].y.toFixed(2)}`
      );
      for (let guard = 0; guard <= nPoints; guard++) {
        if (i === end) break;
        i = (i + 1) % nPoints;
        segParts.push(
          `${projected[i].x.toFixed(2)},${projected[i].y.toFixed(2)}`
        );
      }
      return segParts.length > 1 ? "M " + segParts.join(" L ") : "";
    };

    sectors = [
      buildWrappedPath(sfIdx, s1EndIdx),
      buildWrappedPath(s1EndIdx, s2EndIdx),
      buildWrappedPath(s2EndIdx, sfIdx),
    ];

    // S/F tick: short line perpendicular to the tangent at sfIdx. Use a
    // symmetric window around sfIdx so the direction is stable when the
    // resampled MV points are close together.
    const p0 = projected[sfIdx];
    const window = Math.max(1, Math.min(8, Math.floor(nPoints / 200)));
    const pAhead = projected[(sfIdx + window) % nPoints];
    const pBehind = projected[(sfIdx - window + nPoints) % nPoints];
    const tdx = pAhead.x - pBehind.x;
    const tdy = pAhead.y - pBehind.y;
    const tlen = Math.hypot(tdx, tdy) || 1;
    const perpX = -tdy / tlen;
    const perpY = tdx / tlen;
    const tickLen = 1.6; // viewBox units (100×100)
    sfLine = {
      x1: Number((p0.x + perpX * tickLen).toFixed(2)),
      y1: Number((p0.y + perpY * tickLen).toFixed(2)),
      x2: Number((p0.x - perpX * tickLen).toFixed(2)),
      y2: Number((p0.y - perpY * tickLen).toFixed(2)),
    };
  }

  return {
    minTime: globalMin === Infinity ? 0 : globalMin,
    maxTime: globalMax === -Infinity ? 0 : globalMax,
    trackPath,
    sectors,
    sfLine,
    viewBox: "0 0 100 100",
    drivers,
  };
}
