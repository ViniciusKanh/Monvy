import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, GitCompare } from 'lucide-react';

const ACTIONS = [
  { key: 'transfer', label: 'Transferir', icon: ArrowLeftRight, path: '/lancamentos?novo=transfer' },
  { key: 'pay', label: 'Pagar', icon: ArrowUpFromLine, path: '/pagamentos' },
  { key: 'receive', label: 'Receber', icon: ArrowDownToLine, path: '/pagamentos' },
  { key: 'reconcile', label: 'Conciliar', icon: GitCompare, path: '/conciliacao' },
];

export function AccountsQuickActions() {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {ACTIONS.map((a) => (
        <button key={a.key} onClick={() => navigate(a.path)}
          className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2.5 text-sm font-medium text-white transition">
          <a.icon className="w-4 h-4" /> {a.label}
        </button>
      ))}
    </div>
  );
}
