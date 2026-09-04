import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCard, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { Reveal, useCountUp } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries, monthTotals, healthScore, combineExpenses, categoryTrends, behaviorProfile, detectSubscriptions, recommendations } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HeartPulse, TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle, Lightbulb, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { monthKey } from '../lib/utils.js';

export default function FinancialHealth() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const months = useMemo(() => lastMonths(6), []);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const series = useMemo(() => monthlySeries(tx, months), [tx, months]);
  const cur = useMemo(() => monthTotals(tx, monthKey(new Date())), [tx]);
  const h = useMemo(() => healthScore({ transactions: tx, months, totalBalance, categories, cards }), [tx, months, totalBalance, categories, cards]);
  const trends = useMemo(() => categoryTrends(tx, months, catMap), [tx, months, catMap]);
  const behavior = useMemo(() => behaviorProfile({ transactions: tx, months, catMap }), [tx, months, catMap]);
  const subs = useMemo(() => detectSubscriptions(tx), [tx]);
  const recs = useMemo(() => recommendations({ h, b: behavior, trends, subsCount: subs.length }), [h, behavior, trends, subs]);

  const scoreColor = h.score >= 80 ? '#10b981' : h.score >= 60 ? '#0ea5e9' : h.score >= 40 ? '#f59e0b' : '#f43f5e';

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><HeartPulse className="w-6 h-6 text-emerald-500" /> Saúde Financeira</span>}
        subtitle="Diagnostico automático com contas e cartao — 100% local" />

      <AiInsight storageKey="health" title="Diagnóstico com IA" agentFocus="saúde financeira"
        prompt="Avalie minha saúde financeira em até 3 frases (poupança, reserva e comprometimento) e termine com 2 dicas objetivas para melhorar. Seja direto." />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Score */}
        <Reveal i={0} className="lg:col-span-1"><Card className="flex flex-col items-center justify-center text-center h-full">
          <ScoreRing score={h.score} color={scoreColor} />
          <p className="text-sm text-muted mt-3">Score de saude financeira</p>
          <span className="mt-1 px-3 py-1 rounded-full text-sm font-bold text-white" style={{ background: scoreColor }}>{h.label}</span>
        </Card></Reveal>

        {/* Pilares */}
        <Reveal i={1} className="lg:col-span-2"><Card className="h-full">
          <h3 className="font-semibold mb-4">{h.pillars.length} Pilares Avaliados</h3>
          <div className="space-y-3">
            {h.pillars.map((p) => {
              const pct = Math.round((p.score / p.max) * 100);
              const col = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{p.name}</span><span className="text-muted">{p.score}/{p.max}</span></div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} /></div>
                  <p className="text-xs text-muted mt-0.5">{p.detail} — {p.tip}</p>
                </div>
              );
            })}
          </div>
        </Card></Reveal>
      </div>

      {/* KPIs com sparkline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><SparkKpi label="Receita media" value={formatCurrency(h.avgInc)} data={series.map((s) => s.inc)} color="#10b981" icon={TrendingUp} /></Reveal>
        <Reveal i={1}><SparkKpi label="Despesa media" value={formatCurrency(h.avgExp)} data={series.map((s) => s.exp)} color="#f43f5e" icon={TrendingDown} /></Reveal>
        <Reveal i={2}><SparkKpi label="Saldo total" value={formatCurrency(totalBalance)} data={series.map((s) => s.net)} color="#6366f1" icon={Wallet} /></Reveal>
        <Reveal i={3}><SparkKpi label="Poupança (mes)" value={`${cur.rate.toFixed(0)}%`} data={series.map((s) => s.inc - s.exp)} color="#f59e0b" icon={PiggyBank} /></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Evolucao — Últimos 6 meses</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="hInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              <linearGradient id="hExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
            <YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            <Area dataKey="inc" name="Receita" stroke="#10b981" strokeWidth={2} fill="url(#hInc)" />
            <Area dataKey="exp" name="Despesa" stroke="#f43f5e" strokeWidth={2} fill="url(#hExp)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Reserva de emergencia */}
      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-500" /> Reserva de emergencia</h3>
          <Badge color={h.reserveMonths >= 3 ? 'emerald' : h.reserveMonths >= 1 ? 'amber' : 'rose'}>{h.reserveMonths.toFixed(1)} meses cobertos</Badge>
        </div>
        <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (h.reserveMonths / 6) * 100)}%`, background: h.reserveMonths >= 3 ? '#10b981' : h.reserveMonths >= 1 ? '#f59e0b' : '#f43f5e' }} />
        </div>
        <p className="text-xs text-muted mt-2">Seu saldo cobre <b>{h.reserveMonths.toFixed(1)}</b> mes(es) de despesa media ({formatCurrency(h.avgExp)}/mês). Meta saudavel: 3 a 6 meses ({formatCurrency(h.avgExp * 3)} a {formatCurrency(h.avgExp * 6)}).</p>
      </Card>

      {/* Tendencias por categoria */}
      {trends.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-indigo-500" /> Tendencia de gastos por categoria <span className="text-xs text-muted font-normal">(inicio vs fim do período)</span></h3>
          <div className="space-y-2">
            {trends.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-sm flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted">{formatCurrency(t.avg)}/mês</span>
                <span className={`text-xs font-semibold flex items-center gap-0.5 w-16 justify-end ${Math.abs(t.change) < 5 ? 'text-muted' : t.change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {Math.abs(t.change) < 5 ? 'estavel' : <>{t.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(t.change).toFixed(0)}%</>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-amber-500" /> Recomendações automáticas</h3>
        <div className="space-y-2">
          {recs.map((a, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${a.type === 'warn' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : a.type === 'tip' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
              {a.type === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : a.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />}
              <div><p className="font-semibold">{a.title}</p><p className="opacity-90">{a.text}</p></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoreRing({ score, color }) {
  const v = useCountUp(score, 950);
  const r = 52, c = 2 * Math.PI * r, off = c - (v / 100) * c;
  return (
    <div className="relative w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="12" />
        <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-extrabold" style={{ color }}>{Math.round(v)}</span>
        <span className="text-xs text-muted">/ 100</span>
      </div>
    </div>
  );
}

function SparkKpi({ label, value, data, color, icon: Icon }) {
  const max = Math.max(...data.map(Math.abs), 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * 100},${28 - (v / max) * 22}`).join(' ');
  return (
    <Card className="py-3 hover-lift">
      <div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><Icon className="w-4 h-4" style={{ color }} /></div>
      <p className="font-display text-lg font-bold mt-1" style={{ color }}>{value}</p>
      <svg viewBox="0 0 100 30" className="w-full h-8 mt-1" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>
    </Card>
  );
}
