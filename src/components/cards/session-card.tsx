"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Session } from "@/lib/openf1/types";
import { Badge } from "@/components/ui/badge";

export function SessionCard({ session }: { session: Session }) {
  const start = parseISO(session.date_start);
  const isRaceOrQuali =
    session.session_type === "Race" || session.session_type === "Qualifying" || session.session_type === "Sprint";

  return (
    <Link href={`/race/${session.session_key}`}>
      <div className="group flex items-center justify-between rounded-lg border border-f1-border bg-f1-surface p-4 transition-all hover:border-f1-red/50 hover:bg-f1-card">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-f1-card text-sm font-bold text-f1-text-secondary">
            {session.session_name.charAt(0)}
            {session.session_name.match(/\d/)?.[0] || ""}
          </div>
          <div>
            <h4 className="font-semibold group-hover:text-f1-red transition-colors">
              {session.session_name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-f1-text-muted">
              <Clock size={12} />
              <span>{format(start, "EEE, MMM d · HH:mm")}</span>
            </div>
          </div>
        </div>

        {isRaceOrQuali && (
          <Badge variant="red">{session.session_type}</Badge>
        )}
      </div>
    </Link>
  );
}
