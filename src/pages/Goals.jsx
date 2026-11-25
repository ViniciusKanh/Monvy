import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Goal } from '../api/entities.js';
import { Button, Input, Select, Field, Modal, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Panel, Donut, Ring, Bar, KebabMenu, GlowButton, DeltaChip, pct1, TIP } from '../components/kit.jsx';
import { SummitIllustration, GOAL_THEMES } from '../components/goals/GoalsArt.jsx';
import { formatCurrency, todayIso, monthKey } from '../lib/utils.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import {
  Plus, Target, PiggyBank, Plane, Home, Car, GraduationCap, HeartPulse, Wallet, Pencil, Trash2, Trophy, Sparkles, Star, CircleCheck,
  Layers, BarChart3, CalendarDays, Play, AlertTriangle, LayoutGrid, List, TrendingUp, Flag, ChevronRight, ArrowUpRight, ShieldCheck,
} from 'lucide-react';

const CATS = [
  { v: 'emergency', label: 'Emergência', icon: ShieldCheck },
  { v: 'travel', label: 'Viagem', icon: Plane },
  { v: 'home', label: 'Casa', icon: Home },
  { v: 'car', label: 'Carro', icon: Car },
  { v: 'education', label: 'Educação', icon: GraduationCap },
  { v: 'health', label: 'Saúde', icon: HeartPulse },
  { v: 'other', label: 'Outro', icon: Wallet },
];
const iconFor = (c) => CATS.find((x) => x.v === c)?.icon || Target;
const empty = { name: '', category: 'other', target_amount: '', current_amount: 0, monthly_target: '', target_date: '', color: '#10b981' };
const FAV_KEY = 'monvy_goal_favs';
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const brDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR') : '—');
const histOf = (g) => (Array.isArray(g.history) ? g.history : []);

// planejamento da meta: quanto guardar/mês e se está atrasada
function goalPlan(g) {
  const target = Number(g.target_amount || 0), current = Number(g.current_amount || 0);
  const remaining = Math.max(0, target - current);
  const today = new Date(todayIso() + 'T00:00');
  let monthsLeft = null, neededPerMonth = null, late = false;
  if (g.target_date) {
    const d = new Date(String(g.target_date).slice(0, 10) + 'T00:00');
    monthsLeft = Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()));
    neededPerMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;
    late = d < today && remaining > 0;
  }
  return { remaining, monthsLeft, neededPerMonth, late, pct: target ? Math.min(100, (current / target) * 100) : 0 };
}

// valor guardado em todas as metas ao fim de um mês (reconstruído pelo histórico de depósitos)
function savedAt(goals, endIso) {
  let s = 0;
  for (const g of goals) {
    const h = histOf(g);
    if (!h.length && g.created_date && String(g.created_date).slice(0, 10) > endIso) continue;
    const after = h.filter((e) => String(e.date).slice(0, 10) > endIso).reduce((a, e) => a + Number(e.amount || 0), 0);
    s += Math.max(0, Number(g.current_amount || 0) - after);
  }
  return s;
}

export default function Goals() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [deposit, setDeposit] = useState(null);
  const [depValue, setDepValue] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('progress');
  const [view, setView] = useState('grid');
  const [range, setRange] = useState(12);
  const [favs, setFavs] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); } });
  const toggleFav = (id) => setFavs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); try { localStorage.setItem(FAV_KEY, JSON.stringify([...n])); } catch { /* */ } return n; });

  const inval = () => qc.invalidateQueries({ queryKey: ['goals'] });
  const save = useMutation({
    mutationFn: (p) => {
      if (editing) {
        const delta = Number(p.current_amount || 0) - Number(editing.current_amount || 0);
        const history = Math.abs(delta) > 0.004 ? [...histOf(editing), { date: todayIso(), amount: Math.round(delta * 100) / 100, kind: 'ajuste' }] : histOf(editing);
        return Goal.update(editing.id, { ...p, history });
      }
      const initial = Number(p.current_amount || 0);
      return Goal.create({ ...p, start_date: todayIso(), history: initial > 0 ? [{ date: todayIso(), amount: initial, kind: 'inicial' }] : [] });
    },
    onSuccess: () => { inval(); setModal(false); },
  });
  const del = useMutation({ mutationFn: (id) => Goal.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const doDeposit = useMutation({
    mutationFn: ({ goal, value }) => { const current = Number(goal.current_amount || 0) + value; const status = current >= Number(goal.target_amount) ? 'completed' : (goal.status === 'completed' ? 'active' : goal.status || 'active'); return Goal.update(goal.id, { current_amount: current, status, history: [...histOf(goal), { date: todayIso(), amount: value, kind: value >= 0 ? 'deposito' : 'retirada' }] }); },
    onSuccess: () => { inval(); setDeposit(null); setDepValue(''); },
  });

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ name: g.name, category: g.category || 'other', target_amount: g.target_amount, current_amount: g.current_amount, monthly_target: g.monthly_target ?? '', target_date: (g.target_date || '').slice(0, 10), color: g.color }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e?.preventDefault?.(); if (!form.name.trim() || !(Number(form.target_amount) > 0)) return; save.mutate({ ...form, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount || 0), monthly_target: form.monthly_target === '' ? null : Number(form.monthly_target), status: Number(form.current_amount || 0) >= Number(form.target_amount) ? 'completed' : (editing?.status === 'completed' ? 'active' : editing?.status || 'active') }); };

  // ---------- números ----------
  const enriched = useMemo(() => goals.map((g) => ({ ...g, plan: goalPlan(g), done: g.status === 'completed' || Number(g.current_amount) >= Number(g.target_amount) })), [goals]);
  const saved = enriched.reduce((s, g) => s + Number(g.current_amount || 0), 0);
  const target = enriched.reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const pctAll = target ? (saved / target) * 100 : 0;
  const activeGoals = enriched.filter((g) => !g.done && g.status !== 'cancelled');
  const doneGoals = enriched.filter((g) => g.done);
  const lateGoals = activeGoals.filter((g) => g.plan.late);
  const thisMk = monthKey(new Date());
  const newThisMonth = goals.filter((g) => String(g.created_date || '').slice(0, 7) === thisMk).length;
  const doneThisMonth = goals.filter((g) => g.status === 'completed' && String(g.updated_date || '').slice(0, 7) === thisMk).length;
  const avgMonths = (() => { const arr = activeGoals.map((g) => g.plan.monthsLeft).filter((m) => m != null); return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null; })();

  // evolução mês a mês
  const series = useMemo(() => {
    const out = []; const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const endIso = i === 0 ? todayIso() : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ name: MES[d.getMonth()], v: Math.round(savedAt(goals, endIso) * 100) / 100 });
    }
    return out;
  }, [goals, range]);
  const prevSaved = series.length > 1 ? series[series.length - 2].v : null;
  const deltaMonth = prevSaved ? ((saved - prevSaved) / prevSaved) * 100 : null;
  const lastPt = series[series.length - 1];

  const dist = enriched.map((g, i) => ({ name: g.name, value: Number(g.current_amount || 0), color: GOAL_THEMES[g.category || 'other']?.accent || ['#2dd4bf', '#a855f7', '#38bdf8', '#f59e0b'][i % 4], pct: saved ? (Number(g.current_amount || 0) / saved) * 100 : 0 }));

  // próximos marcos: próximo degrau de 10% de cada meta ativa
  const milestones = activeGoals.map((g) => {
    const t = Number(g.target_amount || 0); const c = Number(g.current_amount || 0);
    const step = Math.min(100, (Math.floor((c / t) * 10) + 1) * 10); const value = (t * step) / 100;
    return { g, step, value, need: Math.max(0, value - c), rel: c > 0 ? ((value - c) / c) * 100 : null };
  }).sort((a, b) => a.need - b.need).slice(0, 3);

  const visible = useMemo(() => {
    const arr = enriched.filter((g) => filter === 'all' || (filter === 'active' && !g.done) || (filter === 'done' && g.done) || (filter === 'late' && g.plan.late));
    arr.sort((a, b) => (favs.has(b.id) - favs.has(a.id)) || (sortBy === 'progress' ? b.plan.pct - a.plan.pct : sortBy === 'deadline' ? String(a.target_date || '9999').localeCompare(String(b.target_date || '9999')) : Number(b.target_amount) - Number(a.target_amount)));
    return arr;
  }, [enriched, filter, sortBy, favs]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Target className="w-11 h-11 text-teal-400 shrink-0 mt-1" strokeWidth={1.6} />
          <div><h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Metas</h1><p className="text-sm text-muted mt-1">Guarde dinheiro com propósito e conquiste seus objetivos.</p><div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-teal-400 to-sky-500" /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="ring-1 ring-violet-400/40" onClick={() => nav('/objetivo')}><Sparkles className="w-4 h-4 text-violet-400" /> Planejador de metas (IA)</Button>
          <GlowButton onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</GlowButton>
        </div>
      </div>

      {/* Hero */}
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-stretch">
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-teal-400/40 bg-[hsl(var(--card))] shadow-[0_0_30px_rgba(45,212,191,.12)] p-5 grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] items-center" style={{ backgroundImage: 'radial-gradient(100% 120% at 0% 0%, rgba(45,212,191,.14), transparent 55%)' }}>
          <Ring value={pctAll} size={150} stroke={14} from="#34d399" to="#2dd4bf"><span className="font-display text-3xl font-extrabold">{Math.round(pctAll)}%</span><span className="text-xs text-muted">concluído</span></Ring>
          <div className="min-w-0 grid sm:grid-cols-[auto_minmax(0,1fr)] gap-4 items-center">
            <div>
              <p className="text-sm text-muted">Total Guardado</p>
              <p className="font-display text-[clamp(2rem,3vw,2.8rem)] font-extrabold leading-none mt-1 whitespace-nowrap"><AnimatedValue value={saved} format={formatCurrency} /></p>
              <p className="text-sm text-muted mt-1">de {formatCurrency(target)}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">{deltaMonth != null ? <><DeltaChip v={deltaMonth} /><span className="text-xs text-muted">em relação ao último mês</span></> : <span className="text-xs text-muted">sem depósitos registrados no mês anterior</span>}</div>
            </div>
            <div className="h-28 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="glHero" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
                  <Area type="monotone" dataKey="v" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#glHero)" dot={false} />
                  {lastPt && <ReferenceDot x={series.length - 1} y={lastPt.v} r={4} fill="#ccfbf1" stroke="#2dd4bf" />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="relative hidden xl:flex items-end justify-between overflow-hidden rounded-3xl">
          <SummitIllustration className="absolute inset-0 w-full h-full" />
          <div className="relative ml-auto mb-auto mt-6 mr-6 text-right">
            <p className="font-display text-xl font-bold flex items-center gap-2 justify-end"><Trophy className="w-6 h-6 text-amber-300" /> Foco, Consistência</p>
            <p className="font-display text-xl font-bold">e Conquista</p>
            <div className="h-0.5 w-24 ml-auto mt-2 bg-gradient-to-r from-transparent to-violet-400" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi icon={Target} tone="text-teal-300" label="Metas ativas" value={activeGoals.length} chip={<span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-500">+{newThisMonth} este mês</span>} />
        <Kpi icon={CircleCheck} tone="text-violet-300" label="Metas concluídas" value={doneGoals.length} chip={<span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-500/15 text-violet-400">{doneThisMonth ? `+${doneThisMonth} no mês` : '—'}</span>} />
        <Kpi icon={Layers} tone="text-sky-300" label="Total do objetivo" value={formatCurrency(target)} />
        <Kpi icon={BarChart3} tone="text-sky-400" label="Falta para concluir" value={formatCurrency(Math.max(0, target - saved))} />
        <Kpi icon={CalendarDays} tone="text-fuchsia-300" label="Prazo médio" value={avgMonths != null ? `${avgMonths} ${avgMonths === 1 ? 'mês' : 'meses'}` : '—'} />
      </div>

      {/* Minhas metas */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Layers className="w-5 h-5 text-sky-400" /> Minhas Metas</h3>
        <div className="flex flex-wrap items-center gap-2">
          {[['all', `Todas (${enriched.length})`], ['active', `Em andamento (${activeGoals.length})`, Play], ['done', `Concluídas (${doneGoals.length})`, CircleCheck], ['late', `Atrasadas (${lateGoals.length})`, AlertTriangle]].map(([v, l, Ic]) => (
            <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold ring-1 transition ${filter === v ? 'bg-violet-600 text-white ring-violet-400 shadow-[0_0_14px_rgba(139,92,246,.45)]' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}>{Ic && <Ic className={`w-3.5 h-3.5 ${v === 'late' && filter !== v ? 'text-rose-400' : ''}`} />}{l}</button>
          ))}
          <label className="text-sm text-muted flex items-center gap-1.5 ml-2">Ordenar por:<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-semibold text-[hsl(var(--text))] outline-none cursor-pointer [&>option]:text-slate-800"><option value="progress">Progresso</option><option value="deadline">Prazo</option><option value="value">Valor</option></select></label>
          <div className="inline-flex rounded-xl ring-1 ring-[hsl(var(--border))] p-0.5">
            <button onClick={() => setView('grid')} aria-label="Ver em cards" aria-pressed={view === 'grid'} className={`p-1.5 rounded-lg ${view === 'grid' ? 'bg-sky-500 text-white' : 'text-muted'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} aria-label="Ver em lista" aria-pressed={view === 'list'} className={`p-1.5 rounded-lg ${view === 'list' ? 'bg-sky-500 text-white' : 'text-muted'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : goals.length === 0 ? <Panel><EmptyState icon={Target} title="Nenhuma meta" subtitle="Defina objetivos e acompanhe seu progresso." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</Button>} /></Panel>
        : visible.length === 0 ? <Panel><p className="text-sm text-muted text-center py-6">Nenhuma meta neste filtro.</p></Panel>
        : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {visible.map((g, i) => <Reveal key={g.id} i={Math.min(i, 8)}><GoalCard g={g} fav={favs.has(g.id)} onFav={() => toggleFav(g.id)} onDeposit={() => { setDeposit(g); setDepValue(''); }} onEdit={() => openEdit(g)} onDelete={() => setToDelete(g)} /></Reveal>)}
          </div>
        ) : (
          <Panel className="!p-2">
            <div className="divide-y divide-[hsl(var(--border))]">
              {visible.map((g) => { const Icon = iconFor(g.category); const th = GOAL_THEMES[g.category || 'other'] || GOAL_THEMES.other; return (
                <div key={g.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}><Icon className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1"><p className="font-semibold truncate flex items-center gap-1.5">{favs.has(g.id) && <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />}{g.name}</p><Bar pct={g.plan.pct} color={th.accent} className="h-1.5 mt-1.5" /></div>
                  <div className="text-right text-sm shrink-0"><p><b>{formatCurrency(g.current_amount)}</b> <span className="text-muted">/ {formatCurrency(g.target_amount)}</span></p><p className="text-xs text-muted">{Math.round(g.plan.pct)}% · {brDate(g.target_date)}</p></div>
                  <Button size="sm" variant="outline" onClick={() => { setDeposit(g); setDepValue(''); }}><PiggyBank className="w-4 h-4" /></Button>
                  <KebabMenu items={[{ icon: Pencil, label: 'Editar', onClick: () => openEdit(g) }, { icon: Trash2, label: 'Excluir', danger: true, onClick: () => setToDelete(g) }]} />
                </div>
              ); })}
            </div>
          </Panel>
        )}

      {/* Rodapé analítico */}
      {goals.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
          <Panel tone="sky" title="Evolução do Patrimônio das Metas" icon={TrendingUp} iconClass="text-sky-400"
            action={<div className="inline-flex rounded-xl ring-1 ring-[hsl(var(--border))] p-0.5">{[3, 6, 12].map((r) => <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${range === r ? 'bg-violet-600 text-white shadow-[0_0_10px_rgba(139,92,246,.5)]' : 'text-muted'}`}>{r}M</button>)}</div>}>
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 26, right: 44, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="glEvo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                  <YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
                  <Area type="monotone" dataKey="v" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#glEvo)" dot={{ r: 3, fill: '#0f172a', stroke: '#2dd4bf', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  {lastPt && <ReferenceDot x={lastPt.name} y={lastPt.v} r={5} fill="#ccfbf1" stroke="#2dd4bf" strokeWidth={2} label={{ value: formatCurrency(lastPt.v), position: 'top', fill: 'hsl(var(--text))', fontSize: 11, fontWeight: 700 }} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted">Reconstruído a partir dos depósitos registrados em cada meta.</p>
          </Panel>

          <Panel tone="violet" title="Distribuição por Meta" icon={null}>
            <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 items-center">
              <Donut data={dist} size={170} center={<><span className="font-display font-bold">{formatCurrency(saved)}</span><span className="text-xs text-muted">Total</span></>} />
              <div className="space-y-2">{dist.map((d) => <div key={d.name} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} /><span className="flex-1 truncate">{d.name}</span><span className="text-muted">{pct1(d.pct)}</span></div>)}</div>
            </div>
          </Panel>

          <Panel tone="violet" title="Próximos Marcos" icon={Flag} iconClass="text-fuchsia-400">
            {milestones.length === 0 ? <p className="text-sm text-muted">Todas as metas foram concluídas. 🏆</p> : (
              <div className="space-y-2.5">
                {milestones.map(({ g, step, value, need, rel }) => { const Icon = iconFor(g.category); return (
                  <button key={g.id} onClick={() => { setDeposit(g); setDepValue(need ? need.toFixed(2) : ''); }} className="w-full flex items-center gap-3 rounded-xl ring-1 ring-[hsl(var(--border))] p-3 text-left hover:bg-black/5 dark:hover:bg-white/5">
                    <span className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0"><span className="block font-bold">{formatCurrency(value)}</span><span className="block text-xs text-muted truncate">{step}% de {g.name} · faltam {formatCurrency(need)}</span></span>
                    {rel != null && <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-500">+{rel.toFixed(1).replace('.', ',')}%</span>}
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </button>
                ); })}
              </div>
            )}
          </Panel>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar meta' : 'Nova meta'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Reserva de emergência" /></Field>
          <Field label="Tipo da meta"><Select value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor alvo"><Input type="number" step="0.01" required value={form.target_amount} onChange={set('target_amount')} /></Field>
            <Field label="Já guardado"><Input type="number" step="0.01" value={form.current_amount} onChange={set('current_amount')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta mensal"><Input type="number" step="0.01" value={form.monthly_target} onChange={set('monthly_target')} placeholder="quanto guardar/mês" /></Field>
            <Field label="Data alvo"><Input type="date" value={form.target_date} onChange={set('target_date')} /></Field>
          </div>
          {form.target_date && Number(form.target_amount) > 0 && (() => {
            const p = goalPlan({ ...form }); const need = p.neededPerMonth || 0;
            return (
              <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                <span>Para bater até {brDate(form.target_date)} ({p.monthsLeft} {p.monthsLeft === 1 ? 'mês' : 'meses'}): guarde ~<b>{formatCurrency(need)}/mês</b></span>
                <button type="button" onClick={() => setForm((f) => ({ ...f, monthly_target: need.toFixed(2) }))} className="text-xs font-semibold underline shrink-0">usar</button>
              </div>
            );
          })()}
        </form>
      </Modal>

      <Modal open={!!deposit} onClose={() => setDeposit(null)} title={`Depositar em ${deposit?.name || 'meta'}`} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setDeposit(null)}>Cancelar</Button><Button onClick={() => doDeposit.mutate({ goal: deposit, value: Number(depValue) })} disabled={!Number(depValue) || doDeposit.isPending}>{doDeposit.isPending ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</Button></>}>
        <Field label="Valor" hint="Use um valor negativo para registrar uma retirada."><Input type="number" step="0.01" value={depValue} onChange={(e) => setDepValue(e.target.value)} placeholder="0,00" autoFocus /></Field>
        {deposit && <p className="text-xs text-muted mt-2">Guardado: {formatCurrency(deposit.current_amount)} de {formatCurrency(deposit.target_amount)}{deposit.monthly_target ? ` · meta mensal ${formatCurrency(deposit.monthly_target)}` : ''}</p>}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir meta" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>Excluir</Button></>}>
        <p className="text-sm text-muted">Excluir “{toDelete?.name}”? O valor guardado registrado nela deixa de aparecer nas metas.</p>
      </Modal>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, chip }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-violet-400/25 shadow-soft p-4 flex items-center gap-3">
      <Icon className={`w-9 h-9 shrink-0 ${tone}`} strokeWidth={1.7} />
      <div className="min-w-0 flex-1"><p className="text-xs text-muted">{label}</p><p className="font-display text-xl 2xl:text-2xl font-bold whitespace-nowrap">{value}</p></div>
      {chip}
    </div>
  );
}

function GoalCard({ g, fav, onFav, onDeposit, onEdit, onDelete }) {
  const th = GOAL_THEMES[g.category || 'other'] || GOAL_THEMES.other;
  const Icon = iconFor(g.category);
  const p = g.plan;
  return (
    <div className="h-full rounded-2xl overflow-hidden bg-[hsl(var(--card))] ring-1 hover-lift flex flex-col" style={{ '--tw-ring-color': `${th.accent}66`, boxShadow: `0 0 26px ${th.accent}26` }}>
      <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden><path d="M0 80 Q50 50 100 70 T200 55 L200 100 L0 100 Z" fill="#000" fillOpacity=".25" /><circle cx="160" cy="25" r="18" fill="#fff" fillOpacity=".08" /></svg>
        <Icon className="absolute -right-3 -bottom-4 w-28 h-28 text-white/15" strokeWidth={1.2} />
        <Icon className="absolute left-4 top-4 w-7 h-7" style={{ color: th.accent }} />
        <div className="absolute right-2 top-2 flex items-center gap-0.5 text-white">
          <button onClick={onFav} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={fav} className="p-1.5 rounded-lg hover:bg-white/15"><Star className={`w-4 h-4 ${fav ? 'fill-amber-300 text-amber-300' : ''}`} /></button>
          <KebabMenu items={[{ icon: PiggyBank, label: 'Depositar', onClick: onDeposit }, { icon: Pencil, label: 'Editar', onClick: onEdit }, { icon: Trash2, label: 'Excluir', danger: true, onClick: onDelete }]} />
        </div>
        {g.done ? <span className="absolute left-4 bottom-3 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white"><Trophy className="w-3 h-3" /> META BATIDA</span>
          : p.late ? <span className="absolute left-4 bottom-3 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white"><AlertTriangle className="w-3 h-3" /> ATRASADA</span>
          : <button onClick={onDeposit} className="absolute right-3 bottom-3 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 text-slate-900 hover:bg-white"><Plus className="w-3 h-3" /> Depositar</button>}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="font-display text-lg font-bold truncate">{g.name}</p>
        <p className="text-sm"><b style={{ color: th.accent }}>{formatCurrency(g.current_amount)}</b> <span className="text-muted">/ {formatCurrency(g.target_amount)}</span></p>
        <div className="flex items-center gap-2 mt-2.5"><Bar pct={p.pct} color={th.accent} className="h-2.5 flex-1" glow /><span className="text-sm font-bold w-11 text-right" style={{ color: th.accent }}>{Math.round(p.pct)}%</span></div>
        <div className="mt-auto pt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg ring-1 ring-[hsl(var(--border))] px-2 py-1.5"><CalendarDays className="w-3.5 h-3.5 text-muted" /> {g.target_date ? brDate(g.target_date) : g.done ? 'Concluída' : 'Sem prazo'}</span>
          <span className="flex items-center gap-1.5 rounded-lg ring-1 ring-[hsl(var(--border))] px-2 py-1.5 justify-end" title="Quanto guardar por mês para bater no prazo"><Layers className="w-3.5 h-3.5 text-muted" /> {p.neededPerMonth != null && !g.done ? `${formatCurrency(p.neededPerMonth)}/mês` : g.monthly_target && !g.done ? `${formatCurrency(g.monthly_target)}/mês` : g.done ? '100% guardado' : 'Livre'}</span>
        </div>
      </div>
    </div>
  );
}
