"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/cards/stat-card";
import { formatLapTime } from "@/lib/utils/formatters";
import { getTeamColor } from "@/lib/utils/colors";
import type { Meeting, Session, LapData, Driver, Position } from "@/lib/openf1/types";

export default function CircuitsPage() {
  const [year, setYear] = useState(2025);
  const [selectedCircuit, setSelectedCircuit] = useState<number | null>(null);

  const { data: meetings, isLoading: meetingsLoading } = useSWR<Meeting[]>(
    `/api/f1/meetings?year=${year}`
  );

  const selectedMeeting = meetings?.find((m) => m.meeting_key === selectedCircuit);

  const { data: sessions } = useSWR<Session[]>(
    selectedCircuit ? `/api/f1/sessions?meeting_key=${selectedCircuit}` : null
  );

  const raceSession = sessions?.find((s) => s.session_type === "Race");
  const qualiSession = sessions?.find((s) => s.session_type === "Qualifying");

  const { data: raceLaps } = useSWR<LapData[]>(
    raceSession ? `/api/f1/laps?session_key=${raceSession.session_key}` : null
  );
  const { data: raceDrivers } = useSWR<Driver[]>(
    raceSession ? `/api/f1/drivers?session_key=${raceSession.session_key}` : null
  );
  const { data: racePositions } = useSWR<Position[]>(
    raceSession ? `/api/f1/position?session_key=${raceSession.session_key}` : null
  );

  const driverLookup = useMemo(() => {
    const map = new Map<number, Driver>();
    if (raceDrivers) {
      for (const d of raceDrivers) map.set(d.driver_number, d);
    }
    return map;
  }, [raceDrivers]);

  // Compute circuit stats
  const fastestLap = useMemo(() => {
    if (!raceLaps) return null;
    const valid = raceLaps.filter(
      (l) => l.lap_duration !== null && !l.is_pit_out_lap && l.lap_duration > 0
    );
    if (valid.length === 0) return null;
    return valid.reduce((best, l) =>
      l.lap_duration! < best.lap_duration! ? l : best
    );
  }, [raceLaps]);

  const raceWinner = useMemo(() => {
    if (!racePositions) return null;
    // Get final positions
    const finalPos = new Map<number, number>();
    for (const p of racePositions) {
      finalPos.set(p.driver_number, p.position);
    }
    for (const [driverNum, pos] of finalPos) {
      if (pos === 1) return driverLookup.get(driverNum) ?? null;
    }
    return null;
  }, [racePositions, driverLookup]);

  const topFinishers = useMemo(() => {
    if (!racePositions || !driverLookup.size) return [];
    const finalPos = new Map<number, number>();
    for (const p of racePositions) {
      finalPos.set(p.driver_number, p.position);
    }
    return [...finalPos.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 10)
      .map(([driverNum, pos]) => ({
        driver: driverLookup.get(driverNum),
        position: pos,
      }))
      .filter((r) => r.driver);
  }, [racePositions, driverLookup]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Circuit Stats"
        subtitle="Historical data and records by circuit"
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {meetingsLoading && <Skeleton className="h-12" />}

      {meetings && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-f1-text-muted">
            Select Circuit
          </label>
          <select
            value={selectedCircuit ?? ""}
            onChange={(e) => setSelectedCircuit(Number(e.target.value))}
            className="rounded-md border border-f1-border bg-f1-surface px-3 py-2 text-sm font-semibold text-f1-text focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
          >
            <option value="" disabled>
              Choose a race weekend
            </option>
            {meetings.map((m) => (
              <option key={m.meeting_key} value={m.meeting_key}>
                {m.meeting_name} — {m.circuit_short_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedCircuit && selectedMeeting && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Circuit"
              value={selectedMeeting.circuit_short_name}
              sublabel={`${selectedMeeting.location}, ${selectedMeeting.country_name}`}
            />
            <StatCard
              label="Fastest Lap"
              value={formatLapTime(fastestLap?.lap_duration ?? null)}
              sublabel={
                fastestLap
                  ? driverLookup.get(fastestLap.driver_number)?.name_acronym
                  : undefined
              }
            />
            <StatCard
              label="Race Winner"
              value={raceWinner?.name_acronym ?? "—"}
              sublabel={raceWinner?.team_name}
            />
          </div>

          {topFinishers.length > 0 && (
            <div className="rounded-lg border border-f1-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-f1-border bg-f1-card text-xs font-semibold uppercase text-f1-text-muted">
                    <th className="px-4 py-3 text-center w-12">Pos</th>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {topFinishers.map((r) => (
                    <tr
                      key={r.driver!.driver_number}
                      className="border-b border-f1-border/50 bg-f1-surface hover:bg-f1-card transition-colors"
                    >
                      <td className="px-4 py-3 text-center font-bold">
                        {r.position}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-1 rounded-full"
                            style={{
                              backgroundColor: getTeamColor(
                                r.driver!.team_colour
                              ),
                            }}
                          />
                          <span className="font-bold">
                            {r.driver!.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-f1-text-secondary">
                        {r.driver!.team_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!selectedCircuit && meetings && meetings.length > 0 && (
        <EmptyState
          title="Select a circuit"
          description="Choose a race weekend above to view circuit statistics."
        />
      )}
    </div>
  );
}
