import { useNavigate } from 'react-router-dom';
import { GitCompare } from 'lucide-react';
import { Card, Button } from '../ui';

export function AccountsReconciliationTab() {
  const navigate = useNavigate();
  return (
    <Card className="text-center py-10">
      <GitCompare className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
      <h3 className="font-semibold">Conciliação de contas</h3>
      <p className="text-sm text-muted mt-1 max-w-sm mx-auto">Compare o extrato importado do banco com seus lançamentos e feche as diferenças na tela de Conciliação.</p>
      <Button className="mt-4" onClick={() => navigate('/conciliacao')}><GitCompare className="w-4 h-4" /> Abrir Conciliação</Button>
    </Card>
  );
}
