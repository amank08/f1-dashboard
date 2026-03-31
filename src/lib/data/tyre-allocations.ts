export interface TyreAllocation {
  hard: number;
  medium: number;
  soft: number;
}

// Pirelli selects 3 consecutive compounds per race weekend.
// C1 = hardest, C5 = softest (C6 existed only in 2025).
// The 3 chosen become Hard/Medium/Soft for that weekend.
// Keyed by year → circuit_short_name.

const TYRE_ALLOCATIONS: Record<number, Record<string, TyreAllocation>> = {
  2024: {
    Sakhir: { hard: 1, medium: 2, soft: 3 },
    Jeddah: { hard: 2, medium: 3, soft: 4 },
    Melbourne: { hard: 2, medium: 3, soft: 4 },
    Suzuka: { hard: 1, medium: 2, soft: 3 },
    Shanghai: { hard: 2, medium: 3, soft: 4 },
    Miami: { hard: 2, medium: 3, soft: 4 },
    Imola: { hard: 2, medium: 3, soft: 4 },
    "Monte Carlo": { hard: 3, medium: 4, soft: 5 },
    Montreal: { hard: 3, medium: 4, soft: 5 },
    Catalunya: { hard: 1, medium: 2, soft: 3 },
    Spielberg: { hard: 2, medium: 3, soft: 4 },
    Silverstone: { hard: 1, medium: 2, soft: 3 },
    Hungaroring: { hard: 2, medium: 3, soft: 4 },
    "Spa-Francorchamps": { hard: 1, medium: 2, soft: 3 },
    Zandvoort: { hard: 1, medium: 2, soft: 3 },
    Monza: { hard: 2, medium: 3, soft: 4 },
    Baku: { hard: 2, medium: 3, soft: 4 },
    Singapore: { hard: 3, medium: 4, soft: 5 },
    Austin: { hard: 2, medium: 3, soft: 4 },
    "Mexico City": { hard: 2, medium: 3, soft: 4 },
    Interlagos: { hard: 2, medium: 3, soft: 4 },
    "Las Vegas": { hard: 2, medium: 3, soft: 4 },
    Lusail: { hard: 1, medium: 2, soft: 3 },
    "Yas Marina Circuit": { hard: 2, medium: 3, soft: 4 },
  },
  2025: {
    Sakhir: { hard: 1, medium: 2, soft: 3 },
    Jeddah: { hard: 2, medium: 3, soft: 4 },
    Melbourne: { hard: 2, medium: 3, soft: 4 },
    Suzuka: { hard: 1, medium: 2, soft: 3 },
    Shanghai: { hard: 2, medium: 3, soft: 4 },
    Miami: { hard: 1, medium: 2, soft: 3 },
    Imola: { hard: 2, medium: 3, soft: 4 },
    "Monte Carlo": { hard: 4, medium: 5, soft: 6 },
    Montreal: { hard: 3, medium: 4, soft: 5 },
    Catalunya: { hard: 1, medium: 2, soft: 3 },
    Spielberg: { hard: 2, medium: 3, soft: 4 },
    Silverstone: { hard: 1, medium: 2, soft: 3 },
    Hungaroring: { hard: 3, medium: 4, soft: 5 },
    "Spa-Francorchamps": { hard: 1, medium: 2, soft: 3 },
    Zandvoort: { hard: 1, medium: 2, soft: 3 },
    Monza: { hard: 2, medium: 3, soft: 4 },
    Baku: { hard: 2, medium: 3, soft: 4 },
    Singapore: { hard: 4, medium: 5, soft: 6 },
    Austin: { hard: 2, medium: 3, soft: 4 },
    "Mexico City": { hard: 2, medium: 3, soft: 4 },
    Interlagos: { hard: 2, medium: 3, soft: 4 },
    "Las Vegas": { hard: 2, medium: 3, soft: 4 },
    Lusail: { hard: 1, medium: 2, soft: 3 },
    "Yas Marina Circuit": { hard: 2, medium: 3, soft: 4 },
  },
  2026: {
    Melbourne: { hard: 3, medium: 4, soft: 5 },
    Shanghai: { hard: 2, medium: 3, soft: 4 },
    Suzuka: { hard: 1, medium: 2, soft: 3 },
  },
};

export function getTyreAllocation(
  year: number,
  circuitShortName: string
): TyreAllocation | null {
  return TYRE_ALLOCATIONS[year]?.[circuitShortName] ?? null;
}
