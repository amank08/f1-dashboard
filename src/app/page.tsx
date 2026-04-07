"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { StatCard } from "@/components/cards/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isPast, formatDistanceToNow } from "date-fns";
import { Flag, Calendar, ArrowRight } from "lucide-react";

export default function Home() {
  const { data: meetings, isLoading } = useMeetings(new Date().getFullYear());

  const completedRaces = meetings?.filter((m) =>
    isPast(parseISO(m.date_end))
  );
  const upcomingRaces = meetings?.filter(
    (m) => !isPast(parseISO(m.date_end))
  );
  const latestRace = completedRaces?.[completedRaces.length - 1];
  const nextRace = upcomingRaces?.[0];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl border border-f1-border p-10 sm:p-12"
        style={{
          background: "linear-gradient(135deg, #050510, #0a1a3a, #1a3a6a)",
          backgroundSize: "200% 200%",
          animation: "gradient-shift 8s ease infinite",
        }}
      >
        {/* Dot grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-widest text-f1-accent">
            Formula 1 Dashboard
          </p>
          <div className="mt-4">
            <img src="/logo.svg" alt="Undercut" className="h-16 sm:h-20 lg:h-24" />
          </div>
          <p className="mt-4 max-w-lg text-lg text-f1-text-secondary">
            Explore race data, lap times, pit strategies, telemetry,
            and live timing — powered by OpenF1.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-lg bg-f1-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-f1-accent/20 transition-all hover:bg-f1-accent-hover hover:shadow-f1-accent/30"
            >
              <Timer size={16} />
              Session Timing
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-f1-text backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
            >
              <Calendar size={16} />
              Race Calendar
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {meetings && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Races"
            value={String(meetings.length)}
            sublabel={`${new Date().getFullYear()} Season`}
          />
          <StatCard
            label="Completed"
            value={String(completedRaces?.length ?? 0)}
            sublabel={`of ${meetings.length} races`}
          />
          <StatCard
            label="Remaining"
            value={String(upcomingRaces?.length ?? 0)}
            sublabel={
              nextRace
                ? `Next: ${formatDistanceToNow(parseISO(nextRace.date_start), { addSuffix: true })}`
                : undefined
            }
          />
        </div>
      )}

      {/* Latest & Next Race */}
      <div className="grid gap-4 sm:grid-cols-2">
        {latestRace && (
          <Link href="/live">
            <div className="group h-full rounded-xl border border-f1-border bg-f1-surface p-6 transition-all hover:border-f1-accent/40 hover:bg-f1-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Flag size={13} />
                Latest Race
              </div>
              <h3 className="mt-3 text-xl font-bold">
                {latestRace.meeting_name}
              </h3>
              <p className="mt-1 text-sm text-f1-text-secondary">
                {latestRace.location}, {latestRace.country_name}
              </p>
              <p className="mt-2 text-xs text-f1-text-muted">
                {format(parseISO(latestRace.date_start), "MMM d")} –{" "}
                {format(parseISO(latestRace.date_end), "MMM d, yyyy")}
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-f1-accent transition-colors group-hover:text-f1-accent-hover">
                View Results <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        )}

        {nextRace && (
          <div className="h-full rounded-xl border border-f1-border bg-f1-surface p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-f1-accent">
              <Calendar size={13} />
              Next Race
            </div>
            <h3 className="mt-3 text-xl font-bold">
              {nextRace.meeting_name}
            </h3>
            <p className="mt-1 text-sm text-f1-text-secondary">
              {nextRace.location}, {nextRace.country_name}
            </p>
            <p className="mt-2 text-xs text-f1-text-muted">
              {format(parseISO(nextRace.date_start), "MMM d")} –{" "}
              {format(parseISO(nextRace.date_end), "MMM d, yyyy")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
