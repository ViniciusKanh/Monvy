import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Landmark, CreditCard, FileText, ChevronRight, Store, Info, PieChart as PieIcon, BarChart3, Layers, Search, CalendarDays, ChevronDown, Wallet } from 'lucide-react';
import { Card, Button, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { TaxIllustration } from '../components/tax/TaxArt.jsx';
import { formatCurrency, MONTHS_PT, monthKey } from '../lib/utils.js';
import { TaxLedger, FiscalNote, CreditCardTransaction, CreditCard as CardEntity, Payslip } from '../api/entities.js';
import { iofEntries } from '../lib/cardTaxes.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceDot } from 'recharts';

const NF_TAX = { iss: 'ISS', icms: 'ICMS', ipi: 'IPI', ii: 'II', pis: 'PIS', cofins: 'COFINS', irrf: 'IRRF', csll: 'CSLL', inss: 'INSS', ibs: 'IBS', cbs: 'CBS', issqn: 'ISS', fcp: 'FCP' };
const TYPE_COLORS = ['#2dd4bf', '#8b5cf6', '#f59e0b', '#38bdf8', '#ec4899', '#22c55e'];
const OUTROS_COLOR = '#14b8a6';
const MES = MONTHS_PT.map((m) => m.slice(0, 3));
const mkLabel = (mk) => { const [y, m] = String(mk).split('-'); return m ? `${MES[Number(m) - 1]}/${y}` : String(mk); };
const brDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR') : '');
const parseTaxes = (t) => { if (!t) return {}; if (typeof t === 'object') return t; try { return JSON.parse(t); } catch { return {}; } };
const pctTxt = (v) => `${(Number.isFinite(v) ? v : 0).toFixed(1).replace('.', ',')}%`;

export default function Impostos() {
  const nav = useNavigate();
  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(nowY);
  const years = [nowY, nowY - 1, nowY - 2];
  const [range, setRange] = useState(6);
  const [q, setQ] = useState('');
  const [monthF, setMonthF] = useState('all');
  const [originF, setOriginF] = useState('all');

  const { data: ledger = [], isLoading: l1 } = useQuery({ queryKey: ['tax-ledger-all'], queryFn: () => TaxLedger.list() });
  const { data: notes = [], isLoading: l2 } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const { data: cardTxs = [], isLoading: l3 } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: () => CardEntity.list() });
  const { data: payslips = [] } = useQuery({ queryKey: ['payslips'], queryFn: () => Payslip.list() });
  const loading = l1 || l2 || l3;
  // IOF consolidado (fatura importada × linhas de IOF no cartão, sem dupla contagem)
  const iofAll = useMemo(() => iofEntries(ledger, cardTxs, { cardNames: Object.fromEntries(cards.map((c) => [c.id, c.name])) }), [ledger, cardTxs, cards]);

  const data = useMemo(() => {
    const ys = String(year);
    const iof = iofAll.filter((r) => String(r.mk || '').startsWith(ys));
    const folha = payslips.filter((p) => String(p.competence || '').startsWith(ys));
    const informe = ledger.filter((r) => r.source === 'informe' && Number(r.year) === year);
    const nfe = notes.filter((r) => String(r.reference_month || '').startsWith(ys));

    const iofTotal = iof.reduce((s, r) => s + Number(r.amount || 0), 0);
    const informeTotal = informe.reduce((s, r) => s + Number(r.amount || 0), 0);
    const nfeTotal = nfe.reduce((s, r) => s + Number(r.total_tax || 0), 0);
    const inssTotal = folha.reduce((s, p) => s + Number(p.inss || 0), 0);
    const irrfTotal = folha.reduce((s, p) => s + Number(p.irrf || 0), 0);
    const folhaTotal = inssTotal + irrfTotal;
    const total = iofTotal + informeTotal + nfeTotal + folhaTotal;

    // composição por tipo: tributos destacados nas notas (ISS, CBS, IBS...) + IOF + IR;
    // o que a nota só traz como "aproximado" (IBPT) entra em "Outros"
    const byType = {};
    let explicitNfe = 0;
    for (const nt of nfe) {
      for (const [k, v] of Object.entries(parseTaxes(nt.taxes))) {
        if (k === 'aproximado' || !(Number(v) > 0)) continue;
        const name = NF_TAX[k] || k.toUpperCase();
        byType[name] = (byType[name] || 0) + Number(v); explicitNfe += Number(v);
      }
    }
    if (iofTotal > 0) byType.IOF = iofTotal;
    if (inssTotal > 0) byType.INSS = (byType.INSS || 0) + inssTotal;
    if (irrfTotal > 0) byType.IRRF = (byType.IRRF || 0) + irrfTotal;
    if (informeTotal > 0) byType['IR (investimentos)'] = informeTotal;
    const outrosNfe = Math.max(0, nfeTotal - explicitNfe);
    let typeArr = Object.entries(byType).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    let outros = outrosNfe;
    if (typeArr.length > 4) { outros += typeArr.slice(4).reduce((s, x) => s + x.value, 0); typeArr = typeArr.slice(0, 4); }
    typeArr = typeArr.map((x, i) => ({ ...x, color: TYPE_COLORS[i % TYPE_COLORS.length] }));
    if (outros > 0.004) typeArr.push({ name: 'Outros', value: outros, color: OUTROS_COLOR, hint: 'Tributos aproximados (IBPT) informados nas notas, sem destaque por tipo' });

    const byEmitter = {};
    for (const nt of nfe) byEmitter[nt.emitter || 'Emitente'] = (byEmitter[nt.emitter || 'Emitente'] || 0) + Number(nt.total_tax || 0);
    const topEmitters = Object.entries(byEmitter).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    const sources = [
      { key: 'nota', name: 'Nota fiscal', icon: FileText, value: nfeTotal, color: '#2dd4bf' },
      { key: 'fatura', name: 'Fatura / cartão (IOF)', icon: CreditCard, value: iofTotal, color: '#8b5cf6' },
      { key: 'informe', name: 'Investimentos (IR)', icon: BarChart3, value: informeTotal, color: '#38bdf8' },
      { key: 'folha', name: 'Holerites (INSS + IRRF)', icon: Wallet, value: folhaTotal, color: '#ec4899' },
    ];

    const events = [
      ...nfe.map((r) => ({ id: `n${r.id}`, origin: 'Nota fiscal', kind: r.note_type === 'servico' || r.note_type === 'serviço' ? 'Serviço' : 'Consumo', label: r.emitter || 'Nota fiscal', mk: r.reference_month, date: r.issued_date, amount: Number(r.total_tax || 0) })),
      ...iof.map((r) => ({ id: `i${r.key}`, origin: 'Fatura', kind: 'IOF', label: `${r.label}${r.via === 'lançamentos' ? ' · lançamentos' : ''}`, mk: r.mk, date: null, amount: r.amount })),
      ...folha.map((p) => ({ id: `h${p.id}`, origin: 'Holerite', kind: 'INSS + IRRF', label: p.company || 'Holerite', mk: p.competence, date: p.pay_date || null, amount: Number(p.inss || 0) + Number(p.irrf || 0) })),
      ...informe.map((r) => ({ id: `r${r.id}`, origin: 'Informe', kind: 'IR', label: r.origin_label || 'Informe de rendimentos', mk: `${r.year}`, date: null, amount: Number(r.amount || 0) })),
    ].sort((a, b) => String(b.date || b.mk).localeCompare(String(a.date || a.mk)));

    return { total, iofTotal, informeTotal, nfeTotal, folhaTotal, typeArr, topEmitters, sources, events, hasData: total > 0 };
  }, [ledger, notes, year, iofAll, payslips]);

  // evolução mensal (IOF + notas + holerites) — janela móvel que termina no mês atual (ou dez/ano escolhido)
  const evolution = useMemo(() => {
    const end = year === nowY ? new Date() : new Date(year, 11, 1);
    const arr = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1); const mk = monthKey(d);
      const nf = notes.filter((r) => r.reference_month === mk).reduce((s, r) => s + Number(r.total_tax || 0), 0);
      const io = iofAll.filter((r) => r.mk === mk).reduce((s, r) => s + r.amount, 0);
      const fo = payslips.filter((p) => p.competence === mk).reduce((s, p) => s + Number(p.inss || 0) + Number(p.irrf || 0), 0);
      arr.push({ mk, name: MES[d.getMonth()], v: Math.round((nf + io + fo) * 100) / 100 });
    }
    return arr;
  }, [notes, iofAll, payslips, range, year, nowY]);
  const lastEvo = evolution[evolution.length - 1];

  const monthsInEvents = useMemo(() => [...new Set(data.events.map((e) => e.mk).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(), [data.events]);
  const rows = useMemo(() => data.events.filter((e) => {
    if (originF !== 'all' && e.origin !== originF) return false;
    if (monthF !== 'all' && e.mk !== monthF) return false;
    if (q) { const s = q.toLowerCase(); if (!e.label.toLowerCase().includes(s) && !e.kind.toLowerCase().includes(s) && !e.origin.toLowerCase().includes(s)) return false; }
    return true;
  }), [data.events, originF, monthF, q]);

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Landmark className="w-12 h-12 text-teal-400 shrink-0 mt-1" strokeWidth={1.6} />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Impostos</h1>
            <p className="text-sm text-muted mt-1">O Monvy acompanha tributos mensuráveis de notas fiscais, IOF do cartão, holerites (INSS/IRRF) e IR dos investimentos.</p>
            <div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-teal-400 to-sky-500" />
          </div>
        </div>
        <label className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl card !rounded-xl cursor-pointer self-start">
          <CalendarDays className="w-4 h-4 text-muted" />
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="appearance-none bg-transparent font-semibold outline-none pr-5 cursor-pointer [&>option]:text-slate-800" aria-label="Ano">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          <ChevronDown className="w-4 h-4 text-muted absolute right-3 pointer-events-none" />
        </label>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl text-white ring-1 ring-teal-300/40 shadow-[0_0_40px_rgba(45,212,191,.12)]" style={{ background: 'linear-gradient(120deg,#0b3b3a 0%,#0b2a33 40%,#0d1a33 75%,#10173a 100%)' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden><path d="M520 200 C640 120 700 170 790 90 C860 30 930 60 1000 20 L1000 200 Z" fill="rgba(45,212,191,.16)" /><path d="M600 200 C700 150 760 190 850 120 C910 75 960 100 1000 80 L1000 200 Z" fill="rgba(45,212,191,.12)" /></svg>
        <div className="relative grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-6 p-6 items-center">
          <div className="min-w-0">
            <p className="text-slate-200 flex items-center gap-2">Tributos medidos em {year} <span title="Valores confirmados por documento: tributos das notas fiscais, IOF das faturas do cartão, INSS/IRRF dos holerites e IR do informe de rendimentos." className="text-slate-400 hover:text-white cursor-help"><Info className="w-4 h-4" /></span></p>
            <p className="font-display text-[clamp(2.4rem,3.6vw,3.6rem)] font-extrabold leading-none mt-2 whitespace-nowrap"><AnimatedValue value={data.total} format={formatCurrency} /></p>
            <div className="flex flex-wrap gap-3 mt-5">
              <HeroChip icon={CreditCard} label="IOF" value={data.iofTotal} />
              <HeroChip icon={FileText} label="Notas fiscais" value={data.nfeTotal} />
              <HeroChip icon={BarChart3} label="IR" value={data.informeTotal} />
              {data.folhaTotal > 0 && <HeroChip icon={Wallet} label="Holerites" value={data.folhaTotal} />}
            </div>
          </div>
          <div className="flex items-center gap-4 lg:pl-6 lg:border-l border-white/10 min-w-0">
            <div className="flex-1 min-w-0 max-w-sm">
              <p className="text-sm text-slate-200 flex gap-2"><Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-300" /><span>A estimativa completa da sua carga tributária (INSS, IRRF do salário, consumo por IBPT e outros) está em <b className="text-white">Minha Carga Tributária</b>.</span></p>
              <button onClick={() => nav('/carga-tributaria')} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 ring-1 ring-violet-300/50 font-semibold text-sm shadow-[0_0_20px_rgba(139,92,246,.45)] transition">Ver Carga Tributária <ChevronRight className="w-4 h-4" /></button>
            </div>
            <TaxIllustration className="hidden xl:block w-60 h-44 shrink-0 -my-4" />
          </div>
        </div>
      </div>

      {!data.hasData ? (
        <Card><EmptyState icon={FileText} title="Sem tributos medidos ainda"
          subtitle="Importe uma fatura em Cartões (captura o IOF), guarde notas fiscais em Notas Fiscais, ou lance o informe de rendimentos na Carga Tributária."
          action={<div className="flex gap-2"><Button variant="outline" onClick={() => nav('/notas-fiscais')}><FileText className="w-4 h-4" /> Notas Fiscais</Button><Button variant="outline" onClick={() => nav('/cartoes')}><CreditCard className="w-4 h-4" /> Cartões</Button></div>} /></Card>
      ) : (
        <>
          {/* 4 cards analíticos */}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[1.15fr_1.1fr_1fr_0.95fr]">
            <Reveal i={0}><Panel tone="violet" icon={PieIcon} title="Composição por tipo">
              <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 items-center">
                <div className="relative h-[132px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={data.typeArr} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270}>{data.typeArr.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} /></PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"><span className="font-display font-bold text-sm leading-tight">{formatCurrency(data.total)}</span><span className="text-[9px] text-muted">Total de tributos</span></div>
                </div>
                <div className="space-y-2 min-w-0">
                  {data.typeArr.map((t) => (
                    <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_auto_2.6rem] gap-2 items-center text-xs" title={t.hint}>
                      <span className="flex items-center gap-1.5 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} /><span className="truncate">{t.name}</span></span>
                      <b className="whitespace-nowrap">{formatCurrency(t.value)}</b>
                      <span className="text-muted text-right">{pctTxt((t.value / data.total) * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel></Reveal>

            <Reveal i={1}><Panel tone="sky" icon={BarChart3} title="Evolução mensal" action={
              <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="text-[11px] bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1 outline-none ring-1 ring-[hsl(var(--border))] cursor-pointer [&>option]:text-slate-800" aria-label="Período"><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select>
            }>
              <div className="h-[150px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolution} margin={{ top: 24, right: 34, left: 4, bottom: 0 }}>
                    <defs><linearGradient id="impEvo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis width={56} tick={{ fontSize: 9, fill: 'hsl(var(--muted))', width: 60 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$\u00a0${Math.round(v)}`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l, p) => (p?.[0] ? mkLabel(p[0].payload.mk) : l)} contentStyle={TIP} />
                    <Area type="monotone" dataKey="v" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#impEvo)" dot={{ r: 3, fill: '#0f172a', stroke: '#2dd4bf', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    {lastEvo && <ReferenceDot x={lastEvo.name} y={lastEvo.v} r={6} fill="#2dd4bf" stroke="#ccfbf1" strokeWidth={2} label={{ value: formatCurrency(lastEvo.v), position: 'top', fill: '#5eead4', fontSize: 10, fontWeight: 700 }} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel></Reveal>

            <Reveal i={2}><Panel tone="violet" glow icon={Store} title="Onde mais paguei imposto">
              {data.topEmitters.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem notas fiscais neste ano.</p> : (
                <div className="space-y-2">
                  {data.topEmitters.map((e) => (
                    <div key={e.name} className="flex items-center gap-2.5 text-xs">
                      <Store className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="flex-1 truncate" title={e.name}>{e.name}</span>
                      <b className="whitespace-nowrap">{formatCurrency(e.value)}</b>
                    </div>
                  ))}
                </div>
              )}
            </Panel></Reveal>

            <Reveal i={3}><Panel tone="sky" icon={Layers} title="Por fonte">
              <div className="space-y-3">
                {data.sources.map((s) => { const p = data.total > 0 ? (s.value / data.total) * 100 : 0; return (
                  <div key={s.key}>
                    <div className="flex items-center gap-2 text-xs"><s.icon className="w-4 h-4 shrink-0" style={{ color: s.color }} /><span className="flex-1 truncate">{s.name}</span><b className="whitespace-nowrap">{formatCurrency(s.value)}</b><span className="text-muted w-11 text-right">{pctTxt(p)}</span></div>
                    <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-1.5 ml-6"><div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: s.color }} /></div>
                  </div>
                ); })}
              </div>
            </Panel></Reveal>
          </div>

          {/* Lançamentos de imposto */}
          <div className="rounded-3xl ring-1 ring-violet-400/30 bg-[hsl(var(--card))] shadow-soft p-5">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-violet-400 shrink-0" strokeWidth={1.6} />
                <div><h3 className="font-semibold text-lg">Lançamentos de imposto</h3><p className="text-xs text-muted">Registros de tributos identificados nas suas notas fiscais, faturas e investimentos.</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lançamento..." className="input-base !py-2 !pl-9 !w-60" /></div>
                <FilterSelect icon={CalendarDays} value={monthF} onChange={setMonthF} options={[['all', 'Todos os meses'], ...monthsInEvents.map((m) => [m, mkLabel(m)])]} label="Mês" />
                <FilterSelect icon={Layers} value={originF} onChange={setOriginF} options={[['all', 'Todas as origens'], ['Nota fiscal', 'Nota fiscal'], ['Fatura', 'Fatura (IOF)'], ['Informe', 'Investimentos (IR)'], ['Holerite', 'Holerites (INSS+IRRF)']]} label="Origem" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted bg-black/[0.03] dark:bg-white/[0.04]">
                  <th className="px-4 py-2.5 font-medium rounded-l-xl">Estabelecimento / Descrição</th><th className="px-4 py-2.5 font-medium">Origem / Tipo</th><th className="px-4 py-2.5 font-medium">Mês / Data</th><th className="px-4 py-2.5 font-medium text-right rounded-r-xl">Imposto</th>
                </tr></thead>
                <tbody>
                  {rows.length === 0 ? <tr><td colSpan={4} className="text-center text-muted py-8">Nenhum lançamento com esses filtros.</td></tr> : rows.map((e) => (
                    <tr key={e.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5"><span className="flex items-center gap-3 min-w-0">{e.origin === 'Fatura' ? <CreditCard className="w-4 h-4 text-violet-400 shrink-0" /> : e.origin === 'Holerite' ? <Wallet className="w-4 h-4 text-pink-400 shrink-0" /> : e.origin === 'Informe' ? <BarChart3 className="w-4 h-4 text-sky-400 shrink-0" /> : <Store className="w-4 h-4 text-violet-400 shrink-0" />}<span className="truncate max-w-[340px]">{e.label}</span></span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold mr-2 ${e.origin === 'Fatura' ? 'bg-violet-500/15 text-violet-500 dark:text-violet-300' : e.origin === 'Holerite' ? 'bg-pink-500/15 text-pink-600 dark:text-pink-300' : e.origin === 'Informe' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300' : 'bg-blue-500/15 text-blue-600 dark:text-blue-300'}`}>{e.origin}</span><span className="text-muted text-xs">{e.kind}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted text-xs">{mkLabel(e.mk)}{e.date ? ` • ${brDate(e.date)}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 0 && <p className="text-[11px] text-muted mt-3 text-right">{rows.length} lançamento(s) · total {formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}</p>}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="!px-5 !py-2.5" onClick={() => nav('/notas-fiscais')}><FileText className="w-4 h-4" /> Gerenciar notas fiscais</Button>
        <Button variant="outline" className="!px-5 !py-2.5 ring-1 ring-teal-400/40" onClick={() => nav('/carga-tributaria')}><Landmark className="w-4 h-4" /> Ver Carga Tributária <ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

const TIP = { borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 };

function HeroChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] ring-1 ring-teal-300/40 min-w-[150px]">
      <Icon className="w-6 h-6 text-teal-200 shrink-0" strokeWidth={1.6} />
      <div className="leading-tight"><p className="text-xs text-slate-300">{label}</p><p className="font-bold">{formatCurrency(value)}</p></div>
    </div>
  );
}

function Panel({ icon: Icon, title, action, tone = 'violet', glow, children }) {
  const ring = tone === 'sky' ? 'ring-sky-400/25' : 'ring-violet-400/30';
  return (
    <div className={`h-full rounded-2xl bg-[hsl(var(--card))] ring-1 ${ring} ${glow ? 'shadow-[0_0_28px_rgba(139,92,246,.25)]' : 'shadow-soft'} p-4`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Icon className={`w-4 h-4 ${tone === 'sky' ? 'text-sky-400' : 'text-violet-400'}`} /> {title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function FilterSelect({ icon: Icon, value, onChange, options, label }) {
  return (
    <label className="relative inline-flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl border border-[hsl(var(--border))] text-sm cursor-pointer">
      <Icon className="w-4 h-4 text-muted" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="appearance-none bg-transparent outline-none cursor-pointer font-medium [&>option]:text-slate-800">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 pointer-events-none" />
    </label>
  );
}
