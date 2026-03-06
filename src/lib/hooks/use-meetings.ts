import useSWR from "swr";
import type { Meeting } from "@/lib/openf1/types";

export function useMeetings(year: number) {
  return useSWR<Meeting[]>(`/api/f1/meetings?year=${year}`);
}
