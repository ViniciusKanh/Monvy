import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, CreditCardTransaction, Category } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, Modal, Button } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, Donut, DeltaChip, TIP, pct1 } from '../components/kit.jsx';
import { AntArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses, detectSubscriptions } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import { Bug, ShoppingCart, ShoppingBag, Layers, Target, TrendingUp, Trophy, Brain, Cpu, Sparkles, Bell, ChevronRight, ArrowRight, Search, Repeat, CalendarDays, Crown, Zap, Scissors, PauseCircle } from 'lucide-react';

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const norm = (s) => String(s || 'Sem descrição').toLowerCase().replace(/\d+/g, '').replace(/[*#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'sem descrição';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PAL = ['#a855f7', '#22d3ee', '#f97316', '#ec4899', '#94a3b8', '#10b981', '#6366f1'];
const mkOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function SmallSpends() {
  const [teto, setTeto] = useState('50');
  const [all, setAll] = useState(false);
  const sugRef = useRef(null);
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ai = useAiAnalysis({ storageKey: 'antspend', agentFocus: 'gastos-formiga', prompt: 'Analise meus pequenos gastos recorrentes (gastos-formiga). Em até 3 frases, diga quais hábitos mais pesam e sugira 2 cortes simples que liberam dinheiro no mês.' });

  const r = useMemo(() => {
    const lim = n(teto);
    const exp = combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense' && n(t.amount) > 0);
    const small = exp.filter((t) => n(t.amount) <= lim);
    const now = new Date(); const m3 = [0, 1, 2].map((i) => mkOf(new Date(now.getFullYear(), now.getMonth() - i, 1))); const p3 = [3, 4, 5].map((i) => mkOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const S3 = new Set(m3), P3 = new Set(p3);
    const grupos = {}; let total = 0, count = 0, prevTotal = 0;
    for (const t of small) {
      const mk = String(t.date).slice(0, 7);
      if (P3.has(mk)) prevTotal += n(t.amount);
      if (!S3.has(mk)) continue;
      const key = norm(t.description);
      const g = (grupos[key] = grupos[key] || { key, nome: cap(key), count: 0, total: 0, meses: new Set(), cats: {} });
      g.count++; g.total += n(t.amount); g.meses.add(mk); g.cats[t.category_id || 'none'] = (g.cats[t.category_id || 'none'] || 0) + 1;
      total += n(t.amount); count++;
    }
    const lista = Object.values(grupos).filter((g) => g.count >= 3).map((g) => { const cid = Object.entries(g.cats).sort((a, b) => b[1] - a[1])[0][0]; return { ...g, nMeses: g.meses.size, mensal: g.total / 3, anual: (g.total / 3) * 12, media: g.total / g.count, cat: catMap[cid] }; }).sort((a, b) => b.total - a.total);
    const keys = new Set(lista.map((g) => g.key));
    const evo = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); const mk = mkOf(d); return { name: `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, v: Math.round(small.filter((t) => String(t.date).slice(0, 7) === mk && keys.has(norm(t.description))).reduce((s, t) => s + n(t.amount), 0) * 100) / 100 }; });
    const byCat = {}; for (const g of lista) { const k = g.cat?.name || 'Outros'; byCat[k] = (byCat[k] || 0) + g.anual; }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: catMap ? (categories.find((c) => c.name === name)?.color || PAL[i % PAL.length]) : PAL[i] }));
    const anual = lista.reduce((s, g) => s + g.anual, 0);
    const recurring = detectSubscriptions(exp).filter((d) => d.amount > lim && !/fatura|cart[ãa]o de cr/i.test(d.name)).slice(0, 4);
    return { lista, total, count, prevTotal, anual, mensal: anual / 12, evo, cats, recurring };
  }, [transactions, cardTxs, teto, catMap, categories]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;
  const delta = r.prevTotal > 0 ? ((r.total - r.prevTotal) / r.prevTotal) * 100 : null;
  const last = r.evo[r.evo.length - 1];
  const maxG = Math.max(1, ...r.lista.map((g) => g.anual));
  const sugs = r.lista.slice(0, 6).map((g, i) => [
    { icon: Zap, tone: 'emerald', t: `Reduza ${g.nome}`, d: `${g.count} compras em 3 meses (média ${formatCurrency(g.media)}). Cortar pela metade:`, v: g.anual / 2 },
    { icon: Scissors, tone: 'violet', t: `Agrupe ${g.nome}`, d: `Juntar as compras de ${g.nome} em menos vezes evita gastos por impulso. Reduzindo 1/3:`, v: g.anual / 3 },
    { icon: PauseCircle, tone: 'sky', t: `Pause ${g.nome}`, d: `Fazer uma pausa de 1 mês em ${g.nome} economiza o equivalente a:`, v: g.mensal },
  ][i % 3]);
  const TONE = { emerald: ['ring-emerald-400/60 bg-emerald-500/10', 'text-emerald-400', 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-200'], violet: ['ring-violet-400/60 bg-violet-500/10', 'text-violet-400', 'bg-violet-500/25 text-violet-700 dark:text-violet-200'], sky: ['ring-sky-400/60 bg-sky-500/10', 'text-sky-400', 'bg-sky-500/25 text-sky-700 dark:text-sky-200'] };

  const Kpi = ({ icon: Ic, label, children, right, c }) => (
    <div className="rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 flex items-center gap-3" style={{ '--tw-ring-color': `${c}66` }}>
      <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: `${c}26`, color: c }}><Ic className="w-6 h-6" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm text-muted">{label}</p>{children}</div>{right}
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_540px] gap-5">
        <div className="space-y-4 min-w-0">
          <HeroTitle icon={Bug} lead="Detector de Gastos-Formiga" accent="" iconClass="text-amber-400" subtitle="Pequenas compras que se repetem e, somadas, pesam no fim do mês — tudo analisado localmente" />
          <section className="rounded-2xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(60%_160%_at_0%_50%,rgba(168,85,247,.18),transparent)] p-4">
            <div className="flex items-center gap-2 flex-wrap"><Brain className="w-5 h-5 text-violet-400" /><b className="font-display">Ataque às formigas</b><span className="text-[11px] text-muted inline-flex items-center gap-1">{ai.data?.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-sky-400" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>
              <button onClick={() => ai.gerar()} disabled={ai.busy} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-violet-400/60 hover:bg-violet-500/10">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Gerar de novo' : 'Analisar'}</button></div>
            <div className="text-sm mt-2 max-h-28 overflow-y-auto">{ai.busy ? <span className="text-muted">Analisando seus pequenos gastos…</span> : ai.data ? <Markdown text={ai.data.text} /> : <span className="text-muted">{r.lista.length ? `Você tem ${r.lista.length} grupo(s) de pequenas compras recorrentes somando ${formatCurrency(r.mensal)}/mês. Os maiores: ${r.lista.slice(0, 3).map((g) => `${g.nome} (${formatCurrency(g.mensal)}/mês)`).join(', ')}.` : 'Nenhum gasto-formiga encontrado com o limite atual.'}</span>}</div>
          </section>
        </div>
        <div className="relative">
          <AntArt className="hidden xl:block absolute -top-8 right-4 w-[440px] h-36 pointer-events-none" />
          <section className="relative xl:mt-28 rounded-3xl ring-2 ring-orange-400/70 p-5 bg-[hsl(var(--card))] bg-[linear-gradient(120deg,rgba(234,88,12,.35),rgba(190,24,93,.35))] shadow-[0_0_40px_-10px_rgba(249,115,22,.7)]">
            <p className="font-semibold flex items-center gap-2"><CalendarDays className="w-5 h-5" />Suas formigas custam por ano</p>
            <p className="font-display text-5xl font-extrabold mt-1 bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent"><AnimatedValue value={r.anual} format={formatCurrency} /></p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full ring-1 ring-orange-300/60 bg-black/15">≈ {formatCurrency(r.mensal)}/mês em pequenas compras recorrentes</p>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={ShoppingCart} c="#a855f7" label="Total (3 meses)" right={<DeltaChip v={delta} invert />}><p className="font-display text-2xl font-bold">{formatCurrency(r.total)}</p></Kpi>
        <Kpi icon={ShoppingBag} c="#38bdf8" label="Pequenas compras" right={<svg viewBox="0 0 40 30" className="w-10 h-8" aria-hidden="true">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 10} y={30 - (8 + i * 7)} width="7" height={8 + i * 7} rx="1.5" fill="#22d3ee" />)}</svg>}><p className="font-display text-2xl font-bold">{r.count}</p></Kpi>
        <Kpi icon={Layers} c="#818cf8" label="Grupos recorrentes"><p className="font-display text-2xl font-bold">{r.lista.length}</p></Kpi>
        <Kpi icon={Target} c="#22d3ee" label="Compras até (R$)"><input type="number" min="1" value={teto} onChange={(e) => setTeto(e.target.value)} aria-label="Valor máximo de uma pequena compra" className="font-display text-2xl font-bold bg-transparent w-24 outline-none border-b border-dashed border-[hsl(var(--border))] focus:border-cyan-400" /><p className="text-[11px] text-muted">Compras pequenas que aparecem 3+ vezes nos últimos 3 meses.</p></Kpi>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-4" tone="violet" title="Evolução das formigas" icon={TrendingUp} iconClass="text-violet-400" subtitle="Total de pequenos gastos recorrentes (mensal)">
          <div style={{ height: 210 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={r.evo} margin={{ top: 34, right: 16, left: 0, bottom: 0 }}>
            <defs><linearGradient id="ssA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.55} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${Math.round(v)}`} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
            <Area type="monotone" dataKey="v" stroke="#c084fc" strokeWidth={3} fill="url(#ssA)" dot={{ r: 3, fill: '#f5d0fe' }} />
            {last && <ReferenceDot x={last.name} y={last.v} r={6} fill="#fff" stroke="#a855f7" strokeWidth={3} label={{ value: formatCurrency(last.v), position: 'top', fill: 'hsl(var(--text))', fontSize: 11, fontWeight: 700 }} />}
          </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Por grupo de gasto" icon={ShoppingBag} iconClass="text-sky-400" subtitle="Custo anual por categoria">
          {r.cats.length === 0 ? <p className="text-sm text-muted">Sem formigas no período.</p> : (
            <div className="flex items-center gap-4"><Donut size={160} thickness={0.24} data={r.cats} center={<><span className="font-display font-bold text-sm">{formatCurrency(r.anual)}</span><span className="text-[10px] text-muted">/ ano</span></>} />
              <div className="flex-1 min-w-0 space-y-2">{r.cats.slice(0, 5).map((c) => <div key={c.name} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="tabular-nums">{Math.round(r.anual ? (c.value / r.anual) * 100 : 0)}%</span></div>)}</div></div>)}
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Ranking dos grupos recorrentes" icon={Trophy} iconClass="text-amber-400">
          {r.lista.length === 0 ? <p className="text-sm text-muted">Nenhum grupo recorrente.</p> : r.lista.slice(0, 4).map((g, i) => { const Ic = categoryIcon(g.cat || { name: g.nome }); return (
            <div key={g.key} className="flex items-center gap-3 py-1.5">
              <span className={`w-7 h-7 rounded-lg grid place-items-center text-xs font-bold ${i === 0 ? 'bg-amber-400 text-amber-950' : 'bg-black/5 dark:bg-white/10'}`}>{i === 0 ? <Crown className="w-4 h-4" /> : i + 1}</span>
              <Ic className="w-5 h-5 text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0"><div className="flex justify-between gap-2"><p className="text-sm font-semibold truncate">{g.nome}</p><b className="text-sm whitespace-nowrap">{formatCurrency(g.anual)}/ano</b></div><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${(g.anual / maxG) * 100}%` }} /></div></div>
            </div>); })}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="violet" title="Sugestões para economia" icon={Sparkles} iconClass="text-emerald-400" action={sugs.length > 3 && <button onClick={() => sugRef.current?.scrollBy({ left: 260, behavior: 'smooth' })} className="w-8 h-8 rounded-full ring-1 ring-[hsl(var(--border))] grid place-items-center" aria-label="Mais sugestões"><ChevronRight className="w-4 h-4" /></button>}>
          {sugs.length === 0 ? <p className="text-sm text-muted">Sem sugestões por enquanto.</p> : (
            <div ref={sugRef} className="flex gap-3 overflow-x-auto snap-x pb-1">{sugs.map((s, k) => { const T = TONE[s.tone]; return (
              <div key={k} className={`snap-start shrink-0 w-[240px] rounded-2xl ring-1 p-3.5 flex flex-col ${T[0]}`}>
                <p className="font-semibold flex items-center gap-2"><s.icon className={`w-5 h-5 ${T[1]}`} />{s.t}</p><p className="text-xs text-muted mt-1.5 flex-1">{s.d}</p>
                <span className={`mt-3 text-center text-xs font-bold px-2 py-1.5 rounded-lg ${T[2]}`}>Economia: {formatCurrency(s.v)}{s.tone === 'sky' ? '' : '/ano'}</span>
              </div>); })}</div>)}
        </Panel>
        <Panel className="xl:col-span-5" tone="violet" title="Alertas por recorrência" icon={Bell} iconClass="text-amber-400" subtitle={`Cobranças recorrentes acima de ${formatCurrency(n(teto))}`}>
          {r.recurring.length === 0 ? <p className="text-sm text-muted">Nenhuma cobrança recorrente maior detectada.</p> : r.recurring.map((d) => (
            <div key={d.name} className="flex items-center gap-3 py-1.5"><span className="w-10 h-10 rounded-xl grid place-items-center bg-amber-500/15 text-amber-400 shrink-0"><Repeat className="w-5 h-5" /></span><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{d.name}</p><p className="text-xs text-muted">Cobrança recorrente há {d.months} meses.</p></div><b className="text-sm text-rose-500 whitespace-nowrap">{formatCurrency(d.amount)}/mês</b></div>))}
        </Panel>
      </div>

      <Panel tone="violet" title="Onde as formigas se escondem" icon={Search} iconClass="text-sky-400" action={r.lista.length > 6 && <button onClick={() => setAll(true)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl ring-1 ring-[hsl(var(--border))]">Ver todas ({r.lista.length})<ArrowRight className="w-3.5 h-3.5" /></button>}>
        {r.lista.length === 0 ? <p className="text-sm text-muted">Não há pequenas compras recorrentes no período com esse limite.</p> : (
          <div className="grid md:grid-cols-2 gap-x-6">{r.lista.slice(0, 6).map((g) => { const Ic = categoryIcon(g.cat || { name: g.nome }); return (
            <div key={g.key} className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))]"><span className="w-9 h-9 rounded-lg grid place-items-center bg-amber-500/10 text-amber-500 shrink-0"><Ic className="w-4 h-4" /></span><div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{g.nome}</p><p className="text-xs text-muted">{g.count}× · média {formatCurrency(g.media)} · {g.nMeses} {g.nMeses > 1 ? 'meses' : 'mês'}</p></div><div className="text-right"><p className="text-sm font-semibold text-rose-500">{formatCurrency(g.anual)}/ano</p><p className="text-[11px] text-muted">{formatCurrency(g.mensal)}/mês</p></div></div>); })}</div>)}
      </Panel>

      <Modal open={all} onClose={() => setAll(false)} title={`Gastos-formiga (${r.lista.length})`} maxWidth="max-w-2xl" footer={<Button onClick={() => setAll(false)}>Fechar</Button>}>
        <div className="divide-y divide-[hsl(var(--border))] max-h-[60vh] overflow-y-auto">{r.lista.map((g) => <div key={g.key} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 truncate">{g.nome} <span className="text-muted">· {g.count}× · média {formatCurrency(g.media)}</span></span><b className="text-rose-500">{formatCurrency(g.anual)}/ano</b></div>)}</div>
      </Modal>
    </div>
  );
}
