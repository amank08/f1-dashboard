import { describe, expect, it } from "vitest";
import type { Driver, Interval, LapData, Position, RaceControlMessage, Stint } from "@/lib/openf1/types";
import { buildTimingData } from "@/components/live/timing-board";
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
    expect(entries[0].position).toBe(1);
    expect(entries[0].currentLap).toBe(2);
    expect(entries[0].bestLap).toBe(89);
  });

  it("fills a completed sector's trailing mini-sector when the latest lap data is short", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:00.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:10:00.000Z", 90),
        duration_sector_1: 30,
        segments_sector_1: [2049, 2049, 2049],
      },
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", 89),
        duration_sector_1: 30,
        segments_sector_1: [2049, 2051],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:28:31.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].segments[0]).toEqual([2049, 2051, 2051]);
  });

  it("does not carry a previous phase best lap into early Q3", () => {
    const drivers = [driver(12, "ANT")];
    const positions = [position("2026-04-05T07:48:05.000Z", 12, 1)];
    const intervals: Interval[] = [];
    const stints = [stint(12, 1, 3)];
    const laps = [
      {
        ...lap(12, 8, "2026-04-05T07:33:00.000Z", 88.778),
        is_pit_out_lap: false,
      },
      {
        ...lap(12, 9, "2026-04-05T07:47:30.000Z", null),
        is_pit_out_lap: true,
      },
    ];
    const raceControl = [
      msg("2026-04-05T07:20:00.000Z", "SESSION STARTED"),
      { ...msg("2026-04-05T07:35:00.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
      msg("2026-04-05T07:40:00.000Z", "SESSION STARTED"),
      { ...msg("2026-04-05T07:45:00.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
      msg("2026-04-05T07:47:00.000Z", "SESSION STARTED"),
    ];

    const entries = buildReplayTimingEntries(
      drivers,
      positions,
      intervals,
      stints,
      laps,
      Date.parse("2026-04-05T07:48:00.000Z"),
      true,
      raceControl
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].bestLap).toBeNull();
  });

  it("keeps the previous completed lap as Last while a current outlap has blank sectors", () => {
    const drivers = [driver(12, "ANT")];
    const positions = [position("2026-04-05T07:48:05.000Z", 12, 1)];
    const laps = [
      {
        ...lap(12, 8, "2026-04-05T07:33:00.000Z", 88.778),
        is_pit_out_lap: false,
        duration_sector_1: 29.1,
        duration_sector_2: 29.6,
        duration_sector_3: 30.078,
      },
      {
        ...lap(12, 9, "2026-04-05T07:47:30.000Z", null),
        is_pit_out_lap: true,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-04-05T07:48:00.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].lastLap).toBe(88.778);
    expect(entries[0].sectorTimes).toEqual([null, null, null]);
  });

  it("does not expose last or best lap until the lap is completed at replay time", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:00.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", 89),
        is_pit_out_lap: false,
      },
    ];

    const beforeFinish = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:29:28.000Z"),
      laps
    );

    expect(beforeFinish).toHaveLength(1);
    expect(beforeFinish[0].lastLap).toBeNull();
    expect(beforeFinish[0].bestLap).toBeNull();

    const afterFinish = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:29:29.500Z"),
      laps
    );

    expect(afterFinish).toHaveLength(1);
    expect(afterFinish[0].lastLap).toBe(89);
    expect(afterFinish[0].bestLap).toBe(89);
  });

  it("reveals sector times only after that sector would complete live", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:00.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:26:00.000Z", 92),
        duration_sector_1: 31,
        duration_sector_2: 30,
        duration_sector_3: 31,
      },
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", 89),
        duration_sector_1: 30,
        duration_sector_2: 29,
        duration_sector_3: 30,
      },
    ];

    const beforeS1 = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:28:29.000Z"),
      laps
    );
    expect(beforeS1[0].sectorTimes).toEqual([31, 30, 31]);

    const afterS1 = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:28:30.500Z"),
      laps
    );
    expect(afterS1[0].sectorTimes).toEqual([30, null, null]);
  });

  it("uses the latest position and interval snapshot by timestamp, not array order", () => {
    const drivers = [driver(4, "NOR"), driver(81, "PIA")];
    const positions = [
      position("2026-03-14T05:30:05.000Z", 4, 2),
      position("2026-03-14T05:30:05.000Z", 81, 1),
      position("2026-03-14T05:29:55.000Z", 4, 1),
      position("2026-03-14T05:29:55.000Z", 81, 2),
    ];
    const intervals = [
      interval("2026-03-14T05:30:05.000Z", 4, 1.234),
      interval("2026-03-14T05:30:05.000Z", 81, 0),
      interval("2026-03-14T05:29:55.000Z", 4, 0),
      interval("2026-03-14T05:29:55.000Z", 81, 0.8),
    ];

    const entries = buildTimingData(drivers, positions, intervals, [], []);

    expect(entries).toHaveLength(2);
    expect(entries[0].driverNumber).toBe(81);
    expect(entries[0].position).toBe(1);
    expect(entries[0].gapToLeader).toBe(0);
    expect(entries[1].driverNumber).toBe(4);
    expect(entries[1].position).toBe(2);
    expect(entries[1].gapToLeader).toBe(1.234);
  });

  it("marks drivers as in pit when the current lap carries pit mini-sector status", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", null),
        segments_sector_1: [2049],
        segments_sector_2: [2064],
        segments_sector_3: [],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:28:45.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
  });

  it("does not mark a driver as in pit during a pit-out lap", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049],
        segments_sector_2: [2049],
        segments_sector_3: [2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:00.000Z", null),
        is_pit_out_lap: true,
        segments_sector_1: [2064],
        segments_sector_2: [],
        segments_sector_3: [],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:22:30.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
  });

  it("does not mark a driver as in pit before the pit segment time is reached", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", null),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 30,
        segments_sector_1: [2049],
        segments_sector_2: [2064],
        segments_sector_3: [],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:28:20.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
  });

  it("marks drivers with a chequered badge only after they complete a lap after the active chequered", () => {
    const drivers = [driver(4, "NOR"), driver(81, "PIA")];
    const positions = [
      position("2026-03-14T05:30:05.000Z", 4, 1),
      position("2026-03-14T05:30:05.000Z", 81, 2),
    ];
    const laps = [
      {
        ...lap(4, 2, "2026-03-14T05:28:20.000Z", 90),
      },
      {
        ...lap(81, 2, "2026-03-14T05:29:10.000Z", 90),
      },
    ];
    const raceControl = [
      { ...msg("2026-03-14T05:29:45.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-03-14T05:30:00.000Z"),
      laps,
      raceControl
    );

    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.driverNumber === 4)?.hasTakenChequered).toBe(true);
    expect(entries.find((entry) => entry.driverNumber === 81)?.hasTakenChequered).toBe(false);
  });

  it("orders qualifying replay entries by phase best lap instead of stale position snapshots", () => {
    const drivers = [driver(12, "ANT"), driver(81, "PIA")];
    const positions = [
      position("2026-04-05T07:48:05.000Z", 12, 1),
      position("2026-04-05T07:48:05.000Z", 81, 2),
    ];
    const laps = [
      {
        ...lap(12, 9, "2026-04-05T07:47:10.000Z", 30.222),
        is_pit_out_lap: false,
      },
      {
        ...lap(81, 9, "2026-04-05T07:47:12.000Z", 29.900),
        is_pit_out_lap: false,
      },
    ];
    const raceControl = [
      msg("2026-04-05T07:20:00.000Z", "SESSION STARTED"),
      { ...msg("2026-04-05T07:35:00.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
      msg("2026-04-05T07:40:00.000Z", "SESSION STARTED"),
      { ...msg("2026-04-05T07:45:00.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
      msg("2026-04-05T07:47:00.000Z", "SESSION STARTED"),
    ];

    const entries = buildReplayTimingEntries(
      drivers,
      positions,
      [],
      [],
      laps,
      Date.parse("2026-04-05T07:48:00.000Z"),
      true,
      raceControl
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].driverNumber).toBe(81);
    expect(entries[0].position).toBe(1);
    expect(entries[1].driverNumber).toBe(12);
    expect(entries[1].position).toBe(2);
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
