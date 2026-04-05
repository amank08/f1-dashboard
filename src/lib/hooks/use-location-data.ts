import { useState, useEffect } from "react";
import type { LocationSample } from "@/lib/openf1/types";

/**
 * Fetches decoded Position.z samples for a session from our server-side
 * archive decoder (which reads F1's static live-timing archive). OpenF1's
 * /location endpoint returns all-zeros on the free tier, so we bypass it
 * entirely for replay.
 *
 * Unlike the previous implementation this makes a single request — the
 * archive contains all drivers in one file, decoded server-side.
 */
export function useLocationData(sessionKey: number | null) {
  const [data, setData] = useState<LocationSample[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!sessionKey) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setData(undefined);
    setIsLoading(true);
    setError(undefined);

    (async () => {
      try {
        const res = await fetch(
          `/api/f1-replay-positions?session_key=${sessionKey}`
        );
        if (!res.ok) {
          let msg = `Archive fetch failed: ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {}
          throw new Error(msg);
        }
        const samples = (await res.json()) as LocationSample[];
        if (!cancelled) {
          setData(samples);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  return { data, isLoading, error };
}
