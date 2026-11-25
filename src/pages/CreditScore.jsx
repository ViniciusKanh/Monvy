import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, CreditCardTransaction, Debt } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, GlowButton, TIP } from '../components/kit.jsx';
import { ShieldArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import { Gauge, TrendingUp, ShieldCheck, Scale, Activity, Info, Sparkles, Cpu, Brain, Zap, CalendarDays, Target, Star, Calculator, BarChart3, CheckCircle2, Circle, Lock, Check, ArrowRight, ArrowUp } from 'lucide-react';

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const BANDS = [{ l: 'Regular', min: 0, max: 599, c: '#eab308' }, { l: 'Boa', min: 600, max: 699, c: '#22c55e' }, { l: 'Muito Boa', min: 700, max: 849, c: '#14b8a6' }, { l: 'Excelente', min: 850, max: 1000, c: '#a855f7' }];
const bandOf = (s) => [...BANDS].reverse().find((b) => s >= b.min) || BANDS[0];
const mkOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Score 0–1000: poupança (300) + comprometimento (250) + reserva (250) + estabilidade (200), sobre 6 meses terminando em endMk
function computeScore(tx, endMk, balance, divida) {
  const [y, m] = endMk.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => mkOf(new Date(y, m - 1 - i, 1)));
  const set = new Set(months); let inc = 0, exp = 0; const em = {};
  for (const t of tx) { const mk = String(t.date).slice(0, 7); if (!set.has(mk)) continue; if (t.type === 'income') inc += n(t.amount); if (t.type === 'expense') { exp += n(t.amount); em[mk] = (em[mk] || 0) + n(t.amount); } }
  const avgInc = inc / 6, avgExp = exp / 6;
  const rate = avgInc > 0 ? (avgInc - avgExp) / avgInc : 0;
  const reserveMonths = avgExp > 0 ? balance / avgExp : balance > 0 ? 6 : 0;
  const commit = avgInc > 0 ? divida / avgInc : divida > 0 ? 1 : 0;
  const rec = months.slice(0, 3).reduce((a, k) => a + (em[k] || 0), 0) / 3, ant = months.slice(3).reduce((a, k) => a + (em[k] || 0), 0) / 3;
  const estavel = ant === 0 ? 1 : Math.max(0, Math.min(1, 1 - (rec - ant) / ant));
  const f = { s1: Math.max(0, Math.min(300, Math.round((rate / 0.25) * 300))), s2: Math.max(0, Math.min(250, Math.round((1 - Math.min(1, commit / 0.35)) * 250))), s3: Math.max(0, Math.min(250, Math.round(Math.min(1, reserveMonths / 6) * 250))), s4: Math.max(0, Math.min(200, Math.round(estavel * 200))) };
  return { ...f, score: f.s1 + f.s2 + f.s3 + f.s4, avgInc, avgExp, rate, reserveMonths, commit };
}
const status = (v, max) => { const p = v / max; return p >= 0.8 ? ['Excelente', 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 ring-emerald-400/50'] : p >= 0.55 ? ['Bom', 'text-sky-600 dark:text-sky-300 bg-sky-500/15 ring-sky-400/50'] : p >= 0.25 ? ['Baixo', 'text-amber-600 dark:text-amber-300 bg-amber-500/15 ring-amber-400/50'] : ['Crítico', 'text-rose-600 dark:text-rose-300 bg-rose-500/15 ring-rose-400/50']; };

export default function CreditScore() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const ai = useAiAnalysis({ storageKey: 'creditscore', agentFocus: 'crédito', prompt: 'Com base na minha renda, reserva, comprometimento e taxa de poupança, dê 3 recomendações práticas e priorizadas para melhorar meu score de crédito estimado. Seja direto, em tópicos curtos.' });
  const [dividaManual, setDividaManual] = useState('');
  const [simReserve, setSimReserve] = useState(null);

  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const balance = accounts.reduce((s, a) => s + n(a.current_balance ?? a.balance ?? a.initial_balance), 0);
  const dividaAuto = debts.filter((d) => n(d.installments) > n(d.paid_installments)).reduce((s, d) => s + n(d.installment_amount), 0);
  const divida = dividaManual !== '' ? n(dividaManual) : dividaAuto;
  const nowMk = mkOf(new Date());
  const r = useMemo(() => computeScore(tx, nowMk, balance, divida), [tx, nowMk, balance, divida]);

  // evolução: score ao fim de cada um dos últimos 6 meses (saldo reconstruído com o resultado dos meses seguintes)
  const evo = useMemo(() => {
    const now = new Date(); const net = {};
    for (const t of tx) { const mk = String(t.date).slice(0, 7); net[mk] = (net[mk] || 0) + (t.type === 'income' ? n(t.amount) : t.type === 'expense' ? -n(t.amount) : 0); }
    let bal = balance; const out = [];
    for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const mk = mkOf(d); out.unshift({ name: `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, v: computeScore(tx, mk, Math.max(0, bal), divida).score }); bal -= net[mk] || 0; }
    return out;
  }, [tx, balance, divida]);
  const evoDelta = evo[0].v ? evo[evo.length - 1].v - evo[0].v : 0;

  const band = bandOf(r.score); const next = BANDS[BANDS.indexOf(band) + 1];
  const target3 = r.avgExp * 3; const target6 = r.avgExp * 6;
  const potential = computeScore(tx, nowMk, Math.max(balance, target6), divida);
  const gain = Math.max(0, potential.score - r.score + Math.max(0, 300 - r.s1));
  // tempo até a próxima faixa mantendo o ritmo atual de sobra mensal
  const monthsToNext = useMemo(() => { if (!next) return 0; const sobra = r.avgInc - r.avgExp; if (sobra <= 0) return null; for (let k = 1; k <= 60; k++) if (computeScore(tx, nowMk, balance + sobra * k, divida).score >= next.min) return k; return null; }, [next, r, tx, nowMk, balance, divida]);
  const simVal = simReserve ?? Math.round(Math.max(balance, target3 || 3000));
  const sim = computeScore(tx, nowMk, simVal, divida);
  const thisMonth = tx.filter((t) => String(t.date).slice(0, 7) === nowMk); const savedMonth = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + n(t.amount), 0) - thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + n(t.amount), 0);
  const saveGoal = Math.max(100, Math.round((r.avgInc * 0.1) / 50) * 50);
  const metas = [
    { t: 'Manter comprometimento em dia', done: r.s2 >= 200 },
    { t: 'Controlar e estabilizar gastos', done: r.s4 >= 160 },
    { t: `Formar reserva de emergência (${formatCurrency(target3)})`, cur: balance, goal: target3, done: target3 > 0 && balance >= target3 },
    { t: `Poupar todo mês (${formatCurrency(saveGoal)})`, cur: Math.max(0, savedMonth), goal: saveGoal, done: savedMonth >= saveGoal },
  ];
  const doneCount = metas.filter((m) => m.done).length;
  const dicas = [r.s3 < 200 && `Aumente sua reserva de emergência (meta: ${formatCurrency(target3)}).`, r.s1 < 200 && `Comece a poupar pelo menos ${formatCurrency(saveGoal)}/mês.`, r.s2 < 200 ? 'Reduza parcelas: priorize quitar as dívidas de juros maiores.' : 'Mantenha o compromisso com o pagamento das dívidas.', r.s4 < 160 && 'Seus gastos cresceram nos últimos meses — reveja as categorias que subiram.'].filter(Boolean).slice(0, 3);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  // medidor em arco 240°
  const R = 130, CX = 160, CY = 160, A0 = 150, A1 = 390; const ang = (s) => A0 + ((A1 - A0) * s) / 1000; const pt = (a, rr = R) => [CX + rr * Math.cos((a * Math.PI) / 180), CY + rr * Math.sin((a * Math.PI) / 180)];
  const arc = (a, b, rr = R) => { const [x1, y1] = pt(a, rr); const [x2, y2] = pt(b, rr); return `M ${x1} ${y1} A ${rr} ${rr} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const [mx, my] = pt(ang(r.score));
  const fatores = [[Scale, 'Comprometimento (dívidas)', r.s2, 250, `${Math.round(r.commit * 100)}% da renda em parcelas`], [Activity, 'Estabilidade de gastos', r.s4, 200, 'tendência dos últimos 3 meses'], [ShieldCheck, 'Reserva de emergência', r.s3, 250, `${r.reserveMonths.toFixed(1).replace('.', ',')} mês(es) cobertos`], [TrendingUp, 'Taxa de poupança', r.s1, 300, `${Math.round(r.rate * 100)}% da renda sobra`]];

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Gauge} lead="Score de Crédito" accent="Estimado" iconClass="text-cyan-400" subtitle="Estimativa baseada nos seus próprios dados — não é o Serasa/SPC, é um termômetro pessoal." />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-4 flex flex-col items-center justify-center">
          <svg viewBox="0 0 320 290" className="w-full max-w-[380px]" aria-label={`Score ${r.score} de 1000`}>
            <defs><linearGradient id="csG" x1="0" y1="1" x2="1" y2="1"><stop offset="0%" stopColor="#f43f5e" /><stop offset="30%" stopColor="#f59e0b" /><stop offset="55%" stopColor="#eab308" /><stop offset="75%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a855f7" /></linearGradient><filter id="csF"><feGaussianBlur stdDeviation="4" /></filter></defs>
            <path d={arc(A0, A1, 140)} stroke="url(#csG)" strokeWidth="2" fill="none" opacity=".5" />
            {Array.from({ length: 41 }).map((_, i) => { const a = A0 + ((A1 - A0) * i) / 40; const [x1, y1] = pt(a, 112); const [x2, y2] = pt(a, i % 5 ? 120 : 124); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeOpacity=".5" />; })}
            <path d={arc(A0, A1)} stroke="hsl(var(--muted) / .18)" strokeWidth="22" fill="none" strokeLinecap="round" />
            <path d={arc(A0, Math.max(A0 + 1, ang(r.score)))} stroke="url(#csG)" strokeWidth="22" fill="none" strokeLinecap="round" />
            <path d={arc(A0, Math.max(A0 + 1, ang(r.score)))} stroke="url(#csG)" strokeWidth="22" fill="none" strokeLinecap="round" filter="url(#csF)" opacity=".6" />
            <circle cx={mx} cy={my} r="13" fill="#fff" stroke={band.c} strokeWidth="4" />
            <text x={CX} y={CY - 32} textAnchor="middle" fontSize="18" fill="hsl(var(--text))" fontWeight="600">Seu Score</text>
            <text x={CX} y={CY + 30} textAnchor="middle" fontSize="72" fontWeight="900" fill="hsl(var(--text))" fontFamily="system-ui">{r.score}</text>
            <text x={CX} y={CY + 58} textAnchor="middle" fontSize="16" fill="hsl(var(--muted))">de 1000</text>
            <ellipse cx={CX} cy={262} rx="110" ry="14" fill="none" stroke="#22d3ee" strokeOpacity=".5" strokeWidth="2" />
          </svg>
          <span className="-mt-14 relative px-6 py-1.5 rounded-full font-bold text-lg ring-2" style={{ background: `${band.c}33`, color: band.c, '--tw-ring-color': band.c, boxShadow: `0 0 18px ${band.c}88` }}>{band.l}</span>
        </section>

        <div className="xl:col-span-8 space-y-4">
          <section className="relative overflow-hidden rounded-3xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(70%_140%_at_0%_0%,rgba(168,85,247,.22),transparent),radial-gradient(50%_140%_at_100%_100%,rgba(34,211,238,.14),transparent)] p-5">
            <ShieldArt className="hidden lg:block absolute right-4 top-1/2 -translate-y-1/2 w-64 h-44 pointer-events-none" />
            <div className="relative lg:pr-72">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ring-1 ring-violet-400/50 bg-violet-500/15"><Brain className="w-3.5 h-3.5 text-violet-400" />Análise do seu perfil</span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold mt-2">Seu score está na faixa <span style={{ color: band.c }}>{band.l}</span></h2>
              <p className="text-sm text-muted mt-1.5">{next ? <>Faltam <b className="text-[hsl(var(--text))]">{next.min - r.score} pontos</b> para a faixa {next.l} ({next.min}+). {monthsToNext ? <>Mantendo a sua sobra mensal atual, você chega lá em cerca de <b className="text-[hsl(var(--text))]">{monthsToNext} {monthsToNext === 1 ? 'mês' : 'meses'}</b>.</> : 'Com a sobra mensal atual, o caminho é reforçar a reserva e a poupança.'}</> : 'Você está na faixa máxima. Mantenha a consistência!'}</p>
              <GlowButton tone="sky" onClick={() => { ai.gerar(); document.getElementById('cs-ai')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="mt-3 py-2.5 px-5"><Zap className="w-4 h-4" />Ver plano para subir o score<ArrowRight className="w-4 h-4" /></GlowButton>
            </div>
          </section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[[TrendingUp, '#34d399', 'Próximo nível', next ? `${next.l} (${next.min}+)` : 'Topo', 'text-emerald-600 dark:text-emerald-300'], [CalendarDays, '#38bdf8', 'Tempo estimado', next ? (monthsToNext ? `${monthsToNext} ${monthsToNext === 1 ? 'mês' : 'meses'}` : '—') : '—'], [Target, '#e879f9', 'Ganho potencial', `+${gain} pontos`, 'text-fuchsia-600 dark:text-fuchsia-300'], [Star, '#a855f7', 'Seu potencial máximo', '1000 pontos', 'text-sky-600 dark:text-sky-300']].map(([Ic, c, l, v, cls]) => (
              <div key={l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 flex items-center gap-3"><Ic className="w-8 h-8 shrink-0" style={{ color: c }} strokeWidth={1.6} /><div className="min-w-0"><p className="text-xs text-muted">{l}</p><p className={`font-display text-lg font-bold truncate ${cls || ''}`}>{v}</p></div></div>))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-4" tone="violet" title="Fatores que influenciam seu score" icon={Info} iconClass="text-muted">
          <div className="space-y-3">{fatores.map(([Ic, l, v, max, sub]) => { const [st, cls] = status(v, max); return (
            <div key={l} className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg grid place-items-center bg-sky-500/15 text-sky-400 shrink-0"><Ic className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0"><div className="flex justify-between text-sm"><span className="font-medium truncate">{l}</span><b>{v}/{max}</b></div><div className="h-2 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} /></div><p className="text-[11px] text-muted mt-0.5">{sub}</p></div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-md ring-1 w-[72px] text-center ${cls}`}>{st}</span></div>); })}</div>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted">Parcelas/mês: <input type="number" value={dividaManual} onChange={(e) => setDividaManual(e.target.value)} placeholder={dividaAuto ? dividaAuto.toFixed(2) : '0'} className="w-24 bg-transparent border-b border-dashed border-[hsl(var(--border))] outline-none text-[hsl(var(--text))]" /><span>{dividaManual === '' ? '(das suas Dívidas)' : '(informado)'}</span></label>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Simulador de impacto" icon={Calculator} iconClass="text-sky-400" subtitle="Veja quanto seu score pode subir com mudanças no seu comportamento.">
          <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3.5">
            <div className="flex justify-between items-center"><p className="font-semibold text-sm">Reserva de emergência</p><span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">{sim.score - r.score >= 0 ? '+' : ''}{sim.score - r.score} pts</span></div>
            <input type="range" min={0} max={Math.max(1000, Math.round(target6 * 1.2))} step={50} value={simVal} onChange={(e) => setSimReserve(Number(e.target.value))} className="w-full mt-3 accent-violet-500" aria-label="Reserva simulada" />
            <div className="flex justify-between text-xs text-muted"><span>Atual: {formatCurrency(balance)}</span><span>Simulado: <b className="text-[hsl(var(--text))]">{formatCurrency(simVal)}</b></span></div>
          </div>
          <div className="mt-3 rounded-2xl ring-1 ring-emerald-400/60 bg-emerald-500/10 px-4 py-3 flex items-center gap-3"><BarChart3 className="w-6 h-6 text-emerald-400" /><span className="text-sm flex-1">Score estimado</span><span className="font-display text-3xl font-extrabold">{sim.score}</span><span className="text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"><ArrowUp className="w-3 h-3 inline" />{sim.score - r.score} pontos</span></div>
          <p className="text-[11px] text-muted mt-2">Recalcula o fator “Reserva” com o valor escolhido; os demais fatores ficam como estão.</p>
        </Panel>
        <Panel className="xl:col-span-4" tone="sky" title="Evolução do seu score" icon={TrendingUp} iconClass="text-sky-400" action={<span className={`text-[11px] font-bold px-2 py-1 rounded-md ring-1 ${evoDelta >= 0 ? 'ring-emerald-400/50 text-emerald-600 dark:text-emerald-300' : 'ring-rose-400/50 text-rose-500'}`}>{evoDelta >= 0 ? '↑ +' : '↓ '}{evoDelta} pts</span>}>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={evo} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs><linearGradient id="csE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={36} domain={['dataMin - 50', 'dataMax + 50']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v)} />
            <Tooltip formatter={(v) => [`${v} pts`, 'Score']} contentStyle={TIP} />
            <Area type="monotone" dataKey="v" stroke="#2dd4bf" strokeWidth={3} fill="url(#csE)" dot={{ r: 4, fill: '#ccfbf1', stroke: '#14b8a6' }} />
            <ReferenceDot x={evo[evo.length - 1].name} y={evo[evo.length - 1].v} r={7} fill="#fff" stroke="#14b8a6" strokeWidth={3} />
          </AreaChart></ResponsiveContainer></div>
          <p className="text-[11px] text-muted">Recalculado mês a mês com seus lançamentos; as parcelas usam o valor atual.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel id="cs-ai" className="xl:col-span-4 scroll-mt-24" tone="violet" glow title="Recomendações" icon={Brain} iconClass="text-violet-400" action={<span className="text-[11px] text-muted inline-flex items-center gap-1">{ai.data?.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-sky-400" />Gemini</> : ai.data ? <><Cpu className="w-3 h-3" />Motor local</> : 'Auto'}</span>}>
          <div className="rounded-2xl ring-1 ring-violet-400/40 bg-violet-500/10 p-3.5">
            <p className="font-semibold mb-2">Principais recomendações para você</p>
            {ai.busy ? <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Gerando plano…</p> : ai.data ? <Markdown text={ai.data.text} className="text-sm" /> : <ul className="space-y-1.5">{dicas.map((d) => <li key={d} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{d}</li>)}</ul>}
            <button onClick={() => ai.gerar()} disabled={ai.busy} className="mt-3 text-xs font-semibold text-sky-500 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{ai.data ? 'Gerar de novo com IA' : 'Gerar com IA'}</button>
          </div>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Metas para subir de nível" icon={Target} iconClass="text-fuchsia-400" action={<span className="text-xs text-muted">{doneCount} de {metas.length} concluídas</span>}>
          <div className="space-y-2.5">{metas.map((m) => (
            <div key={m.t} className="flex items-center gap-3">
              {m.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <Circle className="w-5 h-5 text-muted shrink-0" />}
              <div className="flex-1 min-w-0"><p className={`text-sm ${m.done ? 'line-through text-muted' : ''}`}>{m.t}</p>{m.goal != null && !m.done && <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, (m.cur / (m.goal || 1)) * 100)}%` }} /></div><span className="text-[11px] text-muted whitespace-nowrap">{formatCurrency(m.cur)} / {formatCurrency(m.goal)}</span></div>}</div>
              {m.done ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ring-emerald-400/50 text-emerald-600 dark:text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" />Concluída</span> : m.goal != null && <span className="text-xs text-muted w-10 text-right">{Math.round(Math.min(100, (m.cur / (m.goal || 1)) * 100))}%</span>}
            </div>))}</div>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Trilha de evolução" icon={BarChart3} iconClass="text-sky-400">
          <div className="relative grid grid-cols-4 gap-2 pt-4">
            <div className="absolute left-[12%] right-[12%] top-[38px] border-t-2 border-dashed border-amber-400/40" />
            {BANDS.map((b) => { const cur = b === band; const passed = r.score > b.max; return (
              <div key={b.l} className="relative text-center">
                <span className={`relative z-[1] mx-auto w-11 h-11 rounded-full grid place-items-center ring-2 ${cur ? 'bg-amber-400 ring-amber-200 text-amber-950 shadow-[0_0_16px_rgba(251,191,36,.7)]' : passed ? 'bg-emerald-500 ring-emerald-300 text-white' : 'bg-[hsl(var(--card))] ring-[hsl(var(--border))] text-muted'}`}>{cur || passed ? <Check className="w-5 h-5" /> : <Lock className="w-5 h-5" />}</span>
                <p className={`text-sm font-semibold mt-2 ${cur ? 'text-amber-500' : ''}`}>{b.l}</p><p className="text-[11px] text-muted">({b.min} – {b.max})</p>
              </div>); })}
          </div>
          <p className="text-[11px] text-muted mt-3">Estimativa educativa calculada com renda, despesas, reserva e parcelas. Não é consulta a bureaus de crédito.</p>
        </Panel>
      </div>
    </div>
  );
}
