"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useLaps } from "@/lib/hooks/use-laps";
import { usePositions } from "@/lib/hooks/use-positions";
import { PageHeader } from "@/components/layout/page-header";
import { DriverSelector } from "@/components/selectors/driver-selector";
import { LapTimeChart } from "@/components/charts/lap-time-chart";
import { PositionChart } from "@/components/charts/position-chart";
import { GapChart } from "@/components/charts/gap-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function LapsPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: drivers, isLoading: driversLoading } = useDrivers(sessionKeyNum);
  const { data: laps, isLoading: lapsLoading } = useLaps(sessionKeyNum);
  const { data: positions } = usePositions(sessionKeyNum);

  const session = sessions?.[0];
  const isLoading = driversLoading || lapsLoading;

  // Auto-select top 3 drivers if none selected
  if (
    selectedDrivers.length === 0 &&
    drivers &&
    drivers.length > 0 &&
    !isLoading
  ) {
    const unique = drivers.filter(
      (d, i, arr) =>
        arr.findIndex((x) => x.driver_number === d.driver_number) === i
    );
    setSelectedDrivers(unique.slice(0, 3).map((d) => d.driver_number));
  }

  const totalLaps = laps ? Math.max(...laps.map((l) => l.lap_number), 0) : 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/race/${sessionKey}`}
        className="inline-flex items-center gap-2 text-sm text-f1-text-secondary hover:text-f1-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Results
      </Link>

      <PageHeader
        title="Lap Analysis"
        subtitle={
          session
            ? `${session.session_name} · ${session.circuit_short_name}`
            : undefined
        }
      />

      {drivers && (
        <div>
          <p className="mb-2 text-sm font-semibold text-f1-text-secondary">
            Select Drivers (max 4)
          </p>
          <DriverSelector
            drivers={drivers}
            selected={selectedDrivers}
            onChange={setSelectedDrivers}
          />
        </div>
      )}

      {isLoading && <Skeleton className="h-96" />}

      {!isLoading && laps && drivers && selectedDrivers.length > 0 && (
        <div className="space-y-8">
          <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
            <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
              Lap Times
            </h3>
            <LapTimeChart
              laps={laps}
              drivers={drivers}
              selectedDriverNumbers={selectedDrivers}
            />
          </div>

          {positions && totalLaps > 0 && (
            <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
              <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
                Position Changes
              </h3>
              <PositionChart
                positions={positions}
                drivers={drivers}
                selectedDriverNumbers={selectedDrivers}
                totalLaps={totalLaps}
              />
            </div>
          )}

          {/* Gap to leader chart */}
          {laps && drivers && selectedDrivers.length > 0 && (() => {
            // Compute cumulative gap from lap times
            const driverLookup = new Map(
              drivers
                .filter((d, i, arr) => arr.findIndex((x) => x.driver_number === d.driver_number) === i)
                .map((d) => [d.driver_number, d])
            );
            const driverColors: Record<string, string> = {};
            for (const [num, d] of driverLookup) {
              driverColors[d.name_acronym] = d.team_colour;
            }

            // Build cumulative time per driver per lap
            const cumTimes = new Map<number, Map<number, number>>();
            for (const driverNum of selectedDrivers) {
              const driverLaps = laps
                .filter((l) => l.driver_number === driverNum && l.lap_duration !== null && l.lap_duration > 0)
                .sort((a, b) => a.lap_number - b.lap_number);
              let cumTime = 0;
              const lapCum = new Map<number, number>();
              for (const l of driverLaps) {
                cumTime += l.lap_duration!;
                lapCum.set(l.lap_number, cumTime);
              }
              cumTimes.set(driverNum, lapCum);
            }

            // Find leader time per lap (minimum cumulative)
            const allLapNums = new Set<number>();
            for (const [, lapCum] of cumTimes) {
              for (const lap of lapCum.keys()) allLapNums.add(lap);
            }
            const sortedLaps = [...allLapNums].sort((a, b) => a - b);

            const gapData: Array<Record<string, number | string>> = [];
            for (const lap of sortedLaps) {
              let leaderTime = Infinity;
              for (const [, lapCum] of cumTimes) {
                const t = lapCum.get(lap);
                if (t !== undefined && t < leaderTime) leaderTime = t;
              }
              const entry: Record<string, number | string> = { lap };
              for (const driverNum of selectedDrivers) {
                const d = driverLookup.get(driverNum);
                if (!d) continue;
                const t = cumTimes.get(driverNum)?.get(lap);
                if (t !== undefined) {
                  entry[d.name_acronym] = +(t - leaderTime).toFixed(3);
                }
              }
              gapData.push(entry);
            }

            const driverKeys = selectedDrivers
              .map((num) => driverLookup.get(num)?.name_acronym)
              .filter(Boolean) as string[];

            return gapData.length > 0 ? (
              <GapChart data={gapData} driverKeys={driverKeys} driverColors={driverColors} />
            ) : null;
          })()}
        </div>
      )}

      {!isLoading && selectedDrivers.length === 0 && (
        <EmptyState
          title="Select drivers to compare"
          description="Choose up to 4 drivers to see their lap time comparison."
        />
      )}
    </div>
  );
}
