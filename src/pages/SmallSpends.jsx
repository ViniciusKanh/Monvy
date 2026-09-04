import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Spinner, Input, Field, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { Bug, Coffee, TrendingDown, CalendarDays } from 'lucide-react';

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const norm = (s) => String(s || 'Sem descrição').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'sem descrição';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SmallSpends() {
  const [teto, setTeto] = useState('50');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const r = useMemo(() => {
    const limite = n(teto);
    const tx = combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense' && n(t.amount) > 0 && n(t.amount) <= limite);
    // janela: últimos 3 meses
    const now = new Date(); const months = [];
    for (let i = 0; i < 3; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    const set = new Set(months);
    const grupos = {};
    let totalPeriodo = 0, countTotal = 0;
    for (const t of tx) {
      const mk = String(t.date).slice(0, 7); if (!set.has(mk)) continue;
      const key = norm(t.description);
      grupos[key] = grupos[key] || { key, nome: cap(key), count: 0, total: 0, meses: new Set() };
      grupos[key].count++; grupos[key].total += n(t.amount); grupos[key].meses.add(mk);
      totalPeriodo += n(t.amount); countTotal++;
    }
    const lista = Object.values(grupos)
      .map((g) => ({ ...g, nMeses: g.meses.size, mensal: g.total / 3, anual: (g.total / 3) * 12, media: g.total / g.count }))
      .filter((g) => g.count >= 3) // recorrente: ao menos 3 ocorrências
      .sort((a, b) => b.total - a.total);
    const somaFormiga = lista.reduce((s, g) => s + g.total, 0);
    return { lista, totalPeriodo, countTotal, mensalFormiga: somaFormiga / 3, anualFormiga: (somaFormiga / 3) * 12 };
  }, [transactions, cardTxs, teto]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Bug className="w-6 h-6 text-amber-500" /> Detector de Gastos-Formiga</span>}
        subtitle="Pequenas compras que se repetem e, somadas, pesam no fim do mês — tudo analisado localmente" />

      <AiInsight storageKey="antspend" title="Ataque às formigas (IA)" agentFocus="gastos-formiga"
        prompt="Analise meus pequenos gastos recorrentes (gastos-formiga). Em até 3 frases, diga quais hábitos mais pesam e sugira 2 cortes simples que liberam dinheiro no mês." />

      <Card><Field label="Considerar compras até (R$)"><Input type="number" value={teto} onChange={(e) => setTeto(e.target.value)} className="max-w-xs" /></Field>
        <p className="text-xs text-muted mt-1">Compras pequenas que aparecem 3+ vezes nos últimos 3 meses são tratadas como gasto-formiga.</p></Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#d97706,#dc2626)' }}>
        <p className="text-sm opacity-90 flex items-center gap-1"><Bug className="w-4 h-4" /> Suas formigas custam por ano</p>
        <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={r.anualFormiga} format={formatCurrency} /></p>
        <p className="text-sm opacity-90 mt-1">≈ {formatCurrency(r.mensalFormiga)}/mês em pequenas compras recorrentes</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><TrendingDown className="w-3 h-3 text-rose-500" /> Total (3 meses)</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={r.totalPeriodo} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Coffee className="w-3 h-3" /> Pequenas compras</p><p className="font-display text-xl font-bold">{r.countTotal}</p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Grupos recorrentes</p><p className="font-display text-xl font-bold">{r.lista.length}</p></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Onde as formigas se escondem</h3>
        {r.lista.length === 0 ? <EmptyState icon={Bug} title="Nenhuma formiga encontrada" subtitle="Não há pequenas compras recorrentes no período com esse limite." />
          : <div className="divide-y divide-[hsl(var(--border))]">
            {r.lista.map((g, i) => (
              <Reveal key={g.key} i={i}><div className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><Bug className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{g.nome}</p><p className="text-xs text-muted">{g.count}× · média {formatCurrency(g.media)} · {g.nMeses} {g.nMeses > 1 ? 'meses' : 'mês'}</p></div>
                <div className="text-right"><p className="font-semibold text-rose-500">{formatCurrency(g.anual)}/ano</p><Badge color="amber">{formatCurrency(g.mensal)}/mês</Badge></div>
              </div></Reveal>
            ))}
          </div>}
        <p className="text-[11px] text-muted mt-3">Dica: cortar ou reduzir 2–3 desses hábitos costuma liberar dezenas ou centenas de reais por mês sem grande sacrifício.</p>
      </Card>
    </div>
  );
}
