"use client";

import { useMemo, useEffect, useRef } from "react";
import { useLocationData } from "@/lib/hooks/use-location-data";
import { useReplayState } from "@/lib/hooks/use-replay-state";
import {
  getFrameAtTime,
  getLapAtTime,
  buildSessionPhases,
  getPhaseLabel,
} from "@/lib/utils/replay-processor";
import { ReplayMap } from "@/components/live/replay-map";
import { ReplayControls } from "@/components/live/replay-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { Driver, LapData, RaceControlMessage } from "@/lib/openf1/types";
import type { TimingEntry } from "@/components/live/timing-board";

interface SessionReplayProps {
  sessionKey: number;
  sessionType: string;
  drivers: Driver[];
  laps: LapData[];
  raceControl: RaceControlMessage[];
  onTimeChange?: (time: number) => void;
  timingEntries?: TimingEntry[];
}

const LAP_SESSION_TYPES = new Set(["Race", "Sprint"]);

export function SessionReplay({
  sessionKey,
  sessionType,
  drivers,
  laps,
  raceControl,
  onTimeChange,
  timingEntries,
}: SessionReplayProps) {
  const useLapSkips = LAP_SESSION_TYPES.has(sessionType);

  const { data: snapshot, isLoading, error } = useLocationData(sessionKey);

  const replay = useReplayState(
    snapshot?.minTime ?? 0,
    snapshot?.maxTime ?? 0,
    laps
  );

  const driverPositions = useMemo(() => {
    if (!snapshot) return new Map<number, { x: number; y: number }>();
    return getFrameAtTime(snapshot, replay.currentTime);
  }, [snapshot, replay.currentTime]);

  // Lap-based status for Race/Sprint
  const { currentLap, totalLaps } = useMemo(
    () => getLapAtTime(replay.currentTime, laps),
    [replay.currentTime, laps]
  );

  // Derive leader / lapped status from timing board entries
  const driverLapStatus = useMemo(() => {
    const status = new Map<number, "leader" | "lapped" | null>();
    if (!timingEntries) return status;
    for (const e of timingEntries) {
      if (e.position === 1) {
        status.set(e.driverNumber, "leader");
      } else if (
        typeof e.gapToLeader === "string" &&
        /LAP/i.test(e.gapToLeader)
      ) {
        status.set(e.driverNumber, "lapped");
      } else {
        status.set(e.driverNumber, null);
      }
    }
    return status;
  }, [timingEntries]);

  // Phase-based status for Practice/Qualifying
  const phases = useMemo(
    () => buildSessionPhases(raceControl, sessionType),
    [raceControl, sessionType]
  );

  const statusLabel = useMemo(() => {
    if (useLapSkips) {
      return totalLaps > 0 ? `Lap ${currentLap} / ${totalLaps}` : "";
    }
    return getPhaseLabel(replay.currentTime, phases);
  }, [useLapSkips, currentLap, totalLaps, replay.currentTime, phases]);

  // Throttled time reporting to parent (~2 updates/sec for sidebar sync)
  // Uses trailing-edge fallback so the latest value is always delivered,
  // even when the replay is paused or data loads within the throttle window.
  const lastReportRef = useRef(0);
  useEffect(() => {
    if (!onTimeChange || !snapshot) return;

    const now = performance.now();

    if (now - lastReportRef.current >= 500) {
      lastReportRef.current = now;
      onTimeChange(replay.currentTime);
      return;
    }

    // Schedule a trailing call so we never permanently drop an update
    const remaining = 500 - (now - lastReportRef.current);
    const timerId = setTimeout(() => {
      lastReportRef.current = performance.now();
      onTimeChange(replay.currentTime);
    }, remaining);

    return () => clearTimeout(timerId);
  }, [replay.currentTime, onTimeChange, snapshot]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-f1-border bg-f1-surface">
          <div className="w-64 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-f1-border border-t-f1-red" />
            <p className="text-sm text-f1-text-secondary">
              Loading position data…
            </p>
            <p className="mt-1 text-xs text-f1-text-muted">
              Decoding the F1 live-timing archive. First load can take a few
              seconds.
            </p>
          </div>
        </div>
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load location data"
        description={`Error: ${error.message}. Try refreshing the page.`}
      />
    );
  }

  if (!snapshot || Object.keys(snapshot.drivers).length === 0) {
    return (
      <EmptyState
        title="No location data"
        description="Location data is not available for this session. Try selecting a different session."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ReplayMap
        trackPath={snapshot.trackPath}
        viewBox={snapshot.viewBox}
        driverPositions={driverPositions}
        drivers={drivers}
        sfLine={snapshot.sfLine}
        sectorTicks={snapshot.sectorTicks}
        driverLapStatus={driverLapStatus}
      />
      <ReplayControls
        currentTime={replay.currentTime}
        minTime={snapshot.minTime}
        maxTime={snapshot.maxTime}
        isPlaying={replay.isPlaying}
        speed={replay.speed}
        statusLabel={statusLabel}
        useLapSkips={useLapSkips}
        onToggle={replay.toggle}
        onSeekTo={replay.seekTo}
        onSkipForward={replay.skipForward}
        onSkipBackward={replay.skipBackward}
        onNextLap={replay.nextLap}
        onPrevLap={replay.prevLap}
        onSetSpeed={replay.setSpeed}
      />
    </div>
  );
}
