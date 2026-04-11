import { describe, expect, it } from "vitest";
import type { Driver, Interval, LapData, Position, RaceControlMessage, Stint } from "@/lib/openf1/types";
import {
  buildReplayTimingEntries,
  filterDeletedLapTimes,
  filterReplayRaceControl,
} from "@/lib/utils/live-session-analysis";

function driver(driver_number: number, acronym: string): Driver {
  return {
    meeting_key: 1,
    session_key: 1,
    driver_number,
    broadcast_name: acronym,
    full_name: acronym,
    name_acronym: acronym,
    team_name: "McLaren",
    team_colour: "FF8000",
    first_name: acronym,
    last_name: acronym,
    headshot_url: null,
    country_code: "GBR",
  };
}

function lap(
  driver_number: number,
  lap_number: number,
  date_start: string,
  lap_duration: number | null
): LapData {
  return {
    meeting_key: 1,
    session_key: 1,
    driver_number,
    lap_number,
    date_start,
    duration_sector_1: 30,
    duration_sector_2: 30,
    duration_sector_3: 30,
    i1_speed: null,
    i2_speed: null,
    is_pit_out_lap: false,
    lap_duration,
    segments_sector_1: [2049],
    segments_sector_2: [2049],
    segments_sector_3: [2049],
    st_speed: null,
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

function interval(date: string, driver_number: number, gap: number | string | null): Interval {
  return {
    date,
    session_key: 1,
    meeting_key: 1,
    driver_number,
    gap_to_leader: gap,
    interval: gap,
  };
}

function stint(driver_number: number, lap_start: number, lap_end: number): Stint {
  return {
    meeting_key: 1,
    session_key: 1,
    stint_number: 1,
    driver_number,
    lap_start,
    lap_end,
    compound: "MEDIUM",
    tyre_age_at_start: 0,
  };
}

function msg(date: string, message: string): RaceControlMessage {
  return {
    meeting_key: 1,
    session_key: 1,
    date,
    driver_number: null,
    lap_number: null,
    category: "SessionStatus",
    flag: null,
    scope: null,
    sector: null,
    qualifying_phase: null,
    message,
  };
}

describe("filterDeletedLapTimes", () => {
  it("nulls out deleted laps", () => {
    const laps = [lap(4, 1, "2026-03-14T05:00:00.000Z", 90.123)];
    const raceControl = [
      { ...msg("2026-03-14T05:02:00.000Z", "CAR 4 TIME 1:30.123 DELETED"), category: "Other" },
    ];

    const filtered = filterDeletedLapTimes(laps, raceControl);

    expect(filtered?.[0].lap_duration).toBeNull();
  });
});

describe("buildReplayTimingEntries", () => {
  it("filters replay data to the cutoff and current qualifying phase", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [
      position("2026-03-14T05:05:00.000Z", 4, 1),
      position("2026-03-14T05:30:00.000Z", 4, 2),
    ];
    const intervals = [
      interval("2026-03-14T05:05:00.000Z", 4, 0),
      interval("2026-03-14T05:30:00.000Z", 4, 1.2),
    ];
    const stints = [stint(4, 1, 3)];
    const laps = [
      lap(4, 1, "2026-03-14T05:10:00.000Z", 90),
      lap(4, 2, "2026-03-14T05:28:00.000Z", 89),
      lap(4, 3, "2026-03-14T05:50:00.000Z", 88),
    ];
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", "SESSION STARTED"),
      { ...msg("2026-03-14T05:18:00.000Z", "CHEQUERED FLAG"), category: "Other" },
      msg("2026-03-14T05:25:00.000Z", "SESSION STARTED"),
    ];

    const entries = buildReplayTimingEntries(
      drivers,
      positions,
      intervals,
      stints,
      laps,
      Date.parse("2026-03-14T05:35:00.000Z"),
      true,
      raceControl
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].position).toBe(2);
    expect(entries[0].currentLap).toBe(2);
    expect(entries[0].bestLap).toBe(89);
  });
});

describe("filterReplayRaceControl", () => {
  it("returns only messages up to the replay time", () => {
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", "SESSION STARTED"),
      msg("2026-03-14T05:10:00.000Z", "TRACK CLEAR"),
    ];

    const filtered = filterReplayRaceControl(
      raceControl,
      Date.parse("2026-03-14T05:05:00.000Z")
    );

    expect(filtered).toEqual([raceControl[0]]);
  });
});
