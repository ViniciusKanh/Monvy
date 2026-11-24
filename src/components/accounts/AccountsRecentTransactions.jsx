import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, ArrowRight, Zap } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';

export function AccountsRecentTransactions({ transactions, accountsById }) {
  const navigate = useNavigate();
  const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.created_date || '').localeCompare(String(a.created_date || '')))).slice(0, 4);

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-teal-400" /> Últimas movimentações</h3>
        <button onClick={() => navigate('/lancamentos')} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">Ver todas <ArrowRight className="w-3.5 h-3.5" /></button>
      </div>
      {recent.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação" subtitle="Os lançamentos das suas contas aparecem aqui." />
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {recent.map((t) => {
            const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
            const acc = accountsById[t.account_id];
            const Icon = isTransfer ? ArrowLeftRight : isInc ? ArrowUpRight : ArrowDownRight;
            const tone = isTransfer ? 'text-indigo-400 bg-indigo-500/15' : isInc ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15';
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{t.description || (isTransfer ? 'Transferência' : isInc ? 'Recebimento' : 'Pagamento')}</p>
                  <p className="text-xs text-muted truncate">{acc?.name || '—'} • {new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ${isTransfer ? 'text-indigo-400' : isInc ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
