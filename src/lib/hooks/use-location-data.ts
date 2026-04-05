import { useState, useEffect } from "react";
import type { ReplaySnapshot } from "@/lib/openf1/types";

/**
 * Fetches a pre-processed `ReplaySnapshot` from our server-side archive
 * decoder. The server reads F1's static live-timing archive, normalizes
 * coordinates, downsamples to ~2 Hz, and returns compact parallel arrays
 * per driver — ~2 MB instead of the ~80 MB raw payload OpenF1 / F1 would
 * otherwise require decoding client-side.
 */
export function useLocationData(sessionKey: number | null) {
  const [data, setData] = useState<ReplaySnapshot | undefined>(undefined);
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
        const snapshot = (await res.json()) as ReplaySnapshot;
        if (!cancelled) {
          setData(snapshot);
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
