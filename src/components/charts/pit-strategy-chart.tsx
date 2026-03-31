"use client";

import type { Stint, Driver } from "@/lib/openf1/types";
import { TIRE_COLORS } from "@/lib/utils/colors";
import { getTeamColor } from "@/lib/utils/colors";

interface PitStrategyChartProps {
  stints: Stint[];
  drivers: Driver[];
  totalLaps: number;
  /** Driver numbers in finishing order (P1 first). Falls back to driver number sort. */
  finishOrder?: number[];
}

export function PitStrategyChart({
  stints,
  drivers,
  totalLaps,
  finishOrder,
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

  // Merge consecutive same-compound stints. Ghost stints from SC-through-pit-lane,
  // red flags, and formation lap chaos all produce spurious stint splits on the
  // same compound. Legitimate same-compound double-stints are extremely rare in F1.
  for (const [dn, driverStints] of stintsByDriver) {
    driverStints.sort((a, b) => a.stint_number - b.stint_number);
    const merged: Stint[] = [];
    for (const stint of driverStints) {
      const prev = merged[merged.length - 1];
      if (prev && prev.compound === stint.compound) {
        prev.lap_end = stint.lap_end;
      } else {
        merged.push({ ...stint });
      }
    }
    stintsByDriver.set(dn, merged);
  }

  // Sort by finishing order if available, otherwise by driver number
  const sortedDrivers = Array.from(stintsByDriver.entries()).sort(
    ([a], [b]) => {
      if (finishOrder) {
        const ai = finishOrder.indexOf(a);
        const bi = finishOrder.indexOf(b);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      }
      return a - b;
    }
  );

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
        Tyre Strategy
      </h3>
      <div className="max-h-[320px] space-y-2 overflow-y-auto overflow-x-auto">
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
            <div className="flex h-8 flex-1 overflow-hidden rounded gap-px bg-f1-bg">
              {driverStints
                .filter((s) => s.lap_start != null && s.lap_end != null)
                .sort((a, b) => a.stint_number - b.stint_number)
                .map((stint, i) => {
                  const width =
                    ((stint.lap_end! - stint.lap_start! + 1) / totalLaps) * 100;
                  const laps = stint.lap_end! - stint.lap_start! + 1;
                  return (
                    <div
                      key={stint.stint_number}
                      className="flex items-center justify-center text-xs font-bold relative group"
                      style={{
                        width: `${width}%`,
                        backgroundColor: stint.compound ? TIRE_COLORS[stint.compound] : "#666",
                        filter: i % 2 === 1 ? "brightness(0.85)" : undefined,
                        color:
                          stint.compound === "HARD" ||
                          stint.compound === "MEDIUM"
                            ? "#000"
                            : "#fff",
                      }}
                      title={`${stint.compound ?? "Unknown"} | Laps ${stint.lap_start}-${stint.lap_end} (${laps} laps)`}
                    >
                      {width > 8 && (
                        <span className="truncate px-1">
                          {stint.compound ? stint.compound.charAt(0) : "?"}
                          {width > 14 && (
                            <span className="font-normal opacity-70 ml-0.5 text-[10px]">
                              {laps}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      </div>
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
