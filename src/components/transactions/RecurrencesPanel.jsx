import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '../../api/entities.js';
import { Modal, Button, Badge, EmptyState } from '../ui';
import { toast } from '../../lib/toast.js';
import { formatCurrency } from '../../lib/utils.js';
import { Repeat, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Lista os lançamentos "pai" de uma recorrência mensal (is_fixed=1,
// recurrence='monthly', sem parent_transaction_id) — o Monvy materializa um
// lançamento real por mês a partir deles (ver api/_lib/hooks.js). Editar o
// pai muda o valor dos PRÓXIMOS meses gerados a partir de agora; os meses já
// materializados no passado não são alterados retroativamente.
export function RecurrencesPanel({ transactions, accMap, catMap, onClose, onEdit }) {
  const qc = useQueryClient();
  const parents = useMemo(() => transactions
    .filter((t) => t.is_fixed && t.recurrence === 'monthly' && !t.parent_transaction_id)
    .sort((a, b) => (a.description || '').localeCompare(b.description || '')), [transactions]);
  const childrenCount = (id) => transactions.filter((t) => t.parent_transaction_id === id).length;
  const pendingFuture = (id) => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions.filter((t) => t.parent_transaction_id === id && t.date >= today && t.status !== 'completed').length;
  };

  const del = useMutation({
    mutationFn: (id) => Transaction.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Série cancelada — as ocorrências futuras em aberto foram removidas.'); },
    onError: (e) => toast.error(e.message || 'Falha ao cancelar'),
  });
  const confirmDel = (p) => {
    const n = pendingFuture(p.id);
    if (window.confirm(`Cancelar a recorrência "${p.description || catMap[p.category_id]?.name || 'lançamento'}"? ${n > 0 ? `Isso remove ${n} ocorrência(s) futura(s) ainda em aberto. ` : ''}O histórico já lançado não é afetado. Essa ação não pode ser desfeita.`)) del.mutate(p.id);
  };

  return (
    <Modal open onClose={onClose} title="Gerenciar recorrências" maxWidth="max-w-xl" footer={<Button onClick={onClose}>Fechar</Button>}>
      <p className="text-xs text-muted mb-3">Lançamentos fixos mensais (receitas, despesas e transferências). O Monvy gera automaticamente um lançamento real a cada mês a partir de cada um destes.</p>
      {parents.length === 0 ? (
        <EmptyState icon={Repeat} title="Nenhuma recorrência" subtitle="Marque 'Lançamento fixo' com recorrência mensal ao criar um lançamento pra ele aparecer aqui." />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {parents.map((p) => {
            const isInc = p.type === 'income'; const isTr = p.type === 'transfer';
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: isTr ? '#6366f1' : (catMap[p.category_id]?.color || (isInc ? '#10b981' : '#f43f5e')) }}>
                  {isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.description || catMap[p.category_id]?.name || 'Lançamento'}</p>
                  <p className="text-[11px] text-muted truncate">{accMap[p.account_id]?.name || ''} · desde {new Date(String(p.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} · <Badge color="blue">{childrenCount(p.id)} gerado(s)</Badge></p>
                </div>
                <p className={`font-semibold text-sm shrink-0 ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(p.amount)}</p>
                <div className="flex gap-0.5 shrink-0">
                  <button title="Editar (afeta só os próximos meses)" onClick={() => onEdit(p)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                  <button title="Cancelar série" onClick={() => confirmDel(p)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
