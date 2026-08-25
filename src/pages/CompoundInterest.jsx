import { useMemo, useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Select, Field } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calculator, TrendingUp, PiggyBank, Coins } from 'lucide-react';

const LS = 'monvy_compound_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

export default function CompoundInterest() {
  const [f, setF] = useState(load() || { inicial: '1000', aporte: '300', taxa: '1', periodicidade: 'am', prazo: '120' });
  const set = (k, v) => setF((s) => { const nx = { ...s, [k]: v }; try { localStorage.setItem(LS, JSON.stringify(nx)); } catch { /* */ } return nx; });
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(f)); } catch { /* */ } }, [f]);

  const res = useMemo(() => {
    const iMes = f.periodicidade === 'aa' ? (Math.pow(1 + n(f.taxa) / 100, 1 / 12) - 1) : n(f.taxa) / 100;
    const meses = Math.max(0, Math.round(n(f.prazo)));
    let saldo = n(f.inicial); let investido = n(f.inicial);
    const serie = [{ mes: 0, saldo: Math.round(saldo), investido: Math.round(investido) }];
    for (let m = 1; m <= meses; m++) {
      saldo = saldo * (1 + iMes) + n(f.aporte);
      investido += n(f.aporte);
      if (m % Math.max(1, Math.round(meses / 60)) === 0 || m === meses) serie.push({ mes: m, saldo: Math.round(saldo), investido: Math.round(investido) });
    }
    return { iMes, meses, montante: saldo, investido, juros: Math.max(0, saldo - investido), serie };
  }, [f]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Calculator className="w-6 h-6 text-emerald-500" /> Juros Compostos</span>}
        subtitle="Simule quanto seu dinheiro rende ao longo do tempo com aportes mensais" />

      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Valor inicial (R$)"><Input type="number" value={f.inicial} onChange={(e) => set('inicial', e.target.value)} /></Field>
          <Field label="Aporte mensal (R$)"><Input type="number" value={f.aporte} onChange={(e) => set('aporte', e.target.value)} /></Field>
          <Field label="Taxa de juros (%)"><Input type="number" step="0.01" value={f.taxa} onChange={(e) => set('taxa', e.target.value)} /></Field>
          <Field label="Periodicidade"><Select value={f.periodicidade} onChange={(e) => set('periodicidade', e.target.value)}><option value="am">ao mês</option><option value="aa">ao ano</option></Select></Field>
          <Field label="Prazo (meses)"><Input type="number" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted mt-2">{n(f.taxa).toFixed(2)}% {f.periodicidade === 'aa' ? 'a.a.' : 'a.m.'} equivale a ~{(res.iMes * 100).toFixed(3)}% a.m. · {res.meses} meses (~{(res.meses / 12).toFixed(1)} anos)</p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Coins className="w-3 h-3 text-emerald-500" /> Montante final</p><p className="font-display text-2xl font-bold text-emerald-500"><AnimatedValue value={res.montante} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><PiggyBank className="w-3 h-3" /> Total investido</p><p className="font-display text-2xl font-bold"><AnimatedValue value={res.investido} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><TrendingUp className="w-3 h-3 text-indigo-500" /> Juros ganhos</p><p className="font-display text-2xl font-bold text-indigo-500"><AnimatedValue value={res.juros} format={formatCurrency} /></p></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Evolução do patrimônio</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={res.serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ciS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.03} /></linearGradient>
              <linearGradient id="ciI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
            <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(v, k) => [formatCurrency(v), k === 'saldo' ? 'Patrimônio' : 'Investido']} labelFormatter={(l) => `Mês ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            <Area dataKey="investido" stroke="#6366f1" strokeWidth={2} fill="url(#ciI)" />
            <Area dataKey="saldo" stroke="#10b981" strokeWidth={2.5} fill="url(#ciS)" />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted mt-2">Estimativa educativa (juros compostos com aportes no fim de cada mês). Não considera impostos, taxas ou inflação.</p>
      </Card>
    </div>
  );
}
