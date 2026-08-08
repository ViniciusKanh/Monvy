import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryRule, Category, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { matchRule } from '../lib/categoryPredictor.js';
import { Wand2, Plus, Pencil, Trash2, Tag, ArrowRight, Sparkles } from 'lucide-react';

const empty = { pattern: '', category_id: '', tx_type: 'expense', priority: 0 };

export default function CategoryRules() {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({ queryKey: ['catrules'], queryFn: () => CategoryRule.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const inval = () => qc.invalidateQueries({ queryKey: ['catrules'] });
  const save = useMutation({ mutationFn: (p) => editing ? CategoryRule.update(editing.id, p) : CategoryRule.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => CategoryRule.remove(id), onSuccess: inval });

  const uncategorized = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && !t.category_id), [transactions]);

  const openNew = () => { setEditing(null); setForm({ ...empty, category_id: categories.find((c) => c.type === 'expense')?.id || '' }); setModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ pattern: r.pattern, category_id: r.category_id || '', tx_type: r.tx_type || 'expense', priority: r.priority || 0 }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => { if (!form.pattern.trim() || !form.category_id) return toast.error('Informe o texto e a categoria'); save.mutate({ ...form, priority: Number(form.priority || 0) }); };

  const applyNow = async () => {
    if (!rules.length) return toast.info('Crie ao menos uma regra primeiro.');
    if (!uncategorized.length) return toast.info('Nenhum lancamento sem categoria.');
    setBusy(true);
    let done = 0;
    try {
      for (const t of uncategorized) { const cid = matchRule(t.description, rules, t.type); if (cid && catMap[cid]) { await Transaction.update(t.id, { category_id: cid }); done++; } }
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(done ? `${done} lancamento(s) categorizado(s) pelas regras.` : 'Nenhum lancamento bateu com as regras.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const cats = categories.filter((c) => c.type === form.tx_type);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Wand2 className="w-6 h-6 text-indigo-500" /> Regras de Categorizacao</span>}
        subtitle="Categorize lancamentos automaticamente por palavra-chave na descricao"
        actions={<div className="flex gap-2"><Button variant="outline" onClick={applyNow} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4 text-emerald-500" /> Aplicar agora</>}</Button><Button onClick={openNew}><Plus className="w-4 h-4" /> Nova regra</Button></div>} />

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
        <Tag className="w-4 h-4 mt-0.5 shrink-0" />
        <span>As regras sao aplicadas automaticamente ao criar um lancamento (tem prioridade sobre a sugestao por historico). Use "Aplicar agora" para categorizar os {uncategorized.length} lancamento(s) que ainda estao sem categoria.</span>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : rules.length === 0 ? <Card><EmptyState icon={Wand2} title="Nenhuma regra" subtitle='Ex.: se a descricao contem "uber" -> Transporte.' action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova regra</Button>} /></Card>
        : (
          <Card className="p-0 divide-y divide-[hsl(var(--border))]">
            {rules.map((r, i) => { const c = catMap[r.category_id]; return (
              <Reveal key={r.id} i={Math.min(i, 12)}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-muted shrink-0">SE contem</span>
                  <span className="font-mono text-sm px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 truncate max-w-[40%]">{r.pattern}</span>
                  <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                  <span className="flex items-center gap-1.5 text-sm flex-1 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c?.color || '#64748b' }} /><span className="truncate">{c?.name || 'Categoria removida'}</span></span>
                  <Badge color="slate">{r.tx_type === 'income' ? 'Receita' : 'Despesa'}</Badge>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Reveal>
            ); })}
          </Card>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar regra' : 'Nova regra'} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <div className="space-y-3">
          <Field label="Tipo"><Select value={form.tx_type} onChange={(e) => set('tx_type', e.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          <Field label="Se a descricao contem" hint="nao diferencia maiusculas/minusculas"><Input value={form.pattern} onChange={(e) => set('pattern', e.target.value)} placeholder="Ex: uber, ifood, netflix, salario" /></Field>
          <Field label="Categorizar como"><Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">Selecione</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Prioridade" hint="maior = aplicada primeiro quando varias baterem"><Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
