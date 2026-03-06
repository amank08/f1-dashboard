"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useWeather } from "@/lib/hooks/use-weather";
import { PageHeader } from "@/components/layout/page-header";
import { WeatherChart } from "@/components/charts/weather-chart";
import { StatCard } from "@/components/cards/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function WeatherPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: weather, isLoading } = useWeather(sessionKeyNum);

  const session = sessions?.[0];

  const avgAirTemp = weather
    ? (
        weather.reduce((s, w) => s + w.air_temperature, 0) / weather.length
      ).toFixed(1)
    : null;
  const avgTrackTemp = weather
    ? (
        weather.reduce((s, w) => s + w.track_temperature, 0) / weather.length
      ).toFixed(1)
    : null;
  const hadRain = weather?.some((w) => w.rainfall > 0);

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
        title="Weather Conditions"
        subtitle={
          session
            ? `${session.session_name} · ${session.circuit_short_name}`
            : undefined
        }
      />

      {isLoading && <Skeleton className="h-96" />}

      {weather && weather.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Avg Air Temperature"
              value={avgAirTemp ? `${avgAirTemp}°C` : "—"}
            />
            <StatCard
              label="Avg Track Temperature"
              value={avgTrackTemp ? `${avgTrackTemp}°C` : "—"}
            />
            <StatCard
              label="Rainfall"
              value={hadRain ? "Yes" : "No"}
            />
          </div>

          <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
            <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
              Temperature & Humidity over Time
            </h3>
            <WeatherChart weather={weather} />
          </div>
        </>
      )}

      {!isLoading && (!weather || weather.length === 0) && (
        <EmptyState
          title="No weather data"
          description="Weather data is not available for this session."
        />
      )}
    </div>
  );
}
