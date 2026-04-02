"use client";

import { useState } from "react";
import { SeasonSelector } from "@/components/selectors/season-selector";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useStandings } from "@/lib/hooks/use-standings";
import { getTeamColor, getTeamLogoUrl, getTeamLogoStyle } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

function TeamIcon({ teamColour, teamName }: { teamColour: string; teamName: string }) {
  const logoUrl = getTeamLogoUrl(teamName);
  const color = getTeamColor(teamColour, teamName);
  return (
    <div
      className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      {logoUrl && (
        <img
          src={logoUrl}
          alt={teamName}
          className="h-4 w-4 object-contain"
          style={getTeamLogoStyle(teamName)}
        />
      )}
    </div>
  );
}

export default function StandingsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const { drivers, constructors, isLoading, racesCompleted, noRacesYet } =
    useStandings(year);

  const subtitle = noRacesYet
    ? "Season not yet started"
    : racesCompleted
    ? `After ${racesCompleted} race${racesCompleted !== 1 ? "s" : ""}`
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Championship Standings"
        subtitle={subtitle}
        actions={<SeasonSelector value={year} onChange={setYear} />}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-f1-border bg-f1-surface p-1 w-fit">
        {(["drivers", "constructors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors",
              tab === t
                ? "bg-f1-red text-white"
                : "text-f1-text-secondary hover:text-f1-text"
            )}
          >
            {t === "drivers" ? "Drivers" : "Constructors"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {noRacesYet && !isLoading && (
        <div className="rounded-lg border border-f1-border bg-f1-surface p-12 text-center text-f1-text-secondary">
          No races have been completed yet for the {year} season.
        </div>
      )}

      {/* Driver standings table */}
      {tab === "drivers" && drivers && drivers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-f1-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-f1-border bg-f1-surface text-xs font-semibold uppercase tracking-wide text-f1-text-secondary">
                <th className="w-12 px-4 py-3 text-left">Pos</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Team</th>
                <th className="hidden px-4 py-3 text-center md:table-cell">Wins</th>
                <th className="hidden px-4 py-3 text-center md:table-cell">Podiums</th>
                <th className="px-4 py-3 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver, i) => (
                <tr
                  key={driver.driverNumber}
                  className="border-b border-f1-border/50 transition-colors last:border-0 hover:bg-f1-card"
                >
                  <td className="px-4 py-3 font-bold text-f1-text-muted">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2"
                        style={{
                          borderColor: getTeamColor(driver.teamColour, driver.team),
                          backgroundColor: "var(--f1-card)",
                          boxShadow: `0 0 8px 1px ${getTeamColor(driver.teamColour, driver.team)}55`,
                        }}
                      >
                        {driver.headshotUrl ? (
                          <img
                            src={driver.headshotUrl}
                            alt={driver.name}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-f1-text-muted">
                            {driver.acronym}
                          </div>
                        )}
                      </div>
                      <span className="font-bold">{driver.name}</span>
                      <span className="text-xs text-f1-text-muted">
                        {driver.acronym}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-f1-text-secondary sm:table-cell">
                    {driver.team}
                  </td>
                  <td className="hidden px-4 py-3 text-center md:table-cell">
                    {driver.wins}
                  </td>
                  <td className="hidden px-4 py-3 text-center md:table-cell">
                    {driver.podiums}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {driver.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Constructor standings table */}
      {tab === "constructors" && constructors && constructors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-f1-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-f1-border bg-f1-surface text-xs font-semibold uppercase tracking-wide text-f1-text-secondary">
                <th className="w-12 px-4 py-3 text-left">Pos</th>
                <th className="px-4 py-3 text-left">Constructor</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">
                  Drivers
                </th>
                <th className="hidden px-4 py-3 text-center md:table-cell">
                  Wins
                </th>
                <th className="px-4 py-3 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {constructors.map((ctor, i) => (
                <tr
                  key={ctor.team}
                  className="border-b border-f1-border/50 transition-colors last:border-0 hover:bg-f1-card"
                >
                  <td className="px-4 py-3 font-bold text-f1-text-muted">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <TeamIcon teamColour={ctor.teamColour} teamName={ctor.team} />
                      <span className="font-bold">{ctor.team}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-f1-text-secondary sm:table-cell">
                    {ctor.drivers.join(" · ")}
                  </td>
                  <td className="hidden px-4 py-3 text-center md:table-cell">
                    {ctor.wins}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {ctor.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
