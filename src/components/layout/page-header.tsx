export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="linear-surface rounded-2xl p-5 backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
      <div className="relative z-10">
        <h1 className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-f1-text-secondary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="relative z-10 mt-3 sm:mt-0">{actions}</div>}
    </div>
  );
}
