"use client";

import type { Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

interface ComparisonSelectorProps {
  drivers: Driver[];
  driver1: number | null;
  driver2: number | null;
  onDriver1Change: (num: number) => void;
  onDriver2Change: (num: number) => void;
}

export function ComparisonSelector({
  drivers,
  driver1,
  driver2,
  onDriver1Change,
  onDriver2Change,
}: ComparisonSelectorProps) {
  const uniqueDrivers = drivers.filter(
    (d, i, arr) =>
      arr.findIndex((x) => x.driver_number === d.driver_number) === i
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-f1-text-muted">
          Driver 1
        </label>
        <select
          value={driver1 ?? ""}
          onChange={(e) => onDriver1Change(Number(e.target.value))}
          className="rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-sm font-semibold text-f1-text focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
        >
          <option value="" disabled>
            Select driver
          </option>
          {uniqueDrivers.map((d) => (
            <option key={d.driver_number} value={d.driver_number}>
              {d.name_acronym} — {d.team_name}
            </option>
          ))}
        </select>
      </div>
      <span className="text-lg font-bold text-f1-text-muted">vs</span>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-f1-text-muted">
          Driver 2
        </label>
        <select
          value={driver2 ?? ""}
          onChange={(e) => onDriver2Change(Number(e.target.value))}
          className="rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-sm font-semibold text-f1-text focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
        >
          <option value="" disabled>
            Select driver
          </option>
          {uniqueDrivers.map((d) => (
            <option key={d.driver_number} value={d.driver_number}>
              {d.name_acronym} — {d.team_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
