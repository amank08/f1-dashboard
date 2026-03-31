"use client";

import { useMemo } from "react";
import type { Driver, LapData } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";

interface SectorDominanceChartProps {
  drivers: Driver[];
  laps: LapData[];
}

interface DriverSectors {
  name: string;
  color: string;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  bestLap: number | null;
}

const SECTORS = ["s1", "s2", "s3"] as const;
const SECTOR_LABELS = ["S1", "S2", "S3"];

function deltaColor(delta: number, maxDelta: number): string {
  if (maxDelta === 0) return "rgba(168, 85, 247, 0.8)"; // purple
  const t = Math.min(delta / maxDelta, 1);

  if (delta < 0.001) {
    // Overall best — purple (only the exact fastest time)
    return "rgba(168, 85, 247, 0.85)";
  }
  if (t < 0.25) {
    // Very close — green
    const f = t / 0.25;
    const r = Math.round(34 + f * (234 - 34));
    const g = Math.round(197 + f * (179 - 197));
    const b = Math.round(94 + f * (8 - 94));
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }
  if (t < 0.6) {
    // Mid — yellow to orange
    const f = (t - 0.25) / 0.35;
    const r = Math.round(234 + f * (249 - 234));
    const g = Math.round(179 - f * (179 - 115));
    const b = Math.round(8 + f * (22 - 8));
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  }
  // Far off — red
  const f = Math.min((t - 0.6) / 0.4, 1);
  const r = Math.round(249 - f * (249 - 220));
  const g = Math.round(115 - f * (115 - 38));
  const b = Math.round(22 + f * (38 - 22));
  return `rgba(${r}, ${g}, ${b}, 0.5)`;
}

export function SectorDominanceChart({
  drivers,
  laps,
}: SectorDominanceChartProps) {
  const { rows, bestS1, bestS2, bestS3, maxDeltas } = useMemo(() => {
    const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));

    // Best sector times per driver (across all laps)
    const bestSectors = new Map<
      number,
      { s1: number | null; s2: number | null; s3: number | null }
    >();
    const bestLaps = new Map<number, number>();

    for (const lap of laps) {
      if (lap.is_pit_out_lap) continue;

      const cur = bestSectors.get(lap.driver_number) ?? {
        s1: null,
        s2: null,
        s3: null,
      };
      if (
        lap.duration_sector_1 != null &&
        (cur.s1 === null || lap.duration_sector_1 < cur.s1)
      )
        cur.s1 = lap.duration_sector_1;
      if (
        lap.duration_sector_2 != null &&
        (cur.s2 === null || lap.duration_sector_2 < cur.s2)
      )
        cur.s2 = lap.duration_sector_2;
      if (
        lap.duration_sector_3 != null &&
        (cur.s3 === null || lap.duration_sector_3 < cur.s3)
      )
        cur.s3 = lap.duration_sector_3;
      bestSectors.set(lap.driver_number, cur);

      if (lap.lap_duration != null) {
        const curBest = bestLaps.get(lap.driver_number);
        if (curBest == null || lap.lap_duration < curBest) {
          bestLaps.set(lap.driver_number, lap.lap_duration);
        }
      }
    }

    // Overall best per sector
    let bS1 = Infinity,
      bS2 = Infinity,
      bS3 = Infinity;
    for (const s of bestSectors.values()) {
      if (s.s1 != null && s.s1 < bS1) bS1 = s.s1;
      if (s.s2 != null && s.s2 < bS2) bS2 = s.s2;
      if (s.s3 != null && s.s3 < bS3) bS3 = s.s3;
    }
    if (bS1 === Infinity) bS1 = 0;
    if (bS2 === Infinity) bS2 = 0;
    if (bS3 === Infinity) bS3 = 0;

    const rows: DriverSectors[] = [];
    for (const [dNum, sectors] of bestSectors) {
      const d = driverMap.get(dNum);
      if (!d) continue;
      rows.push({
        name: d.name_acronym,
        color: getTeamColor(d.team_colour, d.team_name),
        s1: sectors.s1,
        s2: sectors.s2,
        s3: sectors.s3,
        bestLap: bestLaps.get(dNum) ?? null,
      });
    }

    rows.sort((a, b) => (a.bestLap ?? Infinity) - (b.bestLap ?? Infinity));

    // Max deltas for color scaling — use 90th percentile to avoid outlier skew
    function p90(deltas: number[]): number {
      const sorted = deltas.filter((d) => d > 0).sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const idx = Math.floor(sorted.length * 0.9);
      return sorted[Math.min(idx, sorted.length - 1)];
    }
    const maxD1 = p90(rows.map((r) => (r.s1 != null ? r.s1 - bS1 : 0)));
    const maxD2 = p90(rows.map((r) => (r.s2 != null ? r.s2 - bS2 : 0)));
    const maxD3 = p90(rows.map((r) => (r.s3 != null ? r.s3 - bS3 : 0)));

    return {
      rows,
      bestS1: bS1,
      bestS2: bS2,
      bestS3: bS3,
      maxDeltas: [maxD1, maxD2, maxD3],
    };
  }, [drivers, laps]);

  if (rows.length === 0) return null;

  const bests = [bestS1, bestS2, bestS3];

  return (
    <div className="flex h-[560px] flex-col rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-f1-text-muted shrink-0">
        Sector Dominance
      </h3>

      {/* Sticky header */}
      <div className="shrink-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-f1-border">
              <th className="px-2 py-2 text-left font-semibold text-f1-text-muted w-16">

              </th>
              {SECTOR_LABELS.map((label) => (
                <th
                  key={label}
                  className="px-2 py-2 text-center font-semibold text-f1-text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-f1-border/20">
                <td className="px-2 py-1 w-16">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-1 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-semibold text-white text-[11px]">
                      {row.name}
                    </span>
                  </div>
                </td>
                {SECTORS.map((sector, i) => {
                  const time = row[sector];
                  const best = bests[i];
                  const maxDelta = maxDeltas[i];
                  const delta = time != null ? time - best : null;

                  return (
                    <td key={sector} className="px-1.5 py-1">
                      {time != null ? (
                        <div
                          className="rounded px-2 py-1.5 text-center"
                          style={{
                            backgroundColor: deltaColor(delta!, maxDelta),
                          }}
                        >
                          <div className="font-mono font-bold text-white text-[11px]">
                            {time.toFixed(3)}
                          </div>
                          <div className="font-mono text-[9px] text-white/70">
                            {delta! < 0.001
                              ? "BEST"
                              : `+${delta!.toFixed(3)}`}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded bg-f1-card/30 px-2 py-1.5 text-center text-f1-text-muted">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 shrink-0 flex items-center justify-center gap-4 text-[10px] text-f1-text-muted">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-5 rounded-sm"
            style={{ backgroundColor: "rgba(168, 85, 247, 0.85)" }}
          />
          <span>Overall best</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-5 rounded-sm"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.7)" }}
          />
          <span>Close</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-5 rounded-sm"
            style={{ backgroundColor: "rgba(234, 179, 8, 0.6)" }}
          />
          <span>Mid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-5 rounded-sm"
            style={{ backgroundColor: "rgba(220, 38, 38, 0.5)" }}
          />
          <span>Far off</span>
        </div>
      </div>
    </div>
  );
}
