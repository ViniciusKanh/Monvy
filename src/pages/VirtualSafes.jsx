import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Goal, Transaction, Account } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { toast } from '../lib/toast.js';
import { Button, Card, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { Plus, Vault, PiggyBank, Plane, Car, Home, GraduationCap, HeartPulse, Wallet, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, Target } from 'lucide-react';

// Cofres = Metas (mesmos dados) -> sempre sincronizados
const CATS = [
  { v: 'emergency', label: 'Emergencia', icon: PiggyBank },
  { v: 'travel', label: 'Viagem', icon: Plane },
  { v: 'home', label: 'Casa', icon: Home },
  { v: 'car', label: 'Carro', icon: Car },
  { v: 'education', label: 'Educação', icon: GraduationCap },
  { v: 'health', label: 'Saúde', icon: HeartPulse },
  { v: 'other', label: 'Outro', icon: Wallet },
];
const iconFor = (c) => (CATS.find((x) => x.v === c)?.icon || Vault);
const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];
const empty = { name: '', target_amount: '', current_amount: 0, category: 'other', color: '#10b981' };

function SafeRing({ pct }) {
  const p = Math.min(100, Math.max(0, pct)); const r = 46, c = 2 * Math.PI * r, off = c - (p / 100) * c;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90"><circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="11" /><circle cx="64" cy="64" r={r} fill="none" stroke="#34d399" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-extrabold text-white">{p}%</span><span className="text-[11px] text-slate-400">guardado</span></div>
    </div>
  );
}

export default function VirtualSafes() {
  const qc = useQueryClient();
  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [move, setMove] = useState(null);
  const [moveVal, setMoveVal] = useState('');
  const [moveAccount, setMoveAccount] = useState('');

  const inval = () => { qc.invalidateQueries({ queryKey: ['goals'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); };
  const save = useMutation({ mutationFn: (p) => editing ? Goal.update(editing.id, p) : Goal.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Goal.remove(id), onSuccess: inval });
  const doMove = useMutation({
    mutationFn: async ({ g, type, value, accountId }) => {
      const cur = Number(g.current_amount || 0);
      if (!(value > 0)) throw new Error('Informe um valor valido');
      if (type === 'out' && value > cur) throw new Error('Valor maior que o disponível no cofre');
      // guardar debita a conta; retirar credita a conta (via transferencia -> recalcula saldos)
      await Transaction.create({
        type: 'transfer', amount: value, status: 'completed', date: todayIso(),
        account_id: type === 'in' ? accountId : null,
        account_to_id: type === 'out' ? accountId : null,
        description: type === 'in' ? `Guardado no cofre: ${g.name}` : `Retirado do cofre: ${g.name}`,
      });
      const next = type === 'in' ? cur + value : Math.max(0, cur - value);
      const status = next >= Number(g.target_amount || Infinity) && Number(g.target_amount) > 0 ? 'completed' : 'active';
      await Goal.update(g.id, { current_amount: next, status });
    },
    onSuccess: () => { inval(); setMove(null); setMoveVal(''); setMoveAccount(''); toast.success('Movimentação registrada'); },
    onError: (e) => toast.error(e.message || 'Falha na movimentação'),
  });
  const openMove = (g, type) => { setMove({ g, type }); setMoveVal(''); setMoveAccount(g.account_id || accounts[0]?.id || ''); };

  const openNew = () => { setEditing(null); setForm({ ...empty, start_date: todayIso() }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ name: g.name, target_amount: g.target_amount ?? '', current_amount: g.current_amount ?? 0, category: g.category || 'other', color: g.color }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, target_amount: Number(form.target_amount || 0), current_amount: Number(form.current_amount || 0), status: editing?.status || 'active' }); };

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const progress = totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Cofres Virtuais" subtitle="Reserve dinheiro por objetivo — sincronizado com suas Metas"
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
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Cofres/Metas</p><p className="font-bold">{goals.length}</p></div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-400">Progresso</p><p className="font-bold">{progress}%</p></div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Target className="w-3 h-3" /> Cada cofre é uma meta — o que você guarda aqui aparece nas Metas, e vice-versa.</p>
          </div>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : goals.length === 0 ? <Card><EmptyState icon={Vault} title="Nenhum cofre" subtitle="Crie um cofre (que também vira uma meta) para reservar dinheiro." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo cofre</Button>} /></Card>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g, idx) => {
              const Icon = iconFor(g.category);
              const pct = g.target_amount ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
              const done = g.status === 'completed' || (g.target_amount > 0 && pct >= 100);
              return (
                <Reveal key={g.id} i={Math.min(idx, 8)}>
                  <Card className="hover-lift h-full">
                    <div className="flex items-start justify-between">
                      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: g.color }}><Icon className="w-5 h-5" /></span>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del.mutate(g.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="font-semibold mt-3">{g.name}</p>
                    {done && <Badge color="emerald" className="mt-1">Meta atingida</Badge>}
                    <p className="font-display text-2xl font-bold mt-1" style={{ color: g.color }}>{formatCurrency(g.current_amount)}</p>
                    {g.target_amount > 0 && (<>
                      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} /></div>
                      <p className="text-xs text-muted mt-1">{pct}% de {formatCurrency(g.target_amount)}</p>
                    </>)}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openMove(g, 'in')}><ArrowDownToLine className="w-4 h-4" /> Guardar</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openMove(g, 'out')}><ArrowUpFromLine className="w-4 h-4" /> Retirar</Button>
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar cofre' : 'Novo cofre'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome do cofre / meta"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Viagem para Europa" /></Field>
          <Field label="Categoria"><Select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta (R$)"><Input type="number" step="0.01" value={form.target_amount} onChange={(e) => set('target_amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Guardado (R$)"><Input type="number" step="0.01" value={form.current_amount} onChange={(e) => set('current_amount', e.target.value)} /></Field>
          </div>
          <Field label="Cor"><div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" onClick={() => set('color', c)} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div></Field>
        </form>
      </Modal>

      <Modal open={!!move} onClose={() => setMove(null)} title={move?.type === 'in' ? 'Guardar no cofre' : 'Retirar do cofre'} maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setMove(null)}>Cancelar</Button><Button onClick={() => doMove.mutate({ g: move.g, type: move.type, value: Number(String(moveVal).replace(',', '.')), accountId: moveAccount })} disabled={!moveVal || !moveAccount || doMove.isPending}>{doMove.isPending ? <Spinner className="w-4 h-4" /> : 'Confirmar'}</Button></>}>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">Cadastre uma conta primeiro — o dinheiro do cofre entra e sai de uma conta.</p>
        ) : (
          <div className="space-y-3">
            <Field label="Valor"><Input type="number" step="0.01" value={moveVal} onChange={(e) => setMoveVal(e.target.value)} placeholder="0,00" autoFocus /></Field>
            <Field label={move?.type === 'in' ? 'Debitar da conta' : 'Creditar na conta'} hint={move?.type === 'in' ? 'O valor sai desta conta e vai para o cofre' : 'O valor sai do cofre e entra nesta conta'}>
              <Select value={moveAccount} onChange={(e) => setMoveAccount(e.target.value)}><option value="">Selecione a conta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatCurrency(a.current_balance || 0)}</option>)}</Select>
            </Field>
            {move?.type === 'out' && <p className="text-xs text-muted">Disponível no cofre: {formatCurrency(move.g.current_amount || 0)}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
