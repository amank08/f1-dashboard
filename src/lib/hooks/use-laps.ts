import useSWR from "swr";
import type { LapData } from "@/lib/openf1/types";

export function useLaps(
  sessionKey: number | null,
  driverNumber?: number
) {
  const params = new URLSearchParams();
  if (sessionKey) params.set("session_key", String(sessionKey));
  if (driverNumber) params.set("driver_number", String(driverNumber));

  return useSWR<LapData[]>(
    sessionKey ? `/api/f1/laps?${params.toString()}` : null
  );
}
