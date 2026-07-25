import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { Button, Card, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth, todayIso } from '../lib/utils.js';
import { ChevronLeft, ChevronRight, Plus, ArrowUpRight, ArrowDownRight, CircleCheck, Undo2, Pencil, Paperclip, AlertTriangle, CalendarClock } from 'lucide-react';

const TABS = [['pending', 'A pagar / receber'], ['completed', 'Concluidos'], ['all', 'Todos']];

export default function Payments() {
  const qc = useQueryClient();
  const [mk, setMk] = useState(monthKey(new Date()));
  const [tab, setTab] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultType, setDefaultType] = useState('expense');
  const [viewReceipt, setViewReceipt] = useState(null);

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: inval });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { inval(); setModal(false); setEditing(null); } });

  const today = todayIso();
  const monthItems = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && inMonth(t.date, mk)), [transactions, mk]);

  const totals = useMemo(() => {
    let toPay = 0, toReceive = 0, paid = 0, received = 0;
    for (const t of monthItems) {
      const done = (t.status || 'pending') === 'completed';
      if (t.type === 'expense') { if (done) paid += +t.amount; else toPay += +t.amount; }
      if (t.type === 'income') { if (done) received += +t.amount; else toReceive += +t.amount; }
    }
    return { toPay, toReceive, paid, received, forecast: (received + toReceive) - (paid + toPay) };
  }, [monthItems]);

  const list = useMemo(() => monthItems.filter((t) => {
    const done = (t.status || 'pending') === 'completed';
    if (tab === 'pending' && done) return false;
    if (tab === 'completed' && !done) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    return true;
  }).sort((a, b) => (a.date < b.date ? -1 : 1)), [monthItems, tab, typeFilter]);

  const shift = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Contas a Pagar e Receber" subtitle="Controle o que falta pagar e receber"
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
            <span className="text-xs text-slate-300">Saldo previsto do mes: <b className={totals.forecast < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatCurrency(totals.forecast)}</b></span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3"><p className="text-xs text-rose-300">A pagar</p><p className="font-display text-xl font-bold"><AnimatedValue value={totals.toPay} format={formatCurrency} /></p></div>
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3"><p className="text-xs text-emerald-300">A receber</p><p className="font-display text-xl font-bold"><AnimatedValue value={totals.toReceive} format={formatCurrency} /></p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-slate-400">Pago no mes</p><p className="font-display text-xl font-bold">{formatCurrency(totals.paid)}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-slate-400">Recebido no mes</p><p className="font-display text-xl font-bold">{formatCurrency(totals.received)}</p></div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {TABS.map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
        </div>
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {[['all', 'Ambos'], ['expense', 'Pagar'], ['income', 'Receber']].map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : list.length === 0 ? <Card><EmptyState icon={CalendarClock} title="Nada por aqui" subtitle="Nenhum item neste filtro." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Nova conta a pagar</Button>} /></Card>
        : (
          <Card className="p-0 divide-y divide-[hsl(var(--border))] overflow-hidden">
            {list.map((t, i) => {
              const cat = catMap[t.category_id]; const isInc = t.type === 'income';
              const done = (t.status || 'pending') === 'completed';
              const overdue = !done && String(t.date).slice(0, 10) < today;
              return (
                <Reveal key={t.id} i={Math.min(i, 10)}>
                  <div className={`flex items-center gap-3 px-4 py-3 ${overdue ? 'bg-rose-50/50 dark:bg-rose-500/5' : ''}`}>
                    <button onClick={() => setStatus.mutate({ id: t.id, status: done ? 'pending' : 'completed' })} title={done ? 'Reabrir' : 'Marcar como pago/recebido'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : 'border-2 border-dashed border-[hsl(var(--border))] text-muted hover:border-emerald-500 hover:text-emerald-500'}`}>
                      {done ? <CircleCheck className="w-4 h-4" /> : (isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />)}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${done ? 'line-through opacity-60' : ''}`}>{t.description || cat?.name || 'Lancamento'}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
                        <span>{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        <span>· {cat?.name || 'Sem categoria'}</span>
                        {overdue && <Badge color="rose"><AlertTriangle className="w-3 h-3" /> Vencido</Badge>}
                        {t.receipt_url && <button onClick={() => setViewReceipt(t.receipt_url)} className="inline-flex items-center gap-0.5 text-sky-500 font-medium hover:underline"><Paperclip className="w-3 h-3" /> comprovante</button>}
                      </div>
                    </div>
                    <p className={`font-semibold shrink-0 ${isInc ? 'text-emerald-500' : 'text-rose-500'} ${done ? 'opacity-60' : ''}`}>{isInc ? '+' : '-'}{formatCurrency(t.amount)}</p>
                    <div className="flex gap-0.5 shrink-0">
                      {done
                        ? <button title="Reabrir" onClick={() => setStatus.mutate({ id: t.id, status: 'pending' })} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Undo2 className="w-4 h-4" /></button>
                        : <button title="Dar baixa" onClick={() => setStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>}
                      <button onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </Card>
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
