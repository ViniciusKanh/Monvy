export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
          <div className="h-1 w-12 rounded-full mt-2.5 bg-gradient-to-r from-emerald-500 to-indigo-500" />
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
