import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Subscription, Transaction } from '../api/entities.js';
import { detectSubscriptions } from '../lib/analytics.js';
import { Button, Input, Field, Modal, Textarea, Spinner } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, Donut, DeltaChip, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { AppsArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, RefreshCw, Pencil, Trash2, CalendarDays, AlertTriangle, Layers, Search, FileText, Sparkles, ArrowRight, Brain, LayoutGrid, List, Check, PauseCircle, PlayCircle, CircleDot, TrendingUp, ChevronDown } from 'lucide-react';

const POPULAR = [
  { name: 'Netflix', emoji: '🎬', color: '#e50914', category: 'Entretenimento' }, { name: 'Spotify', emoji: '🎵', color: '#1db954', category: 'Entretenimento' },
  { name: 'Amazon Prime', emoji: '📦', color: '#00a8e1', category: 'Entretenimento' }, { name: 'Disney+', emoji: '✨', color: '#113ccf', category: 'Entretenimento' },
  { name: 'YouTube Premium', emoji: '▶️', color: '#ff0000', category: 'Entretenimento' }, { name: 'iCloud', emoji: '☁️', color: '#3693f3', category: 'Armazenamento' },
  { name: 'Microsoft 365', emoji: '🪟', color: '#0067b8', category: 'Produtividade' }, { name: 'Gympass', emoji: '🏋️', color: '#f9a825', category: 'Saúde & Bem-estar' },
  { name: 'Adobe CC', emoji: '🎨', color: '#ff0000', category: 'Produtividade' }, { name: 'HBO Max', emoji: '🎭', color: '#5b2e91', category: 'Entretenimento' },
  { name: 'Duolingo', emoji: '🦉', color: '#58cc02', category: 'Educação' }, { name: 'ChatGPT', emoji: '🤖', color: '#10a37f', category: 'Produtividade' },
];
const CATS = ['Entretenimento', 'Produtividade', 'Armazenamento', 'Saúde & Bem-estar', 'Educação', 'Tecnologia', 'Casa', 'Outros'];
const CAT_COLORS = ['#a855f7', '#6366f1', '#22d3ee', '#f43f5e', '#f59e0b', '#10b981', '#38bdf8', '#64748b'];
const FREQ = [['daily', 'Diário'], ['weekly', 'Semanal'], ['monthly', 'Mensal'], ['rarely', 'Raramente'], ['never', 'Nunca uso']];
const LOW = ['rarely', 'never'];
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const empty = { name: '', amount: '', renewal_day: 1, category: '', color: '#8b5cf6', icon_emoji: '📱', usage_frequency: 'monthly', notes: '', is_active: true };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const nextDate = (day) => { const t = today0(); const clamp = (y, m) => Math.min(Number(day) || 1, new Date(y, m + 1, 0).getDate()); let d = new Date(t.getFullYear(), t.getMonth(), clamp(t.getFullYear(), t.getMonth())); if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, clamp(t.getFullYear(), t.getMonth() + 1)); return d; };
const fmtD = (d) => `${String(d.getDate()).padStart(2, '0')} ${MES[d.getMonth()]}`;

export default function Subscriptions() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: subs = [], isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const suggestions = useMemo(() => detectSubscriptions(transactions, subs).filter((x) => !/fatura|cart[ãa]o de cr[ée]dito|pagamento de cart/i.test(x.name)), [transactions, subs]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [sort, setSort] = useState('next');
  const [view, setView] = useState('grid');
  const [onlyLow, setOnlyLow] = useState(false);
  const [sugIdx, setSugIdx] = useState(0);

  const inval = () => qc.invalidateQueries({ queryKey: ['subscriptions'] });
  const save = useMutation({ mutationFn: (p) => (editing ? Subscription.update(editing.id, p) : Subscription.create(p)), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Subscription.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const toggle = useMutation({ mutationFn: (s) => Subscription.update(s.id, { is_active: s.is_active === false }), onSuccess: inval });

  const openNew = (preset) => { setEditing(null); setForm(preset ? { ...empty, name: preset.name, icon_emoji: preset.emoji || '📱', color: preset.color || '#8b5cf6', amount: preset.amount ?? '', renewal_day: preset.renewal_day ?? 1, category: preset.category || '' } : empty); setModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...empty, ...s, notes: s.notes || '', category: s.category || '', is_active: s.is_active !== false }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e?.preventDefault?.(); if (!String(form.name).trim()) return; save.mutate({ ...form, amount: Number(form.amount || 0), renewal_day: Number(form.renewal_day || 1) }); };

  const enriched = useMemo(() => subs.map((s) => ({ ...s, active: s.is_active !== false, low: LOW.includes(s.usage_frequency), next: nextDate(s.renewal_day), cat: s.category || 'Sem categoria' })), [subs]);
  const active = enriched.filter((s) => s.active);
  const monthly = active.reduce((s, x) => s + Number(x.amount || 0), 0);
  const lowList = active.filter((s) => s.low);
  const saving = lowList.reduce((s, x) => s + Number(x.amount || 0), 0);

  const catColor = (name) => { const k = CATS.indexOf(name); return CAT_COLORS[k >= 0 ? k : CATS.length - 1]; };
  const byCat = useMemo(() => { const m = {}; for (const s of active) { m[s.cat] = (m[s.cat] || 0) + Number(s.amount || 0); } return Object.entries(m).map(([name, value]) => ({ name, value, color: catColor(name) })).sort((a, b) => b.value - a.value); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // evolução: custo mensal das assinaturas ativas cadastradas até o fim de cada mês
  const evolution = useMemo(() => { const now = new Date(); const out = []; for (let k = 5; k >= 0; k--) { const end = new Date(now.getFullYear(), now.getMonth() - k + 1, 0); const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`; out.push({ name: `${MES[end.getMonth()]}/${String(end.getFullYear()).slice(2)}`, v: Math.round(active.filter((s) => !s.created_date || String(s.created_date).slice(0, 10) <= endIso).reduce((a, s) => a + Number(s.amount || 0), 0) * 100) / 100 }); } return out; }, [active]);
  const prevV = evolution[evolution.length - 2]?.v; const lastV = evolution[evolution.length - 1]?.v;
  const evoDelta = prevV > 0 ? ((lastV - prevV) / prevV) * 100 : null;

  const upcoming = [...active].sort((a, b) => a.next - b.next);
  const days14 = Array.from({ length: 14 }, (_, k) => { const d = today0(); d.setDate(d.getDate() + k); return d; });
  const dayItems = (d) => active.filter((s) => s.next.getTime() === d.getTime());

  const cats = [...new Set(enriched.map((s) => s.cat))];
  const list = useMemo(() => { let a = enriched.filter((s) => (catFilter === 'all' || s.cat === catFilter) && (!onlyLow || (s.low && s.active))); if (sort === 'value') a.sort((x, y) => y.amount - x.amount); else if (sort === 'az') a.sort((x, y) => x.name.localeCompare(y.name)); else a.sort((x, y) => (x.active === y.active ? x.next - y.next : x.active ? -1 : 1)); return a; }, [enriched, catFilter, sort, onlyLow]);
  const sug = suggestions[sugIdx % Math.max(1, suggestions.length)];

  const Status = ({ s }) => !s.active ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-500/20 text-muted ring-1 ring-slate-400/30">Pausada</span>
    : s.low ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/40"><AlertTriangle className="w-3 h-3" />Baixo uso</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-400/40"><Check className="w-3 h-3" />Ativa</span>;
  const Avatar = ({ s, size = 'w-11 h-11 text-xl' }) => <span className={`${size} rounded-xl grid place-items-center shrink-0 ring-1 ring-white/10`} style={{ background: `linear-gradient(135deg, ${s.color || '#8b5cf6'}, ${s.color || '#8b5cf6'}88)` }}>{s.icon_emoji || '📱'}</span>;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,780px)_1fr] gap-5 items-start">
          <div className="space-y-4 min-w-0 relative z-[1]">
            <HeroTitle icon={RefreshCw} lead="Assinaturas" accent="" iconClass="text-teal-400" subtitle="Controle e otimize seus serviços recorrentes em um só lugar" />
            <div className="grid sm:grid-cols-[1.6fr_.75fr_.75fr] gap-3">
              <section className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-fuchsia-400/40 bg-[linear-gradient(120deg,rgba(168,85,247,.35),rgba(15,23,42,.2)_60%,rgba(34,211,238,.15))] shadow-[0_0_40px_-12px_rgba(217,70,239,.6)]">
                <svg viewBox="0 0 300 60" className="absolute inset-x-0 bottom-0 w-full h-16 opacity-50" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50 C60 30 100 56 160 34 S260 10 300 22 V60 H0 Z" fill="#a855f7" opacity=".35" /></svg>
                <p className="relative text-[11px] font-bold tracking-[0.25em] text-fuchsia-600 dark:text-fuchsia-200/90">GASTO MENSAL COM ASSINATURAS</p>
                <p className="relative font-display text-4xl sm:text-5xl font-extrabold mt-1"><AnimatedValue value={monthly} format={formatCurrency} /></p>
                <p className="relative text-sm text-muted mt-1 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Projeção anual: <b className="text-[hsl(var(--text))]">{formatCurrency(monthly * 12)}</b></p>
              </section>
              <div className="rounded-3xl ring-1 ring-sky-400/40 bg-[hsl(var(--card))] p-4"><Layers className="w-7 h-7 text-sky-400" /><p className="text-sm mt-2">Assinaturas ativas</p><p className="font-display text-3xl font-extrabold">{active.length}</p>{enriched.length > active.length && <p className="text-[11px] text-muted">{enriched.length - active.length} pausada(s)</p>}</div>
              <button onClick={() => setOnlyLow((v) => !v)} className={`text-left rounded-3xl ring-1 p-4 transition ${onlyLow ? 'ring-2 ring-amber-400 bg-amber-500/15' : 'ring-amber-400/50 bg-amber-500/10 hover:bg-amber-500/15'}`}><AlertTriangle className="w-7 h-7 text-amber-400" /><p className="text-sm mt-2 font-semibold text-amber-600 dark:text-amber-300">Baixo uso</p><p className="font-display text-3xl font-extrabold">{lowList.length}</p><p className="text-[11px] text-muted">{lowList.length ? 'Pode cancelar' : 'Nenhuma'}</p></button>
            </div>
          </div>
          <div className="hidden xl:flex flex-col items-end gap-2">
            <GlowButton tone="sky" onClick={() => openNew()} className="py-2.5 px-5"><Plus className="w-4 h-4" />Nova assinatura</GlowButton>
            <AppsArt className="w-full max-w-[560px] h-56 -mt-4" />
          </div>
          <GlowButton tone="sky" onClick={() => openNew()} className="xl:hidden w-fit"><Plus className="w-4 h-4" />Nova assinatura</GlowButton>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-muted mb-2 flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5 text-sky-400" />SERVIÇOS POPULARES</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((p) => (
            <button key={p.name} onClick={() => openNew(p)} className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm font-semibold hover:ring-sky-400/60 transition">
              <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-black text-white" style={{ background: p.color }}>{p.name[0]}</span>{p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-3xl ring-1 ring-sky-400/40 bg-[hsl(var(--card))] p-4">
          <p className="text-[11px] font-bold tracking-[0.2em] text-sky-600 dark:text-sky-300 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" />DETECTADAS NO SEU HISTÓRICO {suggestions.length > 1 && <span className="ml-auto normal-case tracking-normal font-semibold text-muted">{(sugIdx % suggestions.length) + 1} de {suggestions.length}</span>}</p>
          {sug ? (
            <div className="flex items-center gap-3 mt-2.5">
              <span className="w-11 h-11 rounded-xl grid place-items-center bg-sky-500/15 ring-1 ring-sky-400/40 shrink-0"><FileText className="w-5 h-5 text-sky-400" /></span>
              <div className="flex-1 min-w-0"><p className="font-semibold truncate">{sug.name}</p><p className="text-sm text-muted">{formatCurrency(sug.amount)}/mês · aparece em {sug.months} meses</p></div>
              {suggestions.length > 1 && <button onClick={() => setSugIdx((i) => i + 1)} className="text-xs text-muted hover:text-[hsl(var(--text))] px-2">Próxima</button>}
              <button onClick={() => openNew({ name: sug.name, emoji: '🔁', color: '#10b981', amount: sug.amount, renewal_day: sug.renewal_day })} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 ring-sky-400/50 hover:bg-sky-500/10"><Plus className="w-4 h-4" />Adicionar</button>
            </div>
          ) : <p className="text-sm text-muted mt-2.5">Nenhuma cobrança recorrente nova encontrada nos seus lançamentos (precisa aparecer em 3 meses ou mais).</p>}
        </section>
        <section className="rounded-3xl ring-1 ring-fuchsia-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(80%_120%_at_0%_50%,rgba(217,70,239,.14),transparent)] p-4">
          <p className="text-[11px] font-bold tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />INSIGHTS AUTOMÁTICOS</p>
          <div className="flex items-center gap-3 mt-2.5">
            <span className="w-11 h-11 rounded-xl grid place-items-center bg-violet-500/20 ring-1 ring-violet-400/50 shrink-0"><Brain className="w-6 h-6 text-violet-300" /></span>
            <div className="flex-1 min-w-0">
              {lowList.length ? <><p className="font-semibold text-lg">Potencial de economia: <span className="text-emerald-600 dark:text-emerald-300">{formatCurrency(saving)}/mês</span></p><p className="text-sm text-muted truncate">Você tem {lowList.length} assinatura(s) com baixo uso ({lowList.map((s) => s.name).join(', ')}).</p></>
                : <><p className="font-semibold text-lg">Nenhuma assinatura marcada com baixo uso</p><p className="text-sm text-muted">Informe a frequência de uso de cada serviço para encontrar economias.</p></>}
            </div>
            {lowList.length > 0 && <GlowButton tone="sky" onClick={() => { setOnlyLow(true); document.getElementById('subs-list')?.scrollIntoView({ behavior: 'smooth' }); }} className="whitespace-nowrap">Ver recomendações<ArrowRight className="w-4 h-4" /></GlowButton>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr_1.3fr] gap-5">
        <Panel title="Próximas renovações" icon={CalendarDays} iconClass="text-fuchsia-400" action={<button onClick={() => nav('/calendario')} className="text-xs text-muted hover:text-[hsl(var(--text))] flex items-center gap-1">Ver todas<ArrowRight className="w-3.5 h-3.5" /></button>}>
          {upcoming.length ? upcoming.slice(0, 4).map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))] last:border-0">
              <Avatar s={s} size="w-8 h-8 text-base" /><span className="flex-1 truncate font-medium text-sm">{s.name}</span>
              <span className="text-xs text-muted flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{fmtD(s.next)}</span>
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-200 ring-1 ring-fuchsia-400/40">{formatCurrency(s.amount)}</span>
            </div>)) : <p className="text-sm text-muted">Nenhuma assinatura ativa.</p>}
        </Panel>
        <Panel title={<span>Gastos por categoria <span className="text-sm font-normal text-muted">(mensal)</span></span>} icon={CircleDot} iconClass="text-sky-400">
          <div className="flex items-center gap-4">
            <Donut size={140} thickness={0.2} data={byCat} center={<><span className="font-display font-bold">{formatCurrency(monthly)}</span><span className="text-[10px] text-muted">Total mensal</span></>} />
            <div className="flex-1 min-w-0 space-y-2">{byCat.slice(0, 5).map((c) => <div key={c.name} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="text-xs text-muted tabular-nums">{Math.round(monthly ? (c.value / monthly) * 100 : 0)}%</span><span className="text-xs tabular-nums w-20 text-right">{formatCurrency(c.value)}</span></div>)}{!byCat.length && <p className="text-sm text-muted">Sem assinaturas ativas.</p>}</div>
          </div>
        </Panel>
        <Panel title="Evolução do gasto com assinaturas" icon={TrendingUp} iconClass="text-sky-400" action={evoDelta != null && Math.abs(evoDelta) > 0.05 ? <span className="flex items-center gap-1.5 text-xs text-muted"><DeltaChip v={evoDelta} invert />vs. mês anterior</span> : null}>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `R$ ${Math.round(v)}`} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Custo mensal']} contentStyle={TIP} />
                <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#e9d5ff', stroke: '#a855f7' }} activeDot={{ r: 6 }} style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,.6))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted">Considera a data de cadastro de cada assinatura ativa.</p>
        </Panel>
      </div>

      <section className="rounded-3xl ring-1 ring-sky-400/40 bg-[hsl(var(--card))] p-3 flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-3 pr-2 shrink-0"><span className="w-11 h-11 rounded-xl grid place-items-center bg-sky-500/15 ring-1 ring-sky-400/40"><CalendarDays className="w-6 h-6 text-sky-400" /></span><div><p className="font-display font-bold">Calendário de cobranças</p><p className="text-xs text-muted">Visão dos próximos 14 dias</p></div></div>
        <div className="flex gap-1 flex-1 min-w-0">
          {days14.map((d, k) => { const it = dayItems(d); return (
            <div key={k} title={it.map((s) => `${s.name} ${formatCurrency(s.amount)}`).join('\n')} className={`min-w-[50px] flex-1 rounded-xl px-1 py-1.5 text-center ring-1 ${k === 0 ? 'ring-sky-400 bg-sky-500/20' : it.length ? 'ring-fuchsia-400/50 bg-fuchsia-500/10' : 'ring-[hsl(var(--border))]'}`}>
              <p className="text-[11px] font-semibold">{k === 0 ? 'Hoje' : WD[d.getDay()]}</p><p className="text-[11px] text-muted">{fmtD(d)}</p>
              <div className="flex justify-center gap-0.5 h-1.5 mt-0.5">{it.slice(0, 3).map((s) => <span key={s.id} className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />)}</div>
            </div>); })}
        </div>
        <button onClick={() => nav('/calendario')} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold ring-1 ring-sky-400/50 hover:bg-sky-500/10"><CalendarDays className="w-4 h-4" />Ver no calendário</button>
      </section>

      <div id="subs-list" className="scroll-mt-24">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-teal-400" />Suas assinaturas <span className="text-muted font-normal">({list.length})</span></h2>
          {onlyLow && <button onClick={() => setOnlyLow(false)} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/40">Só baixo uso ✕</button>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative"><select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="appearance-none rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] pl-3 pr-8 py-2 text-sm outline-none"><option value="all">Todas as categorias</option>{cats.map((c) => <option key={c}>{c}</option>)}</select><ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" /></div>
            <label className="relative flex items-center rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] pl-3 text-sm text-muted">Ordenar por:<select value={sort} onChange={(e) => setSort(e.target.value)} className="appearance-none bg-transparent pl-1.5 pr-8 py-2 font-semibold text-[hsl(var(--text))] outline-none"><option value="next" className="bg-[hsl(var(--card))]">Próxima cobrança</option><option value="value" className="bg-[hsl(var(--card))]">Maior valor</option><option value="az" className="bg-[hsl(var(--card))]">A–Z</option></select><ChevronDown className="w-4 h-4 absolute right-2.5 pointer-events-none" /></label>
            <div className="flex rounded-xl ring-1 ring-[hsl(var(--border))] p-0.5 bg-[hsl(var(--card))]"><button onClick={() => setView('grid')} aria-label="Cards" className={`p-1.5 rounded-lg ${view === 'grid' ? 'bg-sky-500 text-white' : 'text-muted'}`}><LayoutGrid className="w-4 h-4" /></button><button onClick={() => setView('list')} aria-label="Lista" className={`p-1.5 rounded-lg ${view === 'list' ? 'bg-sky-500 text-white' : 'text-muted'}`}><List className="w-4 h-4" /></button></div>
          </div>
        </div>

        {enriched.length === 0 ? (
          <Panel><div className="text-center py-8"><AppsArt className="w-72 h-32 mx-auto" /><p className="font-display text-xl font-bold mt-2">Nenhuma assinatura</p><p className="text-sm text-muted">Adicione seus serviços recorrentes ou escolha um dos populares acima.</p><GlowButton tone="sky" onClick={() => openNew()} className="mt-4"><Plus className="w-4 h-4" />Nova assinatura</GlowButton></div></Panel>
        ) : view === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
            {list.map((s) => (
              <div key={s.id} className={`relative rounded-2xl ring-1 p-3.5 transition ${!s.active ? 'opacity-60' : ''}`} style={{ background: `linear-gradient(160deg, ${s.low && s.active ? '#f59e0b' : s.color}26, transparent 70%)`, '--tw-ring-color': `${s.low && s.active ? '#f59e0b' : s.color}88`, boxShadow: `0 0 22px -10px ${s.low && s.active ? '#f59e0b' : s.color}` }}>
                <div className="flex items-start gap-2.5"><Avatar s={s} /><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{s.name}</p><p className="text-[11px] text-muted truncate">{s.cat}</p></div><Status s={s} /></div>
                <p className="font-display text-2xl font-extrabold mt-2" style={{ color: s.low && s.active ? '#f59e0b' : s.color }}>{formatCurrency(s.amount)}</p>
                <span className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 mt-1">Mensal</span>
                <div className="flex items-center gap-1 mt-2.5 text-xs whitespace-nowrap"><CalendarDays className="w-3.5 h-3.5 text-muted shrink-0" /><span className="text-muted">Próx. cobrança:</span><b>{s.active ? fmtD(s.next) : '—'}</b>
                  <span className="ml-auto flex">
                    <button onClick={() => toggle.mutate(s)} title={s.active ? 'Pausar' : 'Reativar'} className="p-1 rounded-md text-muted hover:text-[hsl(var(--text))]">{s.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}</button>
                    <button onClick={() => openEdit(s)} title="Editar" className="p-1 rounded-md text-muted hover:text-[hsl(var(--text))]"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setToDelete(s)} title="Excluir" className="p-1 rounded-md text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </span>
                </div>
              </div>))}
          </div>
        ) : (
          <Panel>{list.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0 ${!s.active ? 'opacity-60' : ''}`}>
              <Avatar s={s} size="w-9 h-9 text-lg" /><div className="w-48 min-w-0"><p className="font-semibold truncate">{s.name}</p><p className="text-[11px] text-muted">{s.cat}</p></div>
              <Status s={s} /><span className="flex-1 text-xs text-muted">{(FREQ.find((f) => f[0] === s.usage_frequency) || [])[1]}</span>
              <span className="text-xs text-muted w-28">Próx.: <b className="text-[hsl(var(--text))]">{s.active ? fmtD(s.next) : '—'}</b></span>
              <b className="w-24 text-right">{formatCurrency(s.amount)}</b>
              <button onClick={() => toggle.mutate(s)} className="p-1.5 text-muted">{s.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}</button>
              <button onClick={() => openEdit(s)} className="p-1.5 text-muted"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => setToDelete(s)} className="p-1.5 text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>))}</Panel>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar assinatura' : 'Nova assinatura'} maxWidth="max-w-xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><GlowButton tone="sky" onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</GlowButton></>}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[80px_1fr_80px] gap-3 items-end">
            <Field label="Emoji"><Input value={form.icon_emoji} onChange={(e) => set('icon_emoji', e.target.value)} className="text-center text-xl" maxLength={2} /></Field>
            <Field label="Nome"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Netflix, Spotify..." /></Field>
            <Field label="Cor"><input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="w-full h-10 rounded-lg border border-[hsl(var(--border))]" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor mensal (R$)"><Input type="number" step="0.01" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Dia de renovação"><Input type="number" min="1" max="31" value={form.renewal_day} onChange={(e) => set('renewal_day', e.target.value)} /></Field>
          </div>
          <Field label="Frequência de uso">
            <div className="flex flex-wrap gap-2">{FREQ.map(([v, l]) => <button key={v} type="button" onClick={() => set('usage_frequency', v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ${form.usage_frequency === v ? 'ring-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300' : 'ring-[hsl(var(--border))] text-muted'}`}>{l}</button>)}</div>
          </Field>
          <Field label="Categoria"><Input list="sub-cats" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Entretenimento, Produtividade..." /><datalist id="sub-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} className="accent-sky-500 w-4 h-4" />Assinatura ativa (desmarque para pausar sem excluir)</label>
          <Field label="Notas"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Observações..." /></Field>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir assinatura" footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><button onClick={() => del.mutate(toDelete.id)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">Excluir</button></>}>
        <p className="text-sm">Excluir <b>{toDelete?.name}</b>? Se só quer parar de contar, use “Pausar”.</p>
      </Modal>
    </div>
  );
}
