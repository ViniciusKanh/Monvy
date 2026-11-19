import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';

export function AccountsMovementsTab({ transactions, accountsById }) {
  const list = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  return (
    <Card>
      <h3 className="font-semibold text-sm mb-3">Movimentações recentes (todas as contas)</h3>
      {list.length === 0 ? <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação" subtitle="Seus lançamentos aparecem aqui assim que forem criados." /> : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {list.map((t) => {
            const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
            const Icon = isTransfer ? ArrowLeftRight : isInc ? ArrowUpRight : ArrowDownRight;
            const tone = isTransfer ? 'text-indigo-500 bg-indigo-500/10' : isInc ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10';
            const acc = accountsById[t.account_id]; const accTo = accountsById[t.account_to_id];
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.description || (isTransfer ? 'Transferência' : isInc ? 'Recebimento' : 'Pagamento')}</p>
                  <p className="text-xs text-muted truncate">{isTransfer ? `${acc?.name || '—'} → ${accTo?.name || '—'}` : (acc?.name || '—')} · {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${isTransfer ? 'text-indigo-500' : isInc ? 'text-emerald-500' : 'text-rose-500'}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
