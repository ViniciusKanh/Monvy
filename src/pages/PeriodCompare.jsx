import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Select, Spinner } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { GitCompare, ArrowUp, ArrowDown } from 'lucide-react';

const num = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const arrow = (d) => d > 0 ? <ArrowUp className="w-3 h-3 inline" /> : d < 0 ? <ArrowDown className="w-3 h-3 inline" /> : null;

export default function PeriodCompare() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);

  const months = useMemo(() => {
    const now = new Date(); const arr = [];
    for (let k = 0; k < 12; k++) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); arr.push(d.toISOString().slice(0, 7)); }
    return arr;
  }, []);
  const [a, setA] = useState(months[0]);
  const [b, setB] = useState(months[1] || months[0]);

  const calc = (mk) => {
    const t = tx.filter((x) => String(x.date).slice(0, 7) === mk);
    const inc = t.filter((x) => x.type === 'income').reduce((s, x) => s + num(x.amount), 0);
    const exp = t.filter((x) => x.type === 'expense').reduce((s, x) => s + num(x.amount), 0);
    const cats = {};
    for (const x of t) if (x.type === 'expense') { const nm = catMap[x.category_id]?.name || 'Sem categoria'; cats[nm] = (cats[nm] || 0) + num(x.amount); }
    return { inc, exp, saldo: inc - exp, cats };
  };
  const A = useMemo(() => calc(a), [a, tx, catMap]);
  const B = useMemo(() => calc(b), [b, tx, catMap]);

  const chart = [
    { name: 'Receitas', [a]: Math.round(A.inc), [b]: Math.round(B.inc) },
    { name: 'Despesas', [a]: Math.round(A.exp), [b]: Math.round(B.exp) },
    { name: 'Saldo', [a]: Math.round(A.saldo), [b]: Math.round(B.saldo) },
  ];
  const catDeltas = useMemo(() => {
    const names = new Set([...Object.keys(A.cats), ...Object.keys(B.cats)]);
    return [...names].map((n) => ({ name: n, a: A.cats[n] || 0, b: B.cats[n] || 0, delta: (A.cats[n] || 0) - (B.cats[n] || 0) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 8);
  }, [A, B]);

  const Stat = ({ label, va, vb }) => { const d = va - vb; const p = vb !== 0 ? d / Math.abs(vb) : 0; return (
    <Card className="py-4"><p className="text-xs text-muted">{label}</p><p className="font-display text-lg font-bold">{formatCurrency(va)}</p><p className={`text-xs ${d >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{arrow(d)} {formatCurrency(Math.abs(d))} {vb !== 0 ? `(${(Math.abs(p) * 100).toFixed(0)}%)` : ''} vs {monthLabel(b).split(' ')[0]}</p></Card>
  ); };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><GitCompare className="w-6 h-6 text-indigo-500" /> Comparador de Períodos</span>}
        subtitle="Compare dois meses lado a lado: receitas, despesas e categorias" />

      <AiInsight storageKey="compare" title="O que mudou (IA)" agentFocus="comparação de períodos"
        prompt="Compare meus dois últimos meses. Em até 3 frases, explique o que mais mudou (categorias que subiram ou caíram) e o provável motivo." />

      <Card className="py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={a} onChange={(e) => setA(e.target.value)} className="w-auto">{months.map((m) => <option key={m} value={m} className="capitalize">{monthLabel(m)}</option>)}</Select>
          <span className="text-muted text-sm">vs</span>
          <Select value={b} onChange={(e) => setB(e.target.value)} className="w-auto">{months.map((m) => <option key={m} value={m} className="capitalize">{monthLabel(m)}</option>)}</Select>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Reveal i={0}><Stat label="Receitas" va={A.inc} vb={B.inc} /></Reveal>
        <Reveal i={1}><Stat label="Despesas" va={A.exp} vb={B.exp} /></Reveal>
        <Reveal i={2}><Stat label="Saldo" va={A.saldo} vb={B.saldo} /></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Comparativo</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart} barGap={6}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={48} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey={a} fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={40} /><Bar dataKey={b} fill="#94a3b8" radius={[5, 5, 0, 0]} maxBarSize={40} /></BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Variação por categoria (despesas)</h3>
        {catDeltas.length === 0 ? <p className="text-sm text-muted">Sem despesas nos períodos escolhidos.</p>
          : <div className="divide-y divide-[hsl(var(--border))]">
            {catDeltas.map((c) => (
              <div key={c.name} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 min-w-0 truncate">{c.name}</span>
                <span className="text-muted w-24 text-right">{formatCurrency(c.a)}</span>
                <span className={`w-28 text-right font-semibold ${c.delta > 0 ? 'text-rose-500' : c.delta < 0 ? 'text-emerald-500' : 'text-muted'}`}>{arrow(c.delta)} {formatCurrency(Math.abs(c.delta))}</span>
              </div>
            ))}
          </div>}
      </Card>
    </div>
  );
}
