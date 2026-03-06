import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/openf1/rate-limiter";
import { cache, getCacheTTL } from "@/lib/openf1/cache";
import type { Session, Position, Driver } from "@/lib/openf1/types";
import { RACE_POINTS, SPRINT_POINTS } from "@/lib/utils/constants";

const BASE_URL = "https://api.openf1.org/v1";

async function fetchWithCache<T>(endpoint: string, retries = 3): Promise<T> {
  const cacheKey = `standings:${endpoint}`;
  const cached = cache.get<T>(cacheKey);
  if (cached && !cached.isStale) return cached.data;

  for (let attempt = 0; attempt < retries; attempt++) {
    await rateLimiter.acquire();
    const res = await fetch(`${BASE_URL}/${endpoint}`);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`OpenF1 ${res.status}`);
    const data = await res.json();
    cache.set(cacheKey, data, getCacheTTL(endpoint.split("?")[0]));
    return data as T;
  }
  throw new Error("OpenF1 rate limit exceeded after retries");
}

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get("year") ?? "2024";
  const cacheKey = `standings:computed:v2:${year}`;

  const cached = cache.get(cacheKey);
  if (cached && !cached.isStale) {
    return NextResponse.json(cached.data, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const sessions = await fetchWithCache<Session[]>(
      `sessions?year=${year}`
    );

    const raceSessions = sessions
      .filter(
        (s) => s.session_type === "Race" || s.session_type === "Sprint"
      )
      .sort(
        (a, b) =>
          new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
      );

    const driverMap = new Map<
      number,
      {
        driverNumber: number;
        name: string;
        acronym: string;
        team: string;
        teamColour: string;
        points: number;
        wins: number;
      }
    >();

    // Per-race points progression: { raceName, driverPoints: { [acronym]: cumulativePoints } }
    const progression: Array<{
      race: string;
      meetingKey: number;
      [key: string]: number | string;
    }> = [];

    // Track cumulative points per driver
    const cumulativePoints = new Map<number, number>();

    for (const session of raceSessions) {
      if (session.session_type !== "Race") continue; // progression only for races

      const positions = await fetchWithCache<Position[]>(
        `position?session_key=${session.session_key}`
      );
      const drivers = await fetchWithCache<Driver[]>(
        `drivers?session_key=${session.session_key}`
      );

      const finalPositions = new Map<number, number>();
      for (const pos of positions) {
        finalPositions.set(pos.driver_number, pos.position);
      }

      const driverLookup = new Map<number, Driver>();
      for (const d of drivers) {
        driverLookup.set(d.driver_number, d);
      }

      for (const [driverNum, position] of finalPositions) {
        const pts = RACE_POINTS[position] ?? 0;
        const driver = driverLookup.get(driverNum);
        if (!driver) continue;

        if (!driverMap.has(driverNum)) {
          driverMap.set(driverNum, {
            driverNumber: driverNum,
            name: driver.full_name,
            acronym: driver.name_acronym,
            team: driver.team_name,
            teamColour: driver.team_colour,
            points: 0,
            wins: 0,
          });
        }

        const standing = driverMap.get(driverNum)!;
        standing.points += pts;
        if (position === 1) standing.wins += 1;

        cumulativePoints.set(
          driverNum,
          (cumulativePoints.get(driverNum) ?? 0) + pts
        );
      }

      // Build progression entry
      const raceLabel =
        session.circuit_short_name || session.location || "Race";
      const entry: Record<string, number | string> = {
        race: raceLabel,
        meetingKey: session.meeting_key,
      };
      for (const [driverNum, cumPts] of cumulativePoints) {
        const d = driverMap.get(driverNum);
        if (d) entry[d.acronym] = cumPts;
      }
      progression.push(
        entry as { race: string; meetingKey: number; [key: string]: number | string }
      );
    }

    // Also process sprint sessions for total points
    const sprintSessions = raceSessions.filter(
      (s) => s.session_type === "Sprint"
    );
    for (const session of sprintSessions) {
      const positions = await fetchWithCache<Position[]>(
        `position?session_key=${session.session_key}`
      );
      const drivers = await fetchWithCache<Driver[]>(
        `drivers?session_key=${session.session_key}`
      );

      const finalPositions = new Map<number, number>();
      for (const pos of positions) {
        finalPositions.set(pos.driver_number, pos.position);
      }

      const driverLookup = new Map<number, Driver>();
      for (const d of drivers) {
        driverLookup.set(d.driver_number, d);
      }

      for (const [driverNum, position] of finalPositions) {
        const pts = SPRINT_POINTS[position] ?? 0;
        const driver = driverLookup.get(driverNum);
        if (!driver) continue;

        if (!driverMap.has(driverNum)) {
          driverMap.set(driverNum, {
            driverNumber: driverNum,
            name: driver.full_name,
            acronym: driver.name_acronym,
            team: driver.team_name,
            teamColour: driver.team_colour,
            points: 0,
            wins: 0,
          });
        }

        driverMap.get(driverNum)!.points += pts;
      }
    }

    const driverStandings = Array.from(driverMap.values()).sort(
      (a, b) => b.points - a.points
    );

    const constructorMap = new Map<
      string,
      { team: string; teamColour: string; points: number; wins: number }
    >();
    for (const d of driverStandings) {
      if (!constructorMap.has(d.team)) {
        constructorMap.set(d.team, {
          team: d.team,
          teamColour: d.teamColour,
          points: 0,
          wins: 0,
        });
      }
      const c = constructorMap.get(d.team)!;
      c.points += d.points;
      c.wins += d.wins;
    }

    const constructorStandings = Array.from(constructorMap.values()).sort(
      (a, b) => b.points - a.points
    );

    // Top 10 drivers for progression chart
    const top10Acronyms = driverStandings.slice(0, 10).map((d) => d.acronym);

    const result = {
      drivers: driverStandings,
      constructors: constructorStandings,
      progression,
      top10: top10Acronyms,
      driverColors: Object.fromEntries(
        driverStandings.map((d) => [d.acronym, d.teamColour])
      ),
    };

    cache.set(cacheKey, result, 3600_000);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute standings", details: String(error) },
      { status: 500 }
    );
  }
}
