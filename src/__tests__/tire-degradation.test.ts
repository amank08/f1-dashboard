import { describe, it, expect } from "vitest";
import {
  computeTireDegradation,
  computeDegradationRate,
} from "@/lib/utils/tire-degradation";
import type { LapData, Stint } from "@/lib/openf1/types";

describe("computeTireDegradation", () => {
  const makeStint = (overrides: Partial<Stint> = {}): Stint =>
    ({
      driver_number: 1,
      lap_start: 1,
      lap_end: 5,
      compound: "SOFT",
      stint_number: 1,
      tyre_age_at_start: 0,
      ...overrides,
    }) as Stint;

  const makeLap = (overrides: Partial<LapData> = {}): LapData =>
    ({
      driver_number: 1,
      lap_number: 1,
      lap_duration: 90.0,
      is_pit_out_lap: false,
      ...overrides,
    }) as LapData;

  it("filters pit out laps", () => {
    const laps = [makeLap({ is_pit_out_lap: true })];
    const stints = [makeStint()];
    expect(computeTireDegradation(laps, stints, 1)).toHaveLength(0);
  });

  it("filters unreasonable lap times (>200s)", () => {
    const laps = [makeLap({ lap_duration: 250 })];
    const stints = [makeStint()];
    expect(computeTireDegradation(laps, stints, 1)).toHaveLength(0);
  });

  it("computes stint lap numbers correctly", () => {
    const laps = [
      makeLap({ lap_number: 3, lap_duration: 91.0 }),
      makeLap({ lap_number: 4, lap_duration: 92.0 }),
    ];
    const stints = [makeStint({ lap_start: 3, lap_end: 5 })];
    const result = computeTireDegradation(laps, stints, 1);
    expect(result[0].stintLap).toBe(1);
    expect(result[1].stintLap).toBe(2);
  });
});

describe("computeDegradationRate", () => {
  it("returns 0 for fewer than 3 points", () => {
    expect(computeDegradationRate([])).toBe(0);
    expect(
      computeDegradationRate([
        { stintLap: 1, lapTime: 90, compound: "SOFT", driverNumber: 1 },
      ])
    ).toBe(0);
  });

  it("computes positive slope for degrading tires", () => {
    const points = [
      { stintLap: 1, lapTime: 90, compound: "SOFT" as const, driverNumber: 1 },
      { stintLap: 2, lapTime: 91, compound: "SOFT" as const, driverNumber: 1 },
      { stintLap: 3, lapTime: 92, compound: "SOFT" as const, driverNumber: 1 },
    ];
    expect(computeDegradationRate(points)).toBeCloseTo(1.0);
  });
});
