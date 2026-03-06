"use client";

import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "red" | "green" | "yellow" | "blue";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-f1-card text-f1-text-secondary",
  red: "bg-red-900/50 text-red-400",
  green: "bg-green-900/50 text-green-400",
  yellow: "bg-yellow-900/50 text-yellow-400",
  blue: "bg-blue-900/50 text-blue-400",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
