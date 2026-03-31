#!/usr/bin/env node

/**
 * Generate circuit SVG paths directly from OpenF1 GPS location data.
 *
 * For each circuit:
 *   1. Fetch race session → pick a driver → select a clean mid-race lap
 *   2. Fetch /location GPS data for that lap's time window
 *   3. Compute sector boundary timestamps from lap timing data
 *   4. Split GPS trace into 3 segments at sector boundaries (interpolating)
 *   5. Normalize coords to 0-100 viewBox (5% padding, aspect-ratio preserved, Y-flipped)
 *   6. Simplify each sector with Douglas-Peucker (~80-150 total points)
 *   7. Generate SVG sub-path strings per sector + combined full path
 *   8. Compute S/F line, I1/I2 markers at sector boundaries
 *   9. Speed trap: match st_speed against car_data, find GPS position at that time
 *  10. Labels: sector midpoints (by arc length), marker positions offset perpendicular
 *  11. Output debug SVG for visual verification
 *
 * Rate limiting: sequential circuits, 500ms between API calls, 1.5s between circuits.
 * Single-circuit mode: --circuit NAME
 *
 * Usage: node scripts/generate-gps-circuits.mjs [--circuit NAME] [--year YYYY]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENF1 = "https://api.openf1.org/v1";
const PADDING = 5;

// ── CLI args ──

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}
const ONLY_CIRCUIT = getArg("circuit");
const YEAR = parseInt(getArg("year") || "2025");

// ── Circuit list (OpenF1 circuit_short_name → display name) ──

const CIRCUITS = {
  Austin: "Circuit of the Americas",
  Baku: "Baku City Circuit",
  Catalunya: "Circuit de Barcelona-Catalunya",
  Hungaroring: "Hungaroring",
  Imola: "Autodromo Enzo e Dino Ferrari",
  Interlagos: "Autódromo José Carlos Pace - Interlagos",
  Jeddah: "Jeddah Corniche Circuit",
  "Las Vegas": "Las Vegas Street Circuit",
  Lusail: "Losail International Circuit",
  Melbourne: "Albert Park Circuit",
  "Mexico City": "Autódromo Hermanos Rodríguez",
  Miami: "Miami International Autodrome",
  "Monte Carlo": "Circuit de Monaco",
  Montreal: "Circuit Gilles-Villeneuve",
  Monza: "Autodromo Nazionale Monza",
  Sakhir: "Bahrain International Circuit",
  Shanghai: "Shanghai International Circuit",
  Silverstone: "Silverstone Circuit",
  Singapore: "Marina Bay Street Circuit",
  "Spa-Francorchamps": "Circuit de Spa-Francorchamps",
  Spielberg: "Red Bull Ring",
  Suzuka: "Suzuka International Racing Course",
  "Yas Marina Circuit": "Yas Marina Circuit",
  Zandvoort: "Circuit Zandvoort",
};

// ── Helpers ──

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url, retries = 3) {
  console.log(`    fetch: ${url.length > 100 ? url.substring(0, 100) + "…" : url}`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      const wait = 5000 * (attempt + 1);
      console.log(`    ⏳ 429 rate limited, waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Geometry ──

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function cumDist(pts) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + dist(pts[i - 1], pts[i]));
  return d;
}

/** Interpolate between two points */
function lerp(a, b, t) {
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** Find the GPS position at a given timestamp by interpolation */
function gpsAtTime(locs, time) {
  const t = time.getTime();
  for (let i = 1; i < locs.length; i++) {
    const t0 = new Date(locs[i - 1].date).getTime();
    const t1 = new Date(locs[i].date).getTime();
    if (t1 >= t) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        locs[i - 1].x + f * (locs[i].x - locs[i - 1].x),
        locs[i - 1].y + f * (locs[i].y - locs[i - 1].y),
      ];
    }
  }
  const last = locs[locs.length - 1];
  return [last.x, last.y];
}

/** Split GPS locations into a segment between two timestamps */
function gpsSegment(locs, tStart, tEnd) {
  const pts = [];
  const startMs = tStart.getTime();
  const endMs = tEnd.getTime();

  // Interpolated start point
  pts.push(gpsAtTime(locs, tStart));

  // All points strictly between start and end
  for (const loc of locs) {
    const t = new Date(loc.date).getTime();
    if (t > startMs && t < endMs) {
      pts.push([loc.x, loc.y]);
    }
  }

  // Interpolated end point
  pts.push(gpsAtTime(locs, tEnd));

  return pts;
}

/** Distance fraction at a timestamp within a GPS trace */
function gpsDistFracAtTime(locs, dists, time) {
  const t = time.getTime();
  const total = dists[dists.length - 1];
  for (let i = 1; i < locs.length; i++) {
    const t0 = new Date(locs[i - 1].date).getTime();
    const t1 = new Date(locs[i].date).getTime();
    if (t1 >= t) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return (dists[i - 1] + f * (dists[i] - dists[i - 1])) / total;
    }
  }
  return 1;
}

// ── Douglas-Peucker simplification ──

function dpSimplify(pts, epsilon) {
  if (pts.length <= 2) return pts;

  // Find the point with maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < pts.length - 1; i++) {
    let d;
    if (lenSq === 0) {
      d = dist(pts[i], pts[0]);
    } else {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / lenSq));
      d = dist(pts[i], [ax + t * dx, ay + t * dy]);
    }
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = dpSimplify(pts.slice(0, maxIdx + 1), epsilon);
    const right = dpSimplify(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** Simplify to approximately targetCount points by binary-searching epsilon */
function simplifyToCount(pts, targetCount) {
  if (pts.length <= targetCount) return pts;

  let lo = 0, hi = 100;
  let best = pts;

  for (let iter = 0; iter < 30; iter++) {
    const mid = (lo + hi) / 2;
    const simplified = dpSimplify(pts, mid);
    if (simplified.length > targetCount) {
      lo = mid;
    } else {
      hi = mid;
      best = simplified;
    }
  }

  return best;
}

// ── Coordinate normalization ──

function computeTransform(allSectorPts) {
  const all = allSectorPts.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const usable = 100 - 2 * PADDING;
  const scaleX = usable / rangeX;
  const scaleY = usable / rangeY;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = PADDING + (usable - rangeX * scale) / 2;
  const offsetY = PADDING + (usable - rangeY * scale) / 2;

  return { minX, maxY, scale, offsetX, offsetY };
}

function applyTransform(t, pt) {
  return [
    round2(t.offsetX + (pt[0] - t.minX) * t.scale),
    round2(t.offsetY + (t.maxY - pt[1]) * t.scale),
  ];
}

function normalizePoints(allSectorPts) {
  const t = computeTransform(allSectorPts);
  return allSectorPts.map((sectorPts) => sectorPts.map((pt) => applyTransform(t, pt)));
}

// ── SVG path construction ──

function ptsToPath(pts) {
  if (pts.length === 0) return "";
  return pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
}

/** Build closed path from 3 sector paths (joined end-to-end, then closed) */
function buildFullPath(s1, s2, s3) {
  const all = [...s1, ...s2.slice(1), ...s3.slice(1)];
  return ptsToPath(all) + " Z";
}

// ── Perpendicular computation ──

function perpAt(pts, idx, halfLen = 2.5) {
  const prev = Math.max(0, idx - 1);
  const next = Math.min(pts.length - 1, idx + 1);
  const dx = pts[next][0] - pts[prev][0];
  const dy = pts[next][1] - pts[prev][1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len, py = dx / len;
  return {
    x1: round2(pts[idx][0] + px * halfLen),
    y1: round2(pts[idx][1] + py * halfLen),
    x2: round2(pts[idx][0] - px * halfLen),
    y2: round2(pts[idx][1] - py * halfLen),
  };
}

/** Arc-length midpoint of a polyline */
function arcMidpoint(pts) {
  const d = cumDist(pts);
  const half = d[d.length - 1] / 2;
  for (let i = 1; i < d.length; i++) {
    if (d[i] >= half) {
      const f = (half - d[i - 1]) / (d[i] - d[i - 1] || 1);
      return [
        round2(lerp(pts[i - 1], pts[i], f)[0]),
        round2(lerp(pts[i - 1], pts[i], f)[1]),
      ];
    }
  }
  return pts[Math.floor(pts.length / 2)];
}

/** Offset a point perpendicular to the local direction at an index */
function offsetPerp(pts, idx, amount) {
  const prev = Math.max(0, idx - 1);
  const next = Math.min(pts.length - 1, idx + 1);
  const dx = pts[next][0] - pts[prev][0];
  const dy = pts[next][1] - pts[prev][1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [
    round2(pts[idx][0] + (-dy / len) * amount),
    round2(pts[idx][1] + (dx / len) * amount),
  ];
}

/** Find closest point index in pts to target [x,y] */
function closestIdx(pts, target) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = dist(pts[i], target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ── Per-circuit processing ──

async function processCircuit(circuitName, displayName, year) {
  console.log(`\n=== ${circuitName} (${year}) ===`);

  // 1. Find qualifying session (dry laps → distinctive speed trap speeds)
  await sleep(1000);
  const sessions = await fetchJSON(
    `${OPENF1}/sessions?circuit_short_name=${encodeURIComponent(circuitName)}&session_type=Qualifying&year=${year}`
  );
  if (!sessions.length) {
    console.log(`  ⚠ No qualifying session found for ${year}, trying ${year - 1}`);
    await sleep(500);
    const fallback = await fetchJSON(
      `${OPENF1}/sessions?circuit_short_name=${encodeURIComponent(circuitName)}&session_type=Qualifying&year=${year - 1}`
    );
    if (!fallback.length) throw new Error(`No qualifying found for ${circuitName}`);
    sessions.push(...fallback);
  }
  const session = sessions[0];
  console.log(`  Session: ${session.session_key} (${session.session_name})`);

  // 2. Pick driver — prefer #1, then try others until one has clean laps
  await sleep(1000);
  const drivers = await fetchJSON(
    `${OPENF1}/drivers?session_key=${session.session_key}`
  );
  const driverNums = [...new Set(drivers.map((d) => d.driver_number))];
  // Try #1 first, then the rest
  const tryOrder = driverNums.includes(1)
    ? [1, ...driverNums.filter((n) => n !== 1)]
    : driverNums;

  let lap = null;
  let refDriverNum = null;
  for (const dNum of tryOrder.slice(0, 5)) {
    await sleep(500);
    const laps = await fetchJSON(
      `${OPENF1}/laps?session_key=${session.session_key}&driver_number=${dNum}`
    );
    const cleanLaps = laps.filter(
      (l) =>
        l.duration_sector_1 &&
        l.duration_sector_2 &&
        l.duration_sector_3 &&
        l.date_start &&
        l.st_speed > 0 &&
        l.duration_sector_3 < 60
    );
    if (cleanLaps.length) {
      // Pick the fastest clean lap — distinctive speed trap speeds in quali
      cleanLaps.sort((a, b) =>
        (a.duration_sector_1 + a.duration_sector_2 + a.duration_sector_3) -
        (b.duration_sector_1 + b.duration_sector_2 + b.duration_sector_3)
      );
      lap = cleanLaps[0];
      refDriverNum = dNum;
      console.log(`  Driver: #${dNum} (${cleanLaps.length} clean laps, fastest: ${(lap.duration_sector_1 + lap.duration_sector_2 + lap.duration_sector_3).toFixed(3)}s)`);
      break;
    }
    console.log(`  Driver #${dNum}: no clean laps, trying next…`);
  }
  if (!lap) throw new Error(`No clean qualifying laps for ${circuitName} (tried ${tryOrder.slice(0, 5).join(", ")})`);
  const lapStart = new Date(lap.date_start);
  const s1End = new Date(lapStart.getTime() + lap.duration_sector_1 * 1000);
  const s2End = new Date(s1End.getTime() + lap.duration_sector_2 * 1000);
  const s3End = new Date(s2End.getTime() + lap.duration_sector_3 * 1000);
  console.log(
    `  Lap ${lap.lap_number}: S1=${lap.duration_sector_1.toFixed(3)}s S2=${lap.duration_sector_2.toFixed(3)}s S3=${lap.duration_sector_3.toFixed(3)}s`
  );

  // 4. Fetch GPS location data
  await sleep(1000);
  const fetchStartISO = new Date(lapStart.getTime() - 2000).toISOString();
  const fetchEndISO = new Date(s3End.getTime() + 2000).toISOString();
  const locations = await fetchJSON(
    `${OPENF1}/location?session_key=${session.session_key}&driver_number=${refDriverNum}&date>=${fetchStartISO}&date<=${fetchEndISO}`
  );

  // Filter to lap window
  const lapLocs = locations.filter((l) => {
    const t = new Date(l.date).getTime();
    return t >= lapStart.getTime() && t <= s3End.getTime();
  });
  console.log(`  GPS: ${lapLocs.length} points in lap`);

  if (lapLocs.length < 20) throw new Error(`Too few GPS points for ${circuitName}`);

  // 5. Split into 3 sector segments
  const s1Raw = gpsSegment(lapLocs, lapStart, s1End);
  const s2Raw = gpsSegment(lapLocs, s1End, s2End);
  const s3Raw = gpsSegment(lapLocs, s2End, s3End);
  console.log(`  Raw segments: S1=${s1Raw.length} S2=${s2Raw.length} S3=${s3Raw.length}`);

  // 6. Normalize to viewBox
  const transform = computeTransform([s1Raw, s2Raw, s3Raw]);
  const [s1Norm, s2Norm, s3Norm] = [s1Raw, s2Raw, s3Raw].map((pts) =>
    pts.map((pt) => applyTransform(transform, pt))
  );

  // 7. Simplify with Douglas-Peucker
  // Target ~40-50 points per sector, but adapt to complexity
  const totalRaw = s1Raw.length + s2Raw.length + s3Raw.length;
  const targetTotal = Math.min(150, Math.max(80, Math.round(totalRaw * 0.3)));
  const s1Target = Math.round((s1Raw.length / totalRaw) * targetTotal);
  const s2Target = Math.round((s2Raw.length / totalRaw) * targetTotal);
  const s3Target = targetTotal - s1Target - s2Target;

  const s1 = simplifyToCount(s1Norm, Math.max(10, s1Target));
  const s2 = simplifyToCount(s2Norm, Math.max(10, s2Target));
  const s3 = simplifyToCount(s3Norm, Math.max(10, s3Target));
  console.log(`  Simplified: S1=${s1.length} S2=${s2.length} S3=${s3.length} (total ${s1.length + s2.length + s3.length})`);

  // Ensure sectors connect: snap sector starts to previous sector ends
  s2[0] = s1[s1.length - 1];
  s3[0] = s2[s2.length - 1];

  // 8. Build SVG paths
  const sectorPaths = [ptsToPath(s1), ptsToPath(s2), ptsToPath(s3)];
  const fullPath = buildFullPath(s1, s2, s3);

  // 9. S/F line at first point of S1 (= lap start = S/F by construction)
  const sfLine = perpAt(s1, 0, 2.5);

  // 10. Markers at sector boundaries
  const i1Marker = perpAt(s1, s1.length - 1, 2);
  const i2Marker = perpAt(s2, s2.length - 1, 2);

  // 11. Speed trap — place at the point of maximum speed (= fastest straight)
  let stMarker;
  let stLabelPos;
  const stSpeed = lap.st_speed;

  if (stSpeed) {
    await sleep(1000);
    const carData = await fetchJSON(
      `${OPENF1}/car_data?session_key=${session.session_key}&driver_number=${refDriverNum}&date>=${fetchStartISO}&date<=${fetchEndISO}&speed>=0`
    );
    const lapCarData = carData.filter((c) => {
      const t = new Date(c.date).getTime();
      return t >= lapStart.getTime() && t <= s3End.getTime();
    });

    // Find the longest geometric straight in the GPS trace — that's where the
    // speed trap is. Measure straightness by angle change between consecutive
    // GPS triplets. Group low-curvature segments into "straights" and pick
    // the longest by arc-length distance.
    const angleThreshold = 3; // degrees — max deviation to count as "straight"
    const straightRuns = []; // each run: [startIdx, endIdx] in lapLocs
    let runStart = 0;
    for (let i = 1; i < lapLocs.length - 1; i++) {
      const ax = lapLocs[i].x - lapLocs[i - 1].x;
      const ay = lapLocs[i].y - lapLocs[i - 1].y;
      const bx = lapLocs[i + 1].x - lapLocs[i].x;
      const by = lapLocs[i + 1].y - lapLocs[i].y;
      const dot = ax * bx + ay * by;
      const cross = ax * by - ay * bx;
      const angle = Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI);
      if (angle > angleThreshold) {
        if (i - runStart >= 3) straightRuns.push([runStart, i]);
        runStart = i;
      }
    }
    if (lapLocs.length - 1 - runStart >= 3) straightRuns.push([runStart, lapLocs.length - 1]);

    // Measure each straight's physical distance
    let longestDist = 0, longestRun = null;
    for (const [si, ei] of straightRuns) {
      const dx = lapLocs[ei].x - lapLocs[si].x;
      const dy = lapLocs[ei].y - lapLocs[si].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > longestDist) { longestDist = d; longestRun = [si, ei]; }
    }

    // Place speed trap at the midpoint of the longest straight
    let peakTime;
    if (longestRun) {
      const midIdx = Math.floor((longestRun[0] + longestRun[1]) / 2);
      peakTime = new Date(lapLocs[midIdx].date).getTime();
      console.log(`  Speed trap: longest straight ${longestRun[0]}-${longestRun[1]} (${straightRuns.length} straights found)`);
    } else {
      // Fallback: use peak speed
      let maxSpeed = 0;
      peakTime = lapStart.getTime();
      for (const c of lapCarData) {
        if (c.speed > maxSpeed) { maxSpeed = c.speed; peakTime = new Date(c.date).getTime(); }
      }
      console.log(`  Speed trap: no straight detected, using peak speed ${maxSpeed} km/h`);
    }

    // Get GPS position at peak speed time
    const stGps = gpsAtTime(lapLocs, new Date(peakTime));
    // Normalize using the same transform as the sector points
    const stNorm = applyTransform(transform, stGps);

    // Find closest point on any sector path
    const allPts = [...s1, ...s2.slice(1), ...s3.slice(1)];
    const stIdx = closestIdx(allPts, stNorm);
    stMarker = perpAt(allPts, stIdx, 2);
    stLabelPos = { x: Math.round(allPts[stIdx][0]), y: Math.round(allPts[stIdx][1]) };
    console.log(`  Speed trap: st_speed=${stSpeed} km/h, placed at GPS (${Math.round(stNorm[0])}, ${Math.round(stNorm[1])})`);
  } else {
    // Fallback: place at midpoint of longest sector
    const lengths = [cumDist(s1), cumDist(s2), cumDist(s3)].map((d) => d[d.length - 1]);
    const maxSec = lengths.indexOf(Math.max(...lengths));
    const sectors = [s1, s2, s3];
    const midPt = arcMidpoint(sectors[maxSec]);
    const midIdx = closestIdx(sectors[maxSec], midPt);
    stMarker = perpAt(sectors[maxSec], midIdx, 2);
    stLabelPos = { x: Math.round(midPt[0]), y: Math.round(midPt[1]) };
    console.log(`  Speed trap: no data, placed at midpoint of S${maxSec + 1}`);
  }

  // 12. Label positions — sector midpoints offset perpendicular for readability
  const s1Mid = arcMidpoint(s1);
  const s2Mid = arcMidpoint(s2);
  const s3Mid = arcMidpoint(s3);

  // I1/I2 label positions at the boundary points
  const i1Pos = s1[s1.length - 1];
  const i2Pos = s2[s2.length - 1];

  // SF label offset from track
  const sfPos = s1[0];

  const labels = {
    sf: { x: Math.round(sfPos[0]), y: Math.round(sfPos[1]) },
    s1: { x: Math.round(s1Mid[0]), y: Math.round(s1Mid[1]) },
    s2: { x: Math.round(s2Mid[0]), y: Math.round(s2Mid[1]) },
    s3: { x: Math.round(s3Mid[0]), y: Math.round(s3Mid[1]) },
    i1: { x: Math.round(i1Pos[0]), y: Math.round(i1Pos[1]) },
    i2: { x: Math.round(i2Pos[0]), y: Math.round(i2Pos[1]) },
    st: stLabelPos,
  };

  // 13. Generate debug SVG
  const debugSvg = `<svg viewBox="-5 -5 110 110" xmlns="http://www.w3.org/2000/svg" style="background:#1a1a2e">
  <!-- S1 (red) -->
  <path d="${sectorPaths[0]}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round" opacity="0.85"/>
  <!-- S2 (blue) -->
  <path d="${sectorPaths[1]}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linejoin="round" opacity="0.85"/>
  <!-- S3 (yellow) -->
  <path d="${sectorPaths[2]}" fill="none" stroke="#eab308" stroke-width="1.5" stroke-linejoin="round" opacity="0.85"/>

  <!-- S/F line -->
  <line x1="${sfLine.x1}" y1="${sfLine.y1}" x2="${sfLine.x2}" y2="${sfLine.y2}" stroke="white" stroke-width="2"/>

  <!-- I1 marker -->
  <line x1="${i1Marker.x1}" y1="${i1Marker.y1}" x2="${i1Marker.x2}" y2="${i1Marker.y2}" stroke="#ef4444" stroke-width="1.5"/>
  <text x="${labels.i1.x}" y="${labels.i1.y - 3}" fill="#ef4444" font-size="3" text-anchor="middle">I1</text>

  <!-- I2 marker -->
  <line x1="${i2Marker.x1}" y1="${i2Marker.y1}" x2="${i2Marker.x2}" y2="${i2Marker.y2}" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="${labels.i2.x}" y="${labels.i2.y - 3}" fill="#3b82f6" font-size="3" text-anchor="middle">I2</text>

  <!-- ST marker -->
  <line x1="${stMarker.x1}" y1="${stMarker.y1}" x2="${stMarker.x2}" y2="${stMarker.y2}" stroke="#eab308" stroke-width="1"/>
  <text x="${labels.st.x}" y="${labels.st.y - 3}" fill="#eab308" font-size="3" text-anchor="middle">ST</text>

  <!-- Sector labels -->
  <text x="${labels.s1.x}" y="${labels.s1.y}" fill="#ef4444" font-size="5" text-anchor="middle" dominant-baseline="central" font-weight="bold" opacity="0.5">S1</text>
  <text x="${labels.s2.x}" y="${labels.s2.y}" fill="#3b82f6" font-size="5" text-anchor="middle" dominant-baseline="central" font-weight="bold" opacity="0.5">S2</text>
  <text x="${labels.s3.x}" y="${labels.s3.y}" fill="#eab308" font-size="5" text-anchor="middle" dominant-baseline="central" font-weight="bold" opacity="0.5">S3</text>

  <!-- S/F label -->
  <text x="${labels.sf.x}" y="${labels.sf.y - 4}" fill="white" font-size="4" text-anchor="middle" font-weight="bold">S/F</text>
</svg>`;

  const debugPath = resolve(__dirname, `../debug-${circuitName.toLowerCase().replace(/\s+/g, "-")}.svg`);
  writeFileSync(debugPath, debugSvg);
  console.log(`  Debug SVG: ${debugPath}`);

  return {
    viewBox: "0 0 100 100",
    path: fullPath,
    sectors: sectorPaths,
    sfLine,
    name: displayName,
    labels,
    markers: { i1: i1Marker, i2: i2Marker, st: stMarker },
  };
}

// ── Main ──

async function main() {
  const circuitsToProcess = ONLY_CIRCUIT
    ? { [ONLY_CIRCUIT]: CIRCUITS[ONLY_CIRCUIT] || ONLY_CIRCUIT }
    : CIRCUITS;

  console.log(`Processing ${Object.keys(circuitsToProcess).length} circuit(s) for ${YEAR}...\n`);

  // If updating a single circuit, load existing data
  let existing = {};
  const outPath = resolve(__dirname, "../src/lib/data/circuit-paths.ts");
  if (ONLY_CIRCUIT && existsSync(outPath)) {
    // We'll merge the new circuit into existing data
    // Parse existing file to get all circuit data
    const src = readFileSync(outPath, "utf-8");
    const circuitBlockRe = /"([^"]+)":\s*\{[\s\S]*?(?="\w|};)/g;
    // Actually, just re-run all circuits or handle single update separately
    // For simplicity, if --circuit is given, we just output the single circuit result
    // and the user can paste it in. The full run regenerates everything.
  }

  const results = {};
  const errors = [];

  for (const [name, displayName] of Object.entries(circuitsToProcess)) {
    try {
      results[name] = await processCircuit(name, displayName, YEAR);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      errors.push(name);
    }
    // Rate limit between circuits
    await sleep(3000);
  }

  if (errors.length) {
    console.log(`\n⚠ Failed circuits: ${errors.join(", ")}`);
  }

  if (ONLY_CIRCUIT) {
    // For single circuit, just print the result
    const name = ONLY_CIRCUIT;
    if (results[name]) {
      console.log(`\n=== Output for "${name}" ===`);
      console.log(JSON.stringify(results[name], null, 2));
    }
    return;
  }

  // Don't overwrite file if all circuits failed
  if (Object.keys(results).length === 0) {
    console.error("\n✗ All circuits failed — not overwriting circuit-paths.ts");
    process.exit(1);
  }

  // Generate full TypeScript file
  const entries = Object.entries(results)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const labelsStr = `{ sf: {x: ${val.labels.sf.x}, y: ${val.labels.sf.y}}, s1: {x: ${val.labels.s1.x}, y: ${val.labels.s1.y}}, s2: {x: ${val.labels.s2.x}, y: ${val.labels.s2.y}}, s3: {x: ${val.labels.s3.x}, y: ${val.labels.s3.y}}, i1: {x: ${val.labels.i1.x}, y: ${val.labels.i1.y}}, i2: {x: ${val.labels.i2.x}, y: ${val.labels.i2.y}}, st: {x: ${val.labels.st.x}, y: ${val.labels.st.y}} }`;
      return `  ${JSON.stringify(key)}: {
    viewBox: ${JSON.stringify(val.viewBox)},
    path: ${JSON.stringify(val.path)},
    sectors: [${JSON.stringify(val.sectors[0])}, ${JSON.stringify(val.sectors[1])}, ${JSON.stringify(val.sectors[2])}],
    sfLine: ${JSON.stringify(val.sfLine)},
    name: ${JSON.stringify(val.name)},
    labels: ${labelsStr},
    markers: { i1: ${JSON.stringify(val.markers.i1)}, i2: ${JSON.stringify(val.markers.i2)}, st: ${JSON.stringify(val.markers.st)} },
  }`;
    })
    .join(",\n");

  const ts = `// Auto-generated by scripts/generate-gps-circuits.mjs — do not edit manually.

export interface CircuitPath {
  viewBox: string;
  /** Full closed track path (for DRS overlays etc.) */
  path: string;
  /** Three separate SVG sub-paths, one per sector [S1, S2, S3] */
  sectors: [string, string, string];
  /** Start/finish line endpoints (perpendicular to track at S/F point) */
  sfLine: { x1: number; y1: number; x2: number; y2: number };
  name: string;
  /** Label positions for sectors and start/finish (in viewBox coords) */
  labels: {
    sf: { x: number; y: number };
    s1: { x: number; y: number };
    s2: { x: number; y: number };
    s3: { x: number; y: number };
    i1: { x: number; y: number };
    i2: { x: number; y: number };
    st: { x: number; y: number };
  };
  /** Perpendicular tick marks at intermediate timing points */
  markers: {
    i1: { x1: number; y1: number; x2: number; y2: number };
    i2: { x1: number; y1: number; x2: number; y2: number };
    st: { x1: number; y1: number; x2: number; y2: number };
  };
}

export const CIRCUIT_PATHS: Record<string, CircuitPath> = {
${entries},
};
`;

  writeFileSync(outPath, ts, "utf-8");
  console.log(`\n✓ Wrote ${Object.keys(results).length} circuits → ${outPath}`);

  if (errors.length) {
    console.log(`\n⚠ ${errors.length} circuit(s) failed — rerun with --circuit NAME to retry.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
