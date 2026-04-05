"use client";

import { useMemo, useEffect, useRef } from "react";
import { useLocationData } from "@/lib/hooks/use-location-data";
import { useReplayState } from "@/lib/hooks/use-replay-state";
import {
  processLocationData,
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

interface SessionReplayProps {
  sessionKey: number;
  sessionType: string;
  drivers: Driver[];
  laps: LapData[];
  raceControl: RaceControlMessage[];
  onTimeChange?: (time: number) => void;
}

const LAP_SESSION_TYPES = new Set(["Race", "Sprint"]);

export function SessionReplay({
  sessionKey,
  sessionType,
  drivers,
  laps,
  raceControl,
  onTimeChange,
}: SessionReplayProps) {
  const useLapSkips = LAP_SESSION_TYPES.has(sessionType);

  const driverNumbers = useMemo(
    () => drivers.map((d) => d.driver_number),
    [drivers]
  );

  const { data: locationData, isLoading, error } = useLocationData(sessionKey);

  const processedData = useMemo(() => {
    if (!locationData || locationData.length === 0) return null;
    return processLocationData(locationData, laps, driverNumbers);
  }, [locationData, laps, driverNumbers]);

  const replay = useReplayState(
    processedData?.minTime ?? 0,
    processedData?.maxTime ?? 0,
    laps
  );

  const driverPositions = useMemo(() => {
    if (!processedData) return new Map<number, { x: number; y: number }>();
    return getFrameAtTime(processedData, replay.currentTime);
  }, [processedData, replay.currentTime]);

  // Lap-based status for Race/Sprint
  const { currentLap, totalLaps } = useMemo(
    () => getLapAtTime(replay.currentTime, laps),
    [replay.currentTime, laps]
  );

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
    if (!onTimeChange || !processedData) return;

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
  }, [replay.currentTime, onTimeChange, processedData]);

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

  if (!locationData || locationData.length === 0 || !processedData) {
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
        trackPath={processedData.trackPath}
        viewBox={processedData.viewBox}
        driverPositions={driverPositions}
        drivers={drivers}
      />
      <ReplayControls
        currentTime={replay.currentTime}
        minTime={processedData.minTime}
        maxTime={processedData.maxTime}
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
