"use client";

import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "red" | "green" | "yellow" | "blue";

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-white/[0.08] bg-white/[0.05] text-f1-text-secondary",
  red: "border-red-400/20 bg-red-500/10 text-red-300 shadow-[0_0_24px_rgba(248,113,113,0.08)]",
  green: "border-emerald-300/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.08)]",
  yellow: "border-yellow-300/20 bg-yellow-400/10 text-yellow-200 shadow-[0_0_24px_rgba(250,204,21,0.08)]",
  blue: "border-f1-accent/25 bg-f1-accent/10 text-f1-accent shadow-[0_0_24px_rgba(110,162,244,0.10)]",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
