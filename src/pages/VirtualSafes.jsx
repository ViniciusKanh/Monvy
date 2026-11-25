import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Goal, Transaction, Account } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { Button, Input, Select, Field, Modal, Spinner } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, Ring, Bar, GlowButton, InsightRow, TIP, pct1 } from '../components/kit.jsx';
import { VaultArt } from '../components/art/PageArt.jsx';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Vault, PiggyBank, Plane, Car, Home, GraduationCap, HeartPulse, Wallet, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, Info, Target, BarChart3, Coins, CalendarDays, Sparkles, ArrowRight, Award, Check, Flag } from 'lucide-react';

// Cofres = Metas (mesmos dados) -> sempre sincronizados
const CATS = [
  { v: 'emergency', label: 'Emergência', icon: PiggyBank },
  { v: 'travel', label: 'Viagem', icon: Plane },
  { v: 'home', label: 'Casa', icon: Home },
  { v: 'car', label: 'Carro', icon: Car },
  { v: 'education', label: 'Educação', icon: GraduationCap },
  { v: 'health', label: 'Saúde', icon: HeartPulse },
  { v: 'other', label: 'Outro', icon: Wallet },
];
const iconFor = (c) => (CATS.find((x) => x.v === c)?.icon || Vault);
const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];
const empty = { name: '', target_amount: '', current_amount: 0, category: 'other', color: '#10b981' };
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const histOf = (g) => (Array.isArray(g.history) ? g.history : []);
const brDate = (iso) => { if (!iso) return '—'; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${String(d.getDate()).padStart(2, '0')} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
const mkOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function VirtualSafes() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [move, setMove] = useState(null);
  const [moveVal, setMoveVal] = useState('');
  const [moveAccount, setMoveAccount] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const inval = () => { qc.invalidateQueries({ queryKey: ['goals'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); };
  const save = useMutation({ mutationFn: (p) => (editing ? Goal.update(editing.id, p) : Goal.create(p)), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Goal.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const doMove = useMutation({
    mutationFn: async ({ g, type, value, accountId }) => {
      const cur = Number(g.current_amount || 0);
      if (!(value > 0)) throw new Error('Informe um valor válido');
      if (type === 'out' && value > cur) throw new Error('Valor maior que o disponível no cofre');
      // guardar debita a conta; retirar credita a conta (via transferência -> recalcula saldos)
      await Transaction.create({ type: 'transfer', amount: value, status: 'completed', date: todayIso(), account_id: type === 'in' ? accountId : null, account_to_id: type === 'out' ? accountId : null, description: type === 'in' ? `Guardado no cofre: ${g.name}` : `Retirado do cofre: ${g.name}` });
      const next = type === 'in' ? cur + value : Math.max(0, cur - value);
      const status = next >= Number(g.target_amount || Infinity) && Number(g.target_amount) > 0 ? 'completed' : 'active';
      await Goal.update(g.id, { current_amount: next, status, history: [...histOf(g), { date: todayIso(), amount: type === 'in' ? value : -value, kind: type === 'in' ? 'deposito' : 'retirada', src: 'cofre' }] });
    },
    onSuccess: () => { inval(); setMove(null); setMoveVal(''); setMoveAccount(''); toast.success('Movimentação registrada'); },
    onError: (e) => toast.error(e.message || 'Falha na movimentação'),
  });
  const openMove = (g, type) => { setMove({ g, type }); setMoveVal(''); setMoveAccount(g.account_id || accounts[0]?.id || ''); };
  const openNew = () => { setEditing(null); setForm({ ...empty, start_date: todayIso() }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ name: g.name, target_amount: g.target_amount ?? '', current_amount: g.current_amount ?? 0, category: g.category || 'other', color: g.color }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => {
    e?.preventDefault?.();
    if (!String(form.name).trim()) return;
    const cur = Number(form.current_amount || 0);
    const p = { ...form, target_amount: Number(form.target_amount || 0), current_amount: cur, status: editing?.status || 'active' };
    if (editing) { const d = cur - Number(editing.current_amount || 0); if (Math.abs(d) > 0.004) p.history = [...histOf(editing), { date: todayIso(), amount: Math.round(d * 100) / 100, kind: 'ajuste' }]; }
    else { p.start_date = todayIso(); p.history = cur > 0 ? [{ date: todayIso(), amount: cur, kind: 'inicial' }] : []; }
    save.mutate(p);
  };

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const progress = totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0;

  // aportes por mês: histórico dos cofres/metas + transferências antigas "Guardado no cofre" sem histórico correspondente
  const contribs = useMemo(() => {
    const ev = [];
    const keyed = new Set();
    for (const g of goals) for (const h of histOf(g)) { const a = Number(h.amount || 0); if (a > 0 && h.kind !== 'ajuste') { ev.push({ date: String(h.date).slice(0, 10), amount: a }); if (h.src === 'cofre') keyed.add(`${String(h.date).slice(0, 10)}|${a}|${g.name}`); } }
    for (const t of transactions) { const m = /^Guardado no cofre: (.+)$/.exec(t.description || ''); if (t.type !== 'transfer' || !m) continue; const k = `${String(t.date).slice(0, 10)}|${Number(t.amount)}|${m[1]}`; if (keyed.has(k)) { keyed.delete(k); continue; } ev.push({ date: String(t.date).slice(0, 10), amount: Number(t.amount || 0) }); }
    return ev;
  }, [goals, transactions]);
  const monthly = useMemo(() => { const now = new Date(); const out = []; for (let k = 5; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); const mk = mkOf(d); out.push({ name: `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, v: Math.round(contribs.filter((e) => e.date.slice(0, 7) === mk).reduce((s, e) => s + e.amount, 0) * 100) / 100 }); } return out; }, [contribs]);
  const aporteMes = monthly[monthly.length - 1]?.v || 0;
  const activeMonths = monthly.filter((m) => m.v > 0);
  const media = activeMonths.length ? activeMonths.reduce((s, m) => s + m.v, 0) / activeMonths.length : 0;

  // ritmo de cada cofre: média de depósitos dos últimos 3 meses (ou aporte mensal planejado)
  const pace = (g) => { const lim = new Date(); lim.setMonth(lim.getMonth() - 3); const iso = lim.toISOString().slice(0, 10); const dep = histOf(g).filter((h) => Number(h.amount) > 0 && String(h.date).slice(0, 10) >= iso && h.kind !== 'ajuste').reduce((s, h) => s + Number(h.amount), 0); return dep > 0 ? dep / 3 : Number(g.monthly_target || 0); };
  const eta = (g) => { if (g.target_date) return { date: g.target_date, how: 'prazo' }; const rem = Number(g.target_amount || 0) - Number(g.current_amount || 0); if (rem <= 0) return { date: null, how: 'done' }; const p = pace(g); if (!p) return { date: null, how: 'none' }; const d = new Date(); d.setMonth(d.getMonth() + Math.ceil(rem / p)); return { date: d.toISOString().slice(0, 10), how: 'ritmo' }; };

  // linha do tempo: quando o total guardado cruzou 25/50/75%
  const timeline = useMemo(() => {
    const hist = goals.flatMap((g) => histOf(g).map((h) => ({ date: String(h.date).slice(0, 10), amount: Number(h.amount || 0) }))).sort((a, b) => a.date.localeCompare(b.date));
    const created = [...goals.map((g) => g.start_date || g.created_date).filter(Boolean).map((x) => String(x).slice(0, 10)), ...hist.map((h) => h.date)].sort()[0] || todayIso();
    let run = totalSaved - hist.reduce((s, h) => s + h.amount, 0);
    const reached = {}; const marks = [0.25, 0.5, 0.75];
    for (const f of marks) if (totalTarget > 0 && run >= totalTarget * f) reached[f] = created;
    for (const h of hist) { run += h.amount; for (const f of marks) if (!reached[f] && totalTarget > 0 && run >= totalTarget * f) reached[f] = h.date; }
    const steps = [{ label: 'Cofres criados', sub: brDate(created), done: goals.length > 0 }, ...marks.map((f) => ({ label: `${f * 100}% do total`, sub: reached[f] ? brDate(reached[f]) : formatCurrency(totalTarget * f), done: !!reached[f] })), { label: 'Meta total', sub: formatCurrency(totalTarget), done: totalTarget > 0 && totalSaved >= totalTarget, flag: true }];
    const cur = steps.reduce((a, s, i) => (s.done ? i : a), 0);
    return { steps, cur };
  }, [goals, totalSaved, totalTarget]);

  const open = goals.filter((g) => Number(g.target_amount) > Number(g.current_amount || 0));
  const closest = [...open].sort((a, b) => Number(b.current_amount) / Number(b.target_amount) - Number(a.current_amount) / Number(a.target_amount))[0];
  const noPace = open.find((g) => !pace(g));
  const best = [...goals].filter((g) => Number(g.target_amount) > 0).sort((a, b) => Number(b.current_amount) / Number(b.target_amount) - Number(a.current_amount) / Number(a.target_amount))[0];
  const insights = [];
  if (closest) { const p = pace(closest); const rem = Number(closest.target_amount) - Number(closest.current_amount || 0); const plus = Math.max(100, Math.round((p * 0.25) / 50) * 50); const m1 = p ? Math.ceil(rem / p) : null; const m2 = Math.ceil(rem / (p + plus)); insights.push({ tone: 'violet', icon: Home, title: `Acelere a meta ${closest.name}`, text: m1 ? `Aumentar o aporte para ${formatCurrency(p + plus)}/mês antecipa a conclusão em ~${Math.max(0, m1 - m2)} ${m1 - m2 === 1 ? 'mês' : 'meses'}.` : `Faltam ${formatCurrency(rem)}. Com ${formatCurrency(plus)}/mês você conclui em ~${m2} meses.`, onClick: () => openMove(closest, 'in') }); }
  if (noPace) insights.push({ tone: 'amber', icon: Coins, title: 'Defina um aporte mensal', text: `${noPace.name} ainda não tem depósitos recentes nem aporte planejado. Defina um valor na tela de Metas.`, onClick: () => nav('/metas') });
  if (best && Number(best.current_amount) > 0) { const p = (Number(best.current_amount) / Number(best.target_amount)) * 100; insights.push({ tone: 'amber', icon: Award, title: 'Marcos de conquista', text: p >= 100 ? `${best.name} já atingiu a meta!` : `Você já guardou ${Math.floor(p)}% de ${best.name}. Faltam ${formatCurrency(Number(best.target_amount) - Number(best.current_amount))}.` }); }
  if (!insights.length) insights.push({ tone: 'sky', icon: Sparkles, title: 'Crie seu primeiro cofre', text: 'Separe dinheiro por objetivo e acompanhe o progresso aqui e nas Metas.', onClick: openNew });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,820px)_1fr] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <HeroTitle icon={Vault} lead="Cofres Virtuais" accent="" iconClass="text-teal-400" subtitle="Reserve dinheiro por objetivo — sincronizado com suas Metas" />
          <section className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-violet-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(70%_120%_at_0%_0%,rgba(168,85,247,.25),transparent),radial-gradient(60%_100%_at_100%_100%,rgba(45,212,191,.14),transparent)] shadow-[0_0_40px_-12px_rgba(168,85,247,.5)]">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Ring value={progress} size={150} stroke={14} from="#2dd4bf" to="#34d399"><span className="font-display text-4xl font-extrabold">{progress}%</span><span className="text-sm font-semibold text-emerald-500 dark:text-emerald-300">guardado</span></Ring>
              <div className="flex-1 min-w-0 w-full sm:border-l border-[hsl(var(--border))] sm:pl-6">
                <p className="text-[11px] font-bold tracking-[0.25em] text-muted">TOTAL GUARDADO EM COFRES</p>
                <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={totalSaved} format={formatCurrency} /> <span className="text-lg text-muted font-semibold">/ {formatCurrency(totalTarget)}</span></p>
                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  <div className="rounded-xl ring-1 ring-sky-400/40 bg-sky-500/10 px-3 py-2 flex items-center gap-2"><Target className="w-6 h-6 text-sky-400" /><div><p className="text-[11px] text-muted">Cofres/Metas</p><p className="font-display text-xl font-bold">{goals.length}</p></div></div>
                  <div className="rounded-xl ring-1 ring-sky-400/40 bg-sky-500/10 px-3 py-2 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-sky-400" /><div><p className="text-[11px] text-muted">Progresso</p><p className="font-display text-xl font-bold">{progress}%</p></div></div>
                  <div className="rounded-xl ring-1 ring-amber-400/60 bg-amber-500/10 px-3 py-2 flex items-center gap-2"><Coins className="w-6 h-6 text-amber-400" /><div className="min-w-0"><p className="text-[11px] text-muted">Aporte do mês</p><p className="font-display text-xl font-bold truncate">{formatCurrency(aporteMes)}</p></div></div>
                </div>
                <p className="text-xs text-muted mt-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Cada cofre é uma meta — o que você guarda aqui aparece nas Metas, e vice-versa.</p>
              </div>
            </div>
          </section>
        </div>
        <div className="hidden xl:flex flex-col items-end">
          <GlowButton tone="sky" onClick={openNew} className="py-2.5 px-5"><Plus className="w-4 h-4" />Novo cofre</GlowButton>
          <VaultArt className="w-full max-w-[520px] h-60 -mt-2" />
        </div>
        <GlowButton tone="sky" onClick={openNew} className="xl:hidden w-fit"><Plus className="w-4 h-4" />Novo cofre</GlowButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:items-start">
        <div className="xl:col-span-8 min-w-0">
          {goals.length === 0 ? (
            <Panel><div className="text-center py-8"><VaultArt className="w-80 h-36 mx-auto" /><p className="font-display text-xl font-bold mt-2">Nenhum cofre</p><p className="text-sm text-muted">Crie um cofre (que também vira uma meta) para reservar dinheiro.</p><GlowButton tone="sky" onClick={openNew} className="mt-4"><Plus className="w-4 h-4" />Novo cofre</GlowButton></div></Panel>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {goals.map((g) => {
                const Icon = iconFor(g.category); const t = Number(g.target_amount || 0); const c = Number(g.current_amount || 0);
                const pct = t ? Math.min(100, (c / t) * 100) : 0; const e = eta(g);
                return (
                  <section key={g.id} className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-teal-400/40 bg-[hsl(var(--card))] bg-[radial-gradient(80%_80%_at_0%_0%,rgba(45,212,191,.14),transparent),radial-gradient(70%_80%_at_100%_100%,rgba(168,85,247,.14),transparent)] shadow-[0_0_30px_-14px_rgba(45,212,191,.6)]">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl grid place-items-center text-white shrink-0 shadow-[0_0_16px_rgba(45,212,191,.45)]" style={{ background: `linear-gradient(135deg, ${g.color || '#10b981'}, #0d9488)` }}><Icon className="w-6 h-6" /></span>
                      <p className="font-display text-xl font-bold flex-1 truncate">{g.name}</p>
                      <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))]" aria-label="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setToDelete(g)} className="p-1.5 rounded-lg text-rose-500" aria-label="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-end justify-between gap-2 mt-4"><p className="font-display text-3xl font-extrabold text-emerald-600 dark:text-emerald-300">{formatCurrency(c)}</p>{t > 0 && <p className="text-sm text-muted">Meta: <b className="text-[hsl(var(--text))]">{formatCurrency(t)}</b></p>}</div>
                    {t > 0 && <Bar pct={pct} color="linear-gradient(90deg,#2dd4bf,#34d399)" className="h-3 mt-3" glow />}
                    <div className="flex flex-wrap justify-between gap-2 text-sm mt-2"><span>{t ? `${Math.floor(pct)}% da meta` : 'Sem valor de meta'}</span><span className="text-muted flex items-center gap-1"><CalendarDays className="w-4 h-4" />{e.how === 'done' ? 'Meta atingida' : e.date ? <>Conclusão {e.how === 'prazo' ? 'prevista' : 'estimada'}: <b className="text-[hsl(var(--text))]">{brDate(e.date)}</b></> : 'Defina um aporte para estimar'}</span></div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button onClick={() => openMove(g, 'in')} className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-teal-400/60 bg-teal-500/10 hover:bg-teal-500/20"><ArrowDownToLine className="w-4 h-4" />Guardar</button>
                      <button onClick={() => openMove(g, 'out')} disabled={c <= 0} className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold ring-1 ring-fuchsia-400/60 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 disabled:opacity-40"><ArrowUpFromLine className="w-4 h-4" />Retirar</button>
                    </div>
                  </section>);
              })}
            </div>
          )}
        </div>
        <Panel className="xl:col-span-4" tone="violet" glow title={<span className="text-[13px] font-bold tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300">INSIGHTS AUTOMÁTICOS</span>} icon={Sparkles} iconClass="text-fuchsia-400" subtitle="Leitura automática dos seus cofres">
          <div className="space-y-2.5">{insights.map((x, k) => <InsightRow key={k} {...x} />)}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="violet" title="Linha do tempo dos cofres" icon={CalendarDays} iconClass="text-sky-400" subtitle="Principais marcos e próximas conquistas">
          <div className="relative grid grid-cols-5 gap-2 pt-7">
            <div className="absolute left-[10%] right-[10%] top-[50px] h-1 rounded-full bg-[hsl(var(--border))]" />
            <div className="absolute left-[10%] top-[50px] h-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${(timeline.cur / 4) * 80}%` }} />
            {timeline.steps.map((s, k) => { const cur = k === timeline.cur && !s.flag; return (
              <div key={k} className="relative text-center">
                {cur && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/25 ring-1 ring-violet-400/60 text-violet-700 dark:text-violet-200">Atual</span>}
                <span className={`relative z-[1] mx-auto w-11 h-11 rounded-full grid place-items-center ring-2 ${cur ? 'ring-cyan-300 bg-[hsl(var(--card))] shadow-[0_0_16px_rgba(103,232,249,.7)]' : s.done ? 'bg-emerald-500 ring-emerald-300 text-white' : 'bg-[hsl(var(--card))] ring-[hsl(var(--border))] text-muted'}`}>{s.flag ? <Flag className="w-5 h-5" /> : s.done && !cur ? <Check className="w-5 h-5" /> : <span className="w-3 h-3 rounded-full bg-cyan-300" />}</span>
                <p className="font-semibold text-sm mt-2">{s.label}</p><p className="text-[11px] text-muted">{s.sub}</p>
              </div>); })}
          </div>
        </Panel>
        <Panel className="xl:col-span-5" tone="sky" title={<span>Aportes mensais <span className="text-sm font-normal text-muted">(total nos cofres)</span></span>} icon={BarChart3} iconClass="text-sky-400" action={media > 0 ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg ring-1 ring-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 whitespace-nowrap">Média: {formatCurrency(media)}/mês</span> : null}>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs><linearGradient id="vsA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Aportes']} contentStyle={TIP} />
                <Area type="monotone" dataKey="v" stroke="#c084fc" strokeWidth={3} fill="url(#vsA)" dot={{ r: 4, fill: '#e9d5ff', stroke: '#a855f7' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted">Soma dos depósitos registrados nos cofres e nas metas.</p>
        </Panel>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar cofre' : 'Novo cofre'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><GlowButton tone="sky" onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</GlowButton></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome do cofre / meta"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Viagem para Europa" /></Field>
          <Field label="Categoria"><Select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta (R$)"><Input type="number" step="0.01" value={form.target_amount} onChange={(e) => set('target_amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Guardado (R$)"><Input type="number" step="0.01" value={form.current_amount} onChange={(e) => set('current_amount', e.target.value)} /></Field>
          </div>
          <Field label="Cor"><div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => set('color', c)} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div></Field>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir cofre" footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><button onClick={() => del.mutate(toDelete.id)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">Excluir</button></>}>
        <p className="text-sm">Excluir <b>{toDelete?.name}</b>? A meta correspondente também será removida. O saldo das contas não é alterado.</p>
      </Modal>

      <Modal open={!!move} onClose={() => setMove(null)} title={move?.type === 'in' ? 'Guardar no cofre' : 'Retirar do cofre'} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setMove(null)}>Cancelar</Button><GlowButton tone={move?.type === 'in' ? 'emerald' : 'violet'} onClick={() => doMove.mutate({ g: move.g, type: move.type, value: Number(String(moveVal).replace(',', '.')), accountId: moveAccount })} disabled={!moveVal || !moveAccount || doMove.isPending}>{doMove.isPending ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</GlowButton></>}>
        {accounts.length === 0 ? <p className="text-sm text-muted">Cadastre uma conta primeiro — o dinheiro do cofre entra e sai de uma conta.</p> : (
          <div className="space-y-3">
            <Field label="Valor"><Input type="number" step="0.01" value={moveVal} onChange={(e) => setMoveVal(e.target.value)} placeholder="0,00" autoFocus /></Field>
            <Field label={move?.type === 'in' ? 'Debitar da conta' : 'Creditar na conta'} hint={move?.type === 'in' ? 'O valor sai desta conta e vai para o cofre' : 'O valor sai do cofre e entra nesta conta'}>
              <Select value={moveAccount} onChange={(e) => setMoveAccount(e.target.value)}><option value="">Selecione a conta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatCurrency(a.current_balance || 0)}</option>)}</Select>
            </Field>
            {move?.type === 'out' && <p className="text-xs text-muted">Disponível no cofre: {formatCurrency(move.g.current_amount || 0)}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
