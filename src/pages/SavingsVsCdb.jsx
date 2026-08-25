import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { PiggyBank, Landmark, Trophy } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
const SGS = (c) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${c}/dados/ultimos/1?formato=json`;

function irAliquota(dias) {
  if (dias <= 180) return 0.225; if (dias <= 360) return 0.20; if (dias <= 720) return 0.175; return 0.15;
}

export default function SavingsVsCdb() {
  const [valor, setValor] = useState('10000');
  const [meses, setMeses] = useState('24');
  const [cdi, setCdi] = useState('15');
  const [selic, setSelic] = useState('15');
  const [pctCdi, setPctCdi] = useState('100');

  const { data } = useQuery({
    queryKey: ['scdb-rates'], staleTime: 3600_000, retry: 1,
    queryFn: async () => {
      const [s, c] = await Promise.all([fetch(SGS(432)).then((r) => r.json()), fetch(SGS(4389)).then((r) => r.json())]);
      return { selic: Number(s?.[0]?.valor), cdi: Number(c?.[0]?.valor) };
    },
  });
  useEffect(() => { if (data?.selic) setSelic(String(data.selic)); if (data?.cdi) setCdi(String(data.cdi)); }, [data]);

  const r = useMemo(() => {
    const P = n(valor), M = Math.max(1, Math.round(n(meses)));
    const cdiAA = n(cdi), selicAA = n(selic), fator = n(pctCdi) / 100;
    // poupança mensal
    const poupMes = selicAA > 8.5 ? 0.005 : (Math.pow(1 + selicAA * 0.7 / 100, 1 / 12) - 1);
    // cdb mensal
    const cdbMes = Math.pow(1 + cdiAA * fator / 100, 1 / 12) - 1;
    const serie = []; let poup = P, cdbBruto = P;
    for (let k = 1; k <= M; k++) {
      poup *= (1 + poupMes); cdbBruto *= (1 + cdbMes);
      if (k === 1 || k === M || k % Math.max(1, Math.round(M / 40)) === 0) {
        const ir = irAliquota(k * 30); const cdbLiq = P + (cdbBruto - P) * (1 - ir);
        serie.push({ k, Poupança: Math.round(poup), CDB: Math.round(cdbLiq) });
      }
    }
    const ir = irAliquota(M * 30);
    const cdbLiq = P + (cdbBruto - P) * (1 - ir);
    return { poup, cdbBruto, cdbLiq, ir, ganhoPoup: poup - P, ganhoCdb: cdbLiq - P, serie, vencedor: cdbLiq >= poup ? 'CDB' : 'Poupança', dif: Math.abs(cdbLiq - poup) };
  }, [valor, meses, cdi, selic, pctCdi]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><PiggyBank className="w-6 h-6 text-emerald-500" /> Poupança × CDB</span>}
        subtitle="Compare o rendimento líquido (já com IR) de um CDB contra a poupança" />

      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Valor (R$)"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
          <Field label="Prazo (meses)"><Input type="number" value={meses} onChange={(e) => setMeses(e.target.value)} /></Field>
          <Field label="CDI (% a.a.)"><Input type="number" step="0.01" value={cdi} onChange={(e) => setCdi(e.target.value)} /></Field>
          <Field label="Selic (% a.a.)"><Input type="number" step="0.01" value={selic} onChange={(e) => setSelic(e.target.value)} /></Field>
          <Field label="CDB (% do CDI)"><Input type="number" value={pctCdi} onChange={(e) => setPctCdi(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted mt-2">CDI e Selic preenchidos automaticamente pelo Banco Central. Poupança é isenta de IR; o CDB paga IR regressivo ({(r.ir * 100).toFixed(1)}% neste prazo).</p>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg flex items-center gap-4" style={{ background: r.vencedor === 'CDB' ? 'linear-gradient(135deg,#059669,#4338ca)' : 'linear-gradient(135deg,#0891b2,#059669)' }}>
        <Trophy className="w-10 h-10 shrink-0" />
        <div><p className="text-sm opacity-90">Melhor opção neste cenário</p><p className="font-display text-3xl font-extrabold">{r.vencedor}</p>
          <p className="text-sm opacity-90 mt-0.5">rende {formatCurrency(r.dif)} a mais no fim do período</p></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Reveal i={0}><Card className="hover-lift"><h3 className="font-semibold flex items-center gap-2 text-cyan-600"><PiggyBank className="w-4 h-4" /> Poupança</h3>
          <p className="font-display text-2xl font-bold mt-2"><AnimatedValue value={r.poup} format={formatCurrency} /></p>
          <div className="text-sm mt-2 space-y-1"><div className="flex justify-between"><span className="text-muted">Rendimento</span><span className="font-semibold text-emerald-500">+{formatCurrency(r.ganhoPoup)}</span></div><div className="flex justify-between"><span className="text-muted">IR</span><Badge color="emerald">Isento</Badge></div></div></Card></Reveal>
        <Reveal i={1}><Card className="hover-lift"><h3 className="font-semibold flex items-center gap-2 text-indigo-600"><Landmark className="w-4 h-4" /> CDB (líquido)</h3>
          <p className="font-display text-2xl font-bold mt-2"><AnimatedValue value={r.cdbLiq} format={formatCurrency} /></p>
          <div className="text-sm mt-2 space-y-1"><div className="flex justify-between"><span className="text-muted">Rendimento líquido</span><span className="font-semibold text-emerald-500">+{formatCurrency(r.ganhoCdb)}</span></div><div className="flex justify-between"><span className="text-muted">Bruto antes do IR</span><span className="font-semibold">{formatCurrency(r.cdbBruto)}</span></div><div className="flex justify-between"><span className="text-muted">IR sobre o ganho</span><span className="font-semibold text-rose-500">{(r.ir * 100).toFixed(1)}%</span></div></div></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Evolução do saldo</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={r.serie}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="k" tickFormatter={(v) => `${v}m`} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={56} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => `Mês ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="Poupança" stroke="#06b6d4" strokeWidth={2.5} dot={false} /><Line dataKey="CDB" stroke="#6366f1" strokeWidth={2.5} dot={false} /></LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
