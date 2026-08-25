import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Select, Field, EmptyState } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart, Wallet } from 'lucide-react';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#eab308'];

function monthsBack(k) {
  const out = []; const now = new Date();
  for (let i = 0; i < k; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

export default function MoneyMap() {
  const [periodo, setPeriodo] = useState('3');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const { data, total } = useMemo(() => {
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const tx = combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense');
    const allow = periodo === 'all' ? null : new Set(monthsBack(Number(periodo)));
    const map = {};
    for (const t of tx) {
      if (allow && !allow.has(String(t.date).slice(0, 7))) continue;
      const c = catMap[t.category_id];
      const name = c?.name || 'Sem categoria';
      map[name] = map[name] || { name, size: 0, color: c?.color };
      map[name].size += Number(t.amount || 0);
    }
    const arr = Object.values(map).sort((a, b) => b.size - a.size).map((c, i) => ({ ...c, size: Math.round(c.size), color: c.color || PALETTE[i % PALETTE.length] }));
    return { data: arr, total: arr.reduce((s, c) => s + c.size, 0) };
  }, [transactions, categories, cardTxs, periodo]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const Node = (props) => {
    const { x, y, width, height, name, color, size } = props;
    if (width < 2 || height < 2) return null;
    const show = width > 54 && height > 30;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={6} style={{ fill: color, stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
        {show && <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={600}>{name}</text>}
        {show && height > 46 && <text x={x + 8} y={y + 37} fill="#fff" fontSize={11} opacity={0.85}>{total ? Math.round((size / total) * 100) : 0}%</text>}
      </g>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><PieChart className="w-6 h-6 text-indigo-500" /> Para Onde Vai Meu Dinheiro</span>}
        subtitle="Mapa das suas despesas por categoria — quanto maior o bloco, maior o gasto" />

      <Card><Field label="Período"><Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="max-w-xs">
        <option value="1">Este mês</option><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option><option value="all">Tudo</option>
      </Select></Field></Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#4338ca,#7c3aed)' }}>
        <p className="text-sm opacity-90 flex items-center gap-1"><Wallet className="w-4 h-4" /> Total gasto no período</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={total} format={formatCurrency} /></p>
      </div>

      {data.length === 0 ? <Card><EmptyState icon={PieChart} title="Sem despesas no período" subtitle="Lance algumas despesas para ver o mapa." /></Card> : (
        <Card>
          <ResponsiveContainer width="100%" height={380}>
            <Treemap data={data} dataKey="size" content={<Node />} isAnimationActive>
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--fg))' }} />
            </Treemap>
          </ResponsiveContainer>
        </Card>
      )}

      {data.length > 0 && <Card>
        <h3 className="font-semibold mb-3">Ranking de categorias</h3>
        <div className="divide-y divide-[hsl(var(--border))]">
          {data.map((c, i) => (
            <Reveal key={c.name} i={i}><div className="flex items-center gap-3 py-2.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{c.name}</p>
                <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${total ? (c.size / total) * 100 : 0}%`, background: c.color }} /></div>
              </div>
              <div className="text-right"><p className="font-semibold">{formatCurrency(c.size)}</p><p className="text-xs text-muted">{total ? Math.round((c.size / total) * 100) : 0}%</p></div>
            </div></Reveal>
          ))}
        </div>
      </Card>}
    </div>
  );
}
