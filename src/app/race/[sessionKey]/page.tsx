"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Timer, Flag, Fuel, Radio } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useLaps } from "@/lib/hooks/use-laps";
import { usePositions } from "@/lib/hooks/use-positions";
import { useTeamRadio } from "@/lib/hooks/use-team-radio";
import { PageHeader } from "@/components/layout/page-header";
import { ResultsTable, buildResults } from "@/components/tables/results-table";
import { GridVsFinishChart } from "@/components/charts/grid-vs-finish-chart";
import { StatCard } from "@/components/cards/stat-card";
import { TeamRadioCard } from "@/components/cards/team-radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLapTime } from "@/lib/utils/formatters";
import { getPositionChanges } from "@/lib/utils/analytics";

export default function RaceResultsPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: drivers, isLoading: driversLoading } =
    useDrivers(sessionKeyNum);
  const { data: laps, isLoading: lapsLoading } = useLaps(sessionKeyNum);
  const { data: positions, isLoading: posLoading } =
    usePositions(sessionKeyNum);
  const { data: radios, isLoading: radiosLoading } =
    useTeamRadio(sessionKeyNum);

  const session = sessions?.[0];
  const isLoading = driversLoading || lapsLoading || posLoading;

  const results =
    positions && drivers && laps
      ? buildResults(positions, drivers, laps)
      : [];

  // Calculate stats
  const allLapTimes = laps
    ?.filter((l) => l.lap_duration && !l.is_pit_out_lap)
    .map((l) => l.lap_duration!) ?? [];
  const fastestLap = allLapTimes.length > 0 ? Math.min(...allLapTimes) : null;
  const fastestLapDriver = laps?.find(
    (l) => l.lap_duration === fastestLap
  );
  const fastestDriverName = drivers?.find(
    (d) => d.driver_number === fastestLapDriver?.driver_number
  );
  const totalLaps = laps
    ? Math.max(...laps.map((l) => l.lap_number), 0)
    : 0;

  return (
    <div className="space-y-6">
      <Link
        href={session ? `/calendar/${session.meeting_key}` : "/calendar"}
        className="inline-flex items-center gap-2 text-sm text-f1-text-secondary hover:text-f1-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Race Weekend
      </Link>

      <PageHeader
        title={session?.session_name ?? "Session Results"}
        subtitle={
          session
            ? `${session.circuit_short_name} · ${session.country_name}`
            : undefined
        }
      />

      {/* Sub-navigation */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { href: `/race/${sessionKey}`, label: "Results", icon: Flag },
          { href: `/race/${sessionKey}/laps`, label: "Laps", icon: Timer },
          { href: `/race/${sessionKey}/pitstops`, label: "Pit Stops", icon: Fuel },
          { href: `/race/${sessionKey}/radio`, label: "Radio", icon: Radio },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md border border-f1-border bg-f1-surface px-4 py-2 text-sm font-semibold text-f1-text-secondary hover:bg-f1-card hover:text-f1-text transition-colors whitespace-nowrap"
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Laps"
          value={totalLaps > 0 ? String(totalLaps) : "—"}
        />
        <StatCard
          label="Fastest Lap"
          value={formatLapTime(fastestLap)}
          sublabel={fastestDriverName?.name_acronym}
        />
        <StatCard
          label="Drivers"
          value={drivers ? String(results.length) : "—"}
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <>
          <ResultsTable results={results} />

          {/* Grid vs Finish chart */}
          {(() => {
            // Build grid positions from first lap positions, finish from last
            const driverLookup = new Map(
              drivers?.map((d) => [d.driver_number, d]) ?? []
            );
            const gridMap = new Map<number, number>();
            const finishMap = new Map<number, number>();
            if (positions) {
              // Earliest position entries = grid, latest = finish
              const sorted = [...positions].sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              for (const p of sorted) {
                if (!gridMap.has(p.driver_number)) {
                  gridMap.set(p.driver_number, p.position);
                }
                finishMap.set(p.driver_number, p.position);
              }
            }
            const changes = getPositionChanges(gridMap, finishMap);
            const chartData = changes.map((c) => ({
              name: driverLookup.get(c.driverNumber)?.name_acronym ?? String(c.driverNumber),
              gridPos: c.gridPos,
              finishPos: c.finishPos,
              teamColour: driverLookup.get(c.driverNumber)?.team_colour ?? "888888",
              change: c.change,
            }));
            return chartData.length > 0 ? <GridVsFinishChart data={chartData} /> : null;
          })()}
        </>
      )}

      {/* Team Radio */}
      <TeamRadioCard
        radios={radios}
        drivers={drivers}
        isLoading={radiosLoading}
      />
    </div>
  );
}
