import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Spinner, Input, Field } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { Gauge, TrendingUp, ShieldCheck, Scale, Sparkles, Info } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };

function faixa(score) {
  if (score >= 800) return { label: 'Excelente', color: '#10b981' };
  if (score >= 650) return { label: 'Bom', color: '#22c55e' };
  if (score >= 500) return { label: 'Regular', color: '#eab308' };
  if (score >= 350) return { label: 'Baixo', color: '#f97316' };
  return { label: 'Muito baixo', color: '#ef4444' };
}

export default function CreditScore() {
  const [dividaMensal, setDividaMensal] = useState('');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const r = useMemo(() => {
    const tx = combineExpenses(transactions, cardTxs);
    // últimos 6 meses
    const now = new Date(); const months = [];
    for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    const set = new Set(months);
    let inc = 0, exp = 0; const expByMonth = {};
    for (const t of tx) { const mk = String(t.date).slice(0, 7); if (!set.has(mk)) continue;
      if (t.type === 'income') inc += n(t.amount);
      if (t.type === 'expense') { exp += n(t.amount); expByMonth[mk] = (expByMonth[mk] || 0) + n(t.amount); } }
    const nm = months.length;
    const avgInc = inc / nm, avgExp = exp / nm;
    const balance = accounts.reduce((s, a) => s + n(a.balance ?? a.current_balance ?? a.initial_balance), 0);
    const rate = avgInc > 0 ? (avgInc - avgExp) / avgInc : 0;
    const reserveMonths = avgExp > 0 ? balance / avgExp : (balance > 0 ? 6 : 0);
    const divida = n(dividaMensal);
    const commit = avgInc > 0 ? divida / avgInc : (divida > 0 ? 1 : 0);
    // tendência: mês mais recente vs média
    const recentes = months.slice(0, 3).map((m) => expByMonth[m] || 0);
    const antigos = months.slice(3).map((m) => expByMonth[m] || 0);
    const mRec = recentes.reduce((a, b) => a + b, 0) / 3, mAnt = antigos.reduce((a, b) => a + b, 0) / 3;
    const estavel = mAnt === 0 ? 1 : Math.max(0, Math.min(1, 1 - (mRec - mAnt) / mAnt));

    const s1 = Math.max(0, Math.min(300, Math.round((rate / 0.25) * 300)));            // poupança
    const s2 = Math.max(0, Math.min(250, Math.round((1 - Math.min(1, commit / 0.35)) * 250))); // comprometimento
    const s3 = Math.max(0, Math.min(250, Math.round(Math.min(1, reserveMonths / 6) * 250)));    // reserva
    const s4 = Math.max(0, Math.min(200, Math.round(estavel * 200)));                  // estabilidade
    const score = Math.max(0, Math.min(1000, s1 + s2 + s3 + s4));

    const dicas = [];
    if (s1 < 200) dicas.push('Sua taxa de poupança está baixa. Tente separar ao menos 15–20% da renda todo mês.');
    if (s2 < 150) dicas.push('Seu comprometimento com dívidas/parcelas está alto. Priorize quitar as de juros maiores.');
    if (s3 < 150) dicas.push('Reserva de emergência abaixo do ideal. Mire 3 a 6 meses das suas despesas guardados.');
    if (s4 < 120) dicas.push('Seus gastos vêm crescendo nos últimos meses. Reveja categorias que aumentaram.');
    if (!dicas.length) dicas.push('Parabéns! Seus indicadores estão saudáveis. Continue mantendo a reserva e a taxa de poupança.');

    return { score, avgInc, avgExp, balance, rate, reserveMonths, commit, fatores: [
      { k: 'Taxa de poupança', v: s1, max: 300, icon: TrendingUp, sub: `${Math.round(rate * 100)}% da renda sobra` },
      { k: 'Comprometimento', v: s2, max: 250, icon: Scale, sub: `${Math.round(commit * 100)}% da renda em dívidas` },
      { k: 'Reserva de emergência', v: s3, max: 250, icon: ShieldCheck, sub: `${reserveMonths.toFixed(1)} meses cobertos` },
      { k: 'Estabilidade de gastos', v: s4, max: 200, icon: Sparkles, sub: 'tendência recente' },
    ], dicas };
  }, [transactions, cardTxs, accounts, dividaMensal]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const f = faixa(r.score); const pct = r.score / 1000;
  const R = 80, C = Math.PI * R; const dash = C * pct;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Gauge className="w-6 h-6 text-emerald-500" /> Score de Crédito Estimado</span>}
        subtitle="Estimativa baseada nos seus próprios dados — não é o Serasa/SPC, é um termômetro pessoal" />

      <AiInsight storageKey="creditscore" title="Como subir seu score (IA)" agentFocus="crédito"
        prompt="Com base na minha renda, reserva, comprometimento e taxa de poupança, dê 3 recomendações práticas e priorizadas para melhorar meu score de crédito estimado. Seja direto." />

      <Card><Field label="Parcelas de dívidas por mês (R$) — opcional"><Input type="number" value={dividaMensal} onChange={(e) => setDividaMensal(e.target.value)} placeholder="ex: 800" className="max-w-xs" /></Field>
        <p className="text-xs text-muted mt-1">Some empréstimos, financiamentos e parcelamentos que você paga mensalmente.</p></Card>

      <Card className="flex flex-col items-center py-6">
        <svg width="220" height="130" viewBox="0 0 220 130">
          <path d="M 30 120 A 80 80 0 0 1 190 120" fill="none" stroke="hsl(var(--muted)/0.15)" strokeWidth="16" strokeLinecap="round" />
          <path d="M 30 120 A 80 80 0 0 1 190 120" fill="none" stroke={f.color} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="-mt-12 text-center">
          <p className="font-display text-5xl font-extrabold" style={{ color: f.color }}>{r.score}</p>
          <p className="text-sm text-muted">de 1000</p>
          <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-semibold" style={{ background: f.color + '22', color: f.color }}>{f.label}</span>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {r.fatores.map((ft, i) => (
          <Reveal key={ft.k} i={i}><Card className="hover-lift">
            <div className="flex items-center gap-2 mb-1"><ft.icon className="w-4 h-4 text-emerald-500" /><span className="font-semibold text-sm">{ft.k}</span>
              <span className="ml-auto text-sm font-bold">{ft.v}<span className="text-muted font-normal">/{ft.max}</span></span></div>
            <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(ft.v / ft.max) * 100}%` }} /></div>
            <p className="text-xs text-muted mt-1">{ft.sub}</p>
          </Card></Reveal>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Info className="w-4 h-4 text-indigo-500" /> Dicas para melhorar</h3>
        <ul className="space-y-2">{r.dicas.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />{d}</li>)}</ul>
        <p className="text-[11px] text-muted mt-3">Estimativa educativa calculada localmente com base em renda, despesas, reserva e dívidas informadas. Não representa consulta a bureaus de crédito.</p>
      </Card>
    </div>
  );
}
