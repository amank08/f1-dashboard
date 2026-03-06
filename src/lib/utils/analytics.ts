import type { LapData, Position, RaceControlMessage, Session } from "@/lib/openf1/types";
import { RACE_POINTS } from "./constants";

export interface DriverSeasonStats {
  driverNumber: number;
  name: string;
  acronym: string;
  team: string;
  teamColour: string;
  qualifyingPositions: number[];
  racePositions: number[];
  avgQualifyingPos: number;
  avgRacePos: number;
  wins: number;
  podiums: number;
  dnfs: number;
  poles: number;
  poleToWinRate: number;
  consistencyScore: number; // standard deviation of finishing positions
}

export function computeConsistencyScore(positions: number[]): number {
  if (positions.length < 2) return 0;
  const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
  const variance = positions.reduce((sum, p) => sum + (p - mean) ** 2, 0) / positions.length;
  return Math.sqrt(variance);
}

export function computePoleToWinRate(poles: number, poleWins: number): number {
  if (poles === 0) return 0;
  return (poleWins / poles) * 100;
}

export interface HeadToHeadResult {
  raceName: string;
  meetingKey: number;
  driver1Pos: number | null;
  driver2Pos: number | null;
}

export function computeHeadToHead(
  results: HeadToHeadResult[]
): { driver1Wins: number; driver2Wins: number; ties: number } {
  let driver1Wins = 0;
  let driver2Wins = 0;
  let ties = 0;
  for (const r of results) {
    if (r.driver1Pos === null || r.driver2Pos === null) continue;
    if (r.driver1Pos < r.driver2Pos) driver1Wins++;
    else if (r.driver2Pos < r.driver1Pos) driver2Wins++;
    else ties++;
  }
  return { driver1Wins, driver2Wins, ties };
}

export function countSafetyCars(messages: RaceControlMessage[]): number {
  return messages.filter(
    (m) =>
      m.category === "SafetyCar" ||
      m.message.includes("SAFETY CAR") ||
      m.message.includes("VSC")
  ).length;
}

export function countPenalties(messages: RaceControlMessage[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const m of messages) {
    if (
      (m.category === "Penalty" || m.message.toLowerCase().includes("penalty")) &&
      m.driver_number
    ) {
      counts.set(m.driver_number, (counts.get(m.driver_number) ?? 0) + 1);
    }
  }
  return counts;
}

export function getPositionChanges(
  gridPositions: Map<number, number>,
  finishPositions: Map<number, number>
): Array<{
  driverNumber: number;
  gridPos: number;
  finishPos: number;
  change: number;
}> {
  const results: Array<{
    driverNumber: number;
    gridPos: number;
    finishPos: number;
    change: number;
  }> = [];
  for (const [driverNum, gridPos] of gridPositions) {
    const finishPos = finishPositions.get(driverNum);
    if (finishPos !== undefined) {
      results.push({
        driverNumber: driverNum,
        gridPos,
        finishPos,
        change: gridPos - finishPos,
      });
    }
  }
  return results.sort((a, b) => a.finishPos - b.finishPos);
}
