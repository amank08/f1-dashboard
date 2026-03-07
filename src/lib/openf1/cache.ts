interface CacheEntry {
  data: unknown;
  createdAt: number;
  ttl: number;
}

class OpenF1Cache {
  private store = new Map<string, CacheEntry>();
  private maxSize = 500;

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.createdAt;
    return {
      data: entry.data as T,
      isStale: age > entry.ttl,
    };
  }

  set(key: string, data: unknown, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { data, createdAt: Date.now(), ttl: ttlMs });
  }
}

const HOUR = 3600_000;
const DAY = 86400_000;

const MIN = 60_000;

const CACHE_TTLS: Record<string, number> = {
  meetings: DAY,
  sessions: HOUR,
  drivers: HOUR,
  laps: 30 * MIN,
  car_data: 5 * MIN,
  pit: 15 * MIN,
  stints: 15 * MIN,
  weather: 10 * MIN,
  position: 30 * MIN,
  race_control: 15 * MIN,
  team_radio: 15 * MIN,
  intervals: 10 * MIN,
  location: 7 * DAY,
};

export function getCacheTTL(endpoint: string): number {
  return CACHE_TTLS[endpoint] ?? HOUR;
}

export const cache = new OpenF1Cache();
