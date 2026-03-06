"use client";

import { useWeather } from "@/lib/hooks/use-weather";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Gauge,
} from "lucide-react";

interface WeatherSummaryCardProps {
  sessionKey: number | null;
}

export function WeatherSummaryCard({ sessionKey }: WeatherSummaryCardProps) {
  const { data: weather, isLoading } = useWeather(sessionKey);

  if (!sessionKey) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted">
          Weather
        </p>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!weather || weather.length === 0) return null;

  // Use the last weather reading for the session
  const latest = weather[weather.length - 1];

  const stats = [
    {
      icon: Thermometer,
      label: "Air Temp",
      value: `${latest.air_temperature.toFixed(1)}°C`,
    },
    {
      icon: Thermometer,
      label: "Track Temp",
      value: `${latest.track_temperature.toFixed(1)}°C`,
    },
    {
      icon: Droplets,
      label: "Humidity",
      value: `${latest.humidity.toFixed(0)}%`,
    },
    {
      icon: Wind,
      label: "Wind",
      value: `${latest.wind_speed.toFixed(1)} m/s`,
    },
    {
      icon: CloudRain,
      label: "Rainfall",
      value: latest.rainfall > 0 ? "Yes" : "No",
    },
    {
      icon: Gauge,
      label: "Pressure",
      value: `${latest.pressure.toFixed(0)} mbar`,
    },
  ];

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted">
        Weather (Race)
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={14} className="shrink-0 text-f1-text-muted" />
            <div className="min-w-0">
              <p className="truncate text-xs text-f1-text-secondary">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
