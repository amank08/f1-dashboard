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
        {circuit.sectors.map((sectorPath, i) => (
          <path
            key={i}
            d={sectorPath}
            fill="none"
            stroke={SECTOR_COLORS[i]}
            strokeWidth={1}
            strokeLinejoin="round"
            strokeOpacity={0.85}
          />
        ))}
        {/* Start/finish line */}
        <line
          x1={circuit.sfLine.x1}
          y1={circuit.sfLine.y1}
          x2={circuit.sfLine.x2}
          y2={circuit.sfLine.y2}
          stroke="white"
          strokeWidth="1"
          strokeLinecap="butt"
        />
        {/* Intermediate tick marks at sector boundaries */}
        {([
          { line: circuit.markers.i1, color: SECTOR_COLORS[0] },
          { line: circuit.markers.i2, color: SECTOR_COLORS[1] },
        ] as const).map(({ line, color }, i) => (
          <line
            key={`marker-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={color}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}
        {/* Sector labels with dark halo for separation from track */}
        {([
          { pos: circuit.labels.s1, label: 'S1', color: SECTOR_COLORS[0], size: 5 },
          { pos: circuit.labels.s2, label: 'S2', color: SECTOR_COLORS[1], size: 5 },
          { pos: circuit.labels.s3, label: 'S3', color: SECTOR_COLORS[2], size: 5 },
          { pos: circuit.labels.i1, label: 'I1', color: SECTOR_COLORS[0], size: 3.5 },
          { pos: circuit.labels.i2, label: 'I2', color: SECTOR_COLORS[1], size: 3.5 },
        ] as const).map(({ pos, label, color, size }) => (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            fill={color}
            fontSize={size}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="bold"
            paintOrder="stroke"
            stroke="var(--f1-bg)"
            strokeWidth={size < 5 ? 2 : 3}
            strokeLinejoin="round"
            opacity={size < 5 ? 0.7 : 1}
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
