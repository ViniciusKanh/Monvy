import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { formatCurrency } from '../../lib/utils.js';
import { buildBalanceSeries } from '../../lib/accountBalanceSeries.js';

export function AccountsBalanceChart({ accounts, transactions, period }) {
  const series = useMemo(() => {
    const initialTotal = accounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0);
    const nonTransfer = transactions.filter((t) => t.type !== 'transfer');
    return buildBalanceSeries({ transactions: nonTransfer, initialTotal, days: period });
  }, [accounts, transactions, period]);

  if (!accounts.length) return null;

  return (
    <div className="h-36 sm:h-44 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="accBalanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            formatter={(v) => formatCurrency(v)}
            labelFormatter={(d) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: '#0d1433', color: '#fff' }}
          />
          <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#accBalanceGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
