"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocationData } from "@/lib/hooks/use-location-data";
import { useReplayState } from "@/lib/hooks/use-replay-state";
import {
  getFrameAtTime,
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
  retiredDrivers?: Map<number, string>;
}

const LAP_SESSION_TYPES = new Set(["Race", "Sprint"]);
const TIMING_SYNC_INTERVAL_MS = 100;

export function SessionReplay({
  sessionKey,
  sessionType,
  drivers,
  laps,
  raceControl,
  onTimeChange,
  timingEntries,
  retiredDrivers,
}: SessionReplayProps) {
  const useLapSkips = LAP_SESSION_TYPES.has(sessionType);
  const [controlsOpen, setControlsOpen] = useState(false);

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

  // Derive leader / lapped / retired status from timing board entries
  const driverLapStatus = useMemo(() => {
    const status = new Map<number, "leader" | "lapped" | "retired" | null>();
    if (!timingEntries || timingEntries.length === 0) return status;

    for (const e of timingEntries) {
      if (retiredDrivers?.get(e.driverNumber)) {
        status.set(e.driverNumber, "retired");
      } else if (e.position === 1) {
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
  }, [timingEntries, retiredDrivers]);

  // Compute active flag status per sector from race control messages.
  // Race control uses mini-sectors (varies per circuit); we map to 3 timing
  // sectors using thirds of the max mini-sector number seen.
  const trackFlagStatus = useMemo(() => {
    const status: [string | null, string | null, string | null] = [null, null, null];
    const cutoff = new Date(replay.currentTime).toISOString();

    // Find max mini-sector number to compute thirds
    let maxMiniSector = 0;
    for (const msg of raceControl) {
      if (msg.scope === "Sector" && msg.sector != null && msg.sector > maxMiniSector) {
        maxMiniSector = msg.sector;
      }
    }
    const s1Boundary = Math.ceil(maxMiniSector / 3);
    const s2Boundary = Math.ceil((maxMiniSector * 2) / 3);

    let trackFlag: string | null = null;
    let hasStarted = false;

    for (const msg of raceControl) {
      if (msg.date > cutoff) continue;

      const msgUpper = (msg.message ?? "").toUpperCase();

      if (msg.category === "SessionStatus" && msgUpper.includes("STARTED")) {
        hasStarted = true;
      }

      // SafetyCar category is the most reliable signal
      if (msg.category === "SafetyCar") {
        if (msgUpper.includes("VSC DEPLOYED")) {
          trackFlag = "vsc";
        } else if (msgUpper.includes("VSC ENDING")) {
          trackFlag = null;
        } else if (msgUpper.includes("SAFETY CAR DEPLOYED")) {
          trackFlag = "sc";
        } else if (msgUpper.includes("SAFETY CAR IN THIS LAP")) {
          trackFlag = "sc";
        }
        continue;
      }

      // Track-wide flags
      if (msg.scope === "Track") {
        if (msg.flag === "RED") {
          trackFlag = "red";
        } else if (msg.flag === "GREEN" || msg.flag === "CLEAR") {
          hasStarted = true;
          trackFlag = null;
          status[0] = null;
          status[1] = null;
          status[2] = null;
        }
        continue;
      }

      // Sector-scoped yellow flags
      if (msg.scope === "Sector" && msg.sector != null && maxMiniSector > 0) {
        const timingSector =
          msg.sector <= s1Boundary ? 0 : msg.sector <= s2Boundary ? 1 : 2;
        if (msg.flag === "YELLOW" || msg.flag === "DOUBLE YELLOW") {
          status[timingSector] = "yellow";
        } else if (msg.flag === "GREEN" || msg.flag === "CLEAR") {
          status[timingSector] = null;
        }
      }
    }

    // Track-wide flags override individual sectors
    if (trackFlag) {
      return [trackFlag, trackFlag, trackFlag] as [string | null, string | null, string | null];
    }

    if (!hasStarted) {
      return [null, null, null];
    }

    return status;
  }, [raceControl, replay.currentTime]);

  // Throttled time reporting to parent (~10 updates/sec for sidebar sync)
  // Uses trailing-edge fallback so the latest value is always delivered,
  // even when the replay is paused or data loads within the throttle window.
  const lastReportRef = useRef(0);
  useEffect(() => {
    if (!onTimeChange || !snapshot) return;

    const now = performance.now();

    if (now - lastReportRef.current >= TIMING_SYNC_INTERVAL_MS) {
      lastReportRef.current = now;
      onTimeChange(replay.currentTime);
      return;
    }

    // Schedule a trailing call so we never permanently drop an update
    const remaining = TIMING_SYNC_INTERVAL_MS - (now - lastReportRef.current);
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
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-f1-border border-t-f1-accent" />
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
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => setControlsOpen((open) => !open)}
            aria-label={controlsOpen ? "Hide replay timeline" : "Show replay timeline"}
            className="inline-flex h-8 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-f1-border bg-f1-surface/95 text-f1-text shadow-lg backdrop-blur transition-colors hover:bg-f1-card"
          >
            <ChevronDown
              size={18}
              className={controlsOpen ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </button>
          <div
            className={
              controlsOpen
                ? "-mt-3 w-[min(92vw,52rem)] overflow-hidden transition-all duration-200 ease-out max-h-64 opacity-100"
                : "-mt-3 w-[min(92vw,52rem)] overflow-hidden transition-all duration-200 ease-out max-h-0 opacity-0"
            }
          >
            <ReplayControls
              currentTime={replay.currentTime}
              minTime={snapshot.minTime}
              maxTime={snapshot.maxTime}
              isPlaying={replay.isPlaying}
              speed={replay.speed}
              useLapSkips={useLapSkips}
              embedded
              onToggle={replay.toggle}
              onSeekTo={replay.seekTo}
              onSkipForward={replay.skipForward}
              onSkipBackward={replay.skipBackward}
              onNextLap={replay.nextLap}
              onPrevLap={replay.prevLap}
              onSetSpeed={replay.setSpeed}
            />
          </div>
        </div>
      </div>
      <ReplayMap
        trackPath={snapshot.trackPath}
        viewBox={snapshot.viewBox}
        driverPositions={driverPositions}
        drivers={drivers}
        sfLine={snapshot.sfLine}
        sectorTicks={snapshot.sectorTicks}
        sectorPaths={snapshot.sectorPaths}
        trackFlagStatus={trackFlagStatus}
        driverLapStatus={driverLapStatus}
      />
    </div>
  );
}
