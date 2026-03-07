import useSWR from "swr";
import type { Stint } from "@/lib/openf1/types";

export function useStints(sessionKey: number | null, live = false) {
  return useSWR<Stint[]>(
    sessionKey ? `/api/f1/stints?session_key=${sessionKey}` : null,
    { refreshInterval: live ? 15000 : 0 }
  );
}
