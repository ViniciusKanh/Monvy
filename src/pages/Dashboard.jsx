import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Account, Transaction, Category, CreditCard, CreditCardTransaction, Goal, Subscription, CreditCardInvoice } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { Card, Spinner } from '../components/ui';
import { RobotsSummaryCard } from '../components/RobotsSummaryCard.jsx';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel, inMonth, monthRange } from '../lib/utils.js';
import { PALETTE, colorAt, lastMonths, monthlySeries, monthTotals, categoryBreakdown, forecastNextMonth, detectAnomalies } from '../lib/analytics.js';
import { ComposedChart, Bar, Line, Area, AreaChart, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Target, CreditCard as CardIcon, PiggyBank, Eye, EyeOff,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Plus, Sparkles, AlertTriangle,
  CalendarClock, Flame, Trophy, Zap, ArrowRight, SlidersHorizontal, ChevronUp, ChevronDown,
} from 'lucide-react';

const money = (v) => formatCurrency(v);

const WIDGET_DEFS = [
  { id: 'charts', label: 'Fluxo de caixa & categorias' },
  { id: 'cardcat', label: 'Gastos no cartão por categoria' },
  { id: 'projection', label: 'Projeção de saldo & acoes' },
  { id: 'overview', label: 'Visao geral & comparativo' },
  { id: 'recent', label: 'Recentes & a vencer' },
];
const LAYOUT_KEY = 'monvy_dash_layout';
function loadLayout() {
  const ids = WIDGET_DEFS.map((w) => w.id);
  try { const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); if (s && Array.isArray(s.order)) { const order = s.order.filter((id) => ids.includes(id)); for (const id of ids) if (!order.includes(id)) order.push(id); return { order, hidden: s.hidden || {} }; } } catch {}
  return { order: ids, hidden: {} };
}

async function fetchFx() {
  const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL');
  if (!r.ok) throw new Error('fx');
  return r.json();
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [mk, setMk] = useState(monthKey(new Date()));
  const [hide, setHide] = useState(false);
  const [layout, setLayout] = useState(loadLayout);
  const [customize, setCustomize] = useState(false);
  const persist = (l) => { setLayout(l); try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch {} };
  const ordOf = (id) => { const i = layout.order.indexOf(id); return i < 0 ? 99 : i + 1; };
  const vis = (id) => !layout.hidden[id];
  const toggleVis = (id) => persist({ ...layout, hidden: { ...layout.hidden, [id]: !layout.hidden[id] } });
  const moveWidget = (id, dir) => { const order = [...layout.order]; const i = order.indexOf(id); const j = i + dir; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; persist({ ...layout, order }); };

  const { data: accounts = [], isLoading: la } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [], isLoading: lt } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: fx } = useQuery({ queryKey: ['fx-usd'], queryFn: fetchFx, retry: 1, staleTime: 60_000, refetchInterval: 120_000 });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const months = useMemo(() => monthRange(11, 4), []);
  const series6 = useMemo(() => monthlySeries(transactions, lastMonths(6, mk)), [transactions, mk]);

  const cur = useMemo(() => monthTotals(transactions, mk), [transactions, mk]);
  const prevMk = useMemo(() => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); }, [mk]);
  const prev = useMemo(() => monthTotals(transactions, prevMk), [transactions, prevMk]);

  const byCategory = useMemo(() => categoryBreakdown(transactions, mk, catMap), [transactions, mk, catMap]);
  const forecast = useMemo(() => forecastNextMonth(transactions, lastMonths(6, mk)), [transactions, mk]);
  const anomalies = useMemo(() => detectAnomalies(transactions, catMap), [transactions, catMap]);
  const prevByCat = useMemo(() => categoryBreakdown(transactions, prevMk, catMap), [transactions, prevMk, catMap]);
  const comparison = useMemo(() => {
    const prevMap = Object.fromEntries(prevByCat.map((c) => [c.name, c.value]));
    return byCategory.slice(0, 6).map((c) => { const p = prevMap[c.name] || 0; const delta = p > 0 ? ((c.value - p) / p) * 100 : (c.value > 0 ? 100 : 0); return { ...c, prev: p, delta }; });
  }, [byCategory, prevByCat]);
  const ESSENTIAL = ['aluguel', 'moradia', 'casa', 'agua', 'água', 'luz', 'energia', 'internet', 'mercado', 'aliment', 'saude', 'saúde', 'transporte', 'educa', 'conta', 'financ', 'condominio', 'condomínio'];
  const overview = useMemo(() => {
    let ess = 0, varr = 0;
    for (const c of byCategory) { const isEss = ESSENTIAL.some((k) => c.name.toLowerCase().includes(k)); if (isEss) ess += c.value; else varr += c.value; }
    const tot = ess + varr; return { ess, varr, tot, essPct: tot ? Math.round((ess / tot) * 100) : 0 };
  }, [byCategory]);
  // gastos no cartão de crédito por categoria (mes selecionado)
  const cardByCategory = useMemo(() => {
    const inMk = cardTxs.filter((t) => t.competence_month === mk || String(t.date).slice(0, 7) === mk);
    const map = {};
    for (const t of inMk) { const c = catMap[t.category_id]; const name = c?.name || 'Sem categoria'; (map[name] = map[name] || { name, value: 0, color: c?.color }); map[name].value += Number(t.amount) || 0; }
    return Object.values(map).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, color: x.color || colorAt(i) }));
  }, [cardTxs, mk, catMap]);
  const cardTotal = cardByCategory.reduce((s, c) => s + c.value, 0);

  // recentes: contas (a pagar/receber) + compras do cartão, com flag
  const recent = useMemo(() => {
    const acct = transactions.filter((t) => inMonth(t.date, mk)).map((t) => ({ ...t, _src: 'account' }));
    const card = cardTxs.filter((t) => t.competence_month === mk || inMonth(t.date, mk)).map((t) => ({ ...t, _src: 'card' }));
    return [...acct, ...card].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (String(b.created_date || '').localeCompare(String(a.created_date || ''))))).slice(0, 8);
  }, [transactions, cardTxs, mk]);

  // saldo acumulado (para sparkline do hero) a partir do saldo atual
  const balanceTrail = useMemo(() => {
    const s = monthlySeries(transactions, lastMonths(6, mk));
    let running = totalBalance; const arr = [];
    for (let i = s.length - 1; i >= 0; i--) { arr.unshift({ name: s[i].name, v: Math.round(running) }); running -= s[i].net; }
    return arr;
  }, [transactions, mk, totalBalance]);

  // projecao 6 meses
  const projection = useMemo(() => {
    const arr = []; let bal = totalBalance; const net = forecast.net;
    const [y, m] = mk.split('-').map(Number);
    for (let i = 1; i <= 6; i++) { bal += net; const d = new Date(y, m - 1 + i, 1); arr.push({ name: monthLabel(monthKey(d)).slice(0, 3), Saldo: Math.round(bal) }); }
    return arr;
  }, [totalBalance, forecast, mk]);

  // próximos vencimentos (assinaturas + faturas) neste mês a partir de hoje
  const upcoming = useMemo(() => {
    const today = new Date(); const list = [];
    const [y, m] = mk.split('-').map(Number);
    subs.forEach((s) => { const day = Math.min(31, Number(s.renewal_day) || 1); const d = new Date(y, m - 1, day); if (d >= new Date(today.toISOString().slice(0, 10))) list.push({ label: `${s.icon_emoji || '📱'} ${s.name}`, date: d, amount: s.amount, kind: 'sub' }); });
    invoices.forEach((inv) => { if (inv.due_date && inv.due_date.slice(0, 7) === mk && (inv.status === 'open' || inv.status === 'overdue')) list.push({ label: `Fatura ${cards.find((c) => c.id === inv.card_id)?.name || ''}`, date: new Date(inv.due_date), amount: inv.total_amount, kind: 'inv' }); });
    return list.sort((a, b) => a.date - b.date).slice(0, 5);
  }, [subs, invoices, cards, mk]);

  // ---- Insights dinamicos ----
  const insights = useMemo(() => {
    const arr = [];
    const expDelta = prev.exp > 0 ? ((cur.exp - prev.exp) / prev.exp) * 100 : 0;
    if (cur.rate >= 20) arr.push({ icon: Trophy, color: '#10b981', title: 'Você esta poupando bem', text: `Taxa de ${cur.rate.toFixed(0)}% neste mês.` });
    if (cur.rate < 0) arr.push({ icon: AlertTriangle, color: '#f43f5e', title: 'Gastando mais que ganha', text: `Saldo do mês ${money(cur.bal)}.` });
    if (prev.exp > 0 && expDelta > 15) arr.push({ icon: Flame, color: '#f59e0b', title: 'Despesas subindo', text: `+${expDelta.toFixed(0)}% vs ${monthLabel(prevMk).split(' ')[0]}.` });
    if (prev.exp > 0 && expDelta < -10) arr.push({ icon: TrendingDown, color: '#10b981', title: 'Gastos em queda', text: `${expDelta.toFixed(0)}% vs mes anterior.` });
    if (byCategory[0]) arr.push({ icon: PiggyBank, color: byCategory[0].color, title: `Maior gasto: ${byCategory[0].name}`, text: `${money(byCategory[0].value)} (${cur.exp > 0 ? Math.round((byCategory[0].value / cur.exp) * 100) : 0}% das despesas).` });
    arr.push({ icon: Eye, color: '#6366f1', title: 'Previsão próximo mes', text: `${forecast.net >= 0 ? 'Saldo' : 'Deficit'} de ${money(forecast.net)}.` });
    if (anomalies.length) arr.push({ icon: Zap, color: '#f43f5e', title: `${anomalies.length} gasto(s) atipico(s)`, text: 'Confira na Inteligência.' });
    if (upcoming[0]) arr.push({ icon: CalendarClock, color: '#0ea5e9', title: 'Próximo vencimento', text: `${upcoming[0].label} · ${upcoming[0].date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}.` });
    return arr.slice(0, 6);
  }, [cur, prev, byCategory, forecast, anomalies, upcoming, prevMk]);

  const val = (v) => hide ? '••••' : money(v);
  const shift = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const pctChange = (c, p) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);

  if (la || lt) return <DashSkeleton />;

  const hour = new Date().getHours();
  const greet = hour < 12 ? t('dash.greeting_morning') : hour < 18 ? t('dash.greeting_afternoon') : t('dash.greeting_evening');
  const rate = Math.max(0, Math.min(100, Math.round(cur.rate)));
  const savedGoals = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0);

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted">{greet},</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{(user?.full_name || 'Usuário').split(' ')[0]} <span className="inline-block animate-[floaty_3s_ease-in-out_infinite]">👋</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 card px-1 py-1">
            <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
            <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer px-1 capitalize">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
            <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setCustomize((c) => !c)} className={`p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10 ${customize ? 'text-emerald-500' : ''}`} title="Personalizar painel"><SlidersHorizontal className="w-5 h-5" /></button>
          <button onClick={() => setHide((h) => !h)} className="p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10">{hide ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
        </div>
      </div>

      {customize && (
        <Card>
          <div className="flex items-center justify-between mb-2"><h3 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-emerald-500" /> Personalizar painel</h3><button onClick={() => setCustomize(false)} className="text-sm text-emerald-600 font-semibold">Concluir</button></div>
          <div className="space-y-1.5">
            {layout.order.map((id, idx) => { const w = WIDGET_DEFS.find((x) => x.id === id); return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={vis(id)} onChange={() => toggleVis(id)} />
                <span className="flex-1 text-sm">{w?.label || id}</span>
                <button onClick={() => moveWidget(id, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveWidget(id, 1)} disabled={idx === layout.order.length - 1} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
              </div>
            ); })}
          </div>
          <p className="text-xs text-muted mt-2">Marque para exibir e use as setas para reordenar. Fica salvo neste dispositivo.</p>
        </Card>
      )}

      {/* Hero + acoes */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-soft ring-1 ring-white/10"
          style={{ background: 'linear-gradient(140deg,#070b18 0%,#0b1330 46%,#111b3f 100%)' }}>
          <div className="absolute -top-24 -right-20 w-80 h-80 rounded-full pointer-events-none glow-pulse" style={{ background: 'radial-gradient(circle, rgba(52,211,153,.30), transparent 68%)' }} />
          <div className="absolute -bottom-28 -left-16 w-80 h-80 rounded-full pointer-events-none glow-pulse" style={{ background: 'radial-gradient(circle, rgba(99,102,241,.24), transparent 70%)', animationDelay: '3s' }} />
          <svg className="absolute right-3 top-3 opacity-[0.10] pointer-events-none" width="190" height="190" viewBox="0 0 190 190" fill="none" stroke="white"><circle cx="160" cy="30" r="60" strokeWidth="1" /><circle cx="160" cy="30" r="94" strokeWidth="1" /><circle cx="160" cy="30" r="128" strokeWidth="1" /></svg>
          <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
          <div className="sheen" />

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.28em] text-slate-400 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> PATRIMONIO TOTAL</p>
                <div className="flex items-end gap-3 mt-2 flex-wrap">
                  <p className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-none"><AnimatedValue value={totalBalance} hidden={hide} format={money} /></p>
                  <span className={`mb-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cur.bal >= 0 ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20' : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20'}`}>{cur.bal >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{val(Math.abs(cur.bal))} no mês</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{accounts.length} conta(s) · {cards.length} cartao(oes) · {money(savedGoals)} guardado em metas</p>
                {(() => {
                  const usd = Number((fx?.USDBRL || {}).bid) || 0;
                  const eur = Number((fx?.EURBRL || {}).bid) || 0;
                  if (!usd && !eur) return null;
                  const f = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                      {usd > 0 && <span className="flex items-center gap-1">🇺🇸 {hide ? '••••' : `US$ ${f(totalBalance / usd)}`}</span>}
                      {eur > 0 && <span className="flex items-center gap-1">🇪🇺 {hide ? '••••' : `€ ${f(totalBalance / eur)}`}</span>}
                      <span className="text-slate-500">· patrimonio no câmbio de hoje</span>
                    </p>
                  );
                })()}
              </div>
              <div className="hidden sm:flex flex-col items-center shrink-0"><Ring pct={rate} /><span className="text-[11px] text-slate-400 mt-1">poupança</span></div>
            </div>

            {(() => {
              const pos = accounts.filter((a) => Number(a.current_balance) > 0).sort((a, b) => b.current_balance - a.current_balance);
              const tot = pos.reduce((s, a) => s + Number(a.current_balance), 0);
              if (!tot) return null;
              return (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] text-slate-400 uppercase tracking-wider">Alocacao por conta</span></div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-white/10 gap-0.5">
                    {pos.map((a, i) => <div key={a.id} className="transition-all" style={{ width: `${(a.current_balance / tot) * 100}%`, background: a.color || colorAt(i) }} title={a.name} />)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {pos.slice(0, 4).map((a, i) => (<span key={a.id} className="flex items-center gap-1.5 text-[11px] text-slate-300"><span className="w-2 h-2 rounded-full" style={{ background: a.color || colorAt(i) }} />{a.name} · {val(a.current_balance)}</span>))}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-3 mt-5">
              <HeroStat label={`Entradas · ${monthLabel(mk).split(' ')[0]}`} value={val(cur.inc)} pct={pctChange(cur.inc, prev.inc)} good="up" tone="#34d399" />
              <HeroStat label="Saidas" value={val(cur.exp)} pct={pctChange(cur.exp, prev.exp)} good="down" tone="#fb7185" />
              <HeroStat label="Saldo" value={val(cur.bal)} pct={pctChange(cur.bal, prev.bal)} good="up" tone="#818cf8" />
            </div>
          </div>

          <div className="relative -mx-6 sm:-mx-7 -mb-6 sm:-mb-7 mt-5 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceTrail} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs><linearGradient id="heroA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.4} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs>
                <Tooltip formatter={(v) => money(v)} labelFormatter={() => 'saldo'} contentStyle={{ borderRadius: 10, border: 'none', background: '#0b1330', color: '#fff', fontSize: 12 }} />
                <Area dataKey="v" stroke="#34d399" strokeWidth={2.5} fill="url(#heroA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights dinamicos */}
        <Card className="flex flex-col">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-indigo-500" /> Insights inteligentes</h3>
          <div className="space-y-2.5 flex-1">
            {insights.map((i, k) => (
              <div key={k} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${i.color}1f`, color: i.color }}><i.icon className="w-4 h-4" /></span>
                <div className="min-w-0"><p className="text-sm font-semibold leading-tight">{i.title}</p><p className="text-xs text-muted leading-tight mt-0.5">{i.text}</p></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* KPIs com tendencia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal i={0}><Kpi label="Receitas" amount={cur.inc} hidden={hide} icon={TrendingUp} tone="emerald" pct={pctChange(cur.inc, prev.inc)} good="up" spark={series6.map((s) => s.inc)} /></Reveal>
        <Reveal i={1}><Kpi label="Despesas" amount={cur.exp} hidden={hide} icon={TrendingDown} tone="rose" pct={pctChange(cur.exp, prev.exp)} good="down" spark={series6.map((s) => s.exp)} /></Reveal>
        <Reveal i={2}><Kpi label="Saldo do mês" amount={cur.bal} hidden={hide} icon={Wallet} tone={cur.bal < 0 ? 'rose' : 'indigo'} pct={pctChange(cur.bal, prev.bal)} good="up" spark={series6.map((s) => s.net)} /></Reveal>
        <Reveal i={3}><Kpi label="Taxa de poupança" amount={rate} percent icon={PiggyBank} tone={rate >= 20 ? 'emerald' : 'amber'} pct={cur.rate - prev.rate} good="up" suffix="pp" spark={series6.map((s) => (s.inc > 0 ? ((s.inc - s.exp) / s.inc) * 100 : 0))} /></Reveal>
      </div>

      <RobotsSummaryCard />

      <div style={{ order: ordOf('charts') }} className={vis('charts') ? '' : 'hidden'}>
      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 hover-lift">
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold">Fluxo de Caixa</h3><span className="text-xs text-muted">receita, despesa e saldo — 6 meses</span></div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={series6} barGap={4}>
              <defs><linearGradient id="dInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.95} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.5} /></linearGradient><linearGradient id="dExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0.5} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
              <YAxis width={44} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} cursor={{ fill: 'hsl(var(--muted) / .08)' }} />
              <Bar dataKey="inc" name="Receita" fill="url(#dInc)" radius={[8, 8, 0, 0]} maxBarSize={30} />
              <Bar dataKey="exp" name="Despesa" fill="url(#dExp)" radius={[8, 8, 0, 0]} maxBarSize={30} />
              <Line dataKey="net" name="Saldo" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="hover-lift">
          <h3 className="font-semibold">Gastos por Categoria</h3>
          <p className="text-xs text-muted mb-2 capitalize">{monthLabel(mk)}</p>
          {byCategory.length === 0 ? <div className="flex flex-col items-center justify-center h-[220px] text-muted text-sm"><PiggyBank className="w-8 h-8 mb-2 opacity-40" />Sem despesas no mês</div>
            : (<>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">{byCategory.map((e, i) => <Cell key={i} fill={e.color || colorAt(i)} />)}</Pie><Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs text-muted">total</span><span className="font-display font-bold">{val(cur.exp)}</span></div>
              </div>
              <div className="space-y-1.5 mt-2">{byCategory.slice(0, 4).map((c, i) => (<div key={i} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || colorAt(i) }} /><span className="flex-1 truncate">{c.name}</span><span className="font-semibold">{val(c.value)}</span></div>))}</div>
            </>)}
        </Card>
      </div>

      </div>

      <div style={{ order: ordOf('cardcat') }} className={vis('cardcat') ? '' : 'hidden'}>
      {/* Gastos no cartão de crédito por categoria */}
      <Card className="hover-lift">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><CardIcon className="w-4 h-4 text-violet-500" /> Gastos no Cartão de Crédito por Categoria</h3>
          <span className="text-xs text-muted capitalize">{monthLabel(mk)} · total {val(cardTotal)}</span>
        </div>
        {cardByCategory.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted flex flex-col items-center"><CardIcon className="w-8 h-8 mb-2 opacity-40" />Sem gastos no cartão em {monthLabel(mk)}.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5 items-center">
            <div className="relative">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart><Pie data={cardByCategory} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3} stroke="none">{cardByCategory.map((e, i) => <Cell key={i} fill={e.color || colorAt(i)} />)}</Pie><Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs text-muted">cartao</span><span className="font-display font-bold">{val(cardTotal)}</span></div>
            </div>
            <div className="space-y-2.5">
              {cardByCategory.slice(0, 6).map((c, i) => { const pct = cardTotal > 0 ? Math.round((c.value / cardTotal) * 100) : 0; return (
                <div key={i}><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2 truncate"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || colorAt(i) }} />{c.name}</span><span className="text-muted">{pct}% · {val(c.value)}</span></div><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color || colorAt(i) }} /></div></div>
              ); })}
            </div>
          </div>
        )}
      </Card>

      </div>

      <div style={{ order: ordOf('projection') }} className={vis('projection') ? '' : 'hidden'}>
      {/* Projeção + acoes rapidas */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 hover-lift">
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold flex items-center gap-1.5"><Eye className="w-4 h-4 text-indigo-500" /> Projeção de Saldo</h3><span className="text-xs text-muted">próximos 6 meses (tendencia)</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={projection}><defs><linearGradient id="proj" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area dataKey="Saldo" stroke="#6366f1" strokeWidth={2.5} fill="url(#proj)" /></AreaChart>
          </ResponsiveContainer>
        </Card>
        <div className="grid grid-cols-2 gap-3 content-start">
          <ActionTile color="#10b981" icon={ArrowUpRight} label="Receita" onClick={() => navigate('/lançamentos')} />
          <ActionTile color="#f43f5e" icon={ArrowDownRight} label="Despesa" onClick={() => navigate('/lançamentos')} />
          <ActionTile color="#6366f1" icon={CardIcon} label="Cartões" onClick={() => navigate('/cartões')} />
          <ActionTile color="#8b5cf6" icon={Target} label="Metas" onClick={() => navigate('/metas')} />
        </div>
      </div>

      </div>

      <div style={{ order: ordOf('overview') }} className={vis('overview') ? '' : 'hidden'}>
      {/* Visao geral de gastos + comparativo por categoria */}
      {byCategory.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          <Card className="hover-lift">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Visao Geral de Gastos</h3><span className="text-xs text-muted capitalize">{monthLabel(mk)}</span></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl p-3 bg-sky-50 dark:bg-sky-500/10"><p className="text-xs text-muted">Essenciais</p><p className="font-bold text-lg text-sky-600 dark:text-sky-300">{val(overview.ess)}</p></div>
              <div className="rounded-xl p-3 bg-violet-50 dark:bg-violet-500/10"><p className="text-xs text-muted">Variaveis</p><p className="font-bold text-lg text-violet-600 dark:text-violet-300">{val(overview.varr)}</p></div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
              <div className="bg-sky-500 transition-all" style={{ width: `${overview.essPct}%` }} title="Essenciais" />
              <div className="bg-violet-500 transition-all" style={{ width: `${100 - overview.essPct}%` }} title="Variaveis" />
            </div>
            <p className="text-xs text-muted mt-2">{overview.essPct}% dos gastos são essenciais. {overview.essPct > 70 ? 'Pouca margem para cortes.' : 'Boa margem para otimizar variaveis.'}</p>
            <div className="mt-4 space-y-2">
              {byCategory.slice(0, 5).map((c, i) => { const pct = cur.exp > 0 ? Math.round((c.value / cur.exp) * 100) : 0; return (
                <div key={i}><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2 truncate"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || colorAt(i) }} />{c.name}</span><span className="text-muted">{pct}% · {val(c.value)}</span></div><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color || colorAt(i) }} /></div></div>
              ); })}
            </div>
          </Card>

          <Card className="hover-lift">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Comparativo por Categoria</h3><span className="text-xs text-muted">vs mes anterior</span></div>
            {comparison.length === 0 ? <p className="text-sm text-muted py-8 text-center">Sem dados para comparar.</p>
              : <div className="space-y-3">{comparison.map((c, i) => { const maxv = comparison[0]?.value || 1; const up = c.delta > 0; return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2 truncate"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || colorAt(i) }} />{c.name}</span>
                    <span className="flex items-center gap-2"><span className="font-semibold">{val(c.value)}</span>{isFinite(c.delta) && Math.abs(c.delta) >= 1 && <span className={`text-[11px] flex items-center gap-0.5 ${up ? 'text-rose-500' : 'text-emerald-500'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(c.delta).toFixed(0)}%</span>}</span>
                  </div>
                  <div className="flex gap-1 items-center"><div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex-1"><div className="h-full rounded-full" style={{ width: `${(c.value / maxv) * 100}%`, background: c.color || colorAt(i) }} /></div></div>
                </div>
              ); })}</div>}
          </Card>
        </div>
      )}

      </div>

      <div style={{ order: ordOf('recent') }} className={vis('recent') ? '' : 'hidden'}>
      {/* Recentes + A vencer */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Lançamentos recentes</h3><button onClick={() => navigate('/lançamentos')} className="text-sm text-emerald-600 font-semibold hover:underline flex items-center gap-1">Ver todos <ArrowRight className="w-3.5 h-3.5" /></button></div>
          {recent.length === 0 ? <div className="py-10 text-center text-sm text-muted">Nenhum lançamento em {monthLabel(mk)}. <button onClick={() => navigate('/lançamentos')} className="text-emerald-600 font-semibold">Adicionar</button></div>
            : <div className="divide-y divide-[hsl(var(--border))]">{recent.map((t) => {
              const cat = catMap[t.category_id];
              const isCard = t._src === 'card';
              const isCredit = isCard ? Number(t.amount) < 0 : t.type === 'income';
              const amt = Math.abs(Number(t.amount) || 0);
              const pend = !isCard && (t.status || 'pending') !== 'completed' && t.type !== 'transfer';
              const statusLabel = pend ? (t.type === 'income' ? 'a receber' : 'a pagar') : '';
              const ts = t.created_date || t.updated_date;
              const timeStr = ts && /T\d{2}:\d{2}/.test(String(ts)) ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
              const dateStr = new Date(t.date + 'T00:00').toLocaleDateString('pt-BR');
              const bg = isCard ? '#8b5cf6' : (cat?.color || (isCredit ? '#10b981' : '#f43f5e'));
              return (
                <div key={`${t._src}-${t.id}`} className="flex items-center gap-3 py-2.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: bg }}>{isCard ? <CardIcon className="w-4 h-4" /> : isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate flex items-center gap-1.5">{t.description || cat?.name || 'Lançamento'}{isCard && <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300"><CardIcon className="w-3 h-3" /> Cartão</span>}</p>
                    <p className="text-xs text-muted truncate">{dateStr}{timeStr ? ` ${timeStr}` : ''} · {cat?.name || 'Sem categoria'}{statusLabel ? ` · ${statusLabel}` : ''}</p>
                  </div>
                  <p className={`font-semibold shrink-0 ${isCredit ? 'text-emerald-500' : 'text-rose-500'} ${pend ? 'opacity-60' : ''}`}>{isCredit ? '+' : '-'}{val(amt)}</p>
                </div>
              ); })}</div>}
        </Card>

        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-sky-500" /> A vencer</h3>
          {upcoming.length === 0 ? <div className="py-8 text-center text-sm text-muted">Nada a vencer este mês.</div>
            : <div className="space-y-2">{upcoming.map((u, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: u.kind === 'inv' ? '#6366f11f' : '#0ea5e91f' }}>{u.kind === 'inv' ? <CardIcon className="w-4 h-4 text-indigo-500" /> : <CalendarClock className="w-4 h-4 text-sky-500" />}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.label}</p><p className="text-xs text-muted">{u.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p></div>
                <span className="text-sm font-semibold">{val(u.amount)}</span>
              </div>
            ))}</div>}
          {goals.length > 0 && (
            <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
              <p className="text-xs font-semibold text-muted mb-2">METAS</p>
              {goals.slice(0, 2).map((g) => { const pct = Math.min(100, Math.round((+g.current_amount / (+g.target_amount || 1)) * 100)); return (
                <div key={g.id} className="mb-2"><div className="flex justify-between text-sm mb-1"><span className="truncate">{g.name}</span><span className="text-muted">{pct}%</span></div><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color || '#10b981' }} /></div></div>
              ); })}
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative w-[70px] h-[70px]">
      <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90"><circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" /><circle cx="35" cy="35" r={r} fill="none" stroke="#34d399" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s ease' }} /></svg>
      <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-sm">{pct}%</div>
    </div>
  );
}

function TrendMini({ pct, good }) {
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return <p className="text-[11px] text-slate-400 mt-1">estavel vs mes anterior</p>;
  const up = pct > 0; const positive = good === 'up' ? up : !up;
  return <p className={`text-[11px] mt-1 flex items-center gap-0.5 ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(pct).toFixed(0)}% vs mes anterior</p>;
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${26 - (v / max) * 20}`).join(' ');
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-7 mt-1"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Kpi({ label, amount, hidden, percent, icon: Icon, tone, pct, good, spark, suffix }) {
  const tones = { emerald: ['text-emerald-500', 'bg-emerald-500/10', '#10b981'], rose: ['text-rose-500', 'bg-rose-500/10', '#f43f5e'], indigo: ['text-indigo-500', 'bg-indigo-500/10', '#6366f1'], amber: ['text-amber-500', 'bg-amber-500/10', '#f59e0b'] };
  const [txt, bg, hex] = tones[tone] || tones.emerald;
  const showPct = isFinite(pct) && Math.abs(pct) >= 0.5;
  const up = pct > 0; const positive = good === 'up' ? up : !up;
  return (
    <Card className="py-4 hover-lift h-full">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} ${txt}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className={`font-display text-2xl font-bold mt-1.5 ${txt}`}><AnimatedValue value={amount} hidden={percent ? false : hidden} format={(v) => (percent ? `${Math.round(v)}%` : money(v))} /></p>
      {showPct
        ? <p className={`text-[11px] font-medium flex items-center gap-0.5 ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(pct).toFixed(0)}{suffix || '%'} vs mes anterior</p>
        : <p className="text-[11px] text-muted">estavel vs mes anterior</p>}
      <Sparkline data={spark} color={hex} />
    </Card>
  );
}

function ActionTile({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover-lift flex flex-col justify-between min-h-[92px] group">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform group-hover:scale-110" style={{ background: color }}><Icon className="w-5 h-5" /></span>
      <span className="font-semibold text-sm mt-2">{label}</span>
    </button>
  );
}

function HeroStat({ label, value, pct, good, tone }) {
  const show = isFinite(pct) && Math.abs(pct) >= 0.5;
  const up = pct > 0; const positive = good === 'up' ? up : !up;
  return (
    <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3">
      <p className="text-[11px] text-slate-400 truncate">{label}</p>
      <p className="font-bold text-lg mt-0.5" style={{ color: tone }}>{value}</p>
      {show
        ? <p className={`text-[11px] flex items-center gap-0.5 ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(pct).toFixed(0)}%</p>
        : <p className="text-[11px] text-slate-500">estavel</p>}
    </div>
  );
}

function DashSkeleton() {
  const Box = ({ h }) => <div className="rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" style={{ height: h }} />;
  return (
    <div className="space-y-5">
      <Box h={40} />
      <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2"><Box h={240} /></div><Box h={240} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Box key={i} h={110} />)}</div>
      <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2"><Box h={320} /></div><Box h={320} /></div>
    </div>
  );
}
