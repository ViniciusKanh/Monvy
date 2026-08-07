import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Account, Transaction, Subscription, CreditCardInvoice, Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge, Select } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Wallet, CalendarClock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d) => d.toISOString().slice(0, 10);
const clampDay = (y, m, day) => Math.min(day, new Date(y, m + 1, 0).getDate());

export default function CashFlow() {
  const [horizon, setHorizon] = useState(90);
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });

  const startBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00');
  const end = addDays(today, horizon);

  // eventos futuros (nao materializados no saldo atual)
  const events = useMemo(() => {
    const ev = [];
    const within = (d) => d > today && d <= end;
    // lancamentos pendentes com data futura
    for (const t of transactions) {
      if (t.type === 'transfer') continue;
      if ((t.status || 'pending') === 'completed') continue;
      const d = new Date(String(t.date).slice(0, 10) + 'T00:00');
      if (within(d) || (d <= today)) { // inclui vencidos (impacto imediato)
        const day = d <= today ? iso(addDays(today, 1)) : iso(d);
        ev.push({ date: day, amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount), label: t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), kind: t.type });
      }
    }
    // assinaturas mensais
    for (const s of subs) {
      if (s.is_active === false) continue;
      const day = Number(s.renewal_day) || 1;
      for (let k = 0; k <= Math.ceil(horizon / 30) + 1; k++) {
        const base = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(base.getFullYear(), base.getMonth(), clampDay(base.getFullYear(), base.getMonth(), day));
        if (within(d)) ev.push({ date: iso(d), amount: -Number(s.amount || 0), label: `${s.icon_emoji || '📱'} ${s.name}`, kind: 'sub' });
      }
    }
    // faturas de cartao a vencer
    for (const inv of invoices) {
      if (!(inv.status === 'open' || inv.status === 'overdue') || !inv.due_date) continue;
      const d = new Date(String(inv.due_date).slice(0, 10) + 'T00:00');
      if (within(d)) ev.push({ date: iso(d), amount: -Number(inv.total_amount || 0), label: `Fatura cartao ${inv.competence_month || ''}`, kind: 'invoice' });
    }
    // parcelas de dividas
    for (const dbt of debts) {
      const n = Number(dbt.installments || 0), paid = Number(dbt.paid_installments || 0), remaining = Math.max(0, n - paid);
      const inst = Number(dbt.installment_amount || 0); const day = Number(dbt.due_day) || 10;
      for (let k = 0; k < remaining; k++) {
        const base = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(base.getFullYear(), base.getMonth(), clampDay(base.getFullYear(), base.getMonth(), day));
        if (within(d)) ev.push({ date: iso(d), amount: -inst, label: `Parcela: ${dbt.name}`, kind: 'debt' });
      }
    }
    return ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions, subs, invoices, debts, horizon, startBalance]);

  // saldo projetado dia a dia
  const series = useMemo(() => {
    const perDay = {};
    for (const e of events) perDay[e.date] = (perDay[e.date] || 0) + e.amount;
    const arr = []; let bal = startBalance;
    for (let k = 0; k <= horizon; k++) {
      const d = addDays(today, k); const key = iso(d);
      bal += perDay[key] || 0;
      arr.push({ key, name: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), saldo: Math.round(bal) });
    }
    return arr;
  }, [events, startBalance, horizon]);

  const minPoint = useMemo(() => series.reduce((a, b) => (b.saldo < a.saldo ? b : a), series[0] || { saldo: startBalance }), [series]);
  const endBal = series.length ? series[series.length - 1].saldo : startBalance;
  const negativeDays = series.filter((s) => s.saldo < 0);
  const totalIn = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Activity className="w-6 h-6 text-sky-500" /> Fluxo de Caixa Projetado</span>}
        subtitle="Veja o saldo dia a dia com vencimentos, assinaturas, faturas e parcelas"
        actions={<Select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-auto"><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option></Select>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo hoje</p><p className="font-display text-xl font-bold"><AnimatedValue value={startBalance} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> Entradas previstas</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={totalIn} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-rose-500" /> Saidas previstas</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={Math.abs(totalOut)} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Saldo projetado</p><p className={`font-display text-xl font-bold ${endBal < 0 ? 'text-rose-500' : ''}`}><AnimatedValue value={endBal} format={formatCurrency} /></p></Card></Reveal>
      </div>

      {minPoint && minPoint.saldo < 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Atencao: seu saldo pode ficar negativo (chega a {formatCurrency(minPoint.saldo)} em {minPoint.name}). Planeje entradas ou adie saidas antes disso.
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2"><h3 className="font-semibold">Projecao de saldo — proximos {horizon} dias</h3><Badge color={minPoint?.saldo < 0 ? 'rose' : 'emerald'}>menor saldo: {formatCurrency(minPoint?.saldo ?? startBalance)}</Badge></div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={series}>
            <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(v) => [formatCurrency(v), 'saldo']} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
            <Area dataKey="saldo" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#cf)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-indigo-500" /> Proximos eventos ({events.length})</h3>
        {events.length === 0 ? <p className="text-sm text-muted py-4 text-center">Nenhum evento previsto no periodo. Cadastre vencimentos, assinaturas ou dividas.</p>
          : <div className="divide-y divide-[hsl(var(--border))] max-h-96 overflow-y-auto">
            {events.slice(0, 60).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${e.amount >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>{e.amount >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{e.label}</p><p className="text-xs text-muted">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p></div>
                <span className={`font-semibold ${e.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{e.amount >= 0 ? '+' : ''}{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>}
      </Card>
    </div>
  );
}
