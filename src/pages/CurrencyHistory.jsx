import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

const MOEDAS = [
  { code: 'USD', name: 'Dólar', flag: '🇺🇸' }, { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Libra', flag: '🇬🇧' }, { code: 'ARS', name: 'Peso arg.', flag: '🇦🇷' },
  { code: 'BTC', name: 'Bitcoin', flag: '₿' }, { code: 'JPY', name: 'Iene', flag: '🇯🇵' },
];

async function fetchHist(code) {
  const r = await fetch(`https://economia.awesomeapi.com.br/json/daily/${code}-BRL/90`);
  if (!r.ok) throw new Error('Falha');
  const j = await r.json();
  return j.map((d) => ({ t: Number(d.timestamp), bid: Number(d.bid), label: new Date(Number(d.timestamp) * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })).sort((a, b) => a.t - b.t);
}

export default function CurrencyHistory() {
  const [code, setCode] = useState('USD');
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['fx-hist', code], queryFn: () => fetchHist(code), retry: 1, staleTime: 3600_000 });

  const atual = data.length ? data[data.length - 1].bid : 0;
  const inicio = data.length ? data[0].bid : 0;
  const varPct = inicio ? ((atual - inicio) / inicio) * 100 : 0;
  const max = data.reduce((m, d) => Math.max(m, d.bid), 0);
  const min = data.reduce((m, d) => (m === 0 ? d.bid : Math.min(m, d.bid)), 0);
  const up = varPct >= 0;
  const cur = MOEDAS.find((m) => m.code === code);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><ArrowRightLeft className="w-6 h-6 text-indigo-500" /> Câmbio com Histórico</span>}
        subtitle="Cotação e variação dos últimos 90 dias" />

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {MOEDAS.map((m) => (
          <button key={m.code} onClick={() => setCode(m.code)} className={`p-3 rounded-xl border-2 text-center transition hover-lift ${code === m.code ? 'border-indigo-500 bg-indigo-500/10' : 'border-[hsl(var(--border))]'}`}>
            <div className="text-xl">{m.flag}</div><p className="font-semibold text-sm mt-1">{m.code}</p><p className="text-[10px] text-muted">{m.name}</p>
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>
        : isError ? <Card className="py-8 text-center text-sm text-muted"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />Não foi possível carregar o histórico.</Card>
        : <>
          <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#1e1b4b,#4338ca)' }}>
            <p className="text-sm opacity-90">{cur?.flag} 1 {code} hoje</p>
            <p className="font-display text-4xl font-extrabold mt-1">{formatCurrency(atual)}</p>
            <p className="text-sm opacity-95 mt-1 flex items-center gap-1">{up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}% em 90 dias</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Mínima (90d)</p><p className="font-display text-lg font-bold text-emerald-500">{formatCurrency(min)}</p></Card></Reveal>
            <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Máxima (90d)</p><p className="font-display text-lg font-bold text-rose-500">{formatCurrency(max)}</p></Card></Reveal>
            <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Início do período</p><p className="font-display text-lg font-bold">{formatCurrency(inicio)}</p></Card></Reveal>
          </div>

          <Card>
            <h3 className="font-semibold mb-2">{code}/BRL · 90 dias</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}><defs><linearGradient id="gFx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis width={56} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area dataKey="bid" stroke="#6366f1" strokeWidth={2.5} fill="url(#gFx)" /></AreaChart>
            </ResponsiveContainer>
          </Card>
          <p className="text-xs text-muted text-center">Fonte: AwesomeAPI · valores de referência</p>
        </>}
    </div>
  );
}
