import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category, CategoryRule } from '../api/entities.js';
import { Select, Spinner, EmptyState } from '../components/ui';
import { HeroTitle, Panel, GlowButton, StatCard, KebabMenu, Pager } from '../components/kit.jsx';
import { ReconcileArt } from '../components/art/PageArt.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso, monthKey } from '../lib/utils.js';
import { GitCompare, CheckCircle2, AlertTriangle, Copy, Tag, Wand2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Trash2, Check, Sparkles, ListChecks, Filter, CalendarDays, Layers, FileText, Clock, CreditCard, Landmark, ChevronUp, ChevronDown, ChevronsUpDown, Undo2, Scale } from 'lucide-react';
import { buildCategoryIndex, predictCategory, matchRule } from '../lib/categoryPredictor.js';

export default function Reconciliation() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: rules = [] } = useQuery({ queryKey: ['catrules'], queryFn: () => CategoryRule.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const today = todayIso();

  const [acc, setAcc] = useState('all');
  const [period, setPeriod] = useState('90');
  const [onlyUnrec, setOnlyUnrec] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);

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

  const dupIds = useMemo(() => new Set(duplicates.map((t) => t.id)), [duplicates]);
  const checklist = useMemo(() => {
    const base = onlyUnrec ? scoped.filter((t) => !t.reconciled) : scoped;
    const val = (t) => sort.key === 'amount' ? Number(t.amount) : sort.key === 'acc' ? (accMap[t.account_id]?.name || '') : String(t.date).slice(0, 10);
    return [...base].sort((a, b) => { const x = val(a), y = val(b); const c = x < y ? -1 : x > y ? 1 : 0; return sort.dir === 'asc' ? c : -c; });
  }, [scoped, onlyUnrec, sort, accMap]);
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
    bulk((id) => Transaction.update(id, { reconciled: true }), ids, `${ids.length} lançamento(s) conciliado(s).`);
  };
  const reconcileSelected = () => bulk((id) => Transaction.update(id, { reconciled: true }), [...sel], `${sel.size} conciliado(s).`);
  const autoCategorize = async () => {
    if (!uncategorized.length) { toast.info('Nada para categorizar.'); return; }
    setBusy(true);
    try {
      const idx = buildCategoryIndex(transactions); let done = 0;
      for (const t of uncategorized) { const p = matchRule(t.description, rules, t.type) || predictCategory(t.description, idx); if (p && catMap[p] && catMap[p].type === (t.type === 'income' ? 'income' : 'expense')) { await Transaction.update(t.id, { category_id: p }); done++; } }
      inval();
      toast.success(done ? `${done} lançamento(s) categorizado(s).` : 'Histórico insuficiente para inferir categorias.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const PER = 12;
  const pages = Math.max(1, Math.ceil(checklist.length / PER));
  const cur = Math.min(page, pages);
  const rows = checklist.slice((cur - 1) * PER, cur * PER);
  const pend = scoped.length - recCount;
  const divCount = duplicates.length + balanceCheck.filter((b) => !b.ok).length;
  const fmtD = (t) => new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR');
  const icon = (t) => t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : t.type === 'transfer' ? <ArrowLeftRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />;
  const iconBg = (t) => t.type === 'income' ? 'bg-blue-500' : t.type === 'transfer' ? 'bg-indigo-500' : 'bg-rose-500';
  const valCls = (t) => t.type === 'income' ? 'text-sky-500 dark:text-sky-400' : t.type === 'transfer' ? 'text-indigo-500' : 'text-rose-500';
  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortH = ({ k, children, className = '' }) => <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-[hsl(var(--text))] ${className}`}>{children}{sort.key === k ? (sort.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />}</button>;
  const allOnPage = rows.length > 0 && rows.every((t) => sel.has(t.id));
  const toggleAll = () => setSel((s) => { const nx = new Set(s); rows.forEach((t) => (allOnPage ? nx.delete(t.id) : nx.add(t.id))); return nx; });
  const statusOf = (t) => dupIds.has(t.id) ? ['Divergência', AlertTriangle, 'text-rose-600 dark:text-rose-300 bg-rose-500/15 ring-rose-400/50'] : t.reconciled ? ['Conciliado', CheckCircle2, 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 ring-emerald-400/50'] : ['Pendente', Clock, 'text-amber-600 dark:text-amber-300 bg-amber-500/15 ring-amber-400/50'];
  const chip = (Ic, txt, cls) => <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ${cls}`}><Ic className="w-3.5 h-3.5" />{txt}</span>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={GitCompare} lead="Conciliação" accent="Financeira" iconClass="text-sky-400" subtitle="Confira, marque como conciliado e resolva divergências — como nos melhores sistemas."
        art={<ReconcileArt className="w-[22rem] h-36 opacity-90" />} />

      <section className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] p-3 flex flex-wrap items-center gap-3">
        <span className="w-10 h-10 rounded-xl grid place-items-center bg-sky-500/15 text-sky-400 ring-1 ring-sky-400/40"><Filter className="w-5 h-5" /></span>
        <Select value={acc} onChange={(e) => { setAcc(e.target.value); setPage(1); }} className="w-auto min-w-[180px]"><option value="all">Todas as contas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <div className="relative"><CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><Select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} className="w-auto pl-9 min-w-[180px]"><option value="month">Mês atual</option><option value="90">Últimos 90 dias</option><option value="all">Tudo</option></Select></div>
        <label className="flex items-center gap-2 text-sm ml-auto cursor-pointer select-none"><input type="checkbox" className="w-4 h-4 accent-violet-500" checked={onlyUnrec} onChange={(e) => { setOnlyUnrec(e.target.checked); setPage(1); }} />Só não conciliados</label>
        <span className="hidden md:block w-px h-8 bg-[hsl(var(--border))]" />
        <GlowButton tone="violet" onClick={reconcileScopedPaid} disabled={busy} className="py-2.5">{busy ? <Spinner className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}Conciliar concluídos</GlowButton>
      </section>

      <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-emerald-400/40 shadow-[0_0_30px_-12px_rgba(52,211,153,.5)] p-5 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-3 lg:w-[420px] shrink-0">
          <span className="w-12 h-12 rounded-xl grid place-items-center bg-sky-500/15 text-sky-400 ring-1 ring-sky-400/40"><Layers className="w-6 h-6" /></span>
          <div><h3 className="font-semibold text-lg">Progresso da conciliação</h3><p className="text-xs text-muted">Acompanhe o andamento da conferência dos lançamentos</p></div>
        </div>
        <div className="flex-1 h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(52,211,153,.7)] transition-all duration-700" style={{ width: `${progress}%` }} /></div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-display text-3xl font-extrabold px-4 py-2 rounded-2xl ring-1 ring-emerald-400/50 bg-emerald-500/10">{progress}%</span>
          <p className="text-sm leading-tight"><b>{recCount} de {scoped.length}</b><br /><span className="text-muted">lançamentos conciliados</span></p>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard tone="sky" icon={FileText} label="Lançamentos no filtro" value={scoped.length} />
        <StatCard tone="emerald" icon={CheckCircle2} label="Conciliados" value={recCount} />
        <StatCard tone="amber" icon={Clock} label="Pendentes de conciliar" value={pend} />
        <StatCard tone="rose" icon={AlertTriangle} label="Divergências" value={issues} sub={issues ? 'detalhes abaixo da tabela' : 'tudo certo'} />
      </div>

      <Panel tone="violet" glow title="Conferência de lançamentos" subtitle="Confira os lançamentos, marque como conciliado e trate as divergências" icon={ListChecks} iconClass="text-violet-400"
        action={<div className="flex flex-wrap items-center gap-2 justify-end">
          {sel.size > 0 && <GlowButton tone="emerald" onClick={reconcileSelected} disabled={busy} className="py-1.5"><Check className="w-4 h-4" />Conciliar {sel.size}</GlowButton>}
          {chip(Layers, <>Exibindo <b>{checklist.length}</b> lançamentos</>, 'ring-[hsl(var(--border))]')}
          {chip(CheckCircle2, `${recCount} conciliados`, 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-400/40')}
          {chip(Clock, `${pend} pendentes`, 'text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-amber-400/40')}
          {chip(AlertTriangle, `${issues} divergência${issues === 1 ? '' : 's'}`, 'text-rose-600 dark:text-rose-300 bg-rose-500/10 ring-rose-400/40')}
        </div>}>
        {checklist.length === 0 ? <EmptyState icon={CheckCircle2} title="Nada aqui" subtitle="Ajuste os filtros ou tudo já está conciliado." /> : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[820px]">
                <thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]">
                  <th className="py-2.5 px-2 w-8"><input type="checkbox" className="w-4 h-4 accent-violet-500" checked={allOnPage} onChange={toggleAll} aria-label="Selecionar página" /></th>
                  <th className="py-2.5 px-2 font-medium">Lançamento</th>
                  <th className="py-2.5 px-2 font-medium"><SortH k="date">Data</SortH></th>
                  <th className="py-2.5 px-2 font-medium"><SortH k="acc">Conta</SortH></th>
                  <th className="py-2.5 px-2 font-medium text-right"><SortH k="amount" className="justify-end">Valor</SortH></th>
                  <th className="py-2.5 px-2 font-medium">Status</th>
                  <th className="py-2.5 px-2 font-medium text-right">Ações</th>
                </tr></thead>
                <tbody>
                  {rows.map((t) => {
                    const done = !!t.reconciled; const [st, StIc, stCls] = statusOf(t); const a = accMap[t.account_id];
                    return (
                      <tr key={t.id} className={`border-b border-[hsl(var(--border))] last:border-0 transition ${sel.has(t.id) ? 'bg-violet-500/5' : done ? 'bg-emerald-500/[.04]' : ''}`}>
                        <td className="py-2.5 px-2"><input type="checkbox" className="w-4 h-4 accent-violet-500" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} aria-label="Selecionar" /></td>
                        <td className="py-2.5 px-2"><div className="flex items-center gap-3 min-w-0"><span className={`w-9 h-9 rounded-lg grid place-items-center text-white shrink-0 ${iconBg(t)}`}>{icon(t)}</span><div className="min-w-0"><p className="font-semibold truncate max-w-[260px]">{t.description || catMap[t.category_id]?.name || 'Lançamento'}</p><p className="text-xs text-muted truncate">{a?.name || '—'}{(t.status || 'pending') !== 'completed' && t.status != null && t.type !== 'transfer' ? ' · não pago' : ''}</p></div></div></td>
                        <td className="py-2.5 px-2 whitespace-nowrap"><span className="inline-flex items-center gap-1.5 text-muted"><CalendarDays className="w-4 h-4" />{fmtD(t)}</span></td>
                        <td className="py-2.5 px-2 whitespace-nowrap"><span className="inline-flex items-center gap-1.5 text-muted">{['credit_card', 'wallet'].includes(a?.account_type) ? <CreditCard className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}{a?.name || '—'}</span></td>
                        <td className={`py-2.5 px-2 text-right font-display font-bold whitespace-nowrap ${valCls(t)}`}>{formatCurrency(t.amount)}</td>
                        <td className="py-2.5 px-2"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${stCls}`}><StIc className="w-3.5 h-3.5" />{st}</span></td>
                        <td className="py-2.5 px-2"><div className="flex items-center justify-end gap-1.5">
                          {done
                            ? <button onClick={() => setReconciled.mutate({ id: t.id, reconciled: false })} title="Desfazer conciliação" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))] w-[104px] justify-center"><Check className="w-3.5 h-3.5" />Conciliado</button>
                            : <button onClick={() => setReconciled.mutate({ id: t.id, reconciled: true })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-emerald-400/60 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 w-[104px] justify-center"><Check className="w-3.5 h-3.5" />Conciliar</button>}
                          <KebabMenu items={[
                            done && { label: 'Desfazer conciliação', icon: Undo2, onClick: () => setReconciled.mutate({ id: t.id, reconciled: false }) },
                            (t.status || 'pending') !== 'completed' && t.status != null && t.type !== 'transfer' && { label: 'Marcar como pago', icon: CheckCircle2, onClick: () => markPaid.mutate(t.id) },
                            dupIds.has(t.id) && { label: 'Remover duplicado', icon: Trash2, danger: true, onClick: () => remove.mutate(t.id) },
                            !done && { label: 'Conciliar', icon: Check, onClick: () => setReconciled.mutate({ id: t.id, reconciled: true }) },
                          ]} />
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && <div className="flex items-center justify-between mt-3 flex-wrap gap-2"><span className="text-xs text-muted">Página {cur} de {pages}</span><Pager page={cur} pages={pages} onPage={setPage} /></div>}
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {overdue.length > 0 && (
          <Panel tone="amber" title={`Vencidos não pagos (${overdue.length})`} icon={AlertTriangle} iconClass="text-amber-400"
            action={<button onClick={() => bulk((id) => Transaction.update(id, { status: 'completed' }), overdue.map((t) => t.id), `${overdue.length} marcado(s) como pago(s).`)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg ring-1 ring-amber-400/50 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10">Marcar todos como pagos</button>}>
            <div className="divide-y divide-[hsl(var(--border))] max-h-72 overflow-y-auto">
              {overdue.slice(0, 30).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className={`w-8 h-8 rounded-lg grid place-items-center text-white shrink-0 ${iconBg(t)}`}>{icon(t)}</span>
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || catMap[t.category_id]?.name || 'Lançamento'}</p><p className="text-xs text-muted">{fmtD(t)} · {t.type === 'income' ? 'a receber' : 'a pagar'}</p></div>
                  <span className="font-semibold">{formatCurrency(t.amount)}</span>
                  <button onClick={() => markPaid.mutate(t.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10" title="Marcar pago"><Check className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {duplicates.length > 0 && (
          <Panel tone="rose" title={`Possíveis duplicados (${duplicates.length})`} subtitle="Mesmo valor e tipo, com datas próximas (até 3 dias). Confira antes de remover." icon={Copy} iconClass="text-rose-400">
            <div className="divide-y divide-[hsl(var(--border))] max-h-72 overflow-y-auto">
              {duplicates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.description || 'Lançamento'}</p><p className="text-xs text-muted">{fmtD(t)} · {accMap[t.account_id]?.name || ''}</p></div>
                  <span className="font-semibold">{formatCurrency(t.amount)}</span>
                  <button onClick={() => remove.mutate(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10" title="Remover duplicado"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {uncategorized.length > 0 && (
          <Panel tone="sky" title={`Sem categoria (${uncategorized.length})`} icon={Tag} iconClass="text-sky-400"
            action={<button onClick={autoCategorize} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ring-1 ring-sky-400/50 text-sky-600 dark:text-sky-300 hover:bg-sky-500/10">{busy ? <Spinner className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}Auto-categorizar</button>}>
            <p className="text-sm text-muted">Usa suas regras e o seu histórico local para inferir a categoria de cada lançamento (sem IA de terceiros).</p>
          </Panel>
        )}
        <Panel tone="emerald" title="Verificação de saldo por conta" icon={Scale} iconClass="text-emerald-400">
          <div className="divide-y divide-[hsl(var(--border))]">
            {balanceCheck.map((b) => (
              <div key={b.acc.id} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-lg shrink-0" style={{ background: b.acc.color || '#64748b' }} />
                <span className="flex-1 font-medium truncate">{b.acc.name}</span>
                <span className="text-xs text-muted hidden sm:inline">esperado {formatCurrency(b.expected)}</span>
                <span className="text-sm font-semibold">{formatCurrency(b.actual)}</span>
                {b.ok ? chip(Check, 'OK', 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-400/40') : chip(AlertTriangle, 'Divergente', 'text-rose-600 dark:text-rose-300 bg-rose-500/10 ring-rose-400/40')}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
