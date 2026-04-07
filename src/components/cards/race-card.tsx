"use client";

import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { format, isPast, isFuture, parseISO } from "date-fns";
import type { Meeting } from "@/lib/openf1/types";
import { Badge } from "@/components/ui/badge";

function getStatus(meeting: Meeting) {
  const end = parseISO(meeting.date_end);
  const start = parseISO(meeting.date_start);

  if (isPast(end)) return { label: "Completed", variant: "green" as const };
  if (isFuture(start)) return { label: "Upcoming", variant: "blue" as const };
  return { label: "Live", variant: "red" as const };
}

export function RaceCard({ meeting }: { meeting: Meeting }) {
  const status = getStatus(meeting);
  const startDate = parseISO(meeting.date_start);
  const endDate = parseISO(meeting.date_end);

  return (
    <Link href={`/calendar/${meeting.meeting_key}`}>
      <div className="group rounded-xl border border-f1-border bg-f1-surface p-5 transition-all hover:border-f1-accent/40 hover:bg-f1-card">
        <div className="flex items-start justify-between">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-f1-text-muted">
            R{meeting.meeting_key}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-tight group-hover:text-f1-accent transition-colors">
          {meeting.meeting_name}
        </h3>

        <div className="mt-3 flex flex-col gap-1.5 text-sm text-f1-text-secondary">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-f1-text-muted" />
            <span>
              {meeting.location}, {meeting.country_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-f1-text-muted" />
            <span>
              {format(startDate, "MMM d")} – {format(endDate, "MMM d, yyyy")}
            </span>
          </div>
        </div>

        <div className="mt-3 text-xs font-semibold text-f1-text-muted">
          {meeting.circuit_short_name}
        </div>
      </div>
    </Link>
  );
}
