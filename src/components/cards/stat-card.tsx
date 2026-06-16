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
        "linear-surface surface-sheen rounded-2xl p-4 transition duration-300 ease-premium hover:-translate-y-0.5",
        className
      )}
    >
      <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.16em] text-f1-text-muted">
        {label}
      </p>
      <p className="relative z-10 mt-2 text-2xl font-semibold tracking-normal text-f1-text">{value}</p>
      {sublabel && (
        <p className="relative z-10 mt-1 text-sm text-f1-text-secondary">{sublabel}</p>
      )}
    </div>
  );
}
