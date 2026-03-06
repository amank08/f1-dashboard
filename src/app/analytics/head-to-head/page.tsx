"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { ComparisonSelector } from "@/components/selectors/comparison-selector";
import { HeadToHeadChart } from "@/components/charts/head-to-head-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/cards/stat-card";
import { computeHeadToHead, type HeadToHeadResult } from "@/lib/utils/analytics";
import type { Session, Position, Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";

export default function HeadToHeadPage() {
  const [year, setYear] = useState(2025);
  const [driver1, setDriver1] = useState<number | null>(null);
  const [driver2, setDriver2] = useState<number | null>(null);

  const { data: sessions } = useSWR<Session[]>(
    `/api/f1/sessions?year=${year}&session_type=Race`
  );

  // Get all drivers from first race session to populate selector
  const firstRaceKey = sessions?.[0]?.session_key;
  const { data: allDrivers, isLoading: driversLoading } = useSWR<Driver[]>(
    firstRaceKey ? `/api/f1/drivers?session_key=${firstRaceKey}` : null
  );

  // For each race session, fetch positions
  const { data: allPositions } = useSWR<Record<number, Position[]>>(
    sessions && driver1 && driver2
      ? `h2h:positions:${year}:${driver1}:${driver2}`
      : null,
    async () => {
      if (!sessions) return {};
      const result: Record<number, Position[]> = {};
      for (const s of sessions) {
        try {
          const res = await fetch(
            `/api/f1/position?session_key=${s.session_key}`
          );
          if (res.ok) {
            result[s.session_key] = await res.json();
          }
        } catch {
          // skip failed fetches
        }
      }
      return result;
    },
    { revalidateOnFocus: false }
  );

  const driverLookup = useMemo(() => {
    const map = new Map<number, Driver>();
    if (allDrivers) {
      for (const d of allDrivers) map.set(d.driver_number, d);
    }
    return map;
  }, [allDrivers]);

  const driver1Info = driver1 ? driverLookup.get(driver1) : null;
  const driver2Info = driver2 ? driverLookup.get(driver2) : null;

  // Build head-to-head results
  const h2hResults = useMemo<HeadToHeadResult[]>(() => {
    if (!sessions || !allPositions || !driver1 || !driver2) return [];

    return sessions.map((s) => {
      const positions = allPositions[s.session_key] ?? [];
      // Get final position per driver
      const finalPos = new Map<number, number>();
      for (const p of positions) {
        finalPos.set(p.driver_number, p.position);
      }
      return {
        raceName: s.circuit_short_name || s.location || "Race",
        meetingKey: s.meeting_key,
        driver1Pos: finalPos.get(driver1) ?? null,
        driver2Pos: finalPos.get(driver2) ?? null,
      };
    });
  }, [sessions, allPositions, driver1, driver2]);

  const h2hStats = computeHeadToHead(h2hResults);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Head-to-Head"
        subtitle="Compare two drivers across the season"
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {driversLoading && <Skeleton className="h-16" />}

      {allDrivers && (
        <ComparisonSelector
          drivers={allDrivers}
          driver1={driver1}
          driver2={driver2}
          onDriver1Change={setDriver1}
          onDriver2Change={setDriver2}
        />
      )}

      {driver1 && driver2 && driver1Info && driver2Info && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={driver1Info.name_acronym}
              value={String(h2hStats.driver1Wins)}
              sublabel="Race wins (H2H)"
            />
            <StatCard
              label="Tied"
              value={String(h2hStats.ties)}
            />
            <StatCard
              label={driver2Info.name_acronym}
              value={String(h2hStats.driver2Wins)}
              sublabel="Race wins (H2H)"
            />
          </div>

          {h2hResults.length > 0 ? (
            <HeadToHeadChart
              results={h2hResults}
              driver1Name={driver1Info.name_acronym}
              driver2Name={driver2Info.name_acronym}
              driver1Color={driver1Info.team_colour}
              driver2Color={driver2Info.team_colour}
            />
          ) : (
            <Skeleton className="h-96" />
          )}

          {/* Summary stats */}
          {h2hResults.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-5 w-1 rounded-full"
                    style={{ backgroundColor: getTeamColor(driver1Info.team_colour) }}
                  />
                  <span className="font-bold">{driver1Info.full_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-f1-text-muted">Avg Race Pos</p>
                    <p className="font-bold">
                      {(() => {
                        const positions = h2hResults
                          .filter((r) => r.driver1Pos !== null)
                          .map((r) => r.driver1Pos!);
                        return positions.length > 0
                          ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
                          : "—";
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">Podiums</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver1Pos !== null && r.driver1Pos <= 3).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">Wins</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver1Pos === 1).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">DNFs</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver1Pos === null).length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-5 w-1 rounded-full"
                    style={{ backgroundColor: getTeamColor(driver2Info.team_colour) }}
                  />
                  <span className="font-bold">{driver2Info.full_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-f1-text-muted">Avg Race Pos</p>
                    <p className="font-bold">
                      {(() => {
                        const positions = h2hResults
                          .filter((r) => r.driver2Pos !== null)
                          .map((r) => r.driver2Pos!);
                        return positions.length > 0
                          ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
                          : "—";
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">Podiums</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver2Pos !== null && r.driver2Pos <= 3).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">Wins</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver2Pos === 1).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-f1-text-muted">DNFs</p>
                    <p className="font-bold">
                      {h2hResults.filter((r) => r.driver2Pos === null).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(!driver1 || !driver2) && allDrivers && (
        <EmptyState
          title="Select two drivers"
          description="Choose two drivers above to see their head-to-head comparison."
        />
      )}
    </div>
  );
}
