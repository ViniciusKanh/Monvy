import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Select, Field } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { CalendarDays, Flame, TrendingUp } from 'lucide-react';

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function SpendHeatmap() {
  const [meses, setMeses] = useState('6');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const { grids, max, total, maiorDia, mediaDia, diasComGasto } = useMemo(() => {
    const tx = combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense');
    const byDay = {};
    for (const t of tx) { const d = String(t.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + Number(t.amount || 0); }
    const now = new Date(); const nMonths = Number(meses);
    const grids = [];
    let max = 0, total = 0, maiorDia = { d: null, v: 0 }, diasComGasto = 0;
    for (let m = nMonths - 1; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const y = dt.getFullYear(), mon = dt.getMonth();
      const first = new Date(y, mon, 1).getDay();
      const days = new Date(y, mon + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i++) cells.push(null);
      for (let d = 1; d <= days; d++) {
        const key = `${y}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const v = byDay[key] || 0;
        if (v > max) max = v; if (v > 0) { total += v; diasComGasto++; }
        if (v > maiorDia.v) maiorDia = { d: key, v };
        cells.push({ d, v, key });
      }
      grids.push({ label: `${MES[mon]}/${String(y).slice(2)}`, cells });
    }
    return { grids, max, total, maiorDia, mediaDia: diasComGasto ? total / diasComGasto : 0, diasComGasto };
  }, [transactions, cardTxs, meses]);

  const color = (v) => {
    if (!v) return 'hsl(var(--muted)/0.12)';
    const r = Math.min(1, v / (max || 1));
    if (r < 0.15) return 'rgba(16,185,129,0.35)';
    if (r < 0.35) return 'rgba(234,179,8,0.5)';
    if (r < 0.6) return 'rgba(249,115,22,0.65)';
    return 'rgba(244,63,94,0.85)';
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><CalendarDays className="w-6 h-6 text-orange-500" /> Calendário de Calor</span>}
        subtitle="Veja em quais dias você mais gasta — calculado 100% no seu dispositivo" />

      <Card><Field label="Período"><Select value={meses} onChange={(e) => setMeses(e.target.value)} className="max-w-xs">
        <option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option>
      </Select></Field></Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Total no período</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={total} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Média por dia com gasto</p><p className="font-display text-2xl font-bold"><AnimatedValue value={mediaDia} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Flame className="w-3 h-3 text-rose-500" /> Dia mais caro</p><p className="font-display text-xl font-bold">{formatCurrency(maiorDia.v)}</p><p className="text-[10px] text-muted">{maiorDia.d ? maiorDia.d.split('-').reverse().join('/') : '—'}</p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Dias com gasto</p><p className="font-display text-2xl font-bold">{diasComGasto}</p></Card></Reveal>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {grids.map((g, gi) => (
          <Reveal key={g.label} i={gi}><Card className="hover-lift">
            <h3 className="font-semibold text-sm mb-2">{g.label}</h3>
            <div className="grid grid-cols-7 gap-1 mb-1">{WD.map((w, i) => <div key={i} className="text-[9px] text-center text-muted">{w}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {g.cells.map((c, i) => c === null ? <div key={i} /> : (
                <div key={i} title={`${c.key.split('-').reverse().join('/')}: ${formatCurrency(c.v)}`}
                  className="aspect-square rounded-[4px] flex items-center justify-center text-[8px] font-medium cursor-default"
                  style={{ background: color(c.v), color: c.v > (max * 0.35) ? '#fff' : 'hsl(var(--muted))' }}>{c.d}</div>
              ))}
            </div>
          </Card></Reveal>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted justify-end">
        Menos <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: 'hsl(var(--muted)/0.12)' }} />
        <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: 'rgba(16,185,129,0.35)' }} />
        <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: 'rgba(234,179,8,0.5)' }} />
        <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: 'rgba(249,115,22,0.65)' }} />
        <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: 'rgba(244,63,94,0.85)' }} /> Mais
      </div>
    </div>
  );
}
