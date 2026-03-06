import { useState, useCallback, useRef, useEffect } from "react";
import type { LapData } from "@/lib/openf1/types";

export type PlaybackSpeed = 1 | 2 | 5 | 10 | 20;

export interface ReplayState {
  currentTime: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (time: number) => void;
  seekToLap: (lapNumber: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  skipForward: (seconds: number) => void;
  skipBackward: (seconds: number) => void;
  nextLap: () => void;
  prevLap: () => void;
}

export function useReplayState(
  minTime: number,
  maxTime: number,
  laps: LapData[]
): ReplayState {
  const [currentTime, setCurrentTime] = useState(minTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const currentTimeRef = useRef(currentTime);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);

  // Keep refs in sync
  currentTimeRef.current = currentTime;
  speedRef.current = speed;
  isPlayingRef.current = isPlaying;

  // Reset to start when minTime changes (new session loaded)
  useEffect(() => {
    setCurrentTime(minTime);
    setIsPlaying(false);
  }, [minTime]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastFrameRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - lastFrameRef.current;
      lastFrameRef.current = now;

      // Cap delta to avoid jumps after tab switches (~33ms = 30fps cap)
      const cappedElapsed = Math.min(elapsed, 100);
      const advance = cappedElapsed * speedRef.current;

      const newTime = currentTimeRef.current + advance;

      if (newTime >= maxTime) {
        setCurrentTime(maxTime);
        setIsPlaying(false);
        return;
      }

      setCurrentTime(newTime);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, maxTime]);

  const play = useCallback(() => {
    if (currentTimeRef.current >= maxTime) {
      // If at end, restart from beginning
      setCurrentTime(minTime);
    }
    setIsPlaying(true);
  }, [minTime, maxTime]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const seekTo = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(minTime, Math.min(maxTime, time)));
    },
    [minTime, maxTime]
  );

  // Build sorted lap start times
  const lapStartTimes = useRef<{ lapNumber: number; time: number }[]>([]);
  useEffect(() => {
    const starts = new Map<number, number>();
    for (const lap of laps) {
      if (!lap.date_start) continue;
      const t = new Date(lap.date_start).getTime();
      const existing = starts.get(lap.lap_number);
      if (existing === undefined || t < existing) {
        starts.set(lap.lap_number, t);
      }
    }
    lapStartTimes.current = [...starts.entries()]
      .map(([lapNumber, time]) => ({ lapNumber, time }))
      .sort((a, b) => a.time - b.time);
  }, [laps]);

  const seekToLap = useCallback(
    (lapNumber: number) => {
      const entry = lapStartTimes.current.find(
        (l) => l.lapNumber === lapNumber
      );
      if (entry) {
        seekTo(entry.time);
      }
    },
    [seekTo]
  );

  const skipForward = useCallback(
    (seconds: number) => {
      seekTo(currentTimeRef.current + seconds * 1000);
    },
    [seekTo]
  );

  const skipBackward = useCallback(
    (seconds: number) => {
      seekTo(currentTimeRef.current - seconds * 1000);
    },
    [seekTo]
  );

  const nextLap = useCallback(() => {
    const current = currentTimeRef.current;
    const next = lapStartTimes.current.find((l) => l.time > current + 500);
    if (next) seekTo(next.time);
  }, [seekTo]);

  const prevLap = useCallback(() => {
    const current = currentTimeRef.current;
    // Find the lap start before the current one (with 2s buffer to avoid landing on current)
    const candidates = lapStartTimes.current.filter(
      (l) => l.time < current - 2000
    );
    if (candidates.length > 0) {
      seekTo(candidates[candidates.length - 1].time);
    } else {
      seekTo(minTime);
    }
  }, [seekTo, minTime]);

  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedState(s);
  }, []);

  return {
    currentTime,
    isPlaying,
    speed,
    play,
    pause,
    toggle,
    seekTo,
    seekToLap,
    setSpeed,
    skipForward,
    skipBackward,
    nextLap,
    prevLap,
  };
}
