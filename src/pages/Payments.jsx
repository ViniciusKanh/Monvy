import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Account, Category } from '../api/entities.js';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { Button, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Panel, Donut, DeltaChip, Segmented, pct1, TIP } from '../components/kit.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, monthKey, monthLabel, inMonth, todayIso } from '../lib/utils.js';
import { useHolidayMap } from '../lib/holidays.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, ArrowUpRight, ArrowDownRight, CircleCheck, Undo2, Pencil, Paperclip, AlertTriangle, CalendarClock,
  ArrowLeftRight, Repeat, Upload, Wallet, HandCoins, Layers, CalendarDays, Maximize2, BarChart3, ArrowRight, DollarSign, TrendingUp, FileText, CreditCard, X,
} from 'lucide-react';

const addMonthIso = (iso, n) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const base = new Date(y, m - 1 + n, 1); const day = Math.min(d, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()); return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MES_L = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const BUCKETS = [
  { id: 'overdue', label: 'Vencidas', tone: '#f43f5e', test: (d, today) => d < today },
  { id: 'today', label: 'Vencem hoje', tone: '#f59e0b', test: (d, today) => d === today },
  { id: 'week', label: 'Próximos 7 dias', tone: '#6366f1', test: (d, today, week) => d > today && d <= week },
  { id: 'later', label: 'Mais para frente', tone: '#0ea5e9', test: (d, today, week) => d > week },
];

function useOutside(open, close) {
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open, close]);
  return ref;
}

export default function Payments() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mk, setMk] = useState(monthKey(new Date()));
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultType, setDefaultType] = useState('expense');
  const [viewReceipt, setViewReceipt] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set(['done']));
  const [range, setRange] = useState('6m');
  const [chartBig, setChartBig] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [agenda, setAgenda] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [newMenu, setNewMenu] = useState(false);
  const [impMenu, setImpMenu] = useState(false);
  const newRef = useOutside(newMenu, () => setNewMenu(false));
  const impRef = useOutside(impMenu, () => setImpMenu(false));
  const agendaRef = useRef(null);

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const holidayMap = useHolidayMap(Number(mk.slice(0, 4)));

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: inval });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { inval(); setModal(false); setEditing(null); } });
  const repeat = useMutation({
    mutationFn: (t) => Transaction.create({ type: t.type, date: addMonthIso(t.date, 1), amount: Number(t.amount), description: t.description, account_id: t.account_id, category_id: t.category_id || null, is_fixed: !!t.is_fixed, recurrence: t.recurrence || 'none', status: 'pending' }),
    onSuccess: () => { inval(); toast.success('Repetido no mês seguinte, em aberto.'); },
  });

  const today = todayIso();
  const weekIso = (() => { const d = new Date(today + 'T00:00'); d.setDate(d.getDate() + 7); return isoOf(d); })();
  const prevMk = useMemo(() => { const [y, m] = mk.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); }, [mk]);
  const isDone = (t) => (t.status || 'pending') === 'completed';

  const allMonth = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && inMonth(t.date, mk)), [transactions, mk]);
  const monthItems = useMemo(() => allMonth.filter((t) => typeFilter === 'all' || t.type === typeFilter), [allMonth, typeFilter]);

  const calcTotals = (items) => {
    let toPay = 0, toReceive = 0, paid = 0, received = 0, overdue = 0, nPay = 0, nRec = 0;
    for (const t of items) {
      const done = isDone(t);
      if (t.type === 'expense') { nPay++; if (done) paid += +t.amount; else { toPay += +t.amount; if (String(t.date).slice(0, 10) < today) overdue += +t.amount; } }
      if (t.type === 'income') { nRec++; if (done) received += +t.amount; else toReceive += +t.amount; }
    }
    return { toPay, toReceive, paid, received, overdue, nPay, nRec, inc: received + toReceive, exp: paid + toPay, forecast: (received + toReceive) - (paid + toPay) };
  };
  const totals = useMemo(() => calcTotals(allMonth), [allMonth, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevTotals = useMemo(() => calcTotals(transactions.filter((t) => t.type !== 'transfer' && inMonth(t.date, prevMk))), [transactions, prevMk, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const forecastDelta = prevTotals.forecast !== 0 ? ((totals.forecast - prevTotals.forecast) / Math.abs(prevTotals.forecast)) * 100 : null;

  const pendingPay = useMemo(() => allMonth.filter((t) => t.type === 'expense' && !isDone(t)).sort((a, b) => (a.date < b.date ? -1 : 1)), [allMonth]);
  const pendingRec = useMemo(() => allMonth.filter((t) => t.type === 'income' && !isDone(t)).sort((a, b) => (a.date < b.date ? -1 : 1)), [allMonth]);
  const nextDue = pendingPay.find((t) => String(t.date).slice(0, 10) >= today) || pendingPay[0];
  const lastReceived = useMemo(() => allMonth.filter((t) => t.type === 'income' && isDone(t)).sort((a, b) => (a.date < b.date ? 1 : -1))[0], [allMonth]);

  // próximos vencimentos (de hoje em diante, ou do dia selecionado no calendário)
  const upcoming = useMemo(() => {
    const base = transactions.filter((t) => t.type !== 'transfer' && !isDone(t));
    if (selDay) return base.filter((t) => String(t.date).slice(0, 10) === selDay).sort((a, b) => Number(b.amount) - Number(a.amount));
    return base.filter((t) => String(t.date).slice(0, 10) >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5);
  }, [transactions, selDay, today]);

  // calendário
  const cal = useMemo(() => {
    const [y, m] = mk.split('-').map(Number);
    const first = new Date(y, m - 1, 1); const start = new Date(first); start.setDate(1 - first.getDay());
    const marks = {};
    for (const t of transactions) { if (t.type === 'transfer') continue; const k = String(t.date).slice(0, 10); (marks[k] = marks[k] || { inc: 0, exp: 0, open: 0 }); if (t.type === 'income') marks[k].inc++; else marks[k].exp++; if (!isDone(t)) marks[k].open++; }
    const cells = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push({ iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 }); }
    const rows = cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
    return { rows, marks };
  }, [mk, transactions]);

  // fluxo de caixa mensal
  const flow = useMemo(() => {
    const [y, m] = mk.split('-').map(Number);
    const n = range === '12m' ? 12 : range === 'ytd' ? m : 6;
    const arr = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); const k = monthKey(d); let inc = 0, exp = 0; for (const t of transactions) { if (t.type === 'transfer' || !inMonth(t.date, k)) continue; if (t.type === 'income') inc += +t.amount; else exp += +t.amount; } arr.push({ name: MES[d.getMonth()], Receitas: Math.round(inc * 100) / 100, Despesas: Math.round(exp * 100) / 100 }); }
    return arr;
  }, [transactions, mk, range]);

  const pending = useMemo(() => monthItems.filter((t) => !isDone(t)), [monthItems]);
  const done = useMemo(() => monthItems.filter(isDone).sort((a, b) => (a.date < b.date ? 1 : -1)), [monthItems]);
  const buckets = useMemo(() => BUCKETS.map((b) => ({ ...b, items: pending.filter((t) => b.test(String(t.date).slice(0, 10), today, weekIso)).sort((a, b2) => (a.date < b2.date ? -1 : 1)) })).filter((b) => b.items.length), [pending, today, weekIso]);

  const shift = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); setSelDay(null); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); setNewMenu(false); };
  const toggleCol = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkBaixa = async (items) => { for (const t of items) await Transaction.update(t.id, { status: 'completed' }); inval(); setSel(new Set()); toast.success(`${items.length} conta(s) baixada(s).`); };
  const overdueItems = pending.filter((t) => String(t.date).slice(0, 10) < today);
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selItems = [...sel].map((id) => transactions.find((t) => t.id === id)).filter(Boolean);
  const showAgenda = (type) => { setTypeFilter(type); setAgenda(true); setTimeout(() => agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
  const sumOf = (items) => items.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  const prevLabel = `${MES_L[Number(prevMk.slice(5)) - 1]}/${prevMk.slice(0, 4)}`;

  const Item = ({ t }) => {
    const cat = catMap[t.category_id]; const isInc = t.type === 'income';
    const done2 = isDone(t);
    const overdue = !done2 && String(t.date).slice(0, 10) < today;
    const hn = holidayMap.get(String(t.date).slice(0, 10));
    return (
      <div className={`group flex items-center gap-3 px-4 py-3 ${overdue ? 'bg-rose-500/[0.06]' : ''}`}>
        <button onClick={() => setStatus.mutate({ id: t.id, status: done2 ? 'pending' : 'completed' })} title={done2 ? 'Reabrir' : 'Dar baixa'}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${done2 ? 'bg-emerald-500 text-white' : 'border-2 border-dashed border-[hsl(var(--border))] text-muted hover:border-emerald-500 hover:text-emerald-500'}`}>
          {done2 ? <CircleCheck className="w-4 h-4" /> : (isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />)}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-medium truncate ${done2 ? 'line-through opacity-60' : ''}`}>{t.description || cat?.name || 'Lançamento'}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
            <span>{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>· {cat?.name || 'Sem categoria'}</span>
            {t.is_fixed && <Badge color="blue">Fixo</Badge>}
            {overdue && <Badge color="rose"><AlertTriangle className="w-3 h-3" /> vencida</Badge>}
            {hn && !done2 && <span title={`Feriado: ${hn} — a compensação bancária pode ser afetada`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300"><CalendarClock className="w-3 h-3" /> feriado</span>}
            {t.receipt_url && <button onClick={() => setViewReceipt(t.receipt_url)} className="inline-flex items-center gap-0.5 text-sky-500 font-medium hover:underline"><Paperclip className="w-3 h-3" /> comprovante</button>}
          </div>
        </div>
        <p className={`font-semibold font-display shrink-0 ${isInc ? 'text-emerald-500' : 'text-rose-500'} ${done2 ? 'opacity-60' : ''}`}>{isInc ? '+' : '-'}{formatCurrency(t.amount)}</p>
        <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition">
          <button title="Repetir no mês seguinte" onClick={() => repeat.mutate(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Repeat className="w-4 h-4" /></button>
          {done2 ? <button title="Reabrir" onClick={() => setStatus.mutate({ id: t.id, status: 'pending' })} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Undo2 className="w-4 h-4" /></button>
            : <button title="Dar baixa" onClick={() => setStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>}
          <button title="Editar" onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  const NextList = ({ items, kind }) => {
    const isInc = kind === 'income';
    if (!items.length) return <p className="text-sm text-muted py-6 text-center">{isInc ? 'Nada a receber em aberto neste mês.' : 'Nenhuma conta a pagar em aberto neste mês.'}</p>;
    return (
      <div className="divide-y divide-[hsl(var(--border))]">
        {items.slice(0, 4).map((t) => {
          const cat = catMap[t.category_id]; const Ic = categoryIcon(cat); const color = cat?.color || (isInc ? '#10b981' : '#f43f5e');
          const d = String(t.date).slice(0, 10); const overdue = d < today; const checked = sel.has(t.id);
          return (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" checked={checked} onChange={() => toggleSel(t.id)} aria-label={`Selecionar ${t.description || 'conta'}`} className="w-4 h-4 rounded accent-teal-500 shrink-0 dark:[color-scheme:dark]" />
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}26`, color }}><Ic className="w-[18px] h-[18px]" /></span>
              <button onClick={() => { setEditing(t); setModal(true); }} className="min-w-0 flex-1 text-left"><p className="text-sm font-semibold truncate">{t.description || cat?.name || 'Lançamento'}</p><p className="text-[11px] text-muted truncate">{[cat?.name || 'Sem categoria', accMap[t.account_id]?.name].filter(Boolean).join(' • ')}</p></button>
              {cat && <span className="hidden md:inline px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-300 max-w-[90px] truncate">{cat.name}</span>}
              <span className={`text-xs whitespace-nowrap flex items-center gap-1 ${overdue ? 'text-rose-500 font-semibold' : 'text-muted'}`}><CalendarDays className="w-3.5 h-3.5" />{ddmm(d)}</span>
              <span className={`text-sm font-bold whitespace-nowrap w-24 text-right ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>{isInc ? '' : '-'}{formatCurrency(t.amount)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const FlowChart = ({ height }) => (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={flow} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pfInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient>
            <linearGradient id="pfExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
          <YAxis width={46} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}K` : v)} />
          <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
          <Area type="monotone" dataKey="Receitas" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#pfInc)" dot={false} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="Despesas" stroke="#a855f7" strokeWidth={2.5} fill="url(#pfExp)" dot={false} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const move = totals.inc + totals.exp;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ArrowLeftRight className="w-11 h-11 text-violet-400 shrink-0 mt-1" strokeWidth={1.6} />
          <div><h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Pagar & Receber</h1><p className="text-sm text-muted mt-1">Sua agenda financeira do mês, organizada por urgência e fluxo de caixa.</p><div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-teal-400 to-violet-500" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-1 py-1">
            <button onClick={() => shift(-1)} aria-label="Mês anterior" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold px-2 capitalize min-w-[120px] text-center">{monthLabel(mk)}</span>
            <button onClick={() => shift(1)} aria-label="Próximo mês" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="relative" ref={newRef}>
            <button onClick={() => setNewMenu((v) => !v)} aria-haspopup="menu" aria-expanded={newMenu} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(56,189,248,.4)] hover:brightness-110"><Plus className="w-4 h-4" /> Nova conta <ChevronDown className="w-4 h-4 pl-1 border-l border-white/30 ml-1" /></button>
            {newMenu && <div role="menu" className="absolute right-0 mt-1 z-30 min-w-[12rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
              <button role="menuitem" onClick={() => openNew('expense')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><ArrowDownRight className="w-4 h-4 text-rose-500" /> Conta a pagar</button>
              <button role="menuitem" onClick={() => openNew('income')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Conta a receber</button>
              <button role="menuitem" onClick={() => openNew('transfer')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Transferência</button>
            </div>}
          </div>
          <button onClick={() => openNew('income')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"><TrendingUp className="w-4 h-4" /> A receber</button>
          <button onClick={() => openNew('expense')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-rose-400/50 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20"><ArrowDownRight className="w-4 h-4" /> A pagar</button>
          <div className="relative" ref={impRef}>
            <button onClick={() => setImpMenu((v) => !v)} aria-haspopup="menu" aria-expanded={impMenu} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-sky-400/40 hover:bg-sky-500/10"><Upload className="w-4 h-4" /> Importar <ChevronDown className="w-4 h-4" /></button>
            {impMenu && <div role="menu" className="absolute right-0 mt-1 z-30 min-w-[13rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
              <button role="menuitem" onClick={() => navigate('/importar')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileText className="w-4 h-4 text-sky-500" /> Extrato bancário</button>
              <button role="menuitem" onClick={() => navigate('/cartoes')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><CreditCard className="w-4 h-4 text-violet-500" /> Fatura do cartão</button>
              <button role="menuitem" onClick={() => navigate('/notas-fiscais')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileText className="w-4 h-4 text-emerald-500" /> Nota fiscal</button>
            </div>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Hero tone="rose" icon={Wallet} title={<>A Pagar <span className="text-xs text-muted">(em aberto)</span></>} chip={`${pendingPay.length} conta${pendingPay.length === 1 ? '' : 's'}`} value={totals.toPay}
          foot={nextDue ? <><CalendarDays className="w-4 h-4" /> Próximo vencimento: {ddmm(nextDue.date)} • <b className="text-rose-400">{formatCurrency(nextDue.amount)}</b></> : 'Nada em aberto'} />
        <Hero tone="emerald" icon={HandCoins} title={<>A Receber <span className="text-xs text-muted">(previsto)</span></>} chip={`${pendingRec.length} conta${pendingRec.length === 1 ? '' : 's'}`} value={totals.toReceive}
          foot={lastReceived ? <><CalendarDays className="w-4 h-4" /> Último recebimento: {ddmm(lastReceived.date)} • <b className="text-emerald-400">{formatCurrency(lastReceived.amount)}</b></> : 'Nenhum recebimento no mês'} />
        <Hero tone="violet" icon={Layers} title="Saldo Previsto do Mês" value={totals.forecast} valueClass={totals.forecast < 0 ? 'text-rose-400' : 'text-violet-300'}
          foot={forecastDelta != null && Math.abs(forecastDelta) <= 300 ? <><DeltaChip v={forecastDelta} /> vs. {prevLabel}</> : prevTotals.forecast !== 0 ? <><span className={totals.forecast - prevTotals.forecast >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>{totals.forecast - prevTotals.forecast >= 0 ? '+' : '−'}{formatCurrency(Math.abs(totals.forecast - prevTotals.forecast))}</span> vs. {prevLabel}</> : `sem base em ${prevLabel}`} />
        <Hero tone="sky" icon={CalendarDays} title="Contas do mês" raw={totals.nPay + totals.nRec}
          foot={<><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> {totals.nPay} a pagar <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2" /> {totals.nRec} a receber</>} />
      </div>

      {overdueItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-rose-400/40 bg-rose-500/[0.07]">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-sm flex-1"><b>{overdueItems.length}</b> conta(s) vencida(s) somando <b>{formatCurrency(overdueItems.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))}</b> a pagar.</p>
          <Button size="sm" onClick={() => bulkBaixa(overdueItems)}><CircleCheck className="w-4 h-4" /> Dar baixa nas vencidas</Button>
        </div>
      )}

      {/* Fluxo + calendário */}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel tone="sky" title="Fluxo de Caixa (Entradas vs. Saídas)" icon={BarChart3} iconClass="text-sky-400"
          action={<div className="flex items-center gap-2"><Segmented size="sm" value={range} onChange={setRange} options={[['6m', '6M'], ['12m', '12M'], ['ytd', 'YTD']]} /><button onClick={() => setChartBig(true)} aria-label="Ampliar gráfico" className="p-2 rounded-lg ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Maximize2 className="w-4 h-4" /></button></div>}>
          <FlowChart height={230} />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm mt-2">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-teal-400" /> Receitas <b>{formatCurrency(totals.inc)}</b></span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500" /> Despesas <b>{formatCurrency(totals.exp)}</b></span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full ring-2 ring-dashed ring-slate-400" /> Saldo <b className={totals.forecast < 0 ? 'text-rose-500' : ''}>{formatCurrency(totals.forecast)}</b></span>
          </div>
        </Panel>

        <Panel tone="violet" title="Calendário Financeiro" icon={CalendarDays} iconClass="text-fuchsia-400"
          action={<div className="flex items-center gap-1 rounded-xl ring-1 ring-[hsl(var(--border))] px-1 py-0.5"><button onClick={() => shift(-1)} aria-label="Mês anterior" className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button><span className="text-sm font-semibold capitalize px-1">{monthLabel(mk)}</span><button onClick={() => shift(1)} aria-label="Próximo mês" className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button></div>}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <div className="grid grid-cols-7 text-center text-xs text-muted mb-1">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <span key={d}>{d}</span>)}</div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {cal.rows.map((c) => { const mark = cal.marks[c.iso]; const isToday = c.iso === today; const isSel = c.iso === selDay; const hasOverdue = mark?.open && c.iso < today; return (
                  <button key={c.iso} onClick={() => setSelDay(isSel ? null : c.iso)} aria-pressed={isSel} aria-label={`Dia ${c.day}`}
                    className={`relative mx-auto w-9 h-9 rounded-xl text-sm flex flex-col items-center justify-center transition ${!c.inMonth ? 'text-muted/50 opacity-50' : ''} ${isToday ? 'ring-2 ring-teal-400 text-teal-600 dark:text-teal-200 font-bold shadow-[0_0_12px_rgba(45,212,191,.4)]' : ''} ${isSel ? 'bg-violet-600 text-white' : hasOverdue ? 'bg-rose-500/15 text-rose-500' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                    {c.day}
                    {mark && <span className="absolute bottom-0.5 flex gap-0.5">{mark.inc > 0 && <span className="w-1 h-1 rounded-full bg-emerald-400" />}{mark.exp > 0 && <span className="w-1 h-1 rounded-full bg-rose-400" />}</span>}
                  </button>
                ); })}
              </div>
            </div>
            <div className="md:pl-4 md:border-l border-[hsl(var(--border))] flex flex-col">
              <p className="font-semibold mb-2">{selDay ? `Em aberto em ${ddmm(selDay)}` : 'Próximos vencimentos'}</p>
              {upcoming.length === 0 ? <p className="text-xs text-muted py-4">{selDay ? 'Nada em aberto neste dia.' : 'Nada em aberto daqui pra frente.'}</p> : (
                <div className="space-y-1.5">
                  {upcoming.map((t) => { const inc = t.type === 'income'; return (
                    <button key={t.id} onClick={() => { setEditing(t); setModal(true); }} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${inc ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>{inc ? <ArrowUpRight className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}</span>
                      <span className="text-xs font-semibold whitespace-nowrap">{ddmm(t.date)}</span>
                      <span className="flex-1 text-xs truncate text-muted">{t.description || catMap[t.category_id]?.name || 'Conta'}</span>
                      <span className={`text-xs font-bold whitespace-nowrap ${inc ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(t.amount)}</span>
                    </button>
                  ); })}
                </div>
              )}
              <button onClick={() => showAgenda('all')} className="mt-auto pt-3"><span className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-violet-400/50 bg-violet-500/15 hover:bg-violet-500/25">Ver agenda completa <ArrowRight className="w-4 h-4" /></span></button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Próximas a pagar / receber + resumo */}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)]">
        <Panel tone="violet" title={<>Contas a Pagar <span className="text-sm font-normal text-muted">(Próximas)</span></>} icon={ArrowDownRight} iconClass="text-rose-400"
          action={<button onClick={() => showAgenda('expense')} className="text-sm font-semibold text-sky-500 hover:underline flex items-center gap-1 whitespace-nowrap">Ver todas <ArrowRight className="w-4 h-4" /></button>}>
          <NextList items={pendingPay} kind="expense" />
        </Panel>
        <Panel tone="violet" title={<>Contas a Receber <span className="text-sm font-normal text-muted">(Próximas)</span></>} icon={TrendingUp} iconClass="text-emerald-400"
          action={<button onClick={() => showAgenda('income')} className="text-sm font-semibold text-sky-500 hover:underline flex items-center gap-1 whitespace-nowrap">Ver todas <ArrowRight className="w-4 h-4" /></button>}>
          <NextList items={pendingRec} kind="income" />
        </Panel>
        <Panel tone="teal" title="Resumo do Mês" icon={DollarSign} iconClass="text-sky-400">
          <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 items-center">
            <Donut size={170} thickness={0.22} data={[{ name: 'Receitas', value: totals.inc, color: '#2dd4bf' }, { name: 'Despesas', value: totals.exp, color: '#a855f7' }]} center={<><span className="font-display font-bold">{formatCurrency(move)}</span><span className="text-[11px] text-muted">Movimentação</span></>} />
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Receitas <span className="ml-auto text-muted">{pct1(move ? (totals.inc / move) * 100 : 0)}</span></p>
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Despesas <span className="ml-auto text-muted">{pct1(move ? (totals.exp / move) * 100 : 0)}</span></p>
              <p className="text-[11px] text-muted pt-1">Pago {formatCurrency(totals.paid)} · Recebido {formatCurrency(totals.received)}</p>
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-center gap-3 rounded-2xl ring-1 px-4 py-3 ${totals.forecast >= 0 ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-rose-400/50 bg-rose-500/10'}`}>
            <TrendingUp className={`w-6 h-6 ${totals.forecast >= 0 ? 'text-emerald-400' : 'text-rose-400 rotate-180'}`} />
            <span className="font-semibold">Saldo do mês:</span>
            <span className={`font-display text-2xl font-bold ${totals.forecast >= 0 ? 'text-emerald-500 dark:text-emerald-300' : 'text-rose-500'}`}>{totals.forecast >= 0 ? '+' : ''}{formatCurrency(totals.forecast)}</span>
          </div>
        </Panel>
      </div>

      {/* Agenda completa (urgência) */}
      {agenda && (
        <div ref={agendaRef} className="scroll-mt-24">
          <Panel title="Agenda completa do mês" icon={CalendarClock} iconClass="text-violet-400"
            action={<div className="flex items-center gap-2"><Segmented size="sm" value={typeFilter} onChange={setTypeFilter} options={[['all', 'Tudo'], ['expense', 'A pagar'], ['income', 'A receber']]} /><button onClick={() => setAgenda(false)} aria-label="Fechar agenda" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>}>
            {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
              : pending.length === 0 && done.length === 0 ? <EmptyState icon={CalendarClock} title="Nada por aqui" subtitle="Nenhum item neste filtro." />
              : (
                <div className="space-y-4">
                  {buckets.map((b, bi) => { const col = collapsed.has(b.id); const s = sumOf(b.items); return (
                    <Reveal key={b.id} i={Math.min(bi, 5)}>
                      <div>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <button onClick={() => toggleCol(b.id)} className="flex items-center gap-2 flex-1 text-left"><span className="w-2.5 h-2.5 rounded-full" style={{ background: b.tone }} /><span className="font-semibold">{b.label}</span><span className="text-xs text-muted">· {b.items.length}</span><ChevronDown className={`w-4 h-4 text-muted transition ${col ? '-rotate-90' : ''}`} /></button>
                          <span className={`text-sm font-display font-semibold ${s < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{s >= 0 ? '+' : ''}{formatCurrency(s)}</span>
                          {b.items.length > 1 && <button onClick={() => bulkBaixa(b.items)} className="text-xs font-semibold text-emerald-600 hover:underline whitespace-nowrap">dar baixa em tudo</button>}
                        </div>
                        {!col && <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden" style={{ borderLeft: `3px solid ${b.tone}` }}>{b.items.map((t) => <Item key={t.id} t={t} />)}</div>}
                      </div>
                    </Reveal>
                  ); })}
                  {pending.length === 0 && <p className="text-sm text-muted text-center py-4">Tudo em dia neste mês. Bom trabalho!</p>}
                  {done.length > 0 && (
                    <div>
                      <button onClick={() => toggleCol('done')} className="flex items-center gap-2 mb-2 px-1 w-full text-left"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="font-semibold">Concluídas</span><span className="text-xs text-muted">· {done.length}</span><ChevronDown className={`w-4 h-4 text-muted transition ${collapsed.has('done') ? '-rotate-90' : ''}`} /></button>
                      {!collapsed.has('done') && <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">{done.map((t) => <Item key={t.id} t={t} />)}</div>}
                    </div>
                  )}
                </div>
              )}
          </Panel>
        </div>
      )}

      {/* barra de ações da seleção */}
      {sel.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl">
            <span className="text-sm font-semibold px-1">{sel.size} selecionada(s)</span>
            <span className="text-xs text-muted">· {formatCurrency(selItems.reduce((s, t) => s + Number(t.amount), 0))}</span>
            <div className="flex-1" />
            <Button size="sm" onClick={() => bulkBaixa(selItems)}><CircleCheck className="w-4 h-4" /> Dar baixa</Button>
            <button onClick={() => setSel(new Set())} aria-label="Limpar seleção" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <Modal open={chartBig} onClose={() => setChartBig(false)} title="Fluxo de Caixa (Entradas vs. Saídas)" maxWidth="max-w-5xl">
        <div className="mb-3"><Segmented size="sm" value={range} onChange={setRange} options={[['6m', '6M'], ['12m', '12M'], ['ytd', 'YTD']]} /></div>
        <FlowChart height={420} />
      </Modal>

      <TransactionModal open={modal} onClose={() => { setModal(false); setEditing(null); }} onSubmit={(p) => save.mutate(p)} saving={save.isPending} accounts={accounts} categories={categories} transactions={transactions} initial={editing} defaultType={defaultType} />

      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Comprovante" maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => window.open(viewReceipt, '_blank')}>Abrir em nova aba</Button><Button onClick={() => setViewReceipt(null)}>Fechar</Button></>}>
        {viewReceipt && (viewReceipt.startsWith('data:application/pdf') || viewReceipt.includes('.pdf')
          ? <iframe title="comprovante" src={viewReceipt} className="w-full h-[60vh] rounded-lg border border-[hsl(var(--border))]" />
          : <img src={viewReceipt} alt="Comprovante" className="w-full rounded-lg" />)}
      </Modal>
    </div>
  );
}

const HERO_T = {
  rose: ['ring-rose-400/50', 'linear-gradient(135deg,rgba(244,63,94,.26),rgba(136,19,55,.08) 70%)', 'bg-rose-500/20 text-rose-300', 'text-rose-300', 'bg-rose-500/25 text-rose-200'],
  emerald: ['ring-emerald-400/50', 'linear-gradient(135deg,rgba(16,185,129,.24),rgba(6,95,70,.08) 70%)', 'bg-emerald-500/20 text-emerald-300', 'text-emerald-300', 'bg-emerald-500/25 text-emerald-200'],
  violet: ['ring-violet-400/50', 'linear-gradient(135deg,rgba(139,92,246,.28),rgba(76,29,149,.08) 70%)', 'bg-violet-500/25 text-violet-200', 'text-violet-300', 'bg-violet-500/25 text-violet-100'],
  sky: ['ring-sky-400/40', 'linear-gradient(135deg,rgba(14,165,233,.2),rgba(30,64,175,.06) 70%)', 'bg-sky-500/20 text-sky-300', 'text-sky-300', 'bg-sky-500/25 text-sky-100'],
};
function Hero({ tone, icon: Icon, title, chip, value, raw, valueClass, foot }) {
  const [ring, bg, tile, , chipC] = HERO_T[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl ring-1 ${ring} bg-[hsl(var(--card))] p-4`} style={{ backgroundImage: bg }}>
      <div className="flex items-start gap-3">
        <span className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${tile}`}><Icon className="w-7 h-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="text-sm">{title}</p>{chip && <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${chipC}`}>{chip}</span>}</div>
          <p className={`font-display text-2xl 2xl:text-[1.7rem] font-bold leading-tight whitespace-nowrap ${valueClass || ''}`}>{raw != null ? raw : <AnimatedValue value={value} format={formatCurrency} />}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 text-xs text-muted flex items-center gap-1.5 flex-wrap">{foot}</div>
    </div>
  );
}
