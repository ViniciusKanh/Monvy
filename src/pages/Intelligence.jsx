import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, Modal, Button } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, Donut, DeltaChip, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { BrainArt, ChipArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { lastMonths, monthlySeries, monthTotals, categoryBreakdown, weekdaySpending, seasonalForecast, detectAnomalies, detectPriceHikes, groupByDescription, combineExpenses, categoryTrends } from '../lib/analytics.js';
import { BarChart, Bar, Cell, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Wallet, Target, AlertTriangle, CreditCard, Lightbulb, CalendarDays, Trophy, Coins, Briefcase, Layers, ArrowRight, Sparkles, Cpu, ShoppingBag,
  Smartphone, Wine, Utensils, Zap, Wifi, ShoppingCart, Apple as AppleIcon, BookOpen, Receipt, CheckCircle2, Home, X,
} from 'lucide-react';

const GUESS = [[/bar\b|pub|cervej|caracol|morrison|bebida/i, Wine], [/almo|restaur|ifood|lanche|pizza|jantar/i, Utensils], [/fone|celular|eletr|apple|pencil/i, Smartphone], [/enel|luz|energia/i, Zap], [/internet|m[óo]vel|vivo|claro|tim\b/i, Wifi], [/carrefour|mercad|super|extra|atacad/i, ShoppingCart], [/livro|jus|curso|escola/i, BookOpen], [/alug|condom/i, Home], [/cart[ãa]o/i, CreditCard]];
const iconOf = (txt) => (GUESS.find(([re]) => re.test(txt || '')) || [null, Receipt])[1];
const RANK = ['from-emerald-400 to-teal-600', 'from-sky-400 to-blue-600', 'from-violet-500 to-indigo-600', 'from-slate-500 to-slate-700', 'from-slate-500 to-slate-700'];

export default function Intelligence() {
  const mk = monthKey(new Date());
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ai = useAiAnalysis({ storageKey: 'intelligence', agentFocus: 'inteligência', prompt: 'Em até 3 frases, aponte os 2 pontos de atenção mais importantes das minhas finanças deste mês e termine com 1 ação prática. Seja direto e use números quando ajudar.' });
  const [modal, setModal] = useState(null);
  const [aiOpen, setAiOpen] = useState(true);

  const months = useMemo(() => lastMonths(6), []);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const series = useMemo(() => monthlySeries(tx, months), [tx, months]);
  const cur = useMemo(() => monthTotals(tx, mk), [tx, mk]);
  const prev = series[series.length - 2] || { inc: 0, exp: 0 };
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const forecast = useMemo(() => seasonalForecast(tx), [tx]);
  const byCat = useMemo(() => categoryBreakdown(tx, mk, catMap), [tx, mk, catMap]);
  const wd = useMemo(() => weekdaySpending(tx, mk), [tx, mk]);
  const anomalies = useMemo(() => detectAnomalies(tx, catMap), [tx, catMap]);
  const hikes = useMemo(() => detectPriceHikes(tx), [tx]);
  const trends = useMemo(() => categoryTrends(tx, months, catMap), [tx, months, catMap]);
  const merchants = useMemo(() => groupByDescription(tx, 'expense', 50), [tx]);
  const incomeSources = useMemo(() => groupByDescription(transactions, 'income', 20), [transactions]);
  const incomeTotal = incomeSources.reduce((s, x) => s + x.value, 0);
  const trendTotal = trends.reduce((s, t) => s + t.avg, 0);
  const wdMax = wd.reduce((a, b) => (b.value > a.value ? b : a), wd[0] || { value: 0 });
  const delta = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
  const lastInc = series[series.length - 1]?.inc || 0; const firstInc = series.find((s) => s.inc > 0)?.inc || 0;

  const insights = useMemo(() => {
    const arr = [];
    if (byCat[0]) arr.push({ t: 'info', icon: CreditCard, m: `Maior gasto: ${byCat[0].name} (${formatCurrency(byCat[0].value)}).` });
    if (cur.rate >= 20) arr.push({ t: 'ok', icon: CheckCircle2, m: `Ótima taxa de poupança: ${cur.rate.toFixed(0)}% da renda neste mês.` });
    else if (cur.inc > 0 && cur.rate < 0) arr.push({ t: 'warn', icon: AlertTriangle, m: 'Você gastou mais do que ganhou neste mês. Reveja despesas.' });
    if (prev.exp && cur.exp > prev.exp * 1.2) arr.push({ t: 'warn', icon: AlertTriangle, m: `Despesas ${Math.round((cur.exp / prev.exp - 1) * 100)}% acima do mês anterior.` });
    const rising = trends.find((t) => t.change > 25 && t.total > 0);
    if (rising) arr.push({ t: 'warn', icon: AlertTriangle, m: `${rising.name} vem subindo: +${rising.change.toFixed(0)}% na comparação recente.` });
    const falling = trends.find((t) => t.change < -25 && t.total > 0);
    if (falling) arr.push({ t: 'ok', icon: TrendingUp, m: `Você reduziu ${falling.name} em ${Math.abs(falling.change).toFixed(0)}% — continue assim.` });
    if (!arr.length) arr.push({ t: 'ok', icon: CheckCircle2, m: 'Finanças equilibradas. Nenhum alerta significativo este mês.' });
    return arr.slice(0, 4);
  }, [cur, prev, byCat, trends]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const Kpi = ({ icon: Ic, label, value, chip, sub, cls }) => (
    <div className={`rounded-2xl ring-1 p-4 flex items-center gap-3 bg-[hsl(var(--card))] min-w-0 ${cls}`}>
      <span className="w-12 h-12 rounded-xl grid place-items-center bg-black/10 dark:bg-white/5 ring-1 ring-white/10 shrink-0"><Ic className="w-7 h-7" /></span>
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted truncate">{label}</p>{chip}</div><div className="flex items-baseline justify-between gap-2"><p className="font-display text-2xl font-bold truncate">{value}</p>{sub && <p className="text-[10px] text-muted whitespace-nowrap">{sub}</p>}</div></div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Brain} lead="Central de Inteligência" accent="" iconClass="text-sky-400" subtitle="Insights, anomalias e previsões automáticas (contas + cartão) — 100% local"
        art={<BrainArt className="w-[400px] h-40 xl:mr-[260px]" />}
        actions={<GlowButton tone="sky" onClick={() => { setAiOpen(true); ai.gerar(); }} disabled={ai.busy} className="py-2.5 px-5">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Analisar de novo' : 'Analisar com IA'}</GlowButton>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Receita do mês" value={<AnimatedValue value={cur.inc} format={formatCurrency} />} chip={<DeltaChip v={delta(cur.inc, prev.inc)} />} sub={delta(cur.inc, prev.inc) != null ? 'vs. mês anterior' : null} cls="ring-teal-400/50 text-teal-400 [&_p]:text-[hsl(var(--text))] [&_p.text-muted]:text-[hsl(var(--muted))]" />
        <Kpi icon={TrendingDown} label="Despesa do mês" value={<AnimatedValue value={cur.exp} format={formatCurrency} />} chip={<DeltaChip v={delta(cur.exp, prev.exp)} invert />} sub={delta(cur.exp, prev.exp) != null ? 'vs. mês anterior' : null} cls="ring-pink-400/50 text-pink-400 [&_p]:text-[hsl(var(--text))] [&_p.text-muted]:text-[hsl(var(--muted))]" />
        <Kpi icon={Wallet} label="Saldo total" value={<AnimatedValue value={totalBalance} format={formatCurrency} />} cls="ring-sky-400/50 text-sky-400 [&_p]:text-[hsl(var(--text))] [&_p.text-muted]:text-[hsl(var(--muted))]" />
        <Kpi icon={Target} label="Previsão próx. mês" value={formatCurrency(forecast.net)} chip={<span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${forecast.net >= 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-indigo-500/30 text-indigo-700 dark:text-indigo-100'}`}>{forecast.net >= 0 ? 'Positivo' : 'Negativo'}</span>} sub={null} cls="ring-amber-400/60 text-amber-400 [&_p]:text-[hsl(var(--text))] [&_p.text-muted]:text-[hsl(var(--muted))]" />
      </div>

      {(ai.busy || ai.data) && aiOpen && (
        <section className="rounded-3xl ring-1 ring-sky-400/40 bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-2 mb-1"><Brain className="w-5 h-5 text-sky-400" /><b>Leitura inteligente do mês</b>{ai.data && <span className="text-[11px] text-muted inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-emerald-500" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>}<button onClick={() => setAiOpen(false)} className="ml-auto p-1 text-muted" aria-label="Fechar"><X className="w-4 h-4" /></button></div>
          {ai.busy ? <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Analisando seus dados…</p> : <Markdown text={ai.data.text} className="text-sm" />}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-6" tone="sky" title="Insights Automáticos" icon={Lightbulb} iconClass="text-amber-400">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2.5 min-w-0">
              {insights.map((i, k) => (
                <div key={k} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl ring-1 text-sm ${i.t === 'warn' ? 'ring-rose-400/50 bg-rose-500/10' : i.t === 'ok' ? 'ring-teal-400/50 bg-teal-500/10' : 'ring-sky-400/40 bg-sky-500/10'}`}>
                  <i.icon className={`w-5 h-5 shrink-0 ${i.t === 'warn' ? 'text-rose-400' : i.t === 'ok' ? 'text-teal-400' : 'text-sky-400'}`} /><span>{i.m}</span>
                </div>
              ))}
            </div>
            <ChipArt className="hidden 2xl:block w-44 h-36 shrink-0" />
          </div>
        </Panel>
        <Panel className="xl:col-span-6" tone="violet" title="Anomalias Detectadas" icon={AlertTriangle} iconClass="text-rose-400" action={anomalies.length > 5 && <button onClick={() => setModal('anom')} className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-violet-400/50 flex items-center gap-1">Ver todas ({anomalies.length})<ArrowRight className="w-3.5 h-3.5" /></button>}>
          {anomalies.length === 0 ? <div className="flex flex-col items-center py-6 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Nenhuma cobrança fora do padrão</p></div>
            : anomalies.slice(0, 5).map((a) => { const Ic = iconOf(`${a.description} ${a.category}`); return (
              <div key={a.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <Ic className="w-4 h-4 text-violet-400 shrink-0" /><span className="flex-1 text-sm truncate"><b className="font-semibold">{a.description}</b> <span className="text-muted">· {a.category}</span></span>
                <span title="Desvios-padrão acima da média da categoria" className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-300">z {a.z.replace('.', ',')}</span>
                <b className="text-sm text-rose-500 w-24 text-right">{formatCurrency(a.amount)}</b>
              </div>); })}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-4" tone="amber" glow title="Cobranças que subiram de preço" icon={TrendingUp} iconClass="text-amber-400">
          {hikes.length === 0 ? <div className="flex flex-col items-center py-6 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Nenhum aumento recorrente detectado</p></div>
            : hikes.slice(0, 5).map((h, i) => { const Ic = iconOf(h.name); return (
              <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-[hsl(var(--border))] last:border-0 text-sm">
                <Ic className="w-4 h-4 text-amber-400 shrink-0" /><span className="flex-1 truncate font-medium">{h.name}</span>
                <span className="text-xs text-muted whitespace-nowrap">{formatCurrency(h.from)} → {formatCurrency(h.to)}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-700 dark:text-amber-200 w-12 text-center">+{h.changePct}%</span>
              </div>); })}
          <p className="text-[11px] text-muted mt-2">Último valor comparado à mediana do histórico (mín. 3 meses).</p>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Gastos por Dia da Semana" icon={CalendarDays} iconClass="text-violet-400" subtitle="Mês atual">
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wd} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <defs><linearGradient id="inWd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#6366f1" /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k` : Math.round(v))} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34}>{wd.map((e, i) => <Cell key={i} fill={e === wdMax && e.value > 0 ? 'url(#inWd)' : e.weekend ? '#f43f5e' : '#6366f1'} fillOpacity={e === wdMax ? 1 : 0.55} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {wdMax.value > 0 && <p className="text-xs text-muted">Pico: <b className="text-[hsl(var(--text))]">{wdMax.name}</b> com {formatCurrency(wdMax.value)}</p>}
        </Panel>
        <Panel className="xl:col-span-4" tone="sky" title="Evolução — 6 meses" icon={TrendingUp} iconClass="text-sky-400" action={firstInc > 0 && <span className="flex items-center gap-1 text-xs"><span className="text-muted">Receita</span><DeltaChip v={delta(lastInc, firstInc)} /></span>}>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inc" name="Receita" fill="#2dd4bf" radius={[5, 5, 0, 0]} maxBarSize={18} />
                <Bar dataKey="exp" name="Despesa" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={18} />
                <Line dataKey="inc" name="Tendência" stroke="#c084fc" strokeWidth={2} dot={false} legendType="none" type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-5" tone="violet" title={<span>Tendência por categoria <span className="text-xs font-normal text-muted">(média mensal e variação no período)</span></span>} icon={TrendingUp} iconClass="text-fuchsia-400">
          {trends.length === 0 ? <p className="text-sm text-muted">Precisa de pelo menos 2 meses com gastos categorizados.</p> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Donut size={150} thickness={0.22} data={trends.slice(0, 8).map((t) => ({ name: t.name, value: t.avg, color: t.color }))} center={<><span className="font-display font-bold">{formatCurrency(trendTotal)}</span><span className="text-[10px] text-muted">Total mensal</span></>} />
              <div className="flex-1 w-full space-y-1.5">{trends.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} /><span className="flex-1 truncate">{t.name}</span><span className="text-xs text-muted tabular-nums">{formatCurrency(t.avg)}/mês</span>
                  <span className={`w-14 text-right text-xs font-semibold flex items-center justify-end gap-0.5 ${Math.abs(t.change) < 5 ? 'text-muted' : t.change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{Math.abs(t.change) < 5 ? '~' : <>{t.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(t.change).toFixed(0)}%</>}</span></div>))}</div>
            </div>)}
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Top Estabelecimentos" icon={Trophy} iconClass="text-amber-400" action={merchants.length > 5 && <button onClick={() => setModal('merch')} className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-[hsl(var(--border))] flex items-center gap-1">Ver todos<ArrowRight className="w-3.5 h-3.5" /></button>}>
          {merchants.length === 0 ? <p className="text-sm text-muted">Nenhum dado disponível</p> : merchants.slice(0, 5).map((mch, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg odd:bg-black/[.03] dark:odd:bg-white/[.03] text-sm">
              <span className={`w-7 h-7 rounded-lg grid place-items-center text-white text-xs font-bold bg-gradient-to-br ${RANK[i]}`}>{i + 1}</span>
              <span className="flex-1 truncate font-medium">{mch.name}</span><span className="text-muted text-xs">{mch.count}x</span><b className="w-24 text-right">{formatCurrency(mch.value)}</b>
            </div>))}
        </Panel>
        <Panel className="xl:col-span-3" tone="sky" title="Fontes de Receita" icon={Coins} iconClass="text-sky-400" action={incomeSources.length > 2 && <button onClick={() => setModal('inc')} className="text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ring-[hsl(var(--border))] flex items-center gap-1">Ver todas<ArrowRight className="w-3.5 h-3.5" /></button>}>
          {incomeSources.length === 0 ? <p className="text-sm text-muted">Nenhuma receita registrada</p> : (
            <div className="grid grid-cols-2 gap-2.5">{incomeSources.slice(0, 2).map((s, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl ring-1 ring-sky-400/40 bg-gradient-to-b from-sky-500/15 to-transparent p-3">
                {i === 0 ? <Briefcase className="w-6 h-6 text-sky-400" /> : <Layers className="w-6 h-6 text-violet-400" />}
                <p className="text-xs mt-2 truncate">{s.name}</p><p className="font-display text-base font-bold text-emerald-600 dark:text-emerald-300 truncate" title={formatCurrency(s.value)}>{formatCurrency(s.value)}</p>
                <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">{pct1(incomeTotal ? (s.value / incomeTotal) * 100 : 0)}</span><p className="text-[10px] text-muted">do total</p>
              </div>))}</div>)}
        </Panel>
      </div>

      <Panel title="Análise mensal comparativa" icon={Layers} iconClass="text-sky-400">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
          <thead><tr className="text-muted text-xs"><th className="text-left font-medium pb-2">Mês</th><th className="text-right font-medium pb-2">Receita</th><th className="text-right font-medium pb-2">Despesa</th><th className="text-right font-medium pb-2">Saldo</th><th className="text-right font-medium pb-2">Poupança</th></tr></thead>
          <tbody>{series.map((s) => <tr key={s.mk} className="border-t border-[hsl(var(--border))]"><td className="py-2 capitalize">{s.name}</td><td className="text-right text-emerald-500">{formatCurrency(s.inc)}</td><td className="text-right text-rose-500">{formatCurrency(s.exp)}</td><td className={`text-right font-semibold ${s.net < 0 ? 'text-rose-500' : ''}`}>{formatCurrency(s.net)}</td><td className="text-right text-muted">{s.inc > 0 ? pct1((s.net / s.inc) * 100) : '—'}</td></tr>)}</tbody>
        </table></div>
        <p className="text-[11px] text-muted mt-2">Previsão do próximo mês: receita {formatCurrency(forecast.inc)} • despesa {formatCurrency(forecast.exp)} ({forecast.seasonal ? 'modelo sazonal' : 'tendência + média dos últimos 6 meses'}).</p>
      </Panel>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'anom' ? 'Anomalias detectadas' : modal === 'merch' ? 'Estabelecimentos' : 'Fontes de receita'} maxWidth="max-w-xl" footer={<Button onClick={() => setModal(null)}>Fechar</Button>}>
        <div className="divide-y divide-[hsl(var(--border))] max-h-[60vh] overflow-y-auto">
          {modal === 'anom' && anomalies.map((a) => <div key={a.id} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 truncate">{a.description} <span className="text-muted">· {a.category} · {String(a.date).slice(0, 10).split('-').reverse().join('/')}</span></span><span className="text-xs text-muted">média {formatCurrency(a.average)}</span><b className="text-rose-500">{formatCurrency(a.amount)}</b></div>)}
          {modal === 'merch' && merchants.map((m2, i) => <div key={i} className="flex items-center gap-3 py-2 text-sm"><span className="w-6 text-muted">{i + 1}</span><span className="flex-1 truncate">{m2.name}</span><span className="text-xs text-muted">{m2.count}x</span><b>{formatCurrency(m2.value)}</b></div>)}
          {modal === 'inc' && incomeSources.map((s, i) => <div key={i} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 truncate">{s.name}</span><span className="text-xs text-muted">{pct1(incomeTotal ? (s.value / incomeTotal) * 100 : 0)}</span><b className="text-emerald-500">{formatCurrency(s.value)}</b></div>)}
        </div>
      </Modal>
    </div>
  );
}
