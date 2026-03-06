"use client";

import type { Driver, LapData, Position } from "@/lib/openf1/types";
import { formatLapTime } from "@/lib/utils/formatters";
import { getTeamColor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

interface ResultRow {
  position: number;
  driver: Driver;
  fastestLap: number | null;
  totalTime: number | null;
}

export function buildResults(
  positions: Position[],
  drivers: Driver[],
  laps: LapData[]
): ResultRow[] {
  // Get final position for each driver
  const finalPositions = new Map<number, number>();
  for (const pos of positions) {
    finalPositions.set(pos.driver_number, pos.position);
  }

  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) {
    driverLookup.set(d.driver_number, d);
  }

  // Calculate fastest lap per driver
  const fastestLaps = new Map<number, number>();
  for (const lap of laps) {
    if (lap.lap_duration && !lap.is_pit_out_lap) {
      const current = fastestLaps.get(lap.driver_number);
      if (!current || lap.lap_duration < current) {
        fastestLaps.set(lap.driver_number, lap.lap_duration);
      }
    }
  }

  const results: ResultRow[] = [];
  for (const [driverNum, position] of finalPositions) {
    const driver = driverLookup.get(driverNum);
    if (!driver) continue;
    results.push({
      position,
      driver,
      fastestLap: fastestLaps.get(driverNum) ?? null,
      totalTime: null,
    });
  }

  return results.sort((a, b) => a.position - b.position);
}

export function ResultsTable({ results }: { results: ResultRow[] }) {
  const overallFastest = Math.min(
    ...results.filter((r) => r.fastestLap).map((r) => r.fastestLap!)
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-f1-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-f1-border bg-f1-card text-f1-text-muted">
            <th className="px-4 py-3 text-left font-semibold">POS</th>
            <th className="px-4 py-3 text-left font-semibold">DRIVER</th>
            <th className="px-4 py-3 text-left font-semibold">TEAM</th>
            <th className="px-4 py-3 text-right font-semibold">FASTEST LAP</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr
              key={row.driver.driver_number}
              className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
            >
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "font-bold",
                    row.position === 1 && "text-yellow-400",
                    row.position === 2 && "text-gray-300",
                    row.position === 3 && "text-amber-600"
                  )}
                >
                  {row.position}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-1 rounded-full"
                    style={{
                      backgroundColor: getTeamColor(row.driver.team_colour),
                    }}
                  />
                  <div>
                    <span className="font-bold">{row.driver.name_acronym}</span>
                    <span className="ml-2 text-f1-text-secondary">
                      {row.driver.first_name} {row.driver.last_name}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-f1-text-secondary">
                {row.driver.team_name}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={cn(
                    "font-mono",
                    row.fastestLap === overallFastest && "text-purple-400"
                  )}
                >
                  {formatLapTime(row.fastestLap)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
