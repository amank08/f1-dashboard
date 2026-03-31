"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";
import { cn } from "@/lib/utils/cn";

const SECTOR_COLORS = ["#ef4444", "#3b82f6", "#eab308"];

const LABEL_DEFS = [
  { key: "s1", label: "S1", color: SECTOR_COLORS[0], size: 5 },
  { key: "s2", label: "S2", color: SECTOR_COLORS[1], size: 5 },
  { key: "s3", label: "S3", color: SECTOR_COLORS[2], size: 5 },
  { key: "i1", label: "I1", color: SECTOR_COLORS[0], size: 3.5 },
  { key: "i2", label: "I2", color: SECTOR_COLORS[1], size: 3.5 },
] as const;

type LabelKey = (typeof LABEL_DEFS)[number]["key"];
type Labels = Record<LabelKey, { x: number; y: number }>;

const LABEL_KEYS = LABEL_DEFS.map((d) => d.key);

function pickLabels(all: Record<string, { x: number; y: number }>): Labels {
  return Object.fromEntries(LABEL_KEYS.map((k) => [k, all[k]])) as Labels;
}

function clientToSVG(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: Math.round(pt.x), y: Math.round(pt.y) };
}

export function LabelEditor({ circuitKey }: { circuitKey: string }) {
  const circuit = CIRCUIT_PATHS[circuitKey];
  const svgRef = useRef<SVGSVGElement>(null);
  const [labels, setLabels] = useState<Labels>(() => pickLabels(circuit.labels));
  const [dragTarget, setDragTarget] = useState<LabelKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset when circuit changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync derived state from prop change
    setLabels(pickLabels(CIRCUIT_PATHS[circuitKey].labels));
    setDragTarget(null);
  }, [circuitKey]);

  const handlePointerDown = useCallback(
    (key: LabelKey, e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setDragTarget(key);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget || !svgRef.current) return;
      const pos = clientToSVG(svgRef.current, e.clientX, e.clientY);
      if (pos) {
        setLabels((prev) => ({ ...prev, [dragTarget]: pos }));
      }
    },
    [dragTarget]
  );

  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
  }, []);

  const handleReset = () => {
    setLabels(pickLabels(CIRCUIT_PATHS[circuitKey].labels));
  };

  const handleCopy = async () => {
    const sf = circuit.labels.sf;
    const parts = [`sf: {x: ${sf.x}, y: ${sf.y}}`];
    for (const { key } of LABEL_DEFS) {
      parts.push(`${key}: {x: ${labels[key].x}, y: ${labels[key].y}}`);
    }
    const text = `labels: { ${parts.join(", ")} }`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!circuit) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4">
        <svg
          ref={svgRef}
          viewBox={circuit.viewBox}
          className={cn("w-full", dragTarget && "cursor-grabbing")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {/* Sector-colored track */}
          {circuit.sectors.map((sectorPath, i) => (
            <path
              key={i}
              d={sectorPath}
              fill="none"
              stroke={SECTOR_COLORS[i]}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeOpacity={0.85}
            />
          ))}
          {/* Checkered S/F line */}
          <defs>
            <pattern id="checker-editor" width="1" height="1" patternUnits="userSpaceOnUse">
              <rect width="0.5" height="0.5" fill="white" />
              <rect x="0.5" y="0.5" width="0.5" height="0.5" fill="white" />
              <rect x="0.5" width="0.5" height="0.5" fill="#222" />
              <rect y="0.5" width="0.5" height="0.5" fill="#222" />
            </pattern>
          </defs>
          <line
            x1={circuit.sfLine.x1}
            y1={circuit.sfLine.y1}
            x2={circuit.sfLine.x2}
            y2={circuit.sfLine.y2}
            stroke="url(#checker-editor)"
            strokeWidth="2"
            strokeLinecap="butt"
          />
          {/* Marker tick lines */}
          {(
            [
              { line: circuit.markers.i1, color: SECTOR_COLORS[0] },
              { line: circuit.markers.i2, color: SECTOR_COLORS[1] },
            ] as const
          ).map(({ line, color }, i) => (
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
          {/* Draggable labels */}
          {LABEL_DEFS.map(({ key, label, color, size }) => (
            <g
              key={key}
              onPointerDown={(e) => handlePointerDown(key, e)}
              style={{ cursor: dragTarget === key ? "grabbing" : "grab" }}
            >
              {/* Invisible hit area for easier grabbing */}
              <rect
                x={labels[key].x - size * 1.5}
                y={labels[key].y - size * 1.2}
                width={size * 3}
                height={size * 2.4}
                fill="transparent"
              />
              <text
                x={labels[key].x}
                y={labels[key].y}
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
            </g>
          ))}
        </svg>
      </div>

      {/* Coordinate readout */}
      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        {LABEL_DEFS.map(({ key, label, color }) => (
          <div
            key={key}
            className="rounded border border-f1-border bg-f1-surface px-2 py-1.5"
          >
            <span style={{ color }} className="font-bold">
              {label}
            </span>
            <span className="ml-1 text-f1-text-muted">
              {labels[key].x}, {labels[key].y}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="rounded bg-f1-red px-4 py-2 text-sm font-medium text-white hover:bg-f1-red/80"
        >
          {copied ? "Copied!" : "Copy Labels JSON"}
        </button>
        <button
          onClick={handleReset}
          className="rounded border border-f1-border px-4 py-2 text-sm font-medium text-f1-text hover:bg-f1-surface"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
