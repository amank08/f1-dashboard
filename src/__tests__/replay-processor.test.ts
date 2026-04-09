import { describe, expect, it } from "vitest";
import type { LapData, Position, RaceControlMessage } from "@/lib/openf1/types";
import {
  getQualifyingKnockoutPosition,
  getRetiredDrivers,
  type ReplayTimingSnapshot,
} from "@/lib/utils/replay-processor";

function msg(
  date: string,
  overrides: Partial<RaceControlMessage>
): RaceControlMessage {
  return {
    meeting_key: 1,
    session_key: 1,
    date,
    driver_number: null,
    lap_number: null,
    category: "Other",
    flag: null,
    scope: null,
    sector: null,
    qualifying_phase: null,
    message: "",
    ...overrides,
  };
}

function position(
  date: string,
  driver_number: number,
  place: number
): Position {
  return {
    date,
    session_key: 1,
    meeting_key: 1,
    driver_number,
    position: place,
  };
}

function lap(date_start: string, driver_number: number, lap_number: number): LapData {
  return {
    meeting_key: 1,
    session_key: 1,
    driver_number,
    lap_number,
    date_start,
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

describe("getQualifyingKnockoutPosition", () => {
  it("returns undefined with no replay time", () => {
    expect(getQualifyingKnockoutPosition([], null)).toBeUndefined();
  });

  it("returns Q1 knockout threshold after the first phase start", () => {
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
    ];

    expect(
      getQualifyingKnockoutPosition(
        raceControl,
        Date.parse("2026-03-14T05:05:00.000Z")
      )
    ).toBe(16);
  });

  it("ignores red-flag resumptions within the same qualifying phase", () => {
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
      msg("2026-03-14T05:07:00.000Z", {
        category: "SessionStatus",
        message: "SESSION ABORTED",
      }),
      msg("2026-03-14T05:12:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
    ];

    expect(
      getQualifyingKnockoutPosition(
        raceControl,
        Date.parse("2026-03-14T05:13:00.000Z")
      )
    ).toBe(16);
  });

  it("returns Q2 knockout threshold only after chequered then next phase start", () => {
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
      msg("2026-03-14T05:18:00.000Z", {
        flag: "CHEQUERED",
        message: "CHEQUERED FLAG",
      }),
      msg("2026-03-14T05:25:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
    ];

    expect(
      getQualifyingKnockoutPosition(
        raceControl,
        Date.parse("2026-03-14T05:24:00.000Z")
      )
    ).toBe(16);

    expect(
      getQualifyingKnockoutPosition(
        raceControl,
        Date.parse("2026-03-14T05:26:00.000Z")
      )
    ).toBe(10);
  });

  it("returns undefined once Q3 has started", () => {
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
      msg("2026-03-14T05:18:00.000Z", {
        flag: "CHEQUERED",
        message: "CHEQUERED FLAG",
      }),
      msg("2026-03-14T05:25:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
      msg("2026-03-14T05:40:00.000Z", {
        flag: "CHEQUERED",
        message: "CHEQUERED FLAG",
      }),
      msg("2026-03-14T05:47:00.000Z", {
        category: "SessionStatus",
        message: "SESSION STARTED",
      }),
    ];

    expect(
      getQualifyingKnockoutPosition(
        raceControl,
        Date.parse("2026-03-14T05:48:00.000Z")
      )
    ).toBeUndefined();
  });
});

describe("getRetiredDrivers", () => {
  it("marks race drivers with no position data as DNS", () => {
    const timing: ReplayTimingSnapshot[] = [
      { driverNumber: 1, position: 1, currentLap: 10 },
      { driverNumber: 2, position: 2, currentLap: 5 },
    ];
    const positions = [position("2026-03-14T05:00:00.000Z", 1, 1)];

    expect(
      getRetiredDrivers(
        timing,
        [],
        Date.parse("2026-03-14T05:10:00.000Z"),
        false,
        [],
        positions
      )
    ).toEqual(new Map([[2, "DNS"]]));
  });

  it("marks race drivers as OUT when sufficiently behind and stale", () => {
    const timing: ReplayTimingSnapshot[] = [
      { driverNumber: 1, position: 1, currentLap: 20 },
      { driverNumber: 2, position: 2, currentLap: 10 },
    ];
    const positions = [
      position("2026-03-14T05:00:00.000Z", 1, 1),
      position("2026-03-14T05:00:00.000Z", 2, 2),
    ];
    const laps = [
      lap("2026-03-14T05:15:00.000Z", 1, 20),
      lap("2026-03-14T05:10:00.000Z", 2, 10),
    ];

    expect(
      getRetiredDrivers(
        timing,
        laps,
        Date.parse("2026-03-14T05:15:30.000Z"),
        false,
        [],
        positions
      )
    ).toEqual(new Map([[2, "OUT"]]));
  });

  it("marks Q1 eliminations after the 90 second buffer, including no-data drivers", () => {
    const timing: ReplayTimingSnapshot[] = Array.from({ length: 20 }, (_, index) => ({
      driverNumber: index + 1,
      position: index + 1,
      currentLap: 1,
    }));
    const positions = Array.from({ length: 19 }, (_, index) =>
      position("2026-03-14T05:18:00.000Z", index + 1, index + 1)
    );
    const raceControl = [
      msg("2026-03-14T05:18:00.000Z", {
        category: "SessionStatus",
        message: "SESSION FINISHED",
      }),
    ];

    const retired = getRetiredDrivers(
      timing,
      [],
      Date.parse("2026-03-14T05:19:31.000Z"),
      true,
      raceControl,
      positions
    );

    expect(retired.get(20)).toBe("Q1");
    expect(retired.get(19)).toBe("Q1");
    expect(retired.get(18)).toBe("Q1");
    expect(retired.size).toBe(6);
  });
});
