"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { isPast, parseISO } from "date-fns";
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
import { TimingBoard, buildTimingData } from "@/components/live/timing-board";
import { RaceControlFeed } from "@/components/live/race-control-feed";
import { CircuitMap } from "@/components/live/circuit-map";
import { SessionReplay } from "@/components/live/session-replay";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/cn";
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
  const [viewMode, setViewMode] = useState<"timing" | "replay">("timing");
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
    return [...meetings].sort(
      (a, b) =>
        parseISO(b.date_start).getTime() - parseISO(a.date_start).getTime()
    );
  }, [meetings]);

  // Sessions for the dropdown — show all session types so users can pick freely
  const availableSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions;
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
    setViewMode("timing");
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

  // Fetch timing data for selected session
  const { data: positions, error: posErr } = usePositions(sessionKey);
  const { data: intervals, error: intErr } = useIntervals(sessionKey, false);
  const { data: stints } = useStints(sessionKey);
  const { data: laps, error: lapErr } = useLaps(sessionKey);
  const { data: drivers, error: drvErr } = useDrivers(sessionKey);
  const { data: raceControl } = useRaceControl(sessionKey, false);

  const timingEntries =
    drivers && positions && intervals && stints && laps
      ? buildTimingData(drivers, positions, intervals, stints, laps)
      : [];

  // Filtered data for replay mode sidebar
  const replayTimingEntries = useMemo(() => {
    if (!drivers || !positions || !intervals || !stints || !laps) return [];
    // Show full timing data while replay hasn't reported a time yet
    if (replayTime === null)
      return buildTimingData(drivers, positions, intervals, stints, laps);
    const cutoff = new Date(replayTime).toISOString();
    const filteredPositions = positions.filter((p) => p.date <= cutoff);
    const filteredIntervals = intervals.filter((i) => i.date <= cutoff);
    const filteredLaps = laps.filter((l) => l.date_start <= cutoff);
    // For stints, keep those that started before or at current time
    // by finding the max lap number reached
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
      filteredLaps
    );
  }, [replayTime, drivers, positions, intervals, stints, laps]);

  const replayRaceControl = useMemo(() => {
    if (!replayTime || !raceControl) return raceControl ?? [];
    const cutoff = new Date(replayTime).toISOString();
    return raceControl.filter((m) => m.date <= cutoff);
  }, [replayTime, raceControl]);

  const dataLoading = sessionKey && (!positions || !intervals || !drivers);
  const dataError = posErr || intErr || drvErr || lapErr;
  const dataUnavailable = sessionKey && !dataLoading && dataError && !positions;

  const selectedSession = availableSessions.find(
    (s) => s.session_key === sessionKey
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session Analysis"
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
              onClick={() => setViewMode("timing")}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "timing"
                  ? "bg-f1-red text-white"
                  : "bg-f1-surface text-f1-text-secondary hover:bg-f1-card"
              )}
            >
              Timing
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

      {/* Timing board + race control */}
      {sessionKey && viewMode === "timing" && !dataUnavailable && (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          <div className="space-y-4">
            {dataLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 20 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <TimingBoard entries={timingEntries} />
            )}
          </div>
          <div className="space-y-4">
            {selectedSession && (
              <CircuitMap circuitShortName={selectedSession.circuit_short_name} />
            )}
            <h3 className="text-sm font-semibold uppercase text-f1-text-muted">
              Race Control
            </h3>
            {raceControl ? (
              <RaceControlFeed messages={raceControl} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </div>
      )}

      {/* Replay mode */}
      {sessionKey && viewMode === "replay" && !dataUnavailable && (
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
            <div className="space-y-4">
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
      )}
    </div>
  );
}
