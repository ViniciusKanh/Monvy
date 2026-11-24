import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts';
import { formatCurrency } from '../../lib/utils.js';
import { buildBalanceSeries } from '../../lib/accountBalanceSeries.js';

// Serie do saldo consolidado (dados reais: saldo inicial + lancamentos; transferencias internas se cancelam)
export function useConsolidatedSeries(accounts, transactions, period) {
  return useMemo(() => {
    const initialTotal = accounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0);
    const nonTransfer = transactions.filter((t) => t.type !== 'transfer');
    return buildBalanceSeries({ transactions: nonTransfer, initialTotal, days: period });
  }, [accounts, transactions, period]);
}

const maxOf = (s) => Math.max(...s.map((p) => p.value));
const minOf = (s) => Math.min(...s.map((p) => p.value));

export function AccountsBalanceChart({ series, className = 'h-40' }) {
  if (!series?.length) return null;
  const last = series[series.length - 1];
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="accBalanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
            <filter id="accGlow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[(min) => min - Math.max(1, (maxOf(series) - min) * 0.15), (max) => max + Math.max(1, (max - minOf(series)) * 0.15)]} />
          <Tooltip
            formatter={(v) => formatCurrency(v)}
            labelFormatter={(d) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: '#0d1433', color: '#fff', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={3} fill="url(#accBalanceGrad)" filter="url(#accGlow)" />
          <ReferenceDot x={last.day} y={last.value} r={5} fill="#5eead4" stroke="#0d1433" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
