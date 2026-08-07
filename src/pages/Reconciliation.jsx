import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Badge, Select, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso, monthKey } from '../lib/utils.js';
import { GitCompare, CheckCircle2, AlertTriangle, Copy, Tag, Wand2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Trash2, Check, Sparkles, ListChecks } from 'lucide-react';
import { buildCategoryIndex, predictCategory } from '../lib/categoryPredictor.js';

export default function Reconciliation() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const today = todayIso();

  const [acc, setAcc] = useState('all');
  const [period, setPeriod] = useState('90');
  const [onlyUnrec, setOnlyUnrec] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const setReconciled = useMutation({ mutationFn: ({ id, reconciled }) => Transaction.update(id, { reconciled }), onSuccess: inval });
  const markPaid = useMutation({ mutationFn: (id) => Transaction.update(id, { status: 'completed' }), onSuccess: inval });
  const remove = useMutation({ mutationFn: (id) => Transaction.remove(id), onSuccess: inval });

  const periodStart = useMemo(() => {
    if (period === 'all') return '0000-00';
    if (period === 'month') return monthKey(new Date());
    const d = new Date(); d.setDate(d.getDate() - Number(period)); return d.toISOString().slice(0, 10);
  }, [period]);
  const inScope = (t) => {
    if (acc !== 'all' && t.account_id !== acc && t.account_to_id !== acc) return false;
    const ds = String(t.date).slice(0, 10);
    if (period === 'month') return ds.slice(0, 7) === periodStart;
    if (period !== 'all') return ds >= periodStart;
    return true;
  };

  const scoped = useMemo(() => transactions.filter(inScope).sort((a, b) => (a.date < b.date ? 1 : -1)), [transactions, acc, period, periodStart]);
  const recCount = scoped.filter((t) => t.reconciled).length;
  const progress = scoped.length ? Math.round((recCount / scoped.length) * 100) : 100;
  const checklist = useMemo(() => onlyUnrec ? scoped.filter((t) => !t.reconciled) : scoped, [scoped, onlyUnrec]);

  const overdue = useMemo(() => scoped.filter((t) => t.type !== 'transfer' && (t.status || 'pending') !== 'completed' && String(t.date).slice(0, 10) <= today), [scoped, today]);
  const duplicates = useMemo(() => {
    const byKey = {}; const dups = [];
    const sorted = [...scoped].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const t of sorted) {
      const key = `${t.type}|${Number(t.amount)}`;
      const prev = byKey[key];
      if (prev) {
        const d1 = new Date(prev.date + 'T00:00'), d2 = new Date(String(t.date).slice(0, 10) + 'T00:00');
        const diff = Math.abs((d2 - d1) / 86400000);
        const sameDesc = (prev.description || '').trim().toLowerCase() === (t.description || '').trim().toLowerCase();
        if (diff <= 3 && (sameDesc || !t.description)) dups.push(t);
      }
      byKey[key] = { date: String(t.date).slice(0, 10), description: t.description };
    }
    return dups;
  }, [scoped]);
  const uncategorized = useMemo(() => scoped.filter((t) => t.type !== 'transfer' && !t.category_id), [scoped]);

  const balanceCheck = useMemo(() => accounts.filter((a) => acc === 'all' || a.id === acc).map((a) => {
    let bal = Number(a.initial_balance || 0);
    for (const t of transactions) {
      if ((t.status || 'pending') !== 'completed' && t.status != null) continue;
      if (t.type === 'income' && t.account_id === a.id) bal += Number(t.amount);
      if (t.type === 'expense' && t.account_id === a.id) bal -= Number(t.amount);
      if (t.type === 'transfer' && t.account_id === a.id) bal -= Number(t.amount);
      if (t.type === 'transfer' && t.account_to_id === a.id) bal += Number(t.amount);
    }
    return { acc: a, expected: bal, actual: Number(a.current_balance || 0), ok: Math.abs(bal - Number(a.current_balance || 0)) < 0.01 };
  }), [accounts, transactions, acc]);

  const issues = overdue.length + duplicates.length + uncategorized.length + balanceCheck.filter((b) => !b.ok).length;

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (fn, ids, label) => {
    if (!ids.length) return;
    setBusy(true);
    try { for (const id of ids) await fn(id); inval(); setSel(new Set()); toast.success(label); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reconcileScopedPaid = () => {
    const ids = scoped.filter((t) => !t.reconciled && ((t.status || 'pending') === 'completed' || t.status == null)).map((t) => t.id);
    if (!ids.length) { toast.info('Nada novo para conciliar neste filtro.'); return; }
    bulk((id) => Transaction.update(id, { reconciled: true }), ids, `${ids.length} lancamento(s) conciliado(s).`);
  };
  const reconcileSelected = () => bulk((id) => Transaction.update(id, { reconciled: true }), [...sel], `${sel.size} conciliado(s).`);
  const autoCategorize = async () => {
    if (!uncategorized.length) { toast.info('Nada para categorizar.'); return; }
    setBusy(true);
    try {
      const idx = buildCategoryIndex(transactions); let done = 0;
      for (const t of uncategorized) { const p = predictCategory(t.description, idx); if (p && catMap[p] && catMap[p].type === (t.type === 'income' ? 'income' : 'expense')) { await Transaction.update(t.id, { category_id: p }); done++; } }
      inval();
      toast.success(done ? `${done} lancamento(s) categorizado(s).` : 'Historico insuficiente para inferir categorias.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const icon = (t) => t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : t.type === 'transfer' ? <ArrowLeftRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />;
  const iconBg = (t) => t.type === 'income' ? 'bg-emerald-500' : t.type === 'transfer' ? 'bg-indigo-500' : 'bg-rose-500';

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><GitCompare className="w-6 h-6 text-emerald-500" /> Conciliacao Financeira</span>}
        subtitle="Confira, marque como conciliado e resolva divergencias — como nos melhores sistemas"
        actions={<Button onClick={reconcileScopedPaid} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Wand2 className="w-4 h-4" /> Conciliar concluidos</>}</Button>} />

      <Card className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={acc} onChange={(e) => setAcc(e.target.value)} className="w-auto"><option value="all">Todas as contas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto"><option value="month">Mes atual</option><option value="90">Ultimos 90 dias</option><option value="all">Tudo</option></Select>
          <label className="flex items-center gap-2 text-sm ml-auto cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={onlyUnrec} onChange={(e) => setOnlyUnrec(e.target.checked)} /> So nao conciliados</label>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-emerald-500" /> Progresso da conciliacao</h3>
          <Badge color={progress === 100 ? 'emerald' : progress >= 50 ? 'amber' : 'rose'}>{recCount}/{scoped.length} · {progress}%</Badge>
        </div>
        <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : '#f59e0b' }} /></div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted">Lancamentos no filtro</p><p className="font-display text-xl font-bold"><AnimatedValue value={scoped.length} format={(v) => String(Math.round(v))} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Conciliados</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={recCount} format={(v) => String(Math.round(v))} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted">Pendentes de conciliar</p><p className="font-display text-xl font-bold text-amber-500"><AnimatedValue value={scoped.length - recCount} format={(v) => String(Math.round(v))} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted">Divergencias</p><p className={`font-display text-xl font-bold ${issues ? 'text-rose-500' : 'text-emerald-500'}`}><AnimatedValue value={issues} format={(v) => String(Math.round(v))} /></p></Card></Reveal>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold">Conferencia de lancamentos</h3>
          {sel.size > 0 && <Button size="sm" onClick={reconcileSelected} disabled={busy}><Check className="w-4 h-4" /> Conciliar {sel.size} selecionado(s)</Button>}
        </div>
        {checklist.length === 0 ? <EmptyState icon={CheckCircle2} title="Nada aqui" subtitle="Ajuste os filtros ou tudo ja esta conciliado." />
          : <div className="divide-y divide-[hsl(var(--border))] max-h-[460px] overflow-y-auto">
            {checklist.slice(0, 200).map((t) => {
              const done = !!t.reconciled;
              return (
                <div key={t.id} className={`flex items-center gap-3 py-2.5 ${sel.has(t.id) ? 'bg-emerald-500/5' : ''}`}>
                  <input type="checkbox" className="w-4 h-4 accent-emerald-500 shrink-0" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} />
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${iconBg(t)}`}>{icon(t)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.description || catMap[t.category_id]?.name || 'Lancamento'}</p>
                    <p className="text-xs text-muted truncate">{new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')} · {accMap[t.account_id]?.name || ''}{(t.status || 'pending') !== 'completed' && t.type !== 'transfer' ? ' · pendente' : ''}</p>
                  </div>
                  <span className={`font-semibold shrink-0 ${t.type === 'income' ? 'text-emerald-500' : t.type === 'transfer' ? 'text-indigo-500' : 'text-rose-500'}`}>{formatCurrency(t.amount)}</span>
                  <button onClick={() => setReconciled.mutate({ id: t.id, reconciled: !done })} title={done ? 'Desmarcar' : 'Marcar conciliado'} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : 'border-2 border-dashed border-[hsl(var(--border))] text-muted hover:border-emerald-500 hover:text-emerald-500'}`}><Check className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>}
      </Card>

      {issues === 0 && <Card><EmptyState icon={CheckCircle2} title="Sem divergencias" subtitle="Nenhuma pendencia, duplicidade ou saldo divergente no filtro atual." /></Card>}

      {overdue.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Vencidos nao pagos ({overdue.length})</h3><Button size="sm" variant="outline" onClick={() => bulk((id) => Transaction.update(id, { status: 'completed' }), overdue.map((t) => t.id), `${overdue.length} marcado(s) como pago(s).`)} disabled={busy}>Marcar todos como pagos</Button></div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {overdue.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${iconBg(t)}`}>{icon(t)}</span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || catMap[t.category_id]?.name || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')}</p></div>
                <Badge color="amber">{t.type === 'income' ? 'A receber' : 'A pagar'}</Badge>
                <span className="font-semibold">{formatCurrency(t.amount)}</span>
                <button onClick={() => markPaid.mutate(t.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Marcar pago"><Check className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {duplicates.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-1"><Copy className="w-4 h-4 text-rose-500" /> Possiveis duplicados ({duplicates.length})</h3>
          <p className="text-xs text-muted mb-3">Mesmo valor e tipo, com datas proximas (ate 3 dias). Confira antes de remover.</p>
          <div className="divide-y divide-[hsl(var(--border))]">
            {duplicates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')} · {accMap[t.account_id]?.name || ''}</p></div>
                <span className="font-semibold">{formatCurrency(t.amount)}</span>
                <button onClick={() => remove.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Remover duplicado"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {uncategorized.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-500" /> Sem categoria ({uncategorized.length})</h3>
            <Button size="sm" variant="outline" onClick={autoCategorize} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4 text-emerald-500" /> Auto-categorizar</>}</Button>
          </div>
          <p className="text-sm text-muted">Usa seu historico local para inferir a categoria de cada lancamento (sem IA de terceiros).</p>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Verificacao de saldo por conta</h3>
        <div className="divide-y divide-[hsl(var(--border))]">
          {balanceCheck.map((b) => (
            <div key={b.acc.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded-lg shrink-0" style={{ background: b.acc.color }} />
              <span className="flex-1 font-medium truncate">{b.acc.name}</span>
              <span className="text-sm text-muted hidden sm:inline">esperado {formatCurrency(b.expected)}</span>
              <span className="text-sm font-semibold">{formatCurrency(b.actual)}</span>
              {b.ok ? <Badge color="emerald"><Check className="w-3 h-3" /> OK</Badge> : <Badge color="rose">Divergente</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
