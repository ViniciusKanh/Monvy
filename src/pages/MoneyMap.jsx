import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner, EmptyState } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { Panel, Donut, DeltaChip, GlowButton, pct1 } from '../components/kit.jsx';
import { CardFlowArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { BarChart3, CalendarDays, ChevronDown, Layers, Store, Filter, RotateCcw, Sparkles, Cpu, Brain, Trophy, ArrowRight, MoreHorizontal, Wallet, PieChart as PieIcon } from 'lucide-react';

const PALETTE = ['#a855f7', '#14b8a6', '#f43f5e', '#06b6d4', '#f59e0b', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#0ea5e9', '#10b981', '#eab308'];
const PERIODS = [['1', 'Este mês'], ['3', 'Últimos 3 meses'], ['6', 'Últimos 6 meses'], ['12', 'Últimos 12 meses'], ['all', 'Todo o histórico']];
const mkList = (k, off = 0) => { const out = []; const now = new Date(); for (let i = 0; i < k; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i - off, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); } return out; };

export default function MoneyMap() {
  const nav = useNavigate();
  const [periodo, setPeriodo] = useState('3');
  const [comparar, setComparar] = useState('prev');
  const [catF, setCatF] = useState('all');
  const [estF, setEstF] = useState('all');
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const ai = useAiAnalysis({ storageKey: 'moneymap', agentFocus: 'gastos por categoria', prompt: 'Olhando minhas categorias de gasto, diga em até 3 frases para onde meu dinheiro está indo e qual categoria tem mais potencial de corte.' });

  const exp = useMemo(() => combineExpenses(transactions, cardTxs).filter((t) => t.type === 'expense'), [transactions, cardTxs]);
  const n = periodo === 'all' ? null : Number(periodo);
  const inP = useMemo(() => (n ? new Set(mkList(n)) : null), [n]);
  const prevP = useMemo(() => (n ? new Set(mkList(n, n)) : null), [n]);
  const catName = (t) => catMap[t.category_id]?.name || 'Sem categoria';
  const est = (t) => String(t.description || 'Sem descrição').trim();
  const pass = (t) => (catF === 'all' || catName(t) === catF) && (estF === 'all' || est(t) === estF);
  const cur = useMemo(() => exp.filter((t) => (!inP || inP.has(String(t.date).slice(0, 7))) && pass(t)), [exp, inP, catF, estF]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => (prevP ? exp.filter((t) => prevP.has(String(t.date).slice(0, 7)) && pass(t)) : []), [exp, prevP, catF, estF]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = cur.reduce((s, t) => s + Number(t.amount || 0), 0);
  const prevTotal = prev.reduce((s, t) => s + Number(t.amount || 0), 0);
  const delta = comparar === 'prev' && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  const cats = useMemo(() => { const m = {}; for (const t of cur) { const c = catMap[t.category_id]; const k = c?.name || 'Sem categoria'; m[k] = m[k] || { name: k, value: 0, color: c?.color, cat: c }; m[k].value += Number(t.amount || 0); } return Object.values(m).sort((a, b) => b.value - a.value).map((c, i) => ({ ...c, color: c.color || PALETTE[i % PALETTE.length] })); }, [cur, catMap]);
  const ests = useMemo(() => { const m = {}; for (const t of cur) { const k = est(t); m[k] = m[k] || { name: k, value: 0, count: 0, cat: catMap[t.category_id] }; m[k].value += Number(t.amount || 0); m[k].count++; } return Object.values(m).sort((a, b) => b.value - a.value); }, [cur, catMap]);
  const allCats = [...new Set(exp.map(catName))].sort();
  const allEsts = useMemo(() => { const m = {}; for (const t of exp) if (!inP || inP.has(String(t.date).slice(0, 7))) m[est(t)] = (m[est(t)] || 0) + Number(t.amount || 0); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k]) => k); }, [exp, inP]); // eslint-disable-line react-hooks/exhaustive-deps
  const nFilters = (catF !== 'all') + (estF !== 'all') + (periodo !== '3') + (comparar !== 'prev');
  const pct = (v) => (total ? (v / total) * 100 : 0);
  const months = n || Math.max(1, new Set(cur.map((t) => String(t.date).slice(0, 7))).size);
  const top = cats[0];
  const donutData = [...cats.slice(0, 7), ...(cats.length > 7 ? [{ name: 'Outros', value: cats.slice(7).reduce((s, c) => s + c.value, 0), color: '#64748b' }] : [])];
  const summaryCats = [...cats.slice(0, 5), ...(cats.length > 5 ? [{ name: 'Outras', value: cats.slice(5).reduce((s, c) => s + c.value, 0), color: '#64748b', other: true }] : [])];

  // treemap: layout em "squarify" simples por linhas
  const tiles = useMemo(() => {
    const items = cats.slice(0, 14); const rest = cats.slice(14).reduce((s, c) => s + c.value, 0);
    if (rest > 0) items.push({ name: 'Outros', value: rest, color: '#475569', other: true });
    const sum = items.reduce((s, c) => s + c.value, 0) || 1;
    const out = []; const W = 100, H = 100;
    const lay = (arr, x, y, w, h) => {
      if (!arr.length) return; if (arr.length === 1) { out.push({ ...arr[0], x, y, w, h }); return; }
      const tot = arr.reduce((s, c) => s + c.value, 0); let acc = 0, i = 0;
      while (i < arr.length - 1 && (acc + arr[i].value) / tot < 0.5) { acc += arr[i].value; i++; }
      if (i === 0) { acc = arr[0].value; i = 1; }
      const f = acc / tot; const A1 = arr.slice(0, i), A2 = arr.slice(i);
      if (w >= h) { lay(A1, x, y, w * f, h); lay(A2, x + w * f, y, w * (1 - f), h); } else { lay(A1, x, y, w, h * f); lay(A2, x, y + h * f, w, h * (1 - f)); }
    };
    lay(items, 0, 0, W, H); return out.map((t) => ({ ...t, p: (t.value / sum) * 100 }));
  }, [cats]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const Sel = ({ icon: Ic, label, value, onChange, options }) => (
    <div className="flex items-center gap-2 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] pl-3 pr-1.5 py-1.5 min-w-0">
      {Ic && <Ic className="w-4 h-4 text-muted shrink-0" />}<span className="text-sm text-muted whitespace-nowrap">{label}</span>
      <label className="relative flex-1 min-w-0"><select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none w-full rounded-xl ring-1 ring-[hsl(var(--border))] bg-black/5 dark:bg-white/5 pl-3 pr-8 py-1.5 text-sm font-semibold outline-none truncate">{options.map(([v, l]) => <option key={v} value={v} className="bg-[hsl(var(--card))]">{l}</option>)}</select><ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" /></label>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] gap-5 items-center">
        <div className="flex items-start gap-3 min-w-0">
          <BarChart3 className="w-14 h-14 text-violet-400 shrink-0" strokeWidth={1.6} />
          <div className="min-w-0"><h1 className="font-display text-3xl sm:text-4xl font-extrabold italic leading-[1.05]">Para Onde Vai<br /><span className="bg-gradient-to-r from-cyan-500 to-teal-400 dark:from-cyan-300 dark:to-teal-300 bg-clip-text text-transparent">Seu Dinheiro?</span></h1>
            <p className="text-sm text-muted mt-1.5">Entenda seus gastos por categoria, descubra padrões e receba insights para usar melhor o seu dinheiro.</p></div>
        </div>
        <section className="rounded-2xl ring-1 ring-violet-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(70%_140%_at_0%_0%,rgba(168,85,247,.2),transparent)] p-4 min-w-0">
          <p className="font-semibold text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-violet-400" />Análise do Monvy {ai.data && <span className="text-[11px] text-muted font-normal inline-flex items-center gap-1">{ai.data.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-sky-400" />Gemini</> : <><Cpu className="w-3 h-3" />Motor local</>}</span>}</p>
          {ai.busy ? <p className="text-sm text-muted flex items-center gap-2 mt-1"><Spinner className="w-4 h-4" />Analisando…</p> : ai.data ? <div className="max-h-24 overflow-y-auto text-sm mt-1"><Markdown text={ai.data.text} /></div>
            : <p className="text-sm text-muted mt-1">{top ? <>No período, você gastou <b className="text-[hsl(var(--text))]">{formatCurrency(total)}</b>, com maior concentração em <b className="text-[hsl(var(--text))]">{top.name} ({pct1(pct(top.value))})</b>{cats[1] && <> e <b className="text-[hsl(var(--text))]">{cats[1].name} ({pct1(pct(cats[1].value))})</b></>}.</> : 'Sem despesas no período.'}</p>}
        </section>
        <div className="flex xl:flex-col gap-2">
          <GlowButton tone="sky" onClick={() => ai.gerar()} disabled={ai.busy} className="py-2.5 px-5 justify-center">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Gerar de novo' : 'Analisar com IA'}</GlowButton>
          <button onClick={() => nav('/orcamento')} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-violet-400/50 hover:bg-violet-500/10">Simular otimizações</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto_auto] gap-3 items-center">
        <Sel icon={CalendarDays} label="Período" value={periodo} onChange={setPeriodo} options={PERIODS} />
        <Sel label="Comparar com" value={comparar} onChange={setComparar} options={[['prev', 'Período anterior'], ['none', 'Não comparar']]} />
        <Sel icon={Layers} label="Categoria" value={catF} onChange={(v) => { setCatF(v); setEstF('all'); }} options={[['all', 'Todas'], ...allCats.map((c) => [c, c])]} />
        <Sel icon={Store} label="Estabelecimento" value={estF} onChange={setEstF} options={[['all', 'Todos'], ...allEsts.map((e) => [e, e])]} />
        <span className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ring-1 text-sm font-semibold ${nFilters ? 'ring-violet-400/70 text-violet-600 dark:text-violet-200 bg-violet-500/10' : 'ring-[hsl(var(--border))] text-muted'}`}><Filter className="w-4 h-4" />Filtros ({nFilters})</span>
        <button onClick={() => { setPeriodo('3'); setComparar('prev'); setCatF('all'); setEstF('all'); }} title="Limpar filtros" className="w-11 h-11 rounded-xl ring-1 ring-[hsl(var(--border))] grid place-items-center text-muted hover:text-[hsl(var(--text))]"><RotateCcw className="w-4 h-4" /></button>
      </div>

      {cats.length === 0 ? <Panel><EmptyState icon={PieIcon} title="Sem despesas no período" subtitle="Ajuste os filtros ou lance despesas para ver o mapa." /></Panel> : (<>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="xl:col-span-3 relative overflow-hidden rounded-3xl ring-1 ring-violet-400/60 p-5 bg-[linear-gradient(150deg,rgba(124,58,237,.55),rgba(30,27,75,.4)_60%,rgba(14,165,233,.2))] shadow-[0_0_40px_-12px_rgba(168,85,247,.7)]">
            <p className="text-sm flex items-center gap-2"><Wallet className="w-5 h-5" />Total gasto no período</p>
            <p className="font-display text-4xl font-extrabold mt-2"><AnimatedValue value={total} format={formatCurrency} /></p>
            {delta != null && <p className="text-xs mt-2 flex items-center gap-2"><DeltaChip v={delta} invert />vs. período anterior</p>}
            <CardFlowArt className="w-full h-32 mt-2" />
          </section>
          <section className="xl:col-span-6 rounded-3xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 flex">
            <div className="relative w-full min-h-[320px] flex-1">
              {tiles.map((t) => { const Ic = t.other ? MoreHorizontal : categoryIcon(t.cat || { name: t.name }); const big = t.w > 22 && t.h > 30; const mid = t.w > 10 && t.h > 18; return (
                <button key={t.name} onClick={() => !t.other && setCatF(t.name === catF ? 'all' : t.name)} title={`${t.name}: ${formatCurrency(t.value)} (${pct1(t.p)})`} className="absolute p-[3px] text-left" style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}>
                  <span className="block w-full h-full rounded-xl p-2.5 text-white overflow-hidden ring-1 ring-white/10 hover:brightness-110 transition" style={{ background: `linear-gradient(150deg, ${t.color}, ${t.color}bb)` }}>
                    {mid && <Ic className={big ? 'w-7 h-7' : 'w-4 h-4'} />}
                    {mid && <span className={`block font-semibold leading-tight mt-1 ${big ? 'text-xl' : 'text-[11px]'}`}>{t.name}</span>}
                    {mid && <span className={`block ${big ? 'text-lg font-bold mt-2' : 'text-[11px]'}`}>{Math.round(t.p)}%{big && <span className="text-sm font-normal opacity-90"> {formatCurrency(t.value)}</span>}</span>}
                  </span>
                </button>); })}
            </div>
          </section>
          <Panel className="xl:col-span-3" tone="violet" title="Distribuição por categoria" icon={BarChart3} iconClass="text-violet-400">
            <div className="flex flex-col items-center gap-3">
              <Donut size={160} thickness={0.24} data={donutData} center={<><span className="font-display font-bold text-sm">{formatCurrency(total)}</span><span className="text-[10px] text-muted">Total</span></>} />
              <div className="w-full space-y-1">{donutData.map((c) => <div key={c.name} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="tabular-nums">{Math.round(pct(c.value))}%</span></div>)}</div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_repeat(6,minmax(0,1fr))] gap-3 items-stretch">
          <div className="flex items-start gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><Layers className="w-6 h-6 text-violet-400 shrink-0" /><div><p className="font-display font-bold">Resumo por categoria</p><p className="text-xs text-muted">Seus gastos no período, da maior para a menor participação.</p></div></div>
          {summaryCats.map((c, i) => { const Ic = c.other ? MoreHorizontal : categoryIcon(c.cat || { name: c.name }); return (
            <div key={c.name} className={`rounded-2xl ring-1 p-3 flex items-center gap-2.5 bg-[hsl(var(--card))] min-w-0 ${i === 0 ? 'ring-2' : ''}`} style={{ '--tw-ring-color': `${c.color}99`, backgroundImage: `linear-gradient(135deg, ${c.color}26, transparent 70%)` }}>
              <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${c.color}33`, color: c.color }}><Ic className="w-5 h-5" /></span>
              <div className="min-w-0"><p className="text-xs truncate">{c.name}</p><p className="font-bold text-sm truncate">{formatCurrency(c.value)}</p><p className="text-[11px] text-muted">{Math.round(pct(c.value))}%{i === 0 ? ' do total' : ''}</p></div>
            </div>); })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-4" tone="violet" title="Ranking de Categorias" icon={Trophy} iconClass="text-violet-400" subtitle="Categorias que mais consumiram seu dinheiro.">
            {cats.slice(0, 5).map((c, i) => { const Ic = categoryIcon(c.cat || { name: c.name }); return (
              <div key={c.name} className="flex items-center gap-2.5 py-1.5">
                <span className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold ring-1 ring-[hsl(var(--border))] shrink-0">{i + 1}</span>
                <Ic className="w-4 h-4 shrink-0" style={{ color: c.color }} />
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{c.name}</p><div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct(c.value)}%`, background: c.color }} /></div></div>
                <b className="text-sm w-24 text-right">{formatCurrency(c.value)}</b><span className="text-xs w-12 text-center px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">{Math.round(pct(c.value))}%</span>
              </div>); })}
          </Panel>
          <Panel className="xl:col-span-4" tone="violet" title="Top Estabelecimentos" icon={Store} iconClass="text-violet-400" subtitle="Onde você mais gastou neste período.">
            {ests.slice(0, 5).map((e, i) => { const Ic = categoryIcon(e.cat || { name: e.name }); return (
              <button key={e.name} onClick={() => setEstF(e.name === estF ? 'all' : e.name)} className="w-full flex items-center gap-2.5 py-1.5 text-left">
                <span className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold ring-1 ring-[hsl(var(--border))] shrink-0">{i + 1}</span>
                <Ic className="w-4 h-4 text-violet-400 shrink-0" /><span className="flex-1 text-sm truncate">{e.name}</span>
                <span className="text-[11px] text-muted">{e.count}x</span><b className="text-sm w-24 text-right">{formatCurrency(e.value)}</b><span className="text-xs w-14 text-center px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">{pct1(pct(e.value))}</span>
              </button>); })}
          </Panel>
          <section className="xl:col-span-4 relative overflow-hidden rounded-3xl ring-1 ring-violet-400/60 bg-[hsl(var(--card))] bg-[radial-gradient(70%_100%_at_100%_100%,rgba(168,85,247,.25),transparent)] p-5">
            <p className="font-display text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-400" />Insight automático</p>
            <div className="flex items-end gap-4 mt-3">
              <svg viewBox="0 0 100 90" className="hidden sm:block w-24 h-24 shrink-0" aria-hidden="true">{[0, 1, 2, 3].map((i) => <rect key={i} x={8 + i * 22} y={84 - (24 + i * 16)} width="16" height={24 + i * 16} rx="3" fill={i % 2 ? '#a855f7' : '#6366f1'} opacity={0.55 + i * 0.12} />)}</svg>
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold text-cyan-500 dark:text-cyan-300">Oportunidade de economia</p>
                {top ? <p className="text-sm mt-1">Cortar 15% em <b>{top.name}</b> libera <b className="text-[hsl(var(--text))]">{formatCurrency((top.value / months) * 0.15)}/mês</b> ({formatCurrency((top.value / months) * 0.15 * 12)}/ano). É a categoria com maior peso ({pct1(pct(top.value))}).</p> : null}
                <GlowButton tone="violet" onClick={() => nav('/orcamento')} className="mt-3">Definir limite no orçamento<ArrowRight className="w-4 h-4" /></GlowButton>
              </div>
            </div>
          </section>
        </div>
      </>)}
    </div>
  );
}
