import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { Input, Select, Spinner, Modal, Button, Field } from '../components/ui';
import { HeroTitle, MetricStrip, Metric, Gauge, Panel, Donut, Bar, KebabMenu, GlowButton, InsightsPanel, TIP, pct1 } from '../components/kit.jsx';
import { EnvelopesArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { combineExpenses } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  Mail, Plus, Trash2, Wallet, Download, Info, Coins, CalendarDays, Layers, Tag, LayoutGrid, List, PieChart as PieIcon, LineChart as LineIcon, Pencil, Check, X, Lightbulb,
  ShieldCheck, Zap, BarChart3, AlertTriangle, ShoppingBasket, Gamepad2, Car, PlayCircle, Home, Utensils, Heart, GraduationCap, Plane, PiggyBank, Shirt,
} from 'lucide-react';

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const KEY = 'monvy_envelopes';
const TIP_KEY = 'monvy_envelopes_tip_hidden';
const uid = () => Math.random().toString(36).slice(2, 9);
const nowMk = (off = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const PALETTE = ['#10b981', '#a855f7', '#0ea5e9', '#ec4899', '#f59e0b', '#22d3ee', '#8b5cf6', '#f43f5e'];
const GUESS = [[/mercad|aliment|super|feira/i, ShoppingBasket, 'Alimentação e supermercado'], [/lazer|divers|passeio|hobby/i, Gamepad2, 'Entretenimento, passeios e hobbies'], [/transp|combust|uber|carro|ônibus|onibus/i, Car, 'Combustível, apps e deslocamentos'], [/assinat|stream|software/i, PlayCircle, 'Streaming, software e serviços'], [/casa|morad|aluguel/i, Home, 'Moradia e contas da casa'], [/restaur|delivery|ifood/i, Utensils, 'Restaurantes e delivery'], [/saúde|saude|farm/i, Heart, 'Saúde e farmácia'], [/educ|curso|escola/i, GraduationCap, 'Cursos e educação'], [/viag/i, Plane, 'Viagens'], [/roupa|vest/i, Shirt, 'Roupas e acessórios'], [/reserva|poup/i, PiggyBank, 'Reserva e poupança']];
const guess = (name) => GUESS.find(([re]) => re.test(name || ''));
const SORTS = [['recent', 'Mais recente'], ['usage', 'Mais usado'], ['limit', 'Maior limite'], ['az', 'A–Z']];

export default function Envelopes() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })();
  const [envs, setEnvs] = useState(saved);
  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState('');
  const [catId, setCatId] = useState('');
  const [cor, setCor] = useState(PALETTE[1]);
  const [tab, setTab] = useState('mine');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const [edit, setEdit] = useState(null);
  const [tipHidden, setTipHidden] = useState(() => { try { return localStorage.getItem(TIP_KEY) === nowMk(); } catch { return false; } });

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(envs)); } catch { /* ignore */ } }, [envs]);

  const mk = nowMk();
  const now = new Date(); const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const monthFrac = now.getDate() / daysInMonth;
  const spentBy = useMemo(() => {
    const map = {};
    for (const t of combineExpenses(transactions, cardTxs)) { if (t.type !== 'expense' || !t.category_id) continue; const m = String(t.date).slice(0, 7); map[m] = map[m] || {}; map[m][t.category_id] = (map[m][t.category_id] || 0) + n(t.amount); }
    return map;
  }, [transactions, cardTxs]);
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const lista = useMemo(() => envs.map((e, k) => {
    const cat = e.catId ? catMap[e.catId] : null;
    const name = e.source === 'budget' ? cat?.name || 'Categoria' : e.nome;
    const gasto = e.catId ? spentBy[mk]?.[e.catId] || 0 : n(e.gastoManual);
    const lim = n(e.limite); const g = guess(name) || guess(cat?.name);
    const Icon = g ? g[1] : cat ? categoryIcon(cat) : Mail;
    return { ...e, idx: k, nome: name, cat, gasto, lim, restante: lim - gasto, pct: lim > 0 ? (gasto / lim) * 100 : 0, estourou: gasto > lim, color: e.color || cat?.color || PALETTE[k % PALETTE.length], Icon, sub: g ? g[2] : cat ? `Categoria ${cat.name}` : 'Controle manual', projected: monthFrac > 0 ? gasto / monthFrac : gasto };
  }), [envs, spentBy, catMap, mk, monthFrac]);

  const sorted = useMemo(() => { const a = [...lista]; if (sort === 'usage') a.sort((x, y) => y.pct - x.pct); else if (sort === 'limit') a.sort((x, y) => y.lim - x.lim); else if (sort === 'az') a.sort((x, y) => x.nome.localeCompare(y.nome)); else a.reverse(); return a; }, [lista, sort]);
  const totalLim = lista.reduce((s, e) => s + e.lim, 0);
  const totalGasto = lista.reduce((s, e) => s + e.gasto, 0);
  const disponivel = totalLim - totalGasto;
  const health = totalLim > 0 ? Math.max(0, Math.min(100, (disponivel / totalLim) * 100)) : null;
  const hLabel = health == null ? ['Sem envelopes', 'text-muted'] : health >= 70 ? ['Excelente', 'text-emerald-500 dark:text-emerald-300'] : health >= 40 ? ['Boa', 'text-cyan-500 dark:text-cyan-300'] : health >= 15 ? ['Atenção', 'text-amber-500'] : ['Crítica', 'text-rose-500'];

  const importaveis = categories.filter((c) => c.type === 'expense' && n(c.budget_limit) > 0 && !envs.some((e) => e.catId === c.id));
  const importar = () => setEnvs((x) => [...x, ...importaveis.map((c, k) => ({ id: uid(), source: 'budget', catId: c.id, limite: n(c.budget_limit), color: c.color || PALETTE[(x.length + k) % PALETTE.length] }))]);
  const addEnv = () => { if (!nome.trim() || !n(limite)) return; setEnvs((x) => [...x, { id: uid(), nome: nome.trim(), limite, catId: catId || null, color: cor }]); setNome(''); setLimite(''); setCatId(''); };
  const updEnv = (id, patch) => setEnvs((x) => x.map((y) => (y.id === id ? { ...y, ...patch } : y)));

  const byCategory = useMemo(() => { const m = {}; for (const e of lista) { const k = e.cat?.id || 'manual'; m[k] = m[k] || { name: e.cat?.name || 'Sem categoria (manual)', color: e.cat?.color || '#64748b', count: 0, lim: 0, gasto: 0 }; m[k].count++; m[k].lim += e.lim; m[k].gasto += e.gasto; } return Object.values(m).sort((a, b) => b.lim - a.lim); }, [lista]);
  const evolution = useMemo(() => { const linked = lista.filter((e) => e.catId); const out = []; for (let k = 5; k >= 0; k--) { const m = nowMk(k); const [y, mo] = m.split('-'); out.push({ name: new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), Gasto: Math.round(linked.reduce((s, e) => s + (spentBy[m]?.[e.catId] || 0), 0) + (k === 0 ? lista.filter((e) => !e.catId).reduce((s, e) => s + e.gasto, 0) : 0)) }); } return out; }, [lista, spentBy]);

  const hi = [...lista].filter((e) => e.lim > 0).sort((a, b) => b.pct - a.pct);
  const insights = [];
  const risky = hi.find((e) => !e.estourou && e.projected > e.lim * 1.02);
  if (risky) insights.push({ tone: 'violet', icon: BarChart3, title: `Atenção ao envelope de ${risky.nome}`, text: `Você usou ${pct1(risky.pct)} (${formatCurrency(risky.gasto)}). No ritmo atual deve fechar o mês em ~${formatCurrency(risky.projected)} (limite ${formatCurrency(risky.lim)}).` });
  const over = hi.filter((e) => e.estourou);
  if (over.length) insights.push({ tone: 'rose', icon: AlertTriangle, title: `${over.length} envelope(s) acima do limite`, text: over.map((e) => `${e.nome} (+${formatCurrency(-e.restante)})`).join(', ') });
  const low = [...hi].reverse()[0];
  if (low && low.pct < 50) insights.push({ tone: 'emerald', icon: Zap, title: `Ótima alocação em ${low.nome}`, text: `Apenas ${pct1(low.pct)} do limite foi utilizado. Seu controle está excelente!` });
  const top = hi[0];
  if (top && top !== risky && top !== low && !top.estourou) insights.push({ tone: 'sky', icon: Layers, title: `Equilibre ${top.nome}`, text: `Você já usou ${pct1(top.pct)} do limite; restam ${formatCurrency(top.restante)} para ${daysInMonth - now.getDate()} dia(s).` });
  if (!insights.length) insights.push({ tone: 'sky', icon: Lightbulb, title: 'Crie seus primeiros envelopes', text: 'Importe os limites do Orçamento ou crie potes livres para cada tipo de gasto.' });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const EnvCard = ({ e }) => {
    const ok = !e.estourou && e.pct <= monthFrac * 100;
    return (
      <div className="relative overflow-hidden rounded-3xl ring-1 p-4 pt-3" style={{ background: `linear-gradient(170deg, ${e.color}55, ${e.color}14 55%, transparent)`, borderColor: e.color, boxShadow: `0 0 26px -10px ${e.color}`, '--tw-ring-color': `${e.color}99` }}>
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" style={{ background: `linear-gradient(180deg, ${e.color}66, ${e.color}10)`, clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" style={{ background: `linear-gradient(to bottom right, transparent 49.4%, ${e.color} 49.6%, transparent 50.4%), linear-gradient(to bottom left, transparent 49.4%, ${e.color} 49.6%, transparent 50.4%)`, opacity: 0.6 }} />
        <div className="absolute top-2 right-2 z-[2] flex items-center gap-1">{ok && <Check className="w-4 h-4 text-white/80" />}<KebabMenu items={[{ label: 'Editar envelope', icon: Pencil, onClick: () => setEdit({ id: e.id, nome: e.nome, limite: String(e.lim), color: e.color, gastoManual: e.gastoManual || '', manual: !e.catId, source: e.source }) }, { label: 'Remover', icon: Trash2, danger: true, onClick: () => setEnvs((x) => x.filter((y) => y.id !== e.id)) }]} /></div>
        <div className="relative z-[1] text-center">
          <e.Icon className="w-9 h-9 mx-auto dark:!text-white drop-shadow" style={{ color: e.color }} strokeWidth={1.8} />
          <p className="font-display text-xl font-bold mt-1 truncate">{e.nome}</p>
          <p className="text-xs text-muted truncate">{e.sub}</p>
        </div>
        <span className={`absolute right-4 top-14 z-[1] text-sm font-extrabold px-3 py-1 rounded-full ring-1 ${e.estourou ? 'bg-rose-500/30 ring-rose-400 text-rose-100' : 'bg-black/25 ring-white/20 text-white'}`} style={e.estourou ? undefined : { boxShadow: `0 0 12px ${e.color}` }}>{Math.round(e.pct)}%</span>
        <Bar pct={e.pct} color={e.estourou ? '#f43f5e' : `linear-gradient(90deg, ${e.color}, ${e.color}cc)`} className="h-2.5 mt-4" glow />
        <div className="grid grid-cols-3 mt-3 divide-x divide-white/10 text-center">
          <div><p className="font-bold">{formatCurrency(e.gasto)}</p><p className="text-[11px] text-muted">Utilizado</p></div>
          <div><p className={`font-bold ${e.restante >= 0 ? 'text-emerald-500 dark:text-emerald-300' : 'text-rose-500'}`}>{formatCurrency(e.restante)}</p><p className="text-[11px] text-muted">{e.restante >= 0 ? 'Disponível' : 'Acima do limite'}</p></div>
          <div><p className="font-bold">{formatCurrency(e.lim)}</p><p className="text-[11px] text-muted">Limite mensal</p></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Mail} lead="Envelopes de" accent="Orçamento" iconClass="text-fuchsia-400" subtitle="Distribua sua renda em potes e acompanhe o saldo de cada envelope."
        art={<EnvelopesArt className="w-72 h-28 xl:mr-[430px] 2xl:mr-[470px]" />}
        actions={<>
          <button onClick={importar} disabled={!importaveis.length} title={importaveis.length ? '' : 'Todas as categorias com limite já viraram envelopes'} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:ring-cyan-400/60 disabled:opacity-50"><Download className="w-4 h-4" />Importar do Orçamento ({importaveis.length})</button>
          <GlowButton tone="pink" onClick={() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); formRef.current?.querySelector('input')?.focus(); }} className="py-2.5"><Plus className="w-4 h-4" />Criar novo envelope</GlowButton>
        </>} />

      <MetricStrip className="sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_.7fr_1.5fr]">
        <Metric icon={Coins} color="#c084fc" label="Total alocado" value={formatCurrency(totalLim)} sub="Distribuído entre os envelopes" />
        <Metric icon={CalendarDays} color="#38bdf8" label="Gasto no mês" value={formatCurrency(totalGasto)} valueClass="text-rose-500 dark:text-rose-400" sub={<><span className="text-rose-500">{pct1(totalLim ? (totalGasto / totalLim) * 100 : 0)}</span> do total alocado</>} />
        <Metric icon={Wallet} color="#22d3ee" label="Disponível" value={formatCurrency(disponivel)} valueClass={disponivel >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'} sub={`${pct1(totalLim ? (disponivel / totalLim) * 100 : 0)} do total alocado`} />
        <Metric icon={Layers} color="#a855f7" label="Envelopes" value={lista.length} sub="Ativos" />
        <div className="flex items-center gap-4 sm:px-5 min-w-0">
          <div><p className="text-sm text-muted flex items-center gap-1.5">Saúde dos envelopes <span title="Percentual do valor alocado que ainda está disponível no mês."><Info className="w-3.5 h-3.5" /></span></p><Gauge value={health} size={132} label="%" sub={<span className={hLabel[1]}>{hLabel[0]}</span>} /></div>
          <div className="min-w-0"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ring-1 ring-emerald-400/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-xs font-bold"><ShieldCheck className="w-3.5 h-3.5" />{over.length ? `${over.length} acima do limite` : 'Saúde ' + hLabel[0].toLowerCase()}</span><p className="text-xs text-muted mt-2">{over.length ? 'Revise os envelopes que passaram do limite.' : lista.length ? 'Seus gastos estão dentro do planejado. Continue assim!' : 'Crie envelopes para acompanhar.'}</p></div>
        </div>
      </MetricStrip>

      {/* Novo envelope */}
      <section ref={formRef} className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-cyan-400/30 p-5">
        <p className="flex items-center gap-2 flex-wrap"><Mail className="w-5 h-5 text-cyan-400" /><b className="font-display text-lg">Novo envelope</b><span className="text-xs px-2 py-0.5 rounded-md ring-1 ring-[hsl(var(--border))] text-muted">{monthLabel(mk)}</span><span className="text-sm text-muted">Crie um novo envelope para controlar um tipo de gasto.</span></p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-[1.2fr_.9fr_1.3fr_1.15fr_auto] gap-3 items-end mt-3">
          <Field label="Nome do envelope"><div className="relative"><Tag className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" /><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Alimentação" className="!pl-9" /></div></Field>
          <Field label="Limite por mês (R$)"><Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="R$ 0,00" /></Field>
          <Field label="Categoria (auto-conta os gastos)"><Select value={catId} onChange={(e) => { setCatId(e.target.value); const c = catMap[e.target.value]; if (c?.color) setCor(c.color); if (c && !nome) setNome(c.name); }}><option value="">Sem vínculo (manual)</option>{categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Cor do envelope"><div className="flex flex-wrap gap-1.5 py-2.5">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} className={`w-5 h-5 rounded-full transition ${cor === c ? 'ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] ring-white scale-110' : ''}`} style={{ background: c }} />)}</div></Field>
          <GlowButton tone="aurora" onClick={addEnv} className="py-2.5 px-6 justify-center" disabled={!nome.trim() || !n(limite)}><Plus className="w-4 h-4" />Criar envelope</GlowButton>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {[['mine', `Meus envelopes (${lista.length})`, LayoutGrid], ['cats', 'Visão por categorias', PieIcon], ['evo', 'Evolução mensal', LineIcon]].map(([v, l, Ic]) => <button key={v} onClick={() => setTab(v)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 transition ${tab === v ? 'bg-sky-500/20 ring-sky-400/70 text-sky-700 dark:text-sky-100 shadow-[0_0_16px_rgba(56,189,248,.25)]' : 'ring-[hsl(var(--border))] text-muted bg-[hsl(var(--card))]'}`}><Ic className="w-4 h-4" />{l}</button>)}
            {tab === 'mine' && <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted rounded-lg ring-1 ring-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--card))]">Ordenar por:<select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-[hsl(var(--text))] font-semibold outline-none">{SORTS.map(([v, l]) => <option key={v} value={v} className="bg-[hsl(var(--card))]">{l}</option>)}</select></label>
              <div className="flex rounded-lg ring-1 ring-[hsl(var(--border))] p-0.5 bg-[hsl(var(--card))]"><button onClick={() => setView('grid')} aria-label="Cards" className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-sky-500/25 text-sky-500' : 'text-muted'}`}><LayoutGrid className="w-4 h-4" /></button><button onClick={() => setView('list')} aria-label="Lista" className={`p-1.5 rounded-md ${view === 'list' ? 'bg-sky-500/25 text-sky-500' : 'text-muted'}`}><List className="w-4 h-4" /></button></div>
            </div>}
          </div>

          {tab === 'mine' && (lista.length === 0 ? (
            <Panel><div className="text-center py-8"><EnvelopesArt className="w-72 h-28 mx-auto" /><p className="font-display text-xl font-bold mt-2">Nenhum envelope ainda</p><p className="text-sm text-muted">Crie envelopes acima ou importe os limites do seu Orçamento.</p>{importaveis.length > 0 && <GlowButton tone="aurora" onClick={importar} className="mt-4"><Download className="w-4 h-4" />Importar do Orçamento</GlowButton>}</div></Panel>
          ) : view === 'grid' ? (
            <div className="grid sm:grid-cols-2 gap-4">{sorted.map((e) => <EnvCard key={e.id} e={e} />)}</div>
          ) : (
            <Panel>{sorted.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
                <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${e.color}26`, color: e.color }}><e.Icon className="w-5 h-5" /></span>
                <div className="w-44 min-w-0"><p className="font-semibold truncate">{e.nome}</p><p className="text-[11px] text-muted truncate">{e.sub}</p></div>
                <div className="flex-1"><Bar pct={e.pct} color={e.estourou ? '#f43f5e' : e.color} className="h-2" /></div>
                <span className="w-24 text-right text-sm tabular-nums">{formatCurrency(e.gasto)}</span>
                <span className="w-24 text-right text-sm tabular-nums text-muted">/ {formatCurrency(e.lim)}</span>
                <span className={`w-14 text-right text-sm font-bold ${e.estourou ? 'text-rose-500' : ''}`}>{Math.round(e.pct)}%</span>
                <KebabMenu items={[{ label: 'Editar envelope', icon: Pencil, onClick: () => setEdit({ id: e.id, nome: e.nome, limite: String(e.lim), color: e.color, gastoManual: e.gastoManual || '', manual: !e.catId, source: e.source }) }, { label: 'Remover', icon: Trash2, danger: true, onClick: () => setEnvs((x) => x.filter((y) => y.id !== e.id)) }]} />
              </div>))}</Panel>
          ))}

          {tab === 'cats' && (
            <Panel title="Visão por categorias" icon={PieIcon} iconClass="text-sky-400" subtitle="Envelopes agrupados pela categoria vinculada">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-xs text-muted text-left border-b border-[hsl(var(--border))]"><th className="py-2 font-medium">Categoria</th><th className="font-medium text-center">Envelopes</th><th className="font-medium text-right">Limite</th><th className="font-medium text-right">Gasto</th><th className="font-medium w-48 pl-4">Uso</th></tr></thead>
                <tbody>{byCategory.map((c) => { const p = c.lim ? (c.gasto / c.lim) * 100 : 0; return <tr key={c.name} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-2.5"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span></td><td className="text-center">{c.count}</td><td className="text-right tabular-nums">{formatCurrency(c.lim)}</td><td className="text-right tabular-nums">{formatCurrency(c.gasto)}</td><td className="pl-4"><div className="flex items-center gap-2"><Bar pct={p} color={p > 100 ? '#f43f5e' : c.color} className="h-2 flex-1" /><span className="text-xs w-10 text-right">{Math.round(p)}%</span></div></td></tr>; })}</tbody>
              </table></div>
            </Panel>
          )}

          {tab === 'evo' && (
            <Panel title="Evolução mensal" icon={LineIcon} iconClass="text-sky-400" subtitle="Gasto nas categorias dos envelopes nos últimos 6 meses, comparado ao total alocado hoje">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolution} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                    <ReferenceLine y={totalLim} stroke="#f472b6" strokeDasharray="5 4" label={{ value: `Alocado ${formatCurrency(totalLim)}`, position: 'insideTopRight', fill: '#f472b6', fontSize: 11 }} />
                    <RBar dataKey="Gasto" radius={[8, 8, 0, 0]} fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-muted">Envelopes manuais entram apenas no mês atual.</p>
            </Panel>
          )}
        </div>

        <div className="xl:col-span-4 space-y-5">
          <Panel title="Distribuição do orçamento" icon={PieIcon} iconClass="text-fuchsia-400" tone="violet">
            <div className="flex items-center gap-4">
              <Donut size={150} thickness={0.22} data={lista.map((e) => ({ name: e.nome, value: e.lim, color: e.color }))} center={<><span className="font-display font-bold">{formatCurrency(totalLim)}</span><span className="text-[10px] text-muted">Total alocado</span></>} />
              <div className="flex-1 min-w-0 space-y-2">{[...lista].sort((a, b) => b.lim - a.lim).slice(0, 6).map((e) => <div key={e.id} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} /><span className="flex-1 truncate">{e.nome}</span><span className="text-muted tabular-nums">{pct1(totalLim ? (e.lim / totalLim) * 100 : 0)}</span><span className="tabular-nums w-20 text-right">{formatCurrency(e.lim)}</span></div>)}</div>
            </div>
          </Panel>
          <InsightsPanel title="Insights do Monvy" subtitle="Leitura automática dos seus envelopes." items={insights.slice(0, 3)} />
        </div>
      </div>

      {!tipHidden && lista.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl ring-1 ring-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="flex-1"><b className="text-amber-600 dark:text-amber-300">Dica da Monvy:</b> seus envelopes estão com {pct1(totalLim ? Math.max(0, (disponivel / totalLim) * 100) : 0)} de saldo disponível{disponivel > 0 ? '. O que sobrar no fim do mês pode virar aporte de uma meta.' : '. Revise os limites para o próximo mês.'} <button onClick={() => navigate('/metas')} className="underline font-semibold">Ver metas</button></span>
          <button onClick={() => { setTipHidden(true); try { localStorage.setItem(TIP_KEY, mk); } catch { /* */ } }} aria-label="Fechar dica" className="p-1 rounded-lg hover:bg-black/10"><X className="w-4 h-4" /></button>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar envelope" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><GlowButton tone="aurora" onClick={() => { updEnv(edit.id, { ...(edit.source === 'budget' ? {} : { nome: edit.nome }), limite: edit.limite, color: edit.color, ...(edit.manual ? { gastoManual: edit.gastoManual } : {}) }); setEdit(null); }}>Salvar</GlowButton></>}>
        {edit && <div className="space-y-3">
          {edit.source !== 'budget' && <Field label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>}
          <Field label="Limite por mês (R$)"><Input type="number" value={edit.limite} onChange={(e) => setEdit({ ...edit, limite: e.target.value })} /></Field>
          {edit.manual && <Field label="Gasto do mês (manual, R$)"><Input type="number" value={edit.gastoManual} onChange={(e) => setEdit({ ...edit, gastoManual: e.target.value })} /></Field>}
          <Field label="Cor"><div className="flex gap-2">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} className={`w-7 h-7 rounded-full ${edit.color === c ? 'ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] ring-white' : ''}`} style={{ background: c }} />)}</div></Field>
        </div>}
      </Modal>
    </div>
  );
}
