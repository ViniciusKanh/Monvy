import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { TransactionModal } from '../components/TransactionModal.jsx';
import { RecurrencesPanel } from '../components/transactions/RecurrencesPanel.jsx';
import { Button, Card, Input, Select, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { toast } from '../lib/toast.js';
import { exportTransactionsXlsx } from '../lib/exportXlsx.js';
import { exportReportToPdf } from '../lib/exportPdf.js';
import { formatCurrency, monthKey, monthLabel, monthRange, inMonth, todayIso } from '../lib/utils.js';
import {
  Plus, ChevronLeft, ChevronRight, Search, ArrowLeftRight, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  CircleCheck, Clock, Paperclip, Copy, CheckSquare, X, Pin, RefreshCw, Wand2, SlidersHorizontal, Repeat,
  FileSpreadsheet, FileText, CalendarRange,
} from 'lucide-react';

const TYPE_FILTERS = [['all', 'Tudo'], ['income', 'Receitas'], ['expense', 'Despesas'], ['transfer', 'Transferências']];
const STATUS_FILTERS = [['all', 'Todos'], ['pending', 'Em aberto'], ['completed', 'Concluídos']];
// filtros inteligentes: id -> [rótulo, predicado]
const SMART = [
  ['fixed', 'Fixos', (t) => t.is_fixed],
  ['recurring', 'Recorrentes', (t) => t.parent_transaction_id || (t.recurrence && t.recurrence !== 'none')],
  ['nocat', 'Sem categoria', (t) => t.type !== 'transfer' && !t.category_id],
  ['receipt', 'Com comprovante', (t) => !!t.receipt_url],
];

export default function Transactions() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mk, setMk] = useState(monthKey(new Date()));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [smart, setSmart] = useState(null);
  const [modal, setModal] = useState(false);
  const [defaultType, setDefaultType] = useState('expense');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [advOpen, setAdvOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [customRange, setCustomRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [recurOpen, setRecurOpen] = useState(false);
  const [recurEditing, setRecurEditing] = useState(null);
  const pageRef = useRef(null);

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const months = useMemo(() => monthRange(11, 4), []);

  const inval = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); };
  const markStatus = useMutation({ mutationFn: ({ id, status }) => Transaction.update(id, { status }), onSuccess: inval });
  const save = useMutation({ mutationFn: (p) => editing ? Transaction.update(editing.id, p) : Transaction.create(p), onSuccess: () => { inval(); setModal(false); setEditing(null); } });
  const del = useMutation({ mutationFn: (id) => Transaction.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const dup = useMutation({
    mutationFn: (t) => Transaction.create({ type: t.type, date: todayIso(), amount: Number(t.amount), description: t.description, account_id: t.account_id, account_to_id: t.account_to_id || null, category_id: t.category_id || null, is_fixed: !!t.is_fixed, recurrence: t.recurrence || 'none', status: 'pending' }),
    onSuccess: () => { inval(); toast.success('Lançamento duplicado para hoje, em aberto.'); },
  });

  // Periodo base: mes selecionado no hero, OU um intervalo de datas livre
  // (filtro avancado) quando ativado — os dois nunca se combinam.
  const monthTx = useMemo(() => transactions.filter((t) => inMonth(t.date, mk)), [transactions, mk]);
  const rangeTx = useMemo(() => {
    if (!customRange || !rangeFrom || !rangeTo) return null;
    return transactions.filter((t) => String(t.date).slice(0, 10) >= rangeFrom && String(t.date).slice(0, 10) <= rangeTo);
  }, [transactions, customRange, rangeFrom, rangeTo]);
  const baseTx = rangeTx ?? monthTx;
  const smartFn = SMART.find((s) => s[0] === smart)?.[2];
  const filtered = useMemo(() => baseTx.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    const st = t.status || 'pending';
    if (statusFilter === 'pending' && st !== 'pending') return false;
    if (statusFilter === 'completed' && st !== 'completed') return false;
    if (smartFn && !smartFn(t)) return false;
    if (accountFilter !== 'all' && t.account_id !== accountFilter && t.account_to_id !== accountFilter) return false;
    if (amountMin !== '' && Number(t.amount) < Number(amountMin)) return false;
    if (amountMax !== '' && Number(t.amount) > Number(amountMax)) return false;
    if (search) { const q = search.toLowerCase(); const cat = catMap[t.category_id]?.name?.toLowerCase() || ''; if (!(t.description || '').toLowerCase().includes(q) && !cat.includes(q)) return false; }
    return true;
  }).sort((a, b) => (a.date < b.date ? 1 : -1)), [baseTx, typeFilter, statusFilter, smartFn, accountFilter, amountMin, amountMax, search, catMap]);
  const advActive = accountFilter !== 'all' || amountMin !== '' || amountMax !== '' || customRange;

  const totals = useMemo(() => {
    let inc = 0, exp = 0, pend = 0;
    for (const t of monthTx) {
      if (t.type === 'income') inc += Number(t.amount);
      if (t.type === 'expense') exp += Number(t.amount);
      if (t.type !== 'transfer' && (t.status || 'pending') !== 'completed') pend += Number(t.amount);
    }
    return { inc, exp, bal: inc - exp, pend };
  }, [monthTx]);
  const incExpMax = Math.max(totals.inc, totals.exp, 1);

  // saldo acumulado do mês por dia (ordem cronológica), para a coluna-guia
  const cumByDay = useMemo(() => {
    const days = [...new Set(filtered.map((t) => t.date.slice(0, 10)))].sort();
    const map = {}; let run = 0;
    for (const d of days) {
      for (const t of filtered.filter((x) => x.date.slice(0, 10) === d)) run += t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0;
      map[d] = run;
    }
    return map;
  }, [filtered]);

  const grouped = useMemo(() => { const g = {}; for (const t of filtered) { const d = t.date.slice(0, 10); (g[d] = g[d] || []).push(t); } return g; }, [filtered]);
  const shiftMonth = (d) => { const [y, m] = mk.split('-').map(Number); setMk(monthKey(new Date(y, m - 1 + d, 1))); };
  const openNew = (type) => { setEditing(null); setDefaultType(type); setModal(true); };
  // abre direto no tipo pedido quando chega de um atalho (ex.: ações rápidas da tela Contas)
  useEffect(() => {
    const novo = searchParams.get('novo');
    if (novo === 'transfer' || novo === 'income' || novo === 'expense') {
      openNew(novo);
      const next = new URLSearchParams(searchParams); next.delete('novo'); setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dayNet = (items) => items.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0), 0);

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => { setSel(new Set()); setSelMode(false); };
  const bulkPay = async () => { const ids = [...sel]; for (const id of ids) { const t = transactions.find((x) => x.id === id); if (t && t.type !== 'transfer') await Transaction.update(id, { status: 'completed' }); } inval(); toast.success(`${ids.length} lançamento(s) marcados como concluídos.`); clearSel(); };
  const bulkDelete = async () => { const ids = [...sel]; for (const id of ids) await Transaction.remove(id); inval(); toast.success(`${ids.length} lançamento(s) excluídos.`); clearSel(); };
  const selValue = [...sel].reduce((s, id) => { const t = transactions.find((x) => x.id === id); return s + (t && t.type !== 'transfer' ? Number(t.amount) : 0); }, 0);

  const doExportXlsx = () => exportTransactionsXlsx(filtered, { accMap, catMap, periodLabel: customRange ? `${rangeFrom} a ${rangeTo}` : monthLabel(mk), filename: `monvy-lancamentos-${customRange ? `${rangeFrom}_${rangeTo}` : mk}.xlsx` });
  const doExportPdf = () => exportReportToPdf(pageRef.current, { filename: `monvy-lancamentos-${customRange ? `${rangeFrom}_${rangeTo}` : mk}.pdf`, title: 'Lançamentos', subtitle: customRange ? `Período de ${rangeFrom} a ${rangeTo}` : monthLabel(mk) });

  return (
    <div className="animate-fadeIn pb-24" ref={pageRef}>
      <div className="print:hidden">
        <PageHeader title="Lançamentos" subtitle="Receitas, despesas e transferências"
          actions={<>
            <Button variant="outline" onClick={() => setRecurOpen(true)}><Repeat className="w-4 h-4 text-indigo-500" /> Recorrências</Button>
            <div className="relative group">
              <Button variant="outline"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Exportar</Button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block group-focus-within:block z-20 min-w-[11rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
                <button onClick={doExportXlsx} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel (.xlsx)</button>
                <button onClick={doExportPdf} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileText className="w-4 h-4 text-rose-500" /> PDF</button>
              </div>
            </div>
            <Button variant="outline" onClick={() => setAdvOpen((v) => !v)} className={advActive ? 'text-indigo-600 border-indigo-500' : ''}><SlidersHorizontal className="w-4 h-4" /> Filtros</Button>
            <Button variant="outline" onClick={() => { setSelMode((v) => !v); setSel(new Set()); }} className={selMode ? 'text-emerald-600 border-emerald-500' : ''}><CheckSquare className="w-4 h-4" /> {selMode ? 'Cancelar' : 'Selecionar'}</Button>
            <Button variant="outline" onClick={() => openNew('transfer')}><ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Transferir</Button>
            <Button variant="outline" onClick={() => openNew('income')}><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Receita</Button>
            <Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Despesa</Button>
          </>} />
      </div>

      {/* Hero do mês — resumo do movimento */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10 mb-5 print:text-slate-900 print:bg-none print:ring-0" style={{ background: 'linear-gradient(135deg,#080d1f,#0d1433 55%,#111b3f)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,.28), transparent 68%)' }} />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1 py-1 backdrop-blur">
              <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
              <select value={mk} onChange={(e) => setMk(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer px-1 capitalize [&>option]:text-slate-800">{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
              <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
            </div>
            {totals.pend > 0 && <button onClick={() => setStatusFilter('pending')} className="text-xs flex items-center gap-1 bg-amber-500/15 text-amber-200 px-3 py-1.5 rounded-full ring-1 ring-amber-500/20 hover:bg-amber-500/25"><Clock className="w-3.5 h-3.5" /> {formatCurrency(totals.pend)} em aberto</button>}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5">
            <button onClick={() => setTypeFilter(typeFilter === 'income' ? 'all' : 'income')} className="text-left group">
              <p className="text-xs text-emerald-300 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Entrou</p>
              <p className="font-display text-xl sm:text-2xl font-bold mt-0.5 group-hover:opacity-80"><AnimatedValue value={totals.inc} format={formatCurrency} /></p>
            </button>
            <button onClick={() => setTypeFilter(typeFilter === 'expense' ? 'all' : 'expense')} className="text-left group">
              <p className="text-xs text-rose-300 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5" /> Saiu</p>
              <p className="font-display text-xl sm:text-2xl font-bold mt-0.5 group-hover:opacity-80"><AnimatedValue value={totals.exp} format={formatCurrency} /></p>
            </button>
            <div><p className="text-xs text-slate-300">Resultado</p><p className={`font-display text-xl sm:text-2xl font-bold mt-0.5 ${totals.bal < 0 ? 'text-rose-300' : 'text-white'}`}><AnimatedValue value={totals.bal} format={formatCurrency} /></p></div>
          </div>
          <div className="flex gap-1 mt-4 h-2 rounded-full overflow-hidden bg-white/10">
            <div className="bg-emerald-400 transition-all" style={{ width: `${(totals.inc / incExpMax) * 50}%` }} />
            <div className="bg-rose-400 transition-all" style={{ width: `${(totals.exp / incExpMax) * 50}%` }} />
          </div>
        </div>
      </div>

      {/* Painel de filtros avançados */}
      {advOpen && (
        <Card className="mb-3 p-4 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Filtros avançados</p>
            {advActive && <button onClick={() => { setAccountFilter('all'); setAmountMin(''); setAmountMax(''); setCustomRange(false); setRangeFrom(''); setRangeTo(''); }} className="text-xs text-muted hover:text-rose-500">limpar</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Conta</label>
              <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="all">Todas as contas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Valor mínimo</label>
              <Input type="number" step="0.01" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Valor máximo</label>
              <Input type="number" step="0.01" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Sem limite" />
            </div>
            <div>
              <label className="text-xs text-muted flex items-center gap-1.5 mb-1"><CalendarRange className="w-3.5 h-3.5" /> Período personalizado</label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer mb-1">
                <input type="checkbox" checked={customRange} onChange={(e) => setCustomRange(e.target.checked)} /> usar intervalo de datas
              </label>
              {customRange && (
                <div className="flex gap-1.5">
                  <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                  <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Busca + filtros */}
      <div className="flex flex-col md:flex-row gap-3 mb-3 print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição ou categoria" className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
            {TYPE_FILTERS.map(([v, l]) => <button key={v} onClick={() => setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${typeFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
          </div>
          <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
            {STATUS_FILTERS.map(([v, l]) => <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${statusFilter === v ? 'bg-[hsl(var(--card))] shadow text-[hsl(var(--text))]' : 'text-muted'}`}>{l}</button>)}
          </div>
        </div>
      </div>
      {/* filtros inteligentes */}
      <div className="flex flex-wrap gap-2 mb-5 print:hidden">
        {SMART.map(([id, label]) => {
          const active = smart === id;
          return <button key={id} onClick={() => setSmart(active ? null : id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-[hsl(var(--border))] text-muted hover:bg-black/5 dark:hover:bg-white/5'}`}>
            {id === 'fixed' && <Pin className="w-3 h-3" />}{id === 'recurring' && <RefreshCw className="w-3 h-3" />}{id === 'nocat' && <Wand2 className="w-3 h-3" />}{id === 'receipt' && <Paperclip className="w-3 h-3" />}
            {label}
          </button>;
        })}
        {(smart || typeFilter !== 'all' || statusFilter !== 'all' || search) && <button onClick={() => { setSmart(null); setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }} className="text-xs text-muted hover:text-rose-500 px-2">limpar filtros</button>}
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        : filtered.length === 0 ? <Card><EmptyState icon={ArrowLeftRight} title="Nenhum lançamento" subtitle="Adicione uma receita ou despesa neste mês, ou ajuste os filtros." action={<Button onClick={() => openNew('expense')}><Plus className="w-4 h-4" /> Novo lançamento</Button>} /></Card>
        : (
          <div className="relative pl-4 sm:pl-6">
            {/* trilha vertical do razão */}
            <span className="absolute left-[7px] sm:left-[11px] top-2 bottom-2 w-px bg-[hsl(var(--border))]" aria-hidden />
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, items], gi) => {
                const net = dayNet(items);
                const cum = cumByDay[date];
                return (
                  <Reveal key={date} i={Math.min(gi, 6)}>
                    <div className="relative">
                      {/* marcador do dia */}
                      <span className="absolute -left-4 sm:-left-6 top-1.5 w-[15px] h-[15px] rounded-full bg-[hsl(var(--card))] border-2 border-emerald-500" aria-hidden />
                      <div className="flex items-end justify-between mb-2 gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold capitalize leading-tight">{new Date(date + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                          <p className="text-[11px] text-muted">saldo acumulado no mês: <b className={cum < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}>{formatCurrency(cum)}</b></p>
                        </div>
                        <span className={`text-sm font-semibold font-display ${net < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</span>
                      </div>
                      <Card className="p-0 divide-y divide-[hsl(var(--border))] overflow-hidden">
                        {items.map((t) => {
                          const cat = catMap[t.category_id];
                          const isInc = t.type === 'income'; const isTransfer = t.type === 'transfer';
                          const pend = !isTransfer && (t.status || 'pending') !== 'completed';
                          const checked = sel.has(t.id);
                          return (
                            <div key={t.id} onClick={selMode ? () => toggleSel(t.id) : undefined}
                              className={`group flex items-center gap-3 px-4 py-3 transition ${selMode ? 'cursor-pointer' : ''} ${checked ? 'bg-indigo-500/10' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'}`}>
                              {selMode && <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-[hsl(var(--border))]'}`}>{checked && <CircleCheck className="w-3.5 h-3.5" />}</span>}
                              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: isTransfer ? '#6366f1' : (cat?.color || (isInc ? '#10b981' : '#f43f5e')) }}>
                                {isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : isInc ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{t.description || cat?.name || (isTransfer ? 'Transferência' : 'Lançamento')}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
                                  <span className="truncate">{isTransfer ? `${accMap[t.account_id]?.name || ''} para ${accMap[t.account_to_id]?.name || ''}` : (cat?.name || 'Sem categoria')}</span>
                                  {t.is_fixed && <Badge color="blue">Fixo</Badge>}
                                  {t.parent_transaction_id && <Badge color="amber">Recorrente</Badge>}
                                  {!isTransfer && (pend ? <Badge color="amber">{isInc ? 'A receber' : 'A pagar'}</Badge> : <Badge color="emerald">{isInc ? 'Recebido' : 'Pago'}</Badge>)}
                                  {t.receipt_url && <button onClick={(e) => { e.stopPropagation(); setViewReceipt(t.receipt_url); }} className="inline-flex items-center gap-0.5 text-[11px] text-sky-500 font-medium hover:underline"><Paperclip className="w-3 h-3" /> comprovante</button>}
                                </div>
                              </div>
                              <p className={`font-semibold font-display shrink-0 ${isInc ? 'text-emerald-500' : isTransfer ? 'text-indigo-500' : 'text-rose-500'} ${pend ? 'opacity-70' : ''}`}>{isInc ? '+' : isTransfer ? '' : '-'}{formatCurrency(t.amount)}</p>
                              {!selMode && (
                                <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition">
                                  {pend && <button title="Marcar como pago/recebido" onClick={() => markStatus.mutate({ id: t.id, status: 'completed' })} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CircleCheck className="w-4 h-4" /></button>}
                                  <button title="Duplicar para hoje" onClick={() => dup.mutate(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
                                  <button title="Editar" onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                                  <button title="Excluir" onClick={() => setToDelete(t)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Card>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        )}

      {/* Barra de ações em lote */}
      {selMode && sel.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl print:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl animate-[popIn_.2s_ease]">
            <span className="text-sm font-semibold px-1">{sel.size} selecionado(s)</span>
            <span className="text-xs text-muted hidden sm:inline">· {formatCurrency(selValue)}</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={bulkPay}><CircleCheck className="w-4 h-4 text-emerald-500" /> Marcar pago</Button>
            <Button size="sm" variant="outline" className="text-rose-500" onClick={bulkDelete}><Trash2 className="w-4 h-4" /> Excluir</Button>
            <button onClick={clearSel} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {recurOpen && (
        <RecurrencesPanel
          transactions={transactions}
          accMap={accMap}
          catMap={catMap}
          onClose={() => setRecurOpen(false)}
          onEdit={(p) => { setRecurOpen(false); setEditing(p); setModal(true); }}
        />
      )}

      <TransactionModal open={modal} onClose={() => { setModal(false); setEditing(null); }} onSubmit={(p) => save.mutate(p)} saving={save.isPending} accounts={accounts} categories={categories} transactions={transactions} initial={editing} defaultType={defaultType} />

      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Comprovante" maxWidth="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => window.open(viewReceipt, '_blank')}>Abrir em nova aba</Button><Button onClick={() => setViewReceipt(null)}>Fechar</Button></>}>
        {viewReceipt && (viewReceipt.startsWith('data:application/pdf') || viewReceipt.includes('.pdf')
          ? <iframe title="comprovante" src={viewReceipt} className="w-full h-[60vh] rounded-lg border border-[hsl(var(--border))]" />
          : <img src={viewReceipt} alt="Comprovante" className="w-full rounded-lg" />)}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir lançamento" maxWidth="max-w-md"
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate(toDelete.id)} disabled={del.isPending}>{del.isPending ? <Spinner className="w-4 h-4" /> : 'Excluir'}</Button></>}>
        <p className="text-sm text-muted">Tem certeza? O saldo da conta será recalculado automaticamente.</p>
      </Modal>
    </div>
  );
}
