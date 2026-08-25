import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { GitCompare } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

export default function PriceSac() {
  const [valor, setValor] = useState('100000');
  const [taxa, setTaxa] = useState('1');
  const [prazo, setPrazo] = useState('120');

  const r = useMemo(() => {
    const P = n(valor), i = n(taxa) / 100, N = Math.max(1, Math.round(n(prazo)));
    const price = i === 0 ? P / N : (P * i) / (1 - Math.pow(1 + i, -N));
    const priceTotal = price * N;
    const amortSac = P / N;
    let saldo = P, sacTotal = 0; const serie = [];
    for (let k = 1; k <= N; k++) {
      const jSac = saldo * i; const pSac = amortSac + jSac; sacTotal += pSac; saldo -= amortSac;
      if (k === 1 || k === N || k % Math.max(1, Math.round(N / 40)) === 0) serie.push({ k, Price: Math.round(price), SAC: Math.round(pSac) });
    }
    return { N, price, priceTotal, priceJuros: priceTotal - P, sacFirst: amortSac + P * i, sacLast: amortSac + amortSac * i, sacTotal, sacJuros: sacTotal - P, serie };
  }, [valor, taxa, prazo]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><GitCompare className="w-6 h-6 text-emerald-500" /> Price × SAC</span>}
        subtitle="Compare os dois sistemas de amortização lado a lado" />
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Valor financiado (R$)"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
          <Field label="Juros (% a.m.)"><Input type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></Field>
          <Field label="Prazo (meses)"><Input type="number" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        {[['Price (parcela fixa)', '#6366f1', formatCurrency(r.price), formatCurrency(r.price), r.priceTotal, r.priceJuros],
          ['SAC (parcela decrescente)', '#10b981', formatCurrency(r.sacFirst), formatCurrency(r.sacLast), r.sacTotal, r.sacJuros]].map(([t, c, first, last, tot, jur], i) => (
          <Reveal key={t} i={i}><Card className="hover-lift h-full">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: c }}>{t}</h3>
            <div className="space-y-1.5 text-sm mt-3">
              <div className="flex justify-between"><span className="text-muted">1ª parcela</span><span className="font-semibold">{first}</span></div>
              <div className="flex justify-between"><span className="text-muted">Última parcela</span><span className="font-semibold">{last}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total pago</span><span className="font-semibold">{formatCurrency(tot)}</span></div>
              <div className="flex justify-between border-t border-[hsl(var(--border))] pt-1.5"><span className="text-muted">Juros totais</span><span className="font-bold text-rose-500">{formatCurrency(jur)}</span></div>
            </div>
          </Card></Reveal>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm">
        <GitCompare className="w-4 h-4 mt-0.5 shrink-0" /> O <b>SAC</b> paga {formatCurrency(Math.max(0, r.priceJuros - r.sacJuros))} a menos de juros, mas começa com parcelas mais altas. O <b>Price</b> tem parcela fixa, mais fácil de planejar.
      </div>
      <Card>
        <h3 className="font-semibold mb-2">Evolução da parcela</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={r.serie}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="k" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} /><YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => `Mês ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="Price" stroke="#6366f1" strokeWidth={2.5} dot={false} /><Line dataKey="SAC" stroke="#10b981" strokeWidth={2.5} dot={false} /></LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
