import type { LapData, Stint, TireCompound } from "@/lib/openf1/types";

export interface DegradationPoint {
  stintLap: number; // lap number within stint (1, 2, 3...)
  lapTime: number;
  compound: TireCompound;
  driverNumber: number;
}

export function computeTireDegradation(
  laps: LapData[],
  stints: Stint[],
  driverNumber: number
): DegradationPoint[] {
  const driverLaps = laps.filter((l) => l.driver_number === driverNumber);
  const driverStints = stints.filter((s) => s.driver_number === driverNumber);
  const points: DegradationPoint[] = [];

  for (const stint of driverStints) {
    for (const lap of driverLaps) {
      if (
        stint.lap_start != null &&
        stint.lap_end != null &&
        stint.compound != null &&
        lap.lap_number >= stint.lap_start &&
        lap.lap_number <= stint.lap_end &&
        lap.lap_duration !== null &&
        !lap.is_pit_out_lap &&
        lap.lap_duration > 0 &&
        lap.lap_duration < 200 // filter unreasonable times (SC laps, etc.)
      ) {
        points.push({
          stintLap: lap.lap_number - stint.lap_start + 1,
          lapTime: lap.lap_duration,
          compound: stint.compound,
          driverNumber,
        });
      }
    }
  }

  return points;
}

export function computeDegradationRate(points: DegradationPoint[]): number {
  if (points.length < 3) return 0;
  // Simple linear regression: slope of lap time vs stint lap
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.stintLap, 0);
  const sumY = points.reduce((s, p) => s + p.lapTime, 0);
  const sumXY = points.reduce((s, p) => s + p.stintLap * p.lapTime, 0);
  const sumX2 = points.reduce((s, p) => s + p.stintLap ** 2, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
}
