import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trigger } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { Zap, Plus, Pencil, Trash2, Wallet, CalendarClock, PiggyBank, Mail, Clock } from 'lucide-react';

const TYPES = [
  { v: 'financial_summary', label: 'Resumo financeiro', desc: 'Panorama das suas financas (saldo, receitas, despesas e taxa de poupanca) por e-mail.', icon: Wallet, color: '#10b981' },
  { v: 'upcoming_bills', label: 'Vencimentos proximos', desc: 'Lembrete das contas e faturas a vencer nos proximos dias.', icon: CalendarClock, color: '#0ea5e9' },
  { v: 'budget_alert', label: 'Alerta de orcamento', desc: 'Aviso quando uma categoria estourar o limite do mes.', icon: PiggyBank, color: '#f59e0b' },
];
const tInfo = (v) => TYPES.find((t) => t.v === v) || TYPES[0];
const FREQ = [['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mes']];
const freqLabel = (f) => (FREQ.find((x) => x[0] === f) || FREQ[0])[1];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
const empty = { name: '', type: 'financial_summary', frequency: 'daily', weekday: 1, enabled: true };

export default function Triggers() {
  const qc = useQueryClient();
  const { data: triggers = [], isLoading } = useQuery({ queryKey: ['triggers'], queryFn: () => Trigger.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const inval = () => qc.invalidateQueries({ queryKey: ['triggers'] });
  const save = useMutation({ mutationFn: (p) => editing ? Trigger.update(editing.id, p) : Trigger.create(p), onSuccess: () => { inval(); setModal(false); toast.success('Gatilho salvo'); }, onError: (e) => toast.error(e.message || 'Falha') });
  const del = useMutation({ mutationFn: (id) => Trigger.remove(id), onSuccess: inval });
  const toggle = useMutation({ mutationFn: ({ id, enabled }) => Trigger.update(id, { enabled }), onSuccess: inval });

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', type: t.type, frequency: t.frequency, weekday: t.weekday ?? 1, enabled: t.enabled !== false }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => { if (!form.name) return toast.error('De um nome ao gatilho'); save.mutate({ ...form, weekday: Number(form.weekday) }); };

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><Zap className="w-6 h-6 text-amber-500" /> Gatilhos & Automacoes</span>}
        subtitle="Crie automacoes que rodam sozinhas e te avisam por e-mail"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo gatilho</Button>}
      />

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Os gatilhos rodam automaticamente uma vez por dia (de manha) e enviam o e-mail para o seu endereco cadastrado, na frequencia escolhida. E preciso que o envio de e-mail esteja configurado pelo administrador.</span>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : triggers.length === 0 ? <Card><EmptyState icon={Zap} title="Nenhum gatilho" subtitle="Crie um gatilho para receber automaticamente o que importa pra voce." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo gatilho</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {triggers.map((t, i) => { const info = tInfo(t.type); const on = t.enabled !== false; return (
              <Reveal key={t.id} i={Math.min(i, 8)}>
                <Card className={`hover-lift h-full ${on ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: info.color }}><info.icon className="w-5 h-5" /></span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-semibold mt-3">{t.name}</p>
                  <p className="text-xs text-muted mt-0.5">{info.label}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge color="blue"><CalendarClock className="w-3 h-3" /> {freqLabel(t.frequency)}{t.frequency === 'weekly' ? ` (${WEEKDAYS[t.weekday ?? 1]})` : ''}</Badge>
                    <Badge color="slate"><Mail className="w-3 h-3" /> e-mail</Badge>
                  </div>
                  <label className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--border))] text-sm cursor-pointer">
                    <span>{on ? 'Ativo' : 'Pausado'}</span>
                    <input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={on} onChange={(e) => toggle.mutate({ id: t.id, enabled: e.target.checked })} />
                  </label>
                </Card>
              </Reveal>
            ); })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar gatilho' : 'Novo gatilho'} maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <div className="space-y-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Meu resumo diario" /></Field>
          <Field label="O que enviar">
            <div className="space-y-2">
              {TYPES.map((t) => (
                <button key={t.v} type="button" onClick={() => set('type', t.v)} className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition ${form.type === t.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: t.color }}><t.icon className="w-4 h-4" /></span>
                  <div><p className="font-semibold text-sm">{t.label}</p><p className="text-xs text-muted">{t.desc}</p></div>
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequencia"><Select value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            {form.frequency === 'weekly' && <Field label="Dia da semana"><Select value={form.weekday} onChange={(e) => set('weekday', e.target.value)}>{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</Select></Field>}
          </div>
          <label className="flex items-center justify-between text-sm"><span>Ativo</span><input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} /></label>
        </div>
      </Modal>
    </div>
  );
}
