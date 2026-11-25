import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Account, Transaction, Subscription, CreditCardInvoice, Debt } from '../api/entities.js';
import { Modal, Button } from '../components/ui';
import { LoadingScreen } from '../components/Splash.jsx';
import { HeroTitle, Panel, Donut, Gauge, DeltaChip, InsightRow, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { CalendarArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, BarChart, Bar as RBar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot, Legend } from 'recharts';
import {
  Activity, AlertTriangle, Wallet, CalendarClock, ArrowUpRight, ArrowDownRight, ShieldCheck, RefreshCw, CreditCard, Landmark, Repeat, Receipt, Sparkles, Target, Coins,
  BarChart3, ChevronLeft, ChevronRight, CalendarDays, Bell, CheckCircle2, Lightbulb, TrendingUp, TrendingDown, Equal, Shield, ArrowRight, Info, Check, PieChart as PieIcon, Brain,
} from 'lucide-react';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clampDay = (y, m, day) => Math.min(day, new Date(y, m + 1, 0).getDate());
const br = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const SOURCES = [
  { key: 'pending', label: 'Lançamentos', icon: Receipt, color: '#22d3ee' },
  { key: 'fixed', label: 'Fixos/recorrentes', icon: Repeat, color: '#a855f7' },
  { key: 'sub', label: 'Assinaturas', icon: RefreshCw, color: '#ec4899' },
  { key: 'invoice', label: 'Faturas', icon: CreditCard, color: '#3b82f6' },
  { key: 'debt', label: 'Parcelas', icon: Landmark, color: '#f59e0b' },
];
const SRC = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

// Saúde do fluxo: quantos meses de saídas o menor saldo previsto cobre (1 mês ou mais = 100; negativo cai abaixo de 40)
const flowScore = (minBal, monthlyOut) => { if (monthlyOut <= 0) return minBal >= 0 ? 100 : 0; const r = minBal / monthlyOut; return r >= 0 ? Math.round(50 + 50 * Math.min(1, r)) : Math.max(0, Math.round(40 * (1 + r))); };

export default function CashFlow() {
  const nav = useNavigate();
  const [horizon, setHorizon] = useState(90);
  const [off, setOff] = useState(() => new Set());
  const [mode, setMode] = useState('saldo');
  const [calOff, setCalOff] = useState(0);
  const [allOpen, setAllOpen] = useState(false);
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });

  const startBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const end = addDays(today, horizon);
  const months = Math.ceil(horizon / 30) + 1;

  const allEvents = useMemo(() => {
    const ev = [];
    const within = (d) => d > today && d <= end;
    const explicit = new Set();
    for (const t of transactions) { if (t.type === 'transfer') continue; explicit.add(`${String(t.date).slice(0, 7)}|${(t.description || '').toLowerCase()}`); }
    for (const t of transactions) {
      if (t.type === 'transfer' || (t.status || 'pending') === 'completed') continue;
      const d = new Date(String(t.date).slice(0, 10) + 'T00:00');
      if (within(d) || d <= today) ev.push({ date: d <= today ? iso(addDays(today, 1)) : iso(d), amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount), label: t.description || (t.type === 'income' ? 'Recebimento' : 'Pagamento'), src: 'pending', overdue: d <= today });
    }
    for (const t of transactions) {
      if (t.type === 'transfer' || !t.is_fixed) continue;
      const day = new Date(String(t.date).slice(0, 10) + 'T00:00').getDate();
      for (let k = 0; k <= months; k++) {
        const b = new Date(today.getFullYear(), today.getMonth() + k, 1);
        const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day));
        if (!within(d) || explicit.has(`${iso(d).slice(0, 7)}|${(t.description || '').toLowerCase()}`)) continue;
        ev.push({ date: iso(d), amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount), label: t.description || 'Recorrente', src: 'fixed' });
      }
    }
    for (const s of subs) {
      if (s.is_active === false) continue;
      const day = Number(s.renewal_day) || 1;
      for (let k = 0; k <= months; k++) { const b = new Date(today.getFullYear(), today.getMonth() + k, 1); const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day)); if (within(d)) ev.push({ date: iso(d), amount: -Number(s.amount || 0), label: `Assinatura – ${s.name}`, src: 'sub' }); }
    }
    for (const inv of invoices) {
      if (!(inv.status === 'open' || inv.status === 'overdue') || !inv.due_date) continue;
      const d = new Date(String(inv.due_date).slice(0, 10) + 'T00:00');
      if (within(d)) ev.push({ date: iso(d), amount: -Number(inv.total_amount || 0), label: 'Fatura do cartão', src: 'invoice' });
    }
    for (const dbt of debts) {
      const remaining = Math.max(0, Number(dbt.installments || 0) - Number(dbt.paid_installments || 0));
      const inst = Number(dbt.installment_amount || 0); const day = Number(dbt.due_day) || 10;
      for (let k = 0; k < remaining && k <= months; k++) { const b = new Date(today.getFullYear(), today.getMonth() + k, 1); const d = new Date(b.getFullYear(), b.getMonth(), clampDay(b.getFullYear(), b.getMonth(), day)); if (within(d)) ev.push({ date: iso(d), amount: -inst, label: `Parcela: ${dbt.name}`, src: 'debt' }); }
    }
    return ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions, subs, invoices, debts, horizon]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => allEvents.filter((e) => !off.has(e.src)), [allEvents, off]);
  const series = useMemo(() => {
    const perDay = {}; for (const e of events) perDay[e.date] = (perDay[e.date] || 0) + e.amount;
    const arr = []; let bal = startBalance;
    for (let k = 0; k <= horizon; k++) { const d = addDays(today, k); const key = iso(d); bal += perDay[key] || 0; arr.push({ key, idx: k, name: br(key), saldo: Math.round(bal * 100) / 100 }); }
    return arr;
  }, [events, startBalance, horizon, today]);

  const minPoint = series.reduce((a, b) => (b.saldo < a.saldo ? b : a), series[0]);
  const negDays = series.filter((s) => s.saldo < 0).length;
  const endBal = series[series.length - 1]?.saldo ?? startBalance;
  const totalIn = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = Math.abs(events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0));
  const variation = startBalance !== 0 ? ((endBal - startBalance) / Math.abs(startBalance)) * 100 : null;
  const monthlyOut = totalOut / Math.max(1, horizon / 30);
  const score = flowScore(minPoint?.saldo ?? startBalance, monthlyOut);
  const risk = negDays > 0 ? ['Alto', 'text-rose-500'] : (minPoint?.saldo ?? 0) < monthlyOut * 0.25 ? ['Médio', 'text-amber-500'] : ['Baixo', 'text-emerald-500 dark:text-emerald-300'];
  const avgBal = series.reduce((s, p) => s + p.saldo, 0) / Math.max(1, series.length);

  const outBySource = useMemo(() => { const m = {}; for (const e of events) if (e.amount < 0) m[e.src] = (m[e.src] || 0) + Math.abs(e.amount); return SOURCES.map((s) => ({ ...s, name: s.label, value: m[s.key] || 0 })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value); }, [events]);
  const subsTotal = outBySource.find((s) => s.key === 'sub')?.value || 0;
  const subsCount = subs.filter((s) => s.is_active !== false).length;

  // marcos do gráfico: maiores eventos do período
  const markers = useMemo(() => { const byDay = {}; for (const e of events) { byDay[e.date] = byDay[e.date] || { date: e.date, amount: 0, big: e }; byDay[e.date].amount += e.amount; if (Math.abs(e.amount) > Math.abs(byDay[e.date].big.amount)) byDay[e.date].big = e; } return Object.values(byDay).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 4).map((x) => ({ ...x, point: series.find((s) => s.key === x.date) })).filter((x) => x.point); }, [events, series]);
  const weekly = useMemo(() => { const out = []; for (let w = 0; w * 7 < horizon; w++) { const a = iso(addDays(today, w * 7 + 1)); const b = iso(addDays(today, w * 7 + 7)); const evs = events.filter((e) => e.date >= a && e.date <= b); out.push({ name: br(a), Entradas: Math.round(evs.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)), Saídas: Math.round(Math.abs(evs.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0))) }); } return out; }, [events, horizon, today]);

  // calendário
  const calBase = new Date(today.getFullYear(), today.getMonth() + calOff, 1);
  const maxCalOff = Math.floor(((end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth()));
  const dayMap = useMemo(() => { const m = {}; for (const e of events) { m[e.date] = m[e.date] || { inc: 0, out: 0 }; if (e.amount >= 0) m[e.date].inc += e.amount; else m[e.date].out += -e.amount; } return m; }, [events]);
  const cells = useMemo(() => { const first = calBase.getDay(); const start = addDays(calBase, -first); return Array.from({ length: 42 }, (_, k) => addDays(start, k)); }, [calOff]); // eslint-disable-line react-hooks/exhaustive-deps
  const next7 = events.filter((e) => e.date <= iso(addDays(today, 7)));

  const toggle = (k) => setOff((s) => { const nn = new Set(s); nn.has(k) ? nn.delete(k) : nn.add(k); return nn; });

  if (isLoading) return <LoadingScreen label="Projetando seu fluxo de caixa..." />;

  const Kpi = ({ icon: Ic, color, label, value, cls = '' }) => (
    <div className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] px-3.5 py-3 flex items-center gap-2.5 min-w-0">
      <Ic className="w-7 h-7 shrink-0" style={{ color }} strokeWidth={1.7} />
      <div className="min-w-0"><p className="text-xs text-muted truncate">{label}</p><p className={`font-display text-lg font-bold truncate ${cls}`}>{value}</p></div>
    </div>
  );
  const MarkerDot = ({ cx, cy, payload: _p, src }) => { const s = SRC[src] || SRC.pending; return (
    <g transform={`translate(${cx},${cy})`}>
      <line x1="0" y1="0" x2="0" y2="-26" stroke={s.color} strokeDasharray="3 3" />
      <circle cx="0" cy="-36" r="13" fill="#0f172a" stroke={s.color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 6px ${s.color})` }} />
      <circle cx="0" cy="-36" r="5" fill={s.color} />
      <circle cx="0" cy="0" r="4" fill={s.color} />
    </g>); };

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Activity} lead="Fluxo de Caixa" accent="Projetado" iconClass="text-pink-400" subtitle="Veja a evolução do seu saldo ao longo dos próximos dias considerando entradas e saídas." art={<CalendarArt className="w-72 h-36 xl:mr-40" />} />

      {/* Previsão do período */}
      <section className="rounded-3xl ring-1 ring-cyan-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(60%_120%_at_0%_0%,rgba(34,211,238,.14),transparent),radial-gradient(60%_120%_at_100%_100%,rgba(168,85,247,.16),transparent)] shadow-[0_0_36px_-12px_rgba(34,211,238,.45)] p-5 grid gap-5 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:divide-x divide-[hsl(var(--border))]">
        <div className="flex items-center gap-4 min-w-0">
          <Target className="w-10 h-10 text-teal-400 shrink-0 self-start" strokeWidth={1.6} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.25em] text-muted">PREVISÃO PARA O PERÍODO</p>
            <p className="font-semibold mt-1">Saldo projetado ao final de {horizon} dias</p>
            <p className={`font-display text-4xl font-extrabold leading-tight ${endBal < 0 ? 'text-rose-500' : ''}`}>{formatCurrency(endBal)}</p>
            <div className="flex items-center gap-2 text-xs text-muted mt-1">{variation != null && <DeltaChip v={variation} />}em relação ao saldo atual ({formatCurrency(startBalance)})</div>
          </div>
          <svg viewBox="0 0 140 80" className="hidden 2xl:block w-36 h-20 shrink-0" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={10 + i * 20} y={70 - (12 + i * 9)} width="13" height={12 + i * 9} rx="3" fill={i % 2 ? '#22d3ee' : '#14b8a6'} opacity={0.4 + i * 0.1} />)}<path d="M6 64 C40 56 70 40 120 10" stroke={endBal >= startBalance ? '#34d399' : '#fb7185'} strokeWidth="4" fill="none" /><path d={endBal >= startBalance ? 'M112 6 L128 6 L122 20 Z' : 'M112 74 L128 74 L122 60 Z'} fill={endBal >= startBalance ? '#34d399' : '#fb7185'} /></svg>
        </div>
        <div className="lg:px-5 flex items-start gap-3"><Coins className="w-9 h-9 text-fuchsia-400 shrink-0" strokeWidth={1.6} /><div><p className="font-semibold">Menor saldo previsto</p><p className={`font-display text-2xl font-bold mt-1 ${minPoint?.saldo < 0 ? 'text-rose-500' : ''}`}>{formatCurrency(minPoint?.saldo ?? startBalance)}</p><p className="text-sm text-muted">Em {minPoint?.name}</p></div></div>
        <div className="lg:px-5 flex items-start gap-3"><ShieldCheck className="w-9 h-9 text-teal-400 shrink-0" strokeWidth={1.6} /><div><p className="font-semibold">Risco do fluxo</p><p className={`font-display text-2xl font-bold mt-1 ${risk[1]}`}>{risk[0]}</p><p className="text-sm text-muted">Dias com saldo negativo no período: <b className="text-[hsl(var(--text))]">{negDays}</b></p></div></div>
        <div className="lg:px-5 flex items-center gap-3">
          <Gauge value={score} size={140} label="/100" />
          <div><p className="font-semibold flex items-center gap-1">Saúde do fluxo <span title="Quantos meses de saídas o menor saldo previsto cobre: 1 mês ou mais = 100; saldo negativo fica abaixo de 40."><Info className="w-3.5 h-3.5 text-muted" /></span></p><p className={`font-display text-xl font-bold ${score >= 80 ? 'text-emerald-500 dark:text-emerald-300' : score >= 50 ? 'text-cyan-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>{score >= 80 ? 'Excelente' : score >= 50 ? 'Boa' : score >= 40 ? 'Atenção' : 'Crítica'}</p></div>
        </div>
      </section>

      {!allEvents.length && <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/40 text-amber-700 dark:text-amber-300 text-sm"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>Nenhum evento futuro registrado — a projeção fica plana no saldo atual. Marque lançamentos como <b>fixos/recorrentes</b>, deixe contas como <b>a pagar/receber</b> e cadastre assinaturas, faturas e parcelas.</span></div>}

      <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3">
            <div className="col-span-2 md:col-span-1 rounded-2xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] px-3 py-2.5">
              <p className="text-xs text-muted flex items-center gap-1.5 mb-1.5"><CalendarDays className="w-3.5 h-3.5" />Período de projeção</p>
              <div className="grid grid-cols-4 gap-1">{[30, 60, 90, 180].map((d) => <button key={d} onClick={() => { setHorizon(d); setCalOff(0); }} className={`py-1.5 rounded-lg text-xs font-semibold ${horizon === d ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,.4)]' : 'ring-1 ring-[hsl(var(--border))] text-muted'}`}>{d} dias</button>)}</div>
            </div>
            <Kpi icon={Wallet} color="#38bdf8" label="Saldo atual" value={formatCurrency(startBalance)} />
            <Kpi icon={ArrowUpRight} color="#34d399" label="Entradas previstas" value={formatCurrency(totalIn)} />
            <Kpi icon={ArrowDownRight} color="#f472b6" label="Saídas previstas" value={formatCurrency(totalOut)} />
            <Kpi icon={BarChart3} color="#a855f7" label="Menor saldo" value={formatCurrency(minPoint?.saldo ?? startBalance)} cls={minPoint?.saldo < 0 ? 'text-rose-500' : ''} />
          </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_270px_290px] gap-5">
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
            <Panel title="Projeção de saldo" subtitle={`Próximos ${horizon} dias`} icon={Activity} iconClass="text-sky-400" tone="sky" action={
              <div className="inline-flex p-1 rounded-xl ring-1 ring-[hsl(var(--border))]">{[['saldo', 'Saldo projetado'], ['io', 'Entradas e saídas']].map(([v, l]) => <button key={v} onClick={() => setMode(v)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${mode === v ? 'bg-sky-500/25 text-sky-700 dark:text-sky-100 ring-1 ring-sky-400/60' : 'text-muted'}`}>{l}</button>)}</div>}>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {mode === 'saldo' ? (
                    <AreaChart data={series} margin={{ top: 48, right: 14, bottom: 0, left: 0 }}>
                      <defs><linearGradient id="cfA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                      <YAxis width={56} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [formatCurrency(v), 'Saldo']} labelFormatter={(l) => `Dia ${l}`} contentStyle={TIP} />
                      {minPoint?.saldo < 0 && <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />}
                      <Area type="stepAfter" dataKey="saldo" stroke="#22d3ee" strokeWidth={3} fill="url(#cfA)" style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,.5))' }} />
                      {markers.map((m) => <ReferenceDot key={m.date} x={m.point.name} y={m.point.saldo} r={0} shape={(p) => <MarkerDot {...p} src={m.big.src} />} />)}
                      {minPoint && <ReferenceDot x={minPoint.name} y={minPoint.saldo} r={6} fill={minPoint.saldo < 0 ? '#f43f5e' : '#34d399'} stroke="#fff" strokeWidth={2} label={{ value: `${minPoint.name} • menor saldo ${formatCurrency(minPoint.saldo)}`, position: 'right', fill: 'hsl(var(--text))', fontSize: 11, fontWeight: 700, dx: 6, dy: 14 }} />}
                    </AreaChart>
                  ) : (
                    <BarChart data={weekly} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                      <YAxis width={56} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                      <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => `Semana de ${l}`} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <RBar dataKey="Entradas" fill="#34d399" radius={[6, 6, 0, 0]} />
                      <RBar dataKey="Saídas" fill="#f472b6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Resumo do período" icon={BarChart3} iconClass="text-sky-400" tone="sky">
              <div className="space-y-1 text-sm">
                {[[Wallet, 'Saldo inicial', startBalance, ''], [ArrowUpRight, 'Total de entradas', totalIn, 'text-emerald-500'], [ArrowDownRight, 'Total de saídas', totalOut, 'text-rose-500']].map(([Ic, l, v, c]) => <div key={l} className="flex items-center gap-2 py-2.5 border-b border-[hsl(var(--border))]"><Ic className={`w-4 h-4 ${c || 'text-sky-400'}`} /><span className="flex-1 text-xs">{l}</span><b className="text-xs">{formatCurrency(v)}</b></div>)}
              </div>
              <div className="mt-3 rounded-xl ring-1 ring-teal-400/60 bg-teal-500/10 px-3 py-2.5 flex items-center gap-2"><Equal className="w-4 h-4 text-teal-400" /><span className="text-xs flex-1">Saldo final <span className="text-muted">(previsto)</span></span><b className={`text-sm ${endBal < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}`}>{formatCurrency(endBal)}</b></div>
              <div className="mt-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-3 flex items-center gap-3">{(variation ?? 0) >= 0 ? <TrendingUp className="w-8 h-8 text-teal-400" /> : <TrendingDown className="w-8 h-8 text-rose-400" />}<div><p className="text-xs text-muted">Variação no período</p><p className={`font-display text-xl font-bold ${(variation ?? 0) >= 0 ? 'text-teal-600 dark:text-teal-300' : 'text-rose-500'}`}>{variation == null ? '—' : `${variation >= 0 ? '+' : ''}${pct1(variation)}`}</p></div></div>
            </Panel>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {SOURCES.map((s) => { const on = !off.has(s.key); const Ic = s.icon; return (
              <button key={s.key} onClick={() => toggle(s.key)} aria-pressed={on} className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-semibold ring-1 transition ${on ? '' : 'opacity-50 ring-[hsl(var(--border))]'}`} style={on ? { background: `${s.color}26`, boxShadow: `0 0 16px -4px ${s.color}`, '--tw-ring-color': s.color } : undefined}>
                <span className="w-6 h-6 rounded-full grid place-items-center" style={{ background: on ? s.color : 'transparent', border: on ? 'none' : '1px solid hsl(var(--border))' }}>{on && <Check className="w-3.5 h-3.5 text-white" />}</span><Ic className="w-4 h-4" style={{ color: s.color }} />{s.label}
              </button>); })}
          </div>
        </div>

        {/* Calendário */}
        <Panel title="Calendário de eventos futuros" icon={CalendarDays} iconClass="text-sky-400" subtitle="Principais entradas e saídas no período" tone="sky" className="min-w-0">
          <div className="flex items-center justify-between mb-2"><button onClick={() => setCalOff((v) => Math.max(0, v - 1))} disabled={calOff === 0} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button><b className="text-sm">{MESES[calBase.getMonth()]} {calBase.getFullYear()}</b><button onClick={() => setCalOff((v) => Math.min(maxCalOff, v + 1))} disabled={calOff >= maxCalOff} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted mb-1">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {cells.map((d) => { const key = iso(d); const inMonth = d.getMonth() === calBase.getMonth(); const ev = dayMap[key]; const isMin = minPoint && key === minPoint.key && minPoint.idx > 0; const isToday = key === iso(today); const ring = isMin ? 'ring-2 ring-amber-400 text-amber-500 font-bold' : ev ? (ev.inc >= ev.out ? 'ring-2 ring-sky-400 text-sky-500 font-bold' : 'ring-2 ring-fuchsia-400 text-fuchsia-500 font-bold') : isToday ? 'bg-teal-500/20 font-bold' : ''; return (
              <span key={key} title={ev ? `+${formatCurrency(ev.inc)} / −${formatCurrency(ev.out)}` : ''} className={`mx-auto w-7 h-7 grid place-items-center rounded-lg ${inMonth ? '' : 'opacity-30'} ${ring}`}>{String(d.getDate()).padStart(2, '0')}</span>); })}
          </div>
          <p className="text-xs font-semibold mt-3 mb-1.5">Próximos eventos (7 dias)</p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {next7.length ? next7.slice(0, 6).map((e, k) => { const s = SRC[e.src]; return (
              <div key={k} className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: `${s.color}26`, color: s.color }}><s.icon className="w-3.5 h-3.5" /></span><b className="text-xs w-10">{br(e.date)}</b><div className="min-w-0 flex-1"><p className="text-[11px] truncate" style={{ color: s.color }}>{e.label}</p><p className={`text-xs font-semibold ${e.amount >= 0 ? 'text-emerald-500' : ''}`}>{e.amount >= 0 ? '+ ' : ''}{formatCurrency(Math.abs(e.amount))}</p></div></div>); })
              : <p className="text-xs text-muted">Nada previsto para os próximos 7 dias.</p>}
          </div>
          <button onClick={() => setAllOpen(true)} className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ring-1 ring-sky-400/50 hover:bg-sky-500/10">Ver todos os eventos do período<ArrowRight className="w-3.5 h-3.5" /></button>
        </Panel>

        {/* Alertas + composição */}
        <div className="space-y-5 min-w-0">
          <Panel title="Alertas e Oportunidades" icon={Bell} iconClass="text-fuchsia-400" subtitle="Acompanhe riscos, avisos e chances de melhoria." tone="violet">
            <div className="space-y-2.5">
              {negDays === 0
                ? <InsightRow tone="emerald" icon={CheckCircle2} title="Fluxo saudável" text={`Nenhum dia com saldo negativo nos próximos ${horizon} dias.`} />
                : <InsightRow tone="rose" icon={AlertTriangle} title="Risco de saldo negativo" text={`${negDays} dia(s) abaixo de zero; o primeiro em ${series.find((s) => s.saldo < 0)?.name}.`} />}
              {minPoint && minPoint.idx > 0 && <InsightRow tone="violet" icon={CalendarDays} title="Atenção: menor saldo" text={`O menor saldo será de ${formatCurrency(minPoint.saldo)} em ${minPoint.name}.`} />}
              {subsTotal > 0 && <InsightRow tone="amber" icon={Lightbulb} title="Oportunidade de otimização" text={`Assinaturas somam ${formatCurrency(subsTotal / Math.max(1, horizon / 30))}/mês (${subsCount} ativas). Revise as que não usa.`} onClick={() => nav('/assinaturas')} />}
              <InsightRow tone="sky" icon={(variation ?? 0) >= 0 ? TrendingUp : TrendingDown} title={(variation ?? 0) >= 0 ? 'Fluxo em alta' : 'Fluxo em queda'} text={variation == null ? 'Sem saldo atual para comparar.' : `Seu saldo deve ${variation >= 0 ? 'crescer' : 'cair'} ${pct1(Math.abs(variation))} no período.`} />
            </div>
          </Panel>
          <Panel title="Composição das saídas previstas" icon={PieIcon} iconClass="text-fuchsia-400" tone="violet">
            <div className="flex flex-col items-center gap-3">
              <Donut size={140} thickness={0.22} data={outBySource} center={<><span className="font-display font-bold text-sm">{formatCurrency(totalOut)}</span><span className="text-[10px] text-muted">Total</span></>} />
              <div className="w-full space-y-2">{outBySource.length ? outBySource.map((s) => <div key={s.key} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} /><span className="flex-1 truncate">{s.label}</span><span className="tabular-nums">{pct1(totalOut ? (s.value / totalOut) * 100 : 0)}</span></div>) : <p className="text-xs text-muted">Sem saídas previstas.</p>}</div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Insights automáticos */}
      <section className="rounded-3xl ring-1 ring-violet-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(50%_120%_at_0%_50%,rgba(168,85,247,.16),transparent)] p-4 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] items-center">
        <div className="flex items-center gap-3"><span className="w-14 h-14 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_0_24px_rgba(168,85,247,.5)] shrink-0"><Brain className="w-8 h-8 text-white" /></span><div><p className="font-display font-bold text-lg leading-tight">Insights automáticos</p><p className="text-xs text-muted">Leitura do seu fluxo projetado e pontos de atenção.</p></div></div>
        {[
          [endBal >= startBalance ? TrendingUp : TrendingDown, endBal >= startBalance ? 'text-emerald-400' : 'text-rose-400', endBal >= startBalance ? 'Projeção positiva' : 'Projeção negativa', `Seu saldo deve fechar em ${formatCurrency(endBal)}${variation != null ? ` (${variation >= 0 ? '+' : ''}${pct1(variation)})` : ''}.`],
          [CalendarDays, 'text-violet-400', 'Fôlego financeiro', `Saldo médio de ${formatCurrency(avgBal)} ao longo do período.`],
          [Target, 'text-pink-400', 'Otimização', subsTotal > 0 ? `${subsCount} assinatura(s): ${formatCurrency(subsTotal / Math.max(1, horizon / 30))}/mês.` : 'Nenhuma assinatura prevista no período.'],
          [Shield, 'text-sky-400', 'Segurança', `Menor saldo previsto: ${formatCurrency(minPoint?.saldo ?? startBalance)}${minPoint?.idx > 0 ? ` em ${minPoint.name}` : ''}.`],
        ].map(([Ic, c, t, d]) => <div key={t} className="rounded-2xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5 h-full"><p className={`font-semibold text-sm flex items-center gap-1.5 ${c}`}><Ic className="w-4 h-4" />{t}</p><p className="text-xs text-muted mt-1">{d}</p></div>)}
        <GlowButton tone="violet" onClick={() => nav('/inteligencia')} className="justify-center whitespace-nowrap">Ver análise completa<ArrowRight className="w-4 h-4" /></GlowButton>
      </section>

      <Modal open={allOpen} onClose={() => setAllOpen(false)} title={`Eventos dos próximos ${horizon} dias (${events.length})`} maxWidth="max-w-2xl" footer={<Button onClick={() => setAllOpen(false)}>Fechar</Button>}>
        <div className="divide-y divide-[hsl(var(--border))] max-h-[60vh] overflow-y-auto">
          {events.length ? events.map((e, k) => { const s = SRC[e.src]; return (
            <div key={k} className="flex items-center gap-3 py-2"><span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: e.amount >= 0 ? '#10b981' : s.color }}><s.icon className="w-4 h-4" /></span><div className="flex-1 min-w-0"><p className="font-medium truncate">{e.label}{e.overdue && <span className="ml-2 text-[10px] font-bold text-rose-500">vencido</span>}</p><p className="text-xs text-muted">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • {s.label}</p></div><span className={`font-semibold ${e.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{e.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(e.amount))}</span></div>); })
            : <p className="text-sm text-muted py-6 text-center">Nenhum evento previsto (ou todas as fontes estão desligadas).</p>}
        </div>
      </Modal>
    </div>
  );
}
