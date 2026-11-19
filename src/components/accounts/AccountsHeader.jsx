import { Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../PageHeader.jsx';
import { Button } from '../ui';

export function AccountsHeader({ onSync, syncing, onNew }) {
  return (
    <PageHeader title="Contas" subtitle="Seu dinheiro em cada conta e carteira"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSync} disabled={syncing} title="Atualiza saldos e lançamentos">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar
          </Button>
          <Button onClick={onNew}><Plus className="w-4 h-4" /> Nova conta</Button>
        </div>
      } />
  );
}
