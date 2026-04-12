"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isPast, isFuture, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { useSessions, useSession } from "@/lib/hooks/use-sessions";
import { usePositions } from "@/lib/hooks/use-positions";
import { useIntervals } from "@/lib/hooks/use-intervals";
import { useStints } from "@/lib/hooks/use-stints";
import { useLaps } from "@/lib/hooks/use-laps";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useRaceControl } from "@/lib/hooks/use-race-control";
import { usePitStops } from "@/lib/hooks/use-pit-stops";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { ResultsTable, buildResults } from "@/components/tables/results-table";
import { TimingBoard } from "@/components/live/timing-board";
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
import { countryFlagUrl } from "@/lib/utils/formatters";
import {
  buildReplaySessionIndex,
  buildReplayTimingEntries,
  filterDeletedLapTimes,
  filterReplayRaceControl,
} from "@/lib/utils/live-session-analysis";
import {
  buildSessionPhases,
  getLapAtTime,
  getPhaseLabel,
  getQualifyingCutoffs,
  getQualifyingKnockoutPosition,
  getRetiredDrivers,
} from "@/lib/utils/replay-processor";
import { buildSessionSummary } from "@/lib/utils/session-summary";
import { CustomSelect } from "@/components/ui/custom-select";
import type { RaceControlMessage, Session } from "@/lib/openf1/types";

const RACE_SESSION_TYPES = new Set([
  "Race",
  "Sprint",
  "Qualifying",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Practice",
]);

function getReplayTrackStatusLabel(
  raceControl: RaceControlMessage[] | null | undefined,
  replayTime: number | null
): string | null {
  if (!raceControl || replayTime == null) return null;

  const cutoff = new Date(replayTime).toISOString();
  let maxMiniSector = 0;
  for (const msg of raceControl) {
    if (msg.scope === "Sector" && msg.sector != null && msg.sector > maxMiniSector) {
      maxMiniSector = msg.sector;
    }
  }

  const s1Boundary = Math.ceil(maxMiniSector / 3);
  const s2Boundary = Math.ceil((maxMiniSector * 2) / 3);
  const sectorStatus: [string | null, string | null, string | null] = [null, null, null];
  let trackFlag: string | null = null;

  for (const msg of raceControl) {
    if (msg.date > cutoff) continue;
    const msgUpper = (msg.message ?? "").toUpperCase();

    if (msg.category === "SafetyCar") {
      if (msgUpper.includes("VSC DEPLOYED")) trackFlag = "VSC";
      else if (msgUpper.includes("VSC ENDING")) trackFlag = null;
      else if (msgUpper.includes("SAFETY CAR DEPLOYED")) trackFlag = "SC";
      else if (msgUpper.includes("SAFETY CAR IN THIS LAP")) trackFlag = "SC";
      continue;
    }

    if (msg.scope === "Track") {
      if (msg.flag === "RED") trackFlag = "RED";
      else if (msg.flag === "GREEN" || msg.flag === "CLEAR") trackFlag = "GREEN";
      continue;
    }

    if (msg.scope === "Sector" && msg.sector != null && maxMiniSector > 0) {
      const timingSector =
        msg.sector <= s1Boundary ? 0 : msg.sector <= s2Boundary ? 1 : 2;
      if (msg.flag === "YELLOW" || msg.flag === "DOUBLE YELLOW") {
        sectorStatus[timingSector] = "YELLOW";
      } else if (msg.flag === "GREEN" || msg.flag === "CLEAR") {
        sectorStatus[timingSector] = null;
      }
    }
  }

  if (trackFlag === "SC" || trackFlag === "VSC" || trackFlag === "RED") return trackFlag;
  if (sectorStatus.some(Boolean)) return "YELLOW";
  if (trackFlag) return trackFlag;
  return "GREEN";
}


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
  const { data: pitStops } = usePitStops(sessionKey);

  // Filter out deleted lap times using race control messages.
  // Match by driver + lap time (seconds) rather than lap number, because
  // race control lap numbers are consistently off-by-one vs OpenF1.
  const validLaps = useMemo(() => filterDeletedLapTimes(laps, raceControl), [laps, raceControl]);

  // Enriched results (pass intervals + stints for the 10-column table)
  const resultRows = useMemo(() => {
    if (!drivers || !positions || !validLaps) return [];
    const sessionType = sessions?.find((s) => s.session_key === sessionKey)?.session_type;
    return buildResults(positions, drivers, validLaps, intervals ?? undefined, stints ?? undefined, sessionType, raceControl ?? undefined, sessionKey ?? undefined);
  }, [positions, drivers, validLaps, intervals, stints, sessions, sessionKey, raceControl]);

  // Race summary stats
  const raceStats = useMemo(() => {
    if (!drivers || !validLaps || !positions) return null;
    return buildSessionSummary(drivers, positions, validLaps, stints);
  }, [drivers, validLaps, positions, stints]);

  // Chart data for GridVsFinish
  const gridVsFinishData = useMemo(() => {
    return raceStats?.gridVsFinishData ?? [];
  }, [raceStats]);

  const selectedSession = availableSessions.find(
    (s) => s.session_key === sessionKey
  );

  const isQuali = selectedSession?.session_type === "Qualifying";

  const replaySessionIndex = useMemo(() => {
    if (!drivers || !positions || !laps) return null;
    return buildReplaySessionIndex(
      drivers,
      positions,
      intervals ?? [],
      laps,
      pitStops,
      raceControl
    );
  }, [drivers, positions, intervals, laps, pitStops, raceControl]);

  // Filtered timing data for replay mode sidebar
  const replayTimingEntries = useMemo(() => {
    if (!drivers || !positions || !laps) return [];
    return buildReplayTimingEntries(
      drivers,
      positions,
      intervals ?? [],
      stints ?? [],
      laps,
      pitStops,
      replayTime,
      isQuali,
      raceControl,
      replaySessionIndex
    );
  }, [replayTime, drivers, positions, intervals, stints, laps, pitStops, isQuali, raceControl, replaySessionIndex]);

  // Detect retired/eliminated drivers from timing entries.
  // Race: DNF if lap count <90% of leader and no recent laps (3 min).
  // Qualifying: eliminated if knocked out of Q1/Q2.
  const retiredDrivers = useMemo(() => {
    return getRetiredDrivers(
      replayTimingEntries,
      laps ?? [],
      replayTime,
      isQuali,
      raceControl ?? [],
      positions ?? [],
      selectedSession?.session_type
    );
  }, [replayTimingEntries, laps, replayTime, isQuali, raceControl, positions, selectedSession?.session_type]);

  // Knockout zone: position at which drivers are in danger of elimination.
  // During Q1 the bottom 6 are eliminated, during Q2 the next bottom 6.
  // In Q3 or after elimination is finalized, no knockout zone.
  const qualiKnockoutPos = useMemo(() => {
    if (!isQuali || !raceControl || replayTime == null) return undefined;
    return getQualifyingKnockoutPosition(raceControl, replayTime);
  }, [isQuali, raceControl, replayTime]);

  const replayRaceControl = useMemo(
    () => filterReplayRaceControl(raceControl, replayTime),
    [replayTime, raceControl]
  );

  const replayPhases = useMemo(
    () => buildSessionPhases(raceControl ?? [], selectedSession?.session_type ?? "Race"),
    [raceControl, selectedSession?.session_type]
  );

  const replayStatusLabel = useMemo(() => {
    if (replayTime == null || !laps || !selectedSession?.session_type) return null;
    const useLapStatus = selectedSession.session_type === "Race" || selectedSession.session_type === "Sprint";
    if (useLapStatus) {
      const { currentLap, totalLaps } = getLapAtTime(replayTime, laps);
      return totalLaps > 0 ? `Lap ${currentLap} / ${totalLaps}` : null;
    }
    return getPhaseLabel(replayTime, replayPhases, laps) || null;
  }, [replayTime, laps, replayPhases, selectedSession?.session_type]);

  const replayTrackStatusLabel = useMemo(
    () => getReplayTrackStatusLabel(raceControl, replayTime),
    [raceControl, replayTime]
  );

  const dataLoading = sessionKey && (!positions || !drivers);
  const dataError = posErr || intErr || drvErr || lapErr;
  const dataUnavailable = sessionKey && !dataLoading && dataError && !positions;

  const isRaceSession = selectedSession?.session_type === "Race" || selectedSession?.session_type === "Sprint";
  const isQualifying = selectedSession?.session_type === "Qualifying" || selectedSession?.session_type === "Sprint Qualifying" || selectedSession?.session_type === "Sprint Shootout";
  const isPractice = selectedSession?.session_type === "Practice";

  // Qualifying: segment times, cutoffs, and knockout positions (all dynamic)
  const qualiCutoffs = useMemo(() => {
    if (!isQualifying || !validLaps || !laps || !raceControl || !resultRows.length) return undefined;
    return getQualifyingCutoffs(
      validLaps,
      laps,
      raceControl,
      resultRows.map((row) => ({
        position: row.position,
        driverNumber: row.driver.driver_number,
      }))
    );
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
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        {/* Row 1: year + view toggle (mobile), inline on desktop */}
        <div className="flex items-center gap-2 sm:contents">
          <SeasonSelector value={year} onChange={handleYearChange} />
          {sessionKey && (
            <div className="flex rounded-md border border-f1-border sm:order-last ml-auto sm:ml-0">
              <button
                onClick={() => setViewMode("results")}
                className={cn(
                  "px-3 py-2 text-sm font-semibold transition-colors",
                  viewMode === "results"
                    ? "bg-f1-accent text-white"
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
                    ? "bg-f1-accent text-white"
                    : "bg-f1-surface text-f1-text-secondary hover:bg-f1-card"
                )}
              >
                Replay
              </button>
            </div>
          )}
        </div>

        {/* Row 2: race + session dropdowns (full-width on mobile, fixed on desktop) */}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <CustomSelect
            value={meetingKey?.toString() ?? ""}
            onChange={(v) => handleMeetingChange(Number(v))}
            disabled={meetingsLoading || sortedMeetings.length === 0}
            placeholder="Select race…"
            className="sm:w-64"
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
            placeholder="Session…"
            className="sm:w-48"
            options={availableSessions.map((s) => ({
              value: String(s.session_key),
              label: s.session_name,
            }))}
          />
        </div>
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
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:grid-rows-[auto_1fr]">
            {/* Replay map — always first */}
            <div className="order-1 space-y-4 lg:col-start-1 lg:row-start-1">
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
            </div>
            {/* Timing board — second on mobile, below map on desktop */}
            <div className="order-2 space-y-4 lg:col-start-1 lg:row-start-2">
              <div className="overflow-hidden rounded-lg border border-f1-border bg-f1-bg">
                {(replayStatusLabel || replayTrackStatusLabel) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-f1-border bg-f1-surface px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-f1-text-muted">
                        Replay
                      </span>
                      {replayStatusLabel && (
                        <span className="font-mono text-sm font-semibold text-f1-text sm:text-[15px]">
                          {replayStatusLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-[2rem] items-center justify-end sm:min-w-[10rem]">
                      <AnimatePresence mode="wait">
                        {replayTrackStatusLabel && (
                          <motion.span
                            key={replayTrackStatusLabel}
                            initial={{ opacity: 0, y: 6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.96 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={cn(
                              "inline-flex min-w-[8.75rem] items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:min-w-[10rem]",
                              replayTrackStatusLabel === "GREEN" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                              replayTrackStatusLabel === "YELLOW" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
                              replayTrackStatusLabel === "VSC" && "border-blue-500/30 bg-blue-500/10 text-blue-200",
                              replayTrackStatusLabel === "SC" && "border-orange-500/30 bg-orange-500/10 text-orange-200",
                              replayTrackStatusLabel === "RED" && "border-red-500/30 bg-red-500/10 text-red-200"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                replayTrackStatusLabel === "GREEN" && "bg-emerald-300",
                                replayTrackStatusLabel === "YELLOW" && "bg-yellow-200 animate-pulse",
                                replayTrackStatusLabel === "VSC" && "bg-blue-200 animate-pulse",
                                replayTrackStatusLabel === "SC" && "bg-orange-200 animate-pulse",
                                replayTrackStatusLabel === "RED" && "bg-red-200 animate-pulse"
                              )}
                            />
                            {replayTrackStatusLabel}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
                {dataLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : (
                  <TimingBoard
                    entries={replayTimingEntries}
                    retiredDrivers={retiredDrivers}
                    isQualifying={isQuali}
                    isPractice={isPractice}
                    knockoutPosition={qualiKnockoutPos}
                    embedded
                  />
                )}
              </div>
            </div>
            {/* Race control — third on mobile, right column on desktop */}
            <div className="order-3 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
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
