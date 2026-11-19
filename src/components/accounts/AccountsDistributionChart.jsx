import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';
import { PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];

// Donut da distribuição do saldo por conta. Contas com saldo zero ou negativo
// não entram na fatia (não dá pra desenhar uma fatia negativa), mas aparecem
// listadas na legenda com o valor real, para não escondê-las do usuário.
export function AccountsDistributionChart({ accounts }) {
  const positive = accounts.filter((a) => Number(a.current_balance) > 0);
  const zeroOrNeg = accounts.filter((a) => Number(a.current_balance) <= 0);
  const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalPositive = positive.reduce((s, a) => s + Number(a.current_balance), 0) || 1;
  const data = positive.map((a, i) => ({ name: a.name, value: Number(a.current_balance), color: a.color || COLORS[i % COLORS.length] }));

  return (
    <Card>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><PieIcon className="w-4 h-4 text-violet-500" /> Distribuição do saldo</h3>
      {!data.length ? (
        <EmptyState icon={PieIcon} title="Sem saldo positivo" subtitle="Quando alguma conta tiver saldo positivo, a distribuição aparece aqui." />
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                {data.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] text-muted">Consolidado</p>
            <p className="font-display text-base font-bold">{formatCurrency(total)}</p>
          </div>
        </div>
      )}
      {!!data.length && (
        <div className="mt-2 space-y-1.5">
          {data.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 truncate"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} /> {e.name}</span>
              <span className="text-muted shrink-0">{formatCurrency(e.value)} · {Math.round((e.value / totalPositive) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      {!!zeroOrNeg.length && (
        <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] space-y-1">
          {zeroOrNeg.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{a.name} <span className="opacity-70">(fora do gráfico — saldo {Number(a.current_balance) === 0 ? 'zero' : 'negativo'})</span></span>
              <span className={Number(a.current_balance) < 0 ? 'text-rose-500 font-medium' : ''}>{formatCurrency(a.current_balance)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
