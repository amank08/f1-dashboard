import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";

interface CircuitMapProps {
  circuitShortName: string;
}

export function CircuitMap({ circuitShortName }: CircuitMapProps) {
  const circuit = CIRCUIT_PATHS[circuitShortName];
  if (!circuit) return null;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
      <svg
        viewBox={circuit.viewBox}
        className="w-full"
        aria-label={`Track map of ${circuit.name}`}
      >
        <path
          d={circuit.path}
          fill="none"
          stroke="var(--f1-text-muted)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-2 text-center text-xs font-medium text-f1-text-muted">
        {circuit.name}
      </p>
    </div>
  );
}
