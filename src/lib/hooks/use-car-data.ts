import useSWR from "swr";
import type { CarData } from "@/lib/openf1/types";

export function useCarData(
  sessionKey: number | null,
  driverNumber: number | null
) {
  const params = new URLSearchParams();
  if (sessionKey) params.set("session_key", String(sessionKey));
  if (driverNumber) params.set("driver_number", String(driverNumber));

  return useSWR<CarData[]>(
    sessionKey && driverNumber
      ? `/api/f1/car_data?${params.toString()}`
      : null
  );
}
