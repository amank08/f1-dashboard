"use client";

import { use } from "react";
import { useSessions } from "@/lib/hooks/use-sessions";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { PageHeader } from "@/components/layout/page-header";
import { SessionCard } from "@/components/cards/session-card";
import { MeetingInfoGrid } from "@/components/meeting/meeting-info-grid";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ meetingKey: string }>;
}) {
  const { meetingKey } = use(params);
  const meetingKeyNum = Number(meetingKey);
  const { data: sessions, isLoading } = useSessions(meetingKeyNum);

  // Find meeting name from sessions data
  const year = sessions?.[0]?.year;
  const { data: meetings } = useMeetings(year ?? 2024);
  const meeting = meetings?.find((m) => m.meeting_key === meetingKeyNum);

  return (
    <div className="space-y-6">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-2 text-sm text-f1-text-secondary hover:text-f1-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Calendar
      </Link>

      <PageHeader
        title={meeting?.meeting_name ?? "Race Weekend"}
        subtitle={
          meeting
            ? `${meeting.location}, ${meeting.country_name} · ${meeting.circuit_short_name}`
            : undefined
        }
      />

      {meeting && sessions && (
        <MeetingInfoGrid meeting={meeting} sessions={sessions} />
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {sessions && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.session_key} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
