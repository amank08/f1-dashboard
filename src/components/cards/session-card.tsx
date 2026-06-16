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
    <Link href={`/race/${session.session_key}`} className="premium-focus block rounded-2xl">
      <div className="linear-surface group flex items-center justify-between rounded-2xl p-4 transition duration-300 ease-premium hover:-translate-y-0.5">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-sm font-bold text-f1-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {session.session_name.charAt(0)}
            {session.session_name.match(/\d/)?.[0] || ""}
          </div>
          <div>
            <h4 className="font-semibold text-f1-text transition-colors duration-300 ease-premium group-hover:text-f1-accent">
              {session.session_name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-f1-text-muted">
              <Clock size={12} />
              <span>{format(start, "EEE, MMM d · HH:mm")}</span>
            </div>
          </div>
        </div>

        {isRaceOrQuali && (
          <Badge variant="red" className="relative z-10">{session.session_type}</Badge>
        )}
      </div>
    </Link>
  );
}
