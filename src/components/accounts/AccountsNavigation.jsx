const TABS = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'statements', label: 'Extratos' },
  { key: 'movements', label: 'Movimentações' },
  { key: 'transfers', label: 'Transferências' },
  { key: 'reconciliation', label: 'Conciliação' },
];

export function AccountsNavigation({ active, onChange }) {
  return (
    <div role="tablist" className="flex gap-2 overflow-x-auto border-b border-[hsl(var(--border))] -mx-1 px-1">
      {TABS.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => onChange(t.key)}
          className={`relative shrink-0 px-5 py-3 text-sm font-medium transition ${active === t.key
            ? 'text-[hsl(var(--text))] font-semibold'
            : 'text-muted hover:text-[hsl(var(--text))]'}`}>
          {t.label}
          {active === t.key && <span className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(45,212,191,.6)]" />}
        </button>
      ))}
    </div>
  );
}
