import { describe, it, expect } from "vitest";
import {
  computeConsistencyScore,
  computePoleToWinRate,
  computeHeadToHead,
  countSafetyCars,
  countPenalties,
  getPositionChanges,
} from "@/lib/utils/analytics";
import type { RaceControlMessage } from "@/lib/openf1/types";

describe("computeConsistencyScore", () => {
  it("returns 0 for fewer than 2 positions", () => {
    expect(computeConsistencyScore([1])).toBe(0);
    expect(computeConsistencyScore([])).toBe(0);
  });

  it("returns 0 for identical positions", () => {
    expect(computeConsistencyScore([3, 3, 3])).toBe(0);
  });

  it("computes standard deviation correctly", () => {
    // [1, 3] → mean 2, variance 1, std 1
    expect(computeConsistencyScore([1, 3])).toBe(1);
  });
});

describe("computePoleToWinRate", () => {
  it("returns 0 when no poles", () => {
    expect(computePoleToWinRate(0, 0)).toBe(0);
  });

  it("calculates percentage correctly", () => {
    expect(computePoleToWinRate(10, 5)).toBe(50);
  });
});

describe("computeHeadToHead", () => {
  it("counts wins correctly", () => {
    const results = [
      { raceName: "R1", meetingKey: 1, driver1Pos: 1, driver2Pos: 3 },
      { raceName: "R2", meetingKey: 2, driver1Pos: 5, driver2Pos: 2 },
      { raceName: "R3", meetingKey: 3, driver1Pos: 4, driver2Pos: 4 },
    ];
    expect(computeHeadToHead(results)).toEqual({
      driver1Wins: 1,
      driver2Wins: 1,
      ties: 1,
    });
  });

  it("skips races with null positions", () => {
    const results = [
      { raceName: "R1", meetingKey: 1, driver1Pos: null, driver2Pos: 3 },
    ];
    expect(computeHeadToHead(results)).toEqual({
      driver1Wins: 0,
      driver2Wins: 0,
      ties: 0,
    });
  });
});

describe("countSafetyCars", () => {
  it("counts safety car messages", () => {
    const messages = [
      { category: "SafetyCar", message: "SAFETY CAR DEPLOYED" },
      { category: "Flag", message: "GREEN FLAG" },
      { category: "Other", message: "VSC DEPLOYED" },
    ] as RaceControlMessage[];
    expect(countSafetyCars(messages)).toBe(2);
  });
});

describe("countPenalties", () => {
  it("counts penalties per driver", () => {
    const messages = [
      { category: "Penalty", message: "5s penalty", driver_number: 44 },
      { category: "Penalty", message: "10s penalty", driver_number: 44 },
      { category: "Penalty", message: "5s penalty", driver_number: 1 },
    ] as RaceControlMessage[];
    const counts = countPenalties(messages);
    expect(counts.get(44)).toBe(2);
    expect(counts.get(1)).toBe(1);
  });
});

describe("getPositionChanges", () => {
  it("calculates position changes sorted by finish", () => {
    const grid = new Map([[44, 3], [1, 1]]);
    const finish = new Map([[44, 1], [1, 2]]);
    const changes = getPositionChanges(grid, finish);
    expect(changes).toEqual([
      { driverNumber: 44, gridPos: 3, finishPos: 1, change: 2 },
      { driverNumber: 1, gridPos: 1, finishPos: 2, change: -1 },
    ]);
  });
});
