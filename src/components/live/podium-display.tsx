"use client";

import Image from "next/image";
import { getTeamColor, POSITION_COLORS } from "@/lib/utils/colors";
import type { Driver } from "@/lib/openf1/types";

interface PodiumEntry {
  position: number;
  driver: Driver;
}

interface PodiumDisplayProps {
  entries: PodiumEntry[];
}

export function PodiumDisplay({ entries }: PodiumDisplayProps) {
  if (entries.length === 0) return null;

  // Reorder for podium layout: P2, P1, P3 (P1 in center, taller)
  const ordered =
    entries.length >= 3
      ? [entries[1], entries[0], entries[2]]
      : entries;

  return (
    <div className="flex items-end justify-center gap-3">
      {ordered.map((entry) => {
        const color = getTeamColor(
          entry.driver.team_colour,
          entry.driver.team_name
        );
        const posColor = POSITION_COLORS[entry.position] ?? "#888";
        const isP1 = entry.position === 1;

        return (
          <div
            key={entry.driver.driver_number}
            className="flex flex-col items-center"
            style={{ width: isP1 ? 148 : 124 }}
          >
            {/* Portrait */}
            <div
              className="relative overflow-hidden rounded-xl border-2"
              style={{
                borderColor: color,
                width: isP1 ? 128 : 104,
                height: isP1 ? 168 : 136,
                backgroundColor: "var(--f1-card)",
                boxShadow: `0 0 18px 3px ${color}55, 0 4px 16px rgba(0,0,0,0.5)`,
              }}
            >
              {entry.driver.headshot_url ? (
                <Image
                  src={entry.driver.headshot_url}
                  alt={entry.driver.full_name}
                  fill
                  className="object-cover object-top"
                  sizes={isP1 ? "128px" : "104px"}
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-f1-text-muted">
                  {entry.driver.name_acronym}
                </div>
              )}
              {/* Bottom gradient overlay */}
              <div
                className="absolute bottom-0 left-0 right-0 h-12"
                style={{
                  background: `linear-gradient(to top, ${color}99 0%, transparent 100%)`,
                }}
              />
            </div>

            {/* Podium block */}
            <div
              className="mt-2 flex w-full flex-col items-center rounded-md px-2 py-1.5"
              style={{ backgroundColor: `${color}22`, borderTop: `3px solid ${color}` }}
            >
              <span
                className="text-lg font-black"
                style={{ color: posColor }}
              >
                P{entry.position}
              </span>
              <span className="text-sm font-bold text-white">
                {entry.driver.name_acronym}
              </span>
              <span className="text-[10px] text-f1-text-secondary truncate max-w-full">
                {entry.driver.team_name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
