// Drivers who started the race but have zero OpenF1 lap entries (crashed
// before any timing data was recorded). Without this, they'd be misclassified
// as DNS because stint-only data defaults to DNS. Keyed by session_key.
// Only add entries here when confirmed: driver started but OpenF1 has no laps.
export const KNOWN_EARLY_STARTERS: Record<number, Set<number>> = {
  // Example (uncomment if confirmed): 9999: new Set([16]), // session — driver crashed T1 lap 1
};

// Meetings cancelled or excluded from the season calendar
export const CANCELLED_MEETING_KEYS = new Set<number>([
  1257, // 2025 Bahrain Grand Prix — cancelled due to Middle East unrest
  1258, // 2025 Saudi Arabian Grand Prix — cancelled due to Middle East unrest
]);

// F1 Points system (2023+)
export const RACE_POINTS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

export const SPRINT_POINTS: Record<number, number> = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};
