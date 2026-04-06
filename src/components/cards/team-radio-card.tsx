"use client";

import { useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Radio, Play, Pause, Volume2 } from "lucide-react";
import type { TeamRadio, Driver } from "@/lib/openf1/types";
import { getTeamColor } from "@/lib/utils/colors";
import { Skeleton } from "@/components/ui/skeleton";

function AudioButton({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-f1-card text-f1-text-secondary hover:bg-f1-border hover:text-f1-text transition-colors"
      aria-label={playing ? "Pause" : "Play"}
    >
      {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
    </button>
  );
}

interface TeamRadioCardProps {
  radios: TeamRadio[] | undefined;
  drivers: Driver[] | undefined;
  isLoading: boolean;
}

export function TeamRadioCard({
  radios,
  drivers,
  isLoading,
}: TeamRadioCardProps) {
  const driverMap = new Map(
    drivers?.map((d) => [d.driver_number, d]) ?? []
  );

  const sorted = radios
    ? [...radios].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    : [];

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-f1-text-muted" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-f1-text-muted">
          Team Radio
        </h3>
        {sorted.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-f1-text-muted">
            {sorted.length} message{sorted.length !== 1 && "s"}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="mt-3 text-center text-sm text-f1-text-muted">
          No team radio messages
        </p>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="mt-3 max-h-[480px] space-y-1.5 overflow-y-auto">
          {sorted.map((radio, i) => {
            const driver = driverMap.get(radio.driver_number);
            const teamColor = driver?.team_colour
              ? getTeamColor(driver.team_colour, driver.team_name)
              : undefined;

            return (
              <div
                key={`${radio.date}-${radio.driver_number}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-f1-border p-2.5 text-sm"
              >
                {/* Team color bar */}
                <div
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: teamColor ?? "var(--f1-text-muted)" }}
                />

                {/* Driver + time */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {driver?.name_acronym ?? `#${radio.driver_number}`}
                    </span>
                    <span className="text-xs text-f1-text-muted">
                      {driver?.team_name}
                    </span>
                  </div>
                  <span className="text-xs text-f1-text-muted">
                    {format(parseISO(radio.date), "HH:mm:ss")}
                  </span>
                </div>

                {/* Play button */}
                <AudioButton url={radio.recording_url} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
