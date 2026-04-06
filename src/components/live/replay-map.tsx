"use client";

import { memo } from "react";
import type { Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";

const FLAG_COLORS: Record<string, string> = {
  yellow: "#FACC15",
  vsc: "#FACC15",
  sc: "#FACC15",
  red: "#EF4444",
};

interface ReplayMapProps {
  trackPath: string;
  viewBox: string;
  driverPositions: Map<number, { x: number; y: number }>;
  drivers: Driver[];
  sfLine?: { x1: number; y1: number; x2: number; y2: number };
  sectorTicks?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  sectorPaths?: [string, string, string];
  trackFlagStatus?: [string | null, string | null, string | null];
  driverLapStatus?: Map<number, "leader" | "lapped" | "retired" | null>;
}

export const ReplayMap = memo(function ReplayMap({
  trackPath,
  viewBox,
  driverPositions,
  drivers,
  sfLine,
  sectorTicks,
  sectorPaths,
  trackFlagStatus,
  driverLapStatus,
}: ReplayMapProps) {
  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));
  const hasActiveFlag = trackFlagStatus?.some((f) => f !== null) ?? false;

  return (
    <div className="relative w-full rounded-lg border border-f1-border bg-f1-surface p-4">
      <svg
        viewBox={viewBox}
        className="h-full w-full"
        style={{ aspectRatio: "1 / 1", maxHeight: "calc(100vh - 300px)" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Track outline — dimmed when sector paths are showing flags */}
        {trackPath && (
          <path
            d={trackPath}
            fill="none"
            stroke="var(--f1-text-muted)"
            strokeWidth="0.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Sector-colored overlays when flags are active */}
        {hasActiveFlag && sectorPaths?.map((path, si) => {
          const flag = trackFlagStatus?.[si];
          if (!flag) return null;
          const color = FLAG_COLORS[flag];
          if (!color) return null;
          return (
            <path
              key={`sector-flag-${si}`}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.8}
            />
          );
        })}

        {/* Sector boundary ticks (short, subdued) */}
        {sectorTicks?.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="var(--f1-text-muted)"
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        ))}

        {/* Start/finish line — bright and a bit longer than sector ticks */}
        {sfLine && (
          <line
            x1={sfLine.x1}
            y1={sfLine.y1}
            x2={sfLine.x2}
            y2={sfLine.y2}
            stroke="#fff"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        )}

        {/* Car dots and labels */}
        {Array.from(driverPositions.entries()).map(([driverNum, pos]) => {
          const driver = driverMap.get(driverNum);
          if (!driver) return null;
          const color = getTeamColor(driver.team_colour, driver.team_name);
          const status = driverLapStatus?.get(driverNum);
          const isRetired = status === "retired";
          const textColor = isRetired
            ? "#EF4444"
            : status === "leader"
              ? "#FFD700"
              : status === "lapped"
                ? "#7DD3FC"
                : "#fff";

          return (
            <g key={driverNum} opacity={isRetired ? 0.4 : 1}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={1.2}
                fill={isRetired ? "#EF4444" : color}
                stroke="#000"
                strokeWidth="0.2"
              />
              <text
                x={pos.x + 1.8}
                y={pos.y + 0.5}
                fill={textColor}
                fontSize="2"
                fontWeight="600"
                fontFamily="inherit"
              >
                {driver.name_acronym}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});
