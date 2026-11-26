import { Check } from 'lucide-react';

// Etapas da declaração (como um assistente oficial). O "check" só reflete se há
// dado real naquela aba — nunca inventa progresso.
export function TaxStepper({ steps, active, onChange, filled }) {
  return (
    <nav className="flex items-stretch overflow-x-auto rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 gap-1" aria-label="Etapas">
      {steps.map((s, i) => {
        const on = active === s.id; const ok = !!filled[s.id]; const Icon = s.icon;
        return (
          <button key={s.id} onClick={() => onChange(s.id)} aria-current={on ? 'step' : undefined}
            className={`relative flex-1 min-w-[170px] flex items-center gap-3 px-4 py-2.5 text-left rounded-xl transition ${on ? 'bg-sky-500/15 ring-1 ring-sky-400/60 shadow-[0_0_20px_-4px_rgba(56,189,248,.55)]' : 'hover:bg-black/[.03] dark:hover:bg-white/[.04]'}`}
            style={on ? { clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)' } : undefined}>
            <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${on ? 'bg-sky-500 text-white' : ok ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-black/5 dark:bg-white/10 text-muted'}`}>{ok && !on ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
            <Icon className={`w-6 h-6 shrink-0 ${on ? 'text-sky-400' : 'text-muted'}`} />
            <span className="min-w-0"><span className={`block text-sm font-semibold leading-tight truncate ${on ? 'text-sky-700 dark:text-sky-200' : ''}`}>{s.label}</span><span className="block text-[11px] text-muted leading-tight truncate">{s.hint}</span></span>
            {i < steps.length - 1 && !on && <span className="absolute right-0 top-1/4 h-1/2 w-px bg-[hsl(var(--border))]" />}
          </button>
        );
      })}
    </nav>
  );
}
