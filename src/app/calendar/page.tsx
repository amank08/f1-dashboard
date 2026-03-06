"use client";

import { useState } from "react";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { RaceCard } from "@/components/cards/race-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function CalendarPage() {
  const [year, setYear] = useState(2025);
  const { data: meetings, isLoading } = useMeetings(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Race Calendar"
        subtitle={`${year} Formula 1 Season`}
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {meetings && meetings.length === 0 && (
        <EmptyState
          title="No races found"
          description={`No race data available for the ${year} season.`}
        />
      )}

      {meetings && meetings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <RaceCard key={meeting.meeting_key} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}
