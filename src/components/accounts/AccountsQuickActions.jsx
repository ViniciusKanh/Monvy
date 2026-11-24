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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {ACTIONS.map((a) => (
        <button key={a.key} onClick={() => navigate(a.path)}
          className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 hover:border-teal-300/40 px-5 py-3 text-[15px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60">
          <a.icon className="w-5 h-5 text-slate-200" /> {a.label}
        </button>
      ))}
    </div>
  );
}
