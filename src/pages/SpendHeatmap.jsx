import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, CreditCardTransaction, Category } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, Ring, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { CalendarArt, BrainArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Flame, CalendarDays, ChevronDown, Database, BarChart3, Sparkles, Cpu, TrendingUp, TrendingDown, Layers, Info, ArrowRight } from 'lucide-react';

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const LV = [['Sem gasto', 'bg-indigo-400/40', null], ['Baixo', 'bg-emerald-500', '#10b981'], ['Médio', 'bg-amber-400', '#fbbf24'], ['Alto', 'bg-orange-500', '#f97316'], ['Muito alto', 'bg-pink-500', '#ec4899']];
const RANKC = ['bg-pink-500', 'bg-orange-500', 'bg-amber-400'];

export default function SpendHeatmap() {
  const [meses, setMeses] = useState('6');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ai = useAiAnalysis({ storageKey: 'heatmap', agentFocus: 'padrão de gastos', prompt: 'Analise em quais dias eu mais gasto (dia da semana e período do mês). Em até 3 frases, aponte o padrão e dê 1 dica prática para suavizar os picos.' });

  const r = useMemo(() => {
    const tx = combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense');
    const byDay = {}; const catsByDay = {};
    for (const t of tx) { const d = String(t.date).slice(0, 10); const v = Number(t.amount || 0); byDay[d] = (byDay[d] || 0) + v; (catsByDay[d] = catsByDay[d] || {})[t.category_id || 'none'] = (catsByDay[d]?.[t.category_id || 'none'] || 0) + v; }
    const now = new Date(); const nM = Number(meses);
    const start = new Date(now.getFullYear(), now.getMonth() - nM + 1, 1); const pStart = new Date(now.getFullYear(), now.getMonth() - 2 * nM + 1, 1);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const sIso = iso(start), pIso = iso(pStart), today = iso(now);
    const days = Object.entries(byDay).filter(([d]) => d >= sIso && d <= today).map(([d, v]) => ({ d, v })).sort((a, b) => b.v - a.v);
    const prevDays = Object.entries(byDay).filter(([d]) => d >= pIso && d < sIso);
    const total = days.reduce((s, x) => s + x.v, 0); const prevTotal = prevDays.reduce((s, [, v]) => s + v, 0);
    const media = days.length ? total / days.length : 0; const prevMedia = prevDays.length ? prevTotal / prevDays.length : 0;
    const vals = days.map((x) => x.v).sort((a, b) => a - b); const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
    const t1 = q(0.25), t2 = q(0.6), t3 = q(0.85);
    const level = (v) => (!v ? 0 : v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4);
    const grids = [];
    for (let m = nM - 1; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1); const y = dt.getFullYear(), mon = dt.getMonth();
      const cells = []; for (let i = 0; i < new Date(y, mon, 1).getDay(); i++) cells.push(null);
      let tot = 0; const dim = new Date(y, mon + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) { const key = `${y}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const v = byDay[key] || 0; tot += v; cells.push({ d, v, key, lv: level(v), future: key > today }); }
      grids.push({ label: `${MES[mon]}/${String(y).slice(2)}`, cells, tot });
    }
    const calDays = Math.round((now - start) / 86400000) + 1;
    // concentração: quantos dias somam 70% do gasto
    let acc = 0, nTop = 0; for (const x of days) { acc += x.v; nTop++; if (acc >= total * 0.7) break; }
    const avgMonthDays = nTop / nM;
    // picos (nível muito alto) e intervalo médio entre eles
    const peaks = days.filter((x) => level(x.v) === 4).map((x) => x.d).sort();
    let gap = null; if (peaks.length > 1) { let g = 0; for (let i = 1; i < peaks.length; i++) g += (new Date(peaks[i]) - new Date(peaks[i - 1])) / 86400000; gap = Math.round(g / (peaks.length - 1)); }
    const pc = {}; for (const d of peaks) for (const [cid, v] of Object.entries(catsByDay[d] || {})) pc[cid] = (pc[cid] || 0) + v;
    const pcTot = Object.values(pc).reduce((s, v) => s + v, 0) || 1;
    const peakCats = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cid, v]) => ({ cat: catMap[cid], name: catMap[cid]?.name || 'Sem categoria', p: (v / pcTot) * 100 }));
    // tendência por semana do mês (1–5)
    const wk = [0, 0, 0, 0, 0]; for (const x of days) wk[Math.min(4, Math.floor((Number(x.d.slice(8)) - 1) / 7))] += x.v;
    const weeks = wk.map((v, i) => ({ name: `Sem ${i + 1}`, v: Math.round(v / nM) }));
    const dom = {}; for (const x of days) { const k = Number(x.d.slice(8)); dom[k] = (dom[k] || 0) + x.v; }
    const hotDom = Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => Number(d)).sort((a, b) => a - b);
    return { grids, total, prevTotal, media, prevMedia, days, top3: days.slice(0, 3), calDays, nTop, avgMonthDays, gap, peakCats, weeks, hotDom, period: `${MES[start.getMonth()]}/${start.getFullYear()} – ${MES[now.getMonth()]}/${now.getFullYear()}` };
  }, [transactions, cardTxs, meses, catMap]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;
  const dT = r.prevTotal > 0 ? ((r.total - r.prevTotal) / r.prevTotal) * 100 : null;
  const dM = r.prevMedia > 0 ? ((r.media - r.prevMedia) / r.prevMedia) * 100 : null;
  const pctDays = r.calDays ? (r.days.length / r.calDays) * 100 : 0;
  const br = (d) => d.split('-').reverse().join('/');
  const conc = r.total ? Math.round(r.avgMonthDays) : 0;

  const Kpi = ({ icon: Ic, c, label, value, sub, cls, right }) => (
    <div className="relative overflow-hidden rounded-2xl ring-1 bg-[hsl(var(--card))] p-4 flex items-center gap-3 min-w-0" style={{ '--tw-ring-color': `${c}66`, boxShadow: `0 0 24px -12px ${c}` }}>
      <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${c}26`, color: c }}><Ic className="w-6 h-6" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted">{label}</p><p className={`font-display text-xl font-extrabold truncate ${cls || ''}`}>{value}</p>{sub && <p className="text-[11px] text-muted">{sub}</p>}</div>{right}
      <svg viewBox="0 0 100 30" className="absolute right-2 bottom-1 w-24 h-7 opacity-60" aria-hidden="true"><path d="M0 26 C20 24 35 18 50 22 S80 6 100 10" stroke={c} strokeWidth="2.5" fill="none" /></svg>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
        <div className="space-y-4 min-w-0">
          <HeroTitle icon={Flame} lead="Calendário de Calor" accent="" iconClass="text-pink-400" subtitle="Visualize os dias com maior intensidade de gastos e identifique padrões no seu comportamento financeiro." />

          <section className="rounded-2xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(60%_160%_at_0%_50%,rgba(168,85,247,.2),transparent)] p-4 flex flex-col md:flex-row md:items-center gap-4">
            <Sparkles className="w-10 h-10 text-violet-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold flex items-center gap-2">Padrão de dias {ai.data && <span className="text-[11px] text-muted font-normal inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-sky-400" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>}</p>
              {ai.busy ? <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Analisando…</p> : ai.data ? <div className="text-sm max-h-24 overflow-y-auto"><Markdown text={ai.data.text} /></div>
                : <p className="text-sm text-muted">{r.total ? <>Você concentra <b className="text-[hsl(var(--text))]">70% dos seus gastos em cerca de {conc} {conc === 1 ? 'dia' : 'dias'} por mês</b>{r.hotDom.length ? <>, com picos recorrentes perto dos dias <b className="text-[hsl(var(--text))]">{r.hotDom.join(', ')}</b></> : ''}.</> : 'Sem despesas no período.'}</p>}
            </div>
            <GlowButton tone="violet" onClick={() => ai.gerar()} disabled={ai.busy} className="shrink-0 py-2.5 px-5">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Gerar de novo' : 'Analisar com IA'}</GlowButton>
          </section>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
            <CalendarDays className="w-5 h-5 text-muted" /><span className="text-sm">Período</span>
            <label className="relative"><select value={meses} onChange={(e) => setMeses(e.target.value)} className="appearance-none rounded-xl ring-1 ring-[hsl(var(--border))] bg-black/5 dark:bg-white/5 pl-3 pr-9 py-2 text-sm font-semibold outline-none min-w-[200px]"><option value="3" className="bg-[hsl(var(--card))]">Últimos 3 meses</option><option value="6" className="bg-[hsl(var(--card))]">Últimos 6 meses</option><option value="12" className="bg-[hsl(var(--card))]">Últimos 12 meses</option></select><ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></label>
            <span className="ml-auto text-sm text-muted flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{r.period}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi icon={Database} c="#f472b6" label="Total no período" value={formatCurrency(r.total)} cls="text-pink-500" />
            <Kpi icon={BarChart3} c="#38bdf8" label="Média por dia com gasto" value={formatCurrency(r.media)} />
            <Kpi icon={Flame} c="#f43f5e" label="Dia mais caro" value={formatCurrency(r.top3[0]?.v || 0)} sub={r.top3[0] ? br(r.top3[0].d) : '—'} />
            <Kpi icon={CalendarDays} c="#818cf8" label="Dias com gasto" value={r.days.length} right={<Ring value={pctDays} size={56} stroke={6} from="#22d3ee" to="#6366f1"><span className="text-[11px] font-bold">{Math.round(pctDays)}%</span></Ring>} />
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {r.grids.map((g) => (
              <section key={g.label} className="rounded-2xl ring-1 ring-violet-400/30 bg-[hsl(var(--card))] p-4">
                <div className="flex items-center justify-between mb-2"><p className="font-display font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-pink-400" />{g.label}</p><p className="text-xs text-muted">Total: <b className="text-[hsl(var(--text))]">{formatCurrency(g.tot)}</b></p></div>
                <div className="grid grid-cols-7 gap-1.5 mb-1">{WD.map((w, i) => <div key={i} className="text-[11px] text-center text-muted">{w}</div>)}</div>
                <div className="grid grid-cols-7 gap-1.5">
                  {g.cells.map((c, i) => c === null ? <div key={i} /> : (
                    <div key={i} title={`${br(c.key)}: ${formatCurrency(c.v)}`} className={`aspect-[1.15] rounded-lg grid place-items-center text-xs font-semibold ${c.future ? 'opacity-30 bg-black/5 dark:bg-white/5' : c.lv ? `${LV[c.lv][1]} text-white shadow-[0_0_10px_rgba(0,0,0,.2)]` : 'bg-black/5 dark:bg-white/[.06]'}`} style={c.lv >= 3 ? { boxShadow: `0 0 12px ${LV[c.lv][2]}aa` } : undefined}>{c.d}</div>))}
                </div>
              </section>))}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-semibold"><Layers className="w-4 h-4 text-violet-400" />Intensidade de gastos (calor) <span title="Níveis pelos quartis dos seus próprios dias com gasto no período."><Info className="w-3.5 h-3.5 text-muted" /></span></span>
            {LV.map(([l, cls]) => <span key={l} className="flex items-center gap-1.5 text-muted"><span className={`w-3.5 h-3.5 rounded-full ${cls}`} />{l}</span>)}
          </div>

          <section className="rounded-3xl ring-1 ring-cyan-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(50%_140%_at_0%_50%,rgba(34,211,238,.14),transparent)] p-4 flex flex-col md:flex-row md:items-center gap-4">
            <BrainArt className="hidden md:block w-40 h-24 shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-[11px] font-bold tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300">INSIGHT PRINCIPAL</p>
              <p className="text-sm mt-1">{r.gap ? <>Seus maiores picos ocorrem, em média, <b>a cada {r.gap} dias</b>{r.peakCats.length ? <>, especialmente em <b>{r.peakCats.slice(0, 2).map((c) => c.name).join(' e ')}</b></> : ''}. Distribuir essas despesas ao longo do mês ajuda a evitar apertos.</> : 'Ainda não há picos suficientes para identificar um ritmo.'}</p></div>
            <button onClick={() => ai.gerar()} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-cyan-400/60 hover:bg-cyan-500/10"><TrendingUp className="w-4 h-4" />Ver recomendações<ArrowRight className="w-4 h-4" /></button>
          </section>
        </div>

        <div className="space-y-5">
          <Panel tone="violet" title="Destaques do período" icon={BarChart3} iconClass="text-sky-400">
            <div className="space-y-2">
              {[[dT != null && dT >= 0 ? TrendingUp : TrendingDown, dT != null && dT >= 0 ? 'text-pink-400' : 'text-emerald-400', dT == null ? '—' : `${dT >= 0 ? '+' : '−'}${pct1(Math.abs(dT))}`, `vs. ${meses} meses anteriores`], [dM != null && dM >= 0 ? TrendingUp : TrendingDown, dM != null && dM >= 0 ? 'text-pink-400' : 'text-emerald-400', dM == null ? '—' : `${dM >= 0 ? '+' : '−'}${pct1(Math.abs(dM))}`, 'na média por dia com gasto'], [CalendarDays, 'text-emerald-400', `${r.days.length} dias`, 'com movimentação']].map(([Ic, c, v, d], k) => (
                <div key={k} className="flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2"><span className="w-10 h-10 rounded-xl grid place-items-center bg-black/5 dark:bg-white/5"><Ic className={`w-5 h-5 ${c}`} /></span><div><p className={`font-display text-lg font-bold ${c}`}>{v}</p><p className="text-xs text-muted">{d}</p></div></div>))}
            </div>
          </Panel>
          <Panel tone="violet" title="Tendência por semana" icon={BarChart3} iconClass="text-sky-400" subtitle="Média mensal por semana do mês">
            <div style={{ height: 150 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={r.weeks} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs><linearGradient id="hmW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={50} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} /><Area type="monotone" dataKey="v" stroke="#c084fc" strokeWidth={3} fill="url(#hmW)" dot={{ r: 3, fill: '#f5d0fe' }} /></AreaChart></ResponsiveContainer></div>
          </Panel>
          <Panel tone="violet" title="Dias mais intensos" icon={Flame} iconClass="text-pink-400">
            {r.top3.length ? r.top3.map((x, i) => <div key={x.d} className="flex items-center gap-3 py-1.5"><span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold text-white ${RANKC[i]}`}>{i + 1}</span><span className="flex-1 text-sm">{br(x.d)}</span><b className="text-pink-500">{formatCurrency(x.v)}</b></div>) : <p className="text-sm text-muted">Sem gastos no período.</p>}
          </Panel>
          <Panel tone="violet" title="Categorias mais presentes nos picos" icon={Layers} iconClass="text-violet-400">
            {r.peakCats.length ? r.peakCats.map((c) => { const Ic = categoryIcon(c.cat || { name: c.name }); return (
              <div key={c.name} className="flex items-center gap-3 py-1.5"><Ic className="w-6 h-6 text-violet-400 shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm truncate">{c.name}</p><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${c.p}%` }} /></div></div><span className="text-sm w-12 text-right">{Math.round(c.p)}%</span></div>); }) : <p className="text-sm text-muted">Sem picos no período.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
