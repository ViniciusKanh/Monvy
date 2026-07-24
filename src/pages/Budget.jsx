import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Modal, Field, Spinner, EmptyState } from '../components/ui';
import { formatCurrency, monthKey, inMonth } from '../lib/utils.js';
import { PiggyBank, AlertTriangle, Pencil } from 'lucide-react';

export default function Budget() {
  const qc = useQueryClient();
  const mk = monthKey(new Date());
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState('');

  const save = useMutation({
    mutationFn: ({ id, budget_limit }) => Category.update(id, { budget_limit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditing(null); },
  });

  const spentByCat = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.type === 'expense' && inMonth(t.date, mk) && t.category_id) {
        map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
      }
    }
    return map;
  }, [transactions, mk]);

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const withBudget = expenseCats.filter((c) => c.budget_limit);
  const totalBudget = withBudget.reduce((s, c) => s + Number(c.budget_limit), 0);
  const totalSpent = withBudget.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);
  const over = withBudget.filter((c) => (spentByCat[c.id] || 0) >= Number(c.budget_limit)).length;
  const attention = withBudget.filter((c) => { const p = (spentByCat[c.id] || 0) / Number(c.budget_limit); return p >= 0.8 && p < 1; }).length;

  return (
    <div>
      <PageHeader title="Orcamento" subtitle="Limites de gasto por categoria (mes atual)" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="py-3"><p className="text-xs text-muted">Total gasto</p><p className="font-display text-lg font-bold">{formatCurrency(totalSpent)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Total orcado</p><p className="font-display text-lg font-bold">{formatCurrency(totalBudget)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Acima do limite</p><p className="font-display text-lg font-bold text-rose-500">{over}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Em atencao</p><p className="font-display text-lg font-bold text-amber-500">{attention}</p></Card>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : expenseCats.length === 0 ? <Card><EmptyState icon={PiggyBank} title="Sem categorias de despesa" subtitle="Crie categorias de despesa e defina limites aqui." /></Card>
        : (
          <div className="space-y-3">
            {expenseCats.map((c) => {
              const spent = spentByCat[c.id] || 0;
              const budget = Number(c.budget_limit || 0);
              const pct = budget ? Math.round((spent / budget) * 100) : 0;
              const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
              return (
                <Card key={c.id} className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                      <span className="font-semibold">{c.name}</span>
                      {pct >= 100 && <span className="flex items-center gap-1 text-xs text-rose-500"><AlertTriangle className="w-3 h-3" /> Excedido</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{budget ? `${formatCurrency(spent)} / ${formatCurrency(budget)}` : `${formatCurrency(spent)} (sem limite)`}</span>
                      <button onClick={() => { setEditing(c); setLimit(c.budget_limit ?? ''); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {budget > 0 && (
                    <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                    </div>
                  )}
                  {budget > 0 && <p className="text-xs text-muted mt-1">{pct}% usado - resta {formatCurrency(Math.max(0, budget - spent))}</p>}
                </Card>
              );
            })}
          </div>
        )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Limite: ${editing?.name || ''}`} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => save.mutate({ id: editing.id, budget_limit: limit === '' ? null : Number(limit) })} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <Field label="Limite mensal (deixe vazio para remover)"><Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>
    </div>
  );
}
