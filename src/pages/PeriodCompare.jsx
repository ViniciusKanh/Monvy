import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, Modal, Button } from '../components/ui';
import { HeroTitle, Panel, Ring, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { WaveBarsArt } from '../components/art/PageArt.jsx';
import { formatCurrency, MONTHS_PT } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, LabelList, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { ArrowUpDown, ArrowLeftRight, CalendarDays, ChevronDown, Sparkles, ArrowRight, ArrowUp, ArrowDown, Database, CreditCard, BarChart3, TrendingUp, TrendingDown, Award, CheckCircle2, Lightbulb, Brain, Cpu, Target, Radar as RadarIcon, Leaf } from 'lucide-react';

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const lbl = (mk) => `${MES[Number(mk.slice(5)) - 1]}/${mk.slice(2, 4)}`;
const long = (mk) => `${MONTHS_PT[Number(mk.slice(5)) - 1]}/${mk.slice(0, 4)}`;
const mkOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const pctCh = (a, b) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null);
const k = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k` : `${Math.round(v)}`);

export default function PeriodCompare() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const catByName = useMemo(() => Object.fromEntries(categories.map((c) => [c.name, c])), [categories]);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const months = useMemo(() => { const now = new Date(); return Array.from({ length: 24 }, (_, i) => mkOf(new Date(now.getFullYear(), now.getMonth() - i, 1))); }, []);
  const [a, setA] = useState(months[0]);
  const [b, setB] = useState(months[1]);
  const [range, setRange] = useState(3);
  const [open, setOpen] = useState(false);

  const calc = (mk) => {
    const t = tx.filter((x) => String(x.date).slice(0, 7) === mk);
    const inc = t.filter((x) => x.type === 'income').reduce((s, x) => s + num(x.amount), 0);
    const exp = t.filter((x) => x.type === 'expense').reduce((s, x) => s + num(x.amount), 0);
    const cats = {};
    for (const x of t) if (x.type === 'expense') { const nm = catMap[x.category_id]?.name || 'Sem categoria'; cats[nm] = (cats[nm] || 0) + num(x.amount); }
    return { inc, exp, saldo: inc - exp, cats };
  };
  const A = useMemo(() => calc(a), [a, tx, catMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const B = useMemo(() => calc(b), [b, tx, catMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = useMemo(() => { const [y, m] = a.split('-').map(Number); return Array.from({ length: range }, (_, i) => { const mk = mkOf(new Date(y, m - range + i, 1)); const c = calc(mk); return { name: lbl(mk), Receitas: Math.round(c.inc), Despesas: Math.round(c.exp), Saldo: Math.round(c.saldo) }; }); }, [a, range, tx, catMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const spark = (key) => series.map((s, i) => ({ i, v: s[key] }));

  const dInc = pctCh(A.inc, B.inc), dExp = pctCh(A.exp, B.exp), dSal = pctCh(A.saldo, B.saldo);
  const catRows = useMemo(() => { const names = new Set([...Object.keys(A.cats), ...Object.keys(B.cats)]); return [...names].map((n) => ({ name: n, a: A.cats[n] || 0, b: B.cats[n] || 0, d: (A.cats[n] || 0) - (B.cats[n] || 0) })).map((r) => ({ ...r, p: pctCh(r.a, r.b) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)); }, [A, B]);
  const radar = useMemo(() => { const tA = A.exp || 1, tB = B.exp || 1; return [...catRows].sort((x, y) => y.a + y.b - (x.a + x.b)).slice(0, 6).map((r) => ({ axis: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name, A: Math.round((r.a / tA) * 100), B: Math.round((r.b / tB) * 100) })); }, [catRows, A, B]);
  const bestDrop = catRows.filter((r) => r.d < 0).sort((x, y) => x.d - y.d)[0];
  const worstRise = catRows.filter((r) => r.d > 0).sort((x, y) => y.d - x.d)[0];

  const fmtP = (p) => (p == null ? '—' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(0)}%`);
  const summary = `Comparando ${long(a)} com ${long(b)}, suas receitas ${dInc == null ? 'não tinham base' : dInc >= 0 ? `subiram ${Math.abs(dInc).toFixed(0)}%` : `caíram ${Math.abs(dInc).toFixed(0)}%`}, as despesas ${dExp == null ? 'não tinham base' : dExp <= 0 ? `caíram ${Math.abs(dExp).toFixed(0)}%` : `subiram ${Math.abs(dExp).toFixed(0)}%`} e o saldo ${A.saldo >= B.saldo ? 'melhorou' : 'piorou'} ${formatCurrency(Math.abs(A.saldo - B.saldo))}.${bestDrop ? ` O destaque positivo é a redução em ${bestDrop.name} (${fmtP(bestDrop.p)}).` : ''}${worstRise ? ` Atenção para ${worstRise.name} (${fmtP(worstRise.p)}).` : ''}`;
  const ai = useAiAnalysis({ storageKey: 'compare', agentFocus: 'comparação de períodos', prompt: `Compare ${long(a)} (receitas ${formatCurrency(A.inc)}, despesas ${formatCurrency(A.exp)}) com ${long(b)} (receitas ${formatCurrency(B.inc)}, despesas ${formatCurrency(B.exp)}). Maiores mudanças: ${catRows.slice(0, 4).map((r) => `${r.name} ${formatCurrency(r.b)}→${formatCurrency(r.a)}`).join('; ')}. Em até 4 frases explique o que mudou e proponha um plano de ação com 3 passos.` });

  const after2 = A.saldo > 0 && A.saldo > B.saldo ? A.saldo + (A.saldo - B.saldo) * 2 : null;
  const insights = [
    dExp != null && dExp < 0 ? { icon: CheckCircle2, c: 'text-emerald-400', t: 'Ótima evolução!', d: `Você reduziu suas despesas em ${Math.abs(dExp).toFixed(0)}%${bestDrop ? `, principalmente em ${bestDrop.name}` : ''}.` } : { icon: TrendingUp, c: 'text-rose-400', t: 'Despesas em alta', d: dExp == null ? 'Sem despesas no período de comparação.' : `Suas despesas subiram ${Math.abs(dExp).toFixed(0)}%${worstRise ? `, puxadas por ${worstRise.name}` : ''}.` },
    { icon: Lightbulb, c: 'text-amber-400', t: 'Oportunidade', d: A.saldo > 0 ? `Sobraram ${formatCurrency(A.saldo)} em ${lbl(a)}. Direcionar parte disso para reserva ou metas acelera seus objetivos.` : `O mês fechou negativo em ${formatCurrency(Math.abs(A.saldo))}. Revise as categorias que mais cresceram.` },
    { icon: TrendingUp, c: 'text-sky-400', t: 'Tendência', d: after2 != null ? `Se a melhora de ${formatCurrency(A.saldo - B.saldo)}/mês se repetir por mais 2 meses, seu saldo mensal passa de ${formatCurrency(after2)}.` : `Saldo médio de ${formatCurrency(series.reduce((s, x) => s + x.Saldo, 0) / Math.max(1, series.length))} nos últimos ${range} meses.` },
  ];

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const Sel = ({ value, onChange }) => (
    <label className="relative flex items-center rounded-xl ring-1 ring-[hsl(var(--border))] bg-black/5 dark:bg-white/5 pl-3"><CalendarDays className="w-4 h-4 text-muted" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent pl-2 pr-9 py-2 font-semibold text-sm outline-none">{months.map((m) => <option key={m} value={m} className="bg-[hsl(var(--card))]">{long(m).replace('/', ' ')}</option>)}</select><ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none" /></label>
  );
  const Kpi = ({ icon: Ic, label, v, d, dp, color, good, sKey }) => (
    <div className="relative overflow-hidden rounded-2xl ring-1 p-4 bg-[hsl(var(--card))]" style={{ '--tw-ring-color': `${color}88`, backgroundImage: `linear-gradient(135deg, ${color}2a, transparent 65%)`, boxShadow: `0 0 26px -12px ${color}` }}>
      <div className="flex items-start gap-3"><span className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: `${color}33`, color }}><Ic className="w-6 h-6" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm text-muted">{label}</p><p className="font-display text-2xl font-extrabold">{formatCurrency(v)}</p>
          <p className={`text-xs font-semibold flex items-center gap-1 ${(d >= 0) === good ? 'text-emerald-500 dark:text-emerald-300' : 'text-rose-500'}`}>{d >= 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}{d >= 0 ? '+' : '−'}{formatCurrency(Math.abs(d))}{dp != null && ` (${fmtP(dp)})`} <span className="text-muted font-normal">vs {lbl(b)}</span></p></div>
      </div>
      <div className="absolute right-3 top-3 w-24 h-9 opacity-80 pointer-events-none"><ResponsiveContainer width="100%" height="100%"><LineChart data={spark(sKey)}><Line type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={ArrowUpDown} lead="Comparador de" accent="Períodos" iconClass="text-sky-400" subtitle="Compare dois meses lado a lado: receitas, despesas e categorias com análises inteligentes." art={<WaveBarsArt className="w-[420px] h-28" />} />

      <section className="rounded-2xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(60%_160%_at_0%_50%,rgba(168,85,247,.2),transparent)] px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <span className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/25 ring-1 ring-violet-400/60 font-semibold"><Sparkles className="w-4 h-4 text-violet-300" />Resumo automático</span>
        <p className="flex-1 text-sm">{summary}</p>
        <GlowButton tone="violet" onClick={() => { setOpen(true); if (!ai.data) ai.gerar(); }} className="shrink-0">Ver análise completa<ArrowRight className="w-4 h-4" /></GlowButton>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-9 space-y-5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2"><span className="text-sm text-muted">Período A (atual)</span><Sel value={a} onChange={setA} /></div>
            <button onClick={() => { setA(b); setB(a); }} className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-[0_0_18px_rgba(99,102,241,.5)]" aria-label="Inverter períodos"><ArrowLeftRight className="w-5 h-5" /></button>
            <div className="flex items-center gap-2 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2"><span className="text-sm text-muted">Período B (comparação)</span><Sel value={b} onChange={setB} /></div>
            <div className="ml-auto flex items-center gap-1 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-1"><CalendarDays className="w-4 h-4 text-muted mx-1" />{[3, 6, 12].map((r) => <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${range === r ? 'bg-violet-600 text-white' : 'text-muted'}`}>{r} meses</button>)}</div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Kpi icon={Database} label="Receitas" v={A.inc} d={A.inc - B.inc} dp={dInc} color="#10b981" good sKey="Receitas" />
            <Kpi icon={CreditCard} label="Despesas" v={A.exp} d={A.exp - B.exp} dp={dExp} color="#f43f5e" good={false} sKey="Despesas" />
            <Kpi icon={BarChart3} label="Saldo" v={A.saldo} d={A.saldo - B.saldo} dp={dSal} color="#38bdf8" good sKey="Saldo" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Panel tone="sky" title="Comparativo por tipo" icon={BarChart3} iconClass="text-sky-400" action={<div className="flex gap-3 text-xs"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" />{lbl(a)} (atual)</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />{lbl(b)} (anterior)</span></div>}>
              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ n: 'Receitas', A: A.inc, B: B.inc }, { n: 'Despesas', A: A.exp, B: B.exp }, { n: 'Saldo', A: A.saldo, B: B.saldo }]} barGap={6} margin={{ top: 22, right: 6, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="pcA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#6d28d9" /></linearGradient><linearGradient id="pcB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cbd5e1" /><stop offset="100%" stopColor="#64748b" /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="n" tick={{ fontSize: 12, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis width={40} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={k} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                    <Bar dataKey="A" name={lbl(a)} fill="url(#pcA)" radius={[6, 6, 0, 0]} maxBarSize={52}><LabelList dataKey="A" position="top" formatter={k} style={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--text))' }} /></Bar>
                    <Bar dataKey="B" name={lbl(b)} fill="url(#pcB)" radius={[6, 6, 0, 0]} maxBarSize={52}><LabelList dataKey="B" position="top" formatter={k} style={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--text))' }} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel tone="violet" title="Evolução no período" icon={TrendingUp} iconClass="text-sky-400" action={<div className="flex gap-3 text-xs"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />Receitas</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" />Despesas</span></div>}>
              <div className="relative" style={{ height: 230 }}>
                {dExp != null && <span className={`absolute right-2 top-0 z-[1] text-center rounded-xl ring-1 px-3 py-1 ${dExp <= 0 ? 'ring-rose-400/60 bg-rose-500/10' : 'ring-amber-400/60 bg-amber-500/10'}`}><b className="text-lg">{dExp <= 0 ? '↓' : '↑'} {fmtP(dExp)}</b><br /><span className="text-[11px] text-rose-500">em despesas</span></span>}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 16, right: 14, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="pcI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis width={40} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={k} />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
                    <Area type="monotone" dataKey="Receitas" stroke="#22d3ee" strokeWidth={3} fill="url(#pcI)" dot={{ r: 4, fill: '#e0f2fe' }} />
                    <Area type="monotone" dataKey="Despesas" stroke="#a855f7" strokeWidth={3} fill="none" dot={{ r: 4, fill: '#f5d0fe' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.35fr_.8fr] gap-5">
            <Panel tone="violet" title={<span>Radar de Categorias <span className="text-xs font-normal text-muted">(participação nas despesas)</span></span>} icon={RadarIcon} iconClass="text-sky-400">
              {radar.length < 3 ? <p className="text-sm text-muted">Precisa de pelo menos 3 categorias com gasto.</p> : (
                <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><RadarChart data={radar} outerRadius="64%">
                  <PolarGrid stroke="hsl(var(--border))" /><PolarRadiusAxis tick={false} axisLine={false} /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'hsl(var(--text))' }} />
                  <Radar dataKey="B" name={lbl(b)} stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                  <Radar dataKey="A" name={lbl(a)} stroke="#a855f7" fill="#7c3aed" fillOpacity={0.45} dot={{ r: 3, fill: '#e9d5ff' }} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={TIP} /></RadarChart></ResponsiveContainer></div>)}
              <div className="flex gap-3 text-xs justify-end"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" />{lbl(a)}</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />{lbl(b)}</span></div>
            </Panel>
            <Panel tone="violet" title="Maiores mudanças por categoria" icon={BarChart3} iconClass="text-sky-400">
              {catRows.length === 0 ? <p className="text-sm text-muted">Sem despesas nos períodos escolhidos.</p> : (
                <table className="w-full text-sm"><thead><tr className="text-xs text-muted text-left"><th className="pb-2 font-medium">Categoria</th><th className="pb-2 font-medium text-right">{lbl(a)}</th><th className="pb-2 font-medium text-right">{lbl(b)}</th><th className="pb-2 font-medium text-right">Variação</th></tr></thead>
                  <tbody>{catRows.slice(0, 6).map((r) => { const Ic = categoryIcon(catByName[r.name] || { name: r.name }); const up = r.d > 0; return (
                    <tr key={r.name} className="border-t border-[hsl(var(--border))]"><td className="py-2"><span className="flex items-center gap-2 min-w-0"><Ic className="w-4 h-4 text-violet-400 shrink-0" /><span className="truncate">{r.name}</span></span></td><td className="text-right tabular-nums">{formatCurrency(r.a)}</td><td className="text-right tabular-nums text-muted">{formatCurrency(r.b)}</td><td className={`text-right font-semibold whitespace-nowrap ${up ? 'text-rose-500' : r.d < 0 ? 'text-emerald-500' : 'text-muted'}`}>{r.p == null ? 'novo' : fmtP(r.p)} {up ? <ArrowUp className="w-3.5 h-3.5 inline" /> : r.d < 0 ? <ArrowDown className="w-3.5 h-3.5 inline" /> : null}</td></tr>); })}</tbody></table>)}
            </Panel>
            <Panel tone="sky" title="Variação geral" icon={Target} iconClass="text-sky-400">
              <div className="flex flex-col items-center">
                <Ring value={Math.min(100, Math.abs(dExp ?? 0))} size={150} stroke={14} from={dExp != null && dExp <= 0 ? '#10b981' : '#f43f5e'} to={dExp != null && dExp <= 0 ? '#34d399' : '#fb7185'}><span className={`font-display text-3xl font-extrabold ${dExp != null && dExp <= 0 ? 'text-emerald-500 dark:text-emerald-300' : 'text-rose-500'}`}>{fmtP(dExp)}</span><span className="text-xs text-muted">em despesas</span></Ring>
                <p className={`mt-3 text-xs rounded-xl ring-1 px-3 py-2 flex items-center gap-2 ${dExp != null && dExp <= 0 ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-rose-400/50 bg-rose-500/10'}`}><Leaf className="w-4 h-4 shrink-0" />{dExp == null ? 'Sem base para comparar.' : dExp <= -20 ? 'Redução significativa no período comparado.' : dExp <= 0 ? 'Despesas um pouco menores.' : dExp < 20 ? 'Despesas um pouco maiores.' : 'Aumento significativo nas despesas.'}</p>
              </div>
            </Panel>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-5">
          <Panel tone="violet" title="Destaques do Comparativo" icon={Award} iconClass="text-sky-400">
            <div className="space-y-2.5">
              {[['Saldo', A.saldo - B.saldo, dSal, true], ['Despesas', A.exp - B.exp, dExp, false], ['Receitas', A.inc - B.inc, dInc, true]].map(([n, d, p, good]) => { const ok = (d >= 0) === good; return (
                <div key={n} className={`flex items-center gap-3 rounded-xl ring-1 px-3 py-2.5 ${ok ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-rose-400/50 bg-rose-500/10'}`}>
                  <span className={`w-9 h-9 rounded-full grid place-items-center ${ok ? 'bg-emerald-500/25 text-emerald-500' : 'bg-rose-500/25 text-rose-500'}`}>{d >= 0 ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}</span>
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{n} {d >= 0 ? 'em alta' : 'em queda'}</p><p className={`text-xs ${ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>{fmtP(p)} ({d >= 0 ? '+' : '−'}{formatCurrency(Math.abs(d))})</p></div>
                  {d >= 0 ? <TrendingUp className={`w-6 h-6 ${ok ? 'text-emerald-400' : 'text-rose-400'}`} /> : <TrendingDown className={`w-6 h-6 ${ok ? 'text-emerald-400' : 'text-rose-400'}`} />}
                </div>); })}
            </div>
          </Panel>
          <Panel tone="violet" glow title="Insights automáticos" icon={Sparkles} iconClass="text-fuchsia-400" action={<span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 ring-1 ring-violet-400/50 text-violet-600 dark:text-violet-200">Auto</span>}>
            <div className="space-y-2.5">{insights.map((x) => <div key={x.t} className="flex gap-3 rounded-xl bg-black/[.03] dark:bg-white/[.03] px-3 py-2.5"><x.icon className={`w-5 h-5 shrink-0 ${x.c}`} /><div><p className="font-semibold text-sm">{x.t}</p><p className="text-xs text-muted">{x.d}</p></div></div>)}</div>
            <GlowButton tone="violet" onClick={() => { setOpen(true); ai.gerar(); }} disabled={ai.busy} className="w-full justify-center mt-3 py-2.5"><Sparkles className="w-4 h-4" />Gerar plano de ação com IA<ArrowRight className="w-4 h-4" /></GlowButton>
          </Panel>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Análise: ${long(a)} × ${long(b)}`} maxWidth="max-w-2xl" footer={<><Button variant="outline" onClick={() => ai.gerar()} disabled={ai.busy}>Gerar de novo</Button><Button onClick={() => setOpen(false)}>Fechar</Button></>}>
        <p className="text-sm text-muted mb-3">{summary}</p>
        <div className="rounded-xl ring-1 ring-violet-400/40 p-3"><p className="text-sm font-semibold flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-violet-400" />Plano de ação {ai.data && <span className="text-[11px] text-muted font-normal inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3 h-3" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>}</p>
          {ai.busy ? <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Analisando…</p> : ai.data ? <Markdown text={ai.data.text} className="text-sm" /> : <p className="text-sm text-muted">Clique em gerar.</p>}</div>
      </Modal>
    </div>
  );
}
