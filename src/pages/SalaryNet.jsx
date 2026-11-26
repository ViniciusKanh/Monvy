import { useEffect, useMemo, useState } from 'react';
import { Input } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, Donut, GlowButton } from '../components/kit.jsx';
import { PayslipBank } from '../components/payslips/PayslipBank.jsx';
import { PayslipArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { DEFAULT_TAX, aplicarTabela } from '../lib/tax.js';
import { Wallet, Receipt, ShieldCheck, Layers, Calculator, Settings2, Banknote, Users, Tag, Info, BarChart3, PieChart, Equal, FolderOpen, Scale, X } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const money = (v) => formatCurrency(v);
const pct = (v, d = 2) => `${(Number.isFinite(v) ? v : 0).toFixed(d).replace('.', ',')}%`;
const LS = 'monvy_salary_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
// INSS 2025 (tabela progressiva mensal)
const INSS_FAIXAS = [
  { ate: 1518.00, aliq: 0.075 },
  { ate: 2793.88, aliq: 0.09 },
  { ate: 4190.83, aliq: 0.12 },
  { ate: 8157.41, aliq: 0.14 },
];
function calcINSS(bruto) {
  let ant = 0, inss = 0;
  for (const f of INSS_FAIXAS) {
    if (bruto > ant) { const base = Math.min(bruto, f.ate) - ant; inss += base * f.aliq; ant = f.ate; }
  }
  return Math.min(inss, INSS_FAIXAS[INSS_FAIXAS.length - 1].ate * 0.14); // teto
}

export default function SalaryNet() {
  const init = load() || {};
  const [bruto, setBruto] = useState(init.bruto ?? '3000');
  const [dep, setDep] = useState(init.dep ?? '0');
  const [outros, setOutros] = useState(init.outros ?? '');
  useEffect(() => { if (window.location.hash === '#holerites') setTimeout(() => document.getElementById('holerites')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }, []);
  const [slip, setSlip] = useState(null); // holerite usado na simulação (conferência real × calculado)
  const persist = (o) => { try { localStorage.setItem(LS, JSON.stringify({ bruto, dep, outros, ...o })); } catch { /* */ } };

  const r = useMemo(() => {
    const b = Math.max(0, n(bruto));
    const inss = calcINSS(b);
    const baseIR = Math.max(0, b - inss - Math.max(0, n(dep)) * DEFAULT_TAX.deducaoDependenteMensal);
    const irNormal = aplicarTabela(baseIR, DEFAULT_TAX.mensal).imposto;
    const irSimpl = aplicarTabela(Math.max(0, b - inss - DEFAULT_TAX.descontoSimplificadoMensal), DEFAULT_TAX.mensal).imposto;
    const irrf = Math.min(irNormal, irSimpl);
    const out = Math.max(0, n(outros));
    const desc = inss + irrf + out;
    const liquido = Math.max(0, b - desc);
    return { b, inss, irrf, out, desc, liquido, baseIR, modo: irSimpl < irNormal ? 'simplificado' : 'normal', aliqEfetiva: b > 0 ? desc / b : 0 };
  }, [bruto, dep, outros]);
  const p = (v) => (r.b > 0 ? (v / r.b) * 100 : 0);
  const recebe = p(r.liquido);

  const inputs = [
    ['Salário bruto (R$)', bruto, (v) => { setBruto(v); persist({ bruto: v }); }, Banknote, '#34d399', ''],
    ['Dependentes', dep, (v) => { setDep(v); persist({ dep: v }); }, Users, '#38bdf8', ''],
    ['Outros descontos (R$)', outros, (v) => { setOutros(v); persist({ outros: v }); }, Tag, '#c084fc', 'VT, VA, plano...'],
  ];
  const cards = [
    { l: 'INSS', v: r.inss, icon: ShieldCheck, c: '#f472b6', ring: 'ring-pink-400/40', bg: 'linear-gradient(135deg,rgba(236,72,153,.18),transparent 70%)' },
    { l: 'IRRF', v: r.irrf, icon: Receipt, c: '#38bdf8', ring: 'ring-sky-400/40', bg: 'linear-gradient(135deg,rgba(14,165,233,.18),transparent 70%)' },
    { l: 'Outros descontos', v: r.out, icon: Layers, c: '#a78bfa', ring: 'ring-violet-400/40', bg: 'linear-gradient(135deg,rgba(139,92,246,.18),transparent 70%)' },
    { l: 'Total de descontos', v: r.desc, icon: Calculator, c: '#f472b6', ring: 'ring-fuchsia-400/50', bg: 'linear-gradient(135deg,rgba(217,70,239,.22),transparent 70%)' },
  ];
  const rows = [
    [Wallet, 'Salário bruto', r.b, null],
    [ShieldCheck, '(−) INSS', -r.inss, 'text-rose-500 dark:text-rose-400'],
    [Receipt, '(−) IRRF', -r.irrf, 'text-rose-500 dark:text-rose-400'],
    [Tag, '(−) Outros descontos', -r.out, 'text-rose-500 dark:text-rose-400'],
  ];
  const useSlip = (h) => {
    const v = { bruto: String(h.gross || 0), dep: String(h.dependents || 0), outros: String(h.other_deductions || '') };
    setBruto(v.bruto); setDep(v.dep); setOutros(v.outros); persist(v); setSlip(h);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const conf = slip ? [
    ['INSS', Number(slip.inss) || 0, r.inss],
    ['IRRF', Number(slip.irrf) || 0, r.irrf],
    ['Líquido', Number(slip.net) || 0, r.liquido],
  ] : [];
  const descParts = [['INSS', r.inss, '#ec4899'], ['IRRF', r.irrf, '#3b82f6'], ['Outros', r.out, '#a855f7']];

  return (
    <div className="space-y-5 animate-fadeIn" style={{ '--art-right': '190px' }}>
      <HeroTitle icon={Wallet} lead="Salário Líquido" accent="(CLT)" iconClass="text-sky-400" subtitle="Calcule quanto cai na conta e guarde seus holerites por empresa — a IA lê e preenche."
        art={<PayslipArt className="w-80 h-36 opacity-90" />}
        actions={<GlowButton tone="violet" onClick={() => document.getElementById('holerites')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FolderOpen className="w-4 h-4" /> Meus holerites</GlowButton>} />

      {slip && (
        <Panel tone="sky" title={`Holerite × cálculo — ${slip.company}, ${monthLabel(slip.competence)}`} subtitle="Compara o que a empresa descontou com o cálculo pelas tabelas oficiais." icon={Scale} iconClass="text-sky-400"
          action={<button onClick={() => setSlip(null)} className="p-1.5 rounded-lg text-muted hover:bg-black/5 dark:hover:bg-white/10" aria-label="Fechar conferência"><X className="w-4 h-4" /></button>}>
          <div className="grid sm:grid-cols-3 gap-3">
            {conf.map(([l, real, calc]) => {
              const d = real - calc; const ok = Math.abs(d) <= Math.max(1, calc * 0.01);
              return (
                <div key={l} className={`rounded-2xl p-3.5 ring-1 ${ok ? 'ring-emerald-400/40 bg-emerald-500/5' : 'ring-amber-400/50 bg-amber-500/5'}`}>
                  <p className="text-xs text-muted">{l}</p>
                  <p className="text-sm mt-1 flex justify-between"><span>No holerite</span><b>{money(real)}</b></p>
                  <p className="text-sm flex justify-between"><span>Calculado</span><b>{money(calc)}</b></p>
                  <p className={`text-xs font-semibold mt-1 ${ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>{ok ? 'Confere ✓' : `Diferença de ${money(Math.abs(d))}`}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-3 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Diferenças são normais quando há horas extras, faltas, férias, 13º, pensão ou rubricas fora da base de cálculo. O cálculo usa as tabelas de referência abaixo.</p>
        </Panel>
      )}

      <Panel tone="violet" title="Simulação do salário" icon={Settings2} iconClass="text-violet-400">
        <div className="grid sm:grid-cols-3 gap-4">
          {inputs.map(([l, v, set, Ic, c, ph]) => (
            <div key={l} className="flex items-end gap-3">
              <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0 ring-1" style={{ background: `${c}22`, color: c, '--tw-ring-color': `${c}55` }}><Ic className="w-6 h-6" /></span>
              <div className="flex-1 min-w-0"><label className="text-sm font-medium">{l}</label><Input type="number" min="0" value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="mt-1 h-11" /></div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Tabelas de referência 2025. Não inclui FGTS (é depositado pelo empregador, não descontado). O IR usa a opção mais vantajosa (normal × simplificado) — aqui: <b className="text-[hsl(var(--text))]">{r.modo}</b>.</p>
      </Panel>

      <section className="relative overflow-hidden rounded-3xl ring-1 ring-emerald-400/50 shadow-[0_0_40px_-12px_rgba(52,211,153,.6)] p-5 sm:p-6 bg-[hsl(var(--card))]" style={{ backgroundImage: 'linear-gradient(120deg,rgba(16,185,129,.28),rgba(6,78,59,.12) 55%,rgba(14,165,233,.12))' }}>
        <svg className="absolute right-0 bottom-0 w-2/3 h-full pointer-events-none opacity-40" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden><path d="M0 110 C120 90 180 20 400 10" stroke="#5eead4" strokeWidth="2" fill="none" /><path d="M0 120 C140 100 200 40 400 30" stroke="#a78bfa" strokeWidth="1.5" fill="none" /></svg>
        <div className="relative flex flex-col md:flex-row md:items-center gap-5">
          <span className="w-16 h-16 rounded-2xl bg-emerald-500/25 ring-1 ring-emerald-300/50 grid place-items-center shrink-0"><Wallet className="w-8 h-8 text-emerald-300" /></span>
          <div className="flex-1 min-w-0 md:pl-5 md:border-l border-emerald-400/30">
            <p className="text-sm font-semibold">Salário líquido estimado</p>
            <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight"><AnimatedValue value={r.liquido} format={money} /></p>
            <p className="text-sm text-muted mt-1">de {money(r.b)} bruto · alíquota efetiva de descontos <span className="ml-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">{pct(r.aliqEfetiva * 100, 1)}</span></p>
          </div>
          <div className="rounded-2xl ring-1 ring-emerald-400/50 px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.06)), hsl(var(--card) / .9)" }}>
            <BarChart3 className="w-9 h-9 text-emerald-400" />
            <div><p className="text-xs text-muted">Você recebe</p><p className="font-display text-3xl font-extrabold text-emerald-500 dark:text-emerald-300">{pct(recebe, 1)}</p><p className="text-xs text-muted">do salário bruto</p></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.l} className={`rounded-2xl ring-1 ${c.ring} bg-[hsl(var(--card))] p-4 flex items-center gap-3`} style={{ backgroundImage: c.bg }}>
            <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${c.c}26`, color: c.c }}><c.icon className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-xs text-muted">{c.l}</p><p className="font-display text-xl font-bold truncate" style={{ color: c.v > 0 ? c.c : undefined }}>{money(c.v)}</p></div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 shrink-0" style={{ color: c.c, '--tw-ring-color': `${c.c}66` }}>{pct(p(c.v))}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel tone="violet" title="Composição" subtitle="Detalhamento da composição do salário (CLT)" icon={Layers} iconClass="text-violet-400">
          <div className="divide-y divide-[hsl(var(--border))]">
            {rows.map(([Ic, l, v, cls]) => (
              <div key={l} className="flex items-center gap-3 py-2.5 text-sm"><Ic className="w-4 h-4 text-muted shrink-0" /><span className="flex-1">{l}</span><b className={cls || ''}>{v < 0 ? `-${money(-v)}` : money(v)}</b><span className="w-20 text-right text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">{pct(p(Math.abs(v)))}</span></div>
            ))}
          </div>
          <div className="mt-2 rounded-2xl ring-1 ring-emerald-400/60 bg-emerald-500/10 shadow-[0_0_20px_-8px_rgba(52,211,153,.6)] px-4 py-3 flex items-center gap-3"><Equal className="w-5 h-5 text-emerald-400" /><b className="flex-1 text-lg">(=) Líquido</b><b className="font-display text-xl text-emerald-600 dark:text-emerald-300">{money(r.liquido)}</b><span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{pct(recebe)}</span></div>
          <p className="mt-3 text-xs rounded-xl ring-1 ring-sky-400/40 bg-sky-500/10 px-3 py-2"><Info className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-sky-400" /><b>Resumo:</b> dos {money(r.b)} brutos, são descontados {money(r.desc)} ({pct(r.aliqEfetiva * 100, 1)}), resultando em <b className="text-emerald-600 dark:text-emerald-300">{money(r.liquido)}</b> líquidos.</p>
        </Panel>

        <Panel tone="sky" title="Distribuição do salário" subtitle="Proporção do salário bruto entre valor líquido e descontos." icon={PieChart} iconClass="text-cyan-400">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Donut size={200} thickness={0.2} data={[{ name: 'Salário líquido', value: r.liquido, color: '#34d399' }, { name: 'Descontos', value: r.desc, color: '#ec4899' }]} center={<><b className="font-display text-lg">{money(r.b)}</b><span className="text-xs text-muted">Salário bruto</span></>} />
            <div className="flex-1 w-full space-y-3">
              {[['Salário líquido', r.liquido, '#34d399'], ['Total de descontos', r.desc, '#ec4899']].map(([l, v, c]) => (
                <div key={l} className="flex items-center gap-2 text-sm"><i className="w-3 h-3 rounded-sm" style={{ background: c }} /><span className="flex-1">{l}</span><b>{money(v)}</b><span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 w-14 text-center">{pct(p(v), 1)}</span></div>
              ))}
              <div className="pt-3 border-t border-[hsl(var(--border))]">
                <p className="text-sm font-semibold mb-2">Composição dos descontos ({money(r.desc)})</p>
                <div className="flex h-3 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">{descParts.map(([l, v, c]) => r.desc > 0 && v > 0 && <div key={l} style={{ width: `${(v / r.desc) * 100}%`, background: c }} title={l} />)}</div>
                <div className="mt-2 space-y-1 text-xs">{descParts.map(([l, v, c]) => <p key={l} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="text-muted w-12">{l}:</span><b>{money(v)}</b><span className="text-muted">({pct(p(v))})</span></p>)}</div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <PayslipBank onSimulate={useSlip} simulated={slip ? `Simulação preenchida com o holerite de ${monthLabel(slip.competence)} (${slip.company}).` : ''} />
    </div>
  );
}
