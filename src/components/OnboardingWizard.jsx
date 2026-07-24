import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account, Category } from '../api/entities.js';
import { Button, Input, Select, Field, Spinner, Modal } from './ui';
import { LogoMark } from './Logo.jsx';
import { toast } from '../lib/toast.js';
import { Sparkles, Wallet, Tags, Check } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentacao', type: 'expense', color: '#f43f5e' },
  { name: 'Moradia', type: 'expense', color: '#6366f1' },
  { name: 'Transporte', type: 'expense', color: '#0ea5e9' },
  { name: 'Saude', type: 'expense', color: '#14b8a6' },
  { name: 'Lazer', type: 'expense', color: '#8b5cf6' },
  { name: 'Educacao', type: 'expense', color: '#f59e0b' },
  { name: 'Contas & Servicos', type: 'expense', color: '#64748b' },
  { name: 'Compras', type: 'expense', color: '#ec4899' },
  { name: 'Assinaturas', type: 'expense', color: '#a855f7' },
  { name: 'Outros', type: 'expense', color: '#94a3b8' },
  { name: 'Salario', type: 'income', color: '#10b981' },
  { name: 'Freelance', type: 'income', color: '#22c55e' },
  { name: 'Investimentos', type: 'income', color: '#16a34a' },
];

export function OnboardingWizard() {
  const qc = useQueryClient();
  const { data: accounts, isLoading: la } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories, isLoading: lc } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('monvy_onb') === '1'; } catch { return false; } });
  const [step, setStep] = useState(1);
  const [acc, setAcc] = useState({ name: '', account_type: 'checking', initial_balance: '' });

  const empty = !la && !lc && (accounts?.length === 0) && (categories?.length === 0);
  const open = empty && !dismissed;

  const finish = () => { try { sessionStorage.setItem('monvy_onb', '1'); } catch {} setDismissed(true); };

  const createAcc = useMutation({
    mutationFn: () => Account.create({ name: acc.name || 'Minha Conta', account_type: acc.account_type, initial_balance: Number(acc.initial_balance) || 0, current_balance: Number(acc.initial_balance) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setStep(2); },
  });
  const seedCats = useMutation({
    mutationFn: () => Category.bulkCreate(DEFAULT_CATEGORIES),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setStep(3); toast.success('Tudo pronto!'); },
  });

  if (!open) return null;

  return (
    <Modal open onClose={finish} title="" maxWidth="max-w-lg">
      <div className="text-center mb-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#0b1330] to-[#111b3f] flex items-center justify-center mb-3"><LogoMark className="w-10 h-10" /></div>
        <h2 className="font-display text-2xl font-bold">Bem-vindo ao Monvy! 🎉</h2>
        <p className="text-muted text-sm mt-1">Vamos configurar o essencial em 2 passos rapidos.</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 rounded-full transition-all ${step >= n ? 'w-8 bg-emerald-500' : 'w-4 bg-black/10 dark:bg-white/10'}`} />)}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="w-4 h-4 text-emerald-500" /> Sua primeira conta</div>
          <Field label="Nome da conta"><Input value={acc.name} onChange={(e) => setAcc((a) => ({ ...a, name: e.target.value }))} placeholder="Ex: Nubank, Carteira" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><Select value={acc.account_type} onChange={(e) => setAcc((a) => ({ ...a, account_type: e.target.value }))}><option value="checking">Conta Corrente</option><option value="savings">Poupanca</option><option value="wallet">Carteira</option></Select></Field>
            <Field label="Saldo atual"><Input type="number" step="0.01" value={acc.initial_balance} onChange={(e) => setAcc((a) => ({ ...a, initial_balance: e.target.value }))} placeholder="0,00" /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={finish} className="flex-1">Pular</Button>
            <Button onClick={() => createAcc.mutate()} disabled={createAcc.isPending} className="flex-1">{createAcc.isPending ? <Spinner className="w-4 h-4" /> : 'Continuar'}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Tags className="w-4 h-4 text-indigo-500" /> Categorias padrao</div>
          <p className="text-sm text-muted">Vamos criar categorias comuns (Alimentacao, Moradia, Transporte, Salario...). Voce ajusta depois.</p>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_CATEGORIES.map((c) => <span key={c.name} className="text-xs px-2 py-1 rounded-full" style={{ background: `${c.color}22`, color: c.color }}>{c.name}</span>)}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={finish} className="flex-1">Pular</Button>
            <Button onClick={() => seedCats.mutate()} disabled={seedCats.isPending} className="flex-1">{seedCats.isPending ? <Spinner className="w-4 h-4" /> : 'Criar categorias'}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4 check-pop"><Check className="w-8 h-8 text-emerald-500" /></div>
          <h3 className="font-display font-bold text-lg">Pronto para comecar!</h3>
          <p className="text-sm text-muted mt-2">Sua conta e categorias foram criadas. Agora e so lancar suas receitas e despesas.</p>
          <Button className="w-full mt-5" onClick={finish}><Sparkles className="w-4 h-4" /> Comecar a usar</Button>
        </div>
      )}
    </Modal>
  );
}
