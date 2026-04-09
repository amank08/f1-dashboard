"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/hooks/use-sessions";
import { useDrivers } from "@/lib/hooks/use-drivers";
import { useCarData } from "@/lib/hooks/use-car-data";
import { PageHeader } from "@/components/layout/page-header";
import { DriverSelector } from "@/components/selectors/driver-selector";
import { TelemetryChart } from "@/components/charts/telemetry-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function TelemetryPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const sessionKeyNum = Number(sessionKey);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);

  const { data: sessions } = useSession(sessionKeyNum);
  const { data: drivers, isLoading: driversLoading } = useDrivers(sessionKeyNum);
  const effectiveSelectedDriver = selectedDriver ?? drivers?.[0]?.driver_number ?? null;
  const { data: carData, isLoading: carDataLoading } = useCarData(
    sessionKeyNum,
    effectiveSelectedDriver
  );

  const session = sessions?.[0];

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
        title="Telemetry"
        subtitle={
          session
            ? `${session.session_name} · ${session.circuit_short_name}`
            : undefined
        }
      />

      {drivers && (
        <div>
          <p className="mb-2 text-sm font-semibold text-f1-text-secondary">
            Select Driver
          </p>
          <DriverSelector
            drivers={drivers}
            selected={effectiveSelectedDriver ? [effectiveSelectedDriver] : []}
            onChange={(nums) => setSelectedDriver(nums[0] ?? null)}
            max={1}
          />
        </div>
      )}

      {(driversLoading || carDataLoading) && <Skeleton className="h-96" />}

      {carData && carData.length > 0 && (
        <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
          <h3 className="mb-4 text-sm font-semibold text-f1-text-secondary uppercase">
            Car Telemetry
          </h3>
          <TelemetryChart data={carData} />
          <p className="mt-3 text-xs text-f1-text-muted">
            Showing {carData.length.toLocaleString()} data points (sampled for
            performance)
          </p>
        </div>
      )}

      {!carDataLoading && !effectiveSelectedDriver && (
        <EmptyState
          title="Select a driver"
          description="Choose a driver to view their telemetry data."
        />
      )}

      {!carDataLoading && effectiveSelectedDriver && carData && carData.length === 0 && (
        <EmptyState
          title="No telemetry data"
          description="Telemetry data is not available for this driver in this session."
        />
      )}
    </div>
  );
}
