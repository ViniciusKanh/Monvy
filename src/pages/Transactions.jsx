import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { Button, Card, Input, Select, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency, monthKey, monthLabel, inMonth } from '../lib/utils.js';
import { Plus, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Pencil, Trash2, ArrowUpRight, ArrowDownRight, CircleCheck, Clock } from 'lucide-react';

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

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  const save = useMutation({
    mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setModal(false); setEditing(null); },
  });
  const markStatus = useMutation({
    mutationFn: ({ id, status }) => Transaction.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
  const del = useMutation({
    mutationFn: (id) => Transaction.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setToDelete(null); },
  });

  // transacoes reais do mes + instancias virtuais de fixas mensais
  const monthTx = useMemo(() => {
    const real = transactions.filter((t) => inMonth(t.date, mk));
    const virtuals = [];
    for (const t of transactions) {
      if (t.is_fixed && t.recurrence === 'monthly') {
        const origMk = String(t.date).slice(0, 7);
        if (origMk < mk) {
          const day = String(t.date).slice(8, 10) || '01';
          virtuals.push({ ...t, id: `${t.id}__${mk}`, date: `${mk}-${day}`, _virtual: true });
        }
      }
    }
    return [...real, ...virtuals];
  }, [transactions, mk]);

  const filtered = useMemo(() => {
    return monthTx.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      const st = t.status || 'pending';
      if (statusFilter === 'pending' && st !== 'pending') return false;
      if (statusFilter === 'completed' && st !== 'completed') return false;
      if (search) {
        const q = search.toLowerCase();
        const cat = catMap[t.category_id]?.name?.toLowerCase() || '';
        if (!(t.description || '').toLowerCase().includes(q) && !cat.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [monthTx, typeFilter, statusFilter, search, catMap]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of monthTx) { if (t.type === 'income') inc += Number(t.amount); if (t.type === 'expense') exp += Number(t.amount); }
    return { inc, exp, bal: inc - exp };
  }, [monthTx]);

  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); const date = new Date(y, m - 1 + d, 1); setMk(monthKey(date)); };
  const grouped = useMemo(() => { const g = {}; for (const t of filtered) { const d = t.date.slice(0, 10); (g[d] = g[d] || []).push(t); } return g; }, [filtered]);

  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };

  return (
    <div>
      <PageHeader title="Lancamentos" subtitle="Receitas, despesas e transferencias"
        actions={<>
          <Button variant="outline" onClick={() => openNew('income')}><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Receita</Button>
          <Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Despesa</Button>
        </>} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg card"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-semibold min-w-[140px] text-center">{monthLabel(mk)}</span>
          <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg card"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="py-3"><p className="text-xs text-muted">Receitas</p><p className="font-display text-lg font-bold text-emerald-500">{formatCurrency(totals.inc)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Despesas</p><p className="font-display text-lg font-bold text-rose-500">{formatCurrency(totals.exp)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Saldo</p><p className={`font-display text-lg font-bold ${totals.bal < 0 ? 'text-rose-500' : 'text-[hsl(var(--text))]'}`}>{formatCurrency(totals.bal)}</p></Card>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
          <option value="all">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option><option value="transfer">Transferencias</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
          <option value="all">Todos os status</option><option value="pending">A pagar/receber</option><option value="completed">Pagos/recebidos</option>
        </Select>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : filtered.length === 0 ? <Card><EmptyState icon={ArrowLeftRight} title="Nenhum lancamento" subtitle="Adicione uma receita ou despesa neste mes." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Novo lancamento</Button>} /></Card>
        : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted mb-2">{new Date(date + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                <Card className="p-0 divide-y divide-[hsl(var(--border))]">
                  {items.map((t) => {
                    const cat = catMap[t.category_id];
                    const isInc = t.type === 'income';
                    const isTransfer = t.type === 'transfer';
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: isTransfer ? '#3b82f6' : (cat?.color || (isInc ? '#10b981' : '#ef4444')) }}>
                          {isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{t.description || cat?.name || (isTransfer ? 'Transferencia' : 'Lancamento')}</p>
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span>{isTransfer ? `${accMap[t.account_id]?.name || ''} -> ${accMap[t.account_to_id]?.name || ''}` : (cat?.name || 'Sem categoria')}</span>
                            {t.is_fixed && <Badge color="blue">Fixo</Badge>}
                            {t._virtual && <Badge color="amber">Recorrente</Badge>}
                            {t.type !== 'transfer' && ((t.status || 'pending') === 'completed'
                              ? <Badge color="emerald">{t.type === 'income' ? 'Recebido' : 'Pago'}</Badge>
                              : <Badge color="amber">{t.type === 'income' ? 'A receber' : 'A pagar'}</Badge>)}
                          </div>
                        </div>
                        <p className={`font-semibold ${isInc ? 'text-emerald-500' : isTransfer ? 'text-blue-500' : 'text-rose-500'}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</p>
                        {!t._virtual && (
                          <div className="flex gap-1">
                            {t.type !== 'transfer' && (t.status || 'pending') !== 'completed' && (
                              <button title="Marcar como pago/recebido" onClick={() => markStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setToDelete(t)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}

      <TransactionModal open={modal} onClose={() => { setModal(false); setEditing(null); }}
        onSubmit={(p) => save.mutate(p)} saving={save.isPending}
        accounts={accounts} categories={categories} initial={editing} defaultType={defaultType} />

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir lancamento" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>{del.isPending ? <Spinner className="w-4 h-4" /> : 'Excluir'}</Button></>}>
        <p className="text-sm text-muted">Tem certeza? O saldo da conta sera recalculado automaticamente.</p>
      </Modal>
    </div>
  );
}
