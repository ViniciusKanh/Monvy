import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Account, Transaction, Subscription, CreditCardInvoice, Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge, Select } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { LoadingScreen } from '../components/Splash.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { Activity, AlertTriangle, Wallet, CalendarClock, ArrowUpRight, ArrowDownRight, ShieldCheck, RefreshCw, CreditCard, Landmark, Repeat, Receipt, Sparkles } from 'lucide-react';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d) => d.toISOString().slice(0, 10);
const clampDay = (y, m, day) => Math.min(day, new Date(y, m + 1, 0).getDate());

const SOURCES = [
  { key: 'pending', label: 'Lançamentos', icon: Receipt, color: '#0ea5e9' },
  { key: 'fixed', label: 'Fixos/recorrentes', icon: Repeat, color: '#8b5cf6' },
  { key: 'sub', label: 'Assinaturas', icon: RefreshCw, color: '#ec4899' },
  { key: 'invoice', label: 'Faturas', icon: CreditCard, color: '#6366f1' },
  { key: 'debt', label: 'Parcelas', icon: Landmark, color: '#f59e0b' },
];
const SRC = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

export default function CashFlow() {
  const [horizon, setHorizon] = useState(90);
  const [off, setOff] = useState(() => new Set()); // fontes desativadas
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });

  const startBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00');
  const end = addDays(today, horizon);
  const months = Math.ceil(horizon / 30) + 1;

  const allEvents = useMemo(() => {
    const ev = [];
    const within = (d) => d > today && d <= end;
    // meses+descrição que já possuem um lançamento real (evita duplicar com a projeta­cao do recorrente)
    const explicit = new Set();
    for (const t of transactions) { if (t.type === 'transfer') continue; explicit.add(`${String(t.date).slice(0, 7)}|${(t.description || '').toLowerCase()}`); }

    // 1) lançamentos pendentes (futuros ou vencidos)
    for (const t of transactions) {
      if (t.type === 'transfer') continue;
      if ((t.status || 'pending') === 'completed') continue;
      const d = new Date(String(t.date).slice(0, 10) + 'T00:00');
      if (within(d) || d <= today) {
        const day = d <= today ? iso(addDays(today, 1)) : iso(d);
        ev.push({ date: day, amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount), label: t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), kind: t.type, src: 'pending' });
      }
    }

    // 2) recorrentes fixos (salario, aluguel...) projetados mes a mes, pulando mêses que já tem lançamento real
    for (const t of transactions) {
      if (t.type === 'transfer' || !t.is_fixed) continue;
      const base = new Date(String(t.date).slice(0, 10) + 'T00:00');
      const day = base.getDate();
      for (let k = 0; k <= months; k++) {
        const b = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day));
        if (!within(d)) continue;
        const mk = iso(d).slice(0, 7);
        if (explicit.has(`${mk}|${(t.description || '').toLowerCase()}`)) continue; // já existe lançamento real nesse mes
        ev.push({ date: iso(d), amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount), label: `${t.description || 'Recorrente'}`, kind: t.type, src: 'fixed' });
      }
    }

    // 3) assinaturas
    for (const s of subs) {
      if (s.is_active === false) continue;
      const day = Number(s.renewal_day) || 1;
      for (let k = 0; k <= months; k++) {
        const b = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day));
        if (within(d)) ev.push({ date: iso(d), amount: -Number(s.amount || 0), label: `${s.icon_emoji || '📱'} ${s.name}`, kind: 'sub', src: 'sub' });
      }
    }

    // 4) faturas de cartão
    for (const inv of invoices) {
      if (!(inv.status === 'open' || inv.status === 'overdue') || !inv.due_date) continue;
      const d = new Date(String(inv.due_date).slice(0, 10) + 'T00:00');
      if (within(d)) ev.push({ date: iso(d), amount: -Number(inv.total_amount || 0), label: `Fatura cartão ${inv.competence_month || ''}`, kind: 'invoice', src: 'invoice' });
    }

    // 5) parcelas de dividas
    for (const dbt of debts) {
      const remaining = Math.max(0, Number(dbt.installments || 0) - Number(dbt.paid_installments || 0));
      const inst = Number(dbt.installment_amount || 0); const day = Number(dbt.due_day) || 10;
      for (let k = 0; k < remaining && k <= months; k++) {
        const b = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day));
        if (within(d)) ev.push({ date: iso(d), amount: -inst, label: `Parcela: ${dbt.name}`, kind: 'debt', src: 'debt' });
      }
    }
    return ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions, subs, invoices, debts, horizon]);

  const events = useMemo(() => allEvents.filter((e) => !off.has(e.src)), [allEvents, off]);

  const series = useMemo(() => {
    const perDay = {};
    for (const e of events) perDay[e.date] = (perDay[e.date] || 0) + e.amount;
    const arr = []; let bal = startBalance;
    for (let k = 0; k <= horizon; k++) {
      const d = addDays(today, k); const key = iso(d);
      bal += perDay[key] || 0;
      arr.push({ key, idx: k, name: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), saldo: Math.round(bal) });
    }
    return arr;
  }, [events, startBalance, horizon]);

  const minPoint = useMemo(() => series.reduce((a, b) => (b.saldo < a.saldo ? b : a), series[0] || { saldo: startBalance }), [series]);
  const firstNeg = useMemo(() => series.find((s) => s.saldo < 0), [series]);
  const endBal = series.length ? series[series.length - 1].saldo : startBalance;
  const totalIn = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);

  // composicao das saidas por fonte
  const outBySource = useMemo(() => {
    const m = {};
    for (const e of events) if (e.amount < 0) m[e.src] = (m[e.src] || 0) + Math.abs(e.amount);
    const total = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    return SOURCES.map((s) => ({ ...s, value: m[s.key] || 0, pct: Math.round((m[s.key] || 0) / total * 100) })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  }, [events]);

  // Resumo mês a mês: entradas, saídas e saldo projetado ao fim de cada mês
  const monthly = useMemo(() => {
    const meses = {};
    for (const e of events) {
      const mk = e.date.slice(0, 7);
      meses[mk] = meses[mk] || { mk, inc: 0, out: 0 };
      if (e.amount >= 0) meses[mk].inc += e.amount; else meses[mk].out += Math.abs(e.amount);
    }
    const ordered = Object.values(meses).sort((a, b) => (a.mk < b.mk ? -1 : 1));
    let bal = startBalance;
    return ordered.map((m) => {
      bal += m.inc - m.out;
      const [y, mo] = m.mk.split('-');
      const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      return { ...m, saldoFim: bal, label };
    });
  }, [events, startBalance]);

  const toggle = (k) => setOff((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const healthy = !firstNeg;
  const semEventos = events.length === 0;

  if (isLoading) return <LoadingScreen label="Projetando seu fluxo de caixa..." />;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Activity className="w-6 h-6 text-sky-500" /> Fluxo de Caixa Projetado</span>}
        subtitle="Saldo dia a dia com recebimentos, contas fixas, assinaturas, faturas e parcelas"
        actions={<Select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-auto"><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option></Select>} />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 text-sm">
        <Activity className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Partimos do seu <b>saldo de hoje</b> ({formatCurrency(startBalance)}) e somamos/subtraímos o que <b>ainda vai entrar e sair</b> nos próximos {horizon} dias: contas a pagar/receber, lançamentos fixos, assinaturas, faturas de cartão e parcelas. O gráfico mostra como seu saldo tende a evoluir dia a dia.</span>
      </div>

      {semEventos && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Nenhum evento futuro registrado — por isso a projeção fica plana no saldo atual. Para dar vida à previsão: marque lançamentos como <b>fixos/recorrentes</b>, deixe contas como <b>a pagar/receber</b>, e cadastre assinaturas, faturas e parcelas de dívidas.</span>
        </div>
      )}

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: healthy ? 'linear-gradient(135deg,#0ea5e9 0%,#0d9488 60%,#059669 100%)' : 'linear-gradient(135deg,#f43f5e 0%,#f97316 60%,#f59e0b 100%)' }}>
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.28em] font-medium text-white/80">{healthy ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} PROJECAO {horizon} DIAS</div>
            <p className="font-display text-2xl font-extrabold mt-1">{healthy ? 'Fluxo saudavel no período' : 'Risco de saldo negativo'}</p>
            <p className="text-white/85 text-sm mt-1 max-w-lg">{healthy
              ? `Seu saldo não fica negativo. Menor ponto: ${formatCurrency(minPoint?.saldo ?? startBalance)} em ${minPoint?.name}.`
              : `O saldo pode zerar em ${firstNeg?.name} e chegar a ${formatCurrency(minPoint?.saldo)}. Antecipe entradas ou adie saidas.`}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Saldo projetado ao fim</p>
            <p className="font-display text-3xl font-extrabold">{formatCurrency(endBal)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo hoje</p><p className="font-display text-xl font-bold"><AnimatedValue value={startBalance} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> Entradas previstas</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={totalIn} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-rose-500" /> Saidas previstas</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={Math.abs(totalOut)} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Menor saldo</p><p className={`font-display text-xl font-bold ${minPoint?.saldo < 0 ? 'text-rose-500' : 'text-emerald-500'}`}><AnimatedValue value={minPoint?.saldo ?? startBalance} format={formatCurrency} /></p></Card></Reveal>
      </div>

      {/* Filtros de fonte */}
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => { const on = !off.has(s.key); const Ic = s.icon; return (
          <button key={s.key} onClick={() => toggle(s.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'text-white border-transparent' : 'text-muted border-[hsl(var(--border))] opacity-60'}`} style={on ? { background: s.color } : {}}>
            <Ic className="w-3.5 h-3.5" /> {s.label}
          </button>
        ); })}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2"><h3 className="font-semibold">Projeção de saldo</h3><Badge color={minPoint?.saldo < 0 ? 'rose' : 'emerald'}>menor: {formatCurrency(minPoint?.saldo ?? startBalance)}</Badge></div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cfPos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={44} />
            <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(v) => [formatCurrency(v), 'saldo']} labelFormatter={(l) => `Dia ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
            <Area dataKey="saldo" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#cfPos)" />
            {minPoint && <ReferenceDot x={minPoint.name} y={minPoint.saldo} r={5} fill={minPoint.saldo < 0 ? '#f43f5e' : '#10b981'} stroke="#fff" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {monthly.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-sky-500" /> Resumo mês a mês</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-muted text-xs text-left border-b border-[hsl(var(--border))]">
                <th className="py-2 font-medium">Mês</th><th className="py-2 font-medium text-right">Entradas</th><th className="py-2 font-medium text-right">Saídas</th><th className="py-2 font-medium text-right">Saldo no fim</th>
              </tr></thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.mk} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="py-2 capitalize font-medium">{m.label}</td>
                    <td className="py-2 text-right text-emerald-500">+{formatCurrency(m.inc)}</td>
                    <td className="py-2 text-right text-rose-500">-{formatCurrency(m.out)}</td>
                    <td className={`py-2 text-right font-semibold ${m.saldoFim < 0 ? 'text-rose-500' : ''}`}>{formatCurrency(m.saldoFim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted mt-2">O saldo no fim de cada mês já considera o mês anterior — é o efeito acumulado da sua previsão.</p>
        </Card>
      )}

      {outBySource.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-indigo-500" /> Para onde vao as saidas do período</h3>
          <div className="space-y-2.5">
            {outBySource.map((s) => { const Ic = s.icon; return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: s.color }}><Ic className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1"><span>{s.label}</span><span className="font-semibold">{formatCurrency(s.value)} · {s.pct}%</span></div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} /></div>
                </div>
              </div>
            ); })}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-indigo-500" /> Próximos eventos ({events.length})</h3>
        {events.length === 0 ? <p className="text-sm text-muted py-4 text-center">Nenhum evento previsto no período (ou todas as fontes estao desligadas).</p>
          : <div className="divide-y divide-[hsl(var(--border))] max-h-96 overflow-y-auto">
            {events.slice(0, 80).map((e, i) => { const s = SRC[e.src]; const Ic = s?.icon || Receipt; return (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: e.amount >= 0 ? '#10b981' : (s?.color || '#f43f5e') }}><Ic className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{e.label}</p><p className="text-xs text-muted">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })} · {s?.label}</p></div>
                <span className={`font-semibold shrink-0 ${e.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{e.amount >= 0 ? '+' : ''}{formatCurrency(e.amount)}</span>
              </div>
            ); })}
          </div>}
      </Card>
    </div>
  );
}
