import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { RecurrencesPanel } from '../components/transactions/RecurrencesPanel.jsx';
import { Button, Card, Input, Select, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { exportTransactionsXlsx } from '../lib/exportXlsx.js';
import { exportReportToPdf } from '../lib/exportPdf.js';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth, todayIso } from '../lib/utils.js';
import { colorAt } from '../lib/analytics.js';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, ComposedChart, Area, AreaChart, CartesianGrid } from 'recharts';
import {
  Plus, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  CircleCheck, Clock, Paperclip, Copy, CheckSquare, X, Pin, RefreshCw, Wand2, SlidersHorizontal, Repeat,
  FileSpreadsheet, FileText, CalendarRange, Sparkles, TrendingDown, TrendingUp, PiggyBank,
  CalendarDays, BarChart3, ArrowUpDown, MoreVertical, Tag, Trophy, CalendarClock, Target, ArrowRight,
} from 'lucide-react';

const TABS = [['overview', 'Visão Geral'], ['list', 'Lista de Lançamentos'], ['recurring', 'Recorrências'], ['rules', 'Regras Automáticas']];

const TYPE_FILTERS = [['all', 'Tudo'], ['income', 'Receitas'], ['expense', 'Despesas'], ['transfer', 'Transferências']];
const STATUS_FILTERS = [['all', 'Todos'], ['pending', 'Em aberto'], ['completed', 'Concluídos']];
// filtros inteligentes: id -> [rótulo, predicado]
const SMART = [
  ['fixed', 'Fixos', (t) => t.is_fixed],
  ['recurring', 'Recorrentes', (t) => t.parent_transaction_id || (t.recurrence && t.recurrence !== 'none')],
  ['nocat', 'Sem categoria', (t) => t.type !== 'transfer' && !t.category_id],
  ['receipt', 'Com comprovante', (t) => !!t.receipt_url],
];

export default function Transactions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('overview');
  const [mk, setMk] = useState(monthKey(new Date()));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [smart, setSmart] = useState(null);
  const [modal, setModal] = useState(false);
  const [defaultType, setDefaultType] = useState('expense');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [advOpen, setAdvOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [customRange, setCustomRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [recurOpen, setRecurOpen] = useState(false);
  const [recurEditing, setRecurEditing] = useState(null);
  const pageRef = useRef(null);

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const months = useMemo(() => monthRange(11, 4), []);

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const markStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: inval });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { inval(); setModal(false); setEditing(null); } });
  const del = useMutation({ mutationFn: (id) => Transaction.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const dup = useMutation({
    mutationFn: (t) => Transaction.create({ type: t.type, date: todayIso(), amount: Number(t.amount), description: t.description, account_id: t.account_id, account_to_id: t.account_to_id || null, category_id: t.category_id || null, is_fixed: !!t.is_fixed, recurrence: t.recurrence || 'none', status: 'pending' }),
    onSuccess: () => { inval(); toast.success('Lançamento duplicado para hoje, em aberto.'); },
  });

  // Periodo base: mes selecionado no hero, OU um intervalo de datas livre
  // (filtro avancado) quando ativado — os dois nunca se combinam.
  const monthTx = useMemo(() => transactions.filter((t) => inMonth(t.date, mk)), [transactions, mk]);
  const rangeTx = useMemo(() => {
    if (!customRange || !rangeFrom || !rangeTo) return null;
    return transactions.filter((t) => String(t.date).slice(0, 10) >= rangeFrom && String(t.date).slice(0, 10) <= rangeTo);
  }, [transactions, customRange, rangeFrom, rangeTo]);
  const baseTx = rangeTx ?? monthTx;
  const smartFn = SMART.find((s) => s[0] === smart)?.[2];
  const filtered = useMemo(() => baseTx.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    const st = t.status || 'pending';
    if (statusFilter === 'pending' && st !== 'pending') return false;
    if (statusFilter === 'completed' && st !== 'completed') return false;
    if (smartFn && !smartFn(t)) return false;
    if (accountFilter !== 'all' && t.account_id !== accountFilter && t.account_to_id !== accountFilter) return false;
    if (amountMin !== '' && Number(t.amount) < Number(amountMin)) return false;
    if (amountMax !== '' && Number(t.amount) > Number(amountMax)) return false;
    if (search) { const q = search.toLowerCase(); const cat = catMap[t.category_id]?.name?.toLowerCase() || ''; if (!(t.description || '').toLowerCase().includes(q) && !cat.includes(q)) return false; }
    return true;
  }).sort((a, b) => (a.date < b.date ? 1 : -1)), [baseTx, typeFilter, statusFilter, smartFn, accountFilter, amountMin, amountMax, search, catMap]);
  const advActive = accountFilter !== 'all' || amountMin !== '' || amountMax !== '' || customRange;

  const totals = useMemo(() => {
    let inc = 0, exp = 0, pend = 0;
    for (const t of monthTx) {
      if (t.type === 'income') inc += Number(t.amount);
      if (t.type === 'expense') exp += Number(t.amount);
      if (t.type !== 'transfer' && (t.status || 'pending') !== 'completed') pend += Number(t.amount);
    }
    return { inc, exp, bal: inc - exp, pend };
  }, [monthTx]);
  const incExpMax = Math.max(totals.inc, totals.exp, 1);

  // evolução semanal (receitas x despesas) dentro do periodo exibido no hero —
  // sempre a partir de dados reais do mes, nunca estimado.
  const weeklySeries = useMemo(() => {
    const weeks = [[], [], [], [], []];
    for (const t of monthTx) {
      const day = Number(String(t.date).slice(8, 10)) || 1;
      const wi = Math.min(4, Math.floor((day - 1) / 7));
      weeks[wi].push(t);
    }
    return weeks.map((items, i) => ({
      name: `Sem ${i + 1}`,
      Receitas: items.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      Despesas: items.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    })).filter((w, i) => i === 0 || w.Receitas > 0 || w.Despesas > 0);
  }, [monthTx]);

  // despesas por categoria dentro do escopo atualmente filtrado (acompanha
  // o periodo e os filtros aplicados, igual ao resto da tela)
  const filteredExpByCategory = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      if (t.type !== 'expense') continue;
      const c = catMap[t.category_id];
      const name = c?.name || 'Sem categoria';
      (map[name] = map[name] || { name, value: 0, color: c?.color }).value += Number(t.amount) || 0;
    }
    return Object.values(map).sort((a, b) => b.value - a.value).map((c, i) => ({ ...c, color: c.color || colorAt(i) }));
  }, [filtered, catMap]);
  const filteredExpTotal = filteredExpByCategory.reduce((s, c) => s + c.value, 0);

  // insights dos lancamentos — so a partir de dados reais do periodo exibido;
  // a comparacao com "mes anterior" so faz sentido quando nao ha intervalo
  // personalizado ativo (ai nao ha um "mes anterior" bem definido)
  const prevMk = useMemo(() => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); }, [mk]);
  const prevExp = useMemo(() => !customRange ? transactions.filter((t) => inMonth(t.date, prevMk) && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) : 0, [transactions, prevMk, customRange]);
  const pendingRecurring = useMemo(() => monthTx.filter((t) => t.parent_transaction_id && (t.status || 'pending') !== 'completed'), [monthTx]);
  const txInsights = useMemo(() => {
    const out = [];
    if (!customRange && prevExp > 0) {
      const delta = ((totals.exp - prevExp) / prevExp) * 100;
      if (Math.abs(delta) >= 1) out.push({ icon: delta < 0 ? TrendingDown : TrendingUp, color: delta < 0 ? '#10b981' : '#f43f5e', title: `Suas despesas ${delta < 0 ? 'caíram' : 'subiram'} ${Math.abs(delta).toFixed(1)}%`, text: 'Comparado ao mês anterior.' });
    }
    if (pendingRecurring.length) {
      const sum = pendingRecurring.reduce((s, t) => s + Number(t.amount), 0);
      out.push({ icon: Repeat, color: '#6366f1', title: `${pendingRecurring.length} recorrência(s) agendada(s)`, text: `Total de ${formatCurrency(sum)} neste mês.` });
    }
    if (filteredExpByCategory[0]) {
      const top = filteredExpByCategory[0];
      out.push({ icon: PiggyBank, color: top.color, title: `${top.name} é seu maior gasto`, text: `${formatCurrency(top.value)} (${filteredExpTotal > 0 ? Math.round((top.value / filteredExpTotal) * 100) : 0}% do total).` });
    }
    return out;
  }, [customRange, prevExp, totals.exp, pendingRecurring, filteredExpByCategory, filteredExpTotal]);

  // saldo acumulado do mês por dia (ordem cronológica), para a coluna-guia
  const cumByDay = useMemo(() => {
    const days = [...new Set(filtered.map((t) => t.date.slice(0, 10)))].sort();
    const map = {}; let run = 0;
    for (const d of days) {
      for (const t of filtered.filter((x) => x.date.slice(0, 10) === d)) run += t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0;
      map[d] = run;
    }
    return map;
  }, [filtered]);

  // ---- dados extras do layout novo (todos a partir de lançamentos reais) ----
  const [sortBy, setSortBy] = useState('recent');
  const prevTotals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of transactions) { if (!inMonth(t.date, prevMk)) continue; if (t.type === 'income') inc += Number(t.amount); if (t.type === 'expense') exp += Number(t.amount); }
    return { inc, exp, bal: inc - exp };
  }, [transactions, prevMk]);
  const deltaPct = (c, p) => (p !== 0 ? ((c - p) / Math.abs(p)) * 100 : null);
  const prevLabel = useMemo(() => { const [y, m] = prevMk.split('-').map(Number); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}/${y}`; }, [prevMk]);
  const savingsRate = totals.inc > 0 ? (Math.max(0, totals.bal) / totals.inc) * 100 : 0;

  // evolução do mês: barras semanais + saldo acumulado ao fim de cada semana
  const evolution = useMemo(() => { let run = 0; return weeklySeries.map((w) => { run += w.Receitas - w.Despesas; return { ...w, Saldo: Math.round(run * 100) / 100 }; }); }, [weeklySeries]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'oldest') arr.sort((a, b) => (a.date > b.date ? 1 : -1));
    else if (sortBy === 'high') arr.sort((a, b) => Number(b.amount) - Number(a.amount));
    else if (sortBy === 'low') arr.sort((a, b) => Number(a.amount) - Number(b.amount));
    return arr;
  }, [filtered, sortBy]);
  const groupedSorted = useMemo(() => {
    if (sortBy === 'high' || sortBy === 'low') return { __all: sorted };
    const g = {}; for (const t of sorted) { const d = t.date.slice(0, 10); (g[d] = g[d] || []).push(t); } return g;
  }, [sorted, sortBy]);

  // tendência por categoria (despesas do mês vs mês anterior)
  const catTrend = useMemo(() => {
    const cur = {}, prev = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const k = t.category_id || '__none';
      if (inMonth(t.date, mk)) cur[k] = (cur[k] || 0) + Number(t.amount);
      else if (inMonth(t.date, prevMk)) prev[k] = (prev[k] || 0) + Number(t.amount);
    }
    const rows = Object.entries(cur).map(([k, v], i) => ({ id: k, name: catMap[k]?.name || 'Sem categoria', color: catMap[k]?.color || colorAt(i), value: v, delta: deltaPct(v, prev[k] || 0) })).sort((a, b) => b.value - a.value).slice(0, 4);
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  }, [transactions, mk, prevMk, catMap]);

  const biggest = useMemo(() => monthTx.filter((t) => t.type === 'expense').sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null, [monthTx]);

  // fluxo previsto: lançamentos em aberto dos próximos 7 dias
  const forecast7 = useMemo(() => {
    const today = todayIso(); const end = new Date(today + 'T00:00'); end.setDate(end.getDate() + 7); const endIso = end.toISOString().slice(0, 10);
    const pend = transactions.filter((t) => t.type !== 'transfer' && (t.status || 'pending') !== 'completed' && String(t.date).slice(0, 10) >= today && String(t.date).slice(0, 10) <= endIso);
    const series = []; let run = 0;
    for (let i = 0; i <= 7; i++) { const d = new Date(today + 'T00:00'); d.setDate(d.getDate() + i); const k = d.toISOString().slice(0, 10); for (const t of pend) if (String(t.date).slice(0, 10) === k) run += t.type === 'income' ? Number(t.amount) : -Number(t.amount); series.push({ k, v: run }); }
    return { net: run, count: pend.length, series };
  }, [transactions]);

  // meta do mês: soma dos limites do Orçamento (categorias com limite) vs gasto nelas
  const budget = useMemo(() => {
    const cats = categories.filter((c) => c.type === 'expense' && Number(c.budget_limit) > 0);
    const limit = cats.reduce((s, c) => s + Number(c.budget_limit), 0);
    const ids = new Set(cats.map((c) => c.id));
    const spent = monthTx.filter((t) => t.type === 'expense' && ids.has(t.category_id)).reduce((s, t) => s + Number(t.amount), 0);
    return { limit, spent, pct: limit > 0 ? (spent / limit) * 100 : 0 };
  }, [categories, monthTx]);

  const grouped = useMemo(() => { const g = {}; for (const t of filtered) { const d = t.date.slice(0, 10); (g[d] = g[d] || []).push(t); } return g; }, [filtered]);
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };
  // abre direto no tipo pedido quando chega de um atalho (ex.: ações rápidas da tela Contas)
  useEffect(() => {
    const novo = searchParams.get('novo');
    if (novo === 'transfer' || novo === 'income' || novo === 'expense') {
      openNew(novo);
      const next = new URLSearchParams(searchParams); next.delete('novo'); setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dayNet = (items) => items.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0), 0);

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => { setSel(new Set()); setSelMode(false); };
  const bulkPay = async () => { const ids = [...sel]; for (const id of ids) { const t = transactions.find((x) => x.id === id); if (t && t.type !== 'transfer') await Transaction.update(id, { status: 'completed' }); } inval(); toast.success(`${ids.length} lançamento(s) marcados como concluídos.`); clearSel(); };
  const bulkDelete = async () => { const ids = [...sel]; for (const id of ids) await Transaction.remove(id); inval(); toast.success(`${ids.length} lançamento(s) excluídos.`); clearSel(); };
  const selValue = [...sel].reduce((s, id) => { const t = transactions.find((x) => x.id === id); return s + (t && t.type !== 'transfer' ? Number(t.amount) : 0); }, 0);

  const doExportXlsx = () => exportTransactionsXlsx(filtered, { accMap, catMap, periodLabel: customRange ? `${rangeFrom} a ${rangeTo}` : monthLabel(mk), filename: `monvy-lancamentos-${customRange ? `${rangeFrom}_${rangeTo}` : mk}.xlsx` });
  const doExportPdf = () => exportReportToPdf(pageRef.current, { filename: `monvy-lancamentos-${customRange ? `${rangeFrom}_${rangeTo}` : mk}.pdf`, title: 'Lançamentos', subtitle: customRange ? `Período de ${rangeFrom} a ${rangeTo}` : monthLabel(mk) });

  return (
    <div className="animate-fadeIn pb-24" ref={pageRef}>
      <div className="print:hidden">
        <PageHeader title="Lançamentos" subtitle="Receitas, despesas e transferências da sua vida financeira."
          actions={<>
            <Button variant="outline" onClick={() => setRecurOpen(true)}><Repeat className="w-4 h-4 text-indigo-500" /> Recorrências</Button>
            <div className="relative group">
              <Button variant="outline"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Exportar</Button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block group-focus-within:block z-20 min-w-[11rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
                <button onClick={doExportXlsx} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel (.xlsx)</button>
                <button onClick={doExportPdf} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileText className="w-4 h-4 text-rose-500" /> PDF</button>
              </div>
            </div>
            <Button variant="outline" onClick={() => setAdvOpen((v) => !v)} className={advActive ? 'text-indigo-600 border-indigo-500' : ''}><SlidersHorizontal className="w-4 h-4" /> Filtros</Button>
            <Button variant="outline" onClick={() => { setSelMode((v) => !v); setSel(new Set()); }} className={selMode ? 'text-emerald-600 border-emerald-500' : ''}><CheckSquare className="w-4 h-4" /> {selMode ? 'Cancelar' : 'Selecionar'}</Button>
            <Button variant="outline" onClick={() => openNew('transfer')}><ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Transferir</Button>
            <Button variant="outline" onClick={() => openNew('income')}><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Receita</Button>
            <Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Despesa</Button>
          </>} />
      </div>

      {/* Navegação por abas */}
      <div role="tablist" className="flex gap-2 overflow-x-auto border-b border-[hsl(var(--border))] mb-5 print:hidden">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`relative shrink-0 px-4 py-2.5 text-sm transition ${tab === v ? 'font-semibold text-[hsl(var(--text))]' : 'font-medium text-muted hover:text-[hsl(var(--text))]'}`}>
            {l}{tab === v && <span className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" />}
          </button>
        ))}
      </div>

      {(tab === 'overview' || tab === 'list') && <>
      {/* ===== Hero: KPIs do mês + evolução ===== */}
      <div className="relative overflow-hidden rounded-3xl text-white shadow-soft ring-1 ring-teal-400/30 mb-5 print:text-slate-900 print:bg-none print:ring-0" style={{ background: 'linear-gradient(135deg,#071a2b 0%,#0a1630 50%,#0d1433 100%)' }}>
        <div className="absolute -top-24 left-1/3 w-[30rem] h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(45,212,191,.16), transparent 70%)' }} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />
        <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] ring-1 ring-white/15 px-1.5 py-1">
                <CalendarDays className="w-4 h-4 text-teal-300 ml-1" />
                <button onClick={() => shiftMonth(-1)} className="p-1 rounded-lg hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
                <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer capitalize [&>option]:text-slate-800">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
                <button onClick={() => shiftMonth(1)} className="p-1 rounded-lg hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
              </div>
              {totals.pend > 0 && <button onClick={() => setStatusFilter('pending')} className="text-xs flex items-center gap-1 bg-amber-500/15 text-amber-200 px-3 py-1.5 rounded-full ring-1 ring-amber-500/25 hover:bg-amber-500/25"><Clock className="w-3.5 h-3.5" /> {formatCurrency(totals.pend)} em aberto</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <HeroKpi tone="emerald" icon={ArrowUpRight} label="Entradas" value={totals.inc} delta={deltaPct(totals.inc, prevTotals.inc)} good="up" vs={prevLabel} active={typeFilter === 'income'} onClick={() => setTypeFilter(typeFilter === 'income' ? 'all' : 'income')} />
              <HeroKpi tone="rose" icon={ArrowDownRight} label="Saídas" value={totals.exp} delta={deltaPct(totals.exp, prevTotals.exp)} good="down" vs={prevLabel} active={typeFilter === 'expense'} onClick={() => setTypeFilter(typeFilter === 'expense' ? 'all' : 'expense')} />
              <HeroKpi tone="sky" icon={BarChart3} label="Resultado" value={totals.bal} delta={deltaPct(totals.bal, prevTotals.bal)} good="up" vs={prevLabel} />
              <HeroKpi tone="violet" icon={PiggyBank} label="Economia" value={Math.max(0, totals.bal)} note={`${savingsRate.toFixed(1).replace('.', ',')}% das receitas`} />
            </div>
          </div>

          <div className="min-w-0 flex flex-col xl:pl-6 xl:border-l border-white/10">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <p className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-300" /> Evolução do mês</p>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Receitas <b className="text-white">{formatCurrency(totals.inc)}</b></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-400" /> Despesas <b className="text-white">{formatCurrency(totals.exp)}</b></span>
              </div>
            </div>
            <div className="flex-1 min-h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolution} barGap={4} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="txEvo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient>
                    <linearGradient id="txInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#0d9488" /></linearGradient>
                    <linearGradient id="txExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" /><stop offset="100%" stopColor="#db2777" /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.07)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis width={62} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v)}`} />
                  <Tooltip formatter={(v, n) => [formatCurrency(v), n === 'Saldo' ? 'Saldo acumulado' : n]} contentStyle={{ borderRadius: 10, border: 'none', background: '#0b1330', color: '#fff', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                  <Bar dataKey="Receitas" fill="url(#txInc)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="Despesas" fill="url(#txExp)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  <Area type="monotone" dataKey="Saldo" stroke="#2dd4bf" strokeWidth={3} fill="url(#txEvo)" dot={false} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de filtros avançados */}
      {advOpen && (
        <Card className="mb-4 p-4 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Filtros avançados</p>
            {advActive && <button onClick={() => { setAccountFilter('all'); setAmountMin(''); setAmountMax(''); setCustomRange(false); setRangeFrom(''); setRangeTo(''); }} className="text-xs text-muted hover:text-rose-500">limpar</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Conta</label>
              <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="all">Todas as contas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div><label className="text-xs text-muted block mb-1">Valor mínimo</label><Input type="number" step="0.01" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="R$ 0,00" /></div>
            <div><label className="text-xs text-muted block mb-1">Valor máximo</label><Input type="number" step="0.01" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Sem limite" /></div>
            <div>
              <label className="text-xs text-muted flex items-center gap-1.5 mb-1"><CalendarRange className="w-3.5 h-3.5" /> Período personalizado</label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer mb-1"><input type="checkbox" checked={customRange} onChange={(e) => setCustomRange(e.target.checked)} /> usar intervalo de datas</label>
              {customRange && (<div className="flex gap-1.5"><Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /><Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>)}
            </div>
          </div>
        </Card>
      )}
      </>}

      {(tab === 'overview' || tab === 'list') && (
      <div className={tab === 'overview' ? 'grid xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] gap-5' : ''}>
      <div className="min-w-0">
        {/* Busca + tipo */}
        <div className="flex flex-col lg:flex-row gap-3 mb-3 print:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição, categoria, estabelecimento ou valor" className="pl-10 !py-2.5 !rounded-xl" />
          </div>
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))] shrink-0 overflow-x-auto">
            {TYPE_FILTERS.map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${typeFilter === v ? 'bg-teal-400/20 text-teal-700 dark:text-teal-200 ring-1 ring-teal-400/50' : 'text-muted hover:text-[hsl(var(--text))]'}`}>{l}</button>)}
          </div>
        </div>
        {/* filtros inteligentes + status + ordenação */}
        <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
          {SMART.map(([id, label]) => {
            const active = smart === id;
            const Ic = { fixed: Pin, recurring: RefreshCw, nocat: Wand2, receipt: Paperclip }[id];
            return <button key={id} onClick={() => setSmart(active ? null : id)} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition ${active ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}><Ic className="w-3.5 h-3.5" />{label}</button>;
          })}
          <div className="inline-flex p-0.5 rounded-xl border border-[hsl(var(--border))]">
            {STATUS_FILTERS.map(([v, l]) => <button key={v} onClick={() => setStatusFilter(v)} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusFilter === v ? 'bg-black/10 dark:bg-white/10 text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
          </div>
          {(smart || typeFilter !== 'all' || statusFilter !== 'all' || search) && <button onClick={() => { setSmart(null); setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }} className="text-xs text-muted hover:text-rose-500 px-1">limpar</button>}
          <label className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(var(--border))] text-xs text-muted">
            <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar por:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-semibold text-[hsl(var(--text))] outline-none cursor-pointer [&>option]:text-slate-800">
              <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="high">Maior valor</option><option value="low">Menor valor</option>
            </select>
          </label>
        </div>

        {tab === 'overview' && (isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
          : sorted.length === 0 ? <Card><EmptyState icon={ArrowLeftRight} title="Nenhum lançamento" subtitle="Adicione uma receita ou despesa neste mês, ou ajuste os filtros." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Novo lançamento</Button>} /></Card>
          : (
            <div className="relative pl-6">
              <span className="absolute left-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-sky-400/60 via-[hsl(var(--border))] to-transparent" aria-hidden />
              <div className="space-y-5">
                {Object.entries(groupedSorted).map(([date, items], gi) => {
                  const net = dayNet(items);
                  const isAll = date === '__all';
                  const label = isAll ? (sortBy === 'high' ? 'Ordenado por maior valor' : 'Ordenado por menor valor') : (() => { const s = new Date(date + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.replace(/^./, (c) => c.toUpperCase()).replace(/ de ([a-zç]+) de /, (m, mo) => ` de ${mo[0].toUpperCase()}${mo.slice(1)} de `); })();
                  return (
                    <Reveal key={date} i={Math.min(gi, 6)}>
                      <div className="relative">
                        <span className="absolute -left-6 top-1 w-[19px] h-[19px] rounded-full bg-[hsl(var(--bg))] border-2 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,.5)]" aria-hidden />
                        <div className="mb-2">
                          <p className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-sky-400" /> {label}</p>
                          <p className="text-xs text-muted mt-0.5" title={!isAll && cumByDay[date] != null ? `Saldo acumulado no mês: ${formatCurrency(cumByDay[date])}` : undefined}>{items.length} lançamento{items.length === 1 ? '' : 's'} • Total{isAll ? '' : ' do dia'}: <b className={net < 0 ? 'text-rose-500' : 'text-emerald-500'}>{net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}</b></p>
                        </div>
                        <Card className="!p-0 divide-y divide-[hsl(var(--border))] overflow-visible !rounded-xl">
                          {items.map((t) => {
                            const cat = catMap[t.category_id];
                            const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
                            const pend = !isTransfer && (t.status || 'pending') !== 'completed';
                            const checked = sel.has(t.id);
                            const color = isTransfer ? '#6366f1' : (cat?.color || (isInc ? '#10b981' : '#f43f5e'));
                            const sub = isTransfer ? `${accMap[t.account_id]?.name || ''} → ${accMap[t.account_to_id]?.name || ''}` : [cat?.name || 'Sem categoria', accMap[t.account_id]?.name].filter(Boolean).join(' • ');
                            return (
                              <div key={t.id} onClick={selMode ? () => toggleSel(t.id) : undefined}
                                className={`group flex items-center gap-3 px-4 py-2.5 transition ${selMode ? 'cursor-pointer' : ''} ${checked ? 'bg-indigo-500/10' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'}`}>
                                {selMode && <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-[hsl(var(--border))]'}`}>{checked && <CircleCheck className="w-3.5 h-3.5" />}</span>}
                                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1" style={{ background: `${color}26`, color, '--tw-ring-color': `${color}40` }}>
                                  {isTransfer ? <ArrowLeftRight className="w-5 h-5" /> : isInc ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate">{t.description || cat?.name || (isTransfer ? 'Transferência' : 'Lançamento')}</p>
                                  <p className="text-xs text-muted truncate">{isAll ? `${new Date(t.date.slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')} • ` : ''}{sub}</p>
                                </div>
                                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                                  {t.is_fixed && <Pill c="sky">Fixo</Pill>}
                                  {(t.parent_transaction_id || (t.recurrence && t.recurrence !== 'none')) && <Pill c="amber">Recorrente</Pill>}
                                  {!isTransfer && (pend ? <Pill c="orange">{isInc ? 'A receber' : 'A pagar'}</Pill> : <Pill c={isInc ? 'emerald' : 'blue'}>{isInc ? 'Recebido' : 'Pago'}</Pill>)}
                                  {t.receipt_url && <button onClick={(e) => { e.stopPropagation(); setViewReceipt(t.receipt_url); }} title="Ver comprovante" className="p-1 rounded-md text-sky-500 hover:bg-sky-500/10"><Paperclip className="w-3.5 h-3.5" /></button>}
                                </div>
                                <p className={`font-bold text-sm shrink-0 w-28 text-right ${isInc ? 'text-emerald-500' : isTransfer ? 'text-indigo-400' : 'text-rose-500'} ${pend ? 'opacity-70' : ''}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</p>
                                {!selMode && (
                                  <RowMenu items={[
                                    pend && { icon: CircleCheck, label: isInc ? 'Marcar recebido' : 'Marcar pago', onClick: () => markStatus.mutate({ id: t.id, status: 'completed' }) },
                                    { icon: Pencil, label: 'Editar', onClick: () => { setEditing(t); setModal(true); } },
                                    { icon: Copy, label: 'Duplicar para hoje', onClick: () => dup.mutate(t) },
                                    { icon: Trash2, label: 'Excluir', danger: true, onClick: () => setToDelete(t) },
                                  ].filter(Boolean)} />
                                )}
                              </div>
                            );
                          })}
                        </Card>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          ))}

        {tab === 'list' && (
          sorted.length === 0 ? <Card><EmptyState icon={ArrowLeftRight} title="Nenhum lançamento" subtitle="Ajuste os filtros ou o período selecionado." /></Card> : (
            <Card className="!p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]"><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Descrição</th><th className="px-3 py-2 font-medium">Categoria</th><th className="px-3 py-2 font-medium">Conta</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium text-right">Valor</th></tr></thead>
                <tbody>
                  {sorted.map((t) => {
                    const cat = catMap[t.category_id]; const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
                    const pend = !isTransfer && (t.status || 'pending') !== 'completed';
                    return (
                      <tr key={t.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer" onClick={() => { setEditing(t); setModal(true); }}>
                        <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-2 truncate max-w-[220px]">{t.description || cat?.name || (isTransfer ? 'Transferência' : 'Lançamento')}</td>
                        <td className="px-3 py-2 text-muted truncate">{isTransfer ? 'Transferência' : (cat?.name || 'Sem categoria')}</td>
                        <td className="px-3 py-2 text-muted truncate">{accMap[t.account_id]?.name || ''}</td>
                        <td className="px-3 py-2">{isTransfer ? <span className="text-muted">—</span> : <Badge color={pend ? 'amber' : 'emerald'}>{pend ? (isInc ? 'A receber' : 'A pagar') : (isInc ? 'Recebido' : 'Pago')}</Badge>}</td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${isInc ? 'text-emerald-500' : isTransfer ? 'text-indigo-500' : 'text-rose-500'}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )
        )}
      </div>

      {/* ===== Painel lateral ===== */}
      {tab === 'overview' && (
      <div className="space-y-4 print:hidden">
        <Card className="!rounded-2xl ring-1 ring-sky-400/20">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-sky-400" /> Tendência por categoria</h3>
              <p className="text-xs text-muted mt-0.5">Variação de despesas vs. {prevLabel}</p>
            </div>
            <button onClick={() => navigate('/relatorios')} className="text-xs font-semibold text-sky-500 hover:underline flex items-center gap-1 shrink-0">Ver relatório <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          {catTrend.length === 0 ? <p className="text-sm text-muted py-3">Sem despesas neste mês.</p> : (
            <div className="space-y-2.5">
              {catTrend.map((c) => (
                <div key={c.id} className="grid grid-cols-[1.75rem_minmax(0,8rem)_minmax(40px,1fr)_auto_3.4rem] items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}26`, color: c.color }}><Tag className="w-3.5 h-3.5" /></span>
                  <span className="truncate">{c.name}</span>
                  <span className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} /></span>
                  <span className="text-xs font-medium whitespace-nowrap">{formatCurrency(c.value)}</span>
                  <span className={`text-xs font-semibold text-right ${c.delta == null ? 'text-muted' : c.delta > 0.5 ? 'text-rose-500' : c.delta < -0.5 ? 'text-emerald-500' : 'text-muted'}`}>{c.delta == null ? 'novo' : `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1).replace('.', ',')}%`}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {biggest && (
          <button onClick={() => { setEditing(biggest); setModal(true); }} className="w-full text-left relative overflow-hidden rounded-2xl p-4 text-white ring-1 ring-pink-400/30 hover-lift" style={{ background: 'linear-gradient(120deg,#3b0d2a,#5b1240 55%,#2a0b2e)' }}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(244,114,182,.35), transparent 70%)' }} />
            <p className="relative font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" /> Maior gasto do mês</p>
            <div className="relative flex items-center gap-3 mt-3">
              <span className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center shrink-0"><ArrowDownRight className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold truncate">{biggest.description || catMap[biggest.category_id]?.name || 'Despesa'}</p><p className="text-xs text-pink-100/70 truncate">{catMap[biggest.category_id]?.name || 'Sem categoria'}</p></div>
              <p className="font-display text-xl font-bold text-pink-300 whitespace-nowrap">{formatCurrency(biggest.amount)}</p>
            </div>
          </button>
        )}

        <Card className="!rounded-2xl ring-1 ring-violet-400/20">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0"><CalendarClock className="w-5 h-5" /></span>
            <div className="min-w-0"><p className="font-semibold">Fluxo previsto</p><p className="text-xs text-muted">Próximos 7 dias · {forecast7.count} em aberto</p></div>
            <div className="flex-1 h-10 min-w-[60px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast7.series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="fc7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c084fc" stopOpacity={0.4} /><stop offset="100%" stopColor="#c084fc" stopOpacity={0} /></linearGradient></defs>
                  <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                  <Area type="monotone" dataKey="v" stroke="#c084fc" strokeWidth={2} fill="url(#fc7)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className={`font-display text-lg font-bold whitespace-nowrap ${forecast7.net < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{forecast7.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(forecast7.net))}</p>
          </div>
        </Card>

        <Card className="!rounded-2xl ring-1 ring-emerald-400/20">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"><Target className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Meta do mês</p>
              <p className="text-xs text-muted">{budget.limit > 0 ? `Manter despesas abaixo de ${formatCurrency(budget.limit)}` : 'Defina limites no Orçamento para acompanhar aqui.'}</p>
            </div>
            {budget.limit > 0 ? <p className={`font-display text-xl font-bold ${budget.pct >= 100 ? 'text-rose-500' : budget.pct >= 80 ? 'text-amber-500' : ''}`}>{budget.pct.toFixed(1).replace('.', ',')}%</p>
              : <Button size="sm" variant="outline" onClick={() => navigate('/orcamento')}>Definir</Button>}
          </div>
          {budget.limit > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, budget.pct)}%`, background: budget.pct >= 100 ? '#f43f5e' : budget.pct >= 80 ? '#f59e0b' : 'linear-gradient(90deg,#10b981,#2dd4bf)' }} /></div>
              <span className="text-xs text-muted whitespace-nowrap">{formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}</span>
            </div>
          )}
        </Card>
      </div>
      )}
      </div>
      )}

      {tab === 'recurring' && (
        <Card>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><Repeat className="w-4 h-4 text-indigo-500" /> Recorrências ativas</h3>
            <Button variant="outline" onClick={() => setRecurOpen(true)}>Gerenciar recorrências</Button>
          </div>
          {(() => {
            const parents = transactions.filter((t) => t.is_fixed && t.recurrence === 'monthly' && !t.parent_transaction_id);
            if (!parents.length) return <EmptyState icon={Repeat} title="Nenhuma recorrência" subtitle="Marque 'Lançamento fixo' com recorrência mensal ao criar um lançamento pra ele aparecer aqui." />;
            return (
              <div className="space-y-2">
                {parents.map((p) => {
                  const isInc = p.type === 'income'; const isTr = p.type === 'transfer';
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3">
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: isTr ? '#6366f1' : (catMap[p.category_id]?.color || (isInc ? '#10b981' : '#f43f5e')) }}>{isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
                      <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{p.description || catMap[p.category_id]?.name || 'Lançamento'}</p><p className="text-[11px] text-muted truncate">{accMap[p.account_id]?.name || ''} · mensal</p></div>
                      <p className={`font-semibold text-sm shrink-0 ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(p.amount)}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      {tab === 'rules' && (
        <Card className="text-center py-10">
          <Wand2 className="w-10 h-10 mx-auto text-indigo-500 opacity-70 mb-3" />
          <h3 className="font-semibold text-lg">Regras automáticas de categorização</h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">Crie regras pra categorizar lançamentos novos automaticamente com base na descrição, valor ou conta.</p>
          <Button className="mt-4" onClick={() => navigate('/regras')}>Abrir Regras de Categoria</Button>
        </Card>
      )}

      {/* Barra de ações em lote */}
      {selMode && sel.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl print:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl animate-[popIn_.2s_ease]">
            <span className="text-sm font-semibold px-1">{sel.size} selecionado(s)</span>
            <span className="text-xs text-muted hidden sm:inline">· {formatCurrency(selValue)}</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={bulkPay}><CircleCheck className="w-4 h-4 text-emerald-500" /> Marcar pago</Button>
            <Button size="sm" variant="outline" className="text-rose-500" onClick={bulkDelete}><Trash2 className="w-4 h-4" /> Excluir</Button>
            <button onClick={clearSel} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {recurOpen && (
        <RecurrencesPanel
          transactions={transactions}
          accMap={accMap}
          catMap={catMap}
          onClose={() => setRecurOpen(false)}
          onEdit={(p) => { setRecurOpen(false); setEditing(p); setModal(true); }}
        />
      )}

      <TransactionModal open={modal} onClose={() => { setModal(false); setEditing(null); }} onSubmit={(p) => save.mutate(p)} saving={save.isPending} accounts={accounts} categories={categories} transactions={transactions} initial={editing} defaultType={defaultType} />

      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Comprovante" maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => window.open(viewReceipt, '_blank')}>Abrir em nova aba</Button><Button onClick={() => setViewReceipt(null)}>Fechar</Button></>}>
        {viewReceipt && (viewReceipt.startsWith('data:application/pdf') || viewReceipt.includes('.pdf')
          ? <iframe title="comprovante" src={viewReceipt} className="w-full h-[60vh] rounded-lg border border-[hsl(var(--border))]" />
          : <img src={viewReceipt} alt="Comprovante" className="w-full rounded-lg" />)}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir lançamento" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>{del.isPending ? <Spinner className="w-4 h-4" /> : 'Excluir'}</Button></>}>
        <p className="text-sm text-muted">Tem certeza? O saldo da conta será recalculado automaticamente.</p>
      </Modal>
    </div>
  );
}

const KPI_TONES = {
  emerald: { ring: 'ring-emerald-400/30', bg: 'linear-gradient(135deg,rgba(16,185,129,.16),rgba(16,185,129,.04))', icon: 'bg-emerald-500/20 text-emerald-300' },
  rose: { ring: 'ring-rose-400/30', bg: 'linear-gradient(135deg,rgba(244,63,94,.18),rgba(244,63,94,.04))', icon: 'bg-rose-500/20 text-rose-300' },
  sky: { ring: 'ring-sky-400/30', bg: 'linear-gradient(135deg,rgba(14,165,233,.18),rgba(14,165,233,.04))', icon: 'bg-sky-500/20 text-sky-300' },
  violet: { ring: 'ring-violet-400/40', bg: 'linear-gradient(135deg,rgba(139,92,246,.28),rgba(139,92,246,.06))', icon: 'bg-violet-500/25 text-violet-200' },
};

function HeroKpi({ tone, icon: Icon, label, value, delta, good, vs, note, onClick, active }) {
  const T = KPI_TONES[tone];
  const show = delta != null && isFinite(delta);
  const up = (delta || 0) >= 0; const positive = good === 'down' ? !up : up;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left rounded-2xl p-3.5 ring-1 ${T.ring} ${active ? 'ring-2 ring-white/60' : ''} flex items-start gap-3 transition ${onClick ? 'hover:brightness-125' : ''}`} style={{ background: T.bg }}>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${T.icon}`}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        <p className="font-display text-xl 2xl:text-2xl font-bold leading-tight whitespace-nowrap"><AnimatedValue value={value} format={formatCurrency} /></p>
        {note ? <p className="text-xs text-slate-300 mt-1">{note}</p>
          : show ? <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap"><span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold ${positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{up ? '↑' : '↓'} {up ? '+' : ''}{delta.toFixed(1).replace('.', ',')}%</span> vs. {vs}</p>
          : <p className="text-xs text-slate-400 mt-1">sem base em {vs}</p>}
      </div>
    </Tag>
  );
}

const PILL = {
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 ring-orange-500/30',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 ring-blue-500/30',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30',
};
function Pill({ c, children }) { return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 whitespace-nowrap ${PILL[c]}`}>{children}</span>; }

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-label="Ações do lançamento" aria-haspopup="menu" aria-expanded={open} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><MoreVertical className="w-4 h-4" /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
          {items.map((it) => (
            <button key={it.label} role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-black/5 dark:hover:bg-white/5 ${it.danger ? 'text-rose-500' : ''}`}><it.icon className="w-4 h-4" /> {it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
