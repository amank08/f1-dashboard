import useSWR from "swr";
import type { Session } from "@/lib/openf1/types";

export function useSessions(meetingKey: number | null) {
  return useSWR<Session[]>(
    meetingKey ? `/api/f1/sessions?meeting_key=${meetingKey}` : null
  );
}

export function useSession(sessionKey: number | null) {
  return useSWR<Session[]>(
    sessionKey ? `/api/f1/sessions?session_key=${sessionKey}` : null
  );
}
