"use client";

import { CustomSelect } from "@/components/ui/custom-select";

const SEASONS = [2026, 2025, 2024, 2023];

const OPTIONS = SEASONS.map((year) => ({
  value: String(year),
  label: `${year} Season`,
}));

export function SeasonSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (year: number) => void;
}) {
  return (
    <CustomSelect
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={OPTIONS}
      className="w-40"
    />
  );
}
