import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { Landmark, Plus, Pencil, Trash2, CheckCircle2, TrendingDown, Calendar, Table, Zap } from 'lucide-react';

const TYPES = [
  { v: 'emprestimo', label: 'Emprestimo' },
  { v: 'financiamento', label: 'Financiamento' },
  { v: 'consorcio', label: 'Consorcio' },
  { v: 'cartao', label: 'Parcelamento de cartao' },
  { v: 'outro', label: 'Outro' },
];
const tLabel = (v) => (TYPES.find((t) => t.v === v) || TYPES[0]).label;
// Parcela fixa (Tabela Price): P * i / (1 - (1+i)^-n)
const priceInstallment = (P, iPct, n) => { const i = Number(iPct) / 100; if (!P || !n) return 0; if (i === 0) return P / n; return (P * i) / (1 - Math.pow(1 + i, -n)); };
// Saldo devedor apos k parcelas pagas (valor presente das restantes)
const balanceAfter = (inst, iPct, remaining) => { const i = Number(iPct) / 100; if (remaining <= 0) return 0; if (i === 0) return inst * remaining; return inst * (1 - Math.pow(1 + i, -remaining)) / i; };
const empty = { name: '', type: 'financiamento', principal: '', interest_rate: '1.5', installments: '12', paid_installments: '0', start_date: todayIso(), due_day: '10', institution: '' };

export default function Debts() {
  const qc = useQueryClient();
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [schedule, setSchedule] = useState(null);

  const inval = () => qc.invalidateQueries({ queryKey: ['debts'] });
  const save = useMutation({ mutationFn: (p) => editing ? Debt.update(editing.id, p) : Debt.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Debt.remove(id), onSuccess: inval });
  const pay = useMutation({ mutationFn: ({ d }) => Debt.update(d.id, { paid_installments: Math.min(Number(d.installments || 1), Number(d.paid_installments || 0) + 1) }), onSuccess: () => { inval(); toast.success('Parcela registrada'); } });

  const withCalc = useMemo(() => debts.map((d) => {
    const inst = Number(d.installment_amount || priceInstallment(Number(d.principal || d.total_amount || 0), d.interest_rate, Number(d.installments || 1)));
    const n = Number(d.installments || 1); const paid = Number(d.paid_installments || 0); const remaining = Math.max(0, n - paid);
    const balance = balanceAfter(inst, d.interest_rate, remaining);
    const total = inst * n; const interestTotal = total - Number(d.principal || d.total_amount || 0);
    return { ...d, inst, n, paid, remaining, balance, total, interestTotal, pct: n ? Math.round((paid / n) * 100) : 0 };
  }), [debts]);

  const totalOwed = withCalc.reduce((s, d) => s + d.balance, 0);
  const monthly = withCalc.filter((d) => d.remaining > 0).reduce((s, d) => s + d.inst, 0);
  const interestAll = withCalc.reduce((s, d) => s + Math.max(0, d.interestTotal), 0);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, type: d.type, principal: d.principal ?? d.total_amount ?? '', interest_rate: d.interest_rate ?? '0', installments: d.installments ?? '12', paid_installments: d.paid_installments ?? '0', start_date: (d.start_date || todayIso()).slice(0, 10), due_day: d.due_day ?? '10', institution: d.institution || '' }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const formInst = priceInstallment(Number(form.principal || 0), form.interest_rate, Number(form.installments || 1));
  const submit = (e) => {
    e.preventDefault();
    const principal = Number(form.principal || 0); const n = Number(form.installments || 1);
    const inst = priceInstallment(principal, form.interest_rate, n);
    save.mutate({ name: form.name, type: form.type, principal, total_amount: inst * n, interest_rate: Number(form.interest_rate || 0), installments: n, paid_installments: Number(form.paid_installments || 0), installment_amount: inst, start_date: form.start_date, due_day: Number(form.due_day || 10), institution: form.institution });
  };

  const buildSchedule = (d) => {
    const rows = []; let bal = Number(d.principal || d.total_amount || 0); const i = Number(d.interest_rate) / 100;
    for (let k = 1; k <= d.n; k++) { const juros = bal * i; const amort = d.inst - juros; bal = Math.max(0, bal - amort); rows.push({ k, juros, amort, saldo: bal, paga: k <= d.paid }); }
    setSchedule({ name: d.name, inst: d.inst, rows });
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-rose-500" /> Dividas & Financiamentos</span>}
        subtitle="Controle emprestimos e parcelamentos com tabela de amortizacao"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova divida</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Saldo devedor total</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={totalOwed} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Comprometido/mes</p><p className="font-display text-2xl font-bold text-amber-500"><AnimatedValue value={monthly} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Juros totais (contratos)</p><p className="font-display text-2xl font-bold"><AnimatedValue value={interestAll} format={formatCurrency} /></p></Card></Reveal>
      </div>

      {debts.length === 0 ? <Card><EmptyState icon={Landmark} title="Nenhuma divida" subtitle="Cadastre emprestimos e financiamentos para acompanhar o quanto falta pagar." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova divida</Button>} /></Card>
        : (
          <div className="grid md:grid-cols-2 gap-4">
            {withCalc.map((d, idx) => (
              <Reveal key={d.id} i={Math.min(idx, 8)}>
                <Card className="hover-lift h-full">
                  <div className="flex items-start justify-between">
                    <div><p className="font-semibold">{d.name}</p><p className="text-xs text-muted">{tLabel(d.type)}{d.institution ? ` · ${d.institution}` : ''}</p></div>
                    <div className="flex gap-1">
                      <button onClick={() => buildSchedule(d)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Tabela de amortizacao"><Table className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(d.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div><p className="text-[11px] text-muted">Saldo devedor</p><p className="font-bold text-rose-500">{formatCurrency(d.balance)}</p></div>
                    <div><p className="text-[11px] text-muted">Parcela</p><p className="font-bold">{formatCurrency(d.inst)}/mes</p></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted">{d.paid} de {d.n} parcelas</span><span className="text-muted">{d.pct}%</span></div>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.pct}%` }} /></div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-[11px] text-muted">Juros {Number(d.interest_rate).toFixed(2)}% a.m. · quita em {d.remaining} mes(es)</span>
                    {d.remaining > 0 && <Button size="sm" variant="outline" className="ml-auto" onClick={() => pay.mutate({ d })}><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Paguei 1 parcela</Button>}
                    {d.remaining === 0 && <Badge color="emerald" className="ml-auto"><CheckCircle2 className="w-3 h-3" /> Quitada</Badge>}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        )}

      {/* Modal cadastro */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar divida' : 'Nova divida'} maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Financiamento carro" /></Field>
            <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor financiado (R$)"><Input type="number" step="0.01" value={form.principal} onChange={(e) => set('principal', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Juros (% a.m.)"><Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => set('interest_rate', e.target.value)} /></Field>
            <Field label="Parcelas"><Input type="number" value={form.installments} onChange={(e) => set('installments', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Parcelas pagas"><Input type="number" value={form.paid_installments} onChange={(e) => set('paid_installments', e.target.value)} /></Field>
            <Field label="Dia vencimento"><Input type="number" value={form.due_day} onChange={(e) => set('due_day', e.target.value)} /></Field>
            <Field label="Instituicao"><Input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Banco" /></Field>
          </div>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" /> Parcela estimada (Tabela Price): <b>{formatCurrency(formInst)}/mes</b> · total {formatCurrency(formInst * Number(form.installments || 0))}
          </div>
        </form>
      </Modal>

      {/* Modal tabela de amortizacao */}
      {schedule && (
        <Modal open onClose={() => setSchedule(null)} title={`Amortizacao — ${schedule.name}`} maxWidth="max-w-lg"
          footer={<Button onClick={() => setSchedule(null)}>Fechar</Button>}>
          <p className="text-sm text-muted mb-2">Parcela fixa de <b className="text-[hsl(var(--text))]">{formatCurrency(schedule.inst)}</b> (Tabela Price).</p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]"><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5">#</th><th className="py-1.5 text-right">Juros</th><th className="py-1.5 text-right">Amortizacao</th><th className="py-1.5 text-right">Saldo</th></tr></thead>
              <tbody>{schedule.rows.map((r) => (
                <tr key={r.k} className={`border-b border-[hsl(var(--border))] last:border-0 ${r.paga ? 'opacity-50' : ''}`}>
                  <td className="py-1.5">{r.k}{r.paga ? ' ✓' : ''}</td>
                  <td className="py-1.5 text-right text-rose-500">{formatCurrency(r.juros)}</td>
                  <td className="py-1.5 text-right text-emerald-500">{formatCurrency(r.amort)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(r.saldo)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
