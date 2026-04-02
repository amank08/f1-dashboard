import useSWR from "swr";
import type { Meeting } from "@/lib/openf1/types";
import { CANCELLED_MEETING_KEYS } from "@/lib/utils/constants";

function filterMeetings(meetings: Meeting[] | undefined): Meeting[] | undefined {
  return meetings?.filter(
    (m) =>
      !m.meeting_name.toLowerCase().includes("testing") &&
      !CANCELLED_MEETING_KEYS.has(m.meeting_key)
  );
}

export function useMeetings(year: number) {
  const swr = useSWR<Meeting[]>(`/api/f1/meetings?year=${year}`);
  return { ...swr, data: filterMeetings(swr.data) };
}
