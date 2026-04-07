import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  sublabel,
  className,
}: {
  label: string;
  value: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-f1-border bg-f1-surface p-4",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-f1-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sublabel && (
        <p className="mt-0.5 text-sm text-f1-text-secondary">{sublabel}</p>
      )}
    </div>
  );
}
