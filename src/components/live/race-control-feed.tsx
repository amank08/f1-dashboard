"use client";

import { format, parseISO } from "date-fns";
import { Flag, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import type { RaceControlMessage } from "@/lib/openf1/types";
import { cn } from "@/lib/utils/cn";

function getFlagColor(flag: string | null): string {
  switch (flag) {
    case "RED":
      return "text-red-500 bg-red-500/10";
    case "YELLOW":
    case "DOUBLE YELLOW":
      return "text-yellow-400 bg-yellow-400/10";
    case "GREEN":
      return "text-green-400 bg-green-400/10";
    case "BLUE":
      return "text-blue-400 bg-blue-400/10";
    case "BLACK AND WHITE":
      return "text-gray-300 bg-gray-300/10";
    case "CHEQUERED":
      return "text-white bg-white/10";
    default:
      return "text-f1-text-secondary bg-f1-card";
  }
}

function getIcon(category: string, flag: string | null) {
  if (flag === "RED" || flag === "YELLOW" || flag === "DOUBLE YELLOW")
    return <AlertTriangle size={14} />;
  if (category === "Penalty" || category === "Decision")
    return <ShieldAlert size={14} />;
  if (category === "Flag") return <Flag size={14} />;
  return <Info size={14} />;
}

export function RaceControlFeed({
  messages,
}: {
  messages: RaceControlMessage[];
}) {
  const sorted = [...messages].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-f1-border bg-f1-surface p-4 text-center text-sm text-f1-text-muted">
        No race control messages
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
      {sorted.slice(0, 50).map((msg, i) => (
        <div
          key={`${msg.date}-${i}`}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-f1-border p-3 text-sm",
            getFlagColor(msg.flag)
          )}
        >
          <div className="mt-0.5 shrink-0">{getIcon(msg.category, msg.flag)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium leading-snug">{msg.message}</p>
            <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
              <span>{format(parseISO(msg.date), "HH:mm:ss")}</span>
              {msg.lap_number && <span>Lap {msg.lap_number}</span>}
              {msg.category && (
                <span className="rounded bg-white/10 px-1.5 py-0.5">
                  {msg.category}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
