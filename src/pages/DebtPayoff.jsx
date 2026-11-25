import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Debt, Transaction } from '../api/entities.js';
import { Input, Field, Select, Spinner } from '../components/ui';
import { HeroTitle, MetricStrip, Metric, Panel, GlowButton, InsightsPanel, TIP, pct1 } from '../components/kit.jsx';
import { ChecklistArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  Landmark, Coins, CalendarDays, Hourglass, TrendingUp, TrendingDown, Target, Mountain, ChevronRight, Calculator, Play, ArrowRight, Zap, Trophy,
  MapPin, BarChart3, CheckCircle2, Crown, Share2, Rocket, ShieldCheck, Snowflake, CircleDot,
} from 'lucide-react';

const num = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthAhead = (k) => { const d = new Date(); d.setMonth(d.getMonth() + k); return `${MES[d.getMonth()]}/${d.getFullYear()}`; };

// Simula a quitação mês a mês: todas as parcelas são pagas e o que sobra (parcelas liberadas + extra) vai para a dívida em foco
function simulate(debts, strategy, extra) {
  const list = debts.filter((d) => d.balance > 0.5).map((d) => ({ ...d, bal: d.balance, i: d.rate / 100 }));
  if (!list.length) return { months: 0, totalPaid: 0, totalInterest: 0, order: [], series: [{ m: 0, saldo: 0 }], payoff: {}, quita: true };
  const order = [...list].sort((a, b) => (strategy === 'avalanche' ? b.rate - a.rate || a.bal - b.bal : a.bal - b.bal || b.rate - a.rate)).map((d) => d.id);
  const budget = list.reduce((s, d) => s + d.parcela, 0) + num(extra);
  const byId = Object.fromEntries(list.map((d) => [d.id, d]));
  let months = 0, totalPaid = 0, totalInterest = 0; const series = [{ m: 0, saldo: list.reduce((s, d) => s + d.bal, 0) }]; const payoff = {};
  while (list.some((d) => d.bal > 0.5) && months < 600) {
    months++;
    for (const d of list) if (d.bal > 0.5) { const j = d.bal * d.i; d.bal += j; totalInterest += j; }
    let avail = budget;
    for (const d of list) if (d.bal > 0.5) { const p = Math.min(d.bal, d.parcela, avail); d.bal -= p; avail -= p; totalPaid += p; }
    for (const id of order) { const d = byId[id]; if (d.bal <= 0.5 || avail <= 0.01) continue; const p = Math.min(d.bal, avail); d.bal -= p; avail -= p; totalPaid += p; }
    for (const d of list) if (d.bal <= 0.5 && !payoff[d.id]) payoff[d.id] = months;
    series.push({ m: months, saldo: Math.max(0, list.reduce((s, d) => s + Math.max(0, d.bal), 0)) });
  }
  return { months, totalPaid, totalInterest, order, series, payoff, quita: !list.some((d) => d.bal > 0.5) };
}
// Cenário sem estratégia: cada dívida segue só com a própria parcela até o fim
const baselineInterest = (debts) => debts.reduce((s, d) => s + Math.max(0, d.parcela * d.remaining - d.balance), 0);

const STEPS = [
  { key: 'plan', label: 'Planejamento', sub: 'Definir estratégia', icon: MapPin },
  { key: 'exec', label: 'Execução', sub: 'Pagar as parcelas', icon: Play },
  { key: 'prog', label: 'Progresso', sub: 'Acompanhar evolução', icon: BarChart3 },
  { key: 'quit', label: 'Quitação', sub: 'Finalizar dívidas', icon: CheckCircle2 },
  { key: 'free', label: 'Liberdade', sub: 'Vida sem dívidas!', icon: Crown },
];

export default function DebtPayoff() {
  const nav = useNavigate();
  const simRef = useRef(null);
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [strategy, setStrategy] = useState('snowball');
  const [extra, setExtra] = useState('');
  const [quick, setQuick] = useState(null);
  const [qForm, setQForm] = useState(null);

  const parsed = useMemo(() => debts.map((d) => {
    const n = num(d.installments); const paid = num(d.paid_installments); const remaining = Math.max(0, n - paid);
    const rate = num(d.interest_rate); const i = rate / 100;
    const principal = num(d.principal || d.total_amount);
    const inst = num(d.installment_amount) || (i > 0 ? (principal * i) / (1 - Math.pow(1 + i, -n || -1)) : principal / (n || 1));
    const balance = i > 0 ? inst * (1 - Math.pow(1 + i, -remaining)) / i : inst * remaining;
    return { id: d.id, name: d.name, rate, parcela: inst, balance, remaining, n, paid, total: inst * n };
  }), [debts]);
  const open = parsed.filter((d) => d.balance > 0.5);

  const chosen = useMemo(() => simulate(open, strategy, extra), [open, strategy, extra]);
  const other = useMemo(() => simulate(open, strategy === 'avalanche' ? 'snowball' : 'avalanche', extra), [open, strategy, extra]);
  const totalDivida = open.reduce((s, d) => s + d.balance, 0);
  const parcelas = open.reduce((s, d) => s + d.parcela, 0);
  const economia = Math.max(0, baselineInterest(open) - chosen.totalInterest);
  const avgRate = totalDivida > 0 ? open.reduce((s, d) => s + d.rate * d.balance, 0) / totalDivida : 0;

  const renda = useMemo(() => {
    const by = {}; for (const t of transactions) if (t.type === 'income') { const m = String(t.date).slice(0, 7); by[m] = (by[m] || 0) + num(t.amount); }
    const v = Object.values(by).sort((a, b) => a - b); if (!v.length) return 0; const k = Math.floor(v.length / 2); return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
  }, [transactions]);

  const paidValue = parsed.reduce((s, d) => s + d.paid * d.parcela, 0); const totalValue = parsed.reduce((s, d) => s + d.total, 0);
  const paidPct = totalValue > 0 ? (paidValue / totalValue) * 100 : 0;
  const step = !open.length ? 4 : paidPct < 5 ? 0 : paidPct < 50 ? 1 : paidPct < 90 ? 2 : 3;

  const chart = useMemo(() => {
    const max = Math.max(chosen.series.length, other.series.length);
    const a = strategy === 'avalanche' ? chosen : other; const s = strategy === 'avalanche' ? other : chosen;
    return Array.from({ length: max }, (_, k) => ({ m: k, Avalanche: Math.round(a.series[k]?.saldo ?? 0), 'Bola de Neve': Math.round(s.series[k]?.saldo ?? 0) }));
  }, [chosen, other, strategy]);

  const qf = qForm || { total: totalDivida ? totalDivida.toFixed(2) : '0', parcela: parcelas ? parcelas.toFixed(2) : '0', taxa: avgRate ? avgRate.toFixed(2) : '0', metodo: strategy };
  const runQuick = () => {
    const sim = simulate([{ id: 'q', name: 'Total', balance: num(qf.total), parcela: num(qf.parcela), rate: num(qf.taxa), remaining: 0 }], qf.metodo, 0);
    const neverEnds = num(qf.total) > 0 && num(qf.parcela) <= num(qf.total) * (num(qf.taxa) / 100);
    setQuick({ months: neverEnds ? null : sim.months, interest: sim.totalInterest });
  };
  const quickTxt = !num(qf.total) ? 'Você já está livre!' : quick == null ? 'Clique em Simular agora' : quick.months == null ? 'Parcela não cobre os juros' : `${monthAhead(quick.months)} (${quick.months} ${quick.months === 1 ? 'mês' : 'meses'})`;

  const focus = chosen.order.length ? open.find((d) => d.id === chosen.order[0]) : null;
  const insights = !open.length ? [
    { tone: 'violet', icon: Rocket, title: 'Você já está livre de dívidas!', text: 'Mantenha esse resultado e direcione o valor que antes ia para dívidas às suas metas.', onClick: () => nav('/metas') },
    { tone: 'sky', icon: BarChart3, title: 'Fortaleça sua reserva de emergência', text: 'Conquiste mais segurança financeira para imprevistos.', onClick: () => nav('/metas') },
    { tone: 'pink', icon: Target, title: 'Defina um próximo objetivo', text: 'Use o valor livre mensal para acelerar um sonho (viagem, casa, investimento etc.).', onClick: () => nav('/objetivo') },
  ] : [
    focus && { tone: 'violet', icon: Target, title: `Foco agora: ${focus.name}`, text: `${strategy === 'avalanche' ? 'Maior juro' : 'Menor saldo'} (${formatCurrency(focus.balance)} a ${focus.rate.toFixed(2).replace('.', ',')}% a.m.). Quitada em ~${chosen.payoff[focus.id] || '—'} meses.` },
    { tone: 'emerald', icon: Coins, title: economia > 1 ? `Economia de ${formatCurrency(economia)} em juros` : 'Some um valor extra por mês', text: economia > 1 ? 'Comparado a pagar só as parcelas de cada contrato, sem redirecionar o que for liberado.' : 'Qualquer valor extra direcionado à dívida em foco reduz prazo e juros.' },
    other.totalInterest - chosen.totalInterest > 1 ? { tone: 'sky', icon: TrendingDown, title: `${strategy === 'avalanche' ? 'Avalanche' : 'Bola de Neve'} paga menos juros aqui`, text: `Diferença de ${formatCurrency(other.totalInterest - chosen.totalInterest)} para o outro método.` } : { tone: 'sky', icon: Share2, title: 'Compare os métodos', text: `${strategy === 'avalanche' ? 'Bola de Neve' : 'Avalanche'} pagaria ${formatCurrency(other.totalInterest)} de juros (atual: ${formatCurrency(chosen.totalInterest)}).`, onClick: () => setStrategy(strategy === 'avalanche' ? 'snowball' : 'avalanche') },
  ];

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const Method = ({ v, title, badge, text, icon: Ic, tone }) => (
    <button onClick={() => { setStrategy(v); setQForm((f) => ({ ...(f || qf), metodo: v })); }} className={`w-full text-left rounded-2xl ring-1 p-3.5 flex items-center gap-3 transition ${strategy === v ? `ring-2 ${tone === 'teal' ? 'ring-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(45,212,191,.25)]' : 'ring-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_20px_rgba(217,70,239,.25)]'}` : 'ring-[hsl(var(--border))] hover:ring-violet-400/40'}`}>
      <span className={`w-14 h-12 rounded-xl grid place-items-center shrink-0 ${tone === 'teal' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-violet-500/15 text-violet-400'}`}><Ic className="w-7 h-7" /></span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap"><b className="font-display text-base">{title}</b><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tone === 'teal' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-200' : 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-200'}`}>{badge}</span></span>
        <span className="block text-xs text-muted mt-0.5 leading-snug">{text}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-muted shrink-0" />
    </button>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={TrendingDown} lead="Estratégia de" accent="Quitação" iconClass="text-pink-400" subtitle="Descubra a melhor ordem para quitar suas dívidas e em quanto tempo fica livre." art={<ChecklistArt className="w-72 h-36 xl:mr-24" />} />

      <MetricStrip className="sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Coins} color="#c084fc" label="Dívida total" value={formatCurrency(totalDivida)} sub={open.length ? `${open.length} ${open.length === 1 ? 'dívida em aberto' : 'dívidas em aberto'}` : 'Sem dívidas cadastradas'} />
        <Metric icon={CalendarDays} color="#38bdf8" label="Parcelas por mês" value={formatCurrency(parcelas + num(extra))} sub={renda > 0 ? `${pct1(((parcelas + num(extra)) / renda) * 100)} da sua renda${num(extra) ? ` (inclui extra de ${formatCurrency(num(extra))})` : ''}` : 'registre receitas para comparar'} />
        <Metric icon={Hourglass} color="#e879f9" label="Tempo estimado para quitar" value={!open.length ? '—' : chosen.quita ? `${chosen.months} ${chosen.months === 1 ? 'mês' : 'meses'}` : '+50 anos'} sub={!open.length ? 'Você já está livre de dívidas!' : chosen.quita ? `livre em ${monthAhead(chosen.months)}` : 'as parcelas não cobrem os juros'} />
        <Metric icon={TrendingUp} color="#34d399" label="Economia de juros potencial" value={formatCurrency(economia)} sub="vs. pagar só as parcelas de cada contrato" valueClass="text-emerald-600 dark:text-emerald-300" />
      </MetricStrip>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 min-w-0">
          {!open.length ? (
            <section className="h-full rounded-3xl ring-1 ring-violet-400/30 bg-[hsl(var(--card))] bg-[radial-gradient(70%_60%_at_50%_30%,rgba(168,85,247,.18),transparent)] p-6 text-center flex flex-col justify-center">
              <ChecklistArt className="w-80 h-44 mx-auto" />
              <h2 className="font-display text-2xl font-extrabold mt-1">Sem dívidas em aberto</h2>
              <p className="text-sm text-muted max-w-md mx-auto mt-1.5">Você não tem dívidas cadastradas para planejar a quitação. Aproveite para simular estratégias, definir sua próxima meta e manter sua vida financeira no azul.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <GlowButton tone="aurora" onClick={() => nav('/dividas')} className="px-6 py-2.5"><Landmark className="w-4 h-4" />Ir para Dívidas & Crédito<ArrowRight className="w-4 h-4" /></GlowButton>
                <button onClick={() => simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-sky-400/50 hover:bg-sky-500/10"><Play className="w-4 h-4" />Começar uma simulação</button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-6 text-left sm:divide-x divide-[hsl(var(--border))]">
                {[[Target, 'Planeje sua estratégia', 'Escolha o melhor método'], [Zap, 'Simule cenários', 'Veja prazos e economias'], [Trophy, 'Mantenha o controle', 'Fique e permaneça livre']].map(([Ic, t, s]) => <div key={t} className="flex items-center gap-3 sm:px-4"><Ic className="w-7 h-7 text-fuchsia-400 shrink-0" /><span><b className="block text-sm">{t}</b><span className="text-xs text-muted">{s}</span></span></div>)}
              </div>
            </section>
          ) : (
            <Panel title="Ordem de quitação" icon={Target} iconClass="text-fuchsia-400" subtitle={`Método ${strategy === 'avalanche' ? 'Avalanche' : 'Bola de Neve'} • pague todas as parcelas e jogue o extra na dívida em foco`} className="h-full" action={
              <label className="text-xs text-muted flex items-center gap-2">Extra/mês<input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="R$ 0,00" className="w-28 rounded-lg ring-1 ring-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm text-[hsl(var(--text))] outline-none focus:ring-fuchsia-400" /></label>}>
              <div className="space-y-2.5">
                {chosen.order.map((id, k) => { const d = open.find((x) => x.id === id); const m = chosen.payoff[id]; return (
                  <div key={id} className={`flex items-center gap-3 rounded-2xl ring-1 px-3 py-2.5 ${k === 0 ? 'ring-fuchsia-400/60 bg-fuchsia-500/10' : 'ring-[hsl(var(--border))]'}`}>
                    <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold shrink-0 ${k === 0 ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{k + 1}</span>
                    <div className="flex-1 min-w-0"><p className="font-semibold truncate">{d.name}{k === 0 && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-200">foco agora</span>}</p><p className="text-xs text-muted">saldo {formatCurrency(d.balance)} • {d.rate.toFixed(2).replace('.', ',')}% a.m. • parcela {formatCurrency(d.parcela)}</p></div>
                    <div className="text-right"><p className="text-[11px] text-muted">quitada em</p><p className="font-semibold text-sm">{m ? monthAhead(m) : '—'}</p></div>
                  </div>); })}
              </div>
              <div className="mt-4" style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)} />
                    <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => `Mês ${l}`} contentStyle={TIP} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Bola de Neve" stroke="#22d3ee" strokeWidth={strategy === 'snowball' ? 3 : 1.5} dot={false} strokeDasharray={strategy === 'snowball' ? undefined : '5 4'} />
                    <Line type="monotone" dataKey="Avalanche" stroke="#d946ef" strokeWidth={strategy === 'avalanche' ? 3 : 1.5} dot={false} strokeDasharray={strategy === 'avalanche' ? undefined : '5 4'} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>

        <div className="xl:col-span-5 space-y-5">
          <Panel title="Métodos de quitação" icon={CircleDot} iconClass="text-teal-400" subtitle="Compare as principais estratégias e escolha a ideal para você." tone="violet">
            <div className="space-y-2.5">
              <Method v="snowball" title="Bola de Neve" badge="Mais motivador" icon={Snowflake} tone="teal" text="Quite primeiro as menores dívidas, ganhe ritmo e motivação com conquistas rápidas." />
              <Method v="avalanche" title="Avalanche" badge="Mais econômico" icon={Mountain} tone="pink" text="Quite primeiro as dívidas com os maiores juros, economizando mais dinheiro no total." />
            </div>
          </Panel>
          <div ref={simRef}>
            <Panel title="Simulação rápida" icon={Calculator} iconClass="text-cyan-400" subtitle="Simule um cenário de quitação e veja sua liberação financeira." tone="violet">
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Valor total das dívidas"><Input type="number" value={qf.total} onChange={(e) => setQForm({ ...qf, total: e.target.value })} /></Field>
                <Field label="Parcela mensal"><Input type="number" value={qf.parcela} onChange={(e) => setQForm({ ...qf, parcela: e.target.value })} /></Field>
                <Field label="Taxa média (% a.m.)"><Input type="number" step="0.01" value={qf.taxa} onChange={(e) => setQForm({ ...qf, taxa: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-1 items-end">
                <Field label="Método de quitação"><Select value={qf.metodo} onChange={(e) => setQForm({ ...qf, metodo: e.target.value })}><option value="snowball">Bola de Neve</option><option value="avalanche">Avalanche</option></Select></Field>
                <div className="rounded-xl ring-1 ring-teal-400/60 bg-teal-500/10 px-3 py-2 flex items-center gap-2.5">
                  <CalendarDays className="w-6 h-6 text-teal-400 shrink-0" />
                  <div className="min-w-0"><p className="text-[11px] text-muted">Previsão de liberação financeira</p><p className="font-display font-bold text-teal-600 dark:text-teal-300 truncate">{quickTxt}</p></div>
                </div>
              </div>
              {quick && quick.months != null && num(qf.total) > 0 && <p className="text-xs text-muted mt-2">Juros no período: {formatCurrency(quick.interest)}. Com valores agregados os dois métodos resultam no mesmo prazo — a diferença aparece com várias dívidas.</p>}
              <GlowButton tone="aurora" onClick={runQuick} className="w-full justify-center mt-3 py-2.5"><Play className="w-4 h-4" />Simular agora</GlowButton>
            </Panel>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:items-start">
        <Panel title="Roadmap de Quitação" icon={Share2} iconClass="text-sky-400" subtitle="Acompanhe aqui a sua jornada de quitação, etapa por etapa." className="xl:col-span-7" tone="violet">
          <div className="relative grid grid-cols-5 gap-2 pt-3">
            <div className="absolute left-[10%] right-[10%] top-[34px] border-t-2 border-dashed border-[hsl(var(--border))]" />
            {STEPS.map((s, k) => { const done = k < step; const cur = k === step; return (
              <div key={s.key} className="relative text-center">
                <span className={`mx-auto w-12 h-12 rounded-full grid place-items-center ring-2 bg-[hsl(var(--card))] ${cur ? 'ring-teal-400 text-teal-400 shadow-[0_0_18px_rgba(45,212,191,.5)]' : done ? 'ring-violet-400 text-violet-400' : 'ring-[hsl(var(--border))] text-muted'}`}>{done ? <CheckCircle2 className="w-6 h-6" /> : <s.icon className="w-6 h-6" />}</span>
                <p className="font-semibold text-sm mt-2">{s.label}</p>
                <p className="text-[11px] text-muted">{s.sub}</p>
                {cur && <span className="inline-block mt-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-200 ring-1 ring-teal-400/50">Atual</span>}
              </div>); })}
          </div>
          {open.length > 0 && <p className="text-xs text-muted mt-3">{pct1(paidPct)} do valor total dos contratos já foi pago.</p>}
        </Panel>
        <InsightsPanel className="xl:col-span-5" title="Insights do Monvy" subtitle="Leitura automática para acelerar sua liberdade financeira." items={insights} />
      </div>
    </div>
  );
}
