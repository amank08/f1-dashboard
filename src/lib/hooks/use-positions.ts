import useSWR from "swr";
import type { Position } from "@/lib/openf1/types";

export function usePositions(sessionKey: number | null) {
  return useSWR<Position[]>(
    sessionKey ? `/api/f1/position?session_key=${sessionKey}` : null
  );
}
