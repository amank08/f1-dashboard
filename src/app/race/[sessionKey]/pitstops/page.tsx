"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useLaps } from "@/lib/hooks/use-laps";
import { useStints } from "@/lib/hooks/use-stints";
import { usePitStops } from "@/lib/hooks/use-pit-stops";
import { usePositions } from "@/lib/hooks/use-positions";
import { PageHeader } from "@/components/layout/page-header";
import { PitStrategyChart } from "@/components/charts/pit-strategy-chart";
import { TireDegradationChart } from "@/components/charts/tire-degradation-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration } from "@/lib/utils/formatters";
import { getTeamColor } from "@/lib/utils/colors";
import { computeTireDegradation } from "@/lib/utils/tire-degradation";

export default function PitStopsPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: drivers } = useDrivers(sessionKeyNum);
  const { data: laps } = useLaps(sessionKeyNum);
  const { data: stints, isLoading: stintsLoading } = useStints(sessionKeyNum);
  const { data: pitStops, isLoading: pitsLoading } = usePitStops(sessionKeyNum);
  const { data: positions } = usePositions(sessionKeyNum);


  const session = sessions?.[0];
  const isLoading = stintsLoading || pitsLoading;
  const totalLaps = laps ? Math.max(...laps.map((l) => l.lap_number), 0) : 0;

  // Derive finishing order from positions (latest position per driver)
  const finishOrder = (() => {
    if (!positions) return undefined;
    const sorted = [...positions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const finalPos = new Map<number, number>();
    for (const p of sorted) finalPos.set(p.driver_number, p.position);
    return [...finalPos.entries()]
      .sort(([, a], [, b]) => a - b)
      .map(([dn]) => dn);
  })();

  const driverLookup = new Map(
    drivers?.map((d) => [d.driver_number, d]) ?? []
  );

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
        title="Pit Stop Strategy"
        subtitle={
          session
            ? `${session.session_name} · ${session.circuit_short_name}`
            : undefined
        }
      />

      {isLoading && <Skeleton className="h-96" />}

      {!isLoading && stints && drivers && totalLaps > 0 && (
        <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
          <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
            Tire Strategy
          </h3>
          <PitStrategyChart
            stints={stints}
            drivers={drivers}
            totalLaps={totalLaps}
            finishOrder={finishOrder}
          />
        </div>
      )}

      {!isLoading && pitStops && pitStops.length > 0 && (
        <div className="rounded-lg border border-f1-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-f1-border bg-f1-card text-f1-text-muted">
                <th className="px-4 py-3 text-left font-semibold">DRIVER</th>
                <th className="px-4 py-3 text-left font-semibold">LAP</th>
                <th className="px-4 py-3 text-right font-semibold">
                  STOP DURATION
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  PIT DURATION
                </th>
              </tr>
            </thead>
            <tbody>
              {pitStops
                .sort((a, b) => a.lap_number - b.lap_number)
                .map((stop, idx) => {
                  const driver = driverLookup.get(stop.driver_number);
                  return (
                    <tr
                      key={idx}
                      className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-1 rounded-full"
                            style={{
                              backgroundColor: driver
                                ? getTeamColor(driver.team_colour, driver.team_name)
                                : "#888",
                            }}
                          />
                          <span className="font-bold">
                            {driver?.name_acronym ?? stop.driver_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-f1-text-secondary">
                        Lap {stop.lap_number}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatDuration(stop.stop_duration)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-f1-text-secondary">
                        {formatDuration(stop.pit_duration)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tire Degradation Analysis */}
      {!isLoading && laps && stints && drivers && stints.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
            Tire Degradation Analysis
          </h3>
          {(() => {
            // Compute degradation for top 5 drivers
            const uniqueDrivers = drivers.filter(
              (d, i, arr) =>
                arr.findIndex((x) => x.driver_number === d.driver_number) === i
            );
            const allPoints = uniqueDrivers
              .slice(0, 5)
              .flatMap((d) =>
                computeTireDegradation(laps, stints, d.driver_number)
              );
            return allPoints.length > 0 ? (
              <TireDegradationChart data={allPoints} />
            ) : null;
          })()}
        </div>
      )}

      {!isLoading &&
        (!stints || stints.length === 0) &&
        (!pitStops || pitStops.length === 0) && (
          <EmptyState
            title="No pit stop data"
            description="Pit stop data is not available for this session."
          />
        )}
    </div>
  );
}
