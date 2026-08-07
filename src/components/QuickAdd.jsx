import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { TransactionModal } from './TransactionModal.jsx';
import { toast } from '../lib/toast.js';
import { Plus } from 'lucide-react';

// Botao flutuante para adicionar um lancamento rapidamente de qualquer tela
export function QuickAdd() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const save = useMutation({
    mutationFn: (p) => Transaction.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setOpen(false); toast.success('Lancamento adicionado'); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar'),
  });
  return (
    <>
      <button onClick={() => setOpen(true)} title="Novo lancamento (rapido)" aria-label="Novo lancamento"
        className="fixed z-40 bottom-5 right-5 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition hover:scale-105 active:scale-95 print:hidden">
        <Plus className="w-7 h-7" />
      </button>
      <TransactionModal open={open} onClose={() => setOpen(false)} onSubmit={(p) => save.mutate(p)} saving={save.isPending} accounts={accounts} categories={categories} transactions={transactions} defaultType="expense" />
    </>
  );
}
