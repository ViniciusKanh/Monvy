const TABS = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'statements', label: 'Extratos' },
  { key: 'movements', label: 'Movimentações' },
  { key: 'transfers', label: 'Transferências' },
  { key: 'reconciliation', label: 'Conciliação' },
];

export function AccountsNavigation({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))] -mx-1 px-1">
      {TABS.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`shrink-0 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${active === t.key
            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
            : 'border-transparent text-muted hover:text-[hsl(var(--text))]'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
