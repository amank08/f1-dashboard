import { cn } from "@/lib/utils/cn";

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-f1-border bg-f1-surface p-12 text-center",
        className
      )}
    >
      <p className="text-lg font-semibold text-f1-text-secondary">{title}</p>
      {description && (
        <p className="mt-2 text-sm text-f1-text-muted">{description}</p>
      )}
    </div>
  );
}
