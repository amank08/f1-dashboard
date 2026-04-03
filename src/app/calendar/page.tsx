"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO, isPast, isFuture, isWithinInterval } from "date-fns";
import { ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { useSeasonSessions } from "@/lib/hooks/use-standings";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { countryFlagUrl } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import type { Session } from "@/lib/openf1/types";

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: meetings, isLoading: meetingsLoading } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } = useSeasonSessions(year);

  const isLoading = meetingsLoading || sessionsLoading;
  const now = new Date();

  // Build map of meeting_key → race session for linking to results
  const raceSessionByMeeting = new Map<number, number>();
  // Build map of meeting_key → all sessions for session badges
  const sessionsByMeeting = new Map<number, Session[]>();
  for (const s of sessions ?? []) {
    if (s.session_name === "Race") {
      raceSessionByMeeting.set(s.meeting_key, s.session_key);
    }
    const list = sessionsByMeeting.get(s.meeting_key) ?? [];
    list.push(s);
    sessionsByMeeting.set(s.meeting_key, list);
  }

  const raceMeetings = meetings;
  const completedCount = raceMeetings?.filter((m) => isPast(parseISO(m.date_end))).length ?? 0;
  const totalCount = raceMeetings?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Race Calendar"
        subtitle={
          meetings
            ? `${completedCount} of ${totalCount} races completed`
            : `${year} Formula 1 Season`
        }
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {raceMeetings && (
        <div className="space-y-2">
          {raceMeetings.map((meeting, i) => {
            const start = parseISO(meeting.date_start);
            const end = parseISO(meeting.date_end);
            const isPastRace = isPast(end);
            const isOngoing = isWithinInterval(now, { start, end });
            const isUpcoming = isFuture(start);
            const raceSessionKey = raceSessionByMeeting.get(meeting.meeting_key);
            const meetingSessions = sessionsByMeeting.get(meeting.meeting_key) ?? [];
            const hasSprint = meetingSessions.some((s) => s.session_name === "Sprint");

            return (
              <div
                key={meeting.meeting_key}
                className={cn(
                  "rounded-lg border bg-f1-surface transition-all",
                  isOngoing
                    ? "border-f1-red/60 shadow-sm shadow-f1-red/10"
                    : isPastRace
                    ? "border-f1-border opacity-75"
                    : "border-f1-border"
                )}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Round */}
                  <div className="hidden w-8 shrink-0 text-center text-xs font-bold text-f1-text-muted sm:block">
                    R{i + 1}
                  </div>

                  {/* Flag */}
                  <img
                    src={countryFlagUrl(meeting.country_code)}
                    alt={meeting.country_name}
                    className="h-5 w-auto shrink-0 rounded-sm"
                  />

                  {/* Race info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{meeting.meeting_name}</span>
                      {isOngoing && (
                        <span className="rounded-full bg-f1-red/10 px-2 py-0.5 text-xs font-semibold uppercase text-f1-red">
                          Live
                        </span>
                      )}
                      {hasSprint && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-purple-400">
                          Sprint
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-f1-text-secondary">
                      {meeting.circuit_short_name} · {meeting.country_name}
                    </p>
                    <p className="mt-0.5 text-xs text-f1-text-muted">
                      {format(start, "MMM d")}
                      {" – "}
                      {format(end, "MMM d, yyyy")}
                    </p>
                  </div>

                  {/* Status icon + action */}
                  <div className="flex shrink-0 items-center gap-3">
                    {isPastRace ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : isOngoing ? (
                      <Clock size={16} className="text-f1-red" />
                    ) : (
                      <Circle size={16} className="text-f1-text-muted" />
                    )}

                    {isPastRace && raceSessionKey ? (
                      <Link
                        href={`/live?session=${raceSessionKey}`}
                        className="flex items-center gap-1 text-sm font-semibold text-f1-red transition-colors hover:text-f1-red/80"
                      >
                        Results <ArrowRight size={13} />
                      </Link>
                    ) : isUpcoming ? (
                      <span className="text-sm text-f1-text-muted">
                        {format(start, "MMM d")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
