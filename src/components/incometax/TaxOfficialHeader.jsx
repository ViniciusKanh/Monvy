import { Landmark, Info, ShieldCheck } from 'lucide-react';
import { Select, Button } from '../ui';
import { Settings2 } from 'lucide-react';

// Cabecalho com cara de declaracao oficial (sem usar marca/identidade visual
// real do gov.br — e so uma estrutura de documento formal com a marca do
// proprio Monvy), deixando claro que e uma ESTIMATIVA de apoio, nao o
// programa oficial da Receita.
export function TaxOfficialHeader({ year, years, onYear, showCfg, onToggleCfg, dataComplete }) {
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-[hsl(var(--border))]">
      <div className="relative px-5 py-4 sm:px-6 sm:py-5 text-white" style={{ background: 'linear-gradient(120deg,#0b3d78,#0f172a 75%)' }}>
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Landmark className="w-5 h-5" /></span>
            <div>
              <p className="text-[10px] tracking-[0.2em] text-sky-300/90 font-semibold">DECLARAÇÃO DE AJUSTE ANUAL · ESTIMATIVA</p>
              <h1 className="font-display text-lg sm:text-xl font-bold leading-tight">Exercício {year + 1} — ano-calendário {year}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={year} onChange={(e) => onYear(Number(e.target.value))} className="w-auto bg-white/10 border-white/20 text-white [&>option]:text-slate-900">
              {years.map((y) => <option key={y} value={y}>Ano {y}</option>)}
            </Select>
            <Button variant="outline" onClick={onToggleCfg} className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20"><Settings2 className="w-4 h-4" /> Tabela</Button>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-2 text-[11px] text-sky-200/90">
          <ShieldCheck className="w-3.5 h-3.5" />
          {dataComplete ? 'Estimativa calculada com seus lançamentos reais.' : 'Preencha a Estimativa anual para calcular o valor estimado.'}
        </div>
      </div>
      <div className="px-5 py-2.5 sm:px-6 bg-amber-500/10 border-t border-amber-500/20">
        <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Ferramenta de apoio — não substitui o programa oficial da Receita (PGD) nem orientação contábil. As tabelas usam a base 2024/2025; confira e ajuste em "Tabela" os valores vigentes do ano.
        </p>
      </div>
    </div>
  );
}
