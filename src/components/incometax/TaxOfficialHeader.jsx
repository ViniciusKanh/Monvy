import { Info, ShieldCheck, Settings2 } from 'lucide-react';
import { Select } from '../ui';
import { TaxDocArt } from '../art/PageArt.jsx';

// Cabeçalho com estrutura de declaração formal (sem marca/identidade visual do
// gov.br — só a marca do próprio Monvy), deixando claro que é uma ESTIMATIVA de
// apoio, não o programa oficial da Receita.
export function TaxOfficialHeader({ year, years, onYear, onToggleCfg, dataComplete }) {
  return (
    <section className="relative overflow-hidden rounded-3xl ring-1 ring-cyan-400/40 shadow-[0_0_40px_-14px_rgba(34,211,238,.55)] bg-[hsl(var(--card))]" style={{ backgroundImage: 'radial-gradient(70% 140% at 0% 0%,rgba(14,165,233,.22),transparent),radial-gradient(60% 140% at 100% 100%,rgba(168,85,247,.22),transparent)' }}>
      <svg className="absolute inset-x-0 bottom-10 w-full h-24 pointer-events-none opacity-40" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden><path d="M0 50 C100 10 200 60 400 12" stroke="#22d3ee" strokeWidth="1.5" fill="none" /><path d="M0 58 C120 30 240 70 400 26" stroke="#a855f7" strokeWidth="1.2" fill="none" /></svg>
      <div className="relative px-5 sm:px-7 pt-5 pb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.22em] text-cyan-600 dark:text-cyan-300 font-bold">DECLARAÇÃO DE AJUSTE ANUAL — ESTIMATIVA</p>
          <h1 className="font-display text-2xl sm:text-[2.2rem] font-extrabold leading-tight mt-1">Exercício <span className="text-cyan-500 dark:text-cyan-300">{year + 1}</span> — ano-calendário <span className="text-fuchsia-500 dark:text-fuchsia-400">{year}</span></h1>
          <p className="text-sm text-muted mt-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-400" />{dataComplete ? 'Estimativa calculada com seus lançamentos reais.' : 'Preencha a Estimativa anual para calcular o imposto estimado.'}</p>
        </div>
        <TaxDocArt className="hidden lg:block w-56 h-32 -my-2 opacity-90" />
        <div className="flex items-center gap-2">
          <Select value={year} onChange={(e) => onYear(Number(e.target.value))} className="w-auto" aria-label="Ano-calendário">{years.map((y) => <option key={y} value={y}>Ano {y}</option>)}</Select>
          <button onClick={onToggleCfg} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-cyan-400/50 bg-cyan-500/10 hover:bg-cyan-500/20"><Settings2 className="w-4 h-4" />Tabela</button>
        </div>
      </div>
      <div className="relative mx-4 sm:mx-6 mb-4 px-4 py-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/40">
        <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Ferramenta de apoio — não substitui o programa oficial da Receita (PGD) nem orientação contábil. As tabelas usam a base 2024/2025; confira e ajuste em "Tabela" os valores vigentes do ano.</p>
      </div>
    </section>
  );
}
