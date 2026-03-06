"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useTeamRadio } from "@/lib/hooks/use-team-radio";
import { PageHeader } from "@/components/layout/page-header";
import { TeamRadioCard } from "@/components/cards/team-radio-card";
import { StatCard } from "@/components/cards/stat-card";

export default function TeamRadioPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: drivers, isLoading: driversLoading } =
    useDrivers(sessionKeyNum);
  const { data: radios, isLoading: radiosLoading } =
    useTeamRadio(sessionKeyNum);

  const session = sessions?.[0];
  const isLoading = driversLoading || radiosLoading;

  // Stats
  const driverCounts = new Map<number, number>();
  radios?.forEach((r) =>
    driverCounts.set(r.driver_number, (driverCounts.get(r.driver_number) ?? 0) + 1)
  );
  const mostActiveNum = driverCounts.size > 0
    ? [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    : null;
  const mostActiveDriver = mostActiveNum
    ? drivers?.find((d) => d.driver_number === mostActiveNum[0])
    : null;

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
        title="Team Radio"
        subtitle={
          session
            ? `${session.session_name} · ${session.circuit_short_name}`
            : undefined
        }
      />

      {radios && radios.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Messages"
            value={String(radios.length)}
          />
          <StatCard
            label="Drivers on Radio"
            value={String(driverCounts.size)}
          />
          <StatCard
            label="Most Active"
            value={mostActiveDriver?.name_acronym ?? "—"}
            sublabel={
              mostActiveNum
                ? `${mostActiveNum[1]} message${mostActiveNum[1] !== 1 ? "s" : ""}`
                : undefined
            }
          />
        </div>
      )}

      <TeamRadioCard
        radios={radios}
        drivers={drivers}
        isLoading={isLoading}
      />
    </div>
  );
}
