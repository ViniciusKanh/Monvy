import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, EmptyState } from '../ui';
import { formatCurrency } from '../../lib/utils.js';
import { PieChart as PieIcon, Info } from 'lucide-react';

const COLORS = ['#8b5cf6', '#2dd4bf', '#f59e0b', '#0ea5e9', '#ec4899', '#10b981', '#6366f1', '#f43f5e'];

// Donut da distribuição do saldo por conta. Contas com saldo zero ou negativo
// não entram na fatia (não dá pra desenhar uma fatia negativa), mas aparecem
// listadas abaixo com o valor real, para não escondê-las do usuário.
export function AccountsDistributionChart({ accounts }) {
  const positive = accounts.filter((a) => Number(a.current_balance) > 0).sort((a, b) => Number(b.current_balance) - Number(a.current_balance));
  const zeroOrNeg = accounts.filter((a) => Number(a.current_balance) <= 0);
  const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalPositive = positive.reduce((s, a) => s + Number(a.current_balance), 0) || 1;
  const data = positive.map((a, i) => ({ name: a.name, value: Number(a.current_balance), color: a.color || COLORS[i % COLORS.length] }));

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2"><PieIcon className="w-4 h-4 text-violet-500" /> Distribuição do saldo</h3>
        <span title="Percentual de cada conta sobre o saldo positivo. Contas zeradas ou negativas ficam fora do gráfico, listadas abaixo." className="text-muted hover:text-[hsl(var(--text))] cursor-help"><Info className="w-4 h-4" /></span>
      </div>
      {!data.length ? (
        <EmptyState icon={PieIcon} title="Sem saldo positivo" subtitle="Quando alguma conta tiver saldo positivo, a distribuição aparece aqui." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-5 items-center">
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="96%" paddingAngle={2} stroke="none" cornerRadius={4}>
                  {data.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-muted">Total</p>
              <p className="font-display text-base font-bold">{formatCurrency(total)}</p>
            </div>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {data.map((e, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} /><span className="truncate">{e.name}</span></span>
                <span className="font-medium whitespace-nowrap">{formatCurrency(e.value)}</span>
                <span className="text-muted text-right">{((e.value / totalPositive) * 100).toFixed(1).replace('.', ',')}%</span>
              </div>
            ))}
          </div>
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
