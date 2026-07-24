import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { Plus, Tags, Pencil, Trash2 } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];
const emptyForm = { name: '', type: 'expense', color: '#10b981', budget_limit: '' };

export default function Categories() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
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
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, type: c.type, color: c.color, budget_limit: c.budget_limit ?? '' }); setModal(true); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, budget_limit: form.budget_limit === '' ? null : Number(form.budget_limit) }); };

  const filtered = categories.filter((c) => c.type === tab);

  return (
    <div>
      <PageHeader title="Categorias" subtitle="Organize receitas e despesas"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</Button>} />

      <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 mb-6">
        {[['expense', 'Despesas'], ['income', 'Receitas']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : filtered.length === 0 ? (
          <Card><EmptyState icon={Tags} title="Nenhuma categoria" subtitle={`Crie categorias de ${tab === 'expense' ? 'despesa' : 'receita'}.`} action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova categoria</Button>} /></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <Card key={c.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg" style={{ background: c.color }} />
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    {c.budget_limit ? <Badge color="amber">Limite {formatCurrency(c.budget_limit)}</Badge> : <span className="text-xs text-muted">Sem limite</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del.mutate(c.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar categoria' : 'Nova categoria'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Alimentacao" /></Field>
          <Field label="Tipo"><Select value={form.type} onChange={set('type')}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          {form.type === 'expense' && <Field label="Limite mensal (opcional)"><Input type="number" step="0.01" value={form.budget_limit} onChange={set('budget_limit')} placeholder="0,00" /></Field>}
          <Field label="Cor">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}
            </div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
