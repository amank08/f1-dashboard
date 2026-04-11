import type { Driver, LapData, Position, Stint } from "@/lib/openf1/types";
import { getPositionChanges } from "@/lib/utils/analytics";

export interface GridVsFinishDatum {
  name: string;
  gridPos: number;
  finishPos: number;
  teamColour: string;
  teamName?: string;
  change: number;
}

export interface SessionSummary {
  changes: Array<{
    driverNumber: number;
    gridPos: number;
    finishPos: number;
    change: number;
  }>;
  gridMap: Map<number, number>;
  finishMap: Map<number, number>;
  totalLaps: number;
  gridVsFinishData: GridVsFinishDatum[];
}

export function buildSessionSummary(
  drivers: Driver[],
  positions: Position[],
  laps: LapData[],
  stints?: Stint[]
): SessionSummary {
  const sorted = [...positions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const gridMap = new Map<number, number>();
  const finishMap = new Map<number, number>();
  for (const p of sorted) {
    if (!gridMap.has(p.driver_number)) gridMap.set(p.driver_number, p.position);
    finishMap.set(p.driver_number, p.position);
  }

  const changes = getPositionChanges(gridMap, finishMap);

  const stintMax = stints
    ? Math.max(...stints.filter((s) => s.lap_end != null).map((s) => s.lap_end!), 0)
    : 0;
  const totalLaps = stintMax > 0
    ? stintMax
    : Math.max(...laps.map((l) => l.lap_number), 0);

  const driverLookup = new Map(drivers.map((d) => [d.driver_number, d]));
  const gridVsFinishData = changes.map((change) => {
    const driver = driverLookup.get(change.driverNumber);
    return {
      name: driver?.name_acronym ?? String(change.driverNumber),
      gridPos: change.gridPos,
      finishPos: change.finishPos,
      teamColour: driver?.team_colour ?? "888888",
      teamName: driver?.team_name,
      change: change.change,
    };
  });

  return {
    changes,
    gridMap,
    finishMap,
    totalLaps,
    gridVsFinishData,
  };
}
