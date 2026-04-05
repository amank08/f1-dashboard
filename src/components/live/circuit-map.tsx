"use client";

import { useMemo } from "react";
import { useCircuitMap } from "@/lib/hooks/use-circuit-map";
import {
  findSfOffsetRatio,
  getSectorRatios,
} from "@/lib/utils/sector-ratios";

interface CircuitMapProps {
  circuitKey: number;
  year: number;
  /**
   * OpenF1 circuit_short_name — used to look up accurate F1 timing sector
   * boundaries. Falls back to equal thirds if not provided or not found.
   */
  circuitShortName?: string;
  /** Optional human-readable name shown under the map. */
  displayName?: string;
}

const PADDING = 1000;
const SECTOR_COLORS = ["#ef4444", "#3b82f6", "#eab308"] as const;

export function CircuitMap({
  circuitKey,
  year,
  circuitShortName,
  displayName,
}: CircuitMapProps) {
  const { data, isLoading, error } = useCircuitMap(circuitKey, year);

  const rendered = useMemo(() => {
    if (!data) return null;

    // Accurate F1 timing sector boundaries from legacy dataset, if available.
    const ratios = circuitShortName ? getSectorRatios(circuitShortName) : null;

    // Apply the track rotation. MultiViewer stores rotation in degrees;
    // in the F1 convention the track is rotated by (rotation - 180) deg
    // around the origin, and SVG y is inverted.
    const angle = ((data.rotation - 180) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotate = (px: number, py: number) => ({
      x: px * cos - py * sin,
      y: -(px * sin + py * cos),
    });

    const points = data.x.map((xi, i) => rotate(xi, data.y[i]));
    const nPoints = points.length;

    // Compute cumulative distance along the path for sector split
    const cumulative: number[] = [0];
    for (let i = 1; i < nPoints; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
    }
    const totalLen = cumulative[cumulative.length - 1];

    // MultiViewer's point[0] is not guaranteed to be at the F1 start/finish
    // line. Match the MV path against the legacy hand-generated path (whose
    // index 0 is S/F) to find the arc-length offset where S/F actually sits.
    const sfRatio = circuitShortName
      ? findSfOffsetRatio(circuitShortName, points) ?? 0
      : 0;
    const sfDist = sfRatio * totalLen;

    // Helper: for a given distance along the closed lap starting from
    // point[0], return the index of the nearest sample at or after that
    // distance (wrapping around the end).
    const indexAtDist = (dist: number): number => {
      const d = ((dist % totalLen) + totalLen) % totalLen;
      // Linear scan is fine — runs once per render and nPoints is ~2k.
      for (let i = 0; i < nPoints; i++) {
        if (cumulative[i] >= d) return i;
      }
      return nPoints - 1;
    };

    // Split distances, measured from MV point[0]. S/F is at sfDist; sector
    // boundaries follow along the lap from there.
    const s1EndDist = sfDist + (ratios ? ratios.s1End : 1 / 3) * totalLen;
    const s2EndDist = sfDist + (ratios ? ratios.s2End : 2 / 3) * totalLen;
    const sfIdx = indexAtDist(sfDist);
    const s1EndIdx = indexAtDist(s1EndDist);
    const s2EndIdx = indexAtDist(s2EndDist);

    // Build a path from start index to end index, walking forward and
    // wrapping around the closed loop if end < start.
    const buildWrappedPath = (start: number, end: number) => {
      const parts: string[] = [];
      let i = start;
      parts.push(`${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`);
      // Guard against infinite loops.
      for (let guard = 0; guard <= nPoints; guard++) {
        if (i === end) break;
        i = (i + 1) % nPoints;
        parts.push(`${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`);
      }
      return parts.length > 1 ? "M " + parts.join(" L ") : "";
    };

    const sectors = [
      buildWrappedPath(sfIdx, s1EndIdx),
      buildWrappedPath(s1EndIdx, s2EndIdx),
      buildWrappedPath(s2EndIdx, sfIdx),
    ];

    // Compute bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX + PADDING * 2;
    const height = maxY - minY + PADDING * 2;
    const viewBox = `${minX - PADDING} ${minY - PADDING} ${width} ${height}`;

    // Start/finish line: small perpendicular tick at the S/F point.
    // Use a centered tangent across a window of points on either side of
    // sfIdx (the track is a closed loop) so the direction is stable even
    // when adjacent samples are very close together or slightly noisy.
    const p0 = points[sfIdx];
    const window = Math.max(1, Math.min(8, Math.floor(nPoints / 200)));
    const pAhead = points[(sfIdx + window) % nPoints];
    const pBehind = points[(sfIdx - window + nPoints) % nPoints];
    const dx = pAhead.x - pBehind.x;
    const dy = pAhead.y - pBehind.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tickLen = 400;
    const sfLine = {
      x1: p0.x + nx * tickLen,
      y1: p0.y + ny * tickLen,
      x2: p0.x - nx * tickLen,
      y2: p0.y - ny * tickLen,
    };

    return {
      sectors,
      viewBox,
      sfLine,
      strokeWidth: Math.max(width, height) / 120,
    };
  }, [data, circuitShortName]);

  if (error) {
    return (
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4 text-center text-xs text-f1-text-muted">
        Could not load circuit map
      </div>
    );
  }

  if (isLoading || !data || !rendered) {
    return (
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
        <div className="aspect-square w-full animate-pulse rounded bg-f1-card/50" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <svg
        viewBox={rendered.viewBox}
        className="w-full"
        aria-label={`Track map of ${data.circuitName}`}
      >
        {/* Three sector-colored segments */}
        {rendered.sectors.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={SECTOR_COLORS[i]}
            strokeWidth={rendered.strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.9}
          />
        ))}
        {/* Start/finish line */}
        <line
          x1={rendered.sfLine.x1}
          y1={rendered.sfLine.y1}
          x2={rendered.sfLine.x2}
          y2={rendered.sfLine.y2}
          stroke="white"
          strokeWidth={rendered.strokeWidth * 1.2}
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-2 text-center text-xs font-medium text-f1-text-muted">
        {displayName ?? data.circuitName}
      </p>
    </div>
  );
}
