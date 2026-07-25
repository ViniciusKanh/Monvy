import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { Button, Card, Input, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth } from '../lib/utils.js';
import { Plus, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Pencil, Trash2, ArrowUpRight, ArrowDownRight, CircleCheck, Clock, Paperclip, X } from 'lucide-react';

const TYPE_FILTERS = [['all', 'Todos'], ['income', 'Receitas'], ['expense', 'Despesas'], ['transfer', 'Transf.']];
const STATUS_FILTERS = [['all', 'Todos'], ['pending', 'A pagar/receber'], ['completed', 'Pagos']];

export default function Transactions() {
  const qc = useQueryClient();
  const [mk, setMk] = useState(monthKey(new Date()));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [defaultType, setDefaultType] = useState('expense');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const months = useMemo(() => monthRange(11, 4), []);

  const markStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); } });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(false); setEditing(null); } });
  const del = useMutation({ mutationFn: (id) => Transaction.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setToDelete(null); } });

  const monthTx = useMemo(() => transactions.filter((t) => inMonth(t.date, mk)), [transactions, mk]);
  const filtered = useMemo(() => monthTx.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    const st = t.status || 'pending';
    if (statusFilter === 'pending' && st !== 'pending') return false;
    if (statusFilter === 'completed' && st !== 'completed') return false;
    if (search) { const q = search.toLowerCase(); const cat = catMap[t.category_id]?.name?.toLowerCase() || ''; if (!(t.description || '').toLowerCase().includes(q) && !cat.includes(q)) return false; }
    return true;
  }).sort((a, b) => (a.date < b.date ? 1 : -1)), [monthTx, typeFilter, statusFilter, search, catMap]);

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

  const grouped = useMemo(() => { const g = {}; for (const t of filtered) { const d = t.date.slice(0, 10); (g[d] = g[d] || []).push(t); } return g; }, [filtered]);
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };
  const dayNet = (items) => items.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0), 0);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Lancamentos" subtitle="Receitas, despesas e transferencias"
        actions={<>
          <Button variant="outline" onClick={() => openNew('income')}><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Receita</Button>
          <Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Despesa</Button>
        </>} />

      {/* Hero do mes */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10 mb-5" style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,.28), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1 py-1 backdrop-blur">
              <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
              <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer px-1 capitalize [&>option]:text-slate-800">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
              <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
            </div>
            {totals.pend > 0 && <span className="text-xs flex items-center gap-1 bg-amber-500/15 text-amber-200 px-3 py-1.5 rounded-full ring-1 ring-amber-500/20"><Clock className="w-3.5 h-3.5" /> {formatCurrency(totals.pend)} a pagar/receber</span>}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div><p className="text-xs text-emerald-300 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Receitas</p><p className="font-display text-xl sm:text-2xl font-bold mt-0.5"><AnimatedValue value={totals.inc} format={formatCurrency} /></p></div>
            <div><p className="text-xs text-rose-300 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5" /> Despesas</p><p className="font-display text-xl sm:text-2xl font-bold mt-0.5"><AnimatedValue value={totals.exp} format={formatCurrency} /></p></div>
            <div><p className="text-xs text-slate-300">Saldo</p><p className={`font-display text-xl sm:text-2xl font-bold mt-0.5 ${totals.bal < 0 ? 'text-rose-300' : 'text-white'}`}><AnimatedValue value={totals.bal} format={formatCurrency} /></p></div>
          </div>
          <div className="flex gap-1 mt-4 h-2 rounded-full overflow-hidden bg-white/10">
            <div className="bg-emerald-400 transition-all" style={{ width: `${(totals.inc / incExpMax) * 50}%` }} />
            <div className="bg-rose-400 transition-all" style={{ width: `${(totals.exp / incExpMax) * 50}%` }} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descricao ou categoria..." className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
            {TYPE_FILTERS.map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${typeFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
          </div>
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
            {STATUS_FILTERS.map(([v, l]) => <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${statusFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
          </div>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : filtered.length === 0 ? <Card><EmptyState icon={ArrowLeftRight} title="Nenhum lancamento" subtitle="Adicione uma receita ou despesa neste mes." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Novo lancamento</Button>} /></Card>
        : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, items], gi) => {
              const net = dayNet(items);
              return (
                <Reveal key={date} i={Math.min(gi, 6)}>
                  <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <p className="text-xs font-semibold text-muted capitalize">{new Date(date + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}</p>
                      <p className={`text-xs font-semibold ${net < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</p>
                    </div>
                    <Card className="p-0 divide-y divide-[hsl(var(--border))] overflow-hidden">
                      {items.map((t) => {
                        const cat = catMap[t.category_id];
                        const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
                        const pend = !isTransfer && (t.status || 'pending') !== 'completed';
                        return (
                          <div key={t.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition">
                            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: isTransfer ? '#6366f1' : (cat?.color || (isInc ? '#10b981' : '#f43f5e')) }}>
                              {isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{t.description || cat?.name || (isTransfer ? 'Transferencia' : 'Lancamento')}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
                                <span className="truncate">{isTransfer ? `${accMap[t.account_id]?.name || ''} → ${accMap[t.account_to_id]?.name || ''}` : (cat?.name || 'Sem categoria')}</span>
                                {t.is_fixed && <Badge color="blue">Fixo</Badge>}
                                {t.parent_transaction_id && <Badge color="amber">Recorrente</Badge>}
                                {!isTransfer && (pend ? <Badge color="amber">{isInc ? 'A receber' : 'A pagar'}</Badge> : <Badge color="emerald">{isInc ? 'Recebido' : 'Pago'}</Badge>)}
                                {t.receipt_url && <button onClick={() => setViewReceipt(t.receipt_url)} className="inline-flex items-center gap-0.5 text-[11px] text-sky-500 font-medium hover:underline"><Paperclip className="w-3 h-3" /> comprovante</button>}
                              </div>
                            </div>
                            <p className={`font-semibold shrink-0 ${isInc ? 'text-emerald-500' : isTransfer ? 'text-indigo-500' : 'text-rose-500'} ${pend ? 'opacity-70' : ''}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</p>
                            <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition">
                              {pend && <button title="Marcar como pago/recebido" onClick={() => markStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>}
                              <button onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setToDelete(t)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

      <TransactionModal open={modal} onClose={() => { setModal(false); setEditing(null); }} onSubmit={(p) => save.mutate(p)} saving={save.isPending} accounts={accounts} categories={categories} transactions={transactions} initial={editing} defaultType={defaultType} />

      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Comprovante" maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => window.open(viewReceipt, '_blank')}>Abrir em nova aba</Button><Button onClick={() => setViewReceipt(null)}>Fechar</Button></>}>
        {viewReceipt && (viewReceipt.startsWith('data:application/pdf') || viewReceipt.includes('.pdf')
          ? <iframe title="comprovante" src={viewReceipt} className="w-full h-[60vh] rounded-lg border border-[hsl(var(--border))]" />
          : <img src={viewReceipt} alt="Comprovante" className="w-full rounded-lg" />)}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir lancamento" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>{del.isPending ? <Spinner className="w-4 h-4" /> : 'Excluir'}</Button></>}>
        <p className="text-sm text-muted">Tem certeza? O saldo da conta sera recalculado automaticamente.</p>
      </Modal>
    </div>
  );
}
