/**
 * Extract accurate F1 timing sector boundary ratios from the legacy
 * hand-generated circuit-paths.ts data.
 *
 * The legacy data was built from OpenF1 GPS + timing data and contains
 * the three sector sub-paths per circuit. By computing the cumulative
 * path length of each sector, we get the fraction of lap distance at
 * which each sector boundary sits (0..1).
 *
 * These ratios are coordinate-system independent, so we can apply them
 * to MultiViewer circuit geometry to split the track at the correct
 * F1 timing sector boundaries.
 */
import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";

export interface SectorRatios {
  /** Fraction of lap distance where sector 1 ends / sector 2 begins. */
  s1End: number;
  /** Fraction of lap distance where sector 2 ends / sector 3 begins. */
  s2End: number;
}

/** Parse an SVG "M x y L x y L x y ..." path into point coordinates. */
function parseSvgPath(d: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  // Strip command letters and split into tokens
  const tokens = d.replace(/[ML]/g, " ").trim().split(/[\s,]+/);
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

/** Compute the total path length along a sequence of points. */
function pathLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

const cache = new Map<string, SectorRatios | null>();

/**
 * Look up sector ratios for a circuit by OpenF1 circuit_short_name.
 * Returns null if the circuit isn't in the legacy dataset.
 */
export function getSectorRatios(circuitShortName: string): SectorRatios | null {
  if (cache.has(circuitShortName)) return cache.get(circuitShortName)!;

  const circuit = CIRCUIT_PATHS[circuitShortName];
  if (!circuit) {
    cache.set(circuitShortName, null);
    return null;
  }

  const [s1Path, s2Path, s3Path] = circuit.sectors;
  const s1Len = pathLength(parseSvgPath(s1Path));
  const s2Len = pathLength(parseSvgPath(s2Path));
  const s3Len = pathLength(parseSvgPath(s3Path));
  const total = s1Len + s2Len + s3Len;

  if (total === 0) {
    cache.set(circuitShortName, null);
    return null;
  }

  const ratios: SectorRatios = {
    s1End: s1Len / total,
    s2End: (s1Len + s2Len) / total,
  };
  cache.set(circuitShortName, ratios);
  return ratios;
}

/** Get the legacy full closed-track path as an array of points. */
function getLegacyPath(
  circuitShortName: string
): Array<{ x: number; y: number }> | null {
  const circuit = CIRCUIT_PATHS[circuitShortName];
  if (!circuit) return null;
  const pts = parseSvgPath(circuit.path);
  return pts.length > 4 ? pts : null;
}

/** Resample a closed path to N equally-spaced points by arc length. */
function resampleClosed(
  points: Array<{ x: number; y: number }>,
  N: number
): Array<{ x: number; y: number }> {
  // Build cumulative arc length including wrap-around to points[0]
  const closed = [...points, points[0]];
  const cum: number[] = [0];
  for (let i = 1; i < closed.length; i++) {
    cum.push(
      cum[i - 1] +
        Math.hypot(closed[i].x - closed[i - 1].x, closed[i].y - closed[i - 1].y)
    );
  }
  const total = cum[cum.length - 1];
  const out: Array<{ x: number; y: number }> = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const target = (k / N) * total;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const segLen = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / segLen;
    out.push({
      x: closed[j].x + t * (closed[j + 1].x - closed[j].x),
      y: closed[j].y + t * (closed[j + 1].y - closed[j].y),
    });
  }
  return out;
}

/**
 * Compute a rotation-invariant curvature signature for a closed path sampled
 * uniformly by arc length. At each sample, this is the signed turning angle
 * (in radians) from the previous sample to the next one. Because samples are
 * equidistant in arc length, this is essentially discrete curvature.
 */
function curvatureSignature(points: Array<{ x: number; y: number }>): number[] {
  const N = points.length;
  const sig = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    const prev = points[(i - 1 + N) % N];
    const next = points[(i + 1) % N];
    const dx1 = points[i].x - prev.x;
    const dy1 = points[i].y - prev.y;
    const dx2 = next.x - points[i].x;
    const dy2 = next.y - points[i].y;
    const cross = dx1 * dy2 - dy1 * dx2;
    const dot = dx1 * dx2 + dy1 * dy2;
    sig[i] = Math.atan2(cross, dot);
  }
  return sig;
}

/** Sum of squared differences between sigA and sigB cyclically shifted by k. */
function compareShifted(sigA: number[], sigB: number[], k: number): number {
  const N = sigA.length;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const d = sigA[i] - sigB[(i + k) % N];
    sum += d * d;
  }
  return sum;
}

const offsetCache = new Map<string, number | null>();

/**
 * Find the fraction (0..1) of lap distance along the MultiViewer path at
 * which the actual F1 start/finish line sits. The legacy circuit-paths data
 * starts its path at the S/F line, so we match curvature signatures between
 * the two closed paths and return the cyclic offset that minimises residual
 * error. This works regardless of coordinate system, scale, or rotation, but
 * the two paths must be the same circuit (and handle both traversal
 * directions).
 *
 * Returns null if the circuit isn't in the legacy dataset.
 */
export function findSfOffsetRatio(
  circuitShortName: string,
  multiviewerPoints: Array<{ x: number; y: number }>
): number | null {
  if (offsetCache.has(circuitShortName)) {
    return offsetCache.get(circuitShortName)!;
  }
  const legacy = getLegacyPath(circuitShortName);
  if (!legacy || multiviewerPoints.length < 8) {
    offsetCache.set(circuitShortName, null);
    return null;
  }

  const N = 256;
  const legacyResampled = resampleClosed(legacy, N);
  const mvResampled = resampleClosed(multiviewerPoints, N);
  const sigLegacy = curvatureSignature(legacyResampled);
  const sigMv = curvatureSignature(mvResampled);

  let bestK = 0;
  let bestSum = Infinity;
  for (let k = 0; k < N; k++) {
    const sum = compareShifted(sigLegacy, sigMv, k);
    if (sum < bestSum) {
      bestSum = sum;
      bestK = k;
    }
  }

  // bestK such that sigMv[(i + bestK) % N] ~ sigLegacy[i], so MV index
  // (0 + bestK) corresponds to legacy index 0 which is S/F. The S/F
  // position along MV lap is therefore bestK / N.
  const ratio = bestK / N;
  offsetCache.set(circuitShortName, ratio);
  return ratio;
}
