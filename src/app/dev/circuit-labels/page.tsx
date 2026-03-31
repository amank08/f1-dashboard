"use client";

import { useState } from "react";
import { CIRCUIT_PATHS } from "@/lib/data/circuit-paths";
import { PageHeader } from "@/components/layout/page-header";
import { LabelEditor } from "@/components/dev/label-editor";

const circuitKeys = Object.keys(CIRCUIT_PATHS).sort();

export default function CircuitLabelsPage() {
  const [selectedCircuit, setSelectedCircuit] = useState(circuitKeys[0]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="Circuit Label Editor"
        subtitle="Drag labels to reposition, then copy the JSON back into circuit-paths.ts"
      />
      <select
        value={selectedCircuit}
        onChange={(e) => setSelectedCircuit(e.target.value)}
        className="rounded border border-f1-border bg-f1-surface px-3 py-2 text-sm text-f1-text"
      >
        {circuitKeys.map((key) => (
          <option key={key} value={key}>
            {key} — {CIRCUIT_PATHS[key].name}
          </option>
        ))}
      </select>
      <LabelEditor circuitKey={selectedCircuit} />
    </div>
  );
}
