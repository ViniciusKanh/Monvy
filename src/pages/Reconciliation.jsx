import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { GitCompare, CheckCircle2, AlertTriangle, Copy, Tag, Wand2, ArrowUpRight, ArrowDownRight, Trash2, Check, Sparkles } from 'lucide-react';
import { buildCategoryIndex, predictCategory } from '../lib/categoryPredictor.js';

export default function Reconciliation() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const [busy, setBusy] = useState(false);

  const today = todayIso();

  const mark = useMutation({ mutationFn: ({ id }) => Transaction.update(id, { status: 'completed' }), onSuccess: () => inval() });
  const remove = useMutation({ mutationFn: (id) => Transaction.remove(id), onSuccess: () => inval() });
  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };

  // 1. pendencias vencidas (data <= hoje e status pendente)
  const overdue = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && (t.status || 'pending') !== 'completed' && String(t.date).slice(0, 10) <= today), [transactions, today]);
  // 2. possiveis duplicados (mesmo valor+data+descricao)
  const duplicates = useMemo(() => {
    const seen = {}; const dups = [];
    for (const t of transactions) {
      const key = `${t.type}|${t.date?.slice(0,10)}|${Number(t.amount)}|${(t.description||'').trim().toLowerCase()}`;
      if (seen[key]) dups.push(t); else seen[key] = true;
    }
    return dups;
  }, [transactions]);
  // 3. sem categoria (despesa/receita)
  const uncategorized = useMemo(() => transactions.filter((t) => t.type !== 'transfer' && !t.category_id), [transactions]);
  // 4. verificacao de saldo por conta
  const balanceCheck = useMemo(() => accounts.map((a) => {
    let bal = Number(a.initial_balance || 0);
    for (const t of transactions) {
      if ((t.status || 'pending') !== 'completed' && t.status != null) continue;
      if (t.type === 'income' && t.account_id === a.id) bal += Number(t.amount);
      if (t.type === 'expense' && t.account_id === a.id) bal -= Number(t.amount);
      if (t.type === 'transfer' && t.account_id === a.id) bal -= Number(t.amount);
      if (t.type === 'transfer' && t.account_to_id === a.id) bal += Number(t.amount);
    }
    return { acc: a, expected: bal, actual: Number(a.current_balance || 0), ok: Math.abs(bal - Number(a.current_balance || 0)) < 0.01 };
  }), [accounts, transactions]);

  const reconciledIn = transactions.filter((t) => t.type === 'income' && (t.status === 'completed' || t.status == null)).reduce((s, t) => s + Number(t.amount), 0);
  const reconciledOut = transactions.filter((t) => t.type === 'expense' && (t.status === 'completed' || t.status == null)).reduce((s, t) => s + Number(t.amount), 0);

  const autoReconcile = async () => {
    if (!overdue.length) { toast.info('Nada vencido para conciliar.'); return; }
    setBusy(true);
    try {
      for (const t of overdue) await Transaction.update(t.id, { status: 'completed' });
      inval();
      toast.success(`${overdue.length} lancamento(s) conciliado(s) automaticamente.`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const autoCategorize = async () => {
    if (!uncategorized.length) { toast.info('Nada para categorizar.'); return; }
    setBusy(true);
    try {
      const idx = buildCategoryIndex(transactions);
      let done = 0;
      for (const t of uncategorized) {
        const p = predictCategory(t.description, idx);
        if (p && catMap[p] && catMap[p].type === (t.type === 'income' ? 'income' : 'expense')) { await Transaction.update(t.id, { category_id: p }); done++; }
      }
      inval();
      toast.success(done ? `${done} lancamento(s) categorizado(s) por IA.` : 'Nao foi possivel inferir categorias (historico insuficiente).');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const issues = overdue.length + duplicates.length + uncategorized.length + balanceCheck.filter((b) => !b.ok).length;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><GitCompare className="w-6 h-6 text-emerald-500" /> Conciliacao Financeira</span>}
        subtitle="Concilia automaticamente suas entradas e saidas e aponta divergencias"
        actions={<Button onClick={autoReconcile} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Wand2 className="w-4 h-4" /> Conciliar automaticamente</>}</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> Entradas conciliadas</p><p className="font-display text-xl font-bold text-emerald-500"><AnimatedValue value={reconciledIn} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={1}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-rose-500" /> Saidas conciliadas</p><p className="font-display text-xl font-bold text-rose-500"><AnimatedValue value={reconciledOut} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={2}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted">Saldo conciliado</p><p className="font-display text-xl font-bold"><AnimatedValue value={reconciledIn - reconciledOut} format={formatCurrency} /></p></Card></Reveal>
        <Reveal i={3}><Card className="py-4 hover-lift h-full"><p className="text-xs text-muted">Pendencias</p><p className={`font-display text-xl font-bold ${issues ? 'text-amber-500' : 'text-emerald-500'}`}><AnimatedValue value={issues} format={(v) => String(Math.round(v))} /></p></Card></Reveal>
      </div>

      {issues === 0 && <Card><EmptyState icon={CheckCircle2} title="Tudo conciliado!" subtitle="Suas entradas e saidas batem com os saldos e nao ha pendencias." /></Card>}

      {/* Pendencias vencidas */}
      {overdue.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Vencidos nao conciliados ({overdue.length})</h3><Button size="sm" variant="outline" onClick={autoReconcile} disabled={busy}>Conciliar todos</Button></div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {overdue.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${t.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || catMap[t.category_id]?.name || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')} · {accMap[t.account_id]?.name || ''}</p></div>
                <Badge color="amber">{t.type === 'income' ? 'A receber' : 'A pagar'}</Badge>
                <span className="font-semibold">{formatCurrency(t.amount)}</span>
                <button onClick={() => mark.mutate({ id: t.id })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Conciliar"><Check className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Duplicados */}
      {duplicates.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Copy className="w-4 h-4 text-rose-500" /> Possiveis duplicados ({duplicates.length})</h3>
          <div className="divide-y divide-[hsl(var(--border))]">
            {duplicates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</p></div>
                <span className="font-semibold">{formatCurrency(t.amount)}</span>
                <button onClick={() => remove.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Remover duplicado"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sem categoria */}
      {uncategorized.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-500" /> Sem categoria ({uncategorized.length})</h3>
            <Button size="sm" variant="outline" onClick={autoCategorize} disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4 text-emerald-500" /> Auto-categorizar</>}</Button>
          </div>
          <p className="text-sm text-muted">A IA usa seu historico para inferir a categoria de cada lancamento.</p>
        </Card>
      )}

      {/* Verificacao de saldo */}
      <Card>
        <h3 className="font-semibold mb-3">Verificacao de Saldo por Conta</h3>
        <div className="divide-y divide-[hsl(var(--border))]">
          {balanceCheck.map((b) => (
            <div key={b.acc.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded-lg" style={{ background: b.acc.color }} />
              <span className="flex-1 font-medium">{b.acc.name}</span>
              <span className="text-sm text-muted">esperado {formatCurrency(b.expected)}</span>
              <span className="text-sm font-semibold">{formatCurrency(b.actual)}</span>
              {b.ok ? <Badge color="emerald"><Check className="w-3 h-3" /> OK</Badge> : <Badge color="rose">Divergente</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
