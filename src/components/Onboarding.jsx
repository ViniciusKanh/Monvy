import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Account } from '../api/entities.js';
import { LogoMark } from './Logo.jsx';
import { Button, Input, Select, Field, Spinner } from './ui';
import { Wallet, Landmark, PiggyBank, CreditCard as CardIcon, Sparkles, Check } from 'lucide-react';

const TYPES = [
  { v: 'checking', label: 'Conta Corrente', icon: Landmark },
  { v: 'savings', label: 'Poupança', icon: PiggyBank },
  { v: 'wallet', label: 'Carteira', icon: Wallet },
  { v: 'credit_card', label: 'Cartão', icon: CardIcon },
];
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

export function Onboarding({ onDone, name }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', account_type: 'checking', initial_balance: '', color: '#10b981' });

  const create = useMutation({
    mutationFn: () => Account.create({ ...form, initial_balance: Number(form.initial_balance) || 0, current_balance: Number(form.initial_balance) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setStep(2); },
  });
  const finish = () => { try { localStorage.setItem('monvy_onboarded', '1'); } catch {} onDone?.(); };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'linear-gradient(140deg,#070b18,#0b1330 55%,#111b3f)' }}>
      <div className="aurora"><b className="b1" /><b className="b2" /><b className="b3" /></div>
      <div className="relative z-10 w-full max-w-md card p-7 animate-fadeIn">
        <div className="flex items-center gap-1 mb-5">
          {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full flex-1 transition-all ${i <= step ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`} />)}
        </div>

        {step === 0 && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#0b1330] to-[#111b3f] ring-1 ring-white/10 flex items-center justify-center mb-4 glow-pulse"><LogoMark className="w-12 h-12" /></div>
            <h1 className="font-display text-2xl font-bold">Bem-vindo ao Monvy{name ? `, ${name.split(' ')[0]}` : ''}! 👋</h1>
            <p className="text-muted text-sm mt-2">Vamos configurar sua conta em menos de 1 minuto. Ja preparamos suas categorias — falta só criar sua primeira conta.</p>
            <Button className="w-full mt-6" onClick={() => setStep(1)}><Sparkles className="w-4 h-4" /> Comecar</Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-xl font-bold">Sua primeira conta</h2>
            <p className="text-muted text-sm mt-1 mb-4">Onde seu dinheiro fica hoje? (banco, carteira...)</p>
            <div className="space-y-4">
              <Field label="Nome da conta"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Nubank" autoFocus /></Field>
              <Field label="Tipo">
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => <button key={t.v} type="button" onClick={() => setForm((f) => ({ ...f, account_type: t.v }))} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${form.account_type === t.v ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-[hsl(var(--border))] text-muted'}`}><t.icon className="w-4 h-4" /> {t.label}</button>)}
                </div>
              </Field>
              <Field label="Saldo atual (R$)"><Input type="number" step="0.01" value={form.initial_balance} onChange={(e) => setForm((f) => ({ ...f, initial_balance: e.target.value }))} placeholder="0,00" /></Field>
              <Field label="Cor"><div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div></Field>
              <div className="flex gap-2">
                <Button variant="outline" onClick={finish}>Pular</Button>
                <Button className="flex-1" disabled={!form.name || create.isPending} onClick={() => create.mutate()}>{create.isPending ? <Spinner className="w-4 h-4" /> : 'Criar conta'}</Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500 flex items-center justify-center mb-4 check-pop"><Check className="w-9 h-9 text-white" /></div>
            <h2 className="font-display text-xl font-bold">Tudo pronto! 🎉</h2>
            <p className="text-muted text-sm mt-2">Sua conta esta criada. Agora e só lancar suas receitas e despesas e deixar o Monvy trabalhar por você.</p>
            <Button className="w-full mt-6" onClick={finish}>Ir para o painel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
