"use client";

import type { Meeting, Session } from "@/lib/openf1/types";
import { TrackDetailCard } from "./track-detail-card";
import { TyreAllocationCard } from "./tyre-allocation-card";
import { WeatherSummaryCard } from "./weather-summary-card";

interface MeetingInfoGridProps {
  meeting: Meeting;
  sessions: Session[];
}

export function MeetingInfoGrid({ meeting, sessions }: MeetingInfoGridProps) {
  // Pick Race session for weather, fallback to last session
  const raceSession =
    sessions.find((s) => s.session_type === "Race") ??
    sessions[sessions.length - 1];

  const weatherSessionKey = raceSession?.session_key ?? null;
  const year = meeting.year;
  const circuit = meeting.circuit_short_name;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Track Map with DRS zones / straight-line mode */}
      <TrackDetailCard circuitShortName={circuit} year={year} />

      {/* Tyre Compounds */}
      <TyreAllocationCard year={year} circuitShortName={circuit} />

      {/* Weather */}
      <WeatherSummaryCard sessionKey={weatherSessionKey} />
    </div>
  );
}
