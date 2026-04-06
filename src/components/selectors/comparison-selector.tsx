"use client";

import type { Driver } from "@/lib/openf1/types";
import { CustomSelect } from "@/components/ui/custom-select";

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

  const options = uniqueDrivers.map((d) => ({
    value: String(d.driver_number),
    label: `${d.name_acronym} — ${d.team_name}`,
  }));

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-f1-text-muted">
          Driver 1
        </label>
        <CustomSelect
          value={driver1?.toString() ?? ""}
          onChange={(v) => onDriver1Change(Number(v))}
          placeholder="Select driver"
          className="w-52"
          options={options}
        />
      </div>
      <span className="text-lg font-bold text-f1-text-muted">vs</span>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-f1-text-muted">
          Driver 2
        </label>
        <CustomSelect
          value={driver2?.toString() ?? ""}
          onChange={(v) => onDriver2Change(Number(v))}
          placeholder="Select driver"
          className="w-52"
          options={options}
        />
      </div>
    </div>
  );
}
