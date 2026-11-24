import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Account, Transaction, Category, CreditCard, CreditCardTransaction, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { AiWordCloud } from '../components/AiWordCloud.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { Card, Spinner } from '../components/ui';
import { TaxBurdenCard } from '../components/TaxBurdenCard.jsx';
import { TaxMeasuredBlock } from '../components/TaxMeasuredBlock.jsx';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel, inMonth, monthRange } from '../lib/utils.js';
import { PALETTE, colorAt, lastMonths, monthlySeries, monthTotals, categoryBreakdown, forecastNextMonth, detectAnomalies, combineExpenses, weekdaySpending, detectSubscriptions, detectPriceHikes } from '../lib/analytics.js';
import { ComposedChart, Bar, Line, Area, AreaChart, PieChart, Pie, Cell, Treemap, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Target, CreditCard as CardIcon, PiggyBank, Eye, EyeOff,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Plus, Sparkles, AlertTriangle,
  CalendarClock, Flame, Trophy, Zap, ArrowRight, SlidersHorizontal, ChevronUp, ChevronDown,
  BarChart3, PieChart as PieIcon, ArrowLeftRight,
} from 'lucide-react';

const money = (v) => formatCurrency(v);

// Blocos do painel em grid (linhas inteiras). Hero, KPIs e carga tributaria ficam fixos no topo.
const WIDGET_DEFS = [
  { id: 'main', label: 'Fluxo, categorias, projeção e ações' },
  { id: 'cardcat', label: 'Gastos no cartão por categoria' },
  { id: 'detail', label: 'Visão geral, comparativo, recentes e a vencer' },
  { id: 'highlights', label: 'Destaques do mês' },
  { id: 'extras', label: 'Análises compactas' },
];
const DEFAULT_HIDDEN = { cardcat: true };
const LAYOUT_KEY = 'monvy_dash_layout_v2';
function loadLayout() {
  const ids = WIDGET_DEFS.map((w) => w.id);
  try { const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); if (s && Array.isArray(s.order)) { const order = s.order.filter((id) => ids.includes(id)); for (const id of ids) if (!order.includes(id)) order.push(id); return { order, hidden: s.hidden || {} }; } } catch {}
  return { order: ids, hidden: { ...DEFAULT_HIDDEN } };
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
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const geminiKey = settingsList[0]?.gemini_api_key;
  const { data: fx } = useQuery({ queryKey: ['fx-usd'], queryFn: fetchFx, retry: 1, staleTime: 60_000, refetchInterval: 120_000 });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const months = useMemo(() => monthRange(11, 4), []);
  const series6 = useMemo(() => monthlySeries(transactions, lastMonths(6, mk)), [transactions, mk]);

  const cur = useMemo(() => monthTotals(transactions, mk), [transactions, mk]);
  const prevMk = useMemo(() => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); }, [mk]);
  const prev = useMemo(() => monthTotals(transactions, prevMk), [transactions, prevMk]);

  const byCategory = useMemo(() => categoryBreakdown(transactions, mk, catMap), [transactions, mk, catMap]);

  // dados analíticos extras (contas + cartão)
  const tx6 = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const weekday = useMemo(() => weekdaySpending(tx6, null), [tx6]);
  const savingsSeries = useMemo(() => series6.map((s) => ({ name: s.name, rate: s.inc > 0 ? Math.round(((s.inc - s.exp) / s.inc) * 100) : 0 })), [series6]);
  const highlights = useMemo(() => {
    const subs = detectSubscriptions(tx6);
    const hikes = detectPriceHikes(tx6);
    const subTotal = subs.reduce((s, x) => s + Number(x.amount || 0), 0);
    const avgExp6 = series6.length ? series6.reduce((a, s) => a + s.exp, 0) / series6.length : 0;
    const reserveMonths = avgExp6 > 0 ? totalBalance / avgExp6 : 0;
    const top = byCategory[0];
    const out = [];
    if (top) out.push({ icon: Flame, color: '#f43f5e', title: 'Maior categoria', value: money(top.value), sub: top.name, to: '/para-onde-vai' });
    if (subs.length) out.push({ icon: Zap, color: '#6366f1', title: 'Assinaturas detectadas', value: `${money(subTotal)}/mês`, sub: `${subs.length} cobrança(s) recorrente(s)`, to: '/recorrencias' });
    out.push({ icon: PiggyBank, color: reserveMonths >= 3 ? '#10b981' : '#f59e0b', title: 'Reserva de emergência', value: `${reserveMonths.toFixed(1)} meses`, sub: reserveMonths >= 6 ? 'blindado' : reserveMonths >= 3 ? 'no caminho' : 'abaixo do ideal', to: '/reserva' });
    if (hikes.length) out.push({ icon: AlertTriangle, color: '#f59e0b', title: 'Subiram de preço', value: `${hikes.length} cobrança(s)`, sub: `ex.: ${hikes[0].name}`, to: '/recorrencias' });
    if (prev.exp > 0) { const d = ((cur.exp - prev.exp) / prev.exp) * 100; out.push({ icon: ArrowLeftRight, color: d <= 0 ? '#10b981' : '#f43f5e', title: 'Variação das despesas', value: `${d > 0 ? '+' : ''}${d.toFixed(0)}%`, sub: 'vs. mês anterior', to: '/comparador' }); }
    return out;
  }, [tx6, series6, totalBalance, byCategory, cur, prev]);

  // treemap "para onde vai" (compacto) + calendário de calor (7 semanas)
  const treemap = useMemo(() => byCategory.slice(0, 10).map((c, i) => ({ name: c.name, size: Math.max(1, Math.round(c.value)), color: c.color || colorAt(i) })), [byCategory]);
  const heat = useMemo(() => {
    const byDay = {};
    for (const t of tx6) { if (t.type !== 'expense') continue; const d = String(t.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + Number(t.amount || 0); }
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00');
    const start = new Date(today); start.setDate(start.getDate() - 48);
    while (start.getDay() !== 0) start.setDate(start.getDate() + 1);
    const cells = []; let max = 0;
    for (let i = 0; i < 49; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (d > today) { cells.push(null); continue; } const key = d.toISOString().slice(0, 10); const v = byDay[key] || 0; if (v > max) max = v; cells.push({ key, v, d }); }
    return { cells, max };
  }, [tx6]);
  const heatColor = (v) => { if (!v) return 'hsl(var(--muted)/0.12)'; const r = heat.max ? v / heat.max : 0; if (r < 0.2) return 'rgba(16,185,129,0.4)'; if (r < 0.45) return 'rgba(234,179,8,0.55)'; if (r < 0.7) return 'rgba(249,115,22,0.7)'; return 'rgba(244,63,94,0.85)'; };
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

  // patrimonio dia a dia (ultimos 30 dias): parte do saldo atual e desfaz os lancamentos reais
  const dailyTrail = useMemo(() => {
    const netByDay = {};
    for (const tx of transactions) {
      const d = String(tx.date).slice(0, 10);
      if (tx.type === 'income') netByDay[d] = (netByDay[d] || 0) + Number(tx.amount || 0);
      else if (tx.type === 'expense') netByDay[d] = (netByDay[d] || 0) - Number(tx.amount || 0);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const arr = []; let running = totalBalance;
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      arr.unshift({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''), v: Math.round(running * 100) / 100 });
      running -= netByDay[key] || 0;
    }
    return arr;
  }, [transactions, totalBalance]);
  const patrimonyPct = useMemo(() => { const start = dailyTrail[0]?.v || 0; return start !== 0 ? ((totalBalance - start) / Math.abs(start)) * 100 : NaN; }, [dailyTrail, totalBalance]);

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
    if (cur.rate < 0) arr.push({ icon: AlertTriangle, color: '#f43f5e', title: 'Gastando mais que ganha', text: `Saldo do mês ${money(cur.net)}.` });
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
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Barra de controle compacta (mês, personalizar, ocultar valores) */}
      <div className="flex items-center justify-between gap-3 flex-wrap -mt-1">
        <p className="text-xs text-muted">{greet}, <span className="font-semibold text-[hsl(var(--text))]">{(user?.full_name || 'Usuário').split(' ')[0]}</span> · {t('dash.subtitle')} · <span className="capitalize">{monthLabel(mk)}</span></p>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 card !rounded-xl px-1 py-0.5">
            <button onClick={() => shift(-1)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-xs font-semibold outline-none cursor-pointer px-1 capitalize">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
            <button onClick={() => shift(1)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setCustomize((c) => !c)} className={`p-2 rounded-xl card !rounded-xl hover:bg-black/5 dark:hover:bg-white/10 ${customize ? 'text-emerald-500' : ''}`} title="Personalizar painel" aria-label="Personalizar painel"><SlidersHorizontal className="w-4 h-4" /></button>
          <button onClick={() => setHide((h) => !h)} className="p-2 rounded-xl card !rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title={hide ? 'Mostrar valores' : 'Ocultar valores'} aria-label={hide ? 'Mostrar valores' : 'Ocultar valores'}>{hide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
        </div>
      </div>

      {customize && (
        <Panel>
          <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-emerald-500" /> {t('dash.customize')}</h3><button onClick={() => setCustomize(false)} className="text-sm text-emerald-600 font-semibold">{t('dash.done')}</button></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-1.5">
            {layout.order.map((id, idx) => { const w = WIDGET_DEFS.find((x) => x.id === id); return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={vis(id)} onChange={() => toggleVis(id)} />
                <span className="flex-1 text-xs">{w?.label || id}</span>
                <button onClick={() => moveWidget(id, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveWidget(id, 1)} disabled={idx === layout.order.length - 1} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30" aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
              </div>
            ); })}
          </div>
          <p className="text-[11px] text-muted mt-2">Marque para exibir e use as setas para reordenar os blocos. Fica salvo neste dispositivo.</p>
        </Panel>
      )}

      {/* ===== Linha 1: Hero (patrimônio + poupança + tendência + contas) | Insights ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-9 relative overflow-hidden rounded-2xl text-white flex flex-col justify-center shadow-soft ring-1 ring-emerald-400/25"
          style={{ background: 'linear-gradient(115deg,#06231d 0%,#0a1a2a 38%,#0d1433 70%,#24135a 100%)' }}>
          <div className="absolute -top-24 -left-10 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(52,211,153,.22), transparent 70%)' }} />
          <div className="absolute -bottom-28 right-0 w-96 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.30), transparent 70%)' }} />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

          <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] gap-5 p-5 items-center">
            {/* Patrimônio */}
            <div className="min-w-0">
              <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-emerald-400" /> Patrimônio total</p>
              <p className="font-display text-4xl 2xl:text-[2.75rem] leading-none font-extrabold tracking-tight mt-2 truncate"><AnimatedValue value={totalBalance} hidden={hide} format={money} /></p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {isFinite(patrimonyPct) && Math.abs(patrimonyPct) >= 0.05
                  ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${patrimonyPct >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{patrimonyPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{patrimonyPct >= 0 ? '+' : ''}{patrimonyPct.toFixed(1).replace('.', ',')}%</span>
                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-300">estável</span>}
                <span className="text-xs text-slate-400">vs. 30 dias atrás</span>
              </div>
            </div>

            {/* Poupança + tendência do patrimônio (30 dias) */}
            <div className="min-w-0 flex items-center gap-4">
              <div className="shrink-0 flex flex-col items-center"><Ring pct={rate} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 font-medium">Taxa de poupança</p>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrail} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                      <defs><linearGradient id="heroA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={7} padding={{ left: 18, right: 8 }} />
                      <Tooltip formatter={(v) => (hide ? '••••' : money(v))} labelFormatter={(l) => `Patrimônio · ${l}`} contentStyle={{ borderRadius: 10, border: 'none', background: '#0b1330', color: '#fff', fontSize: 12 }} />
                      <Area dataKey="v" stroke="#34d399" strokeWidth={2.5} fill="url(#heroA)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Contas ativas */}
            <button onClick={() => navigate('/contas')} className="hidden md:flex flex-col items-start gap-2 pl-5 border-l border-white/10 text-left min-w-[130px] group">
              <span className="flex items-center gap-2 text-xs text-slate-300 font-medium"><span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center"><Wallet className="w-3.5 h-3.5" /></span>Contas ativas</span>
              <span className="font-display text-2xl font-bold group-hover:text-emerald-300 transition">{accounts.length} conta{accounts.length === 1 ? '' : 's'}</span>
              <span className="flex gap-1">{accounts.slice(0, 8).map((a, i) => <span key={a.id} className="w-2 h-2 rounded-full" style={{ background: a.color || colorAt(i) }} title={a.name} />)}</span>
            </button>
          </div>
        </div>

        <Panel className="xl:col-span-3 flex flex-col">
          <h3 className="font-semibold flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-500" /> Insights inteligentes</h3>
          <div className="space-y-2 flex-1 flex flex-col justify-center">
            {insights.slice(0, 2).map((i, k) => (
              <div key={k} className="flex items-start gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${i.color}1f`, color: i.color }}><i.icon className="w-4 h-4" /></span>
                <div className="min-w-0"><p className="text-sm font-semibold leading-tight truncate">{i.title}</p><p className="text-xs text-muted leading-tight mt-0.5">{i.text}</p></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ===== Linha 2: KPIs (horizontais, com sparkline à direita) ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Reveal i={0}><Kpi label={t('dash.income')} amount={cur.inc} hidden={hide} icon={ArrowUpRight} tone="emerald" pct={pctChange(cur.inc, prev.inc)} good="up" spark={series6.map((s) => s.inc)} /></Reveal>
        <Reveal i={1}><Kpi label={t('dash.expenses')} amount={cur.exp} hidden={hide} icon={ArrowDownRight} tone="rose" pct={pctChange(cur.exp, prev.exp)} good="down" spark={series6.map((s) => s.exp)} /></Reveal>
        <Reveal i={2}><Kpi label={t('dash.month_balance')} amount={cur.net} hidden={hide} icon={Wallet} tone={cur.net < 0 ? 'rose' : 'indigo'} pct={pctChange(cur.net, prev.net)} good="up" spark={series6.map((s) => s.net)} /></Reveal>
        <Reveal i={3}><Kpi label={t('dash.savings_rate')} amount={rate} percent icon={TrendingUp} tone="amber" pct={cur.rate - prev.rate} good="up" suffix="pp" spark={series6.map((s) => (s.inc > 0 ? ((s.inc - s.exp) / s.inc) * 100 : 0))} /></Reveal>
      </div>

      {/* ===== Linha 3: Carga tributária (faixa) ===== */}
      <TaxBurdenCard variant="banner" />

      <div className="flex flex-col gap-4">
      {/* ===== Linha 4: Fluxo de caixa | Categorias | Projeção | Ações ===== */}
      <div style={{ order: ordOf('main') }} className={vis('main') ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.88fr_0.55fr] gap-4' : 'hidden'}>
        <Panel className="hover-lift flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> {t('dash.cashflow')}</h3>
            <div className="flex items-center gap-3 text-[11px] text-muted"><Dot c="#10b981" /> Receitas <Dot c="#f43f5e" /> Despesas <Dot c="#8b5cf6" /> Saldo</div>
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series6} barGap={3} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <defs><linearGradient id="dInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.95} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.55} /></linearGradient><linearGradient id="dExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0.55} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} cursor={{ fill: 'hsl(var(--muted) / .08)' }} />
                <Bar dataKey="inc" name="Receita" fill="url(#dInc)" radius={[5, 5, 0, 0]} maxBarSize={18} />
                <Bar dataKey="exp" name="Despesa" fill="url(#dExp)" radius={[5, 5, 0, 0]} maxBarSize={18} />
                <Line dataKey="net" name="Saldo" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="hover-lift flex flex-col">
          <h3 className="font-semibold flex items-center gap-2"><PieIcon className="w-4 h-4 text-violet-500" /> {t('dash.by_category')}</h3>
          <p className="text-[11px] text-muted capitalize mb-1">{monthLabel(mk)}</p>
          {byCategory.length === 0 ? <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] text-muted text-sm"><PiggyBank className="w-8 h-8 mb-2 opacity-40" />{t('dash.no_expenses_month')}</div>
            : (
              <div className="flex-1 grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-3 items-center">
                <div className="relative h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={2} stroke="none">{byCategory.map((e, i) => <Cell key={i} fill={e.color || colorAt(i)} />)}</Pie><Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} /></PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-[10px] text-muted">Total</span><span className="font-display font-bold text-xs">{val(cur.exp)}</span></div>
                </div>
                <div className="space-y-1.5 min-w-0">
                  {byCategory.slice(0, 5).map((c, i) => { const pct = cur.exp > 0 ? Math.round((c.value / cur.exp) * 100) : 0; return (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color || colorAt(i) }} /><span className="flex-1 truncate">{c.name}</span><span className="font-semibold whitespace-nowrap">{val(c.value)}</span><span className="text-muted w-8 text-right">{pct}%</span></div>
                  ); })}
                </div>
              </div>
            )}
        </Panel>

        <Panel className="hover-lift flex flex-col">
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold flex items-center gap-1.5"><Eye className="w-4 h-4 text-indigo-500" /> Projeção de Saldo</h3><span className="text-[11px] text-muted">próximos 6 meses</span></div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}><defs><linearGradient id="proj" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={kfmt} /><Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} /><Area dataKey="Saldo" stroke="#6366f1" strokeWidth={2.5} fill="url(#proj)" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="md:col-span-2 xl:col-span-1 grid grid-cols-2 gap-3">
          <ActionTile color="#10b981" icon={ArrowUpRight} label={t('dash.act_income')} onClick={() => navigate('/lancamentos')} />
          <ActionTile color="#f43f5e" icon={ArrowDownRight} label={t('dash.act_expense')} onClick={() => navigate('/lancamentos')} />
          <ActionTile color="#6366f1" icon={CardIcon} label={t('dash.act_cards')} onClick={() => navigate('/cartoes')} />
          <ActionTile color="#8b5cf6" icon={Target} label={t('dash.act_goals')} onClick={() => navigate('/metas')} />
        </div>
      </div>

      {/* Gastos no cartão por categoria (opcional — ative em Personalizar) */}
      <div style={{ order: ordOf('cardcat') }} className={vis('cardcat') ? '' : 'hidden'}>
        <Panel className="hover-lift">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><CardIcon className="w-4 h-4 text-violet-500" /> Gastos no Cartão de Crédito por Categoria</h3>
            <span className="text-xs text-muted capitalize">{monthLabel(mk)} · total {val(cardTotal)}</span>
          </div>
          {cardByCategory.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted flex flex-col items-center"><CardIcon className="w-8 h-8 mb-2 opacity-40" />Sem gastos no cartão em {monthLabel(mk)}.</div>
          ) : (
            <div className="grid md:grid-cols-[220px_1fr] gap-5 items-center">
              <div className="relative h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={cardByCategory} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={2} stroke="none">{cardByCategory.map((e, i) => <Cell key={i} fill={e.color || colorAt(i)} />)}</Pie><Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} /></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-[10px] text-muted">cartão</span><span className="font-display font-bold text-sm">{val(cardTotal)}</span></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {cardByCategory.slice(0, 8).map((c, i) => { const pct = cardTotal > 0 ? Math.round((c.value / cardTotal) * 100) : 0; return (
                  <div key={i}><div className="flex justify-between text-xs mb-1"><span className="flex items-center gap-2 truncate"><span className="w-2 h-2 rounded-full" style={{ background: c.color || colorAt(i) }} />{c.name}</span><span className="text-muted">{pct}% · {val(c.value)}</span></div><Bar1 pct={pct} color={c.color || colorAt(i)} /></div>
                ); })}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ===== Linha 5: Visão geral | Comparativo | Recentes | A vencer + Metas ===== */}
      <div style={{ order: ordOf('detail') }} className={vis('detail') ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' : 'hidden'}>
        <Panel className="hover-lift">
          <h3 className="font-semibold mb-2">{t('dash.overview')}</h3>
          {byCategory.length === 0 ? <p className="text-sm text-muted py-8 text-center">{t('dash.no_expenses_month')}</p> : (<>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg px-2.5 py-1.5 bg-emerald-500/10 ring-1 ring-emerald-500/20"><p className="text-[10px] text-muted">{t('dash.essentials')}</p><p className="font-bold text-sm text-emerald-600 dark:text-emerald-300">{val(overview.ess)}</p></div>
              <div className="rounded-lg px-2.5 py-1.5 bg-violet-500/10 ring-1 ring-violet-500/20"><p className="text-[10px] text-muted">{t('dash.variable')}</p><p className="font-bold text-sm text-violet-600 dark:text-violet-300">{val(overview.varr)}</p></div>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
              <div className="bg-emerald-500" style={{ width: `${overview.essPct}%` }} title="Essenciais" />
              <div className="bg-violet-500" style={{ width: `${100 - overview.essPct}%` }} title="Variáveis" />
            </div>
            <p className="text-[11px] text-muted mt-1.5">{overview.essPct}% dos gastos são essenciais. {overview.essPct > 70 ? 'Pouca margem para cortes.' : 'Boa margem para otimizar variáveis.'}</p>
            <div className="mt-2 space-y-1">
              {byCategory.slice(0, 5).map((c, i) => { const pct = cur.exp > 0 ? Math.round((c.value / cur.exp) * 100) : 0; return (
                <div key={i} className="flex items-center gap-2 text-[11px]"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color || colorAt(i) }} /><span className="flex-1 truncate">{c.name}</span><span className="text-muted whitespace-nowrap">{pct}% · {val(c.value)}</span></div>
              ); })}
            </div>
          </>)}
        </Panel>

        <Panel className="hover-lift">
          <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">{t('dash.compare_cat')}</h3><span className="text-[11px] text-muted">{t('dash.vs_prev')}</span></div>
          {comparison.length === 0 ? <p className="text-sm text-muted py-8 text-center">{t('dash.no_compare')}</p>
            : <div className="space-y-2.5">{comparison.slice(0, 5).map((c, i) => { const maxv = comparison[0]?.value || 1; const up = c.delta > 0; const flat = !isFinite(c.delta) || Math.abs(c.delta) < 1; return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1"><span className="flex items-center gap-2 truncate"><span className="w-2 h-2 rounded-full" style={{ background: c.color || colorAt(i) }} />{c.name}</span>
                  <span className="flex items-center gap-2"><span className="font-semibold">{val(c.value)}</span>{flat ? <span className="text-[10px] text-muted w-10 text-right">— 0%</span> : <span className={`text-[10px] w-10 justify-end flex items-center gap-0.5 ${up ? 'text-rose-500' : 'text-emerald-500'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{up ? '+' : '-'}{Math.abs(c.delta).toFixed(0)}%</span>}</span>
                </div>
                <Bar1 pct={(c.value / maxv) * 100} color={c.color || colorAt(i)} />
              </div>
            ); })}</div>}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold">{t('dash.recent')}</h3><button onClick={() => navigate('/lancamentos')} className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">{t('dash.see_all')} <ArrowRight className="w-3 h-3" /></button></div>
          {recent.length === 0 ? <div className="py-8 text-center text-sm text-muted">{t('dash.no_expenses_month')}. <button onClick={() => navigate('/lancamentos')} className="text-emerald-600 font-semibold">{t('dash.add')}</button></div>
            : <div className="divide-y divide-[hsl(var(--border))]">{recent.slice(0, 5).map((tx) => {
              const cat = catMap[tx.category_id];
              const isCard = tx._src === 'card';
              const isCredit = isCard ? Number(tx.amount) < 0 : tx.type === 'income';
              const amt = Math.abs(Number(tx.amount) || 0);
              const pend = !isCard && (tx.status || 'pending') !== 'completed' && tx.type !== 'transfer';
              const ts = tx.created_date || tx.updated_date;
              const timeStr = ts && /T\d{2}:\d{2}/.test(String(ts)) ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
              const dateStr = new Date(tx.date + 'T00:00').toLocaleDateString('pt-BR');
              return (
                <div key={`${tx._src}-${tx.id}`} className="flex items-center gap-2.5 py-1.5">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCard ? 'bg-violet-500/15 text-violet-500' : isCredit ? 'bg-emerald-500/15 text-emerald-500' : 'bg-teal-500/15 text-teal-500'}`}>{isCard ? <CardIcon className="w-3.5 h-3.5" /> : isCredit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{tx.description || cat?.name || 'Lançamento'}</p>
                    <p className="text-[10px] text-muted truncate">{dateStr}{timeStr ? ` ${timeStr}` : ''} · {cat?.name || 'Sem categoria'}{pend ? ` · ${tx.type === 'income' ? 'a receber' : 'a pagar'}` : ''}</p>
                  </div>
                  <p className={`text-xs font-semibold shrink-0 ${isCredit ? 'text-emerald-500' : 'text-rose-500'} ${pend ? 'opacity-60' : ''}`}>{isCredit ? '+ ' : '- '}{val(amt)}</p>
                </div>
              ); })}</div>}
        </Panel>

        <Panel className="flex flex-col">
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-sky-500" /> A vencer</h3><button onClick={() => navigate('/calendario')} className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">Ver calendário <ArrowRight className="w-3 h-3" /></button></div>
          {upcoming.length === 0 ? <p className="py-4 text-center text-xs text-muted">{t('dash.nothing_due')}</p>
            : <div className="space-y-1">{upcoming.slice(0, 3).map((u, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: u.kind === 'inv' ? '#6366f11f' : '#0ea5e91f' }}>{u.kind === 'inv' ? <CardIcon className="w-3.5 h-3.5 text-indigo-500" /> : <CalendarClock className="w-3.5 h-3.5 text-sky-500" />}</span>
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{u.label}</p><p className="text-[10px] text-muted">{u.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p></div>
                <span className="text-xs font-semibold">{val(u.amount)}</span>
              </div>
            ))}</div>}
          {goals.length > 0 && (
            <div className="mt-auto border-t border-[hsl(var(--border))] pt-2">
              <p className="text-[10px] font-semibold text-muted mb-1.5 tracking-wide">METAS</p>
              {goals.slice(0, 2).map((g) => { const pct = Math.min(100, Math.round((+g.current_amount / (+g.target_amount || 1)) * 100)); return (
                <div key={g.id} className="mb-2"><div className="flex justify-between text-xs mb-1"><span className="truncate font-medium">{g.name}</span><span className="font-semibold">{pct}%</span></div><Bar1 pct={pct} color={g.color || '#10b981'} /></div>
              ); })}
            </div>
          )}
        </Panel>
      </div>

      {/* ===== Linha 6: Destaques do mês ===== */}
      {highlights.length > 0 && (
        <div style={{ order: ordOf('highlights') }} className={vis('highlights') ? '' : 'hidden'}>
          <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-500" /><h3 className="font-semibold text-sm truncate">Destaques do mês</h3></div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {highlights.map((h, i) => (
              <Reveal key={i} i={Math.min(i, 5)}>
                <button onClick={() => navigate(h.to)} className="w-full h-full text-left card hover-lift px-4 py-3 !rounded-xl flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${h.color}1f`, color: h.color }}><h.icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted truncate">{h.title}</p>
                    <p className="font-display text-base font-bold leading-tight truncate">{h.value}</p>
                    <p className="text-[11px] text-muted truncate">{h.sub}</p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {/* ===== Linha 7: Análises compactas (6 colunas) ===== */}
      <div style={{ order: ordOf('extras') }} className={vis('extras') ? 'grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6' : 'hidden'}>
        <Panel className="hover-lift flex flex-col">
          <h3 className="font-semibold text-sm truncate">Gasto por dia da semana</h3>
          <div className="flex-1 min-h-[150px] mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekday} margin={{ top: 6, right: 0, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis width={36} tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={18}>{weekday.map((e, i) => <Cell key={i} fill={e.weekend ? '#f43f5e' : '#6366f1'} />)}</Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="hover-lift flex flex-col">
          <h3 className="font-semibold text-sm truncate">Evolução da taxa de poupança</h3>
          <div className="flex-1 min-h-[150px] mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsSeries} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                <defs><linearGradient id="savR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={36} tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={tipStyle} />
                <Area dataKey="rate" stroke="#10b981" strokeWidth={2} fill="url(#savR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="hover-lift flex flex-col">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-sm truncate">Para onde vai o dinheiro</h3><button onClick={() => navigate('/para-onde-vai')} className="text-emerald-600" aria-label="Abrir Para onde vai"><ArrowRight className="w-3.5 h-3.5" /></button></div>
          {treemap.length === 0 ? <p className="text-xs text-muted py-8 text-center">Sem despesas categorizadas neste mês.</p>
            : <div className="flex-1 min-h-[150px] mt-1"><ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemap} dataKey="size" isAnimationActive content={(p) => {
                const { x, y, width, height, name, index } = p;
                if (width < 2 || height < 2) return null;
                const c = treemap[index]?.color || colorAt(index);
                const show = width > 40 && height > 18;
                return (<g><rect x={x} y={y} width={width} height={height} rx={4} style={{ fill: c, stroke: 'hsl(var(--card))', strokeWidth: 2 }} />{show && <text x={x + 5} y={y + 13} fill="#fff" fontSize={9} fontWeight={600}>{name}</text>}</g>);
              }}>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ ...tipStyle, color: 'hsl(var(--text))' }} />
              </Treemap>
            </ResponsiveContainer></div>}
        </Panel>

        <Panel className="hover-lift flex flex-col">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-sm truncate">Calendário de gastos</h3><button onClick={() => navigate('/mapa-de-calor')} className="text-emerald-600" aria-label="Abrir mapa de calor"><ArrowRight className="w-3.5 h-3.5" /></button></div>
          <p className="text-[10px] text-muted mb-2">Últimas 7 semanas — dias mais quentes gastam mais</p>
          <div className="flex gap-1 flex-1">
            <div className="grid grid-rows-7 gap-[3px] pr-0.5 text-[8px] text-muted">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="h-3 flex items-center">{d}</span>)}</div>
            <div className="grid grid-flow-col grid-rows-7 gap-[3px] flex-1">
              {heat.cells.map((c, i) => c === null ? <span key={i} /> : (
                <span key={i} title={`${c.d.toLocaleDateString('pt-BR')}: ${money(c.v)}`} className="h-3 rounded-[2px]" style={{ background: heatColor(c.v) }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted justify-end mt-2">menos
            {['hsl(var(--muted)/0.12)', 'rgba(16,185,129,0.4)', 'rgba(234,179,8,0.55)', 'rgba(249,115,22,0.7)', 'rgba(244,63,94,0.85)'].map((b) => <span key={b} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: b }} />)} mais
          </div>
        </Panel>

        <AiWordCloud cardTxs={cardTxs} transactions={transactions} apiKey={geminiKey} compact />
        <TaxMeasuredBlock variant="compact" />
      </div>
      </div>
    </div>
  );
}

const tipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 };
const kfmt = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v);

function Panel({ className = '', children, ...props }) {
  return <div className={`card !rounded-xl p-4 ${className}`} {...props}>{children}</div>;
}

function Dot({ c }) { return <span className="inline-block w-2 h-2 rounded-full -mr-1.5" style={{ background: c }} />; }

function Bar1({ pct, color }) {
  return <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative w-[70px] h-[70px]" title="Taxa de poupança do mês">
      <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90"><circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" /><circle cx="35" cy="35" r={r} fill="none" stroke="#34d399" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s ease' }} /></svg>
      <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-sm">{pct}%</div>
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${26 - (v / max) * 20}`).join(' ');
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-10"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Kpi({ label, amount, hidden, percent, icon: Icon, tone, pct, good, spark, suffix }) {
  const tones = { emerald: ['text-emerald-500', 'bg-emerald-500/15', '#10b981'], rose: ['text-rose-500', 'bg-rose-500/15', '#f43f5e'], indigo: ['text-indigo-500', 'bg-indigo-500/15', '#8b5cf6'], amber: ['text-amber-500', 'bg-amber-500/15', '#f59e0b'] };
  const [txt, bg, hex] = tones[tone] || tones.emerald;
  const showPct = isFinite(pct) && Math.abs(pct) >= 0.5;
  const up = pct > 0; const positive = good === 'up' ? up : !up;
  return (
    <div className="card !rounded-xl px-4 py-3.5 hover-lift h-full flex items-center gap-3">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg} ${txt}`}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0 shrink-0 max-w-[70%]">
        <p className="text-xs text-muted truncate">{label}</p>
        <p className={`font-display text-xl 2xl:text-2xl font-bold leading-tight whitespace-nowrap ${txt}`}><AnimatedValue value={amount} hidden={percent ? false : hidden} format={(v) => (percent ? `${Math.round(v)}%` : money(v))} /></p>
        {showPct
          ? <p className="text-[11px] text-muted flex items-center gap-0.5 truncate"><span className={`inline-flex items-center gap-0.5 font-semibold ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{up ? '+' : '-'}{Math.abs(pct).toFixed(0)}{suffix || '%'}</span>&nbsp;vs. mês anterior</p>
          : <p className="text-[11px] text-muted truncate">— estável vs. mês anterior</p>}
      </div>
      <div className="flex-1 min-w-[48px] max-w-[130px] ml-auto hidden sm:block"><Sparkline data={spark} color={hex} /></div>
    </div>
  );
}

function ActionTile({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className="card !rounded-xl p-3 text-left hover-lift flex flex-col justify-between min-h-[96px] group">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-transform group-hover:scale-110" style={{ background: color }}><Icon className="w-4 h-4" /></span>
      <span className="font-semibold text-sm mt-2">{label}</span>
    </button>
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
