"use client";

import { cn } from "@/lib/utils/cn";

export function Tabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-f1-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === tab.key
              ? "bg-f1-red text-white"
              : "text-f1-text-secondary hover:text-f1-text"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
