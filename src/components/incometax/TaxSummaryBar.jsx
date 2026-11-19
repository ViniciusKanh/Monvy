import { Wallet, TrendingUp, Landmark, ArrowUpRight, Calculator } from 'lucide-react';
import { Card, Badge } from '../ui';
import { formatCurrency } from '../../lib/utils.js';

// Resumo fixo, no topo da declaracao — como no painel "Meu Imposto de Renda"
// do e-CAC: sempre visivel, com os numeros reais do periodo selecionado.
// O imposto estimado so aparece quando a Estimativa anual foi preenchida —
// nunca inventamos um valor, e nunca afirmamos "a restituir" (isso depende
// do IRRF retido na fonte, que o Monvy nao rastreia).
export function TaxSummaryBar({ org, rAnual, anualFilled }) {
  const dedTotal = org.ded.saude + org.ded.educacao + org.ded.previdencia + org.ded.outras;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[hsl(var(--border))]">
        <div className="p-4"><p className="text-[11px] text-muted flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Rendimentos</p><p className="font-display text-lg font-bold text-emerald-500 truncate">{formatCurrency(org.rendimentos)}</p></div>
        <div className="p-4"><p className="text-[11px] text-muted flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Deduções identificadas</p><p className="font-display text-lg font-bold truncate">{formatCurrency(dedTotal)}</p></div>
        <div className="p-4"><p className="text-[11px] text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Bens e direitos</p><p className="font-display text-lg font-bold truncate">{formatCurrency(org.bens)}</p></div>
        <div className="p-4"><p className="text-[11px] text-muted flex items-center gap-1"><Landmark className="w-3 h-3" /> Dívidas e ônus</p><p className="font-display text-lg font-bold text-rose-500 truncate">{formatCurrency(org.dividas)}</p></div>
        <div className="p-4 bg-black/[.02] dark:bg-white/[.02]">
          <p className="text-[11px] text-muted flex items-center gap-1"><Calculator className="w-3 h-3" /> Imposto estimado (anual)</p>
          {anualFilled ? (
            <p className="font-display text-lg font-bold text-rose-500 truncate">{formatCurrency(rAnual.imposto)}</p>
          ) : (
            <p className="text-xs text-muted mt-1">Preencha a <b>Estimativa anual</b></p>
          )}
        </div>
      </div>
      {anualFilled && (
        <div className="px-4 py-2 border-t border-[hsl(var(--border))] flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-muted">Opção mais vantajosa: <Badge color="emerald">{rAnual.melhor === 'simplificado' ? 'Desconto simplificado' : 'Deduções legais'}</Badge></span>
          <span className="text-xs text-muted">Alíquota efetiva estimada: <b className="text-[hsl(var(--text))]">{rAnual.aliquotaEfetiva.toFixed(2)}%</b></span>
        </div>
      )}
    </Card>
  );
}
