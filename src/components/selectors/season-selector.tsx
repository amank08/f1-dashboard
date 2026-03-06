"use client";

import { cn } from "@/lib/utils/cn";

const SEASONS = [2026, 2025, 2024, 2023];

export function SeasonSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (year: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-sm font-semibold text-f1-text",
        "focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
      )}
    >
      {SEASONS.map((year) => (
        <option key={year} value={year}>
          {year} Season
        </option>
      ))}
    </select>
  );
}
