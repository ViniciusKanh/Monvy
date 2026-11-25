import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Subscription, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, Modal, Button } from '../components/ui';
import { HeroTitle, Panel, GlowButton, InsightRow, pct1 } from '../components/kit.jsx';
import { formatCurrency } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { detectSubscriptions, detectPriceHikes, combineExpenses } from '../lib/analytics.js';
import {
  RefreshCw, Repeat, AlertTriangle, Layers, Wallet, BarChart3, TrendingUp, Bell, CalendarDays, ChevronRight, Sparkles, X, CheckCircle2, ArrowRight, Maximize2, Plus, Home,
  ShoppingBag, FileText, Wifi, Zap, Star, Database, Cpu, Brain, Percent, Check,
} from 'lucide-react';

const CAT_COLORS = ['#22d3ee', '#6366f1', '#a855f7', '#f97316', '#64748b', '#10b981', '#ec4899'];
const GUESS = [[/alug|condom|moradia/i, Home], [/shop|loja|mercado|store|ebazar|amazon|magalu/i, ShoppingBag], [/internet|vivo|claro|tim\b|m[óo]vel|fibra/i, Wifi], [/luz|enel|energia/i, Zap], [/serv|prestac/i, FileText]];
const iconOf = (n) => (GUESS.find(([re]) => re.test(n || '')) || [null, Repeat])[1];
const LOW = ['rarely', 'never'];
const nextIn = (day) => { const t = new Date(); t.setHours(0, 0, 0, 0); let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day || 1, 28)); if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day || 1, 28)); return Math.round((d - t) / 86400000); };

export default function Recurrences() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: subs = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const ai = useAiAnalysis({ storageKey: 'recurrences', agentFocus: 'assinaturas e recorrências', prompt: 'Analise minhas assinaturas e cobranças recorrentes. Em até 3 frases, aponte onde dá pra economizar e qual assinatura reavaliar primeiro.' });
  const [hideHero, setHideHero] = useState(false);
  const [plan, setPlan] = useState(false);
  const [zoom, setZoom] = useState(false);

  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const detected = useMemo(() => detectSubscriptions(tx, subs).filter((d) => !/fatura|cart[ãa]o de cr/i.test(d.name)), [tx, subs]);
  const hikes = useMemo(() => detectPriceHikes(tx), [tx]);
  const addSub = useMutation({ mutationFn: (d) => Subscription.create({ name: d.name, amount: d.amount, renewal_day: d.renewal_day, icon_emoji: '🔁', color: '#6366f1', usage_frequency: 'monthly', category: 'Outros' }), onSuccess: (_, d) => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast.success(`${d.name} cadastrada como assinatura`); } });

  const active = subs.filter((s) => s.is_active !== false);
  const total = active.reduce((s, x) => s + Number(x.amount || 0), 0);
  const mk = new Date().toISOString().slice(0, 7);
  const newThis = active.filter((s) => String(s.created_date || '').slice(0, 7) === mk);
  const prevTotal = total - newThis.reduce((s, x) => s + Number(x.amount || 0), 0);
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const low = active.filter((s) => LOW.includes(s.usage_frequency));
  const hikeExtra = hikes.reduce((s, h) => s + (h.to - h.from), 0);
  const saving = low.reduce((s, x) => s + Number(x.amount || 0), 0) + hikeExtra;
  const top2 = [...active].sort((a, b) => b.amount - a.amount).slice(0, 2);
  const detectedTotal = detected.reduce((s, x) => s + Number(x.amount || 0), 0);
  const soon = active.filter((s) => nextIn(Number(s.renewal_day)) <= 7);
  const byCat = useMemo(() => { const m = {}; for (const s of active) { const k = s.category || 'Outros'; m[k] = (m[k] || 0) + Number(s.amount || 0); } return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, v], i) => ({ name, v, color: CAT_COLORS[i % CAT_COLORS.length] })); }, [active]);

  const planItems = [
    ...low.map((s) => ({ icon: AlertTriangle, t: `Cancelar ou pausar ${s.name}`, d: 'Marcada como pouco usada', v: Number(s.amount || 0) })),
    ...hikes.map((h) => ({ icon: TrendingUp, t: `Renegociar ${h.name}`, d: `Subiu de ${formatCurrency(h.from)} para ${formatCurrency(h.to)}`, v: h.to - h.from })),
  ].sort((a, b) => b.v - a.v);
  const topNotLow = top2.find((s) => !LOW.includes(s.usage_frequency));
  const checklist = [topNotLow && `Revisar plano de ${topNotLow.name}`, low[0] && `Avaliar cancelar ${low[0].name}`, hikes[0] && `Renegociar aumento de ${hikes[0].name}`, detected.length > 0 && `Cadastrar ${detected.length} recorrência(s) detectada(s)`].filter(Boolean).slice(0, 3);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  // posições orbitais (até 8 assinaturas), tamanho proporcional ao valor
  const orbitItems = [...active].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const maxAmt = Math.max(1, ...orbitItems.map((s) => Number(s.amount || 0)));
  const Orbit = ({ h = 220 }) => (
    <svg viewBox="0 0 400 240" className="w-full" style={{ height: h }}>
      <defs><radialGradient id="rcG" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#22d3ee" stopOpacity=".5" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></radialGradient></defs>
      {[46, 82, 116].map((r, i) => <ellipse key={r} cx="200" cy="120" rx={r * 1.35} ry={r * 0.85} fill="none" stroke={i % 2 ? '#a855f7' : '#22d3ee'} strokeOpacity=".35" strokeWidth="1.5" />)}
      <circle cx="200" cy="120" r="56" fill="url(#rcG)" />
      <circle cx="200" cy="120" r="30" fill="#0f172a" stroke="#22d3ee" strokeWidth="2.5" />
      <text x="200" y="129" textAnchor="middle" fontSize="24" fontWeight="900" fill="#5eead4" fontFamily="system-ui">M</text>
      {orbitItems.map((s, i) => { const ring = [82, 116][i % 2]; const a = (i / orbitItems.length) * Math.PI * 2 - Math.PI / 2; const x = 200 + Math.cos(a) * ring * 1.35; const y = 120 + Math.sin(a) * ring * 0.85; const r = 13 + (Number(s.amount || 0) / maxAmt) * 9; return (
        <g key={s.id}><circle cx={x} cy={y} r={r + 4} fill={s.color || '#6366f1'} opacity=".25" /><circle cx={x} cy={y} r={r} fill={s.color || '#6366f1'} stroke="#fff" strokeOpacity=".4" /><text x={x} y={y + 5} textAnchor="middle" fontSize={r * 0.95}>{s.icon_emoji || '📱'}</text><title>{`${s.name}: ${formatCurrency(s.amount)}`}</title></g>); })}
      {!orbitItems.length && <text x="200" y="210" textAnchor="middle" fontSize="12" fill="#94a3b8">Cadastre assinaturas para vê-las aqui</text>}
    </svg>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={RefreshCw} lead="Radar de Recorrências" accent="" iconClass="text-sky-400" subtitle="Detecta assinaturas, cobranças recorrentes e aumentos de preço — 100% local, sem IA de terceiros." />

      {!hideHero && (
        <section className="relative overflow-hidden rounded-3xl ring-1 ring-cyan-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(70%_140%_at_0%_0%,rgba(34,211,238,.18),transparent),radial-gradient(60%_140%_at_100%_100%,rgba(168,85,247,.25),transparent)] p-5 shadow-[0_0_40px_-12px_rgba(34,211,238,.5)]">
          <button onClick={() => setHideHero(true)} className="absolute top-3 right-3 p-1 text-muted hover:text-[hsl(var(--text))]" aria-label="Fechar"><X className="w-5 h-5" /></button>
          <div className="grid lg:grid-cols-[1.5fr_auto_1fr] gap-5 items-center">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] px-2.5 py-1 rounded-full bg-violet-500/25 ring-1 ring-violet-400/60 text-violet-700 dark:text-violet-100"><Sparkles className="w-3.5 h-3.5" />RECOMENDAÇÃO AUTOMÁTICA</span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold mt-2">{saving > 0 ? <>Você pode economizar <span className="text-cyan-500 dark:text-cyan-300">{formatCurrency(saving)}</span> por mês</> : 'Suas recorrências estão sob controle'}</h2>
              <p className="text-sm text-muted mt-1.5">{active.length ? <>Você gasta <b className="text-[hsl(var(--text))]">{formatCurrency(total)}/mês</b> em {active.length} assinaturas{top2.length ? <>, sendo {top2.map((s, i) => <span key={s.id}>{i ? ' e ' : ''}<b className="text-[hsl(var(--text))]">{s.name} ({formatCurrency(s.amount)})</b></span>)} {top2.length > 1 ? 'os maiores valores' : 'o maior valor'}</> : ''}. {saving > 0 ? 'A economia soma as assinaturas pouco usadas e os aumentos de preço detectados.' : 'Nenhuma pouco usada nem aumento de preço detectado.'}</> : 'Cadastre suas assinaturas para receber recomendações.'}</p>
            </div>
            <svg viewBox="0 0 200 150" className="hidden lg:block w-56 h-40" aria-hidden="true">
              <ellipse cx="100" cy="80" rx="92" ry="30" fill="none" stroke="#22d3ee" strokeOpacity=".6" strokeWidth="3" transform="rotate(-18 100 80)" />
              <ellipse cx="100" cy="80" rx="80" ry="22" fill="none" stroke="#a855f7" strokeOpacity=".6" strokeWidth="3" transform="rotate(14 100 80)" />
              <rect x="62" y="40" width="76" height="76" rx="20" fill="#312e81" stroke="#67e8f9" strokeWidth="3" />
              <text x="100" y="92" textAnchor="middle" fontSize="34" fontWeight="900" fill="#e0f2fe" fontFamily="system-ui">R$</text>
              <circle cx="160" cy="112" r="18" fill="#4f46e5" stroke="#c4b5fd" strokeWidth="2" /><text x="160" y="119" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff" fontFamily="system-ui">%</text>
              <circle cx="40" cy="58" r="15" fill="#4338ca" stroke="#a5b4fc" strokeWidth="2" /><path d="M32 58 L40 52 L48 58 L40 64 Z" fill="#c7d2fe" />
            </svg>
            <div className="space-y-2">
              {checklist.length ? checklist.map((c) => <p key={c} className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />{c}</p>) : <p className="text-sm text-muted">Nenhuma ação pendente.</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <GlowButton tone="violet" onClick={() => setPlan(true)} className="py-2.5 px-5">Ver plano de economia<ArrowRight className="w-4 h-4" /></GlowButton>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[[Layers, '#22d3ee', 'Assinaturas ativas', active.length, newThis.length ? `+${newThis.length} este mês` : '+0', 'sky'], [Wallet, '#a855f7', 'Custo/mês (cadastradas)', formatCurrency(total), delta != null && Math.abs(delta) > 0.05 ? `↑ +${delta.toFixed(0)}%` : null, 'rose', 'text-rose-500 dark:text-rose-400'], [BarChart3, '#38bdf8', 'Projeção anual', formatCurrency(total * 12), null], [AlertTriangle, '#f59e0b', 'Aumentos detectados', hikes.length, hikeExtra > 0 ? `+${formatCurrency(hikeExtra)}/mês` : null, 'amber', 'text-amber-500']].map(([Ic, c, l, v, chip, tone, cls]) => (
          <div key={l} className="rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 flex items-center gap-4" style={{ '--tw-ring-color': `${c}66`, boxShadow: `0 0 24px -12px ${c}` }}>
            <Ic className="w-12 h-12 shrink-0" style={{ color: c }} strokeWidth={1.5} />
            <div className="min-w-0"><p className="text-sm text-muted">{l}</p><div className="flex items-center gap-2"><p className={`font-display text-3xl font-extrabold truncate ${cls || ''}`}>{v}</p>{chip && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${tone === 'rose' ? 'bg-rose-500/15 text-rose-500' : tone === 'amber' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'}`}>{chip}</span>}</div></div>
          </div>))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-5" tone="sky" glow title="Radar de Assinaturas" icon={RefreshCw} iconClass="text-sky-400" subtitle="Visão orbital das suas recorrências e impacto no orçamento." action={<button onClick={() => setZoom(true)} className="p-1 text-muted hover:text-[hsl(var(--text))]" aria-label="Ampliar"><Maximize2 className="w-4 h-4" /></button>}>
          <div className="grid sm:grid-cols-[1fr_190px] gap-3 items-center">
            <Orbit />
            <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3">
              <p className="text-xs text-muted">Total mensal</p><p className="font-display text-xl font-extrabold text-rose-500">{formatCurrency(total)}</p>
              <div className="space-y-1.5 mt-2">{byCat.slice(0, 5).map((c) => <div key={c.name} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="tabular-nums">{Math.round(total ? (c.v / total) * 100 : 0)}%</span></div>)}</div>
              <button onClick={() => nav('/assinaturas')} className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg ring-1 ring-sky-400/50 hover:bg-sky-500/10">Ver todas as assinaturas<ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Aumentos de Preço" icon={TrendingUp} iconClass="text-fuchsia-400" subtitle="Cobranças que ficaram mais caras recentemente." action={hikes.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/40">{hikes.length} {hikes.length === 1 ? 'aumento' : 'aumentos'}</span>}>
          {hikes.length === 0 ? <div className="flex flex-col items-center py-8 text-muted"><CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-sm">Suas cobranças recorrentes estão estáveis.</p></div>
            : <div className="space-y-2">{hikes.slice(0, 4).map((h, i) => { const Ic = iconOf(h.name); return (
              <div key={i} className="flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5">
                <span className="w-10 h-10 rounded-xl grid place-items-center bg-violet-500/15 text-violet-400 shrink-0"><Ic className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{h.name}</p><p className="text-xs text-muted">{formatCurrency(h.from)} → <b className="text-rose-500">{formatCurrency(h.to)}</b> · {h.occurrences} cobranças</p></div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 ring-1 ring-rose-400/40">↑ +{h.changePct}%</span>
              </div>); })}</div>}
        </Panel>
        <Panel className="xl:col-span-3" tone="violet" title="Alertas e Atenções" icon={Bell} iconClass="text-rose-400" subtitle="O que merece sua atenção agora.">
          <div className="space-y-2">
            {[[CalendarDays, 'text-rose-400', `${soon.length} ${soon.length === 1 ? 'renovação' : 'renovações'} em até 7 dias`, `${formatCurrency(soon.reduce((s, x) => s + Number(x.amount || 0), 0))} em cobranças próximas`, () => nav('/calendario')], [Wallet, 'text-amber-400', `${low.length} ${low.length === 1 ? 'plano' : 'planos'} com possível economia`, low.length ? `${low.map((s) => s.name).slice(0, 2).join(', ')} pouco usados` : 'Informe a frequência de uso nas assinaturas', () => nav('/assinaturas')], [Database, 'text-violet-400', `${detected.length} recorrência(s) não cadastradas`, detected.length ? `~${formatCurrency(detectedTotal)}/mês fora do controle` : 'Tudo cadastrado', () => document.getElementById('rc-detected')?.scrollIntoView({ behavior: 'smooth' })]].map(([Ic, c, t, d, fn]) => (
              <button key={t} onClick={fn} className="w-full text-left flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5 hover:ring-violet-400/50 transition"><span className="w-10 h-10 rounded-xl grid place-items-center bg-black/5 dark:bg-white/5 shrink-0"><Ic className={`w-5 h-5 ${c}`} /></span><span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{t}</span><span className="block text-xs text-muted truncate">{d}</span></span><ChevronRight className="w-4 h-4 text-muted" /></button>))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel id="rc-detected" className="xl:col-span-7 scroll-mt-24" tone="sky" title="Assinaturas Detectadas no Histórico" icon={Database} iconClass="text-sky-400" subtitle={<>Cobranças que se repetem em 3+ meses com valor estável. {detectedTotal > 0 && <>~{formatCurrency(detectedTotal)}/mês (não cadastradas).</>}</>} action={<span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-violet-500/20 text-violet-600 dark:text-violet-200 ring-1 ring-violet-400/40">{detected.length} detectadas</span>}>
          {detected.length === 0 ? <p className="text-sm text-muted py-4">Não encontrei cobranças recorrentes fora das que você já cadastrou.</p> : (
            <div className="grid md:grid-cols-2 gap-2">{detected.map((d, i) => { const Ic = iconOf(d.name); return (
              <div key={i} className="group flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5">
                <span className="w-10 h-10 rounded-xl grid place-items-center bg-sky-500/15 text-sky-400 shrink-0"><Ic className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{d.name}</p><p className="text-xs text-muted">{d.months} meses · renova ~dia {d.renewal_day}</p></div>
                <b className="text-sm text-rose-500 whitespace-nowrap">{formatCurrency(d.amount)}/mês</b>
                <button onClick={() => addSub.mutate(d)} disabled={addSub.isPending} title="Cadastrar como assinatura" className="p-1.5 rounded-lg ring-1 ring-sky-400/40 text-sky-500 hover:bg-sky-500/10"><Plus className="w-4 h-4" /></button>
              </div>); })}</div>)}
        </Panel>
        <Panel className="xl:col-span-5" tone="violet" glow title="Insights automáticos" icon={Sparkles} iconClass="text-fuchsia-400" subtitle="Ações para otimizar seus gastos recorrentes." action={<span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-violet-500/20 text-violet-600 dark:text-violet-200 ring-1 ring-violet-400/40">3 ações recomendadas</span>}>
          <div className="space-y-2.5">
            {[[Database, 'text-emerald-400', saving > 0 ? <>Economize até <span className="text-emerald-600 dark:text-emerald-300">{formatCurrency(saving)}/mês</span></> : 'Nenhuma economia óbvia', `${planItems.length} item(ns) no plano de economia.`, 'Simular economia', () => setPlan(true), 'emerald'], [Zap, 'text-amber-400', 'Reduza aumentos futuros', 'Ative avisos para cobranças e vencimentos.', 'Ativar alertas', () => nav('/notificacoes'), 'violet'], [Brain, 'text-pink-400', 'Leitura com IA', ai.data ? 'Análise salva — abra para ler.' : 'Gere uma análise das suas recorrências.', ai.data ? 'Ver análise' : 'Analisar', () => { setPlan(true); if (!ai.data) ai.gerar(); }, 'sky']].map(([Ic, c, t, d, b, fn, tone]) => (
              <div key={b} className="flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5">
                <span className="w-10 h-10 rounded-xl grid place-items-center bg-black/5 dark:bg-white/5 shrink-0"><Ic className={`w-5 h-5 ${c}`} /></span>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></div>
                <button onClick={fn} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl ring-1 ${tone === 'emerald' ? 'ring-emerald-400/60 text-emerald-600 dark:text-emerald-300' : tone === 'violet' ? 'ring-violet-400/60 text-violet-600 dark:text-violet-200' : 'ring-sky-400/60 text-sky-600 dark:text-sky-300'}`}>{b}</button>
              </div>))}
          </div>
        </Panel>
      </div>

      <Modal open={plan} onClose={() => setPlan(false)} title="Plano de economia" maxWidth="max-w-xl" footer={<Button onClick={() => setPlan(false)}>Fechar</Button>}>
        {planItems.length === 0 ? <p className="text-sm text-muted">Nenhuma assinatura pouco usada nem aumento de preço encontrado.</p> : (
          <div className="divide-y divide-[hsl(var(--border))]">{planItems.map((p, k) => <div key={k} className="flex items-center gap-3 py-2"><p.icon className="w-5 h-5 text-amber-400" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{p.t}</p><p className="text-xs text-muted">{p.d}</p></div><b className="text-emerald-600 dark:text-emerald-300 text-sm">{formatCurrency(p.v)}/mês</b></div>)}
            <p className="pt-2 text-sm flex justify-between"><span>Total possível</span><b>{formatCurrency(saving)}/mês · {formatCurrency(saving * 12)}/ano</b></p></div>)}
        <div className="mt-4 rounded-xl ring-1 ring-violet-400/40 p-3">
          <div className="flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-violet-400" /><b className="text-sm">Análise com IA</b>{ai.data && <span className="text-[11px] text-muted inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3 h-3" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>}<button onClick={() => ai.gerar()} disabled={ai.busy} className="ml-auto text-xs font-semibold text-sky-500">{ai.busy ? 'Analisando…' : ai.data ? 'Gerar de novo' : 'Gerar'}</button></div>
          {ai.busy ? <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Analisando…</p> : ai.data ? <Markdown text={ai.data.text} className="text-sm" /> : <p className="text-sm text-muted">Peça uma leitura personalizada das suas recorrências.</p>}
        </div>
      </Modal>
      <Modal open={zoom} onClose={() => setZoom(false)} title="Radar de Assinaturas" maxWidth="max-w-3xl" footer={<Button onClick={() => setZoom(false)}>Fechar</Button>}>
        <Orbit h={420} />
        <div className="grid sm:grid-cols-2 gap-1.5 mt-2">{orbitItems.map((s) => <p key={s.id} className="text-sm flex justify-between"><span>{s.icon_emoji} {s.name}</span><b>{formatCurrency(s.amount)} · {pct1(total ? (s.amount / total) * 100 : 0)}</b></p>)}</div>
      </Modal>
    </div>
  );
}
