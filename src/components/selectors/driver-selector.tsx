"use client";

import type { Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

export function DriverSelector({
  drivers,
  selected,
  onChange,
  max = 4,
}: {
  drivers: Driver[];
  selected: number[];
  onChange: (driverNumbers: number[]) => void;
  max?: number;
}) {
  const toggle = (driverNumber: number) => {
    if (selected.includes(driverNumber)) {
      onChange(selected.filter((n) => n !== driverNumber));
    } else if (selected.length < max) {
      onChange([...selected, driverNumber]);
    }
  };

  // Deduplicate by driver_number
  const unique = drivers.filter(
    (d, i, arr) =>
      arr.findIndex((x) => x.driver_number === d.driver_number) === i
  );

  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((driver) => {
        const isSelected = selected.includes(driver.driver_number);
        return (
          <button
            key={driver.driver_number}
            onClick={() => toggle(driver.driver_number)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-bold transition-all",
              isSelected
                ? "border-transparent text-white"
                : "border-f1-border bg-f1-surface text-f1-text-secondary hover:text-f1-text"
            )}
            style={
              isSelected
                ? { backgroundColor: getTeamColor(driver.team_colour, driver.team_name) }
                : undefined
            }
          >
            {driver.name_acronym}
          </button>
        );
      })}
    </div>
  );
}
