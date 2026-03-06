import useSWR from "swr";
import { isPast, isFuture, parseISO } from "date-fns";
import type { Session } from "@/lib/openf1/types";

export type SessionStatus = "live" | "upcoming" | "completed" | "unknown";

export function useSessionStatus(sessionKey: number | null) {
  const { data } = useSWR<Session[]>(
    sessionKey ? `/api/f1/sessions?session_key=${sessionKey}` : null
  );
  const session = data?.[0];

  if (!session) return { status: "unknown" as SessionStatus, session: null, isLive: false };

  const start = parseISO(session.date_start);
  const end = parseISO(session.date_end);

  let status: SessionStatus = "unknown";
  if (isPast(end)) status = "completed";
  else if (isFuture(start)) status = "upcoming";
  else if (isPast(start) && isFuture(end)) status = "live";

  return { status, session, isLive: status === "live" };
}
