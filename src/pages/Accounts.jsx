import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { Plus, Wallet, Landmark, PiggyBank, CreditCard as CardIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react';

const TYPES = [
  { v: 'checking', label: 'Conta Corrente', icon: Landmark },
  { v: 'savings', label: 'Poupanca', icon: PiggyBank },
  { v: 'wallet', label: 'Carteira', icon: Wallet },
  { v: 'credit_card', label: 'Cartao', icon: CardIcon },
];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];
const iconFor = (t) => (TYPES.find((x) => x.v === t)?.icon || Wallet);
const emptyForm = { name: '', account_type: 'checking', initial_balance: 0, color: '#10b981' };

export default function Accounts() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [menuId, setMenuId] = useState(null);

  const save = useMutation({
    mutationFn: (payload) => editing ? Account.update(editing.id, payload) : Account.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); close(); },
  });
  const del = useMutation({
    mutationFn: (id) => Account.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (a) => { setEditing(a); setForm({ name: a.name, account_type: a.account_type, initial_balance: a.initial_balance, color: a.color }); setModal(true); setMenuId(null); };
  const close = () => setModal(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, initial_balance: Number(form.initial_balance) }); };

  const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  return (
    <div>
      <PageHeader title="Contas" subtitle="Suas contas bancarias e carteiras"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova conta</Button>} />

      <Card className="mb-6 bg-gradient-to-br from-[#080d1f] to-[#0d1433] text-white border-0">
        <p className="text-xs tracking-widest text-slate-400">PATRIMONIO CONSOLIDADO</p>
        <p className="font-display text-3xl font-extrabold mt-1">{formatCurrency(total)}</p>
        <p className="text-xs text-slate-400 mt-1">{accounts.length} conta(s)</p>
      </Card>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : accounts.length === 0 ? (
          <Card><EmptyState icon={Wallet} title="Nenhuma conta ainda" subtitle="Crie sua primeira conta para comecar a controlar seu dinheiro." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova conta</Button>} /></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((a) => {
              const Icon = iconFor(a.account_type);
              const neg = Number(a.current_balance) < 0;
              return (
                <Card key={a.id} className="relative">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: a.color }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="relative">
                      <button onClick={() => setMenuId(menuId === a.id ? null : a.id)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><MoreVertical className="w-4 h-4" /></button>
                      {menuId === a.id && (
                        <div className="absolute right-0 mt-1 w-32 card p-1 z-10">
                          <button onClick={() => openEdit(a)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                          <button onClick={() => { del.mutate(a.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold mt-3">{a.name}</p>
                  <Badge className="mt-1">{TYPES.find((t) => t.v === a.account_type)?.label}</Badge>
                  <p className={`font-display text-2xl font-bold mt-3 ${neg ? 'text-rose-500' : ''}`}>{formatCurrency(a.current_balance)}</p>
                </Card>
              );
            })}
          </div>
        )}

      <Modal open={modal} onClose={close} title={editing ? 'Editar conta' : 'Nova conta'}
        footer={<><Button variant="outline" onClick={close}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Nubank" /></Field>
          <Field label="Tipo"><Select value={form.account_type} onChange={set('account_type')}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
          <Field label="Saldo inicial"><Input type="number" step="0.01" value={form.initial_balance} onChange={set('initial_balance')} /></Field>
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
