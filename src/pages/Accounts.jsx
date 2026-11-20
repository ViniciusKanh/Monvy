import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account, Transaction } from '../api/entities.js';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { Wallet, GripVertical } from 'lucide-react';
import { useFavoriteAccounts } from '../lib/useFavoriteAccounts.js';
import { useAccountOrder } from '../lib/useAccountOrder.js';
import { fetchBankDirectory } from '../lib/bankDirectory.js';

import { AccountsHeader } from '../components/accounts/AccountsHeader.jsx';
import { AccountsNavigation } from '../components/accounts/AccountsNavigation.jsx';
import { AccountsBalanceHero } from '../components/accounts/AccountsBalanceHero.jsx';
import { BankAccountCard } from '../components/accounts/BankAccountCard.jsx';
import { AccountsRecentTransactions } from '../components/accounts/AccountsRecentTransactions.jsx';
import { AccountsDistributionChart } from '../components/accounts/AccountsDistributionChart.jsx';
import { AccountsStatementsTab } from '../components/accounts/AccountsStatementsTab.jsx';
import { AccountsMovementsTab } from '../components/accounts/AccountsMovementsTab.jsx';
import { AccountsTransfersTab } from '../components/accounts/AccountsTransfersTab.jsx';
import { AccountsReconciliationTab } from '../components/accounts/AccountsReconciliationTab.jsx';

const TYPES = [
  { v: 'checking', label: 'Conta Corrente' },
  { v: 'savings', label: 'Poupança' },
  { v: 'wallet', label: 'Carteira' },
  { v: 'credit_card', label: 'Cartão' },
];
const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];
const emptyForm = { name: '', account_type: 'checking', initial_balance: 0, color: '#10b981', bank: '', bank_ispb: '' };

export default function Accounts() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading, isFetching } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  // diretorio publico de bancos (nome, codigo, logo oficial) — estatico, sem Open Finance
  const { data: bankDir } = useQuery({ queryKey: ['bank-directory'], queryFn: fetchBankDirectory, staleTime: 7 * 24 * 3_600_000, retry: 1 });
  const banks = bankDir?.banks || [];
  const getBankInfo = (a) => bankDir?.resolve(a.bank_ispb, a.bank) || null;
  const { isFavorite, toggle: toggleFavorite } = useFavoriteAccounts();
  const { applyOrder, moveTo, hasCustomOrder, resetOrder } = useAccountOrder();
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState(30);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const save = useMutation({
    mutationFn: (payload) => editing ? Account.update(editing.id, payload) : Account.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); close(); },
  });
  const del = useMutation({ mutationFn: (id) => Account.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }) });

  const openNew = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (a) => { setEditing(a); setForm({ name: a.name, account_type: a.account_type, initial_balance: a.initial_balance, color: a.color, bank: a.bank || '', bank_ispb: a.bank_ispb || '' }); setModal(true); };
  const close = () => setModal(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // ao digitar/selecionar o banco, tenta casar com o diretorio oficial pra
  // gravar o ISPB junto (e assim exibir o logo e os dados certos depois) —
  // texto livre que nao bate com nenhum banco conhecido fica sem ISPB, sem
  // inventar nada.
  const setBank = (e) => {
    const name = e.target.value;
    const match = bankDir?.byNameGet(name);
    setForm((f) => ({ ...f, bank: name, bank_ispb: match ? match.ispb : '' }));
  };
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, initial_balance: Number(form.initial_balance) }); };

  const handleDelete = (id) => { if (window.confirm('Excluir esta conta? Essa ação não pode ser desfeita.')) del.mutate(id); };

  const sync = () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); };

  const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalPositive = accounts.reduce((s, a) => s + Math.max(0, Number(a.current_balance || 0)), 0);
  const accountsById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  // sem ordem manual salva: favoritas primeiro, preservando a ordem de criação dentro de cada grupo;
  // com ordem manual (arrastar e soltar): respeita exatamente a ordem escolhida pelo usuário
  const orderedAccounts = useMemo(() => {
    if (hasCustomOrder) return applyOrder(accounts);
    const favs = accounts.filter((a) => isFavorite(a.id));
    const rest = accounts.filter((a) => !isFavorite(a.id));
    return [...favs, ...rest];
  }, [accounts, isFavorite, hasCustomOrder, applyOrder]);

  const handleDragStart = (id) => (e) => { setDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (id) => (e) => { e.preventDefault(); if (id !== dragOverId) setDragOverId(id); };
  const handleDrop = (id) => (e) => {
    e.preventDefault();
    if (draggingId) moveTo(orderedAccounts.map((a) => a.id), draggingId, id);
    setDraggingId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null); };

  return (
    <div className="animate-fadeIn space-y-5">
      <AccountsHeader onSync={sync} syncing={isFetching} onNew={openNew} />
      <AccountsNavigation active={tab} onChange={setTab} />

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
      ) : accounts.length === 0 ? (
        <Card><EmptyState icon={Wallet} title="Nenhuma conta ainda" subtitle="Crie sua primeira conta para começar a controlar seu dinheiro." action={<Button onClick={openNew}>Nova conta</Button>} /></Card>
      ) : tab === 'overview' ? (
        <div className="space-y-5">
          <AccountsBalanceHero accounts={accounts} transactions={transactions} total={total} period={period} onPeriodChange={setPeriod} />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted flex items-center gap-1"><GripVertical className="w-3.5 h-3.5" /> arraste os cartões para reordenar</p>
            {hasCustomOrder && <button onClick={resetOrder} className="text-xs text-muted hover:text-rose-500">restaurar ordem padrão</button>}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {orderedAccounts.map((a, i) => (
              <Reveal
                key={a.id} i={i}
                draggable
                onDragStart={handleDragStart(a.id)}
                onDragOver={handleDragOver(a.id)}
                onDrop={handleDrop(a.id)}
                onDragEnd={handleDragEnd}
                className={`relative cursor-grab active:cursor-grabbing transition-opacity ${draggingId === a.id ? 'opacity-40' : ''} ${dragOverId === a.id && draggingId && draggingId !== a.id ? 'ring-2 ring-indigo-500 rounded-2xl' : ''}`}
              >
                <BankAccountCard
                  account={a} transactions={transactions} consolidatedPositive={totalPositive}
                  isFavorite={isFavorite(a.id)} onToggleFavorite={toggleFavorite}
                  onEdit={openEdit} onDelete={handleDelete} bankInfo={getBankInfo(a)}
                />
              </Reveal>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <AccountsRecentTransactions transactions={transactions} accountsById={accountsById} />
            <AccountsDistributionChart accounts={accounts} />
          </div>
        </div>
      ) : tab === 'statements' ? (
        <AccountsStatementsTab accounts={accounts} transactions={transactions} />
      ) : tab === 'movements' ? (
        <AccountsMovementsTab transactions={transactions} accountsById={accountsById} />
      ) : tab === 'transfers' ? (
        <AccountsTransfersTab transactions={transactions} accountsById={accountsById} />
      ) : (
        <AccountsReconciliationTab />
      )}

      <Modal open={modal} onClose={close} title={editing ? 'Editar conta' : 'Nova conta'}
        footer={<><Button variant="outline" onClick={close}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={set('name')} placeholder="Ex: Nubank" /></Field>
          <Field label="Banco (opcional)" hint={form.bank_ispb ? 'Banco reconhecido — logo e dados oficiais serao exibidos automaticamente' : 'Comece a digitar para buscar na lista oficial de bancos'}>
            <Input list="banks-list" value={form.bank} onChange={setBank} placeholder="Ex: Nubank, Itau, Bradesco" />
            <datalist id="banks-list">{banks.filter((b) => b.name).map((b) => <option key={b.ispb} value={b.name}>{b.code ? `${b.code} — ${b.name}` : b.name}</option>)}</datalist>
          </Field>
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
