import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Account, Transaction, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Input, Field, Spinner, Badge } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { ShieldCheck, Wallet, CalendarClock, Target } from 'lucide-react';

const LS = 'monvy_emergency_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const num = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const median = (a) => { const s = a.filter((x) => x > 0).sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

export default function EmergencyFund() {
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const totalBalance = accounts.reduce((s, a) => s + num(a.current_balance), 0);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const gastoMedio = useMemo(() => {
    const now = new Date(); const byMonth = {};
    for (let k = 0; k < 6; k++) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); byMonth[d.toISOString().slice(0, 7)] = 0; }
    for (const t of tx) { if (t.type !== 'expense') continue; const mk = String(t.date).slice(0, 7); if (mk in byMonth) byMonth[mk] += num(t.amount); }
    return Math.round(median(Object.values(byMonth)));
  }, [tx]);

  const saved = load() || {};
  const [despesa, setDespesa] = useState(saved.despesa || '');
  const [meses, setMeses] = useState(saved.meses || 6);
  const [reserva, setReserva] = useState(saved.reserva ?? '');
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify({ despesa, meses, reserva })); } catch { /* */ } }, [despesa, meses, reserva]);

  const gasto = despesa !== '' ? num(despesa) : gastoMedio;
  const atual = reserva !== '' ? num(reserva) : totalBalance;
  const alvo = gasto * num(meses);
  const cobertura = gasto > 0 ? atual / gasto : 0;
  const falta = Math.max(0, alvo - atual);
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-emerald-500" /> Reserva de Emergência</span>}
        subtitle="Descubra quantos meses você aguenta e quanto falta para a reserva ideal" />

      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Gasto médio mensal (R$)"><Input type="number" value={despesa} onChange={(e) => setDespesa(e.target.value)} placeholder={String(gastoMedio)} /></Field>
          <Field label="Meses de reserva (meta)"><Input type="number" value={meses} onChange={(e) => setMeses(e.target.value)} /></Field>
          <Field label="Reserva atual (R$)"><Input type="number" value={reserva} onChange={(e) => setReserva(e.target.value)} placeholder={String(Math.round(totalBalance))} /></Field>
        </div>
        <p className="text-xs text-muted mt-2">Sugestão: 3 a 6 meses para CLT, 6 a 12 para autônomos. Gasto médio calculado dos seus últimos 6 meses ({formatCurrency(gastoMedio)}); reserva atual assume seu saldo total.</p>
      </Card>

      <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${cobertura >= num(meses) ? '#10b981' : cobertura >= 3 ? '#f59e0b' : '#ef4444'}, ${cobertura >= num(meses) ? '#0d9488' : '#f97316'})` }}>
        <p className="text-sm opacity-90">Sua reserva cobre hoje</p>
        <p className="font-display text-4xl font-extrabold mt-1">{cobertura.toFixed(1)} {cobertura === 1 ? 'mês' : 'meses'}</p>
        <p className="text-sm opacity-90 mt-1">{cobertura >= num(meses) ? 'Parabéns, você atingiu a meta! 🎉' : `Faltam ${formatCurrency(falta)} para chegar a ${meses} meses.`}</p>
        <div className="mt-3 h-2.5 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="text-xs opacity-90 mt-1">{pct}% da meta de {formatCurrency(alvo)}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Wallet className="w-3 h-3" /> Reserva atual</p><p className="font-display text-xl font-bold"><AnimatedValue value={atual} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><Target className="w-3 h-3 text-emerald-500" /> Meta ({meses} meses)</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={alvo} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Falta guardar</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={falta} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Guardando R$300/mês</p><p className="font-display text-xl font-bold">{falta > 0 ? `${Math.ceil(falta / 300)} meses` : 'pronto'}</p></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Metas por prazo</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[3, 6, 12].map((m) => { const meta = gasto * m; const ok = atual >= meta; return (
            <div key={m} className="rounded-xl bg-black/5 dark:bg-white/5 py-3"><p className="text-xs text-muted">{m} meses</p><p className="font-semibold">{formatCurrency(meta)}</p><Badge color={ok ? 'emerald' : 'slate'}>{ok ? 'atingida' : `faltam ${formatCurrency(Math.max(0, meta - atual))}`}</Badge></div>
          ); })}
        </div>
      </Card>
    </div>
  );
}
