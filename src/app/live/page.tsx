"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { isPast, isFuture, parseISO } from "date-fns";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { useSessions } from "@/lib/hooks/use-sessions";
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
import type { Session } from "@/lib/openf1/types";

const RACE_SESSION_TYPES = new Set([
  "Race",
  "Sprint",
  "Qualifying",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Practice",
]);

const selectClasses = cn(
  "rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-sm font-semibold text-f1-text",
  "focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
);

function findLatestCompletedSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter(
      (s) => RACE_SESSION_TYPES.has(s.session_type) && isPast(parseISO(s.date_end))
    )
    .sort(
      (a, b) => parseISO(b.date_end).getTime() - parseISO(a.date_end).getTime()
    )[0];
}

export default function SessionAnalysisPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [viewMode, setViewMode] = useState<"results" | "replay">("results");
  const [replayTime, setReplayTime] = useState<number | null>(null);

  const handleReplayTimeChange = useCallback((time: number) => {
    setReplayTime(time);
  }, []);

  const { data: meetings, isLoading: meetingsLoading, error: meetingsError } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } = useSessions(meetingKey);

  // Detect OpenF1 live-session lockout
  const apiRestricted = meetingsError?.message?.includes("Live F1 session")
    || meetingsError?.message?.includes("restricted")
    || false;

  // All meetings for the dropdown (sorted most recent first)
  const sortedMeetings = useMemo(() => {
    if (!meetings) return [];
    return [...meetings]
      .filter((m) => isPast(parseISO(m.date_start)))
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
  // Skip pre-season testing; fall back to previous year if no GPs completed
  useEffect(() => {
    if (autoSelected || !meetings || meetingsLoading) return;

    const completed = [...meetings]
      .filter((m) => isPast(parseISO(m.date_start)))
      .sort(
        (a, b) =>
          parseISO(b.date_start).getTime() - parseISO(a.date_start).getTime()
      );

    // Prefer actual GP meetings over testing
    const gp = completed.find(
      (m) => !m.meeting_name.toLowerCase().includes("testing")
    );

    if (gp) {
      setMeetingKey(gp.meeting_key);
      setAutoSelected(true);
    } else if (completed.length > 0) {
      // Only testing sessions completed — try previous year
      if (year > 2023) {
        setYear(year - 1);
        return;
      }
      setMeetingKey(completed[0].meeting_key);
      setAutoSelected(true);
    } else {
      setAutoSelected(true);
    }
  }, [meetings, meetingsLoading, autoSelected, year]);

  // Auto-select the latest completed session when sessions load
  useEffect(() => {
    if (!sessions || sessionsLoading || sessionKey) return;
    const latest = findLatestCompletedSession(sessions);
    if (latest) {
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
    return laps.filter((l) => {
      if (!l.lap_duration) return true;
      return !deletedTimes.has(`${l.driver_number}-${l.lap_duration.toFixed(3)}`);
    });
  }, [laps, raceControl]);

  // Enriched results (pass intervals + stints for the 10-column table)
  const resultRows = useMemo(() => {
    if (!drivers || !positions || !validLaps) return [];
    const sessionType = sessions?.find((s) => s.session_key === sessionKey)?.session_type;
    return buildResults(positions, drivers, validLaps, intervals ?? undefined, stints ?? undefined, sessionType);
  }, [positions, drivers, validLaps, intervals, stints, sessions, sessionKey]);

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

    // Total laps
    const totalLaps = Math.max(...validLaps.map((l) => l.lap_number), 0);

    return {
      changes,
      gridMap,
      finishMap,
      totalLaps,
    };
  }, [drivers, validLaps, positions, resultRows]);

  // Chart data for GridVsFinish
  const gridVsFinishData = useMemo(() => {
    if (!raceStats || !drivers) return [];
    const driverLookup = new Map(drivers.map((d) => [d.driver_number, d]));
    return raceStats.changes.map((c) => ({
      name: driverLookup.get(c.driverNumber)?.name_acronym ?? String(c.driverNumber),
      gridPos: c.gridPos,
      finishPos: c.finishPos,
      teamColour: driverLookup.get(c.driverNumber)?.team_colour ?? "888888",
      change: c.change,
    }));
  }, [raceStats, drivers]);

  // Filtered timing data for replay mode sidebar
  const replayTimingEntries = useMemo(() => {
    if (!drivers || !positions || !intervals || !stints || !laps) return [];
    if (replayTime === null)
      return buildTimingData(drivers, positions, intervals, stints, laps);
    const cutoff = new Date(replayTime).toISOString();
    const filteredPositions = positions.filter((p) => p.date <= cutoff);
    const filteredIntervals = intervals.filter((i) => i.date <= cutoff);
    const filteredLaps = laps.filter((l) => l.date_start <= cutoff);
    const maxLapByDriver = new Map<number, number>();
    for (const l of filteredLaps) {
      const cur = maxLapByDriver.get(l.driver_number) ?? 0;
      if (l.lap_number > cur) maxLapByDriver.set(l.driver_number, l.lap_number);
    }
    const filteredStints = stints.filter((s) => {
      const maxLap = maxLapByDriver.get(s.driver_number) ?? 0;
      return s.lap_start <= maxLap;
    });
    return buildTimingData(
      drivers,
      filteredPositions,
      filteredIntervals,
      filteredStints,
      filteredLaps,
      replayTime
    );
  }, [replayTime, drivers, positions, intervals, stints, laps]);

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
    if (!isQualifying || !validLaps || !raceControl || !resultRows.length) return undefined;

    // Parse qualifying segment boundaries from race control
    // Use only "SESSION STARTED" to avoid double-counting with "GREEN LIGHT"
    const starts: string[] = [];
    const ends: string[] = [];
    for (const msg of raceControl) {
      if (msg.message === "SESSION STARTED") {
        starts.push(msg.date);
      }
      if (msg.message === "CHEQUERED FLAG") {
        ends.push(msg.date);
      }
    }
    const segCount = Math.min(starts.length, ends.length, 3);
    if (segCount < 2) return undefined;

    // Best valid lap per driver per segment
    function bestInSegment(segStart: string, segEnd: string, nextSegStart?: string): Map<number, number> {
      const best = new Map<number, number>();
      for (const lap of validLaps!) {
        if (!lap.lap_duration || lap.is_pit_out_lap) continue;
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

    // Determine each driver's last segment (the furthest they advanced)
    // and build segment-specific display times
    const driverLastSeg = new Map<number, number>();
    for (const row of resultRows) {
      const dNum = row.driver.driver_number;
      for (let s = segCount - 1; s >= 0; s--) {
        if (segBests[s].has(dNum)) {
          driverLastSeg.set(dNum, s);
          break;
        }
      }
    }

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
      q2KnockoutPos,
      q1KnockoutPos,
    };
  }, [isQualifying, validLaps, raceControl, resultRows]);

  return (
    <div className="space-y-6">
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

        <select
          value={meetingKey ?? ""}
          onChange={(e) => handleMeetingChange(Number(e.target.value))}
          disabled={meetingsLoading || sortedMeetings.length === 0}
          className={selectClasses}
        >
          {!meetingKey && <option value="">Select race weekend…</option>}
          {sortedMeetings.map((m) => (
            <option key={m.meeting_key} value={m.meeting_key}>
              {m.meeting_name}
            </option>
          ))}
        </select>

        <select
          value={sessionKey ?? ""}
          onChange={(e) => handleSessionChange(Number(e.target.value))}
          disabled={!meetingKey || sessionsLoading || availableSessions.length === 0}
          className={selectClasses}
        >
          {!sessionKey && <option value="">Select session…</option>}
          {availableSessions.map((s) => (
            <option key={s.session_key} value={s.session_key}>
              {s.session_name}
            </option>
          ))}
        </select>

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
                <CircuitMap circuitShortName={selectedSession.circuit_short_name} />
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
            <div>
              {drivers && laps ? (
                <SessionReplay
                  sessionKey={sessionKey}
                  sessionType={selectedSession?.session_type ?? "Race"}
                  drivers={drivers}
                  laps={laps}
                  raceControl={raceControl ?? []}
                  onTimeChange={handleReplayTimeChange}
                />
              ) : (
                <div className="space-y-4">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-24" />
                </div>
              )}
            </div>
            <div className="space-y-4">
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
          {dataLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <TimingBoard entries={replayTimingEntries} />
          )}
        </div>
      )}
    </div>
  );
}
