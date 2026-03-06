"use client";

import type { Stint, Driver } from "@/lib/openf1/types";
import { TIRE_COLORS } from "@/lib/utils/colors";
import { getTeamColor } from "@/lib/utils/colors";

interface PitStrategyChartProps {
  stints: Stint[];
  drivers: Driver[];
  totalLaps: number;
}

export function PitStrategyChart({
  stints,
  drivers,
  totalLaps,
}: PitStrategyChartProps) {
  const driverLookup = new Map<number, Driver>();
  for (const d of drivers) {
    driverLookup.set(d.driver_number, d);
  }

  // Group stints by driver
  const stintsByDriver = new Map<number, Stint[]>();
  for (const stint of stints) {
    if (!stintsByDriver.has(stint.driver_number)) {
      stintsByDriver.set(stint.driver_number, []);
    }
    stintsByDriver.get(stint.driver_number)!.push(stint);
  }

  // Sort by driver number
  const sortedDrivers = Array.from(stintsByDriver.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div className="space-y-2 overflow-x-auto">
      {sortedDrivers.map(([driverNum, driverStints]) => {
        const driver = driverLookup.get(driverNum);
        return (
          <div key={driverNum} className="flex items-center gap-3">
            <div className="w-16 flex-shrink-0 text-right">
              <span
                className="text-sm font-bold"
                style={{
                  color: driver ? getTeamColor(driver.team_colour) : "#888",
                }}
              >
                {driver?.name_acronym ?? driverNum}
              </span>
            </div>
            <div className="flex h-8 flex-1 overflow-hidden rounded">
              {driverStints
                .sort((a, b) => a.stint_number - b.stint_number)
                .map((stint) => {
                  const width =
                    ((stint.lap_end - stint.lap_start + 1) / totalLaps) * 100;
                  return (
                    <div
                      key={stint.stint_number}
                      className="flex items-center justify-center text-xs font-bold relative group"
                      style={{
                        width: `${width}%`,
                        backgroundColor: TIRE_COLORS[stint.compound] ?? "#666",
                        color:
                          stint.compound === "HARD" ||
                          stint.compound === "MEDIUM"
                            ? "#000"
                            : "#fff",
                      }}
                      title={`${stint.compound} | Laps ${stint.lap_start}-${stint.lap_end} (${stint.lap_end - stint.lap_start + 1} laps)`}
                    >
                      {width > 8 && (
                        <span className="truncate px-1">
                          {stint.compound.charAt(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 pt-4 text-xs">
        {(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const).map(
          (compound) => (
            <div key={compound} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: TIRE_COLORS[compound] }}
              />
              <span className="text-f1-text-secondary">{compound}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
