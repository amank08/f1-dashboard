"use client";

import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/layout/page-header";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PointsProgressionChart } from "@/components/charts/points-progression-chart";
import { getTeamColor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

interface DriverStanding {
  driverNumber: number;
  name: string;
  acronym: string;
  team: string;
  teamColour: string;
  points: number;
  wins: number;
}

interface ConstructorStanding {
  team: string;
  teamColour: string;
  points: number;
  wins: number;
}

interface StandingsData {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  progression: Array<Record<string, number | string>>;
  top10: string[];
  driverColors: Record<string, string>;
}

function useStandings(year: number) {
  return useSWR<StandingsData>(`/api/standings?year=${year}`);
}

const TABS = [
  { key: "drivers", label: "Drivers" },
  { key: "constructors", label: "Constructors" },
];

export default function StandingsPage() {
  const [year, setYear] = useState(2025);
  const [activeTab, setActiveTab] = useState("drivers");
  const { data, isLoading } = useStandings(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Championship Standings"
        subtitle={`${year} Season`}
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {data && activeTab === "drivers" && (
        <>
          {data.progression?.length > 0 && data.top10?.length > 0 && (
            <PointsProgressionChart
              data={data.progression}
              driverKeys={data.top10}
              driverColors={data.driverColors}
            />
          )}
          <div className="space-y-2">
            {data.drivers.map((driver, idx) => (
              <div
                key={driver.driverNumber}
                className="flex items-center gap-4 rounded-lg border border-f1-border bg-f1-surface p-4"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    idx === 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : idx === 1
                        ? "bg-gray-400/20 text-gray-300"
                        : idx === 2
                          ? "bg-amber-700/20 text-amber-600"
                          : "bg-f1-card text-f1-text-muted"
                  )}
                >
                  {idx + 1}
                </span>
                <div
                  className="h-8 w-1 rounded-full"
                  style={{ backgroundColor: getTeamColor(driver.teamColour) }}
                />
                <div className="flex-1">
                  <p className="font-bold">{driver.name}</p>
                  <p className="text-xs text-f1-text-secondary">{driver.team}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{driver.points}</p>
                  <p className="text-xs text-f1-text-muted">
                    {driver.wins > 0 ? `${driver.wins} wins` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data && activeTab === "constructors" && (
        <div className="space-y-2">
          {data.constructors.map((team, idx) => (
            <div
              key={team.team}
              className="flex items-center gap-4 rounded-lg border border-f1-border bg-f1-surface p-4"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  idx === 0
                    ? "bg-yellow-500/20 text-yellow-400"
                    : idx === 1
                      ? "bg-gray-400/20 text-gray-300"
                      : idx === 2
                        ? "bg-amber-700/20 text-amber-600"
                        : "bg-f1-card text-f1-text-muted"
                )}
              >
                {idx + 1}
              </span>
              <div
                className="h-8 w-1 rounded-full"
                style={{ backgroundColor: getTeamColor(team.teamColour) }}
              />
              <div className="flex-1">
                <p className="font-bold">{team.team}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{team.points}</p>
                <p className="text-xs text-f1-text-muted">
                  {team.wins > 0 ? `${team.wins} wins` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data &&
        ((activeTab === "drivers" && data.drivers.length === 0) ||
          (activeTab === "constructors" &&
            data.constructors.length === 0)) && (
          <EmptyState
            title="No standings data"
            description={`Standings data is not yet available for ${year}.`}
          />
        )}
    </div>
  );
}
