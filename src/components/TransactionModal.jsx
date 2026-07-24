import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Field, Modal, Textarea, Spinner } from './ui';
import { todayIso } from '../lib/utils.js';

const TYPES = [
  { v: 'expense', label: 'Despesa', cls: 'text-rose-600 border-rose-500 bg-rose-50 dark:bg-rose-500/10' },
  { v: 'income', label: 'Receita', cls: 'text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  { v: 'transfer', label: 'Transferencia', cls: 'text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-500/10' },
];

const empty = {
  type: 'expense', date: todayIso(), amount: '', description: '',
  account_id: '', account_to_id: '', category_id: '',
  is_fixed: false, recurrence: 'none', status: 'pending',
};

export function TransactionModal({ open, onClose, onSubmit, saving, accounts, categories, initial, defaultType }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        type: initial.type, date: (initial.date || todayIso()).slice(0, 10),
        amount: initial.amount, description: initial.description || '',
        account_id: initial.account_id || '', account_to_id: initial.account_to_id || '',
        category_id: initial.category_id || '', is_fixed: !!initial.is_fixed, recurrence: initial.recurrence || 'none', status: initial.status || 'pending',
      });
    } else {
      setForm({ ...empty, type: defaultType || 'expense', account_id: accounts?.[0]?.id || '' });
    }
  }, [open, initial, defaultType]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cats = useMemo(() => categories.filter((c) => form.type === 'transfer' ? false : c.type === form.type), [categories, form.type]);

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      type: form.type, date: form.date, amount: Number(form.amount),
      description: form.description, account_id: form.account_id,
      account_to_id: form.type === 'transfer' ? form.account_to_id : null,
      category_id: form.type === 'transfer' ? null : form.category_id || null,
      is_fixed: form.is_fixed, recurrence: form.recurrence,
      status: form.type === 'transfer' ? 'completed' : form.status,
    };
    onSubmit(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar lancamento' : 'Novo lancamento'}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button key={t.v} type="button" onClick={() => setForm((f) => ({ ...f, type: t.v, category_id: '' }))}
              className={`py-2 rounded-lg border-2 text-sm font-semibold transition ${form.type === t.v ? t.cls : 'border-[hsl(var(--border))] text-muted'}`}>{t.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor"><Input type="number" step="0.01" required value={form.amount} onChange={set('amount')} placeholder="0,00" /></Field>
          <Field label="Data"><Input type="date" required value={form.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Descricao"><Input value={form.description} onChange={set('description')} placeholder="Ex: Mercado" /></Field>
        <Field label={form.type === 'transfer' ? 'Conta de origem' : 'Conta'}>
          <Select required value={form.account_id} onChange={set('account_id')}>
            <option value="">Selecione</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {form.type === 'transfer' ? (
          <Field label="Conta de destino">
            <Select required value={form.account_to_id} onChange={set('account_to_id')}>
              <option value="">Selecione</option>
              {accounts.filter((a) => a.id !== form.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Categoria">
            <Select value={form.category_id} onChange={set('category_id')}>
              <option value="">Sem categoria</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {form.type !== 'transfer' && (
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Recorrencia">
              <Select value={form.recurrence} onChange={set('recurrence')}>
                <option value="none">Nenhuma</option>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.is_fixed} onChange={(e) => setForm((f) => ({ ...f, is_fixed: e.target.checked }))} className="w-4 h-4 accent-emerald-500" />
              Lancamento fixo
            </label>
          </div>
        )}
        {form.type !== 'transfer' && (
          <label className="flex items-center gap-2 text-sm p-3 rounded-lg border border-[hsl(var(--border))]">
            <input type="checkbox" checked={form.status === 'completed'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 'completed' : 'pending' }))} className="w-4 h-4 accent-emerald-500" />
            {form.type === 'income' ? 'Ja recebi este valor' : 'Ja paguei este valor'}
            <span className="text-xs text-muted ml-auto">(afeta o saldo)</span>
          </label>
        )}
      </form>
    </Modal>
  );
}
