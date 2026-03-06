import { useState, useEffect, useMemo } from "react";
import type { LocationSample } from "@/lib/openf1/types";

async function fetchWithRetry(
  url: string,
  retries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < retries) {
      // Exponential backoff: 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

/**
 * Fetches location data for all drivers in a session.
 * All drivers are fetched in parallel — the server-side proxy handles
 * rate limiting and caching (7-day TTL), so cached requests return
 * instantly without hitting OpenF1.
 */
export function useLocationData(
  sessionKey: number | null,
  driverNumbers: number[]
) {
  const [data, setData] = useState<LocationSample[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  const driversKey = useMemo(
    () => [...driverNumbers].sort((a, b) => a - b).join(","),
    [driverNumbers]
  );

  useEffect(() => {
    if (!sessionKey || !driversKey) {
      setData(undefined);
      setIsLoading(false);
      setProgress({ loaded: 0, total: 0 });
      return;
    }

    const nums = driversKey.split(",").map(Number);
    let cancelled = false;

    setData(undefined);
    setIsLoading(true);
    setError(undefined);
    setProgress({ loaded: 0, total: nums.length });

    async function fetchAll() {
      try {
        let completedCount = 0;

        const results = await Promise.all(
          nums.map(async (driverNum) => {
            try {
              const res = await fetchWithRetry(
                `/api/f1/location?session_key=${sessionKey}&driver_number=${driverNum}`
              );
              if (!res.ok) {
                if (res.status === 422) return [];
                return [];
              }
              return (await res.json()) as LocationSample[];
            } catch {
              return [];
            } finally {
              completedCount++;
              if (!cancelled)
                setProgress({ loaded: completedCount, total: nums.length });
            }
          })
        );

        if (!cancelled) {
          setData(results.flat());
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [sessionKey, driversKey]);

  return { data, isLoading, error, progress };
}
