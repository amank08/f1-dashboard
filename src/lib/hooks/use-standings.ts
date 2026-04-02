"use client";

import useSWR from "swr";
import type { Session, Position, Driver } from "@/lib/openf1/types";
import { RACE_POINTS, SPRINT_POINTS } from "@/lib/utils/constants";

export interface DriverStanding {
  driverNumber: number;
  name: string;
  acronym: string;
  team: string;
  teamColour: string;
  headshotUrl: string | null;
  points: number;
  wins: number;
  podiums: number;
  racesScored: number;
}

export interface ConstructorStanding {
  team: string;
  teamColour: string;
  points: number;
  wins: number;
  drivers: string[];
}

export function useSeasonSessions(year: number) {
  return useSWR<Session[]>(`/api/f1/sessions?year=${year}`);
}

async function fetchPositions(sessionKey: number): Promise<Position[]> {
  const res = await fetch(`/api/f1/position?session_key=${sessionKey}`);
  if (!res.ok) return [];
  return res.json();
}

/** Returns the last recorded position per driver (their finishing position). */
function getFinalPositions(positions: Position[]): Map<number, number> {
  const final = new Map<number, number>();
  for (const p of positions) {
    final.set(p.driver_number, p.position);
  }
  return final;
}

export function useStandings(year: number) {
  const { data: sessions, isLoading: sessionsLoading } = useSWR<Session[]>(
    `/api/f1/sessions?year=${year}`
  );

  const now = new Date();

  const raceSessions = (sessions ?? []).filter(
    (s) => s.session_name === "Race" && new Date(s.date_end) < now
  );
  const sprintSessions = (sessions ?? []).filter(
    (s) => s.session_name === "Sprint" && new Date(s.date_end) < now
  );

  const allPointsSessions = [...raceSessions, ...sprintSessions];
  const sessionKeyStr = allPointsSessions.map((s) => s.session_key).join(",");

  // Batch-fetch positions for all scored sessions in one SWR entry
  const { data: sessionPositions, isLoading: positionsLoading } = useSWR(
    sessionKeyStr ? `standings-pos-${year}-${sessionKeyStr}` : null,
    () =>
      Promise.all(
        allPointsSessions.map(async (s) => ({
          session: s,
          positions: await fetchPositions(s.session_key),
        }))
      )
  );

  // Driver info from the latest completed race session
  const latestRaceSession = raceSessions[raceSessions.length - 1];
  const { data: drivers, isLoading: driversLoading } = useSWR<Driver[]>(
    latestRaceSession
      ? `/api/f1/drivers?session_key=${latestRaceSession.session_key}`
      : null
  );

  const isLoading = sessionsLoading || positionsLoading || driversLoading;

  if (!sessionPositions || !drivers || raceSessions.length === 0) {
    return {
      drivers: null,
      constructors: null,
      isLoading: isLoading || (!!sessions && raceSessions.length === 0 ? false : isLoading),
      racesCompleted: raceSessions.length,
      noRacesYet: !!sessions && raceSessions.length === 0,
    };
  }

  const driverMap = new Map<number, Driver>(
    drivers.map((d) => [d.driver_number, d])
  );

  const stats = new Map<
    number,
    { points: number; wins: number; podiums: number; races: number }
  >();

  for (const { session, positions } of sessionPositions) {
    const isRace = session.session_name === "Race";
    const pts = isRace ? RACE_POINTS : SPRINT_POINTS;
    const finalPos = getFinalPositions(positions);

    for (const [driverNum, pos] of finalPos) {
      const existing = stats.get(driverNum) ?? {
        points: 0,
        wins: 0,
        podiums: 0,
        races: 0,
      };
      stats.set(driverNum, {
        points: existing.points + (pts[pos] ?? 0),
        wins: existing.wins + (isRace && pos === 1 ? 1 : 0),
        podiums: existing.podiums + (isRace && pos <= 3 ? 1 : 0),
        races: existing.races + (isRace ? 1 : 0),
      });
    }
  }

  const driverStandings: DriverStanding[] = [];
  for (const [driverNumber, s] of stats) {
    const d = driverMap.get(driverNumber);
    if (!d) continue;
    driverStandings.push({
      driverNumber,
      name: d.full_name,
      acronym: d.name_acronym,
      team: d.team_name,
      teamColour: d.team_colour,
      headshotUrl: d.headshot_url ?? null,
      points: s.points,
      wins: s.wins,
      podiums: s.podiums,
      racesScored: s.races,
    });
  }
  driverStandings.sort((a, b) => b.points - a.points || b.wins - a.wins);

  // Constructor standings — sum points by team using latest driver-team mapping
  const ctorMap = new Map<
    string,
    { points: number; wins: number; colour: string; drivers: Set<string> }
  >();
  for (const d of driverStandings) {
    const existing = ctorMap.get(d.team) ?? {
      points: 0,
      wins: 0,
      colour: d.teamColour,
      drivers: new Set<string>(),
    };
    existing.points += d.points;
    existing.wins += d.wins;
    existing.drivers.add(d.acronym);
    ctorMap.set(d.team, existing);
  }

  const constructorStandings: ConstructorStanding[] = Array.from(
    ctorMap.entries()
  )
    .map(([team, s]) => ({
      team,
      teamColour: s.colour,
      points: s.points,
      wins: s.wins,
      drivers: Array.from(s.drivers),
    }))
    .sort((a, b) => b.points - a.points);

  return {
    drivers: driverStandings,
    constructors: constructorStandings,
    isLoading: false,
    racesCompleted: raceSessions.length,
    noRacesYet: false,
  };
}
