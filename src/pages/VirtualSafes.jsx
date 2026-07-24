import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Safe } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button, Card, Input, Field, Modal, Spinner, EmptyState } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { Plus, Vault, PiggyBank, Plane, Car, Home, BookOpen, ShoppingBag, Target, Sparkles, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

const ICONS = { piggy: PiggyBank, plane: Plane, car: Car, home: Home, book: BookOpen, bag: ShoppingBag, target: Target, spark: Sparkles };
const ICON_LIST = Object.keys(ICONS);
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const empty = { name: '', target_amount: '', current_amount: 0, icon: 'piggy', color: '#10b981' };

export default function VirtualSafes() {
  const qc = useQueryClient();
  const { data: safes = [], isLoading } = useQuery({ queryKey: ['safes'], queryFn: () => Safe.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [move, setMove] = useState(null); // {safe, type}
  const [moveVal, setMoveVal] = useState('');

  const save = useMutation({ mutationFn: (p) => editing ? Safe.update(editing.id, p) : Safe.create(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['safes'] }); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Safe.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['safes'] }) });
  const doMove = useMutation({
    mutationFn: ({ safe, type, value }) => { const cur = Number(safe.current_amount || 0); const next = type === 'in' ? cur + value : Math.max(0, cur - value); return Safe.update(safe.id, { current_amount: next }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safes'] }); setMove(null); setMoveVal(''); },
  });

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, target_amount: s.target_amount ?? '', current_amount: s.current_amount ?? 0, icon: s.icon || 'piggy', color: s.color }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, target_amount: Number(form.target_amount || 0), current_amount: Number(form.current_amount || 0) }); };

  const totalSaved = safes.reduce((s, x) => s + Number(x.current_amount || 0), 0);
  const totalTarget = safes.reduce((s, x) => s + Number(x.target_amount || 0), 0);
  const progress = totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Cofres Virtuais" subtitle="Separe seu dinheiro por objetivo"
        actions={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo cofre</Button>} />

      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10" style={{ background: 'linear-gradient(135deg,#065f46,#0d1433 60%,#312e81)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,.30), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <SafeRing pct={progress} />
          <div className="flex-1 w-full">
            <p className="text-[11px] tracking-[0.25em] text-emerald-300/80">TOTAL GUARDADO EM COFRES</p>
            <p className="font-display text-3xl sm:text-4xl font-extrabold mt-1"><AnimatedValue value={totalSaved} format={formatCurrency} /> <span className="text-lg text-slate-400 font-semibold">/ {formatCurrency(totalTarget)}</span></p>
            <div className="grid grid-cols-2 gap-3 mt-4 max-w-xs">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Cofres</p><p className="font-bold">{safes.length}</p></div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Progresso</p><p className="font-bold">{progress}%</p></div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : safes.length === 0 ? <Card><EmptyState icon={Vault} title="Nenhum cofre" subtitle="Crie cofres para separar dinheiro por objetivo." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo cofre</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {safes.map((s, idx) => {
              const Icon = ICONS[s.icon] || PiggyBank;
              const pct = s.target_amount ? Math.min(100, Math.round((s.current_amount / s.target_amount) * 100)) : 0;
              return (
                <Reveal key={s.id} i={Math.min(idx, 8)}><Card className="hover-lift h-full">
                  <div className="flex items-start justify-between">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: s.color }}><Icon className="w-5 h-5" /></span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => del.mutate(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="font-semibold mt-3">{s.name}</p>
                  <p className="font-display text-2xl font-bold mt-1" style={{ color: s.color }}>{formatCurrency(s.current_amount)}</p>
                  {s.target_amount > 0 && (<>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} /></div>
                    <p className="text-xs text-muted mt-1">{pct}% de {formatCurrency(s.target_amount)}</p>
                  </>)}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setMove({ safe: s, type: 'in' }); setMoveVal(''); }}><ArrowDownToLine className="w-4 h-4" /> Guardar</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setMove({ safe: s, type: 'out' }); setMoveVal(''); }}><ArrowUpFromLine className="w-4 h-4" /> Retirar</Button>
                  </div>
                </Card></Reveal>
              );
            })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar cofre' : 'Novo cofre'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome do cofre"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Viagem para Europa" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta (R$)"><Input type="number" step="0.01" value={form.target_amount} onChange={(e) => set('target_amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Guardado (R$)"><Input type="number" step="0.01" value={form.current_amount} onChange={(e) => set('current_amount', e.target.value)} /></Field>
          </div>
          <Field label="Icone">
            <div className="flex flex-wrap gap-2">
              {ICON_LIST.map((k) => { const I = ICONS[k]; return <button key={k} type="button" onClick={() => set('icon', k)} className={`w-10 h-10 rounded-lg flex items-center justify-center border ${form.icon === k ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-[hsl(var(--border))] text-muted'}`}><I className="w-5 h-5" /></button>; })}
            </div>
          </Field>
          <Field label="Cor">
            <div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => set('color', c)} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </Field>
        </form>
      </Modal>

      <Modal open={!!move} onClose={() => setMove(null)} title={move?.type === 'in' ? 'Guardar no cofre' : 'Retirar do cofre'} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setMove(null)}>Cancelar</Button><Button onClick={() => doMove.mutate({ safe: move.safe, type: move.type, value: Number(moveVal) })} disabled={!moveVal || doMove.isPending}>{doMove.isPending ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</Button></>}>
        <Field label="Valor"><Input type="number" step="0.01" value={moveVal} onChange={(e) => setMoveVal(e.target.value)} placeholder="0,00" autoFocus /></Field>
      </Modal>
    </div>
  );
}

function SafeRing({ pct }) {
  const p = Math.min(100, Math.max(0, pct)); const r = 46, c = 2 * Math.PI * r, off = c - (p / 100) * c;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90"><circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="11" /><circle cx="64" cy="64" r={r} fill="none" stroke="#34d399" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-extrabold text-white">{p}%</span><span className="text-[11px] text-slate-400">guardado</span></div>
    </div>
  );
}
