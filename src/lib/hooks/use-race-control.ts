import useSWR from "swr";
import type { RaceControlMessage } from "@/lib/openf1/types";

export function useRaceControl(sessionKey: number | null, live = false) {
  return useSWR<RaceControlMessage[]>(
    sessionKey ? `/api/f1/race_control?session_key=${sessionKey}` : null,
    { refreshInterval: live ? 5000 : 0 }
  );
}
