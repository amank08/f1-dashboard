"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/cards/stat-card";
import { Tabs } from "@/components/ui/tabs";
import type {
  Session,
  Position,
  Driver,
  RaceControlMessage,
} from "@/lib/openf1/types";
import { computeConsistencyScore } from "@/lib/utils/analytics";

const TABS = [
  { key: "consistency", label: "Consistency" },
  { key: "penalties", label: "Penalties" },
  { key: "safety-cars", label: "Safety Cars" },
];

interface SeasonStats {
  consistency: Array<{ driver: string; score: number; team: string }>;
  penalties: Array<{ driver: string; count: number }>;
  safetyCars: Array<{ race: string; count: number }>;
  totalRaces: number;
  totalSafetyCars: number;
  totalPenalties: number;
}

export default function SeasonStatsPage() {
  const [year, setYear] = useState(2025);
  const [activeTab, setActiveTab] = useState("consistency");

  const { data: stats, isLoading } = useSWR<SeasonStats>(
    `season-stats:${year}`,
    async () => {
      // Fetch sessions
      const sessionsRes = await fetch(
        `/api/f1/sessions?year=${year}&session_type=Race`
      );
      const sessions: Session[] = await sessionsRes.json();

      // Process race data
      const driverPositions = new Map<
        number,
        { positions: number[]; name: string; team: string }
      >();
      const penaltyCounts = new Map<string, number>();
      const safetyCarData: Array<{ race: string; count: number }> = [];
      let totalSafetyCars = 0;
      let totalPenalties = 0;

      for (const session of sessions.slice(0, 15)) {
        // Limit to avoid rate limits
        try {
          const [posRes, driverRes, rcRes] = await Promise.all([
            fetch(`/api/f1/position?session_key=${session.session_key}`),
            fetch(`/api/f1/drivers?session_key=${session.session_key}`),
            fetch(
              `/api/f1/race_control?session_key=${session.session_key}`
            ),
          ]);

          const positions: Position[] = posRes.ok ? await posRes.json() : [];
          const drivers: Driver[] = driverRes.ok ? await driverRes.json() : [];
          const raceControl: RaceControlMessage[] = rcRes.ok
            ? await rcRes.json()
            : [];

          const driverLookup = new Map<number, Driver>();
          for (const d of drivers) driverLookup.set(d.driver_number, d);

          // Final positions
          const finalPos = new Map<number, number>();
          for (const p of positions) finalPos.set(p.driver_number, p.position);

          for (const [driverNum, pos] of finalPos) {
            const d = driverLookup.get(driverNum);
            if (!d) continue;
            if (!driverPositions.has(driverNum)) {
              driverPositions.set(driverNum, {
                positions: [],
                name: d.name_acronym,
                team: d.team_name,
              });
            }
            driverPositions.get(driverNum)!.positions.push(pos);
          }

          // Penalties
          for (const msg of raceControl) {
            if (
              msg.category === "Penalty" ||
              msg.message.toLowerCase().includes("penalty")
            ) {
              if (msg.driver_number) {
                const d = driverLookup.get(msg.driver_number);
                const name = d?.name_acronym ?? String(msg.driver_number);
                penaltyCounts.set(name, (penaltyCounts.get(name) ?? 0) + 1);
                totalPenalties++;
              }
            }
          }

          // Safety cars
          const scCount = raceControl.filter(
            (m) =>
              m.message.includes("SAFETY CAR") ||
              m.message.includes("VSC") ||
              m.category === "SafetyCar"
          ).length;
          safetyCarData.push({
            race: session.circuit_short_name || session.location || "Race",
            count: scCount,
          });
          totalSafetyCars += scCount;
        } catch {
          // Skip failed sessions
        }
      }

      // Compute consistency scores
      const consistency = [...driverPositions.entries()]
        .map(([, data]) => ({
          driver: data.name,
          score: +computeConsistencyScore(data.positions).toFixed(2),
          team: data.team,
        }))
        .filter((d) => d.score > 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 15);

      // Top penalized drivers
      const penalties = [...penaltyCounts.entries()]
        .map(([driver, count]) => ({ driver, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        consistency,
        penalties,
        safetyCars: safetyCarData,
        totalRaces: sessions.length,
        totalSafetyCars,
        totalPenalties,
      };
    },
    { revalidateOnFocus: false }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Season Overview"
        subtitle={`${year} Season Statistics`}
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      )}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Races Analyzed"
              value={String(stats.totalRaces)}
              sublabel={`${year} Season`}
            />
            <StatCard
              label="Safety Car Deployments"
              value={String(stats.totalSafetyCars)}
            />
            <StatCard
              label="Total Penalties"
              value={String(stats.totalPenalties)}
            />
          </div>

          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "consistency" && stats.consistency.length > 0 && (
            <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
              <h3 className="mb-1 text-sm font-semibold uppercase text-f1-text-muted">
                Driver Consistency
              </h3>
              <p className="mb-4 text-xs text-f1-text-muted">
                Lower score = more consistent finishing positions (standard
                deviation)
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={stats.consistency}
                  layout="vertical"
                  margin={{ left: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#888", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="driver"
                    tick={{ fill: "#ccc", fontSize: 12 }}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E1E2E",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value?: number) => [
                      value?.toFixed(2) ?? "—",
                      "Consistency Score",
                    ]}
                  />
                  <Bar dataKey="score" fill="#E10600" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === "penalties" && (
            <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
                Penalties per Driver
              </h3>
              {stats.penalties.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.penalties}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="driver"
                      tick={{ fill: "#888", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1E1E2E",
                        border: "1px solid #333",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#FF6B35"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm text-f1-text-muted py-8">
                  No penalty data available
                </p>
              )}
            </div>
          )}

          {activeTab === "safety-cars" && (
            <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase text-f1-text-muted">
                Safety Car Deployments per Race
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.safetyCars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="race"
                    tick={{ fill: "#888", fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E1E2E",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#FFC906"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
