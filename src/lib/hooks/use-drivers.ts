import useSWR from "swr";
import type { Driver } from "@/lib/openf1/types";

export function useDrivers(sessionKey: number | null) {
  return useSWR<Driver[]>(
    sessionKey ? `/api/f1/drivers?session_key=${sessionKey}` : null
  );
}
