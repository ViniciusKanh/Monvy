import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey, inMonth } from '../lib/utils.js';
import { Plus, Wallet, Landmark, PiggyBank, CreditCard as CardIcon, MoreVertical, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

const TYPES = [
  { v: 'checking', label: 'Conta Corrente', icon: Landmark },
  { v: 'savings', label: 'Poupanca', icon: PiggyBank },
  { v: 'wallet', label: 'Carteira', icon: Wallet },
  { v: 'credit_card', label: 'Cartao', icon: CardIcon },
];
const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];
const iconFor = (t) => (TYPES.find((x) => x.v === t)?.icon || Wallet);
const emptyForm = { name: '', account_type: 'checking', initial_balance: 0, color: '#10b981' };

export default function Accounts() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [menuId, setMenuId] = useState(null);

  const save = useMutation({
    mutationFn: (payload) => editing ? Account.update(editing.id, payload) : Account.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); close(); },
  });
  const del = useMutation({ mutationFn: (id) => Account.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }) });

  const openNew = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (a) => { setEditing(a); setForm({ name: a.name, account_type: a.account_type, initial_balance: a.initial_balance, color: a.color }); setModal(true); setMenuId(null); };
  const close = () => setModal(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, initial_balance: Number(form.initial_balance) }); };

  const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const mk = monthKey(new Date());

  // movimentacao do mes por conta
  const flow = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (!inMonth(t.date, mk)) continue;
      const add = (id, inc, exp) => { map[id] = map[id] || { inc: 0, exp: 0 }; map[id].inc += inc; map[id].exp += exp; };
      if (t.type === 'income') add(t.account_id, Number(t.amount), 0);
      else if (t.type === 'expense') add(t.account_id, 0, Number(t.amount));
      else if (t.type === 'transfer') { add(t.account_id, 0, Number(t.amount)); add(t.account_to_id, Number(t.amount), 0); }
    }
    return map;
  }, [transactions, mk]);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Contas" subtitle="Seu dinheiro em cada conta e carteira"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova conta</Button>} />

      {/* Hero patrimonio */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-soft ring-1 ring-white/10 mb-6"
        style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,.28), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="sheen" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.25em] text-emerald-300/80">PATRIMONIO EM CONTAS</p>
            <p className="font-display text-3xl sm:text-5xl font-extrabold mt-2"><AnimatedValue value={total} format={formatCurrency} /></p>
            <p className="text-xs text-slate-400 mt-1">{accounts.length} conta(s) ativa(s)</p>
          </div>
          {accounts.length > 0 && (
            <div className="flex gap-2 max-w-full overflow-x-auto pb-1">
              {accounts.slice(0, 4).map((a, i) => {
                const tot = accounts.reduce((s, x) => s + Math.max(0, Number(x.current_balance || 0)), 0) || 1;
                const pct = Math.round((Math.max(0, Number(a.current_balance || 0)) / tot) * 100);
                return <div key={a.id} className="text-right shrink-0"><div className="text-[11px] text-slate-400">{a.name}</div><div className="text-sm font-bold">{pct}%</div><div className="h-1 w-16 rounded-full bg-white/10 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color || COLORS[i] }} /></div></div>;
              })}
            </div>
          )}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : accounts.length === 0 ? (
          <Card><EmptyState icon={Wallet} title="Nenhuma conta ainda" subtitle="Crie sua primeira conta para comecar a controlar seu dinheiro." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova conta</Button>} /></Card>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.map((a, i) => {
              const Icon = iconFor(a.account_type);
              const neg = Number(a.current_balance) < 0;
              const f = flow[a.id] || { inc: 0, exp: 0 };
              return (
                <Reveal key={a.id} i={i}>
                  <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-card hover-lift h-full"
                    style={{ background: `linear-gradient(135deg, ${a.color || COLORS[i % COLORS.length]}, #0d1433 130%)` }}>
                    <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
                    <div className="relative flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                      <div className="relative">
                        <button onClick={() => setMenuId(menuId === a.id ? null : a.id)} className="p-1.5 rounded-lg hover:bg-white/15"><MoreVertical className="w-4 h-4" /></button>
                        {menuId === a.id && (
                          <div className="absolute right-0 mt-1 w-32 card p-1 z-10 text-[hsl(var(--text))]">
                            <button onClick={() => openEdit(a)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                            <button onClick={() => { del.mutate(a.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="relative font-medium mt-4 text-white/90">{a.name}</p>
                    <span className="relative inline-block text-[11px] mt-1 px-2 py-0.5 rounded-full bg-white/15">{TYPES.find((t) => t.v === a.account_type)?.label}</span>
                    <p className={`relative font-display text-3xl font-extrabold mt-3 ${neg ? 'text-rose-200' : ''}`}>{formatCurrency(a.current_balance)}</p>
                    <div className="relative flex gap-4 mt-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-200"><TrendingUp className="w-3.5 h-3.5" /> {formatCurrency(f.inc)}</span>
                      <span className="flex items-center gap-1 text-rose-200"><TrendingDown className="w-3.5 h-3.5" /> {formatCurrency(f.exp)}</span>
                    </div>
                  </div>
                </Reveal>
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
            <div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 transition ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
