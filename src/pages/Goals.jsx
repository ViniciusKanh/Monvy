import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Goal } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { Plus, Target, PiggyBank, Plane, Home, Car, GraduationCap, HeartPulse, Wallet, Pencil, Trash2 } from 'lucide-react';

const CATS = [
  { v: 'emergency', label: 'Emergencia', icon: PiggyBank },
  { v: 'travel', label: 'Viagem', icon: Plane },
  { v: 'home', label: 'Casa', icon: Home },
  { v: 'car', label: 'Carro', icon: Car },
  { v: 'education', label: 'Educacao', icon: GraduationCap },
  { v: 'health', label: 'Saude', icon: HeartPulse },
  { v: 'other', label: 'Outro', icon: Wallet },
];
const iconFor = (c) => CATS.find((x) => x.v === c)?.icon || Target;
const empty = { name: '', category: 'other', target_amount: '', current_amount: 0, monthly_target: '', target_date: '', color: '#10b981' };

export default function Goals() {
  const qc = useQueryClient();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [deposit, setDeposit] = useState(null);
  const [depValue, setDepValue] = useState('');

  const save = useMutation({
    mutationFn: (p) => editing ? Goal.update(editing.id, p) : Goal.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setModal(false); },
  });
  const del = useMutation({ mutationFn: (id) => Goal.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }) });
  const doDeposit = useMutation({
    mutationFn: ({ goal, value }) => {
      const current = Number(goal.current_amount || 0) + value;
      const status = current >= Number(goal.target_amount) ? 'completed' : goal.status || 'active';
      return Goal.update(goal.id, { current_amount: current, status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setDeposit(null); setDepValue(''); },
  });

  const openNew = () => { setEditing(null); setForm({ ...empty, start_date: todayIso() }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ name: g.name, category: g.category || 'other', target_amount: g.target_amount, current_amount: g.current_amount, monthly_target: g.monthly_target ?? '', target_date: (g.target_date || '').slice(0, 10), color: g.color }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount), monthly_target: form.monthly_target === '' ? null : Number(form.monthly_target), status: editing?.status || 'active' }); };

  const totals = goals.reduce((s, g) => ({ saved: s.saved + Number(g.current_amount || 0), target: s.target + Number(g.target_amount || 0) }), { saved: 0, target: 0 });
  const active = goals.filter((g) => g.status !== 'completed' && g.status !== 'cancelled').length;
  const done = goals.filter((g) => g.status === 'completed').length;

  return (
    <div>
      <PageHeader title="Metas" subtitle="Guarde dinheiro com objetivo"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="py-3"><p className="text-xs text-muted">Total guardado</p><p className="font-display text-lg font-bold text-emerald-500">{formatCurrency(totals.saved)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Meta total</p><p className="font-display text-lg font-bold">{formatCurrency(totals.target)}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Ativas</p><p className="font-display text-lg font-bold">{active}</p></Card>
        <Card className="py-3"><p className="text-xs text-muted">Concluidas</p><p className="font-display text-lg font-bold text-emerald-500">{done}</p></Card>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : goals.length === 0 ? <Card><EmptyState icon={Target} title="Nenhuma meta" subtitle="Defina objetivos e acompanhe seu progresso." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova meta</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g) => {
              const Icon = iconFor(g.category);
              const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount || 1)) * 100));
              const completed = g.status === 'completed' || pct >= 100;
              return (
                <Card key={g.id}>
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: g.color }}><Icon className="w-5 h-5" /></div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(g.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-semibold mt-3">{g.name}</p>
                  {completed ? <Badge color="emerald" className="mt-1">Concluida</Badge> : <Badge color="blue" className="mt-1">Ativa</Badge>}
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{formatCurrency(g.current_amount)}</span><span className="text-muted">{formatCurrency(g.target_amount)}</span></div>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} /></div>
                    <p className="text-xs text-muted mt-1">{pct}% concluido</p>
                  </div>
                  {!completed && <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => { setDeposit(g); setDepValue(''); }}>Depositar</Button>}
                </Card>
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
            <Field label="Meta mensal"><Input type="number" step="0.01" value={form.monthly_target} onChange={set('monthly_target')} /></Field>
            <Field label="Data alvo"><Input type="date" value={form.target_date} onChange={set('target_date')} /></Field>
          </div>
        </form>
      </Modal>

      <Modal open={!!deposit} onClose={() => setDeposit(null)} title="Depositar na meta" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setDeposit(null)}>Cancelar</Button><Button onClick={() => doDeposit.mutate({ goal: deposit, value: Number(depValue) })} disabled={!depValue || doDeposit.isPending}>{doDeposit.isPending ? <Spinner className="w-4 h-4" /> : 'Depositar'}</Button></>}>
        <Field label="Valor do deposito"><Input type="number" step="0.01" value={depValue} onChange={(e) => setDepValue(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>
    </div>
  );
}
