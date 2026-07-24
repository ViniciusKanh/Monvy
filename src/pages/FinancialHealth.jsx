import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCard } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner } from '../components/ui';
import { Reveal, useCountUp } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries, monthTotals, healthScore } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HeartPulse, TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle, Lightbulb } from 'lucide-react';
import { monthKey } from '../lib/utils.js';

export default function FinancialHealth() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });

  const months = useMemo(() => lastMonths(6), []);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const series = useMemo(() => monthlySeries(transactions, months), [transactions, months]);
  const cur = useMemo(() => monthTotals(transactions, monthKey(new Date())), [transactions]);
  const h = useMemo(() => healthScore({ transactions, months, totalBalance, categories, cards }), [transactions, months, totalBalance, categories, cards]);

  const scoreColor = h.score >= 80 ? '#10b981' : h.score >= 60 ? '#0ea5e9' : h.score >= 40 ? '#f59e0b' : '#f43f5e';

  const actions = useMemo(() => {
    const a = [];
    if (h.rate <= 0) a.push({ t: 'warn', m: 'Voce esta gastando tudo ou mais do que ganha. Revise seus gastos com urgencia.' });
    if (h.avgInc > 0 && h.avgExp / h.avgInc > 0.9) a.push({ t: 'warn', m: 'Quase toda a renda comprometida. Revise assinaturas, parcelamentos e gastos fixos.' });
    if (h.reserveMonths < 3) a.push({ t: 'tip', m: `Sua reserva cobre ${h.reserveMonths.toFixed(1)} mes(es). Meta: ${formatCurrency(h.reserveTarget)} (3 meses de despesas).` });
    if (h.rate > 0 && h.rate < 0.1) a.push({ t: 'tip', m: 'Tente elevar sua taxa de poupanca para pelo menos 10-20% da renda.' });
    if (!a.length) a.push({ t: 'ok', m: 'Parabens! Suas financas estao saudaveis. Considere investir o excedente.' });
    return a;
  }, [h]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><HeartPulse className="w-6 h-6 text-emerald-500" /> Saude Financeira</span>}
        subtitle="Diagnostico inteligente baseado nos seus dados reais" />

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
        <Reveal i={3}><SparkKpi label="Poupanca (mes)" value={`${cur.rate.toFixed(0)}%`} data={series.map((s) => s.inc - s.exp)} color="#f59e0b" icon={PiggyBank} /></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Evolucao — Ultimos 6 meses</h3>
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

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-amber-500" /> Plano de Acao Personalizado</h3>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${a.t === 'warn' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : a.t === 'tip' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
              {a.t === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <Lightbulb className="w-4 h-4 mt-0.5" />}<span>{a.m}</span>
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
