import { describe, expect, it } from "vitest";
import type { RaceControlMessage } from "@/lib/openf1/types";
import { getQualifyingKnockoutPosition } from "@/lib/utils/replay-processor";

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
