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
 * The OpenF1 location endpoint requires a driver_number filter,
 * so we fetch in small batches of 3 with delays between batches
 * to avoid hitting OpenF1's rate limits.
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
        const batchSize = 3;
        const allSamples: LocationSample[] = [];
        let loaded = 0;

        for (let i = 0; i < nums.length; i += batchSize) {
          if (cancelled) return;

          // Small delay between batches (not before the first)
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          if (cancelled) return;

          const batch = nums.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (driverNum) => {
              const res = await fetchWithRetry(
                `/api/f1/location?session_key=${sessionKey}&driver_number=${driverNum}`
              );
              if (!res.ok) {
                if (res.status === 422) return [];
                throw new Error(`API error: ${res.status}`);
              }
              return res.json() as Promise<LocationSample[]>;
            })
          );

          for (const samples of results) {
            allSamples.push(...samples);
          }
          loaded += batch.length;
          if (!cancelled) setProgress({ loaded, total: nums.length });
        }

        if (!cancelled) {
          setData(allSamples);
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
