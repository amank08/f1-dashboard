import useSWR from "swr";
import type { Interval } from "@/lib/openf1/types";

export function useIntervals(sessionKey: number | null, live = false) {
  return useSWR<Interval[]>(
    sessionKey ? `/api/f1/intervals?session_key=${sessionKey}` : null,
    { refreshInterval: live ? 5000 : 0 }
  );
}
