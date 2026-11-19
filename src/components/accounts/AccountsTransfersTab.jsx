import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';

export function AccountsTransfersTab({ transactions, accountsById }) {
  const transfers = transactions.filter((t) => t.type === 'transfer').sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <Card>
      <h3 className="font-semibold text-sm mb-3">Transferências entre contas</h3>
      {transfers.length === 0 ? <EmptyState icon={ArrowLeftRight} title="Nenhuma transferência" subtitle="Transferências entre suas contas aparecem aqui." /> : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-indigo-500 bg-indigo-500/10"><ArrowLeftRight className="w-4 h-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">{accountsById[t.account_id]?.name || '—'} <ArrowRight className="w-3.5 h-3.5 text-muted" /> {accountsById[t.account_to_id]?.name || '—'}</p>
                <p className="text-xs text-muted">{new Date(t.date).toLocaleDateString('pt-BR')}{t.description ? ` · ${t.description}` : ''}</p>
              </div>
              <p className="text-sm font-semibold text-indigo-500 shrink-0">{formatCurrency(t.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
