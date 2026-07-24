import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries, weekdaySpending, behaviorProfile } from '../lib/analytics.js';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShieldCheck, Activity, TrendingUp, Clock, BarChart3, HeartPulse } from 'lucide-react';

export default function BehavioralAnalysis() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const months = useMemo(() => lastMonths(6), []);
  const series = useMemo(() => monthlySeries(transactions, months), [transactions, months]);
  const wd = useMemo(() => weekdaySpending(transactions, null), [transactions]);
  const b = useMemo(() => behaviorProfile({ transactions, months, catMap }), [transactions, months, catMap]);
  const maxDist = b.distribution[0]?.value || 1;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><BarChart3 className="w-6 h-6 text-violet-500" /> Analise Comportamental</span>}
        subtitle="Seus padroes de consumo, decodificados" />

      {/* Perfil */}
      <div className="rounded-2xl p-6 shadow-soft" style={{ background: 'linear-gradient(120deg,#eef2ff,#faf5ff)' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 flex items-center justify-center text-indigo-600"><ShieldCheck className="w-7 h-7" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2"><h2 className="font-display text-2xl font-bold text-slate-800">Perfil: {b.profile}</h2><Badge color="violet">{b.profile}</Badge></div>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">{b.desc}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Impulsividade" value={`${b.impulsivity}%`} sub={b.impulsivity < 20 ? 'Baixa' : b.impulsivity < 35 ? 'Moderada' : 'Alta'} color="#10b981" />
        <MetricCard label="Consistencia" value={`${b.consistency}%`} sub={b.consistency >= 70 ? 'Alta' : 'Variavel'} color="#0ea5e9" />
        <MetricCard label="Taxa Poupanca" value={`${b.savingsRate}%`} sub={b.savingsRate >= 20 ? 'Otima' : 'Baixa'} color="#10b981" />
        <MetricCard label="Gastos FDS" value={`${b.weekendPct}%`} sub={`Pico: ${b.peakDay}`} color="#8b5cf6" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-violet-500" /> Perfil de Comportamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={b.radar} outerRadius="72%"><PolarGrid stroke="hsl(var(--border))" /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} /><Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} /></RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-indigo-500" /> Padrao por Dia da Semana</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wd}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="value" radius={[6,6,0,0]} maxBarSize={36}>{wd.map((e, i) => <Cell key={i} fill={e.weekend ? '#f43f5e' : '#6366f1'} />)}</Bar></BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs text-muted mt-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Fim de semana</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Semana</span></div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Evolucao — 6 meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Line dataKey="inc" name="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} /><Line dataKey="exp" name="Despesa" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Distribuicao de Gastos</h3>
          {b.distribution.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem despesas registradas</p>
            : <div className="space-y-3">{b.distribution.slice(0, 6).map((c, i) => (
              <div key={i}><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div><div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.value / maxDist) * 100}%`, background: c.color }} /></div></div>
            ))}</div>}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><HeartPulse className="w-4 h-4 text-rose-500" /> Padroes Comportamentais Detectados</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Pattern icon={Clock} color="#0ea5e9" title="Comportamento Temporal" text={`Voce gasta mais as ${b.peakDay}. Fins de semana representam ${b.weekendPct}% do gasto de dias uteis.`} />
          <Pattern icon={BarChart3} color="#8b5cf6" title="Padrao de Ticket" text={`Ticket medio de ${formatCurrency(b.avgTicket)}. ${b.avgTicket > 200 ? 'Compras de valor elevado.' : 'Compras de valor moderado.'}`} />
          <Pattern icon={TrendingUp} color="#10b981" title="Consistencia Financeira" text={`${b.consistency}% de consistencia mensal. ${b.consistency >= 70 ? 'Gastos estaveis.' : 'Variacoes moderadas — pode indicar gastos sazonais.'}`} />
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <Card className="py-4 hover-lift text-center">
      <p className="font-display text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}
function Pattern({ icon: Icon, color, title, text }) {
  return (
    <div className="p-4 rounded-xl border border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 mb-1"><Icon className="w-4 h-4" style={{ color }} /><span className="font-semibold text-sm">{title}</span></div>
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}
