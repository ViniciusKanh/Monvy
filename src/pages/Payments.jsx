import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { Button, Card, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth, todayIso } from '../lib/utils.js';
import { useHolidayMap } from '../lib/holidays.js';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, ArrowUpRight, ArrowDownRight, CircleCheck, Undo2, Pencil, Paperclip, AlertTriangle, CalendarClock, ArrowLeftRight, Repeat, Bot, Zap } from 'lucide-react';

const addMonthIso = (iso, n) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const base = new Date(y, m - 1 + n, 1); const day = Math.min(d, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()); return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };

// baldes de urgência (só itens em aberto)
const BUCKETS = [
  { id: 'overdue', label: 'Vencidas', tone: '#f43f5e', test: (d, today, week) => d < today },
  { id: 'today', label: 'Vencem hoje', tone: '#f59e0b', test: (d, today) => d === today },
  { id: 'week', label: 'Próximos 7 dias', tone: '#6366f1', test: (d, today, week) => d > today && d <= week },
  { id: 'later', label: 'Mais para frente', tone: '#0ea5e9', test: (d, today, week) => d > week },
];

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

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const holidayMap = useHolidayMap(Number(mk.slice(0, 4)));

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: inval });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { inval(); setModal(false); setEditing(null); } });
  const repeat = useMutation({
    mutationFn: (t) => Transaction.create({ type: t.type, date: addMonthIso(t.date, 1), amount: Number(t.amount), description: t.description, account_id: t.account_id, category_id: t.category_id || null, is_fixed: !!t.is_fixed, recurrence: t.recurrence || 'none', status: 'pending' }),
    onSuccess: () => { inval(); toast.success('Repetido no mês seguinte, em aberto.'); },
  });

  const today = todayIso();
  const weekIso = (() => { const d = new Date(today + 'T00:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();

  const monthItems = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && inMonth(t.date, mk) && (typeFilter === 'all' || t.type === typeFilter)), [transactions, mk, typeFilter]);

  const totals = useMemo(() => {
    let toPay = 0, toReceive = 0, paid = 0, received = 0, overdue = 0;
    for (const t of monthItems) {
      const done = (t.status || 'pending') === 'completed';
      if (t.type === 'expense') { if (done) paid += +t.amount; else { toPay += +t.amount; if (String(t.date).slice(0, 10) < today) overdue += +t.amount; } }
      if (t.type === 'income') { if (done) received += +t.amount; else toReceive += +t.amount; }
    }
    return { toPay, toReceive, paid, received, overdue, forecast: (received + toReceive) - (paid + toPay) };
  }, [monthItems, today]);

  const pending = useMemo(() => monthItems.filter((t) => (t.status || 'pending') !== 'completed'), [monthItems]);
  const done = useMemo(() => monthItems.filter((t) => (t.status || 'pending') === 'completed').sort((a, b) => (a.date < b.date ? 1 : -1)), [monthItems]);

  const buckets = useMemo(() => BUCKETS.map((b) => ({
    ...b,
    items: pending.filter((t) => b.test(String(t.date).slice(0, 10), today, weekIso)).sort((a, b2) => (a.date < b2.date ? -1 : 1)),
  })).filter((b) => b.items.length), [pending, today, weekIso]);

  const shift = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };
  const toggleCol = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkBaixa = async (items) => { for (const t of items) await Transaction.update(t.id, { status: 'completed' }); inval(); toast.success(`${items.length} conta(s) baixada(s).`); };
  const overdueItems = pending.filter((t) => String(t.date).slice(0, 10) < today);

  const Item = ({ t }) => {
    const cat = catMap[t.category_id]; const isInc = t.type === 'income';
    const done2 = (t.status || 'pending') === 'completed';
    const overdue = !done2 && String(t.date).slice(0, 10) < today;
    const hn = holidayMap.get(String(t.date).slice(0, 10));
    return (
      <div className={`group flex items-center gap-3 px-4 py-3 ${overdue ? 'bg-rose-50/60 dark:bg-rose-500/[0.06]' : ''}`}>
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
          {done2
            ? <button title="Reabrir" onClick={() => setStatus.mutate({ id: t.id, status: 'pending' })} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Undo2 className="w-4 h-4" /></button>
            : <button title="Dar baixa" onClick={() => setStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>}
          <button title="Editar" onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  const sumOf = (items) => items.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Contas a pagar e receber" subtitle="Sua agenda financeira do mês, organizada por urgência"
        actions={<>
          <Button variant="outline" onClick={() => openNew('income')}><ArrowUpRight className="w-4 h-4 text-emerald-500" /> A receber</Button>
          <Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> A pagar</Button>
        </>} />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10 mb-5" style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,.25), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1 py-1 backdrop-blur">
              <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
              <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer px-1 capitalize [&>option]:text-slate-800">{monthRange(11, 4).map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
              <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <span className="text-xs text-slate-300">Saldo previsto do mês: <b className={totals.forecast < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatCurrency(totals.forecast)}</b></span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3"><p className="text-xs text-rose-300">A pagar</p><p className="font-display text-xl font-bold"><AnimatedValue value={totals.toPay} format={formatCurrency} /></p>{totals.overdue > 0 && <p className="text-[11px] text-rose-300 mt-0.5">{formatCurrency(totals.overdue)} vencido</p>}</div>
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3"><p className="text-xs text-emerald-300">A receber</p><p className="font-display text-xl font-bold"><AnimatedValue value={totals.toReceive} format={formatCurrency} /></p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-slate-400">Pago no mês</p><p className="font-display text-xl font-bold">{formatCurrency(totals.paid)}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-slate-400">Recebido no mês</p><p className="font-display text-xl font-bold">{formatCurrency(totals.received)}</p></div>
          </div>
        </div>
      </div>

      {/* Faixa de automação + filtro tipo */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <button onClick={() => navigate('/agentes')} className="flex items-center gap-3 flex-1 text-left rounded-2xl p-3 border border-indigo-500/30 bg-indigo-500/[0.06] hover:bg-indigo-500/10 transition">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-500 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="text-sm font-semibold flex items-center gap-1.5">Coloque um robô de olho nos vencimentos <Zap className="w-3.5 h-3.5 text-amber-500" /></span>
            <span className="text-xs text-muted block">Ele te avisa no app e no e-mail quando algo estiver perto de vencer. Toque para configurar.</span>
          </span>
        </button>
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 self-start">
          {[['all', 'Tudo'], ['expense', 'A pagar'], ['income', 'A receber']].map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : pending.length === 0 && done.length === 0 ? <Card><EmptyState icon={CalendarClock} title="Nada por aqui" subtitle="Nenhum item neste filtro. Cadastre uma conta a pagar ou a receber." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Nova conta a pagar</Button>} /></Card>
        : (
          <div className="space-y-4">
            {/* Ação rápida: quitar vencidas */}
            {overdueItems.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl p-3 border border-rose-500/30 bg-rose-500/[0.06]">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <p className="text-sm flex-1"><b>{overdueItems.length}</b> conta(s) vencida(s) somando <b>{formatCurrency(overdueItems.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))}</b> a pagar.</p>
                <Button size="sm" onClick={() => bulkBaixa(overdueItems)}><CircleCheck className="w-4 h-4" /> Dar baixa nas vencidas</Button>
              </div>
            )}

            {buckets.map((b, bi) => {
              const col = collapsed.has(b.id);
              const s = sumOf(b.items);
              return (
                <Reveal key={b.id} i={Math.min(bi, 5)}>
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <button onClick={() => toggleCol(b.id)} className="flex items-center gap-2 flex-1 text-left">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.tone }} />
                        <span className="font-semibold">{b.label}</span>
                        <span className="text-xs text-muted">· {b.items.length}</span>
                        <ChevronDown className={`w-4 h-4 text-muted transition ${col ? '-rotate-90' : ''}`} />
                      </button>
                      <span className={`text-sm font-display font-semibold ${s < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{s >= 0 ? '+' : ''}{formatCurrency(s)}</span>
                      {b.items.length > 1 && <button onClick={() => bulkBaixa(b.items)} className="text-xs font-semibold text-emerald-600 hover:underline whitespace-nowrap">dar baixa em tudo</button>}
                    </div>
                    {!col && <Card className="p-0 divide-y divide-[hsl(var(--border))] overflow-hidden" style={{ borderLeft: `3px solid ${b.tone}` }}>{b.items.map((t) => <Item key={t.id} t={t} />)}</Card>}
                  </div>
                </Reveal>
              );
            })}

            {pending.length === 0 && <Card><EmptyState icon={CircleCheck} title="Tudo em dia neste mês" subtitle="Nenhuma conta em aberto. Bom trabalho!" /></Card>}

            {/* Concluídas */}
            {done.length > 0 && (
              <div>
                <button onClick={() => toggleCol('done')} className="flex items-center gap-2 mb-2 px-1 w-full text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold">Concluídas</span>
                  <span className="text-xs text-muted">· {done.length}</span>
                  <ChevronDown className={`w-4 h-4 text-muted transition ${collapsed.has('done') ? '-rotate-90' : ''}`} />
                </button>
                {!collapsed.has('done') && <Card className="p-0 divide-y divide-[hsl(var(--border))] overflow-hidden">{done.map((t) => <Item key={t.id} t={t} />)}</Card>}
              </div>
            )}
          </div>
        )}

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
