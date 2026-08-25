import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Spinner, EmptyState, Badge, Button } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { Landmark, Snowflake, TrendingDown, Clock, Coins } from 'lucide-react';

const num = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

function simulate(debts, strategy, extra) {
  let list = debts.map((d) => ({ name: d.name, balance: d.balance, rate: d.rate / 100, parcela: d.parcela }));
  list = list.filter((d) => d.balance > 0.5);
  if (!list.length) return { months: 0, totalPaid: 0, totalInterest: 0, order: [] };
  const order = [...list].sort((a, b) => strategy === 'avalanche' ? (b.rate - a.rate) : (a.balance - b.balance)).map((d) => d.name);
  const budget = list.reduce((s, d) => s + d.parcela, 0) + num(extra);
  let months = 0, totalPaid = 0, totalInterest = 0;
  const byName = Object.fromEntries(list.map((d) => [d.name, d]));
  while (list.some((d) => d.balance > 0.5) && months < 600) {
    months++;
    for (const d of list) { if (d.balance > 0.5) { const j = d.balance * d.rate; d.balance += j; totalInterest += j; } }
    let avail = budget;
    for (const nm of order) { const d = byName[nm]; if (!d || d.balance <= 0.5) continue; const pay = Math.min(d.balance, avail); d.balance -= pay; avail -= pay; totalPaid += pay; if (avail <= 0.01) break; }
  }
  return { months, totalPaid, totalInterest, order, quita: !list.some((d) => d.balance > 0.5) };
}

export default function DebtPayoff() {
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const [strategy, setStrategy] = useState('avalanche');
  const [extra, setExtra] = useState('');

  const parsed = useMemo(() => debts.map((d) => {
    const n = num(d.installments); const paid = num(d.paid_installments); const remaining = Math.max(0, n - paid);
    const inst = num(d.installment_amount);
    const rate = num(d.interest_rate);
    const i = rate / 100;
    const balance = i > 0 ? inst * (1 - Math.pow(1 + i, -remaining)) / i : inst * remaining;
    return { name: d.name, rate, parcela: inst, balance, remaining };
  }).filter((d) => d.balance > 0.5), [debts]);

  const chosen = useMemo(() => simulate(parsed, strategy, extra), [parsed, strategy, extra]);
  const other = useMemo(() => simulate(parsed, strategy === 'avalanche' ? 'snowball' : 'avalanche', extra), [parsed, strategy, extra]);
  const totalDivida = parsed.reduce((s, d) => s + d.balance, 0);
  const economia = other.totalInterest - chosen.totalInterest;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><TrendingDown className="w-6 h-6 text-rose-500" /> Estratégia de Quitação</span>}
        subtitle="Descubra a melhor ordem para quitar suas dívidas e em quanto tempo fica livre" />

      {parsed.length === 0 ? <Card><EmptyState icon={Landmark} title="Sem dívidas em aberto" subtitle="Você não tem dívidas cadastradas para planejar a quitação. 🎉" /></Card> : (<>
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="text-sm font-medium">Estratégia</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button onClick={() => setStrategy('avalanche')} className={`p-3 rounded-xl border text-left transition ${strategy === 'avalanche' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[hsl(var(--border))]'}`}>
                  <p className="font-semibold text-sm flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-emerald-500" /> Avalanche</p>
                  <p className="text-[11px] text-muted">Quita a de maior juro primeiro. Paga menos juros.</p>
                </button>
                <button onClick={() => setStrategy('snowball')} className={`p-3 rounded-xl border text-left transition ${strategy === 'snowball' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[hsl(var(--border))]'}`}>
                  <p className="font-semibold text-sm flex items-center gap-1.5"><Snowflake className="w-4 h-4 text-sky-500" /> Bola de neve</p>
                  <p className="text-[11px] text-muted">Quita a menor primeiro. Motiva com vitórias rápidas.</p>
                </button>
              </div>
            </div>
            <Field label="Pagamento extra por mês (R$)"><Input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0,00" /></Field>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Dívida total</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={totalDivida} format={formatCurrency} /></p></Card></Reveal>
          <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo p/ quitar</p><p className="font-display text-xl font-bold">{chosen.quita ? `${chosen.months} meses` : '—'}</p></Card></Reveal>
          <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" /> Juros totais</p><p className="font-display text-xl font-bold text-amber-500"><AnimatedValue value={chosen.totalInterest} format={formatCurrency} /></p></Card></Reveal>
          <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Total pago</p><p className="font-display text-xl font-bold"><AnimatedValue value={chosen.totalPaid} format={formatCurrency} /></p></Card></Reveal>
        </div>

        {economia > 1 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm">
            <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" /> A estratégia <b>{strategy === 'avalanche' ? 'Avalanche' : 'Bola de neve'}</b> economiza cerca de <b>{formatCurrency(Math.abs(economia))}</b> em juros comparada à outra. Boa escolha!
          </div>
        )}

        <Card>
          <h3 className="font-semibold mb-3">Ordem sugerida de quitação</h3>
          <div className="space-y-2">
            {chosen.order.map((nm, i) => { const d = parsed.find((x) => x.name === nm); return (
              <div key={nm} className="flex items-center gap-3 py-1">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{d?.name}</p><p className="text-xs text-muted">saldo {formatCurrency(d?.balance || 0)} · {Number(d?.rate).toFixed(2)}% a.m. · parcela {formatCurrency(d?.parcela || 0)}</p></div>
                {i === 0 && <Badge color="emerald">foco agora</Badge>}
              </div>
            ); })}
          </div>
          <p className="text-xs text-muted mt-3">Ideia: pague a parcela de todas as dívidas e jogue o valor extra na dívida em foco. Quando ela quitar, some a parcela dela à próxima (efeito bola de neve). Estimativa educativa.</p>
        </Card>
      </>)}
    </div>
  );
}
