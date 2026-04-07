"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isPast, isFuture, parseISO } from "date-fns";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { useSessions, useSession } from "@/lib/hooks/use-sessions";
import { usePositions } from "@/lib/hooks/use-positions";
import { useIntervals } from "@/lib/hooks/use-intervals";
import { useStints } from "@/lib/hooks/use-stints";
import { useLaps } from "@/lib/hooks/use-laps";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useRaceControl } from "@/lib/hooks/use-race-control";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { ResultsTable, buildResults } from "@/components/tables/results-table";
import { TimingBoard, buildTimingData } from "@/components/live/timing-board";
import { RaceControlFeed } from "@/components/live/race-control-feed";
import { CircuitMap } from "@/components/live/circuit-map";
import { SessionInfoPanel } from "@/components/live/session-info-panel";
import { SessionReplay } from "@/components/live/session-replay";
import { PodiumDisplay } from "@/components/live/podium-display";
import { GridVsFinishChart } from "@/components/charts/grid-vs-finish-chart";
import { PitStrategyChart } from "@/components/charts/pit-strategy-chart";
import { LapDistributionChart } from "@/components/charts/lap-distribution-chart";
import { TeammateH2HChart } from "@/components/charts/teammate-h2h-chart";
import { SectorDominanceChart } from "@/components/charts/sector-dominance-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/cn";
import { getPositionChanges } from "@/lib/utils/analytics";
import { countryFlagUrl } from "@/lib/utils/formatters";
import { CustomSelect } from "@/components/ui/custom-select";
import type { Session } from "@/lib/openf1/types";

const RACE_SESSION_TYPES = new Set([
  "Race",
  "Sprint",
  "Qualifying",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Practice",
]);


function findLatestCompletedSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter(
      (s) => RACE_SESSION_TYPES.has(s.session_type) && isPast(parseISO(s.date_end))
    )
    .sort(
      (a, b) => parseISO(b.date_end).getTime() - parseISO(a.date_end).getTime()
    )[0];
}

/** Reads ?session= from the URL and calls onParam. Must be wrapped in Suspense. */
function SessionParamReader({ onParam }: { onParam: (key: number | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams.get("session");
    onParam(s ? Number(s) : null);
  }, [searchParams, onParam]);
  return null;
}

export default function SessionAnalysisPage() {
  const [paramSessionKey, setParamSessionKey] = useState<number | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  // If URL has ?session=, skip default auto-selection
  const [autoSelected, setAutoSelected] = useState(false);
  const [viewMode, setViewMode] = useState<"results" | "replay">("results");
  const [replayTime, setReplayTime] = useState<number | null>(null);

  const handleReplayTimeChange = useCallback((time: number) => {
    setReplayTime(time);
  }, []);

  const { data: meetings, isLoading: meetingsLoading, error: meetingsError } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } = useSessions(meetingKey);

  // Resolve ?session= URL param → pre-select the correct year, meeting, and session
  const { data: paramSessionData } = useSession(paramSessionKey);
  useEffect(() => {
    if (!paramSessionKey || !paramSessionData?.[0]) return;
    const s = paramSessionData[0];
    // Legitimate one-shot sync of fetched URL-param data into three
    // interdependent state values; restructuring as derived-state would
    // tangle all downstream hooks that depend on year/meetingKey/sessionKey.
    /* eslint-disable react-hooks/set-state-in-effect */
    setAutoSelected(true); // prevent default auto-select from overriding
    setYear(new Date(s.date_start).getFullYear());
    setMeetingKey(s.meeting_key);
    setSessionKey(s.session_key);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [paramSessionKey, paramSessionData]);

  // Detect OpenF1 live-session lockout
  const apiRestricted = meetingsError?.message?.includes("Live F1 session")
    || meetingsError?.message?.includes("restricted")
    || false;

  // All meetings for the dropdown (sorted most recent first, excluding pre-season testing)
  const sortedMeetings = useMemo(() => {
    if (!meetings) return [];
    return [...meetings]
      .filter((m) => isPast(parseISO(m.date_start)) && !m.meeting_name.toLowerCase().includes("testing"))
      .sort(
        (a, b) =>
          parseISO(b.date_start).getTime() - parseISO(a.date_start).getTime()
      );
  }, [meetings]);

  // Sessions for the dropdown — only show sessions that have started
  const availableSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => isPast(parseISO(s.date_start)));
  }, [sessions]);

  // Auto-select latest completed GP meeting on first load
  // Fall back to previous year if no GPs completed yet
  useEffect(() => {
    if (autoSelected || !meetings || meetingsLoading) return;

    const latest = sortedMeetings[0];

    if (latest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select from async data on mount
      setMeetingKey(latest.meeting_key);
      setAutoSelected(true);
    } else if (year > 2023) {
      // No completed GPs this year — try previous year
      setYear(year - 1);
    } else {
      setAutoSelected(true);
    }
  }, [meetings, meetingsLoading, autoSelected, year, sortedMeetings]);

  // Auto-select the latest completed session when sessions load
  useEffect(() => {
    if (!sessions || sessionsLoading || sessionKey) return;
    const latest = findLatestCompletedSession(sessions);
    if (latest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select from async data on mount
      setSessionKey(latest.session_key);
    }
  }, [sessions, sessionsLoading, sessionKey]);

  // Reset downstream when year changes
  function handleYearChange(newYear: number) {
    setYear(newYear);
    setMeetingKey(null);
    setSessionKey(null);
    setAutoSelected(false);
    setReplayTime(null);
    setViewMode("results");
  }

  // Reset session when meeting changes
  function handleMeetingChange(newMeetingKey: number) {
    setMeetingKey(newMeetingKey);
    setSessionKey(null);
    setReplayTime(null);
  }

  // Reset replay time when session changes
  function handleSessionChange(newSessionKey: number) {
    setSessionKey(newSessionKey);
    setReplayTime(null);
  }

  // Determine if the selected session is currently live
  const isLiveSession = useMemo(() => {
    if (!sessions || !sessionKey) return false;
    const s = sessions.find((s) => s.session_key === sessionKey);
    if (!s) return false;
    return isPast(parseISO(s.date_start)) && isFuture(parseISO(s.date_end));
  }, [sessions, sessionKey]);

  // Fetch session data — poll when session is live
  const { data: positions, error: posErr } = usePositions(sessionKey, isLiveSession);
  const { data: intervals, error: intErr } = useIntervals(sessionKey, isLiveSession);
  const { data: stints } = useStints(sessionKey, isLiveSession);
  const { data: laps, error: lapErr } = useLaps(sessionKey, undefined, isLiveSession);
  const { data: drivers, error: drvErr } = useDrivers(sessionKey);
  const { data: raceControl } = useRaceControl(sessionKey, isLiveSession);

  // Filter out deleted lap times using race control messages.
  // Match by driver + lap time (seconds) rather than lap number, because
  // race control lap numbers are consistently off-by-one vs OpenF1.
  const validLaps = useMemo(() => {
    if (!laps) return null;
    if (!raceControl) return laps;

    // Parse "TIME m:ss.sss" to seconds
    function parseTimeStr(t: string): number {
      const parts = t.split(":");
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }

    // Track deleted times as Set<"driverNumber-seconds"> (rounded to 3dp)
    const deletedTimes = new Set<string>();

    for (const msg of raceControl) {
      const carMatch = msg.message.match(/CAR (\d+)/);
      const timeMatch = msg.message.match(/TIME ([\d:]+\.[\d]+)/);
      if (!carMatch || !timeMatch) continue;
      const car = carMatch[1];
      const secs = parseTimeStr(timeMatch[1]).toFixed(3);
      const key = `${car}-${secs}`;

      if (msg.message.includes("DELETED")) {
        deletedTimes.add(key);
      } else if (msg.message.includes("REINSTATED")) {
        deletedTimes.delete(key);
      }
    }

    if (deletedTimes.size === 0) return laps;
    return laps.map((l) => {
      if (!l.lap_duration) return l;
      if (deletedTimes.has(`${l.driver_number}-${l.lap_duration.toFixed(3)}`)) {
        // Null out the duration so it's excluded from timing calculations,
        // but keep the lap entry so it's still counted in laps completed.
        return { ...l, lap_duration: null };
      }
      return l;
    });
  }, [laps, raceControl]);

  // Enriched results (pass intervals + stints for the 10-column table)
  const resultRows = useMemo(() => {
    if (!drivers || !positions || !validLaps) return [];
    const sessionType = sessions?.find((s) => s.session_key === sessionKey)?.session_type;
    return buildResults(positions, drivers, validLaps, intervals ?? undefined, stints ?? undefined, sessionType, raceControl ?? undefined, sessionKey ?? undefined);
  }, [positions, drivers, validLaps, intervals, stints, sessions, sessionKey, raceControl]);

  // Race summary stats
  const raceStats = useMemo(() => {
    if (!drivers || !validLaps || !positions) return null;

    // Position changes
    const sorted = [...positions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const gridMap = new Map<number, number>();
    const finishMap = new Map<number, number>();
    for (const p of sorted) {
      if (!gridMap.has(p.driver_number)) gridMap.set(p.driver_number, p.position);
      finishMap.set(p.driver_number, p.position);
    }
    const changes = getPositionChanges(gridMap, finishMap);

    // Total laps — prefer stint lap_end (actual race distance) over lap entries
    // (which may have inconsistent phantom entries)
    const stintMax = stints
      ? Math.max(...stints.filter((s) => s.lap_end != null).map((s) => s.lap_end!), 0)
      : 0;
    const totalLaps = stintMax > 0
      ? stintMax
      : Math.max(...validLaps.map((l) => l.lap_number), 0);

    return {
      changes,
      gridMap,
      finishMap,
      totalLaps,
    };
  }, [drivers, validLaps, positions, resultRows, stints]);

  // Chart data for GridVsFinish
  const gridVsFinishData = useMemo(() => {
    if (!raceStats || !drivers) return [];
    const driverLookup = new Map(drivers.map((d) => [d.driver_number, d]));
    return raceStats.changes.map((c) => {
      const d = driverLookup.get(c.driverNumber);
      return {
        name: d?.name_acronym ?? String(c.driverNumber),
        gridPos: c.gridPos,
        finishPos: c.finishPos,
        teamColour: d?.team_colour ?? "888888",
        teamName: d?.team_name,
        change: c.change,
      };
    });
  }, [raceStats, drivers]);

  const isQuali = sessions?.find((s) => s.session_key === sessionKey)?.session_type === "Qualifying";

  // Filtered timing data for replay mode sidebar
  const replayTimingEntries = useMemo(() => {
    if (!drivers || !positions || !laps) return [];
    const iv = intervals ?? [];
    const st = stints ?? [];
    if (replayTime === null)
      return buildTimingData(drivers, positions, iv, st, laps);
    const cutoff = new Date(replayTime).toISOString();
    const filteredPositions = positions.filter((p) => p.date <= cutoff);
    const filteredIntervals = iv.filter((i) => i.date <= cutoff);
    let filteredLaps = laps.filter((l) => l.date_start <= cutoff);

    // For qualifying, restrict laps to the current Q phase so personal
    // bests and session bests reset after each phase (Q1→Q2→Q3).
    // Each phase starts with a SESSION STARTED message.
    if (isQuali && raceControl) {
      let currentPhaseStart: string | null = null;
      for (const msg of raceControl) {
        if (msg.date > cutoff) continue;
        if (msg.category === "SessionStatus" && msg.message === "SESSION STARTED") {
          currentPhaseStart = msg.date;
        }
      }
      if (currentPhaseStart) {
        filteredLaps = filteredLaps.filter((l) => l.date_start >= currentPhaseStart!);
      }
    }

    const maxLapByDriver = new Map<number, number>();
    for (const l of filteredLaps) {
      const cur = maxLapByDriver.get(l.driver_number) ?? 0;
      if (l.lap_number > cur) maxLapByDriver.set(l.driver_number, l.lap_number);
    }
    const filteredStints = st.filter((s) => {
      const maxLap = maxLapByDriver.get(s.driver_number) ?? 0;
      return s.lap_start != null && s.lap_start <= maxLap;
    });
    return buildTimingData(
      drivers,
      filteredPositions,
      filteredIntervals,
      filteredStints,
      filteredLaps,
      replayTime,
      laps // full unfiltered laps for stable mini-sector grid layout
    );
  }, [replayTime, drivers, positions, intervals, stints, laps, isQuali, raceControl]);

  // Detect retired/eliminated drivers from timing entries.
  // Race: DNF if lap count <90% of leader and no recent laps (3 min).
  // Qualifying: eliminated if knocked out of Q1/Q2.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const retiredDrivers = useMemo(() => {
    const map = new Map<number, string>();
    if (!replayTimingEntries || replayTimingEntries.length === 0) return map;

    if (isQuali && raceControl && replayTime != null && positions) {
      // Qualifying has 3 SESSION FINISHED messages (Q1, Q2, Q3).
      // Add 90s buffer so drivers can finish flying laps before
      // we snapshot eliminations.
      const cutoff = new Date(replayTime).toISOString();
      const finishedTimes: number[] = [];

      for (const msg of raceControl) {
        if (msg.date > cutoff) continue;
        if (msg.category === "SessionStatus" && msg.message === "SESSION FINISHED") {
          finishedTimes.push(new Date(msg.date).getTime() + 90_000);
        }
      }

      const q1EndTime = finishedTimes[0] ?? null;
      const q2EndTime = finishedTimes[1] ?? null;

      // Snapshot positions at a given time to find the bottom N
      const positionsAt = (time: number): Map<number, number> => {
        const latest = new Map<number, { pos: number; date: number }>();
        for (const p of positions) {
          const t = new Date(p.date).getTime();
          if (t > time) continue;
          const prev = latest.get(p.driver_number);
          if (!prev || t > prev.date) {
            latest.set(p.driver_number, { pos: p.position, date: t });
          }
        }
        return new Map([...latest].map(([dn, v]) => [dn, v.pos]));
      };

      // After Q1 + buffer: bottom 6 are eliminated
      if (q1EndTime && replayTime >= q1EndTime) {
        const q1Pos = positionsAt(q1EndTime);
        const sorted = [...q1Pos.entries()].sort((a, b) => a[1] - b[1]);
        const eliminated = sorted.slice(-6);
        for (const [dn] of eliminated) {
          map.set(dn, "Q1");
        }
      }

      // After Q2 + buffer: next bottom 6 (of remaining) are eliminated
      if (q2EndTime && replayTime >= q2EndTime) {
        const q2Pos = positionsAt(q2EndTime);
        // Exclude Q1-eliminated drivers
        const remaining = [...q2Pos.entries()]
          .filter(([dn]) => !map.has(dn))
          .sort((a, b) => a[1] - b[1]);
        const eliminated = remaining.slice(-6);
        for (const [dn] of eliminated) {
          map.set(dn, "Q2");
        }
      }

      return map;
    }

    // Race/Sprint: DNF detection
    const leaderEntry = replayTimingEntries.find((e) => e.position === 1);
    const leaderLap = leaderEntry?.currentLap ?? 0;
    const dnfThreshold = Math.floor(leaderLap * 0.9);
    if (leaderLap <= 2) return map;

    const latestLapStart = new Map<number, number>();
    if (laps && replayTime != null) {
      const cutoff = replayTime;
      for (const l of laps) {
        const t = new Date(l.date_start).getTime();
        if (t <= cutoff) {
          const prev = latestLapStart.get(l.driver_number) ?? 0;
          if (t > prev) latestLapStart.set(l.driver_number, t);
        }
      }
    }

    for (const e of replayTimingEntries) {
      if (e.position === 1) continue;
      if (e.currentLap >= dnfThreshold) continue;
      const lastStart = latestLapStart.get(e.driverNumber);
      if (replayTime != null && lastStart != null) {
        const staleness = replayTime - lastStart;
        if (staleness < 180_000) continue;
      }
      map.set(e.driverNumber, "OUT");
    }
    return map;
  }, [replayTimingEntries, laps, replayTime, isQuali, raceControl, positions]);

  const replayRaceControl = useMemo(() => {
    if (!replayTime || !raceControl) return raceControl ?? [];
    const cutoff = new Date(replayTime).toISOString();
    return raceControl.filter((m) => m.date <= cutoff);
  }, [replayTime, raceControl]);

  const dataLoading = sessionKey && (!positions || !drivers);
  const dataError = posErr || intErr || drvErr || lapErr;
  const dataUnavailable = sessionKey && !dataLoading && dataError && !positions;

  const selectedSession = availableSessions.find(
    (s) => s.session_key === sessionKey
  );

  const isRaceSession = selectedSession?.session_type === "Race" || selectedSession?.session_type === "Sprint";
  const isQualifying = selectedSession?.session_type === "Qualifying" || selectedSession?.session_type === "Sprint Qualifying" || selectedSession?.session_type === "Sprint Shootout";

  // Qualifying: segment times, cutoffs, and knockout positions (all dynamic)
  const qualiCutoffs = useMemo(() => {
    if (!isQualifying || !validLaps || !laps || !raceControl || !resultRows.length) return undefined;

    // Parse qualifying segment boundaries (Q1/Q2/Q3) from race control.
    // Each segment ends with CHEQUERED FLAG. Red flags cause extra SESSION STARTED
    // messages within the same segment, so we pair each CHEQUERED FLAG with the
    // first SESSION STARTED after the previous CHEQUERED FLAG.
    const segments: { start: string; end: string }[] = [];
    let pendingStart: string | null = null;
    for (const msg of raceControl) {
      if (msg.message === "SESSION STARTED" && pendingStart === null) {
        pendingStart = msg.date;
      }
      if (msg.message === "CHEQUERED FLAG" && pendingStart !== null) {
        segments.push({ start: pendingStart, end: msg.date });
        pendingStart = null;
      }
    }
    const segCount = Math.min(segments.length, 3);
    if (segCount < 2) return undefined;
    const starts = segments.map((s) => s.start);
    const ends = segments.map((s) => s.end);

    // Best valid lap per driver per segment (107% rule filters in-laps)
    function bestInSegment(segStart: string, segEnd: string, nextSegStart?: string): Map<number, number> {
      const best = new Map<number, number>();
      // Find fastest lap in this segment for 107% threshold
      let segFastest = Infinity;
      for (const lap of validLaps!) {
        if (!lap.lap_duration || lap.is_pit_out_lap) continue;
        const boundary = nextSegStart ?? segEnd;
        if (lap.date_start >= segStart && lap.date_start < boundary && lap.lap_duration < segFastest) {
          segFastest = lap.lap_duration;
        }
      }
      const segThreshold = isFinite(segFastest) ? segFastest * 1.07 : Infinity;
      for (const lap of validLaps!) {
        if (!lap.lap_duration || lap.is_pit_out_lap) continue;
        if (lap.lap_duration > segThreshold) continue;
        const boundary = nextSegStart ?? segEnd;
        if (lap.date_start >= segStart && lap.date_start < boundary) {
          const cur = best.get(lap.driver_number);
          if (!cur || lap.lap_duration < cur) {
            best.set(lap.driver_number, lap.lap_duration);
          }
        }
      }
      return best;
    }

    const segBests: Map<number, number>[] = [];
    for (let i = 0; i < segCount; i++) {
      segBests.push(bestInSegment(starts[i], ends[i], starts[i + 1]));
    }

    // Determine each driver's last segment (the furthest they participated in).
    // Use raw laps so drivers whose times were deleted are still counted.
    // Then use advancement logic to promote drivers who qualified for a later
    // segment but didn't set laps in it (e.g. Bortoleto AUS 2026 — made Q3
    // via Q2 results but didn't run in Q3).
    const driverLastSeg = new Map<number, number>();
    for (const row of resultRows) {
      const dNum = row.driver.driver_number;
      for (let s = segCount - 1; s >= 0; s--) {
        const segStart = starts[s];
        const boundary = starts[s + 1] ?? ends[s];
        const hasLap = laps!.some(
          (l) => l.driver_number === dNum && l.date_start >= segStart && l.date_start < boundary
        );
        if (hasLap) {
          driverLastSeg.set(dNum, s);
          break;
        }
      }
    }

    // Promote drivers who qualified for a later segment based on advancement.
    // Standard qualifying: top 15 from Q1 → Q2, top 10 from Q2 → Q3.
    const ADVANCEMENT = [15, 10]; // Q1→Q2, Q2→Q3
    for (let s = 0; s < segCount - 1; s++) {
      const times = [...segBests[s].entries()].sort((a, b) => a[1] - b[1]);
      const advanceCount = ADVANCEMENT[s] ?? 10;
      const advancedDrivers = times.slice(0, advanceCount).map(([dNum]) => dNum);
      for (const dNum of advancedDrivers) {
        const cur = driverLastSeg.get(dNum);
        if (cur === undefined || cur <= s) {
          driverLastSeg.set(dNum, s + 1);
        }
      }
    }

    // Drivers with no data at all (DNS) default to Q1 — they never advanced.
    for (const row of resultRows) {
      if (!driverLastSeg.has(row.driver.driver_number)) {
        driverLastSeg.set(row.driver.driver_number, 0);
      }
    }

    // Display time = best valid time from the driver's last segment.
    // If they participated but have no valid time (e.g. deleted for track limits),
    // they won't appear in segmentTimes and will show "NO TIME".
    const segmentTimes = new Map<number, number>();
    for (const row of resultRows) {
      const dNum = row.driver.driver_number;
      const seg = driverLastSeg.get(dNum);
      if (seg != null) {
        const t = segBests[seg].get(dNum);
        if (t != null) segmentTimes.set(dNum, t);
      }
    }

    // Knockout positions: first position where driver's last segment drops
    // e.g., if last Q3 driver is at position N, then position N+1 is the first Q2 knockout
    const sortedByPos = [...resultRows].sort((a, b) => a.position - b.position);
    let q2KnockoutPos: number | null = null; // first position knocked out in Q2
    let q1KnockoutPos: number | null = null; // first position knocked out in Q1
    for (const row of sortedByPos) {
      const seg = driverLastSeg.get(row.driver.driver_number);
      if (seg === segCount - 2 && q2KnockoutPos === null) {
        // This driver's last segment was Q2 (index segCount-2) — first Q2 knockout
        q2KnockoutPos = row.position;
      }
      if (seg === 0 && q1KnockoutPos === null && segCount >= 2) {
        // This driver only made Q1 — first Q1 knockout
        q1KnockoutPos = row.position;
      }
    }

    // Cutoff times: the slowest driver who advanced from each segment
    // Q2 cutoff = slowest Q3 participant's Q2 time
    // Q1 cutoff = slowest Q2 participant's Q1 time
    let q2CutoffTime: number | null = null;
    let q1CutoffTime: number | null = null;

    if (segCount >= 3) {
      // Q2 cutoff: among drivers who made Q3, find the slowest Q2 time
      let worstQ2ofQ3 = -Infinity;
      for (const [dNum, seg] of driverLastSeg) {
        if (seg === segCount - 1) { // made it to Q3
          const q2Time = segBests[segCount - 2].get(dNum);
          if (q2Time != null && q2Time > worstQ2ofQ3) worstQ2ofQ3 = q2Time;
        }
      }
      if (worstQ2ofQ3 > 0) q2CutoffTime = worstQ2ofQ3;
    }

    if (segCount >= 2) {
      // Q1 cutoff: among drivers who made Q2, find the slowest Q1 time
      let worstQ1ofQ2 = -Infinity;
      for (const [dNum, seg] of driverLastSeg) {
        if (seg >= 1) { // made it to Q2 or beyond
          const q1Time = segBests[0].get(dNum);
          if (q1Time != null && q1Time > worstQ1ofQ2) worstQ1ofQ2 = q1Time;
        }
      }
      if (worstQ1ofQ2 > 0) q1CutoffTime = worstQ1ofQ2;
    }

    return {
      q1CutoffTime,
      q2CutoffTime,
      segmentTimes,
      driverLastSeg,
      q2KnockoutPos,
      q1KnockoutPos,
      segBests,
      segCount,
    };
  }, [isQualifying, validLaps, laps, raceControl, resultRows]);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <SessionParamReader onParam={setParamSessionKey} />
      </Suspense>
      <PageHeader
        title="Session Overview"
        subtitle={
          selectedSession
            ? `${selectedSession.session_name} — ${selectedSession.location}`
            : "Select a session to view timing data"
        }
      />

      {/* API restriction banner */}
      {apiRestricted && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <span className="font-semibold">Live session in progress</span> — OpenF1
          restricts free API access during live F1 sessions. Data will load once the
          session ends. Previously cached data may still be available.
        </div>
      )}

      {/* Session picker */}
      <div className="flex flex-wrap items-center gap-3">
        <SeasonSelector value={year} onChange={handleYearChange} />

        <CustomSelect
          value={meetingKey?.toString() ?? ""}
          onChange={(v) => handleMeetingChange(Number(v))}
          disabled={meetingsLoading || sortedMeetings.length === 0}
          placeholder="Select race weekend…"
          className="w-64"
          options={sortedMeetings.map((m) => ({
            value: String(m.meeting_key),
            label: m.meeting_name,
            iconUrl: countryFlagUrl(m.country_code),
          }))}
        />

        <CustomSelect
          value={sessionKey?.toString() ?? ""}
          onChange={(v) => handleSessionChange(Number(v))}
          disabled={!meetingKey || sessionsLoading || availableSessions.length === 0}
          placeholder="Select session…"
          className="w-48"
          options={availableSessions.map((s) => ({
            value: String(s.session_key),
            label: s.session_name,
          }))}
        />

        {sessionKey && (
          <div className="flex rounded-md border border-f1-border">
            <button
              onClick={() => setViewMode("results")}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "results"
                  ? "bg-f1-red text-white"
                  : "bg-f1-surface text-f1-text-secondary hover:bg-f1-card"
              )}
            >
              Results
            </button>
            <button
              onClick={() => setViewMode("replay")}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "replay"
                  ? "bg-f1-red text-white"
                  : "bg-f1-surface text-f1-text-secondary hover:bg-f1-card"
              )}
            >
              Replay
            </button>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {(meetingsLoading || (meetingKey && sessionsLoading)) && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}

      {/* No session selected */}
      {!sessionKey && !meetingsLoading && !sessionsLoading && (
        <EmptyState
          title="No session selected"
          description="Choose a season, race weekend, and session above to view the timing breakdown."
        />
      )}

      {/* Data unavailable (API locked) */}
      {dataUnavailable && (
        <EmptyState
          title="Session data unavailable"
          description={
            apiRestricted
              ? "OpenF1 restricts API access during live sessions. Timing data will load once the live session ends — try refreshing later."
              : "Could not load timing data for this session. Try refreshing the page."
          }
        />
      )}

      {/* Results + race control */}
      {sessionKey && viewMode === "results" && !dataUnavailable && (
        <>
          {/* Top 3 Podium */}
          {resultRows.length >= 3 && !dataLoading && (
            <PodiumDisplay
              entries={resultRows.slice(0, 3).map((row) => ({
                position: row.position,
                driver: row.driver,
              }))}
            />
          )}

          {/* Results table + sidebar */}
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            <div className="space-y-4">
              {dataLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <ResultsTable results={resultRows} sessionType={selectedSession?.session_type} qualiCutoffs={qualiCutoffs} />
              )}
            </div>
            <div className="space-y-4">
              {selectedSession && (
                <CircuitMap
                  circuitKey={selectedSession.circuit_key}
                  year={selectedSession.year}
                  circuitShortName={selectedSession.circuit_short_name}
                  displayName={selectedSession.location}
                />
              )}
              {selectedSession && (
                <SessionInfoPanel
                  session={selectedSession}
                  year={year}
                  totalLaps={raceStats?.totalLaps}
                />
              )}
            </div>
          </div>

          {/* Charts */}
          {!dataLoading && raceStats && (
            <div className="grid gap-6 lg:grid-cols-2">
              {isRaceSession
                ? gridVsFinishData.length > 0 && (
                    <GridVsFinishChart data={gridVsFinishData} />
                  )
                : isQualifying
                  ? validLaps && drivers && (
                      <TeammateH2HChart drivers={drivers} laps={validLaps} />
                    )
                  : validLaps && drivers && (
                      <LapDistributionChart laps={validLaps} drivers={drivers} stints={stints ?? undefined} />
                    )}
              {isQualifying && validLaps && drivers && (
                <SectorDominanceChart drivers={drivers} laps={validLaps} />
              )}
              {(isRaceSession || selectedSession?.session_type === "Practice") && stints && drivers && raceStats.totalLaps > 0 && (
                <PitStrategyChart
                  stints={stints}
                  drivers={drivers}
                  totalLaps={raceStats.totalLaps}
                  finishOrder={resultRows.map((r) => r.driver.driver_number)}
                />
              )}
            </div>
          )}

        </>
      )}

      {/* Replay mode */}
      {sessionKey && viewMode === "replay" && !dataUnavailable && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <div className="space-y-6">
              {drivers && laps ? (
                <SessionReplay
                  sessionKey={sessionKey}
                  sessionType={selectedSession?.session_type ?? "Race"}
                  drivers={drivers}
                  laps={laps}
                  raceControl={raceControl ?? []}
                  onTimeChange={handleReplayTimeChange}
                  timingEntries={replayTimingEntries}
                  retiredDrivers={retiredDrivers}
                />
              ) : (
                <div className="space-y-4">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-24" />
                </div>
              )}
              {dataLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <TimingBoard entries={replayTimingEntries} retiredDrivers={retiredDrivers} isQualifying={isQuali} />
              )}
            </div>
            <div className="space-y-4 order-last lg:order-none">
              <h3 className="text-sm font-semibold uppercase text-f1-text-muted">
                Race Control
              </h3>
              {raceControl ? (
                <RaceControlFeed messages={replayRaceControl} />
              ) : (
                <Skeleton className="h-64" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
