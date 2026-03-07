import useSWR from "swr";
import type { Weather } from "@/lib/openf1/types";

export function useWeather(sessionKey: number | null, live = false) {
  return useSWR<Weather[]>(
    sessionKey ? `/api/f1/weather?session_key=${sessionKey}` : null,
    { refreshInterval: live ? 30000 : 0 }
  );
}
