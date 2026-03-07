import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";

interface CircuitMapProps {
  circuitShortName: string;
}

const SECTOR_COLORS = ['#ef4444', '#3b82f6', '#eab308'];

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
        {/* Sector-colored track outline */}
        {SECTOR_COLORS.map((color, i) => {
          const offset = circuit.sectorLengths.slice(0, i).reduce((a, b) => a + b, 0);
          const length = circuit.sectorLengths[i];
          return (
            <path
              key={i}
              d={circuit.path}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-offset}
              strokeOpacity={0.85}
            />
          );
        })}
        {/* Start/finish line */}
        <line
          x1={circuit.sfLine.x1}
          y1={circuit.sfLine.y1}
          x2={circuit.sfLine.x2}
          y2={circuit.sfLine.y2}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Sector labels with dark halo for separation from track */}
        {([
          { pos: circuit.labels.sf, label: 'S/F', color: 'white' },
          { pos: circuit.labels.s1, label: 'S1', color: SECTOR_COLORS[0] },
          { pos: circuit.labels.s2, label: 'S2', color: SECTOR_COLORS[1] },
          { pos: circuit.labels.s3, label: 'S3', color: SECTOR_COLORS[2] },
        ] as const).map(({ pos, label, color }) => (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            fill={color}
            fontSize={5}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="bold"
            paintOrder="stroke"
            stroke="var(--f1-bg)"
            strokeWidth={3}
            strokeLinejoin="round"
          >
            {label}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs font-medium text-f1-text-muted">
        {circuit.name}
      </p>
    </div>
  );
}
