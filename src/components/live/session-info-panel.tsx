"use client";

import { useWeather } from "@/lib/hooks/use-weather";
import { getTyreAllocation } from "@/lib/data/tyre-allocations";
import { getCircuitLapLength, getCircuitTurns } from "@/lib/data/circuit-info";
import { TIRE_COLORS } from "@/lib/utils/colors";
import { format, parseISO } from "date-fns";
import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Gauge,
  Calendar,
  Clock,
  MapPin,
  Flag,
  Route,
  CornerDownRight,
} from "lucide-react";
import type { Session } from "@/lib/openf1/types";

interface SessionInfoPanelProps {
  session: Session;
  year: number;
  /** Total race laps (from lap data). Shown for race/sprint sessions. */
  totalLaps?: number;
}

const COMPOUND_LABELS: Record<string, string> = {
  hard: "Hard",
  medium: "Medium",
  soft: "Soft",
};

export function SessionInfoPanel({
  session,
  year,
  totalLaps,
}: SessionInfoPanelProps) {
  const { data: weather } = useWeather(session.session_key);
  const allocation = getTyreAllocation(year, session.circuit_short_name);
  const lapLength = getCircuitLapLength(session.circuit_short_name);
  const turns = getCircuitTurns(session.circuit_short_name);
  const isRace = session.session_type === "Race" || session.session_type === "Sprint";

  const latest = weather && weather.length > 0 ? weather[weather.length - 1] : null;

  const sessionDate = parseISO(session.date_start);
  const gmtOffset = session.gmt_offset;

  return (
    <div className="space-y-4">
      {/* Weather */}
      {latest && (
        <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted mb-3">
            Weather
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <InfoStat icon={Thermometer} label="Air" value={`${latest.air_temperature.toFixed(1)}°C`} />
            <InfoStat icon={Thermometer} label="Track" value={`${latest.track_temperature.toFixed(1)}°C`} />
            <InfoStat icon={Droplets} label="Humidity" value={`${latest.humidity.toFixed(0)}%`} />
            <InfoStat icon={Wind} label="Wind" value={`${latest.wind_speed.toFixed(1)} m/s`} />
            <InfoStat icon={CloudRain} label="Rain" value={latest.rainfall > 0 ? "Wet" : "Dry"} />
            <InfoStat icon={Gauge} label="Pressure" value={`${latest.pressure.toFixed(0)} mbar`} />
          </div>
        </div>
      )}

      {/* Tyre Compounds */}
      {allocation && (
        <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted mb-3">
            Tyre Compounds
          </p>
          <div className="flex items-center justify-around">
            {(["hard", "medium", "soft"] as const).map((type) => {
              const cNum = allocation[type];
              const color =
                type === "hard"
                  ? TIRE_COLORS.HARD
                  : type === "medium"
                    ? TIRE_COLORS.MEDIUM
                    : TIRE_COLORS.SOFT;
              return (
                <div key={type} className="flex flex-col items-center gap-1">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold"
                    style={{ borderColor: color, color }}
                  >
                    C{cNum}
                  </div>
                  <span className="text-[10px] text-f1-text-secondary uppercase">
                    {COMPOUND_LABELS[type]}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Compound scale */}
          <div className="mt-3 flex items-center gap-1">
            {Array.from({ length: year === 2025 ? 6 : 5 }, (_, i) => i + 1).map((c) => {
              const selected =
                c === allocation.hard ||
                c === allocation.medium ||
                c === allocation.soft;
              const color = selected
                ? c === allocation.hard
                  ? TIRE_COLORS.HARD
                  : c === allocation.medium
                    ? TIRE_COLORS.MEDIUM
                    : TIRE_COLORS.SOFT
                : undefined;
              return (
                <div
                  key={c}
                  className={`flex h-5 flex-1 items-center justify-center rounded text-[10px] font-semibold ${
                    selected ? "text-black" : "text-f1-text-muted opacity-30"
                  }`}
                  style={
                    selected
                      ? { backgroundColor: color }
                      : { backgroundColor: "var(--f1-card)" }
                  }
                >
                  C{c}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Info */}
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted mb-3">
          Event
        </p>
        <div className="space-y-2">
          <InfoStat icon={Calendar} label="Date" value={format(sessionDate, "EEEE, d MMMM yyyy")} />
          <InfoStat icon={Clock} label="Local Time" value={`${format(sessionDate, "HH:mm")} (UTC${gmtOffset})`} />
          <InfoStat icon={MapPin} label="Location" value={`${session.location}, ${session.country_name}`} />
          {!isRace && lapLength != null && (
            <InfoStat icon={Route} label="Circuit Length" value={`${lapLength.toFixed(3)} km (${(lapLength * 0.621371).toFixed(3)} mi)`} />
          )}
          {!isRace && turns != null && (
            <InfoStat icon={CornerDownRight} label="Turns" value={`${turns}`} />
          )}
          {isRace && totalLaps != null && totalLaps > 0 && (
            <InfoStat icon={Flag} label="Race Laps" value={`${totalLaps}`} />
          )}
          {isRace && totalLaps != null && totalLaps > 0 && lapLength != null && (
            <InfoStat icon={Route} label="Race Distance" value={`${(totalLaps * lapLength).toFixed(1)} km (${(totalLaps * lapLength * 0.621371).toFixed(1)} mi)`} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-f1-text-muted" />
      <div className="min-w-0">
        <p className="truncate text-[10px] text-f1-text-secondary">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
