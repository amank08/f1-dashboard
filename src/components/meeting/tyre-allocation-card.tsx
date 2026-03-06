import { getTyreAllocation } from "@/lib/data/tyre-allocations";
import { TIRE_COLORS } from "@/lib/utils/colors";

const ALL_COMPOUNDS = [1, 2, 3, 4, 5] as const;

const COMPOUND_LABELS: Record<string, { color: string; name: string }> = {
  hard: { color: TIRE_COLORS.HARD, name: "Hard" },
  medium: { color: TIRE_COLORS.MEDIUM, name: "Medium" },
  soft: { color: TIRE_COLORS.SOFT, name: "Soft" },
};

interface TyreAllocationCardProps {
  year: number;
  circuitShortName: string;
}

export function TyreAllocationCard({
  year,
  circuitShortName,
}: TyreAllocationCardProps) {
  const allocation = getTyreAllocation(year, circuitShortName);
  if (!allocation) return null;

  const selected = new Set([
    allocation.hard,
    allocation.medium,
    allocation.soft,
  ]);

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted">
        Tyre Compounds
      </p>

      {/* Selected compounds */}
      <div className="mt-3 flex items-center gap-4">
        {(["hard", "medium", "soft"] as const).map((type) => {
          const { color, name } = COMPOUND_LABELS[type];
          const cNumber = allocation[type];
          return (
            <div key={type} className="flex flex-col items-center gap-1">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold"
                style={{ borderColor: color, color }}
              >
                C{cNumber}
              </div>
              <span className="text-xs text-f1-text-secondary">{name}</span>
            </div>
          );
        })}
      </div>

      {/* Full C1-C5 scale */}
      <div className="mt-3 flex items-center gap-1">
        {ALL_COMPOUNDS.map((c) => (
          <div
            key={c}
            className={`flex h-6 flex-1 items-center justify-center rounded text-[10px] font-semibold ${
              selected.has(c)
                ? "text-white"
                : "text-f1-text-muted opacity-30"
            }`}
            style={
              selected.has(c)
                ? {
                    backgroundColor:
                      c === allocation.hard
                        ? TIRE_COLORS.HARD
                        : c === allocation.medium
                          ? TIRE_COLORS.MEDIUM
                          : TIRE_COLORS.SOFT,
                    color:
                      c === allocation.hard ? "#111" : "#111",
                  }
                : { backgroundColor: "var(--f1-card)" }
            }
          >
            C{c}
          </div>
        ))}
      </div>
    </div>
  );
}
