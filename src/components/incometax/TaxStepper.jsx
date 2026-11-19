import { Check } from 'lucide-react';

// Navegacao em formato de "etapas da declaracao" (como um wizard oficial),
// com indicador real de preenchimento por secao — sem inventar progresso,
// so reflete se ha dado real naquela aba.
export function TaxStepper({ steps, active, onChange, filled }) {
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {steps.map((s, i) => {
        const isActive = active === s.id;
        const isFilled = !!filled[s.id];
        const Icon = s.icon;
        return (
          <button key={s.id} onClick={() => onChange(s.id)}
            className={`group relative flex-1 min-w-[132px] flex items-center gap-2.5 px-4 py-3 text-left transition border-b-2 ${isActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent hover:bg-black/[.02] dark:hover:bg-white/[.03]'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? 'bg-emerald-500 text-white' : isFilled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-black/5 dark:bg-white/10 text-muted'}`}>
              {isFilled && !isActive ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-tight truncate ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{s.label}</p>
              <p className="text-[10px] text-muted leading-tight truncate hidden sm:block">{s.hint}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
