import { describe, expect, it } from "vitest";
import type { Driver, Interval, LapData, Position, RaceControlMessage, Stint } from "@/lib/openf1/types";
import { buildTimingData } from "@/components/live/timing-board";
import {
  buildReplaySessionIndex,
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
      undefined,
      Date.parse("2026-03-14T05:35:00.000Z"),
      true,
      raceControl
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].position).toBe(1);
    expect(entries[0].currentLap).toBe(2);
    expect(entries[0].bestLap).toBe(89);
  });

  it("matches the indexed replay path to the non-indexed qualifying replay output", () => {
    const drivers = [driver(4, "NOR"), driver(81, "PIA")];
    const positions = [
      position("2026-03-14T05:05:00.000Z", 4, 1),
      position("2026-03-14T05:05:00.000Z", 81, 2),
      position("2026-03-14T05:30:00.000Z", 4, 2),
      position("2026-03-14T05:30:00.000Z", 81, 1),
    ];
    const intervals = [
      interval("2026-03-14T05:05:00.000Z", 4, 0),
      interval("2026-03-14T05:05:00.000Z", 81, 0.5),
      interval("2026-03-14T05:30:00.000Z", 4, 1.2),
      interval("2026-03-14T05:30:00.000Z", 81, 0),
    ];
    const stints = [stint(4, 1, 4), stint(81, 1, 4)];
    const laps = [
      lap(4, 1, "2026-03-14T05:10:00.000Z", 90),
      lap(81, 1, "2026-03-14T05:10:10.000Z", 91),
      lap(4, 2, "2026-03-14T05:28:00.000Z", 89),
      lap(81, 2, "2026-03-14T05:28:10.000Z", 88.5),
      lap(4, 3, "2026-03-14T05:50:00.000Z", 88),
    ];
    const raceControl = [
      msg("2026-03-14T05:00:00.000Z", "SESSION STARTED"),
      { ...msg("2026-03-14T05:18:00.000Z", "CHEQUERED FLAG"), category: "Other", flag: "CHEQUERED" },
      msg("2026-03-14T05:25:00.000Z", "SESSION STARTED"),
    ];
    const replayTime = Date.parse("2026-03-14T05:35:00.000Z");
    const replayIndex = buildReplaySessionIndex(
      drivers,
      positions,
      intervals,
      laps,
      undefined,
      raceControl
    );

    const withoutIndex = buildReplayTimingEntries(
      drivers,
      positions,
      intervals,
      stints,
      laps,
      undefined,
      replayTime,
      true,
      raceControl
    );
    const withIndex = buildReplayTimingEntries(
      drivers,
      positions,
      intervals,
      stints,
      laps,
      undefined,
      replayTime,
      true,
      raceControl,
      replayIndex
    );

    expect(withIndex).toEqual(withoutIndex);
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
      undefined,
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
      undefined,
      Date.parse("2026-04-05T07:48:00.000Z"),
      true,
      raceControl
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].bestLap).toBeNull();
  });

  it("keeps the previous completed lap as Last while a current outlap carries the previous visible sector state", () => {
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
      undefined,
      Date.parse("2026-04-05T07:48:00.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].lastLap).toBe(88.778);
    expect(entries[0].sectorTimes).toEqual([30, null, null]);
  });

  it("shows race out-lap sector and mini-sector progress while preserving the previous completed last lap", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-04-05T07:48:05.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 8, "2026-04-05T07:33:00.000Z", 88.778),
        duration_sector_1: 29.1,
        duration_sector_2: 29.6,
        duration_sector_3: 30.078,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049, 2049, 2049],
        segments_sector_3: [2049, 2049, 2049],
      },
      {
        ...lap(4, 9, "2026-04-05T07:47:30.000Z", null),
        is_pit_out_lap: true,
        duration_sector_1: 31,
        duration_sector_2: null,
        duration_sector_3: null,
        segments_sector_1: [2064, 2049, 2049],
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
      undefined,
      Date.parse("2026-04-05T07:47:55.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].lastLap).toBe(88.778);
    expect(entries[0].sectorTimes[0]).toBe(29.1);
    expect(entries[0].segments[0]).toEqual([2064, 2049, null]);
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
      undefined,
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
      undefined,
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
      undefined,
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
      undefined,
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

    const entries = buildTimingData(drivers, positions, intervals, [], [], undefined);

    expect(entries).toHaveLength(2);
    expect(entries[0].driverNumber).toBe(81);
    expect(entries[0].position).toBe(1);
    expect(entries[0].gapToLeader).toBe(0);
    expect(entries[1].driverNumber).toBe(4);
    expect(entries[1].position).toBe(2);
    expect(entries[1].gapToLeader).toBe(1.234);
  });

  it("marks a driver as closing when the latest interval to the car ahead decreases", () => {
    const drivers = [driver(4, "NOR"), driver(81, "PIA")];
    const positions = [
      position("2026-03-14T05:30:05.000Z", 81, 1),
      position("2026-03-14T05:30:05.000Z", 4, 2),
    ];
    const intervals = [
      interval("2026-03-14T05:29:55.000Z", 4, 1.5),
      interval("2026-03-14T05:30:05.000Z", 4, 1.2),
      interval("2026-03-14T05:30:05.000Z", 81, 0),
    ];

    const entries = buildTimingData(drivers, positions, intervals, [], [], undefined);
    const norris = entries.find((entry) => entry.driverNumber === 4);

    expect(norris).toBeDefined();
    expect(norris?.isClosingToAhead).toBe(true);
  });

  it("tracks grid positions gained and lost from the first position snapshot", () => {
    const drivers = [driver(4, "NOR"), driver(81, "PIA")];
    const positions = [
      position("2026-03-14T05:00:00.000Z", 4, 1),
      position("2026-03-14T05:00:00.000Z", 81, 2),
      position("2026-03-14T05:30:05.000Z", 4, 2),
      position("2026-03-14T05:30:05.000Z", 81, 1),
    ];

    const entries = buildTimingData(drivers, positions, [], [], [], undefined);
    const piastri = entries.find((entry) => entry.driverNumber === 81);
    const norris = entries.find((entry) => entry.driverNumber === 4);

    expect(piastri?.gridPosition).toBe(2);
    expect(piastri?.positionDelta).toBe(1);
    expect(norris?.gridPosition).toBe(1);
    expect(norris?.positionDelta).toBe(-1);
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
      undefined,
      Date.parse("2026-03-14T05:28:45.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
  });

  it("marks a driver as in pit during the pit-lane portion of a pit-out lap", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:00.000Z", null),
        is_pit_out_lap: true,
        duration_sector_1: 30,
        segments_sector_1: [2064, 2049, 2049],
        segments_sector_2: [],
        segments_sector_3: [],
      },
    ];

    const earlyEntries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:22:05.000Z"),
      laps
    );

    expect(earlyEntries).toHaveLength(1);
    expect(earlyEntries[0].isInPit).toBe(true);

    const lateEntries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:22:12.000Z"),
      laps
    );

    expect(lateEntries).toHaveLength(1);
    expect(lateEntries[0].isInPit).toBe(false);
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
      undefined,
      Date.parse("2026-03-14T05:28:20.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
  });

  it("starts the pit-lane timer exactly when the driver reaches the pit entry line", () => {
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

    const beforeEntry = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:28:29.999Z"),
      laps
    );

    expect(beforeEntry).toHaveLength(1);
    expect(beforeEntry[0].isInPit).toBe(false);
    expect(beforeEntry[0].pitElapsed).toBeNull();

    const atEntry = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:28:30.000Z"),
      laps
    );

    expect(atEntry).toHaveLength(1);
    expect(atEntry[0].isInPit).toBe(true);
    expect(atEntry[0].pitElapsed).toBe(0);
  });

  it("starts the pit timer from official lane duration when pit-stop timing exists", () => {
    const drivers = [driver(81, "PIA")];
    const positions = [position("2026-03-29T05:42:45.837000Z", 81, 4)];
    const allLaps = [
      {
        ...lap(81, 18, "2026-03-29T05:40:59.199000Z", 97.327),
        duration_sector_1: 34.808,
        duration_sector_2: 41.961,
        duration_sector_3: 20.558,
        segments_sector_1: [2048, 2049, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2048, 2049, 2048, 2049, 2048, 2048, 2048, 2048, 2048, 2049],
        segments_sector_3: [2049, 2048, 2048, 2048, 2064, 2064, 2064],
      },
      {
        ...lap(81, 19, "2026-03-29T05:42:36.382000Z", 114.537),
        is_pit_out_lap: true,
        duration_sector_1: 54.877,
        duration_sector_2: 41.678,
        duration_sector_3: 17.982,
        segments_sector_1: [2064, 2064, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2049, 2049, 2048, 2051, 2048, 2048, 2048, 2048, 2049, 2049],
        segments_sector_3: [2049, 2049, 2048, 2048, 2048, 2048, 2048],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-29T05:42:58.401000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 81,
        lap_number: 18,
        pit_duration: 23.4,
        lane_duration: 23.4,
        stop_duration: null,
      },
    ];

    const atOfficialLaneEntry = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-29T05:42:35.001Z"),
      allLaps
    );

    expect(atOfficialLaneEntry).toHaveLength(1);
    expect(atOfficialLaneEntry[0].isInPit).toBe(true);
    expect(atOfficialLaneEntry[0].pitElapsed).toBe(0);
  });

  it("does not mark a driver as in pit after a completed in-lap with no subsequent out-lap", () => {
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
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:30:00.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
  });

  it("marks a driver as in pit between completing the in-lap and the out-lap starting", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const allLaps = [
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
        ...lap(4, 2, "2026-03-14T05:22:30.000Z", null),
        is_pit_out_lap: true,
      },
    ];
    const filteredLaps = allLaps.slice(0, 1);

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      filteredLaps,
      undefined,
      Date.parse("2026-03-14T05:22:10.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
  });

  it("surfaces live in-pit elapsed time before the official pit duration arrives", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:30.000Z", null),
        is_pit_out_lap: true,
      },
    ];
    const pitStops = [
      {
        date: "2026-03-14T05:22:20.000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 4,
        lap_number: 1,
        stop_duration: 2.4,
        pit_duration: 24.1,
        lane_duration: 24.1,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps.slice(0, 1),
      pitStops,
      Date.parse("2026-03-14T05:22:02.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).not.toBeNull();
    expect(entries[0].pitLaneTime).toBeNull();
    expect(entries[0].pitStopTime).toBeNull();
  });

  it("keeps the in-pit timer running after pit entry while the car is stationary in the pit box", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:30.000Z", null),
        is_pit_out_lap: true,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps.slice(0, 1),
      undefined,
      Date.parse("2026-03-14T05:22:20.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("does not leak a previous stop duration into a new pit event before the current pit row exists", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:00:00.000Z", 90),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 30,
        segments_sector_1: [2049],
        segments_sector_2: [2049],
        segments_sector_3: [2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:01:40.000Z", 92),
        is_pit_out_lap: true,
        duration_sector_1: 30,
        segments_sector_1: [2064, 2049],
        segments_sector_2: [],
        segments_sector_3: [],
      },
      {
        ...lap(4, 10, "2026-03-14T05:28:00.000Z", null),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 30,
        segments_sector_1: [2049],
        segments_sector_2: [2064],
        segments_sector_3: [],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-14T05:01:15.000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 4,
        lap_number: 1,
        stop_duration: 2.4,
        pit_duration: 24.1,
        lane_duration: 24.1,
      },
      {
        date: "2026-03-14T05:28:25.000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 4,
        lap_number: 10,
        stop_duration: 2.9,
        pit_duration: 22.8,
        lane_duration: 22.8,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      [allLaps[2]],
      pitStops,
      Date.parse("2026-03-14T05:28:20.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitStopTime).toBeNull();
    expect(entries[0].pitLaneTime).toBeNull();
  });

  it("keeps a driver marked in pit on the early out-lap before on-track mini-sectors appear", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:00.000Z", null),
        is_pit_out_lap: true,
        duration_sector_1: 30,
        duration_sector_2: null,
        duration_sector_3: null,
        segments_sector_1: [],
        segments_sector_2: [],
        segments_sector_3: [],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      undefined,
      Date.parse("2026-03-14T05:22:05.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("keeps PIT active during the official lane-duration window before the out-lap clears the lane", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
      {
        ...lap(4, 2, "2026-03-14T05:22:00.000Z", null),
        is_pit_out_lap: true,
        duration_sector_1: 30,
        segments_sector_1: [],
        segments_sector_2: [],
        segments_sector_3: [],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-14T05:22:20.000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 4,
        lap_number: 1,
        stop_duration: 2.4,
        pit_duration: 5,
        lane_duration: 5,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-14T05:22:17.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("keeps PIT active after a completed in-lap with a pit-stop record even before an out-lap exists", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-14T05:22:20.000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 4,
        lap_number: 1,
        stop_duration: 2.4,
        pit_duration: 24.1,
        lane_duration: 24.1,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      pitStops,
      Date.parse("2026-03-14T05:22:10.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("keeps PIT active briefly after a completed in-lap before pit-stop or out-lap data arrives", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:22:40.000Z", 4, 1)];
    const laps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 120),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 60,
        segments_sector_1: [2049, 2049, 2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2064],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      laps,
      undefined,
      Date.parse("2026-03-14T05:22:10.000Z"),
      laps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("keeps PIT active until the official pit row timestamp when the out-lap starts before pit exit", () => {
    const drivers = [driver(81, "PIA")];
    const positions = [
      position("2026-03-29T05:42:45.837000Z", 81, 4),
      position("2026-03-29T05:42:55.213000Z", 81, 5),
    ];
    const allLaps = [
      {
        ...lap(81, 18, "2026-03-29T05:40:59.199000Z", 97.327),
        duration_sector_1: 34.808,
        duration_sector_2: 41.961,
        duration_sector_3: 20.558,
        segments_sector_1: [2048, 2049, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2048, 2049, 2048, 2049, 2048, 2048, 2048, 2048, 2048, 2049],
        segments_sector_3: [2049, 2048, 2048, 2048, 2064, 2064, 2064],
      },
      {
        ...lap(81, 19, "2026-03-29T05:42:36.382000Z", 114.537),
        is_pit_out_lap: true,
        duration_sector_1: 54.877,
        duration_sector_2: 41.678,
        duration_sector_3: 17.982,
        segments_sector_1: [2064, 2064, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2049, 2049, 2048, 2051, 2048, 2048, 2048, 2048, 2049, 2049],
        segments_sector_3: [2049, 2049, 2048, 2048, 2048, 2048, 2048],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-29T05:42:58.401000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 81,
        lap_number: 18,
        pit_duration: 23.4,
        lane_duration: 23.4,
        stop_duration: null,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-29T05:42:48.843Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(0);
  });

  it("keeps showing the final pit time briefly after pit exit before returning to gaps", () => {
    const drivers = [driver(81, "PIA")];
    const positions = [position("2026-03-29T05:42:59.000Z", 81, 5)];
    const allLaps = [
      {
        ...lap(81, 18, "2026-03-29T05:40:59.199000Z", 97.327),
        duration_sector_1: 34.808,
        duration_sector_2: 41.961,
        duration_sector_3: 20.558,
        segments_sector_1: [2048, 2049, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2048, 2049, 2048, 2049, 2048, 2048, 2048, 2048, 2048, 2049],
        segments_sector_3: [2049, 2048, 2048, 2048, 2064, 2064, 2064],
      },
      {
        ...lap(81, 19, "2026-03-29T05:42:36.382000Z", 114.537),
        is_pit_out_lap: true,
        duration_sector_1: 54.877,
        duration_sector_2: 41.678,
        duration_sector_3: 17.982,
        segments_sector_1: [2064, 2064, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2049, 2049, 2048, 2051, 2048, 2048, 2048, 2048, 2049, 2049],
        segments_sector_3: [2049, 2049, 2048, 2048, 2048, 2048, 2048],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-29T05:42:58.401000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 81,
        lap_number: 18,
        pit_duration: 23.4,
        lane_duration: 23.4,
        stop_duration: 2.7,
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-29T05:42:59.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
    expect(entries[0].showRecentPitTime).toBe(true);
    expect(entries[0].pitElapsed).toBeGreaterThan(20);
    expect(entries[0].pitLaneTime).toBe(23.4);
    expect(entries[0].pitStopTime).toBe(2.7);
  });

  it("keeps the post-exit lane-duration hold for five and a half seconds before clearing", () => {
    const drivers = [driver(81, "PIA")];
    const positions = [position("2026-03-29T05:42:59.000Z", 81, 5)];
    const allLaps = [
      {
        ...lap(81, 18, "2026-03-29T05:40:59.199000Z", 97.327),
        duration_sector_1: 34.808,
        duration_sector_2: 41.961,
        duration_sector_3: 20.558,
        segments_sector_1: [2048, 2049, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2048, 2049, 2048, 2049, 2048, 2048, 2048, 2048, 2048, 2049],
        segments_sector_3: [2049, 2048, 2048, 2048, 2064, 2064, 2064],
      },
      {
        ...lap(81, 19, "2026-03-29T05:42:36.382000Z", 114.537),
        is_pit_out_lap: true,
        duration_sector_1: 54.877,
        duration_sector_2: 41.678,
        duration_sector_3: 17.982,
        segments_sector_1: [2064, 2064, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2049, 2049, 2048, 2051, 2048, 2048, 2048, 2048, 2049, 2049],
        segments_sector_3: [2049, 2049, 2048, 2048, 2048, 2048, 2048],
      },
    ];
    const pitStops = [
      {
        date: "2026-03-29T05:42:58.401000Z",
        session_key: 1,
        meeting_key: 1,
        driver_number: 81,
        lap_number: 18,
        pit_duration: 23.4,
        lane_duration: 23.4,
        stop_duration: 2.7,
      },
    ];

    const withinHold = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-29T05:43:03.500Z"),
      allLaps
    );
    expect(withinHold[0].showRecentPitTime).toBe(true);
    expect(withinHold[0].pitLaneTime).toBe(23.4);

    const afterHold = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      pitStops,
      Date.parse("2026-03-29T05:43:03.902Z"),
      allLaps
    );
    expect(afterHold[0].showRecentPitTime).toBe(false);
  });

  it("does not mark a driver as in pit or show a pit mini-sector too early when OpenF1 gives a sparse pit sector", () => {
    const drivers = [driver(4, "NOR")];
    const positions = [position("2026-03-14T05:30:05.000Z", 4, 1)];
    const allLaps = [
      {
        ...lap(4, 1, "2026-03-14T05:20:00.000Z", 90),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 30,
        segments_sector_1: [2049],
        segments_sector_2: [2049],
        segments_sector_3: [2049, 2049, 2049],
      },
      {
        ...lap(4, 2, "2026-03-14T05:28:00.000Z", null),
        duration_sector_1: 30,
        duration_sector_2: 30,
        duration_sector_3: 30,
        segments_sector_1: [2049],
        segments_sector_2: [2049],
        segments_sector_3: [2064],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps.slice(1),
      undefined,
      Date.parse("2026-03-14T05:29:10.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
    expect(entries[0].segments[2]).toEqual([null, null, null]);
  });

  it("does not reveal future pit markers at sector start when the current sector duration is still null", () => {
    const drivers = [driver(63, "RUS")];
    const positions = [position("2026-03-07T06:14:10.000Z", 63, 5)];
    const allLaps = [
      {
        ...lap(63, 18, "2026-03-07T06:11:54.387Z", 79.084),
        duration_sector_1: 27.674,
        duration_sector_2: 17.488,
        duration_sector_3: 33.922,
        segments_sector_1: [2048, 2048, 2048, 2048, 2048, 2051, 2048, 2048, 2048],
        segments_sector_2: [2049, 2048, 2051, 2049, 2049],
        segments_sector_3: [2051, 2051, 2051, 2051, 2051, 2051, 2049, 2051, 2051, 2051],
      },
      {
        ...lap(63, 19, "2026-03-07T06:13:13.378Z", 166.963),
        duration_sector_1: 31.059,
        duration_sector_2: 19.934,
        duration_sector_3: null,
        segments_sector_1: [2049, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048],
        segments_sector_2: [2048, 2048, 2048, 2048, 2048],
        segments_sector_3: [2048, 2048, 2048, 2048, 2048, 2048, 2048, 2064, 2064, 2064],
      },
    ];

    const entries = buildTimingData(
      drivers,
      positions,
      [],
      [],
      allLaps,
      undefined,
      Date.parse("2026-03-07T06:14:10.000Z"),
      allLaps
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].isInPit).toBe(false);
    expect(entries[0].segments[2]).toEqual([2048, null, null, null, null, null, null, null, null, null]);
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
      undefined,
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
      undefined,
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
