import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Goal } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { Plus, Target, PiggyBank, Plane, Home, Car, GraduationCap, HeartPulse, Wallet, Pencil, Trash2, Trophy } from 'lucide-react';

const CATS = [
  { v: 'emergency', label: 'Emergencia', icon: PiggyBank },
  { v: 'travel', label: 'Viagem', icon: Plane },
  { v: 'home', label: 'Casa', icon: Home },
  { v: 'car', label: 'Carro', icon: Car },
  { v: 'education', label: 'Educação', icon: GraduationCap },
  { v: 'health', label: 'Saúde', icon: HeartPulse },
  { v: 'other', label: 'Outro', icon: Wallet },
];
const iconFor = (c) => CATS.find((x) => x.v === c)?.icon || Target;
const empty = { name: '', category: 'other', target_amount: '', current_amount: 0, monthly_target: '', target_date: '', color: '#10b981' };

// planejamento da meta: quanto guardar/mês e projecao da data no ritmo atual
function goalPlan(g) {
  const target = Number(g.target_amount || 0), current = Number(g.current_amount || 0);
  const remaining = Math.max(0, target - current);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00');
  let monthsLeft = null, neededPerMonth = null;
  if (g.target_date) {
    const d = new Date(String(g.target_date).slice(0, 10) + 'T00:00');
    monthsLeft = Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()));
    neededPerMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  }
  const monthly = Number(g.monthly_target || 0);
  let projDate = null;
  if (monthly > 0 && remaining > 0) { const m = Math.ceil(remaining / monthly); const pd = new Date(today); pd.setMonth(pd.getMonth() + m); projDate = pd; }
  const onTrack = (neededPerMonth != null && monthly > 0) ? monthly >= neededPerMonth - 0.01 : null;
  return { remaining, monthsLeft, neededPerMonth, monthly, projDate, onTrack };
}
const monthsBetween = (dateStr) => { if (!dateStr) return null; const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00'); const d = new Date(String(dateStr).slice(0, 10) + 'T00:00'); return Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth())); };

function Ring({ pct, size = 128, stroke = 11 }) {
  const p = Math.min(100, Math.max(0, pct)); const r = (size - stroke) / 2 - 2; const c = 2 * Math.PI * r; const off = c - (p / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#34d399" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-extrabold text-white">{p}%</span><span className="text-[11px] text-slate-400">concluido</span></div>
    </div>
  );
}

export default function Goals() {
  const qc = useQueryClient();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [deposit, setDeposit] = useState(null);
  const [depValue, setDepValue] = useState('');

  const save = useMutation({ mutationFn: (p) => editing ? Goal.update(editing.id, p) : Goal.create(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Goal.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }) });
  const doDeposit = useMutation({
    mutationFn: ({ goal, value }) => { const current = Number(goal.current_amount || 0) + value; const status = current >= Number(goal.target_amount) ? 'completed' : goal.status || 'active'; return Goal.update(goal.id, { current_amount: current, status }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setDeposit(null); setDepValue(''); },
  });

  const openNew = () => { setEditing(null); setForm({ ...empty, start_date: todayIso() }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ name: g.name, category: g.category || 'other', target_amount: g.target_amount, current_amount: g.current_amount, monthly_target: g.monthly_target ?? '', target_date: (g.target_date || '').slice(0, 10), color: g.color }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount), monthly_target: form.monthly_target === '' ? null : Number(form.monthly_target), status: editing?.status || 'active' }); };

  const totals = goals.reduce((s, g) => ({ saved: s.saved + Number(g.current_amount || 0), target: s.target + Number(g.target_amount || 0) }), { saved: 0, target: 0 });
  const pct = totals.target ? Math.round((totals.saved / totals.target) * 100) : 0;
  const active = goals.filter((g) => g.status !== 'completed' && g.status !== 'cancelled').length;
  const done = goals.filter((g) => g.status === 'completed').length;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Metas" subtitle="Guarde dinheiro com objetivo" actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</Button>} />

      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10 mb-6" style={{ background: 'linear-gradient(135deg,#065f46,#0d1433 60%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,.30), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <Ring pct={pct} />
          <div className="flex-1 w-full">
            <p className="text-[11px] tracking-[0.25em] text-emerald-300/80">TOTAL GUARDADO</p>
            <p className="font-display text-3xl sm:text-4xl font-extrabold mt-1"><AnimatedValue value={totals.saved} format={formatCurrency} /> <span className="text-lg text-slate-400 font-semibold">/ {formatCurrency(totals.target)}</span></p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Metas</p><p className="font-bold">{goals.length}</p></div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Ativas</p><p className="font-bold">{active}</p></div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5"><p className="text-[11px] text-emerald-300">Concluidas</p><p className="font-bold">{done}</p></div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : goals.length === 0 ? <Card><EmptyState icon={Target} title="Nenhuma meta" subtitle="Defina objetivos e acompanhe seu progresso." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g, i) => {
              const Icon = iconFor(g.category);
              const p = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount || 1)) * 100));
              const completed = g.status === 'completed' || p >= 100;
              const plan = goalPlan(g);
              return (
                <Reveal key={g.id} i={i}>
                  <Card className="hover-lift h-full relative overflow-hidden">
                    {completed && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1"><Trophy className="w-3 h-3" /> META BATIDA</div>}
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: g.color }}><Icon className="w-5 h-5" /></div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del.mutate(g.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="font-semibold mt-3">{g.name}</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{formatCurrency(g.current_amount)}</span><span className="text-muted">{formatCurrency(g.target_amount)}</span></div>
                      <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: g.color }} /></div>
                      <p className="text-xs text-muted mt-1">{p}% concluido{g.target_date ? ` · até ${new Date(g.target_date + 'T00:00').toLocaleDateString('pt-BR')}` : ''}</p>
                    </div>
                    {!completed && (plan.neededPerMonth != null || plan.projDate) && (
                      <div className="mt-2 text-[11px] rounded-lg bg-black/5 dark:bg-white/5 p-2 space-y-0.5">
                        {plan.neededPerMonth != null && <p>Guarde <b className="text-[hsl(var(--text))]">{formatCurrency(plan.neededPerMonth)}/mês</b> para bater{plan.monthsLeft ? ` em ${plan.monthsLeft} mes(es)` : ' ainda este mês'}.</p>}
                        {plan.projDate && <p className={plan.onTrack === false ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>No ritmo de {formatCurrency(plan.monthly)}/mês: conclui em {plan.projDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}{plan.onTrack === false ? ' (após o prazo)' : ''}.</p>}
                      </div>
                    )}
                    {!completed && <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => { setDeposit(g); setDepValue(''); }}><PiggyBank className="w-4 h-4" /> Depositar</Button>}
                  </Card>
                </Reveal>
              );
            })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar meta' : 'Nova meta'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Reserva de emergencia" /></Field>
          <Field label="Categoria"><Select value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor alvo"><Input type="number" step="0.01" required value={form.target_amount} onChange={set('target_amount')} /></Field>
            <Field label="Ja guardado"><Input type="number" step="0.01" value={form.current_amount} onChange={set('current_amount')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta mensal"><Input type="number" step="0.01" value={form.monthly_target} onChange={set('monthly_target')} placeholder="quanto guardar/mês" /></Field>
            <Field label="Data alvo"><Input type="date" value={form.target_date} onChange={set('target_date')} /></Field>
          </div>
          {form.target_date && Number(form.target_amount) > 0 && (() => {
            const m = monthsBetween(form.target_date); const rem = Math.max(0, Number(form.target_amount) - Number(form.current_amount || 0)); const need = m > 0 ? rem / m : rem;
            return (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                <span>Para bater até {new Date(form.target_date + 'T00:00').toLocaleDateString('pt-BR')} ({m} mes(es)): guarde ~<b>{formatCurrency(need)}/mês</b></span>
                <button type="button" onClick={() => setForm((f) => ({ ...f, monthly_target: need.toFixed(2) }))} className="text-xs font-semibold underline shrink-0">usar</button>
              </div>
            );
          })()}
        </form>
      </Modal>

      <Modal open={!!deposit} onClose={() => setDeposit(null)} title="Depositar na meta" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setDeposit(null)}>Cancelar</Button><Button onClick={() => doDeposit.mutate({ goal: deposit, value: Number(depValue) })} disabled={!depValue || doDeposit.isPending}>{doDeposit.isPending ? <Spinner className="w-4 h-4" /> : 'Depositar'}</Button></>}>
        <Field label="Valor do deposito"><Input type="number" step="0.01" value={depValue} onChange={(e) => setDepValue(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>
    </div>
  );
}
