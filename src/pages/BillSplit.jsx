import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Button } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { Users, Plus, Minus, Receipt } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

export default function BillSplit() {
  const [total, setTotal] = useState('120');
  const [gorjeta, setGorjeta] = useState('10');
  const [pessoas, setPessoas] = useState(2);
  const [extras, setExtras] = useState([]); // consumos individuais {nome, valor}

  const r = useMemo(() => {
    const base = n(total); const tip = base * n(gorjeta) / 100; const comTip = base + tip;
    const somaExtras = extras.reduce((s, e) => s + n(e.valor), 0);
    const compartilhado = Math.max(0, comTip - somaExtras * (1 + n(gorjeta) / 100));
    const porPessoa = pessoas > 0 ? compartilhado / pessoas : 0;
    return { tip, comTip, porPessoa, comTipIgual: pessoas > 0 ? comTip / pessoas : 0, somaExtras };
  }, [total, gorjeta, pessoas, extras]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Users className="w-6 h-6 text-emerald-500" /> Racha da Conta</span>}
        subtitle="Divida a conta do rolê com gorjeta, por igual ou com consumos individuais" />
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Total da conta (R$)"><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label="Gorjeta (%)"><Input type="number" value={gorjeta} onChange={(e) => setGorjeta(e.target.value)} /></Field>
          <Field label="Pessoas">
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => setPessoas((p) => Math.max(1, p - 1))}><Minus className="w-4 h-4" /></Button>
              <span className="font-display text-xl font-bold w-8 text-center">{pessoas}</span>
              <Button variant="outline" size="sm" onClick={() => setPessoas((p) => p + 1)}><Plus className="w-4 h-4" /></Button>
            </div>
          </Field>
        </div>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
        <p className="text-sm opacity-90">Cada um paga (divisão igual, com gorjeta)</p>
        <p className="font-display text-4xl font-extrabold mt-1">{formatCurrency(r.comTipIgual)}</p>
        <p className="text-sm opacity-90 mt-1">Total com gorjeta: {formatCurrency(r.comTip)} (gorjeta {formatCurrency(r.tip)})</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-indigo-500" /> Consumos individuais (opcional)</h3>
          <Button size="sm" variant="outline" onClick={() => setExtras((e) => [...e, { nome: '', valor: '' }])}><Plus className="w-4 h-4" /> Item</Button>
        </div>
        <p className="text-xs text-muted mb-3">Quem consumiu algo à parte paga o item (+ gorjeta) e o resto é dividido igualmente entre {pessoas}.</p>
        {extras.map((e, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <Input value={e.nome} onChange={(ev) => setExtras((x) => x.map((y, j) => j === i ? { ...y, nome: ev.target.value } : y))} placeholder="Nome" className="flex-1" />
            <Input type="number" value={e.valor} onChange={(ev) => setExtras((x) => x.map((y, j) => j === i ? { ...y, valor: ev.target.value } : y))} placeholder="R$" className="w-28" />
            <button onClick={() => setExtras((x) => x.filter((_, j) => j !== i))} className="p-2 text-rose-500"><Minus className="w-4 h-4" /></button>
          </div>
        ))}
        {extras.length > 0 && <div className="mt-3 text-sm border-t border-[hsl(var(--border))] pt-3">
          <div className="flex justify-between"><span className="text-muted">Parte compartilhada por pessoa</span><span className="font-semibold">{formatCurrency(r.porPessoa)}</span></div>
          {extras.map((e, i) => <div key={i} className="flex justify-between"><span className="text-muted">{e.nome || `Pessoa extra ${i + 1}`} (compartilhado + seu item)</span><span className="font-semibold">{formatCurrency(r.porPessoa + n(e.valor) * (1 + n(gorjeta) / 100))}</span></div>)}
        </div>}
      </Card>
    </div>
  );
}
