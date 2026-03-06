import useSWR from "swr";
import type { PitStop } from "@/lib/openf1/types";

export function usePitStops(sessionKey: number | null) {
  return useSWR<PitStop[]>(
    sessionKey ? `/api/f1/pit?session_key=${sessionKey}` : null
  );
}
