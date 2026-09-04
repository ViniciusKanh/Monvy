import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Badge, Spinner } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { lastMonths, monthlySeries, monthTotals, categoryBreakdown, weekdaySpending, seasonalForecast, detectAnomalies, detectPriceHikes, groupByDescription, colorAt, combineExpenses, categoryTrends } from '../lib/analytics.js';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Brain, TrendingUp, TrendingDown, Wallet, Eye, AlertTriangle, CheckCircle2, Sparkles, ShoppingBag, CalendarDays, Lightbulb, ArrowUpRight } from 'lucide-react';

export default function Intelligence() {
  const mk = monthKey(new Date());
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const months = useMemo(() => lastMonths(6), []);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const series = useMemo(() => monthlySeries(tx, months), [tx, months]);
  const cur = useMemo(() => monthTotals(tx, mk), [tx, mk]);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const forecast = useMemo(() => seasonalForecast(tx), [tx]);
  const byCat = useMemo(() => categoryBreakdown(tx, mk, catMap), [tx, mk, catMap]);
  const wd = useMemo(() => weekdaySpending(tx, mk), [tx, mk]);
  const anomalies = useMemo(() => detectAnomalies(tx, catMap), [tx, catMap]);
  const hikes = useMemo(() => detectPriceHikes(tx), [tx]);
  const trends = useMemo(() => categoryTrends(tx, months, catMap), [tx, months, catMap]);
  const merchants = useMemo(() => groupByDescription(tx, 'expense'), [tx]);
  const incomeSources = useMemo(() => groupByDescription(transactions, 'income'), [transactions]);

  const insights = useMemo(() => {
    const arr = [];
    if (cur.rate >= 20) arr.push({ t: 'ok', m: `Ótima taxa de poupança: ${cur.rate.toFixed(0)}% da renda neste mês.` });
    else if (cur.inc > 0 && cur.rate < 0) arr.push({ t: 'warn', m: 'Você gastou mais do que ganhou neste mês. Reveja despesas.' });
    const prev = series[series.length - 2];
    if (prev && cur.exp > prev.exp * 1.2) arr.push({ t: 'warn', m: `Despesas ${Math.round((cur.exp / (prev.exp || 1) - 1) * 100)}% acima do mês anterior.` });
    if (byCat[0]) arr.push({ t: 'info', m: `Maior gasto: ${byCat[0].name} (${formatCurrency(byCat[0].value)}).` });
    const rising = trends.find((t) => t.change > 25 && t.total > 0);
    if (rising) arr.push({ t: 'warn', m: `${rising.name} vem subindo: +${rising.change.toFixed(0)}% na comparação recente.` });
    const falling = trends.find((t) => t.change < -25 && t.total > 0);
    if (falling) arr.push({ t: 'ok', m: `Você reduziu ${falling.name} em ${Math.abs(falling.change).toFixed(0)}% — continue assim.` });
    if (!arr.length) arr.push({ t: 'ok', m: 'Finanças equilibradas. Nenhum alerta significativo este mês.' });
    return arr;
  }, [cur, series, byCat, trends]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Brain className="w-6 h-6 text-indigo-500" /> Central de Inteligência</span>}
        subtitle="Insights, anomalias e previsões automáticas (contas + cartão) — 100% local" />

      <AiInsight storageKey="intelligence" title="Leitura inteligente do mês" agentFocus="inteligência"
        prompt="Em até 3 frases, aponte os 2 pontos de atenção mais importantes das minhas finanças deste mês e termine com 1 ação prática. Seja direto e use números quando ajudar." />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Kpi icon={TrendingUp} tone="emerald" label="Receita do mês" amount={cur.inc} /></Reveal>
        <Reveal i={1}><Kpi icon={TrendingDown} tone="rose" label="Despesa do mês" amount={cur.exp} /></Reveal>
        <Reveal i={2}><Kpi icon={Wallet} tone="indigo" label="Saldo total" amount={totalBalance} /></Reveal>
        <Reveal i={3}><Kpi icon={Eye} tone="violet" label="Previsão próx. mês" amount={forecast.net} sub={forecast.net >= 0 ? 'Positivo' : 'Negativo'} /></Reveal>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-amber-500" /> Insights Automáticos</h3>
          <div className="space-y-2">
            {insights.map((i, k) => (
              <div key={k} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${i.t === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : i.t === 'warn' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>
                {i.t === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : i.t === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <Sparkles className="w-4 h-4 mt-0.5" />}
                <span>{i.m}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-500" /> Anomalias Detectadas</h3>
          {anomalies.length === 0 ? <div className="flex flex-col items-center py-8 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Nenhuma cobranca fora do padrão</p></div>
            : <div className="space-y-2">{anomalies.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10">
                  <span className="flex-1 truncate">{a.description} <span className="text-muted">· {a.category}</span></span>
                  <Badge color="rose">z {a.z}</Badge>
                  <span className="font-semibold text-rose-500">{formatCurrency(a.amount)}</span>
                </div>
              ))}</div>}
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><ArrowUpRight className="w-4 h-4 text-amber-500" /> Cobranças que subiram de preço</h3>
          {hikes.length === 0 ? <div className="flex flex-col items-center py-8 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Nenhum aumento recorrente detectado</p></div>
            : <div className="space-y-2">{hikes.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <span className="flex-1 truncate">{h.name} <span className="text-muted">· {formatCurrency(h.from)} → {formatCurrency(h.to)}</span></span>
                  <Badge color="amber">+{h.changePct}%</Badge>
                </div>
              ))}</div>}
          <p className="text-xs text-muted mt-2">Compara o último valor com a mediana do histórico (min. 3 meses). Tudo calculado localmente.</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-indigo-500" /> Gastos por Dia da Semana</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={wd}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="value" radius={[6,6,0,0]} maxBarSize={36}>{wd.map((e,i)=><Cell key={i} fill={e.weekend ? '#f43f5e' : '#6366f1'} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Evolucao — 6 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} barGap={4}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="inc" name="Receita" fill="#10b981" radius={[5,5,0,0]} maxBarSize={22} /><Bar dataKey="exp" name="Despesa" fill="#f43f5e" radius={[5,5,0,0]} maxBarSize={22} /></BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {trends.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-indigo-500" /> Tendencia por categoria <span className="text-xs text-muted font-normal">(media mensal e variacao no período)</span></h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {trends.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-sm flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted">{formatCurrency(t.avg)}/mês</span>
                <span className={`text-xs font-semibold flex items-center gap-0.5 w-14 justify-end ${Math.abs(t.change) < 5 ? 'text-muted' : t.change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {Math.abs(t.change) < 5 ? '~' : <>{t.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(t.change).toFixed(0)}%</>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><ShoppingBag className="w-4 h-4 text-violet-500" /> Top Estabelecimentos</h3>
          {merchants.length === 0 ? <p className="text-sm text-muted py-6 text-center">Nenhum dado disponível</p>
            : merchants.map((mch, i) => (<div key={i} className="flex items-center gap-2 py-1.5 text-sm"><span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs" style={{ background: colorAt(i) }}>{i + 1}</span><span className="flex-1 truncate">{mch.name}</span><span className="text-muted text-xs">{mch.count}x</span><span className="font-semibold">{formatCurrency(mch.value)}</span></div>))}
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-emerald-500" /> Fontes de Receita</h3>
          {incomeSources.length === 0 ? <p className="text-sm text-muted py-6 text-center">Nenhuma receita registrada</p>
            : <div className="grid grid-cols-2 gap-2">{incomeSources.map((s, i) => (<div key={i} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10"><p className="text-xs text-muted truncate">{s.name}</p><p className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(s.value)}</p></div>))}</div>}
        </Card>
      </div>

      {/* Previsão + comparativo */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Eye className="w-4 h-4 text-violet-500" /> Previsão Próximo Mês {forecast.seasonal && <Badge color="violet">sazonal</Badge>}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10"><p className="text-xs text-muted">Receita estimada</p><p className="font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(forecast.inc)}</p></div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10"><p className="text-xs text-muted">Despesa estimada</p><p className="font-bold text-rose-600 dark:text-rose-300">{formatCurrency(forecast.exp)}</p></div>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10"><p className="text-xs text-muted">Saldo previsto</p><p className="font-display text-2xl font-bold text-indigo-600 dark:text-indigo-300">{formatCurrency(forecast.net)}</p><p className="text-xs text-muted mt-0.5">{forecast.seasonal ? "Modelo sazonal (tendencia + media do mês-calendário)" : "Tendencia (regressao) + media dos ultimos 6 meses"}</p></div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Análise Mensal Comparativa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-muted text-xs"><th className="text-left font-medium pb-2">Mês</th><th className="text-right font-medium pb-2">Receita</th><th className="text-right font-medium pb-2">Despesa</th><th className="text-right font-medium pb-2">Saldo</th></tr></thead>
              <tbody>{series.map((s) => (<tr key={s.mk} className="border-t border-[hsl(var(--border))]"><td className="py-2 capitalize">{s.name}</td><td className="text-right text-emerald-500">{formatCurrency(s.inc)}</td><td className="text-right text-rose-500">{formatCurrency(s.exp)}</td><td className={`text-right font-semibold ${s.net < 0 ? 'text-rose-500' : ''}`}>{formatCurrency(s.net)}</td></tr>))}</tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* categoria donut */}
      {byCat.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Gastos por Categoria — Mês Atual</h3>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">{byCat.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart></ResponsiveContainer>
            <div className="space-y-2">{byCat.slice(0, 6).map((c, i) => (<div key={i} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div>))}</div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, amount, sub }) {
  const map = { emerald: 'text-emerald-500 bg-emerald-500/10', rose: 'text-rose-500 bg-rose-500/10', indigo: 'text-indigo-500 bg-indigo-500/10', violet: 'text-violet-500 bg-violet-500/10' };
  return (
    <Card className="py-4 hover-lift h-full">
      <div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><span className={`w-8 h-8 rounded-lg flex items-center justify-center ${map[tone]}`}><Icon className="w-4 h-4" /></span></div>
      <p className="font-display text-xl font-bold mt-1"><AnimatedValue value={amount} format={formatCurrency} /></p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}
