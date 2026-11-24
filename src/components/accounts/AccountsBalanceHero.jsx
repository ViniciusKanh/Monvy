import { Wallet, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedValue } from '../Animated.jsx';
import { formatCurrency } from '../../lib/utils.js';
import { AccountsBalanceChart, useConsolidatedSeries } from './AccountsBalanceChart.jsx';
import { AccountsQuickActions } from './AccountsQuickActions.jsx';

const PERIODS = [{ d: 7, l: '7d' }, { d: 30, l: '30d' }, { d: 90, l: '90d' }, { d: 365, l: '12m' }];
const periodText = (d) => (d === 365 ? 'nos últimos 12 meses' : `em relação aos últimos ${d} dias`);

export function AccountsBalanceHero({ accounts, transactions, total, period, onPeriodChange }) {
  const series = useConsolidatedSeries(accounts, transactions, period);
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const up = (pct ?? last - first) >= 0;

  return (
    <div className="relative overflow-hidden rounded-3xl text-white shadow-soft ring-1 ring-teal-400/30"
      style={{ background: 'linear-gradient(135deg,#071a2b 0%,#0a1630 45%,#0d1433 100%)' }}>
      <div className="absolute -top-24 right-10 w-[28rem] h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(45,212,191,.18), transparent 70%)' }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] gap-4 p-6 pb-3">
        <div className="min-w-0 self-center">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-teal-200" /></span>
            SALDO CONSOLIDADO
            <span title="Soma do saldo atual de todas as contas. Transferências entre suas próprias contas não alteram o total." className="text-slate-400 hover:text-white cursor-help"><Info className="w-3.5 h-3.5" /></span>
          </p>
          <p className="font-display text-[clamp(2.2rem,3.4vw,3.4rem)] leading-none font-extrabold tracking-tight mt-4 whitespace-nowrap"><AnimatedValue value={total} format={formatCurrency} /></p>
          <p className="text-sm text-slate-400 mt-2">{accounts.length} conta(s) ativa(s)</p>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ring-1 ${up ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-300 ring-rose-500/30'}`}>
              {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` : formatCurrency(last - first)}
            </span>
            <span className="text-xs text-slate-400">{periodText(period)}</span>
          </div>
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex justify-end">
            <div className="inline-flex p-1 rounded-xl bg-white/[0.06] ring-1 ring-white/10">
              {PERIODS.map((p) => (
                <button key={p.d} onClick={() => onPeriodChange(p.d)} aria-pressed={period === p.d}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${period === p.d ? 'bg-teal-400/20 text-teal-200 ring-1 ring-teal-300/40' : 'text-white/60 hover:text-white'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <AccountsBalanceChart series={series} className="h-36 sm:h-40 mt-1" />
        </div>
      </div>

      <div className="relative px-6 pb-6">
        <AccountsQuickActions />
      </div>
    </div>
  );
}
