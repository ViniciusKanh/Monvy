import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Debt, BankRate, Transaction } from '../api/entities.js';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal } from '../components/Animated.jsx';
import { LoadingScreen } from '../components/Splash.jsx';
import { HeroTitle, MetricStrip, Metric, Gauge, Panel, Donut, Bar, KebabMenu, GlowButton, InsightsPanel, TIP, pct1 } from '../components/kit.jsx';
import { CardArt, DocCheckArt } from '../components/art/PageArt.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { analyzeCredit, subtiposDe, rulesFor, STATUS_META, INDEXERS, toMonthly, effectiveMonthly, BANK_PRESETS } from '../lib/credit.js';
import { fetchMarketRate, amToAa } from '../lib/bcbRates.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Landmark, Plus, Pencil, Trash2, CheckCircle2, Table, Zap, Calculator, Building2, Download, XCircle, AlertTriangle, Gauge as GaugeIcon, ScrollText, Wallet, Sparkles,
  Coins, CalendarDays, Percent, Info, Heart, LayoutGrid, List, ShieldCheck, Target, TrendingUp, Layers, Handshake, BarChart3, Play, PieChart as PieIcon, LineChart as LineIcon,
} from 'lucide-react';

const TYPES = [
  { v: 'emprestimo', label: 'Empréstimo', color: '#22d3ee' },
  { v: 'financiamento', label: 'Financiamento', color: '#f59e0b' },
  { v: 'cartao', label: 'Cartão parcelado', color: '#38bdf8' },
  { v: 'consorcio', label: 'Consórcio', color: '#34d399' },
  { v: 'outro', label: 'Outros', color: '#a855f7' },
];
const tInfo = (v) => TYPES.find((t) => t.v === v) || TYPES[TYPES.length - 1];
const tLabel = (v) => tInfo(v).label;
const priceInstallment = (P, iPct, n) => { const i = Number(iPct) / 100; if (!P || !n) return 0; if (i === 0) return P / n; return (P * i) / (1 - Math.pow(1 + i, -n)); };
const balanceAfter = (inst, iPct, remaining) => { const i = Number(iPct) / 100; if (remaining <= 0) return 0; if (i === 0) return inst * remaining; return inst * (1 - Math.pow(1 + i, -remaining)) / i; };
const empty = { name: '', type: 'financiamento', principal: '', interest_rate: '1.5', installments: '12', paid_installments: '0', start_date: todayIso(), due_day: '10', institution: '' };
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SORTS = [['recent', 'Mais recente'], ['balance', 'Maior saldo'], ['rate', 'Maior juros'], ['progress', 'Mais perto de quitar']];

const KINDS = [
  { v: 'imovel', label: 'Financiamento imobiliário' },
  { v: 'veiculo', label: 'Financiamento de veículo' },
  { v: 'pessoal', label: 'Empréstimo pessoal' },
  { v: 'consignado', label: 'Empréstimo consignado' },
];
const LS_SIM = 'monvy_credit_sim_v1';
const loadSim = () => { try { return JSON.parse(localStorage.getItem(LS_SIM) || 'null'); } catch { return null; } };

// Score de endividamento: 100 sem parcelas; cai conforme a parcela mensal ocupa a renda (50% ou mais = 0)
const debtScore = (monthly, renda) => (monthly <= 0 ? 100 : renda > 0 ? Math.max(0, Math.round(100 * (1 - Math.min(1, monthly / renda / 0.5)))) : null);
const scoreLabel = (s) => (s == null ? ['Sem renda registrada', 'text-muted', 'bg-black/5 dark:bg-white/5 ring-[hsl(var(--border))]'] : s >= 80 ? ['Saúde excelente', 'text-emerald-600 dark:text-emerald-300', 'bg-emerald-500/15 ring-emerald-400/50'] : s >= 60 ? ['Saúde boa', 'text-cyan-600 dark:text-cyan-300', 'bg-cyan-500/15 ring-cyan-400/50'] : s >= 40 ? ['Atenção', 'text-amber-600 dark:text-amber-300', 'bg-amber-500/15 ring-amber-400/50'] : ['Situação crítica', 'text-rose-600 dark:text-rose-300', 'bg-rose-500/15 ring-rose-400/50']);

export default function Debts() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: banks = [] } = useQuery({ queryKey: ['bankrates'], queryFn: () => BankRate.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [tab, setTab] = useState('lista');
  const [simKey, setSimKey] = useState(0);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [schedule, setSchedule] = useState(null);
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('list');
  const [toDelete, setToDelete] = useState(null);
  const [q, setQ] = useState({ valor: '20000', juros: '0.8', prazo: '24' });

  const inval = () => qc.invalidateQueries({ queryKey: ['debts'] });
  const save = useMutation({ mutationFn: (p) => editing ? Debt.update(editing.id, p) : Debt.create(p), onSuccess: () => { inval(); setModal(false); toast.success(editing ? 'Dívida atualizada' : 'Dívida cadastrada'); } });
  const del = useMutation({ mutationFn: (id) => Debt.remove(id), onSuccess: () => { inval(); setToDelete(null); } });
  const pay = useMutation({ mutationFn: ({ d }) => Debt.update(d.id, { paid_installments: Math.min(Number(d.installments || 1), Number(d.paid_installments || 0) + 1) }), onSuccess: () => { inval(); toast.success('Parcela registrada'); } });

  const withCalc = useMemo(() => debts.map((d) => {
    const principal = Number(d.principal || d.total_amount || 0);
    const inst = Number(d.installment_amount || priceInstallment(principal, d.interest_rate, Number(d.installments || 1)));
    const n = Number(d.installments || 1); const paid = Number(d.paid_installments || 0); const remaining = Math.max(0, n - paid);
    const balance = balanceAfter(inst, d.interest_rate, remaining);
    const total = inst * n; const interestTotal = total - principal;
    return { ...d, principal, inst, n, paid, remaining, balance, total, interestTotal, rate: Number(d.interest_rate || 0), pct: n ? Math.round((paid / n) * 100) : 0 };
  }), [debts]);
  const active = withCalc.filter((d) => d.remaining > 0);

  const totalOwed = active.reduce((s, d) => s + d.balance, 0);
  const monthly = active.reduce((s, d) => s + d.inst, 0);
  const interestAll = withCalc.reduce((s, d) => s + Math.max(0, d.interestTotal), 0);
  const avgRate = totalOwed > 0 ? active.reduce((s, d) => s + d.rate * d.balance, 0) / totalOwed : 0;

  // renda mensal estimada (mediana das receitas por mês)
  const rendaEstimada = useMemo(() => {
    const byMonth = {};
    for (const t of transactions) if (t.type === 'income') { const m = String(t.date).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + Number(t.amount || 0); }
    const vals = Object.values(byMonth).sort((a, b) => a - b);
    if (!vals.length) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }, [transactions]);
  const commitPct = rendaEstimada > 0 ? (monthly / rendaEstimada) * 100 : null;
  const score = debtScore(monthly, rendaEstimada);
  const [scoreTxt, scoreCls, scoreBg] = scoreLabel(score);

  // evolução: % do valor total (parcelas) já pago ao fim de cada mês, considerando parcelas em dia desde o início
  const evolution = useMemo(() => {
    const now = new Date(); const out = [];
    const tot = withCalc.reduce((s, d) => s + d.total, 0);
    for (let k = 5; k >= 0; k--) {
      const end = new Date(now.getFullYear(), now.getMonth() - k + 1, 0);
      let paidV = 0;
      for (const d of withCalc) {
        const st = new Date(`${String(d.start_date || todayIso()).slice(0, 10)}T12:00:00`);
        const elapsed = Math.max(0, (end.getFullYear() - st.getFullYear()) * 12 + end.getMonth() - st.getMonth() + 1);
        const shift = Math.max(0, (now.getFullYear() - end.getFullYear()) * 12 + now.getMonth() - end.getMonth());
        const paidThen = Math.max(0, Math.min(d.paid - shift, elapsed, d.n));
        paidV += paidThen * d.inst;
      }
      out.push({ name: MES[end.getMonth()], pct: tot > 0 ? Math.round((paidV / tot) * 1000) / 10 : 0 });
    }
    return out;
  }, [withCalc]);
  const paidNow = evolution.length ? evolution[evolution.length - 1].pct : 0;

  const composition = useMemo(() => TYPES.map((t) => ({ ...t, name: t.label, value: active.filter((d) => tInfo(d.type).v === t.v).reduce((s, d) => s + d.balance, 0) })), [active]);

  const sorted = useMemo(() => {
    const a = [...withCalc];
    if (sort === 'balance') a.sort((x, y) => y.balance - x.balance);
    else if (sort === 'rate') a.sort((x, y) => y.rate - x.rate);
    else if (sort === 'progress') a.sort((x, y) => (x.remaining === 0) - (y.remaining === 0) || y.pct - x.pct);
    else a.sort((x, y) => String(y.start_date || y.created_date || '').localeCompare(String(x.start_date || x.created_date || '')));
    return a;
  }, [withCalc, sort]);

  const qParcela = priceInstallment(Number(q.valor || 0), q.juros, Number(q.prazo || 1));
  const qImpact = rendaEstimada > 0 ? (qParcela / rendaEstimada) * 100 : null;
  const simular = () => {
    const prev = loadSim() || {};
    try { localStorage.setItem(LS_SIM, JSON.stringify({ ...prev, tipo: 'pessoal', subtipo: subtiposDe('pessoal')[0]?.key || '', valorEmprestimo: String(q.valor || ''), prazo: String(q.prazo || ''), taxaMes: String(q.juros || ''), indexer: 'prefixado', sistema: 'price' })); } catch { /* */ }
    setSimKey((k) => k + 1); setTab('sim');
  };

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, type: d.type, principal: d.principal ?? d.total_amount ?? '', interest_rate: d.interest_rate ?? '0', installments: d.installments ?? '12', paid_installments: d.paid_installments ?? '0', start_date: (d.start_date || todayIso()).slice(0, 10), due_day: d.due_day ?? '10', institution: d.institution || '' }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const formInst = priceInstallment(Number(form.principal || 0), form.interest_rate, Number(form.installments || 1));
  const submit = (e) => {
    e?.preventDefault?.();
    if (!String(form.name).trim()) { toast.error('Informe o nome da dívida'); return; }
    const principal = Number(form.principal || 0); const n = Number(form.installments || 1);
    const inst = priceInstallment(principal, form.interest_rate, n);
    save.mutate({ name: form.name, type: form.type, principal, total_amount: inst * n, interest_rate: Number(form.interest_rate || 0), installments: n, paid_installments: Number(form.paid_installments || 0), installment_amount: inst, start_date: form.start_date, due_day: Number(form.due_day || 10), institution: form.institution });
  };

  const buildSchedule = (d) => {
    const rows = []; let bal = d.principal; const i = d.rate / 100;
    for (let k = 1; k <= d.n; k++) { const juros = bal * i; const amort = d.inst - juros; bal = Math.max(0, bal - amort); rows.push({ k, juros, amort, saldo: bal, paga: k <= d.paid }); }
    setSchedule({ name: d.name, inst: d.inst, rows });
  };

  const insights = [];
  if (active.length > 1) insights.push({ tone: 'violet', icon: Layers, title: 'Consolide suas dívidas', text: `${active.length} contratos ativos com taxa média de ${avgRate.toFixed(2).replace('.', ',')}% a.m. Unificar só compensa se a nova taxa for menor.`, onClick: () => setTab('sim') });
  const topRate = [...active].sort((a, b) => b.rate - a.rate)[0];
  if (topRate && topRate.rate > 0) insights.push({ tone: 'pink', icon: Handshake, title: 'Negocie melhores condições', text: `${topRate.name} tem os maiores juros (${topRate.rate.toFixed(2).replace('.', ',')}% a.m.). Pergunte sobre portabilidade ou amortização antecipada.`, onClick: () => nav('/quitacao') });
  if (!active.length) insights.push({ tone: 'emerald', icon: ShieldCheck, title: 'Você não possui dívidas ativas', text: 'Um bom momento para reforçar a reserva de emergência.', onClick: () => nav('/reserva') });
  insights.push({ tone: 'sky', icon: BarChart3, title: 'Impacto no orçamento', text: qImpact != null ? `Uma nova dívida de ${formatCurrency(Number(q.valor || 0))} pode comprometer ~${pct1(qImpact)} da sua renda mensal por ${q.prazo} meses.` : `A parcela simulada seria ${formatCurrency(qParcela)}. Registre receitas para ver o peso na sua renda.`, onClick: simular });
  if (!active.length) insights.push({ tone: 'amber', icon: Target, title: 'Planeje antes de contratar', text: 'Use o simulador para comparar prazo, juros e custo total antes de assinar.', onClick: () => setTab('sim') });

  if (isLoading) return <LoadingScreen label="Carregando suas dívidas e simulações..." />;

  const DebtActions = ({ d }) => <KebabMenu items={[{ label: 'Tabela de amortização', icon: Table, onClick: () => buildSchedule(d) }, d.remaining > 0 && { label: 'Paguei 1 parcela', icon: CheckCircle2, onClick: () => pay.mutate({ d }) }, { label: 'Editar', icon: Pencil, onClick: () => openEdit(d) }, { label: 'Excluir', icon: Trash2, danger: true, onClick: () => setToDelete(d) }]} />;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Landmark} lead="Dívidas &" accent="Crédito" iconClass="text-fuchsia-400" subtitle="Controle o que deve, simule um financiamento e mantenha sua saúde financeira em dia." art={<CardArt className="w-80 h-36 xl:mr-24" />} />

      {/* Faixa de métricas + score */}
      <MetricStrip className="sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.35fr]">
        <Metric icon={Coins} color="#c084fc" label="Total das dívidas" value={formatCurrency(totalOwed)} sub={<><b className="text-fuchsia-500 dark:text-fuchsia-300">{active.length}</b> {active.length === 1 ? 'dívida ativa' : 'dívidas ativas'}</>} />
        <Metric icon={CalendarDays} color="#38bdf8" label="Comprometimento mensal" value={formatCurrency(monthly)} sub={commitPct != null ? `${pct1(commitPct)} da sua renda estimada` : 'registre receitas para comparar com a renda'} />
        <Metric icon={Percent} color="#e879f9" label="Juros totais (contratos)" value={formatCurrency(interestAll)} sub={`Taxa média: ${avgRate.toFixed(2).replace('.', ',')}% a.m.`} />
        <div className="flex items-center gap-4 sm:px-5 min-w-0">
          <div>
            <p className="text-sm text-muted flex items-center gap-1.5 whitespace-nowrap">Score de endividamento <span className="group relative"><Info className="w-3.5 h-3.5 cursor-help" /><span className="hidden group-hover:block absolute left-0 top-5 z-30 w-64 rounded-xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] p-3 text-xs shadow-xl">100 = sem parcelas. Cai conforme as parcelas ocupam sua renda mensal estimada; com 50% ou mais da renda comprometida chega a 0.</span></span></p>
            <Gauge value={score} size={140} label="/100" />
          </div>
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ring-1 text-xs font-bold ${scoreBg} ${scoreCls}`}><Heart className="w-3.5 h-3.5" />{scoreTxt}</span>
            <p className="text-xs text-muted mt-2 leading-snug">{!active.length ? 'Você não possui dívidas no momento. Mantenha esse bom controle!' : commitPct == null ? 'Cadastre suas receitas para medir o peso das parcelas.' : `As parcelas ocupam ${pct1(commitPct)} da sua renda.`}</p>
          </div>
        </div>
      </MetricStrip>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-5 min-w-0">
          {/* Abas + Nova dívida */}
          <div className="flex flex-wrap items-center gap-3">
            {[['lista', 'Minhas dívidas', Landmark], ['sim', 'Simulador de crédito', Calculator]].map(([id, label, Ic]) => (
              <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ring-1 transition ${tab === id ? 'bg-gradient-to-r from-cyan-500/25 to-sky-500/15 ring-cyan-400/60 text-cyan-700 dark:text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.25)]' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))] bg-[hsl(var(--card))]'}`}><Ic className="w-4 h-4" />{label}</button>
            ))}
            <GlowButton tone="pink" onClick={openNew} className="ml-auto"><Plus className="w-4 h-4" />Nova dívida</GlowButton>
          </div>

          {tab === 'lista' && (<>
            <Panel title={`Minhas dívidas (${withCalc.length})`} icon={Landmark} iconClass="text-violet-400" action={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted rounded-lg ring-1 ring-[hsl(var(--border))] px-2.5 py-1.5">Ordenar por:
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-[hsl(var(--text))] font-semibold outline-none">{SORTS.map(([v, l]) => <option key={v} value={v} className="bg-[hsl(var(--card))]">{l}</option>)}</select>
                </label>
                <div className="flex rounded-lg ring-1 ring-[hsl(var(--border))] p-0.5">
                  <button onClick={() => setView('list')} aria-label="Lista" className={`p-1.5 rounded-md ${view === 'list' ? 'bg-cyan-500/20 text-cyan-500' : 'text-muted'}`}><List className="w-4 h-4" /></button>
                  <button onClick={() => setView('grid')} aria-label="Cards" className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-cyan-500/20 text-cyan-500' : 'text-muted'}`}><LayoutGrid className="w-4 h-4" /></button>
                </div>
              </div>}>
              {withCalc.length === 0 ? (
                <div className="text-center py-2">
                  <DocCheckArt className="w-56 h-28 mx-auto" />
                  <p className="font-display text-xl font-bold mt-1">Nenhuma dívida cadastrada</p>
                  <p className="text-sm text-muted max-w-md mx-auto mt-1">Cadastre empréstimos, financiamentos, parcelamentos ou outras dívidas para acompanhar o quanto falta pagar e organizar sua quitação.</p>
                  <GlowButton tone="aurora" onClick={openNew} className="mt-4 px-8"><Plus className="w-4 h-4" />Nova dívida</GlowButton>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 text-left">
                    {[[ShieldCheck, 'Controle total', 'Acompanhe cada dívida', openNew], [Target, 'Planeje a quitação', 'Defina prioridades', () => nav('/quitacao')], [Percent, 'Simule crédito', 'Compare condições', () => setTab('sim')], [TrendingUp, 'Melhore seu score', 'Entenda seu crédito', () => nav('/score')]].map(([Ic, t, s, fn]) => (
                      <button key={t} onClick={fn} className="flex items-center gap-2.5 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-2.5 hover:ring-violet-400/50 transition"><Ic className="w-6 h-6 text-violet-400 shrink-0" /><span className="min-w-0"><span className="block text-xs font-semibold truncate">{t}</span><span className="block text-[11px] text-muted truncate">{s}</span></span></button>
                    ))}
                  </div>
                </div>
              ) : view === 'list' ? (
                <div className="space-y-2">
                  {sorted.map((d) => { const t = tInfo(d.type); const done = d.remaining === 0; return (
                    <div key={d.id} className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_1.4fr_1fr_1fr_1.3fr_auto] items-center gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-black/[.02] dark:bg-white/[.03] px-3 py-3">
                      <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: `${t.color}22`, color: t.color }}><Landmark className="w-5 h-5" /></span>
                      <div className="min-w-0"><p className="font-semibold truncate">{d.name}</p><p className="text-[11px] text-muted truncate">{t.label}{d.institution ? ` • ${d.institution}` : ''} • {d.rate.toFixed(2).replace('.', ',')}% a.m.</p></div>
                      <div className="hidden lg:block"><p className="text-[11px] text-muted">Saldo devedor</p><p className="font-semibold text-rose-500">{formatCurrency(d.balance)}</p></div>
                      <div className="hidden lg:block"><p className="text-[11px] text-muted">Parcela</p><p className="font-semibold">{formatCurrency(d.inst)}/mês</p></div>
                      <div className="hidden lg:block"><div className="flex justify-between text-[11px] text-muted mb-1"><span>{d.paid} de {d.n}</span><span>{d.pct}%</span></div><Bar pct={d.pct} color="linear-gradient(90deg,#22d3ee,#a855f7)" className="h-2" /></div>
                      <div className="flex items-center gap-1">{done ? <Badge color="emerald"><CheckCircle2 className="w-3 h-3" /> Quitada</Badge> : <button onClick={() => pay.mutate({ d })} className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-400/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10"><CheckCircle2 className="w-3.5 h-3.5" />Paguei</button>}<DebtActions d={d} /></div>
                    </div>); })}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {sorted.map((d) => { const t = tInfo(d.type); return (
                    <div key={d.id} className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-4" style={{ backgroundImage: `linear-gradient(135deg, ${t.color}1f, transparent 65%)` }}>
                      <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}><Landmark className="w-5 h-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold truncate">{d.name}</p><p className="text-[11px] text-muted">{t.label}{d.institution ? ` • ${d.institution}` : ''}</p></div><DebtActions d={d} /></div>
                      <div className="grid grid-cols-2 gap-2 mt-3"><div><p className="text-[11px] text-muted">Saldo devedor</p><p className="font-bold text-rose-500">{formatCurrency(d.balance)}</p></div><div><p className="text-[11px] text-muted">Parcela</p><p className="font-bold">{formatCurrency(d.inst)}/mês</p></div></div>
                      <div className="mt-3"><div className="flex justify-between text-[11px] text-muted mb-1"><span>{d.paid} de {d.n} parcelas</span><span>{d.pct}%</span></div><Bar pct={d.pct} color="linear-gradient(90deg,#22d3ee,#a855f7)" className="h-2" /></div>
                      <p className="text-[11px] text-muted mt-2">{d.remaining ? `Juros ${d.rate.toFixed(2).replace('.', ',')}% a.m. • quita em ${d.remaining} ${d.remaining === 1 ? 'mês' : 'meses'}` : 'Quitada'}</p>
                    </div>); })}
                </div>
              )}
            </Panel>

            <div className="grid lg:grid-cols-2 gap-5">
              <Panel title="Evolução da quitação" icon={LineIcon} iconClass="text-violet-400" subtitle="Percentual do valor total das dívidas quitado ao longo do tempo." action={<div className="text-right leading-none"><p className="font-display text-2xl font-extrabold text-cyan-500 dark:text-cyan-300">{pct1(paidNow).replace(',0%', '%')}</p><p className="text-[11px] text-muted">quitado</p></div>}>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolution} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v) => [`${String(v).replace('.', ',')}%`, 'Quitado']} contentStyle={TIP} />
                      <Line type="monotone" dataKey="pct" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee', stroke: '#0e7490' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted">Considera as parcelas registradas como pagas, mês a mês desde o início de cada contrato.</p>
              </Panel>
              <Panel title="Composição das dívidas" icon={PieIcon} iconClass="text-fuchsia-400" subtitle="Distribuição do saldo devedor por tipo de dívida.">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <Donut size={136} thickness={0.22} data={composition} center={<><span className="font-display font-bold text-sm">{formatCurrency(totalOwed)}</span><span className="text-[11px] text-muted">Total</span></>} />
                  <div className="flex-1 min-w-0 w-full space-y-2.5">
                    {composition.map((c) => <div key={c.v} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="flex-1 truncate">{c.label}</span><span className="tabular-nums text-muted w-12 text-right text-xs">{pct1(totalOwed > 0 ? (c.value / totalOwed) * 100 : 0)}</span><span className="tabular-nums w-20 text-right text-xs">{formatCurrency(c.value)}</span></div>)}
                  </div>
                </div>
              </Panel>
            </div>
          </>)}

          {tab === 'sim' && <CreditSimulator key={simKey} banks={banks} rendaEstimada={rendaEstimada} outrasParcelas={monthly} qc={qc} />}
        </div>

        {/* Coluna direita */}
        <div className="xl:col-span-4 space-y-5">
          <Panel title="Simulador de Empréstimo/Financiamento" icon={Calculator} iconClass="text-cyan-400" subtitle="Veja a parcela estimada e o custo total da operação." tone="violet">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor solicitado (R$)"><Input type="number" value={q.valor} onChange={(e) => setQ((s) => ({ ...s, valor: e.target.value }))} /></Field>
              <Field label="Juros (% a.m.)"><Input type="number" step="0.01" value={q.juros} onChange={(e) => setQ((s) => ({ ...s, juros: e.target.value }))} /></Field>
              <Field label="Prazo"><Select value={q.prazo} onChange={(e) => setQ((s) => ({ ...s, prazo: e.target.value }))}>{[6, 12, 18, 24, 36, 48, 60, 72].map((m) => <option key={m} value={m}>{m} meses</option>)}</Select></Field>
              <div className="rounded-xl ring-1 ring-fuchsia-400/60 bg-fuchsia-500/10 px-3 py-2 self-end">
                <p className="text-[11px] text-muted flex items-center gap-1">Parcela estimada <span title="Tabela Price: parcela fixa"><Info className="w-3 h-3" /></span></p>
                <p className="font-display text-xl font-extrabold text-fuchsia-600 dark:text-fuchsia-300">{formatCurrency(qParcela)}</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">Total pago {formatCurrency(qParcela * Number(q.prazo || 0))} • juros {formatCurrency(Math.max(0, qParcela * Number(q.prazo || 0) - Number(q.valor || 0)))}</p>
            <GlowButton tone="aurora" onClick={simular} className="w-full justify-center mt-3 py-2.5"><Play className="w-4 h-4" />Simular agora</GlowButton>
          </Panel>
          <InsightsPanel title="Insights do Monvy" subtitle="Leitura automática da sua situação de dívidas e crédito." items={insights.slice(0, 4)} />
        </div>
      </div>

      {/* Modal cadastro dívida */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar dívida' : 'Nova dívida'} maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><GlowButton tone="pink" onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</GlowButton></>}>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Parcelas pagas"><Input type="number" value={form.paid_installments} onChange={(e) => set('paid_installments', e.target.value)} /></Field>
            <Field label="Dia vencimento"><Input type="number" value={form.due_day} onChange={(e) => set('due_day', e.target.value)} /></Field>
            <Field label="Início"><Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
            <Field label="Instituição"><Input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Banco" /></Field>
          </div>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" /> Parcela estimada (Tabela Price): <b>{formatCurrency(formInst)}/mês</b> · total {formatCurrency(formInst * Number(form.installments || 0))}
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir dívida" footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button><button onClick={() => del.mutate(toDelete.id)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">Excluir</button></>}>
        <p className="text-sm">Excluir <b>{toDelete?.name}</b>? Essa ação não pode ser desfeita.</p>
      </Modal>

      {/* Modal tabela de amortização */}
      {schedule && (
        <Modal open onClose={() => setSchedule(null)} title={`Amortização — ${schedule.name}`} maxWidth="max-w-lg"
          footer={<Button onClick={() => setSchedule(null)}>Fechar</Button>}>
          <p className="text-sm text-muted mb-2">Parcela fixa de <b className="text-[hsl(var(--text))]">{formatCurrency(schedule.inst)}</b> (Tabela Price).</p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]"><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5">#</th><th className="py-1.5 text-right">Juros</th><th className="py-1.5 text-right">Amortização</th><th className="py-1.5 text-right">Saldo</th></tr></thead>
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

function CreditSimulator({ banks, rendaEstimada, outrasParcelas, qc }) {
  const saved = loadSim();
  const DEFAULTS = { tipo: 'imovel', subtipo: 'novo', valorBem: '', entrada: '', valorEmprestimo: '', prazo: '360', taxaMes: '0.9', indexer: 'prefixado', indexerAnnual: '', sistema: 'price', rendaMensal: rendaEstimada ? String(Math.round(rendaEstimada)) : '', outrasParcelas: outrasParcelas ? outrasParcelas.toFixed(2) : '', idadeAnos: '', idadeVeiculoAnos: '', fgts: '', ltvOverride: '', prazoMaxOverride: '', bankName: '' };
  const [f, setF] = useState({ ...DEFAULTS, ...(saved || {}), indexer: (saved && INDEXERS[saved.indexer]) ? saved.indexer : 'prefixado' });
  const [bankModal, setBankModal] = useState(false);
  const [fetching, setFetching] = useState(false);
  const set = (k, v) => setF((s) => { const next = { ...s, [k]: v }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; });
  const setTipo = (tipo) => { const subs = subtiposDe(tipo); setF((s) => { const next = { ...s, tipo, subtipo: subs[0]?.key || '', ltvOverride: '', prazoMaxOverride: '', bankName: '' }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; }); };

  const isFin = f.tipo === 'imovel' || f.tipo === 'veiculo';
  const subs = subtiposDe(f.tipo);
  const rules = rulesFor(f.tipo, f.subtipo);
  const kindBanks = banks.filter((b) => (b.kind || 'imovel') === f.tipo);

  // taxa efetiva = juros base (a.m.) combinado com o indexador (correcao estimada)
  const idxAnnualDefault = INDEXERS[f.indexer]?.defaultAnnual ?? 0;
  const idxAnnual = (f.indexerAnnual === '' || f.indexerAnnual == null) ? idxAnnualDefault : Number(f.indexerAnnual);
  const idxM = f.indexer !== 'prefixado' && idxAnnual > 0 ? (Math.pow(1 + idxAnnual / 100, 1 / 12) - 1) * 100 : 0;
  const baseM = Number(f.taxaMes) || 0;
  const effM = ((1 + baseM / 100) * (1 + idxM / 100) - 1) * 100;

  const res = useMemo(() => analyzeCredit({
    tipo: f.tipo, subtipo: f.subtipo, valorBem: f.valorBem, entrada: f.entrada, valorEmprestimo: f.valorEmprestimo,
    prazo: f.prazo, taxaMes: effM, sistema: f.sistema, rendaMensal: f.rendaMensal, outrasParcelas: f.outrasParcelas,
    idadeAnos: f.idadeAnos, idadeVeiculoAnos: f.idadeVeiculoAnos, fgts: f.fgts,
    ltvOverride: f.ltvOverride ? Number(f.ltvOverride) / 100 : null, prazoMaxOverride: f.prazoMaxOverride || null, bankName: f.bankName,
  }), [f, effM]);

  const meta = STATUS_META[res.status];

  const buscarTaxa = async () => {
    setFetching(true);
    try { const r = await fetchMarketRate(f.tipo); set('taxaMes', r.am.toFixed(2)); toast.success(r.source === 'bcb' ? `Taxa media do BCB: ${r.aa.toFixed(1)}% a.a.` : 'Usei uma taxa de referência (BCB indisponível).'); }
    catch { toast.error('Nao consegui buscar a taxa agora.'); } finally { setFetching(false); }
  };
  const usarTaxaTipica = () => { if (rules.taxaTipicaAm) { set('taxaMes', Number(rules.taxaTipicaAm).toFixed(2)); toast.success('Taxa tipica aplicada. Ajuste conforme sua proposta.'); } };
  const pickBank = (id) => {
    const b = kindBanks.find((x) => x.id === id); if (!b) return;
    const rm = b.base_rate != null && b.base_rate !== '' ? toMonthly(Number(b.base_rate), b.periodicity || 'anual') : Number(b.rate_month || 0);
    setF((s) => { const next = { ...s, taxaMes: rm.toFixed(3), indexer: b.indexer || 'prefixado', indexerAnnual: '', sistema: (b.system && b.system !== 'ambos') ? b.system : s.sistema, ltvOverride: b.max_ltv ? String(b.max_ltv) : '', prazoMaxOverride: b.prazo_max ? String(b.prazo_max) : '', bankName: b.name }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; });
    toast.success(`Condições de ${b.name} aplicadas.`);
  };
  const clearBank = () => setF((s) => ({ ...s, ltvOverride: '', prazoMaxOverride: '', bankName: '' }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-500" /> Simular crédito</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={buscarTaxa} disabled={fetching}>{fetching ? <Spinner className="w-4 h-4" /> : <><Download className="w-4 h-4" /> Taxa media (BCB)</>}</Button>
            <Button size="sm" variant="outline" onClick={() => setBankModal(true)}><Building2 className="w-4 h-4" /> Bancos</Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Tipo de crédito"><Select value={f.tipo} onChange={(e) => setTipo(e.target.value)}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select></Field>
          {subs.length > 0 && <Field label="Modalidade"><Select value={f.subtipo} onChange={(e) => set('subtipo', e.target.value)}>{subs.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>}
          {kindBanks.length > 0 && <Field label="Banco cadastrado"><Select defaultValue="" onChange={(e) => pickBank(e.target.value)}><option value="">Escolher taxa...</option>{kindBanks.map((b) => <option key={b.id} value={b.id}>{b.name} — {Number(b.rate_month).toFixed(2)}% a.m.</option>)}</Select></Field>}
          {isFin ? (<>
            <Field label="Valor do bem (R$)"><Input type="number" value={f.valorBem} onChange={(e) => set('valorBem', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Entrada (R$)"><Input type="number" value={f.entrada} onChange={(e) => set('entrada', e.target.value)} placeholder="0,00" /></Field>
          </>) : (
            <Field label="Valor do emprestimo (R$)"><Input type="number" value={f.valorEmprestimo} onChange={(e) => set('valorEmprestimo', e.target.value)} placeholder="0,00" /></Field>
          )}
          {f.tipo === 'imovel' && <Field label="Usar FGTS (R$)"><Input type="number" value={f.fgts} onChange={(e) => set('fgts', e.target.value)} placeholder="0,00" /></Field>}
          <Field label="Prazo (meses)"><Input type="number" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Field>
          <Field label="Juros base (% a.m.)"><Input type="number" step="0.001" value={f.taxaMes} onChange={(e) => set('taxaMes', e.target.value)} /></Field>
          <Field label="Indexador"><Select value={f.indexer} onChange={(e) => set('indexer', e.target.value)}>{Object.entries(INDEXERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          {f.indexer !== 'prefixado' && <Field label={`${INDEXERS[f.indexer]?.label || 'Indexador'} estimado (% a.a.)`}><Input type="number" step="0.01" value={f.indexerAnnual} onChange={(e) => set('indexerAnnual', e.target.value)} placeholder={String(idxAnnualDefault)} /></Field>}
          <Field label="Sistema"><Select value={f.sistema} onChange={(e) => set('sistema', e.target.value)}><option value="price">Price (parcela fixa)</option><option value="sac">SAC (parcela decrescente)</option></Select></Field>
          <Field label="Sua renda mensal (R$)"><Input type="number" value={f.rendaMensal} onChange={(e) => set('rendaMensal', e.target.value)} placeholder="0,00" /></Field>
          <Field label="Outras parcelas/mês (R$)"><Input type="number" value={f.outrasParcelas} onChange={(e) => set('outrasParcelas', e.target.value)} placeholder="0,00" /></Field>
          {f.tipo === 'imovel' && <Field label="Sua idade (anos)"><Input type="number" value={f.idadeAnos} onChange={(e) => set('idadeAnos', e.target.value)} placeholder="ex: 35" /></Field>}
          {f.tipo === 'veiculo' && f.subtipo === 'usado' && <Field label="Idade do veículo (anos)"><Input type="number" value={f.idadeVeiculoAnos} onChange={(e) => set('idadeVeiculoAnos', e.target.value)} placeholder="ex: 5" /></Field>}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {f.taxaMes && <span className="text-xs text-muted">Juros {baseM.toFixed(3)}% a.m.{f.indexer !== 'prefixado' ? ` + ${INDEXERS[f.indexer]?.label || 'indexador'} ~${idxM.toFixed(3)}% a.m.` : ''} → <b className="text-[hsl(var(--text))]">efetiva ~{effM.toFixed(3)}% a.m.</b> (~{amToAa(effM).toFixed(1)}% a.a.)</span>}
          {rules.taxaTipicaAm ? <button onClick={usarTaxaTipica} className="text-xs font-medium text-emerald-600 hover:underline">usar taxa tipica ({Number(rules.taxaTipicaAm).toFixed(2)}% a.m.)</button> : null}
        </div>
        {f.bankName && <div className="mt-2 flex items-center gap-2 text-xs"><Badge color="emerald"><Building2 className="w-3 h-3" /> {f.bankName}</Badge><span className="text-muted">LTV {f.ltvOverride || rules.ltvMax * 100}% · prazo max {f.prazoMaxOverride || rules.prazoMaxMeses}m</span><button onClick={clearBank} className="text-rose-500 hover:underline">remover</button></div>}
        {f.indexer === 'IPCA' && <p className="text-[11px] text-muted mt-1">No IPCA o saldo devedor e corrigido pela inflacao a cada mes; a parcela não e fixa de verdade — aqui usamos uma estimativa com o IPCA informado.</p>}
      </Card>

      {/* VEREDITO ESTILIZADO */}
      <div className="rounded-2xl p-5 text-white shadow-lg relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
        <div className="absolute -right-6 -top-6 opacity-20"><GaugeIcon className="w-32 h-32" /></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90"><span className="text-lg">{meta.emoji}</span> Análise de aprovação — {rules.tipoLabel}{f.subtipo ? ` · ${(subs.find((s) => s.key === f.subtipo) || {}).label || ''}` : ''}</div>
          <p className="font-display text-3xl font-bold mt-1">{meta.label}</p>
          <p className="text-sm opacity-90 mt-1">{meta.hint}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><p className="text-xs opacity-80">Chance (score)</p><p className="font-bold text-xl">{res.score}/100</p></div>
            <div><p className="text-xs opacity-80">Parcela {res.sistema === 'sac' ? '(1a, maior)' : 'fixa'}</p><p className="font-bold text-xl">{formatCurrency(res.parcela)}</p></div>
            <div><p className="text-xs opacity-80">Comprometimento</p><p className="font-bold text-xl">{isFinite(res.comprometimento) ? (res.comprometimento * 100).toFixed(0) + '%' : '—'}</p></div>
            <div><p className="text-xs opacity-80">Renda minima</p><p className="font-bold text-xl">{formatCurrency(res.rendaMinima)}</p></div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Como chegamos nisso</h3>
          <div className="space-y-2">
            {res.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                <span className={r.ok ? '' : 'text-amber-600 dark:text-amber-400'}>{r.text}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Numeros do financiamento</h3>
          <div className="space-y-1.5 text-sm">
            <Row label="Valor financiado" value={formatCurrency(res.financiado)} />
            {isFin && <Row label="Loan-to-Value (LTV)" value={`${(res.ltv * 100).toFixed(0)}%`} />}
            <Row label={res.sistema === 'sac' ? 'Parcela inicial (SAC)' : 'Parcela (Price)'} value={formatCurrency(res.parcela)} />
            {res.sistema === 'sac' && <Row label="Parcela final (SAC)" value={formatCurrency(res.sac.last)} />}
            <Row label="Total pago" value={formatCurrency(res.totalPago)} />
            <Row label="Juros totais" value={formatCurrency(res.jurosTotal)} strong color="text-rose-500" />
            {f.tipo === 'imovel' && <>
              <Row label="Custos (ITBI+registro ~5%)" value={formatCurrency(res.custosAquisicao)} />
              <Row label="Recursos a vista (entrada+custos-FGTS)" value={formatCurrency(res.recursosNecessarios)} strong />
            </>}
          </div>
          <p className="text-xs text-muted mt-3">Estimativa educativa. Bancos avaliam ainda score de crédito, relacionamento e comprovacao de renda.</p>
        </Card>
      </div>

      {/* REGRAS APLICADAS */}
      <Card>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ScrollText className="w-4 h-4 text-indigo-500" /> Regras aplicadas nesta modalidade</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          {isFin && <RuleCard label="Financia até (LTV)" value={`${(rules.ltvMax * 100).toFixed(0)}%`} />}
          {isFin && <RuleCard label="Entrada minima" value={`${(rules.entradaMinPct * 100).toFixed(0)}%`} />}
          <RuleCard label="Prazo máximo" value={`${rules.prazoMaxMeses} meses`} />
          <RuleCard label="Comprometimento max" value={`${(rules.comprometimentoMax * 100).toFixed(0)}% da renda`} />
          <RuleCard label="Taxa tipica" value={`~${Number(rules.taxaTipicaAm).toFixed(2)}% a.m.`} />
          {rules.idadeRule && <RuleCard label="Idade + prazo" value="até 80 anos e 6 meses" />}
          {rules.veiculoMaxAnos && <RuleCard label="Idade max do veículo" value={`${rules.veiculoMaxAnos} anos`} />}
          {rules.rendaMax && <RuleCard label="Teto de renda (MCMV)" value={formatCurrency(rules.rendaMax)} />}
          {rules.tetoSFH ? <RuleCard label="Teto SFH (com FGTS)" value={formatCurrency(rules.tetoSFH)} /> : null}
        </div>
        {rules.obs && <p className="text-xs text-muted mt-3 flex items-start gap-2"><Wallet className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" /> {rules.obs}</p>}
        <p className="text-xs text-muted mt-2">Valores de referência do mercado brasileiro; cada banco tem politica propria. Cadastre bancos para usar taxas reais.</p>
      </Card>

      {bankModal && <BankModal banks={banks} qc={qc} onClose={() => setBankModal(false)} />}
    </div>
  );
}

function RuleCard({ label, value }) {
  return <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3"><p className="text-[11px] text-muted">{label}</p><p className="font-semibold">{value}</p></div>;
}

function Row({ label, value, strong, color = '' }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className={`${strong ? 'font-bold' : 'font-medium'} ${color}`}>{value}</span></div>;
}

const PERIODS = [['mensal', 'ao mês'], ['anual', 'ao ano']];
const emptyBank = { name: '', kind: 'imovel', base_rate: '', periodicity: 'anual', indexer: 'TR', max_ltv: '', prazo_max: '', system: 'sac', notes: '' };

function BankModal({ banks, qc, onClose }) {
  const [form, setForm] = useState(emptyBank);
  const inval = () => qc.invalidateQueries({ queryKey: ['bankrates'] });
  const build = (b) => { const rm = toMonthly(Number(b.base_rate || 0), b.periodicity); return { name: b.name, kind: b.kind, base_rate: Number(b.base_rate || 0), periodicity: b.periodicity, indexer: b.indexer, rate_month: Number(rm.toFixed(4)), max_ltv: b.max_ltv ? Number(b.max_ltv) : null, prazo_max: b.prazo_max ? Number(b.prazo_max) : null, system: b.system || 'price', updated_at: b.updated_at || new Date().toISOString().slice(0, 10), notes: b.notes || '' }; };
  const save = useMutation({ mutationFn: (p) => BankRate.create(p), onSuccess: () => { inval(); setForm(emptyBank); toast.success('Banco cadastrado'); } });
  const del = useMutation({ mutationFn: (id) => BankRate.remove(id), onSuccess: inval });
  const seed = useMutation({
    mutationFn: async () => { const have = new Set(banks.map((b) => `${(b.name || '').toLowerCase()}|${b.kind}`)); let n = 0; for (const p of BANK_PRESETS) { if (have.has(`${p.name.toLowerCase()}|${p.kind}`)) continue; await BankRate.create(build(p)); n++; } return n; },
    onSuccess: (n) => { inval(); toast.success(n ? `${n} banco(s) de referência adicionados.` : 'Os bancos de referência já estao cadastrados.'); },
  });
  const submit = () => { if (!form.name || !form.base_rate) return toast.error('Informe nome e taxa'); save.mutate(build(form)); };
  const eff = form.base_rate ? effectiveMonthly(Number(form.base_rate), form.periodicity, form.indexer) : null;

  return (
    <Modal open onClose={onClose} title="Bancos & Taxas" maxWidth="max-w-lg" footer={<Button onClick={onClose}>Fechar</Button>}>
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Comece com condições publicas de referência (13/08/2026): Caixa, Santander, Itau, Inter (TR e IPCA) e BB.</p>
          <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>{seed.isPending ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> Importar</>}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Banco"><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Ex: Caixa" /></Field>
          <Field label="Tipo"><Select value={form.kind} onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value }))}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select></Field>
          <Field label="Taxa base (%)"><Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm((s) => ({ ...s, base_rate: e.target.value }))} placeholder="10.99" /></Field>
          <Field label="Periodicidade"><Select value={form.periodicity} onChange={(e) => setForm((s) => ({ ...s, periodicity: e.target.value }))}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Indexador"><Select value={form.indexer} onChange={(e) => setForm((s) => ({ ...s, indexer: e.target.value }))}>{Object.entries(INDEXERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="Sistema"><Select value={form.system} onChange={(e) => setForm((s) => ({ ...s, system: e.target.value }))}><option value="sac">SAC</option><option value="price">Price</option><option value="ambos">Ambos</option></Select></Field>
          <Field label="LTV máximo (%)"><Input type="number" value={form.max_ltv} onChange={(e) => setForm((s) => ({ ...s, max_ltv: e.target.value }))} placeholder="90" /></Field>
          <Field label="Prazo max (meses)"><Input type="number" value={form.prazo_max} onChange={(e) => setForm((s) => ({ ...s, prazo_max: e.target.value }))} placeholder="420" /></Field>
        </div>
        {eff && <p className="text-xs text-muted">{Number(form.base_rate).toFixed(2)}% {form.periodicity === 'anual' ? 'a.a.' : 'a.m.'} = juros ~{eff.baseM.toFixed(3)}% a.m.{form.indexer !== 'prefixado' ? ` + ${INDEXERS[form.indexer]?.label || 'indexador'} (estimado ~${eff.idxM.toFixed(3)}% a.m.) → efetiva ~${eff.eff.toFixed(3)}% a.m.` : ''}</p>}
        <Field label="Observação"><Textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Condições, relacionamento, etc." /></Field>
        <Button onClick={submit} disabled={save.isPending} className="w-full">{save.isPending ? <Spinner className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Cadastrar banco</>}</Button>
        {banks.length > 0 && (
          <div className="pt-2 border-t border-[hsl(var(--border))]">
            <p className="text-xs text-muted mb-2">Bancos cadastrados ({banks.length})</p>
            <div className="divide-y divide-[hsl(var(--border))] max-h-56 overflow-y-auto">
              {banks.map((b) => (
                <div key={b.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate">{b.name} <span className="text-muted text-xs">· {(KINDS.find((k) => k.v === b.kind) || {}).label}{b.indexer && b.indexer !== 'prefixado' ? ` · ${b.indexer}` : ''}</span></span>
                  <Badge>{Number(b.rate_month).toFixed(2)}% a.m.</Badge>
                  <button onClick={() => del.mutate(b.id)} className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
