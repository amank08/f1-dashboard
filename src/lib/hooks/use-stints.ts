import useSWR from "swr";
import type { Stint } from "@/lib/openf1/types";

export function useStints(sessionKey: number | null) {
  return useSWR<Stint[]>(
    sessionKey ? `/api/f1/stints?session_key=${sessionKey}` : null
  );
}
