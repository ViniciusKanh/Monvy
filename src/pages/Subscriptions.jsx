import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Subscription, Transaction } from '../api/entities.js';
import { detectSubscriptions } from '../lib/analytics.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Select, Field, Modal, Textarea, Spinner, EmptyState, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { Plus, RefreshCw, Pencil, Trash2, CalendarClock, AlertTriangle, Sparkles, Wand2 } from 'lucide-react';

const POPULAR = [
  { name: 'Netflix', emoji: '🎬', color: '#e50914' }, { name: 'Spotify', emoji: '🎵', color: '#1db954' },
  { name: 'Amazon Prime', emoji: '📦', color: '#00a8e1' }, { name: 'Disney+', emoji: '✨', color: '#113ccf' },
  { name: 'YouTube Premium', emoji: '▶️', color: '#ff0000' }, { name: 'iCloud', emoji: '☁️', color: '#3693f3' },
  { name: 'Microsoft 365', emoji: '🪟', color: '#0067b8' }, { name: 'Gympass', emoji: '🏋️', color: '#f9a825' },
  { name: 'Adobe CC', emoji: '🎨', color: '#ff0000' }, { name: 'HBO Max', emoji: '🎭', color: '#5b2e91' },
  { name: 'Duolingo', emoji: '🦉', color: '#58cc02' }, { name: 'ChatGPT', emoji: '🤖', color: '#10a37f' },
];
const FREQ = [['daily', 'Diario'], ['weekly', 'Semanal'], ['monthly', 'Mensal'], ['rarely', 'Raramente'], ['never', 'Nunca uso']];
const FREQ_COLOR = { daily: 'emerald', weekly: 'emerald', monthly: 'blue', rarely: 'amber', never: 'rose' };
const empty = { name: '', amount: '', renewal_day: 1, category: '', color: '#8b5cf6', icon_emoji: '📱', usage_frequency: 'monthly', notes: '' };

export default function Subscriptions() {
  const qc = useQueryClient();
  const { data: subs = [], isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const suggestions = useMemo(() => detectSubscriptions(transactions, subs), [transactions, subs]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const save = useMutation({
    mutationFn: (p) => editing ? Subscription.update(editing.id, p) : Subscription.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); setModal(false); },
  });
  const del = useMutation({ mutationFn: (id) => Subscription.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }) });

  const openNew = (preset) => { setEditing(null); setForm(preset ? { ...empty, name: preset.name, icon_emoji: preset.emoji || '📱', color: preset.color, amount: preset.amount ?? '', renewal_day: preset.renewal_day ?? 1 } : empty); setModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...empty, ...s, amount: s.amount, notes: s.notes || '' }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, amount: Number(form.amount), renewal_day: Number(form.renewal_day) }); };

  const totals = useMemo(() => {
    const monthly = subs.reduce((s, x) => s + Number(x.amount || 0), 0);
    const lowUse = subs.filter((x) => ['rarely', 'never'].includes(x.usage_frequency)).length;
    return { monthly, annual: monthly * 12, count: subs.length, lowUse };
  }, [subs]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Assinaturas" subtitle="Controle seus serviços recorrentes"
        actions={<Button onClick={() => openNew()}><Plus className="w-4 h-4" /> Nova assinatura</Button>} />

      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10" style={{ background: 'linear-gradient(135deg,#3b0764,#0d1433 60%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.32), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.25em] text-violet-300/80">GASTO MENSAL COM ASSINATURAS</p>
            <p className="font-display text-3xl sm:text-4xl font-extrabold mt-1"><AnimatedValue value={totals.monthly} format={formatCurrency} /></p>
            <p className="text-xs text-slate-400 mt-1">Projeção anual: <b className="text-slate-200">{formatCurrency(totals.annual)}</b></p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center min-w-[80px]"><p className="text-[11px] text-slate-400">Ativas</p><p className="font-display text-2xl font-bold">{totals.count}</p></div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center min-w-[80px]"><p className="text-[11px] text-amber-300">Baixo uso</p><p className="font-display text-2xl font-bold">{totals.lowUse}</p></div>
          </div>
        </div>
      </div>

      {totals.lowUse > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4" /> Você tem {totals.lowUse} assinatura(s) pouco usada(s). Considere cancelar para economizar.
        </div>
      )}

      {suggestions.length > 0 && (
        <Card className="border-emerald-500/30">
          <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> DETECTADAS NO SEU HISTORICO</p>
          <div className="space-y-2">
            {suggestions.map((sug, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{sug.name}</p><p className="text-xs text-muted">{formatCurrency(sug.amount)}/mês · aparece em {sug.months} meses</p></div>
                <Button size="sm" variant="outline" onClick={() => openNew({ name: sug.name, emoji: '🔁', color: '#10b981', amount: sug.amount, renewal_day: sug.renewal_day })}><Plus className="w-4 h-4" /> Adicionar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-xs font-bold tracking-widest text-muted mb-3">SERVICOS POPULARES</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((p) => (
            <button key={p.name} onClick={() => openNew(p)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
              <span>{p.emoji}</span> {p.name}
            </button>
          ))}
        </div>
      </Card>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : subs.length === 0 ? <Card><EmptyState icon={RefreshCw} title="Nenhuma assinatura" subtitle="Adicione seus serviços recorrentes." action={<Button onClick={() => openNew()}><Plus className="w-4 h-4" /> Nova assinatura</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subs.map((s, i) => (
              <Reveal key={s.id} i={Math.min(i, 8)}><Card className="hover-lift h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${s.color}22` }}>{s.icon_emoji || '📱'}</span>
                    <div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted">{s.category || 'Sem categoria'}</p></div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del.mutate(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div><p className="font-display text-2xl font-bold" style={{ color: s.color }}>{formatCurrency(s.amount)}</p><p className="text-xs text-muted">por mês</p></div>
                  <div className="text-right">
                    <Badge color={FREQ_COLOR[s.usage_frequency] || 'slate'}>{(FREQ.find((f) => f[0] === s.usage_frequency) || [])[1]}</Badge>
                    <p className="text-xs text-muted mt-1 flex items-center gap-1 justify-end"><CalendarClock className="w-3 h-3" /> dia {s.renewal_day}</p>
                  </div>
                </div>
              </Card></Reveal>
            ))}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar assinatura' : 'Nova assinatura'} maxWidth="max-w-xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[80px_1fr_80px] gap-3 items-end">
            <Field label="Emoji"><Input value={form.icon_emoji} onChange={(e) => set('icon_emoji', e.target.value)} className="text-center text-xl" maxLength={2} /></Field>
            <Field label="Nome"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Netflix, Spotify..." /></Field>
            <Field label="Cor"><input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="w-full h-10 rounded-lg border border-[hsl(var(--border))]" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor mensal (R$)"><Input type="number" step="0.01" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Dia de renovacao"><Input type="number" min="1" max="31" value={form.renewal_day} onChange={(e) => set('renewal_day', e.target.value)} /></Field>
          </div>
          <Field label="Frequencia de uso">
            <div className="flex flex-wrap gap-2">
              {FREQ.map(([v, l]) => <button key={v} type="button" onClick={() => set('usage_frequency', v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${form.usage_frequency === v ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-600' : 'border-[hsl(var(--border))] text-muted'}`}>{l}</button>)}
            </div>
          </Field>
          <Field label="Categoria"><Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Entretenimento, Trabalho..." /></Field>
          <Field label="Notas"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Observacoes..." /></Field>
        </form>
      </Modal>
    </div>
  );
}
