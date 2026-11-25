import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, CreditCard, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, Modal, Button } from '../components/ui';
import { useCountUp } from '../components/Animated.jsx';
import { HeroTitle, Panel, DeltaChip, GlowButton } from '../components/kit.jsx';
import { HeartArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { lastMonths, monthlySeries, monthTotals, healthScore, combineExpenses, categoryTrends, behaviorProfile, detectSubscriptions, recommendations } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { HeartPulse, Wallet, PiggyBank, AlertTriangle, CheckCircle2, Sparkles, Cpu, Brain, Layers, PieChart as PieIcon, BarChart3, CreditCard as CardIcon, TrendingUp, History, Coins, Database, XCircle } from 'lucide-react';

const PILLAR_ICON = [PiggyBank, PieIcon, Layers, BarChart3, CardIcon];
const status = (pct) => (pct >= 65 ? ['Saudável', CheckCircle2, 'bg-emerald-500/15 ring-emerald-400/60 text-emerald-600 dark:text-emerald-300', '#10b981'] : pct >= 35 ? ['Em evolução', TrendingUp, 'bg-amber-500/15 ring-amber-400/60 text-amber-600 dark:text-amber-300', '#f59e0b'] : pct > 0 ? ['Atenção', AlertTriangle, 'bg-rose-500/10 ring-rose-400/60 text-rose-500 dark:text-rose-300', '#fb7185'] : ['Crítico', AlertTriangle, 'bg-rose-500/20 ring-rose-500/70 text-rose-600 dark:text-rose-300', '#f43f5e']);

export default function FinancialHealth() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CreditCard.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ai = useAiAnalysis({ storageKey: 'health', agentFocus: 'saúde financeira', prompt: 'Avalie minha saúde financeira em até 3 frases (poupança, reserva e comprometimento) e termine com 2 dicas objetivas para melhorar. Seja direto.' });
  const [histOpen, setHistOpen] = useState(false);

  const months = useMemo(() => lastMonths(6), []);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const series = useMemo(() => monthlySeries(tx, months), [tx, months]);
  const cur = useMemo(() => monthTotals(tx, monthKey(new Date())), [tx]);
  const h = useMemo(() => healthScore({ transactions: tx, months, totalBalance, categories, cards }), [tx, months, totalBalance, categories, cards]);
  const trends = useMemo(() => categoryTrends(tx, months, catMap), [tx, months, catMap]);
  const behavior = useMemo(() => behaviorProfile({ transactions: tx, months, catMap }), [tx, months, catMap]);
  const subs = useMemo(() => detectSubscriptions(tx), [tx]);
  const recs = useMemo(() => recommendations({ h, b: behavior, trends, subsCount: subs.length }), [h, behavior, trends, subs]);
  const scoreV = useCountUp(h.score, 950);
  const scoreTone = h.score >= 80 ? ['#10b981', 'Excelente'] : h.score >= 60 ? ['#0ea5e9', 'Boa'] : h.score >= 40 ? ['#f59e0b', 'Atenção'] : ['#f43f5e', 'Crítico'];

  // saldo por mês reconstruído a partir do saldo atual e do resultado de cada mês
  const balSeries = useMemo(() => { const out = []; let b = totalBalance; for (let k = series.length - 1; k >= 0; k--) { out.unshift(b); b -= series[k].net; } return out; }, [series, totalBalance]);
  const last = series[series.length - 1] || { inc: 0, exp: 0, net: 0 }; const prev = series[series.length - 2] || { inc: 0, exp: 0, net: 0 };
  const d = (a, b) => (Math.abs(b) > 0 ? ((a - b) / Math.abs(b)) * 100 : null);

  const pos = recs.find((r) => r.type === 'ok') || (h.rate > 0.2 ? { title: 'Taxa de poupança excelente', text: `Você guarda ${(h.rate * 100).toFixed(0)}% da sua renda média.` } : null);
  const tip = recs.find((r) => r.type === 'tip');
  const warn = recs.find((r) => r.type === 'warn');

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const r = 92, c = 2 * Math.PI * r;
  const Spark = ({ label, value, data, color, icon: Ic, delta, invert }) => (
    <div className="relative overflow-hidden rounded-2xl ring-1 bg-[hsl(var(--card))] p-4" style={{ '--tw-ring-color': `${color}88`, boxShadow: `0 0 24px -12px ${color}` }}>
      <div className="flex items-start gap-3"><Ic className="w-8 h-8 shrink-0" style={{ color }} strokeWidth={1.6} /><div className="flex-1 min-w-0"><p className="text-sm text-muted">{label}</p><p className="font-display text-2xl font-bold truncate" style={{ color }}>{value}</p></div><DeltaChip v={delta} invert={invert} /></div>
      <div className="h-12 -mx-4 -mb-4 mt-1"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 6, right: 12, left: 12, bottom: 4 }}><defs><linearGradient id={`sp${label.length}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill={`url(#sp${label.length})`} dot={(p) => (p.index === data.length - 1 ? <circle key="d" cx={p.cx} cy={p.cy} r={4.5} fill="#fff" stroke={color} strokeWidth={3} /> : null)} /></AreaChart></ResponsiveContainer></div>
    </div>
  );
  const RecCard = ({ tone, kicker, icon: Ic, title, text, art: Art }) => (
    <div className={`relative overflow-hidden rounded-2xl ring-1 p-4 ${tone === 'ok' ? 'ring-emerald-400/60 bg-emerald-500/10' : tone === 'tip' ? 'ring-amber-400/60 bg-amber-500/10' : 'ring-rose-400/60 bg-rose-500/10'}`}>
      <p className={`text-sm font-bold flex items-center gap-1.5 ${tone === 'ok' ? 'text-emerald-600 dark:text-emerald-300' : tone === 'tip' ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}><Ic className="w-4 h-4" />{kicker}</p>
      <p className="font-display text-lg font-bold mt-1 pr-14">{title}</p><p className="text-sm text-muted mt-1 pr-14">{text}</p>
      <Art className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 opacity-80 ${tone === 'ok' ? 'text-emerald-400' : tone === 'tip' ? 'text-amber-400' : 'text-rose-400'}`} />
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={HeartPulse} lead="Saúde Financeira" accent="" iconClass="text-teal-400" subtitle="Diagnóstico automático com contas e cartão — 100% local" art={<HeartArt className="w-72 h-28 xl:mr-56" />} />

      <section className="relative overflow-hidden rounded-3xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(70%_140%_at_0%_0%,rgba(168,85,247,.22),transparent),radial-gradient(50%_120%_at_100%_100%,rgba(34,211,238,.12),transparent)] p-5 shadow-[0_0_36px_-14px_rgba(168,85,247,.6)]">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-fuchsia-400" />Diagnóstico com IA {ai.data && <span className="text-xs font-semibold text-muted inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3.5 h-3.5 text-sky-400" />Gemini</> : <><Cpu className="w-3.5 h-3.5" />Motor local</>}</span>}</p>
            {ai.busy ? <p className="text-sm text-muted flex items-center gap-2 mt-2"><Spinner className="w-4 h-4" />Analisando seus dados…</p>
              : ai.data ? <Markdown text={ai.data.text} className="text-sm mt-1.5 [&_li]:ml-4 [&_ul]:list-disc" />
              : <p className="text-sm text-muted mt-1.5">{ai.apiKey ? 'Gere um diagnóstico curto e personalizado com IA generativa (Gemini).' : 'Gere um diagnóstico curto com o motor local (sem IA de terceiros).'}</p>}
          </div>
          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            <GlowButton tone="sky" onClick={() => ai.gerar()} disabled={ai.busy} className="py-2.5 px-6">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Gerar de novo' : 'Gerar diagnóstico'}</GlowButton>
            {ai.data && <span className="text-[11px] text-muted">Gerado em {new Date(ai.data.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-4 relative overflow-hidden rounded-3xl ring-1 ring-violet-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(70%_80%_at_50%_40%,rgba(168,85,247,.18),transparent)] p-5 flex flex-col items-center justify-center text-center">
          <div className="relative w-56 h-56">
            <svg width="224" height="224" viewBox="0 0 224 224" className="-rotate-90">
              <defs><linearGradient id="hsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor={scoreTone[0]} /></linearGradient></defs>
              <circle cx="112" cy="112" r={r} fill="none" stroke="hsl(var(--muted) / .15)" strokeWidth="16" />
              <circle cx="112" cy="112" r={r} fill="none" stroke="url(#hsG)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(scoreV / 100) * c} ${c}`} style={{ filter: `drop-shadow(0 0 10px ${scoreTone[0]}99)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-7xl font-extrabold leading-none">{Math.round(scoreV)}</span><span className="text-2xl text-muted">/ 100</span></div>
          </div>
          <p className="mt-2 text-sm">Score de saúde financeira</p>
          <span className="mt-2 inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-sm font-bold text-white" style={{ background: scoreTone[0], boxShadow: `0 0 16px ${scoreTone[0]}88` }}>{h.score < 60 && <AlertTriangle className="w-4 h-4" />}{scoreTone[1]}</span>
        </section>
        <Panel className="xl:col-span-8" tone="sky" glow title={`${h.pillars.length} Pilares Avaliados`} icon={Layers} iconClass="text-sky-400">
          <div className="space-y-1">
            {h.pillars.map((p, k) => { const pct = Math.round((p.score / p.max) * 100); const [lbl, SIc, cls, col] = status(pct); const Ic = PILLAR_ICON[k] || Layers; return (
              <div key={p.name} className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_180px_1fr_52px_132px] items-center gap-x-4 gap-y-1 rounded-xl px-2 py-2 odd:bg-black/[.03] dark:odd:bg-white/[.03]">
                <Ic className="w-7 h-7 text-fuchsia-400" strokeWidth={1.6} />
                <p className="font-semibold">{p.name.replace('Poupanca', 'Poupança').replace('Seguranca', 'Segurança').replace('Cartao', 'Cartão')}</p>
                <div className="col-span-2 sm:col-span-1 min-w-0"><div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, pct)}%`, background: `linear-gradient(90deg, ${col}, ${col}cc)`, boxShadow: `0 0 8px ${col}` }} /></div><p className="text-xs text-muted mt-1 truncate">{p.detail.replace('cartao(oes)', 'cartão(ões)').replace('lancamentos', 'lançamentos')} — {p.tip.replace(/Meta: (\d+)/, (_, v) => `Meta: ${formatCurrency(Number(v))}`).replace('lancamentos', 'lançamentos').replace('cartao', 'cartão')}</p></div>
                <span className="text-sm font-semibold text-right">{p.score}/{p.max}</span>
                <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg ring-1 text-xs font-bold ${cls}`}><SIc className="w-3.5 h-3.5" />{lbl}</span>
              </div>); })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Spark label="Receita média" value={formatCurrency(h.avgInc)} data={series.map((s) => s.inc)} color="#2dd4bf" icon={Wallet} delta={d(last.inc, prev.inc)} />
        <Spark label="Despesa média" value={formatCurrency(h.avgExp)} data={series.map((s) => s.exp)} color="#f472b6" icon={CardIcon} delta={d(last.exp, prev.exp)} invert />
        <Spark label="Saldo total" value={formatCurrency(totalBalance)} data={balSeries} color="#a78bfa" icon={Database} delta={d(balSeries[balSeries.length - 1], balSeries[balSeries.length - 2])} />
        <Spark label="Poupança do mês" value={formatCurrency(cur.inc - cur.exp)} data={series.map((s) => s.inc - s.exp)} color="#38bdf8" icon={PiggyBank} delta={d(last.net, prev.net)} />
      </div>
      <p className="text-[11px] text-muted -mt-3">Variações: mês atual vs. mês anterior. Médias dos últimos 6 meses.</p>

      <div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-fuchsia-400" />Insights e Recomendações</h2>
          <span className="text-sm text-muted">Ações personalizadas para melhorar sua saúde financeira</span>
          <button onClick={() => setHistOpen(true)} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ring-sky-400/50 text-sm font-semibold hover:bg-sky-500/10"><History className="w-4 h-4" />Ver histórico de diagnósticos</button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <RecCard tone="ok" kicker="Ponto positivo" icon={CheckCircle2} art={BarChart3} title={pos?.title || 'Continue registrando'} text={pos?.text || 'Com mais meses de dados os pontos fortes aparecem aqui.'} />
          <RecCard tone="tip" kicker="Oportunidade de melhoria" icon={AlertTriangle} art={Coins} title={tip?.title || 'Mantenha o ritmo'} text={tip?.text || 'Nenhuma oportunidade urgente encontrada agora.'} />
          <RecCard tone="warn" kicker="Ação urgente" icon={AlertTriangle} art={XCircle} title={warn?.title || 'Nada urgente'} text={warn?.text || 'Nenhum indicador em nível crítico. Ótimo!'} />
        </div>
        {recs.length > 3 && <div className="mt-3 grid md:grid-cols-2 gap-2">{recs.filter((x) => x !== pos && x !== tip && x !== warn).map((x, k) => <p key={k} className="text-sm rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2"><b>{x.title}</b> <span className="text-muted">— {x.text}</span></p>)}</div>}
      </div>

      <Panel title="Reserva de emergência" icon={HeartPulse} iconClass="text-sky-400" action={<span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${h.reserveMonths >= 3 ? 'bg-emerald-500/15 text-emerald-600' : h.reserveMonths >= 1 ? 'bg-amber-500/15 text-amber-600' : 'bg-rose-500/15 text-rose-600'}`}>{h.reserveMonths.toFixed(1).replace('.', ',')} meses cobertos</span>}>
        <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (h.reserveMonths / 6) * 100)}%`, background: 'linear-gradient(90deg,#22d3ee,#a855f7)' }} /></div>
        <p className="text-xs text-muted mt-2">Seu saldo cobre {h.reserveMonths.toFixed(1).replace('.', ',')} mês(es) de despesa média ({formatCurrency(h.avgExp)}/mês). Faixa saudável: 3 a 6 meses ({formatCurrency(h.avgExp * 3)} a {formatCurrency(h.avgExp * 6)}).</p>
      </Panel>

      <Modal open={histOpen} onClose={() => setHistOpen(false)} title="Histórico de diagnósticos" maxWidth="max-w-2xl" footer={<Button onClick={() => setHistOpen(false)}>Fechar</Button>}>
        {ai.history.length === 0 ? <p className="text-sm text-muted py-4 text-center">Nenhum diagnóstico gerado ainda neste navegador.</p> : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">{ai.history.map((x, k) => <div key={k} className="rounded-xl ring-1 ring-[hsl(var(--border))] p-3"><p className="text-xs text-muted mb-1">{new Date(x.at).toLocaleString('pt-BR')} • {x.via === 'gemini' ? 'Gemini' : 'Motor local'}</p><Markdown text={x.text} className="text-sm" /></div>)}</div>)}
      </Modal>
    </div>
  );
}
