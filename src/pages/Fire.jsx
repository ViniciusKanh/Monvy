import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Investment, Transaction, Account, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Spinner, Badge } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries, combineExpenses } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Flame, TrendingUp, Target, PiggyBank, Wallet, Info } from 'lucide-react';

export default function Fire() {
  const { data: investments = [], isLoading } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const investTotal = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
  const accTotal = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const active = useMemo(() => monthlySeries(tx, lastMonths(6)).filter((s) => s.inc > 0 || s.exp > 0), [tx]);
  const avgInc = active.length ? active.reduce((a, s) => a + s.inc, 0) / active.length : 0;
  const avgExp = active.length ? active.reduce((a, s) => a + s.exp, 0) / active.length : 0;
  const surplus = Math.max(0, avgInc - avgExp);

  const [patrimonio, setPatrimonio] = useState('');
  const [aporte, setAporte] = useState('');
  const [gastoMensal, setGastoMensal] = useState('');
  const [retorno, setRetorno] = useState('4');
  const [multiplo, setMultiplo] = useState('25');
  useEffect(() => { if (patrimonio === '') setPatrimonio(String(Math.round(investTotal + accTotal))); }, [investTotal, accTotal]);
  useEffect(() => { if (aporte === '') setAporte(String(Math.round(surplus))); }, [surplus]);
  useEffect(() => { if (gastoMensal === '') setGastoMensal(String(Math.round(avgExp))); }, [avgExp]);

  const n = (v) => Number(String(v).replace(',', '.')) || 0;
  const plan = useMemo(() => {
    const p0 = n(patrimonio), ap = n(aporte), exp = n(gastoMensal) * 12, mult = n(multiplo) || 25;
    const target = exp * mult;
    const rm = Math.pow(1 + n(retorno) / 100, 1 / 12) - 1;
    let bal = p0, m = 0; const maxM = 80 * 12; const yearly = [{ year: 0, saldo: Math.round(bal) }];
    while (bal < target && m < maxM) { bal = bal * (1 + rm) + ap; m++; if (m % 12 === 0) yearly.push({ year: m / 12, saldo: Math.round(bal) }); }
    if (m % 12 !== 0) yearly.push({ year: +(m / 12).toFixed(1), saldo: Math.round(bal) });
    const reached = bal >= target && target > 0;
    return { target, months: m, years: Math.floor(m / 12), rem: m % 12, reached, yearly: yearly.slice(0, 45), monthlyIncomeAtFI: (target * (n(retorno) / 100)) / 12 };
  }, [patrimonio, aporte, gastoMensal, retorno, multiplo]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Flame className="w-6 h-6 text-orange-500" /> Independência Financeira (FIRE)</span>}
        subtitle="Descubra quando seu patrimonio pode sustentar seu estilo de vida" />

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Ideia da regra dos 4% (multiplo 25x): quando seu patrimonio investido chega a ~25x seu gasto anual, os rendimentos tendem a cobrir suas despesas para sempre. Isto e uma <b>estimativa</b> com base nos numeros que você informar — não e garantia nem recomendacao de investimento.</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="hover-lift">
          <h3 className="font-semibold mb-3">Seus numeros</h3>
          <div className="space-y-3">
            <Field label="Patrimonio atual (R$)" hint="contas + investimentos"><Input type="number" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} /></Field>
            <Field label="Aporte mensal (R$)" hint={`sua sobra media: ${formatCurrency(surplus)}`}><Input type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} /></Field>
            <Field label="Gasto mensal (R$)" hint="quanto você gasta por mês"><Input type="number" value={gastoMensal} onChange={(e) => setGastoMensal(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Retorno real (% a.a.)" hint="acima da inflacao"><Input type="number" step="0.1" value={retorno} onChange={(e) => setRetorno(e.target.value)} /></Field>
              <Field label="Multiplo (x gasto anual)"><Input type="number" value={multiplo} onChange={(e) => setMultiplo(e.target.value)} /></Field>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(135deg,#7c2d12 0%,#b45309 50%,#f59e0b 100%)' }}>
            <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.25), transparent 70%)' }} />
            <div className="relative">
              <p className="text-[11px] tracking-[0.28em] text-amber-100 font-medium flex items-center gap-1"><Target className="w-3.5 h-3.5" /> NUMERO DA LIBERDADE</p>
              <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={plan.target} format={formatCurrency} /></p>
              <p className="text-amber-50 text-sm mt-1">{n(multiplo) || 25}x seu gasto anual ({formatCurrency(n(gastoMensal) * 12)}). Rende ~{formatCurrency(plan.monthlyIncomeAtFI)}/mês.</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
                <Flame className="w-5 h-5" />
                {plan.reached ? <span className="font-bold text-lg">Você atinge em {plan.years} ano(s){plan.rem ? ` e ${plan.rem} mes(es)` : ''}</span>
                  : <span className="font-semibold">Com estes numeros, o alvo não e atingido em 80 anos — aumente o aporte ou o retorno.</span>}
              </div>
            </div>
          </div>

          <Card className="hover-lift">
            <h3 className="font-semibold mb-2">Projeção do patrimonio</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={plan.yearly}>
                <defs><linearGradient id="fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}a`} />
                <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'patrimonio']} labelFormatter={(l) => `Ano ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <ReferenceLine y={plan.target} stroke="#10b981" strokeDasharray="5 4" label={{ value: 'meta', fontSize: 10, fill: '#10b981', position: 'insideTopRight' }} />
                <Area dataKey="saldo" stroke="#f59e0b" strokeWidth={2.5} fill="url(#fire)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
