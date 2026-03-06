"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  Calendar,
  Trophy,
  Flag,
  ArrowRight,
  Timer,
  BarChart3,
} from "lucide-react";
import { format, parseISO, isPast, formatDistanceToNow } from "date-fns";
import { useMeetings } from "@/lib/hooks/use-meetings";
import { StatCard } from "@/components/cards/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamColor } from "@/lib/utils/colors";

interface DriverStanding {
  driverNumber: number;
  name: string;
  acronym: string;
  team: string;
  teamColour: string;
  points: number;
  wins: number;
}

export default function Home() {
  const { data: meetings, isLoading } = useMeetings(2025);
  const { data: standings } = useSWR<{ drivers: DriverStanding[] }>(
    "/api/standings?year=2025"
  );

  const completedRaces = meetings?.filter((m) =>
    isPast(parseISO(m.date_end))
  );
  const upcomingRaces = meetings?.filter(
    (m) => !isPast(parseISO(m.date_end))
  );
  const latestRace = completedRaces?.[completedRaces.length - 1];
  const nextRace = upcomingRaces?.[0];

  const top5Drivers = standings?.drivers?.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-r from-f1-red/20 to-f1-surface border border-f1-border p-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          F1 <span className="text-f1-red">Dashboard</span>
        </h1>
        <p className="mt-3 max-w-lg text-f1-text-secondary">
          Explore Formula 1 race data, lap times, pit strategies, telemetry,
          standings, and live timing — powered by OpenF1.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-md bg-f1-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-f1-red-hover"
          >
            <Timer size={16} />
            Session Timing
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-md border border-f1-border bg-f1-surface px-5 py-2.5 text-sm font-semibold text-f1-text transition-colors hover:bg-f1-card"
          >
            <Calendar size={16} />
            Calendar
          </Link>
          <Link
            href="/standings"
            className="inline-flex items-center gap-2 rounded-md border border-f1-border bg-f1-surface px-5 py-2.5 text-sm font-semibold text-f1-text transition-colors hover:bg-f1-card"
          >
            <Trophy size={16} />
            Standings
          </Link>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-md border border-f1-border bg-f1-surface px-5 py-2.5 text-sm font-semibold text-f1-text transition-colors hover:bg-f1-card"
          >
            <BarChart3 size={16} />
            Analytics
          </Link>
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
            sublabel="2025 Season"
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

      {/* Latest & Next Race + Mini Standings */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {latestRace && (
          <Link href={`/calendar/${latestRace.meeting_key}`}>
            <div className="h-full rounded-lg border border-f1-border bg-f1-surface p-6 transition-all hover:border-f1-red/50 hover:bg-f1-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-green-400">
                <Flag size={14} />
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
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-f1-red">
                View Results <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        )}

        {nextRace && (
          <Link href={`/calendar/${nextRace.meeting_key}`}>
            <div className="h-full rounded-lg border border-f1-border bg-f1-surface p-6 transition-all hover:border-f1-red/50 hover:bg-f1-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-blue-400">
                <Calendar size={14} />
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
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-f1-red">
                View Schedule <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        )}

        {/* Mini Standings */}
        {top5Drivers && top5Drivers.length > 0 && (
          <Link href="/standings">
            <div className="h-full rounded-lg border border-f1-border bg-f1-surface p-6 transition-all hover:border-f1-red/50 hover:bg-f1-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-400">
                <Trophy size={14} />
                Championship
              </div>
              <div className="mt-3 space-y-2">
                {top5Drivers.map((d, idx) => (
                  <div
                    key={d.driverNumber}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-5 text-right font-bold text-f1-text-muted">
                      {idx + 1}
                    </span>
                    <div
                      className="h-4 w-1 rounded-full"
                      style={{
                        backgroundColor: getTeamColor(d.teamColour),
                      }}
                    />
                    <span className="flex-1 font-semibold">{d.acronym}</span>
                    <span className="font-bold">{d.points}</span>
                    <span className="text-xs text-f1-text-muted">pts</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-f1-red">
                Full Standings <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
