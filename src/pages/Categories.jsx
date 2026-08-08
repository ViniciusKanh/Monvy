import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey, inMonth } from '../lib/utils.js';
import { Plus, Tags, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#64748b'];
const emptyForm = { name: '', type: 'expense', color: '#10b981', budget_limit: '', ir_deductible: '' };
const IR_OPTS = [['', 'Nao dedutivel'], ['saude', 'Saude'], ['educacao', 'Educacao'], ['previdencia', 'Previdencia'], ['outras', 'Outras deducoes']];
const IR_LABEL = Object.fromEntries(IR_OPTS);

export default function Categories() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [tab, setTab] = useState('expense');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const save = useMutation({
    mutationFn: (p) => editing ? Category.update(editing.id, p) : Category.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setModal(false); },
  });
  const del = useMutation({ mutationFn: (id) => Category.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }) });

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, type: tab }); setModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, type: c.type, color: c.color, budget_limit: c.budget_limit ?? '', ir_deductible: c.ir_deductible || '' }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, budget_limit: form.budget_limit === '' ? null : Number(form.budget_limit), ir_deductible: form.type === 'expense' ? form.ir_deductible : '' }); };

  const mk = monthKey(new Date());
  const spent = useMemo(() => {
    const map = {};
    for (const t of transactions) { if (inMonth(t.date, mk) && t.category_id && t.type !== 'transfer') map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount); }
    return map;
  }, [transactions, mk]);

  const filtered = categories.filter((c) => c.type === tab);
  const totalSpent = filtered.reduce((s, c) => s + (spent[c.id] || 0), 0);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Categorias" subtitle="Organize suas receitas e despesas"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</Button>} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {[['expense', 'Despesas', TrendingDown], ['income', 'Receitas', TrendingUp]].map(([v, l, Ic]) => (
            <button key={v} onClick={() => setTab(v)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${tab === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}><Ic className="w-4 h-4" /> {l}</button>
          ))}
        </div>
        <div className="flex gap-3 text-sm">
          <Badge>{filtered.length} categoria(s)</Badge>
          <span className="text-muted">Total no mes: <b className={tab === 'expense' ? 'text-rose-500' : 'text-emerald-500'}>{formatCurrency(totalSpent)}</b></span>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : filtered.length === 0 ? (
          <Card><EmptyState icon={Tags} title="Nenhuma categoria" subtitle={`Crie categorias de ${tab === 'expense' ? 'despesa' : 'receita'}.`} action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</Button>} /></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c, i) => {
              const sp = spent[c.id] || 0;
              const pct = c.budget_limit ? Math.min(100, Math.round((sp / c.budget_limit) * 100)) : 0;
              const barColor = pct >= 100 ? '#f43f5e' : pct >= 80 ? '#f59e0b' : c.color;
              return (
                <Reveal key={c.id} i={i}>
                  <Card className="hover-lift h-full">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: c.color }}><Tags className="w-5 h-5" /></span>
                        <div>
                          <p className="font-semibold flex items-center gap-1.5">{c.name}{c.ir_deductible && <Badge color="indigo">IR: {IR_LABEL[c.ir_deductible]}</Badge>}</p>
                          <p className="text-xs text-muted">{formatCurrency(sp)} este mes</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del.mutate(c.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {c.type === 'expense' && (c.budget_limit ? (
                      <div className="mt-3">
                        <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} /></div>
                        <div className="flex justify-between text-xs text-muted mt-1"><span>{pct}% do limite</span><span>{formatCurrency(c.budget_limit)}</span></div>
                      </div>
                    ) : <p className="text-xs text-muted mt-3">Sem limite definido</p>)}
                  </Card>
                </Reveal>
              );
            })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar categoria' : 'Nova categoria'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Alimentacao" /></Field>
          <Field label="Tipo"><Select value={form.type} onChange={set('type')}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          {form.type === 'expense' && <Field label="Limite mensal (opcional)"><Input type="number" step="0.01" value={form.budget_limit} onChange={set('budget_limit')} placeholder="0,00" /></Field>}
          {form.type === 'expense' && <Field label="Dedutivel no Imposto de Renda"><Select value={form.ir_deductible} onChange={set('ir_deductible')}>{IR_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>}
          <Field label="Cor">
            <div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 transition ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
