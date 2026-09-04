import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Subscription, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Card, Spinner, Badge, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { detectSubscriptions, detectPriceHikes, combineExpenses } from '../lib/analytics.js';
import { RefreshCw, ArrowUpRight, Repeat, CalendarClock, AlertTriangle } from 'lucide-react';

export default function Recurrences() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const detected = useMemo(() => detectSubscriptions(tx, subs), [tx, subs]);
  const hikes = useMemo(() => detectPriceHikes(tx), [tx]);

  const activeSubs = subs.filter((s) => s.is_active !== false);
  const subTotal = activeSubs.reduce((s, x) => s + Number(x.amount || 0), 0);
  const detectedTotal = detected.reduce((s, x) => s + Number(x.amount || 0), 0);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Repeat className="w-6 h-6 text-indigo-500" /> Radar de Recorrências</span>}
        subtitle="Detecta assinaturas, cobranças recorrentes e aumentos de preço — 100% local, sem IA de terceiros" />

      <AiInsight storageKey="recurrences" title="Onde economizar (IA)" agentFocus="assinaturas e recorrências"
        prompt="Analise minhas assinaturas e cobranças recorrentes. Em até 3 frases, aponte onde dá pra economizar e qual assinatura reavaliar primeiro." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><RefreshCw className="w-3 h-3 text-emerald-500" /> Assinaturas ativas</p><p className="font-display text-2xl font-bold">{activeSubs.length}</p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Custo/mês (cadastradas)</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={subTotal} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Projeção anual</p><p className="font-display text-2xl font-bold"><AnimatedValue value={subTotal * 12} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift"><p className="text-xs text-muted flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Aumentos detectados</p><p className="font-display text-2xl font-bold text-amber-500">{hikes.length}</p></Card></Reveal>
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-indigo-500" /> Possíveis assinaturas detectadas no histórico</h3>
        <p className="text-xs text-muted mb-3">Cobranças que se repetem em 3+ meses com valor estável e que ainda não estão cadastradas. {detectedTotal > 0 && <b>~{formatCurrency(detectedTotal)}/mês</b>}</p>
        {detected.length === 0 ? <EmptyState icon={RefreshCw} title="Nada novo por aqui" subtitle="Não encontrei cobranças recorrentes fora das que você já cadastrou." />
          : <div className="divide-y divide-[hsl(var(--border))]">
            {detected.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0"><Repeat className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{d.name}</p><p className="text-xs text-muted">{d.months} meses · renova ~dia {d.renewal_day}</p></div>
                <span className="font-semibold text-rose-500">{formatCurrency(d.amount)}/mês</span>
              </div>
            ))}
          </div>}
      </Card>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><ArrowUpRight className="w-4 h-4 text-amber-500" /> Cobranças que subiram de preço</h3>
        {hikes.length === 0 ? <EmptyState icon={ArrowUpRight} title="Nenhum aumento recorrente" subtitle="Suas cobranças recorrentes estão estáveis." />
          : <div className="divide-y divide-[hsl(var(--border))]">
            {hikes.map((h, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><ArrowUpRight className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{h.name}</p><p className="text-xs text-muted">{formatCurrency(h.from)} → {formatCurrency(h.to)} · {h.occurrences} cobranças</p></div>
                <Badge color="amber">+{h.changePct}%</Badge>
              </div>
            ))}
          </div>}
        <p className="text-xs text-muted mt-3">Compara o último valor com a mediana do histórico (mínimo 3 meses). Tudo calculado no seu dispositivo.</p>
      </Card>
    </div>
  );
}
