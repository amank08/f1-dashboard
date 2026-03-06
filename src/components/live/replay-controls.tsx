"use client";

import { memo, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PlaybackSpeed } from "@/lib/hooks/use-replay-state";

interface ReplayControlsProps {
  currentTime: number;
  minTime: number;
  maxTime: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  statusLabel: string;
  useLapSkips: boolean;
  onToggle: () => void;
  onSeekTo: (time: number) => void;
  onSkipForward: (seconds: number) => void;
  onSkipBackward: (seconds: number) => void;
  onNextLap: () => void;
  onPrevLap: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10, 20];

const btnBase = cn(
  "flex items-center justify-center rounded-md border border-f1-border",
  "bg-f1-surface p-2 text-f1-text transition-colors hover:bg-f1-card",
  "disabled:opacity-40 disabled:cursor-not-allowed"
);

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const ReplayControls = memo(function ReplayControls({
  currentTime,
  minTime,
  maxTime,
  isPlaying,
  speed,
  statusLabel,
  useLapSkips,
  onToggle,
  onSeekTo,
  onSkipForward,
  onSkipBackward,
  onNextLap,
  onPrevLap,
  onSetSpeed,
}: ReplayControlsProps) {
  const elapsed = currentTime - minTime;
  const duration = maxTime - minTime;
  const progress = duration > 0 ? ((currentTime - minTime) / duration) * 100 : 0;

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pct = Number(e.target.value);
      onSeekTo(minTime + (pct / 100) * duration);
    },
    [minTime, duration, onSeekTo]
  );

  const skipAmount = useLapSkips ? 10 : 30;
  const bigSkipAmount = 60;

  return (
    <div className="space-y-3 rounded-lg border border-f1-border bg-f1-surface p-4">
      {/* Timeline scrubber */}
      <div className="flex items-center gap-3">
        <span className="w-16 text-right font-mono text-xs text-f1-text-secondary">
          {formatElapsed(elapsed)}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.01}
          value={progress}
          onChange={handleScrub}
          className="replay-slider h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-f1-border accent-f1-red"
        />
        <span className="w-16 font-mono text-xs text-f1-text-secondary">
          {formatElapsed(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {useLapSkips ? (
            <button
              onClick={onPrevLap}
              className={btnBase}
              title="Previous lap"
            >
              <SkipBack size={16} />
            </button>
          ) : (
            <button
              onClick={() => onSkipBackward(bigSkipAmount)}
              className={btnBase}
              title="Back 1min"
            >
              <SkipBack size={16} />
              <span className="text-xs">1m</span>
            </button>
          )}
          <button
            onClick={() => onSkipBackward(skipAmount)}
            className={btnBase}
            title={`Back ${skipAmount}s`}
          >
            <ChevronLeft size={16} />
            <span className="text-xs">{skipAmount}s</span>
          </button>
          <button
            onClick={onToggle}
            className={cn(btnBase, "px-3")}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={() => onSkipForward(skipAmount)}
            className={btnBase}
            title={`Forward ${skipAmount}s`}
          >
            <span className="text-xs">{skipAmount}s</span>
            <ChevronRight size={16} />
          </button>
          {useLapSkips ? (
            <button
              onClick={onNextLap}
              className={btnBase}
              title="Next lap"
            >
              <SkipForward size={16} />
            </button>
          ) : (
            <button
              onClick={() => onSkipForward(bigSkipAmount)}
              className={btnBase}
              title="Forward 1min"
            >
              <span className="text-xs">1m</span>
              <SkipForward size={16} />
            </button>
          )}
        </div>

        {/* Speed buttons */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold transition-colors",
                speed === s
                  ? "border-f1-red bg-f1-red text-white"
                  : "border-f1-border bg-f1-surface text-f1-text-secondary hover:bg-f1-card"
              )}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Status label */}
        <div className="font-mono text-sm text-f1-text-secondary">
          {statusLabel}
        </div>
      </div>
    </div>
  );
});
