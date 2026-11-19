import { useMemo, useState } from 'react';
import { Select, Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';
import { FileText } from 'lucide-react';

export function AccountsStatementsTab({ accounts, transactions }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const account = accounts.find((a) => a.id === accountId);

  const ledger = useMemo(() => {
    if (!account) return [];
    const rows = transactions
      .filter((t) => t.account_id === account.id || t.account_to_id === account.id)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    let running = Number(account.initial_balance || 0);
    return rows.map((t) => {
      let delta = 0;
      if (t.type === 'income') delta = Number(t.amount);
      else if (t.type === 'expense') delta = -Number(t.amount);
      else if (t.type === 'transfer') delta = (t.account_id === account.id ? -1 : 1) * Number(t.amount);
      running += delta;
      return { ...t, delta, running };
    }).reverse();
  }, [account, transactions]);

  if (!accounts.length) return <Card><EmptyState icon={FileText} title="Nenhuma conta" subtitle="Crie uma conta para ver o extrato." /></Card>;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-semibold text-sm">Extrato</h3>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-auto">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      {ledger.length === 0 ? <EmptyState icon={FileText} title="Sem lançamentos" subtitle="Essa conta ainda não tem movimentações." /> : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {ledger.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description || (t.type === 'transfer' ? 'Transferência' : t.type === 'income' ? 'Recebimento' : 'Pagamento')}</p>
                <p className="text-xs text-muted">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${t.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{t.delta >= 0 ? '+' : ''}{formatCurrency(t.delta)}</p>
              <p className="text-xs text-muted shrink-0 w-24 text-right">saldo {formatCurrency(t.running)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
