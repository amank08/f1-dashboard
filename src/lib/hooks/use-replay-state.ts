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
  const currentTimeRef = useRef(currentTime);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const playStartedAtRef = useRef<number | null>(null);
  const playStartedReplayTimeRef = useRef<number>(minTime);

  // Keep refs in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
    speedRef.current = speed;
    isPlayingRef.current = isPlaying;
  });

  // Reset to start when minTime changes (new session loaded)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state when prop changes
    setCurrentTime(minTime);
    setIsPlaying(false);
    playStartedAtRef.current = null;
    playStartedReplayTimeRef.current = minTime;
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

    playStartedAtRef.current = performance.now();
    playStartedReplayTimeRef.current = currentTimeRef.current;

    function tick(now: number) {
      const startedAt = playStartedAtRef.current ?? now;
      const elapsed = now - startedAt;
      const newTime =
        playStartedReplayTimeRef.current + elapsed * speedRef.current;

      if (newTime >= maxTime) {
        setCurrentTime(maxTime);
        setIsPlaying(false);
        playStartedAtRef.current = null;
        playStartedReplayTimeRef.current = maxTime;
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
      currentTimeRef.current = minTime;
      playStartedReplayTimeRef.current = minTime;
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
      const clamped = Math.max(minTime, Math.min(maxTime, time));
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      playStartedReplayTimeRef.current = clamped;
      if (playStartedAtRef.current != null) {
        playStartedAtRef.current = performance.now();
      }
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
    if (playStartedAtRef.current != null) {
      const now = performance.now();
      const elapsed = now - playStartedAtRef.current;
      const anchoredTime =
        playStartedReplayTimeRef.current + elapsed * speedRef.current;
      const clamped = Math.max(minTime, Math.min(maxTime, anchoredTime));
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      playStartedReplayTimeRef.current = clamped;
      playStartedAtRef.current = now;
    }
    setSpeedState(s);
  }, [minTime, maxTime]);

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
