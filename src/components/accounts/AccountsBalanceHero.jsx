import { Wallet } from 'lucide-react';
import { AnimatedValue } from '../Animated.jsx';
import { formatCurrency } from '../../lib/utils.js';
import { AccountsBalanceChart } from './AccountsBalanceChart.jsx';
import { AccountsQuickActions } from './AccountsQuickActions.jsx';

const PERIODS = [7, 30, 90];

export function AccountsBalanceHero({ accounts, transactions, total, period, onPeriodChange }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-soft ring-1 ring-white/10"
      style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,.28), transparent 68%)' }} />
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="sheen" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] text-emerald-300/80 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center"><Wallet className="w-4 h-4" /></span>
            SALDO CONSOLIDADO
          </p>
          <p className="font-display text-3xl sm:text-5xl font-extrabold mt-2"><AnimatedValue value={total} format={formatCurrency} /></p>
          <p className="text-xs text-slate-400 mt-1">{accounts.length} conta(s) ativa(s)</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-white/10 self-start">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => onPeriodChange(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${period === p ? 'bg-white text-[#0d1433]' : 'text-white/70 hover:text-white'}`}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-2">
        <AccountsBalanceChart accounts={accounts} transactions={transactions} period={period} />
      </div>

      <div className="relative mt-4">
        <AccountsQuickActions />
      </div>
    </div>
  );
}
