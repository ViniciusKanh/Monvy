import { Database, Percent, Briefcase, Layers, Calculator } from 'lucide-react';
import { DeltaChip } from '../kit.jsx';
import { formatCurrency } from '../../lib/utils.js';

// Resumo fixo no topo da declaração, com os números reais do período.
// O imposto estimado só aparece quando a Estimativa anual foi preenchida —
// nunca inventamos um valor, nem afirmamos "a restituir" (depende do IRRF
// retido na fonte, que o Monvy não rastreia).
const ITEMS = [
  ['Rendimentos', Database, '#34d399', 'ring-emerald-400/40', 'rgba(16,185,129,.16)'],
  ['Deduções identificadas', Percent, '#a78bfa', 'ring-violet-400/40', 'rgba(139,92,246,.16)'],
  ['Bens e direitos', Briefcase, '#2dd4bf', 'ring-teal-400/40', 'rgba(20,184,166,.16)'],
  ['Dívidas e ônus', Layers, '#fb7185', 'ring-rose-400/40', 'rgba(244,63,94,.16)'],
  ['Imposto estimado (anual)', Calculator, '#e879f9', 'ring-fuchsia-400/40', 'rgba(217,70,239,.16)'],
];
export function TaxSummaryBar({ org, rAnual, anualFilled }) {
  const dedTotal = org.ded.saude + org.ded.educacao + org.ded.previdencia + org.ded.outras;
  const vals = [org.rendimentos, dedTotal, org.bens, org.dividas, anualFilled ? rAnual.imposto : null];
  const delta = org.rendPrev > 0 ? ((org.rendimentos - org.rendPrev) / org.rendPrev) * 100 : null;
  return (
    <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] p-3 sm:p-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {ITEMS.map(([l, Ic, c, ring, bg], i) => (
          <div key={l} className={`rounded-2xl ring-1 ${ring} p-3 flex items-center gap-3 min-w-0`} style={{ backgroundImage: `linear-gradient(135deg,${bg},transparent 70%)` }}>
            <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${c}26`, color: c }}><Ic className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted truncate">{l}</p>
              {vals[i] == null ? <p className="text-xs text-muted mt-0.5">Preencha a <b>Estimativa anual</b></p>
                : <p className="font-display text-lg font-bold truncate" style={{ color: i >= 3 ? c : undefined }}>{formatCurrency(vals[i])}</p>}
            </div>
            {i === 0 && delta != null && <DeltaChip v={delta} className="self-start" />}
          </div>
        ))}
      </div>
      <div className="mt-3 px-1 flex items-center justify-between flex-wrap gap-2 text-sm">
        <span className="text-muted">Opção mais vantajosa: {anualFilled ? <span className="ml-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-1 ring-sky-400/40">{rAnual.melhor === 'simplificado' ? 'Desconto simplificado' : 'Deduções legais'}</span> : <span className="text-xs">— (após a Estimativa anual)</span>}</span>
        <span className="text-muted">Alíquota efetiva estimada: <b className="ml-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[hsl(var(--text))]">{anualFilled ? `${rAnual.aliquotaEfetiva.toFixed(2).replace('.', ',')}%` : '—'}</b></span>
      </div>
    </section>
  );
}
