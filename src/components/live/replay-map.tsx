"use client";

import { memo } from "react";
import type { Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";

interface ReplayMapProps {
  trackPath: string;
  viewBox: string;
  driverPositions: Map<number, { x: number; y: number }>;
  drivers: Driver[];
  sfLine?: { x1: number; y1: number; x2: number; y2: number };
  sectorTicks?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export const ReplayMap = memo(function ReplayMap({
  trackPath,
  viewBox,
  driverPositions,
  drivers,
  sfLine,
  sectorTicks,
}: ReplayMapProps) {
  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));

  return (
    <div className="relative w-full rounded-lg border border-f1-border bg-f1-surface p-4">
      <svg
        viewBox={viewBox}
        className="h-full w-full"
        style={{ aspectRatio: "1 / 1", maxHeight: "calc(100vh - 300px)" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Track outline */}
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
          const color = getTeamColor(driver.team_colour);

          return (
            <g key={driverNum}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={1.2}
                fill={color}
                stroke="#000"
                strokeWidth="0.2"
              />
              <text
                x={pos.x + 1.8}
                y={pos.y + 0.5}
                fill="#fff"
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
