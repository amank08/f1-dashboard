import { describe, expect, it } from "vitest";
import type { Driver, LapData, Position, Stint } from "@/lib/openf1/types";
import { buildSessionSummary } from "@/lib/utils/session-summary";

function driver(driver_number: number, acronym: string, team_name: string, team_colour: string): Driver {
  return {
    meeting_key: 1,
    session_key: 1,
    driver_number,
    broadcast_name: acronym,
    full_name: acronym,
    name_acronym: acronym,
    team_name,
    team_colour,
    first_name: acronym,
    last_name: acronym,
    headshot_url: null,
    country_code: "GBR",
  };
}

function position(date: string, driver_number: number, place: number): Position {
  return {
    date,
    session_key: 1,
    meeting_key: 1,
    driver_number,
    position: place,
  };
}

function lap(driver_number: number, lap_number: number): LapData {
  return {
    meeting_key: 1,
    session_key: 1,
    driver_number,
    lap_number,
    date_start: `2026-03-14T05:${String(lap_number).padStart(2, "0")}:00.000Z`,
    duration_sector_1: null,
    duration_sector_2: null,
    duration_sector_3: null,
    i1_speed: null,
    i2_speed: null,
    is_pit_out_lap: false,
    lap_duration: 90,
    segments_sector_1: [],
    segments_sector_2: [],
    segments_sector_3: [],
    st_speed: null,
  };
}

function stint(driver_number: number, lap_end: number): Stint {
  return {
    meeting_key: 1,
    session_key: 1,
    stint_number: 1,
    driver_number,
    lap_start: 1,
    lap_end,
    compound: "MEDIUM",
    tyre_age_at_start: 0,
  };
}

describe("buildSessionSummary", () => {
  it("builds grid/finish changes and chart rows", () => {
    const drivers = [
      driver(1, "VER", "Red Bull Racing", "3671C6"),
      driver(4, "NOR", "McLaren", "FF8000"),
    ];
    const positions = [
      position("2026-03-14T05:00:00.000Z", 1, 2),
      position("2026-03-14T05:00:00.000Z", 4, 1),
      position("2026-03-14T06:00:00.000Z", 1, 1),
      position("2026-03-14T06:00:00.000Z", 4, 2),
    ];
    const laps = [lap(1, 57), lap(4, 57)];

    const summary = buildSessionSummary(drivers, positions, laps);

    expect(summary.totalLaps).toBe(57);
    expect(summary.gridMap.get(1)).toBe(2);
    expect(summary.finishMap.get(1)).toBe(1);
    expect(summary.changes).toEqual([
      { driverNumber: 1, gridPos: 2, finishPos: 1, change: 1 },
      { driverNumber: 4, gridPos: 1, finishPos: 2, change: -1 },
    ]);
    expect(summary.gridVsFinishData).toEqual([
      {
        name: "VER",
        gridPos: 2,
        finishPos: 1,
        teamColour: "3671C6",
        teamName: "Red Bull Racing",
        change: 1,
      },
      {
        name: "NOR",
        gridPos: 1,
        finishPos: 2,
        teamColour: "FF8000",
        teamName: "McLaren",
        change: -1,
      },
    ]);
  });

  it("prefers stint lap_end over lap entries for total laps", () => {
    const drivers = [driver(1, "VER", "Red Bull Racing", "3671C6")];
    const positions = [
      position("2026-03-14T05:00:00.000Z", 1, 1),
      position("2026-03-14T06:00:00.000Z", 1, 1),
    ];
    const laps = [lap(1, 56)];
    const stints = [stint(1, 58)];

    const summary = buildSessionSummary(drivers, positions, laps, stints);

    expect(summary.totalLaps).toBe(58);
  });
});
