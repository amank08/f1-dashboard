import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";
import { getDrsZones, type DrsZone } from "@/lib/data/drs-zones";
import { Info } from "lucide-react";

interface TrackDetailCardProps {
  circuitShortName: string;
  year: number;
}

// ---------------------------------------------------------------------------
// Path utilities – parse SVG M/L points and extract sub-paths that follow
// the track between two coordinates.
// ---------------------------------------------------------------------------

function parsePathPoints(pathData: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /[ML]\s*([\d.]+)\s+([\d.]+)/g;
  let m;
  while ((m = re.exec(pathData)) !== null) {
    points.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  return points;
}

function closestIndex(
  points: [number, number][],
  target: [number, number]
): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i][0] - target[0];
    const dy = points[i][1] - target[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Extract sub-path between two target coordinates, handling wrap-around. */
function subPath(
  all: [number, number][],
  from: [number, number],
  to: [number, number]
): [number, number][] {
  const a = closestIndex(all, from);
  const b = closestIndex(all, to);
  if (a <= b) return all.slice(a, b + 1);
  // Wrap-around: end of array → beginning
  return [...all.slice(a), ...all.slice(0, b + 1)];
}

function toPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Perpendicular offset [px, py] at a given index in a point array. */
function perp(
  pts: [number, number][],
  idx: number,
  offset: number
): [number, number] {
  const p = Math.max(0, idx - 1);
  const n = Math.min(pts.length - 1, idx + 1);
  const dx = pts[n][0] - pts[p][0];
  const dy = pts[n][1] - pts[p][1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [(-dy / len) * offset, (dx / len) * offset];
}

// ---------------------------------------------------------------------------
// Zone overlay – renders a polyline that follows the circuit curve.
// ---------------------------------------------------------------------------

function ZoneOverlay({
  zone,
  activationPts,
  detectionPts,
  color,
  showDetection,
}: {
  zone: DrsZone;
  activationPts: [number, number][];
  detectionPts: [number, number][];
  color: string;
  showDetection: boolean;
}) {
  if (activationPts.length < 2) return null;

  // Midpoint for the zone number label
  const midIdx = Math.floor(activationPts.length / 2);
  const mid = activationPts[midIdx];
  const [labelOffX, labelOffY] = perp(activationPts, midIdx, 6);

  // Tick directions at start and end
  const last = activationPts.length - 1;
  const [sPx, sPy] = perp(activationPts, 0, 2.5);
  const [ePx, ePy] = perp(activationPts, last, 2.5);
  const start = activationPts[0];
  const end = activationPts[last];

  return (
    <g>
      {/* Detection → activation dashed line */}
      {showDetection && detectionPts.length >= 2 && (
        <polyline
          points={toPoints(detectionPts)}
          fill="none"
          stroke="#facc15"
          strokeWidth="1.5"
          strokeDasharray="2 1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}

      {/* Activation zone polyline following the track */}
      <polyline
        points={toPoints(activationPts)}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* Start tick */}
      <line
        x1={start[0] - sPx}
        y1={start[1] - sPy}
        x2={start[0] + sPx}
        y2={start[1] + sPy}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* End tick */}
      <line
        x1={end[0] - ePx}
        y1={end[1] - ePy}
        x2={end[0] + ePx}
        y2={end[1] + ePy}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Detection point dot */}
      {showDetection && (
        <circle
          cx={zone.detection[0]}
          cy={zone.detection[1]}
          r="1.5"
          fill="#facc15"
        />
      )}

      {/* Zone number label */}
      <circle
        cx={mid[0] + labelOffX}
        cy={mid[1] + labelOffY}
        r="3.8"
        fill={color}
        stroke="#0f172a"
        strokeWidth="0.6"
      />
      <text
        x={mid[0] + labelOffX}
        y={mid[1] + labelOffY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="3.5"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        {zone.zone}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function TrackDetailCard({
  circuitShortName,
  year,
}: TrackDetailCardProps) {
  const circuit = CIRCUIT_PATHS[circuitShortName];
  if (!circuit) return null;

  const zones = getDrsZones(circuitShortName);
  const isDrsEra = year < 2026;
  const pathPts = parsePathPoints(circuit.path);

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      {/* Circuit SVG with zone overlays */}
      <svg
        viewBox={circuit.viewBox}
        className="w-full"
        aria-label={`Track map of ${circuit.name}`}
      >
        {/* Track outline */}
        <path
          d={circuit.path}
          fill="none"
          stroke="var(--f1-text-muted)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Start/finish line */}
        <line
          x1={circuit.sfLine.x1}
          y1={circuit.sfLine.y1}
          x2={circuit.sfLine.x2}
          y2={circuit.sfLine.y2}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Zone overlays – polylines that follow the track curves */}
        {zones?.map((zone) => (
          <ZoneOverlay
            key={zone.zone}
            zone={zone}
            activationPts={subPath(pathPts, zone.start, zone.end)}
            detectionPts={subPath(pathPts, zone.detection, zone.start)}
            color={isDrsEra ? "#22c55e" : "#38bdf8"}
            showDetection={isDrsEra}
          />
        ))}
      </svg>

      {/* Circuit name */}
      <p className="mt-2 text-center text-xs font-medium text-f1-text-muted">
        {circuit.name}
      </p>

      {/* Legend */}
      <div className="mt-3 border-t border-f1-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted">
          {isDrsEra ? "DRS Zones" : "Straight-Line Mode"}
        </p>

        {zones && zones.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {zones.map((zone) => (
              <div key={zone.zone} className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    backgroundColor: isDrsEra ? "#22c55e" : "#38bdf8",
                  }}
                >
                  {zone.zone}
                </span>
                <span className="text-xs text-f1-text-secondary">
                  {zone.name}
                </span>
                <span className="ml-auto text-[10px] tabular-nums text-f1-text-muted">
                  {zone.lengthMeters}m
                </span>
              </div>
            ))}

            {/* Key */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-f1-text-muted">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-0.5 w-3 rounded"
                  style={{
                    backgroundColor: isDrsEra ? "#22c55e" : "#38bdf8",
                  }}
                />
                {isDrsEra ? "Activation zone" : "Active zone"}
              </span>
              {isDrsEra && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-0.5 w-3 rounded border-t border-dashed border-yellow-400" />
                    Detection zone
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Detection point
                  </span>
                </>
              )}
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded bg-white" />
                Start/finish
              </span>
            </div>
          </div>
        )}

        {!isDrsEra && (
          <div className="mt-2 flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <p className="text-xs text-f1-text-secondary">
              DRS replaced by manual activation — drivers can flatten the rear
              wing at any point. No detection zones required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
