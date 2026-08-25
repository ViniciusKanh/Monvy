import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { DEFAULT_TAX, aplicarTabela } from '../lib/tax.js';
import { Wallet, Receipt, Landmark, TrendingDown } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
// INSS 2025 (tabela progressiva mensal)
const INSS_FAIXAS = [
  { ate: 1518.00, aliq: 0.075 },
  { ate: 2793.88, aliq: 0.09 },
  { ate: 4190.83, aliq: 0.12 },
  { ate: 8157.41, aliq: 0.14 },
];
function calcINSS(bruto) {
  let ant = 0, inss = 0;
  for (const f of INSS_FAIXAS) {
    if (bruto > ant) { const base = Math.min(bruto, f.ate) - ant; inss += base * f.aliq; ant = f.ate; }
  }
  return Math.min(inss, INSS_FAIXAS[INSS_FAIXAS.length - 1].ate * 0.14); // teto
}

export default function SalaryNet() {
  const [bruto, setBruto] = useState('3000');
  const [dep, setDep] = useState('0');
  const [outros, setOutros] = useState('');

  const r = useMemo(() => {
    const b = n(bruto);
    const inss = calcINSS(b);
    const baseIR = Math.max(0, b - inss - n(dep) * DEFAULT_TAX.deducaoDependenteMensal);
    const irNormal = aplicarTabela(baseIR, DEFAULT_TAX.mensal).imposto;
    const irSimpl = aplicarTabela(Math.max(0, b - inss - DEFAULT_TAX.descontoSimplificadoMensal), DEFAULT_TAX.mensal).imposto;
    const irrf = Math.min(irNormal, irSimpl);
    const liquido = Math.max(0, b - inss - irrf - n(outros));
    return { b, inss, irrf, liquido, baseIR, aliqEfetiva: b > 0 ? (inss + irrf) / b : 0 };
  }, [bruto, dep, outros]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Wallet className="w-6 h-6 text-emerald-500" /> Salário Líquido (CLT)</span>}
        subtitle="Calcule quanto cai na conta depois de INSS e Imposto de Renda" />

      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Salário bruto (R$)"><Input type="number" value={bruto} onChange={(e) => setBruto(e.target.value)} /></Field>
          <Field label="Dependentes"><Input type="number" value={dep} onChange={(e) => setDep(e.target.value)} /></Field>
          <Field label="Outros descontos (R$)"><Input type="number" value={outros} onChange={(e) => setOutros(e.target.value)} placeholder="VT, VA, plano..." /></Field>
        </div>
        <p className="text-xs text-muted mt-2">Tabelas de referência 2025. Não inclui FGTS (é depositado pelo empregador, não descontado). O IR usa a opção mais vantajosa (normal x simplificado).</p>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
        <p className="text-sm opacity-90">Salário líquido estimado</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={r.liquido} format={formatCurrency} /></p>
        <p className="text-sm opacity-90 mt-1">de {formatCurrency(r.b)} bruto · alíquota efetiva de descontos {(r.aliqEfetiva * 100).toFixed(1)}%</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Landmark className="w-3 h-3" /> INSS</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={r.inss} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Receipt className="w-3 h-3" /> IRRF</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={r.irrf} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Outros descontos</p><p className="font-display text-xl font-bold"><AnimatedValue value={n(outros)} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Total de descontos</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={r.inss + r.irrf + n(outros)} format={formatCurrency} /></p></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Composição</h3>
        {[['Salário bruto', r.b, 'text-[hsl(var(--text))]'], ['(-) INSS', -r.inss, 'text-rose-500'], ['(-) IRRF', -r.irrf, 'text-rose-500'], ['(-) Outros', -n(outros), 'text-rose-500'], ['(=) Líquido', r.liquido, 'text-emerald-500']].map(([l, v, c]) => (
          <div key={l} className="flex justify-between py-1.5 text-sm border-b border-[hsl(var(--border))] last:border-0"><span>{l}</span><span className={`font-semibold ${c}`}>{formatCurrency(v)}</span></div>
        ))}
      </Card>
    </div>
  );
}
