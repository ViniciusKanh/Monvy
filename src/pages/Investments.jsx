import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Investment, Account, Debt, AppSettings, Goal } from '../api/entities.js';
import { Button, Input, Select, Field, Modal, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Panel, Donut, Bar, KebabMenu, InsightRow, GlowButton, DeltaChip, pct1, TIP } from '../components/kit.jsx';
import { formatCurrency, todayIso, monthKey } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { AreaChart, Area, LineChart as RLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar as RBar, Cell, ReferenceDot } from 'recharts';
import {
  TrendingUp, TrendingDown, Plus, Pencil, Trash2, Wallet, Coins, RefreshCw, Info, Layers, BarChart3, Percent, CalendarDays, Target, Sparkles,
  ArrowRight, Landmark, Building2, Bitcoin, PiggyBank, Rocket, Calculator, ChevronRight, Brain, Home,
} from 'lucide-react';

const CG = { btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', usdc: 'usd-coin', matic: 'matic-network', dot: 'polkadot', ltc: 'litecoin', link: 'chainlink', avax: 'avalanche-2', trx: 'tron', shib: 'shiba-inu', ton: 'the-open-network', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near' };
const TYPES = [
  { v: 'tesouro', label: 'Tesouro Direto', color: '#38bdf8', icon: Landmark, sub: 'Renda fixa • Título público' },
  { v: 'acao', label: 'Ações', color: '#a855f7', icon: BarChart3, sub: 'Renda variável • Bolsa' },
  { v: 'fii', label: 'Fundos Imobiliários', color: '#2dd4bf', icon: Building2, sub: 'Imobiliário • Rendimentos' },
  { v: 'renda_fixa', label: 'Renda Fixa (CDB/LCI/LCA)', color: '#f59e0b', icon: Coins, sub: 'Renda fixa • Bancária' },
  { v: 'fundo', label: 'Fundos', color: '#ec4899', icon: Layers, sub: 'Fundos de investimento' },
  { v: 'cripto', label: 'Cripto', color: '#f43f5e', icon: Bitcoin, sub: 'Criptoativos' },
  { v: 'outro', label: 'Outros', color: '#8b5cf6', icon: PiggyBank, sub: 'Outros ativos' },
];
const tInfo = (v) => TYPES.find((t) => t.v === v) || TYPES[TYPES.length - 1];
const empty = { name: '', type: 'renda_fixa', institution: '', invested_amount: '', current_value: '', ticker: '', quantity: '', date: todayIso(), color: '#6366f1' };
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TABS = [['overview', 'Visão Geral'], ['wallet', 'Minha Carteira'], ['contrib', 'Aportes'], ['returns', 'Rentabilidade'], ['proj', 'Projeções'], ['sim', 'Simulador']];
const SGS = (c, n) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${c}/dados/ultimos/${n}?formato=json`;
const num = (v) => Number(String(v ?? '').replace(',', '.'));

// Indicadores de referência (Banco Central): CDI e IPCA acumulados em 12 meses e variação do Ibovespa
async function fetchIndicators() {
  const get = async (c, n) => { const r = await fetch(SGS(c, n)); if (!r.ok) throw new Error('bcb'); return r.json(); };
  const out = { cdi: null, ipca: null, ibov: null };
  try { const d = await get(4391, 12); out.cdi = (d.reduce((acc, x) => acc * (1 + num(x.valor) / 100), 1) - 1) * 100; } catch { /* */ }
  try { const d = await get(13522, 1); out.ipca = num(d[d.length - 1]?.valor); } catch { /* */ }
  try { const d = await get(7, 260); const a = num(d[0]?.valor), b = num(d[d.length - 1]?.valor); if (a > 0 && b > 0) out.ibov = ((b - a) / a) * 100; } catch { /* */ }
  return out;
}

// Ilustração do cabeçalho: candles subindo com seta (original, SVG)
function MarketArt({ className }) {
  const candles = [[10, 70, 52, 1], [30, 64, 46, 0], [50, 58, 40, 1], [70, 60, 36, 1], [90, 48, 30, 0], [110, 44, 24, 1], [130, 36, 16, 1], [150, 30, 10, 1]];
  return (
    <svg viewBox="0 0 220 100" className={className} aria-hidden="true">
      <defs><linearGradient id="mkArrow" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#a855f7" /></linearGradient><filter id="mkGlow"><feGaussianBlur stdDeviation="3" /></filter></defs>
      {candles.map(([x, lo, hi, up], i) => <g key={i}><line x1={x + 5} y1={hi - 6} x2={x + 5} y2={lo + 6} stroke={up ? '#2dd4bf' : '#a855f7'} strokeOpacity=".6" /><rect x={x} y={hi} width="10" height={lo - hi} rx="2" fill={up ? '#2dd4bf' : '#a855f7'} fillOpacity={0.35 + i * 0.07} /></g>)}
      <path d="M6 84 C50 76 80 60 110 50 S170 22 205 10" stroke="url(#mkArrow)" strokeWidth="6" fill="none" filter="url(#mkGlow)" opacity=".7" />
      <path d="M6 84 C50 76 80 60 110 50 S170 22 205 10" stroke="url(#mkArrow)" strokeWidth="3" fill="none" />
      <path d="M196 6 L212 6 L208 22 Z" fill="#c084fc" />
    </svg>
  );
}

export default function Investments() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: settingsList = [], isSuccess: settingsReady } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const { data: ind } = useQuery({ queryKey: ['inv-indicators'], queryFn: fetchIndicators, staleTime: 6 * 3_600_000, retry: 0 });
  const settings = settingsList[0];
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [range, setRange] = useState('12m');
  const [toDelete, setToDelete] = useState(null);

  const inval = () => qc.invalidateQueries({ queryKey: ['investments'] });
  const save = useMutation({ mutationFn: (p) => editing ? Investment.update(editing.id, p) : Investment.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Investment.remove(id), onSuccess: () => { inval(); setToDelete(null); } });

  const [quoting, setQuoting] = useState(false);
  const updateQuotes = async () => {
    const crypto = items.filter((i) => i.type === 'cripto' && Number(i.quantity) > 0 && i.ticker);
    const stocks = items.filter((i) => (i.type === 'acao' || i.type === 'fii') && Number(i.quantity) > 0 && i.ticker);
    if (!crypto.length && !stocks.length) { toast.info('Informe tipo (cripto/ação/FII), ticker e quantidade nas aplicações para atualizar automaticamente.'); return; }
    setQuoting(true); let updated = 0, failed = 0;
    try {
      if (crypto.length) {
        const idFor = (t) => CG[String(t).toLowerCase()] || String(t).toLowerCase();
        const ids = [...new Set(crypto.map((i) => idFor(i.ticker)))];
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=brl`);
        if (r.ok) { const px = await r.json(); for (const i of crypto) { const price = px[idFor(i.ticker)]?.brl; if (price) { await Investment.update(i.id, { current_value: Number(i.quantity) * price }); updated++; } else failed++; } } else failed += crypto.length;
      }
      if (stocks.length) {
        try {
          const r = await fetch(`https://brapi.dev/api/quote/${stocks.map((i) => i.ticker).join(',')}`);
          if (r.ok) { const d = await r.json(); const map = Object.fromEntries((d.results || []).map((x) => [String(x.symbol).toUpperCase(), x.regularMarketPrice])); for (const i of stocks) { const price = map[String(i.ticker).toUpperCase()]; if (price) { await Investment.update(i.id, { current_value: Number(i.quantity) * price }); updated++; } else failed++; } } else failed += stocks.length;
        } catch { failed += stocks.length; }
      }
      inval();
      toast.success(`${updated} cotação(ões) atualizada(s)${failed ? `. ${failed} não encontrada(s) — confira o ticker.` : '.'}`);
    } catch { toast.error('Falha ao buscar cotações'); } finally { setQuoting(false); }
  };

  // ---------- números ----------
  const invested = items.reduce((s, i) => s + Number(i.invested_amount || 0), 0);
  const current = items.reduce((s, i) => s + Number(i.current_value || 0), 0);
  const profit = current - invested;
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
  const totalAccounts = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalDebt = debts.reduce((s, d) => s + Number(d.total_amount || 0) * (1 - Number(d.paid_installments || 0) / Math.max(1, Number(d.installments || 1))), 0);
  const netWorth = totalAccounts + current - totalDebt;
  const mkNow = monthKey(new Date());
  const aportesMes = items.filter((i) => String(i.date || '').slice(0, 7) === mkNow).reduce((s, i) => s + Number(i.invested_amount || 0), 0);

  // foto mensal do patrimônio (guardada nas Configurações do usuário para montar o histórico)
  const history = settings?.inv_history && typeof settings.inv_history === 'object' ? settings.inv_history : {};
  const wrote = useRef(false);
  useEffect(() => {
    if (wrote.current || isLoading || !settingsReady) return;
    const snap = { net: Math.round(netWorth * 100) / 100, inv: Math.round(current * 100) / 100, invested: Math.round(invested * 100) / 100 };
    const prev = history[mkNow];
    if (prev && Math.abs((prev.net || 0) - snap.net) < 0.5 && Math.abs((prev.inv || 0) - snap.inv) < 0.5) { wrote.current = true; return; }
    wrote.current = true;
    const next = { ...history, [mkNow]: snap };
    (settings?.id ? AppSettings.update(settings.id, { inv_history: next }) : AppSettings.create({ inv_history: next })).then(() => qc.invalidateQueries({ queryKey: ['appsettings'] })).catch(() => {});
  }, [isLoading, settingsReady, netWorth, current, invested]); // eslint-disable-line react-hooks/exhaustive-deps

  const byType = useMemo(() => {
    const m = {};
    for (const i of items) { const t = tInfo(i.type); m[t.v] = m[t.v] || { ...t, name: t.label, value: 0, invested: 0 }; m[t.v].value += Number(i.current_value || 0); m[t.v].invested += Number(i.invested_amount || 0); }
    return Object.values(m).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).map((x) => ({ ...x, ret: x.invested > 0 ? ((x.value - x.invested) / x.invested) * 100 : 0 }));
  }, [items]);

  // série mensal: patrimônio (fotos guardadas) x aportes acumulados (pelas datas das aplicações)
  const series = useMemo(() => {
    const now = new Date();
    const firstHist = Object.keys(history).sort()[0];
    const firstApp = items.map((i) => String(i.date || '').slice(0, 7)).filter(Boolean).sort()[0];
    const start = range === 'all' ? (firstApp && (!firstHist || firstApp < firstHist) ? firstApp : firstHist || mkNow) : null;
    const n = range === '1m' ? 2 : range === '3m' ? 3 : range === '6m' ? 6 : range === 'ytd' ? now.getMonth() + 1 : range === 'all' ? Math.max(2, (now.getFullYear() - Number(start.slice(0, 4))) * 12 + now.getMonth() - (Number(start.slice(5)) - 1) + 1) : 12;
    const out = [];
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1); const key = monthKey(d);
      const ap = items.filter((i) => String(i.date || '').slice(0, 7) <= key).reduce((s, i) => s + Number(i.invested_amount || 0), 0);
      const h = key === mkNow ? { net: netWorth } : history[key];
      out.push({ name: n > 14 ? `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` : MES[d.getMonth()], key, Patrimonio: h ? Math.round(h.net * 100) / 100 : null, Aportes: Math.round(ap * 100) / 100 });
    }
    return out;
  }, [history, items, range, netWorth, mkNow]);
  const delta12 = (() => { const keys = Object.keys(history).sort(); const limit = monthKey(new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1)); const base = keys.find((k) => k >= limit && k < mkNow); return base && history[base]?.net ? { v: ((netWorth - history[base].net) / Math.abs(history[base].net)) * 100, since: base } : null; })();

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (i) => { setEditing(i); setForm({ name: i.name, type: i.type, institution: i.institution || '', invested_amount: i.invested_amount ?? '', current_value: i.current_value ?? '', ticker: i.ticker || '', quantity: i.quantity ?? '', date: (i.date || todayIso()).slice(0, 10), color: tInfo(i.type).color }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e?.preventDefault?.(); if (!form.name.trim()) return; save.mutate({ ...form, invested_amount: Number(form.invested_amount || 0), current_value: Number(form.current_value || 0) || Number(form.invested_amount || 0), quantity: Number(form.quantity || 0), color: tInfo(form.type).color }); };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const goalsActive = goals.filter((g) => Number(g.target_amount || 0) > 0).slice(0, 4);
  const sorted = [...items].sort((a, b) => Number(b.current_value || 0) - Number(a.current_value || 0));
  const contribs = [...items].filter((i) => i.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const contribMonthly = (() => { const now = new Date(); const out = []; for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); const key = monthKey(d); out.push({ name: MES[d.getMonth()], key, Aportes: items.filter((i) => String(i.date || '').slice(0, 7) === key).reduce((s, i) => s + Number(i.invested_amount || 0), 0) }); } return out; })();
  const best = byType.length ? [...byType].sort((a, b) => b.ret - a.ret)[0] : null;
  const top = byType[0];
  const topShare = top && current > 0 ? (top.value / current) * 100 : 0;
  const insights = [];
  if (ind?.cdi != null && invested > 0) insights.push({ tone: profitPct >= ind.cdi ? 'emerald' : 'amber', icon: TrendingUp, title: profitPct >= ind.cdi ? 'Resultado acima do CDI 12M' : 'Resultado abaixo do CDI 12M', text: `Rentabilidade acumulada da carteira ${pct1(profitPct)} • CDI 12 meses ${pct1(ind.cdi)}. Atenção: a carteira considera todo o período desde cada aplicação.` });
  if (top && byType.length > 1) insights.push({ tone: topShare > 60 ? 'amber' : 'sky', icon: Layers, title: `${top.label} representa ${pct1(topShare)} da carteira`, text: topShare > 60 ? 'Parte relevante do patrimônio investido está concentrada em uma única classe.' : 'A carteira está distribuída entre diferentes classes de ativos.' });
  if (best && best.ret !== 0) insights.push({ tone: best.ret >= 0 ? 'emerald' : 'rose', icon: Sparkles, title: `Maior variação: ${best.label}`, text: `Resultado de ${best.ret >= 0 ? '+' : ''}${pct1(best.ret)} sobre o valor aplicado (${formatCurrency(best.value - best.invested)}).` });
  if (aportesMes > 0) insights.push({ tone: 'violet', icon: CalendarDays, title: 'Aportes registrados neste mês', text: `${formatCurrency(aportesMes)} aplicados em ${MES[new Date().getMonth()]}.` });

  const posGroups = byType.map((t) => ({ ...t, items: sorted.filter((i) => tInfo(i.type).v === t.v) }));

  const Tile = ({ icon: Ic, label, value, sub, color, chip }) => (
    <div className="rounded-2xl bg-black/5 dark:bg-white/[.04] ring-1 ring-[hsl(var(--border))] p-3.5 min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted"><span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `${color}22`, color }}><Ic className="w-4 h-4" /></span>{label}</div>
      <p className="font-display text-xl font-bold mt-2 truncate" style={{ color: chip ? undefined : undefined }}>{value}</p>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">{chip}{sub}</div>
    </div>
  );

  const AssetRow = ({ i, compact }) => {
    const t = tInfo(i.type); const inv = Number(i.invested_amount || 0), cur = Number(i.current_value || 0); const r = inv > 0 ? ((cur - inv) / inv) * 100 : 0; const share = current > 0 ? (cur / current) * 100 : 0;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}><t.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{i.name}{i.ticker ? <span className="text-muted font-normal"> · {String(i.ticker).toUpperCase()}</span> : null}</p><p className="text-[11px] text-muted truncate">{i.institution || t.label}{!compact && ` • ${pct1(share)} da carteira`}</p></div>
        <div className="text-right"><p className="font-semibold text-sm">{formatCurrency(cur)}</p>{inv > 0 && <DeltaChip v={r} />}</div>
        {!compact && <KebabMenu items={[{ label: 'Editar', icon: Pencil, onClick: () => openEdit(i) }, { label: 'Excluir', icon: Trash2, danger: true, onClick: () => setToDelete(i) }]} />}
      </div>
    );
  };

  const IndCard = ({ label, value, color, note }) => (
    <div className="rounded-2xl bg-black/5 dark:bg-white/[.04] ring-1 ring-[hsl(var(--border))] p-3 text-center">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg font-bold mt-0.5" style={{ color }}>{value == null ? '—' : `${value >= 0 ? '+' : ''}${pct1(value)}`}</p>
      <p className="text-[10px] text-muted">{note}</p>
    </div>
  );

  const evolutionChart = (h = 250) => (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="invPat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
            <linearGradient id="invAp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.25} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)} />
          <Tooltip formatter={(v, n) => [v == null ? 'sem registro' : formatCurrency(v), n === 'Patrimonio' ? 'Patrimônio líquido' : 'Aportes acumulados']} contentStyle={TIP} />
          <Area type="monotone" dataKey="Aportes" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="5 4" fill="url(#invAp)" />
          <Area type="monotone" dataKey="Patrimonio" stroke="#a855f7" strokeWidth={3} fill="url(#invPat)" connectNulls dot={{ r: 3, fill: '#a855f7' }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <span className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/30 to-teal-400/20 ring-1 ring-violet-400/40 shrink-0 mt-1"><TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-300" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Investimentos & Patrimônio</h1>
            <p className="text-sm text-muted mt-1">Acompanhe sua carteira, rentabilidade e evolução do seu patrimônio.</p>
            <div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-violet-400 to-teal-400" />
          </div>
          <MarketArt className="hidden lg:block w-56 h-24 -mt-1 opacity-90" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={updateQuotes} disabled={quoting} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:ring-teal-400/60 transition disabled:opacity-60"><RefreshCw className={`w-4 h-4 text-teal-400 ${quoting ? 'animate-spin' : ''}`} />{quoting ? 'Atualizando…' : 'Atualizar cotações'}</button>
          <GlowButton tone="violet" onClick={openNew}><Plus className="w-4 h-4" />Novo investimento</GlowButton>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))]">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => (v === 'sim' ? nav('/simulador') : setTab(v))} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === v ? 'border-violet-400 text-violet-600 dark:text-violet-200' : 'border-transparent text-muted hover:text-[hsl(var(--text))]'}`}>{l}</button>
        ))}
      </div>

      {items.length === 0 && tab !== 'proj' ? (
        <EmptyState icon={Wallet} title="Nenhum investimento cadastrado" subtitle="Cadastre suas aplicações para acompanhar alocação, rentabilidade e a evolução do seu patrimônio." action={<GlowButton tone="violet" onClick={openNew}><Plus className="w-4 h-4" />Novo investimento</GlowButton>} />
      ) : null}

      {items.length > 0 && tab === 'overview' && (
        <>
          {/* Hero: patrimônio + tiles  |  evolução */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Reveal i={0} className="xl:col-span-5">
              <section className="h-full rounded-3xl p-5 ring-1 ring-violet-400/30 shadow-[0_0_40px_-12px_rgba(168,85,247,.45)] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(168,85,247,.22),transparent_55%),radial-gradient(100%_100%_at_100%_100%,rgba(45,212,191,.12),transparent_60%)] bg-[hsl(var(--card))]">
                <div className="flex items-center gap-2 text-sm text-muted">Patrimônio Líquido
                  <span className="group relative"><Info className="w-4 h-4 cursor-help" /><span className="hidden group-hover:block absolute left-0 top-6 z-20 w-64 rounded-xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] p-3 text-xs shadow-xl">Saldo das contas ({formatCurrency(totalAccounts)}) + investimentos ({formatCurrency(current)}) − dívidas em aberto ({formatCurrency(totalDebt)}).</span></span>
                </div>
                <div className="flex items-end justify-between gap-3 mt-1">
                  <div className="min-w-0">
                    <p className="font-display text-4xl font-extrabold truncate"><AnimatedValue value={netWorth} format={formatCurrency} /></p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">{delta12 ? <><DeltaChip v={delta12.v} /> desde {MES[Number(delta12.since.slice(5)) - 1]}/{delta12.since.slice(2, 4)}</> : <span>Histórico começa a ser registrado neste mês</span>}</div>
                  </div>
                  <div className="w-36 h-14 shrink-0">
                    <ResponsiveContainer width="100%" height="100%"><RLine data={series.filter((s) => s.Patrimonio != null)}><Line type="monotone" dataKey="Patrimonio" stroke="#c084fc" strokeWidth={2.5} dot={false} /></RLine></ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <Tile icon={Wallet} color="#38bdf8" label="Investido (total)" value={formatCurrency(invested)} sub="valor aplicado" />
                  <Tile icon={profit >= 0 ? TrendingUp : TrendingDown} color={profit >= 0 ? '#34d399' : '#fb7185'} label="Resultado" value={`${profit >= 0 ? '+' : '−'}${formatCurrency(Math.abs(profit))}`} sub="valor atual − aplicado" />
                  <Tile icon={Percent} color="#a855f7" label="Rentabilidade" value={`${profitPct >= 0 ? '+' : ''}${pct1(profitPct)}`} sub={ind?.cdi != null ? `CDI 12M ${pct1(ind.cdi)}` : 'acumulada'} />
                  <Tile icon={CalendarDays} color="#f59e0b" label={`Aportes (${MES[new Date().getMonth()]})`} value={formatCurrency(aportesMes)} sub="neste mês" />
                </div>
              </section>
            </Reveal>
            <Reveal i={1} className="xl:col-span-7">
              <Panel title="Evolução do Patrimônio" icon={TrendingUp} iconClass="text-violet-400" className="h-full" action={
                <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">
                  {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['12m', '12M'], ['ytd', 'YTD'], ['all', 'Tudo']].map(([v, l]) => <button key={v} onClick={() => setRange(v)} className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${range === v ? 'bg-violet-500/25 text-violet-700 dark:text-violet-200 ring-1 ring-violet-400/50' : 'text-muted'}`}>{l}</button>)}
                </div>}>
                <div className="flex items-center gap-4 text-xs text-muted mb-1"><span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-violet-400" />Patrimônio líquido</span><span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-teal-400" />Aportes acumulados</span></div>
                {evolutionChart(250)}
                <p className="text-[11px] text-muted mt-1">O patrimônio é registrado mês a mês a partir do uso do Monvy; meses sem registro aparecem vazios.</p>
              </Panel>
            </Reveal>
          </div>

          {/* Alocação | Posições | Indicadores + Insights */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Reveal i={2} className="xl:col-span-4">
              <Panel title="Alocação da Carteira" icon={Layers} iconClass="text-teal-400" className="h-full">
                <div className="flex flex-col sm:flex-row xl:flex-col items-center gap-5">
                  <Donut size={190} data={byType.map((t) => ({ name: t.label, value: t.value, color: t.color }))} center={<><span className="text-[11px] text-muted">Total</span><span className="font-display font-bold text-base">{formatCurrency(current)}</span></>} />
                  <div className="flex-1 w-full space-y-2">
                    {byType.map((t) => (
                      <div key={t.v} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} /><span className="flex-1 truncate">{t.label}</span><span className="font-semibold tabular-nums w-14 text-right">{pct1(current > 0 ? (t.value / current) * 100 : 0)}</span><span className="text-xs text-muted w-24 text-right tabular-nums">{formatCurrency(t.value)}</span></div>
                    ))}
                  </div>
                </div>
              </Panel>
            </Reveal>
            <Reveal i={3} className="xl:col-span-4">
              <Panel title="Minhas Posições" icon={Wallet} iconClass="text-sky-400" className="h-full" action={<button onClick={() => setTab('wallet')} className="text-xs font-semibold text-violet-500 dark:text-violet-300 hover:underline flex items-center gap-1">Ver carteira completa<ArrowRight className="w-3.5 h-3.5" /></button>}>
                {posGroups.slice(0, 5).map((g) => (
                  <div key={g.v} className="flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${g.color}22`, color: g.color }}><g.icon className="w-[18px] h-[18px]" /></span>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{g.label}</p><p className="text-[11px] text-muted truncate">{g.items.length} {g.items.length === 1 ? 'ativo' : 'ativos'} • {g.sub}</p></div>
                    <div className="text-right"><p className="font-semibold text-sm">{formatCurrency(g.value)}</p>{g.invested > 0 && <DeltaChip v={g.ret} />}</div>
                  </div>
                ))}
              </Panel>
            </Reveal>
            <Reveal i={4} className="xl:col-span-4 space-y-5">
              <Panel title="Indicadores de Referência" icon={BarChart3} iconClass="text-amber-400" subtitle="Últimos 12 meses • Banco Central do Brasil">
                <div className="grid grid-cols-2 gap-2.5">
                  <IndCard label="Minha carteira" value={invested > 0 ? profitPct : null} color={profitPct >= 0 ? '#a855f7' : '#fb7185'} note="acumulada" />
                  <IndCard label="CDI" value={ind?.cdi} color="#2dd4bf" note="12 meses" />
                  <IndCard label="IPCA" value={ind?.ipca} color="#f59e0b" note="12 meses" />
                  <IndCard label="Ibovespa" value={ind?.ibov} color="#38bdf8" note="~12 meses" />
                </div>
              </Panel>
              <Panel title="Insights" icon={Brain} iconClass="text-pink-400" action={<span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/15 text-pink-500 dark:text-pink-300">Beta</span>}>
                <div className="space-y-2.5">
                  {insights.length ? insights.slice(0, 3).map((x, k) => <InsightRow key={k} {...x} />) : <p className="text-sm text-muted">Cadastre valores atuais para ver comparações.</p>}
                </div>
              </Panel>
            </Reveal>
          </div>

          {/* Objetivos | Próximos passos */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Reveal i={5} className="xl:col-span-7">
              <Panel title="Objetivos vinculados" icon={Target} iconClass="text-emerald-400" action={<button onClick={() => nav('/metas')} className="text-xs font-semibold text-violet-500 dark:text-violet-300 hover:underline flex items-center gap-1">Ver metas<ArrowRight className="w-3.5 h-3.5" /></button>}>
                {goalsActive.length ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {goalsActive.map((g) => { const p = Math.min(100, (Number(g.current_amount || 0) / Number(g.target_amount)) * 100); return (
                      <button key={g.id} onClick={() => nav('/metas')} className="text-left rounded-2xl bg-black/5 dark:bg-white/[.04] ring-1 ring-[hsl(var(--border))] p-3.5 hover:ring-emerald-400/50 transition">
                        <div className="flex items-center justify-between gap-2"><p className="font-semibold text-sm truncate">{g.name}</p><span className="text-xs font-bold text-emerald-500 dark:text-emerald-300">{pct1(p)}</span></div>
                        <p className="text-[11px] text-muted mt-0.5">{formatCurrency(g.current_amount || 0)} de {formatCurrency(g.target_amount)}</p>
                        <Bar pct={p} color="linear-gradient(90deg,#2dd4bf,#a855f7)" className="h-2 mt-2" />
                      </button>); })}
                  </div>
                ) : <p className="text-sm text-muted">Nenhuma meta criada. <button onClick={() => nav('/metas')} className="text-violet-500 font-semibold hover:underline">Criar meta</button></p>}
              </Panel>
            </Reveal>
            <Reveal i={6} className="xl:col-span-5">
              <Panel title="Ferramentas de planejamento" icon={Rocket} iconClass="text-violet-400" subtitle="Simule cenários com seus próprios números">
                <div className="grid grid-cols-2 gap-2.5">
                  {[[Calculator, 'Simulador', 'Aportes e prazos', '/simulador', '#a855f7'], [TrendingUp, 'Juros compostos', 'Crescimento no tempo', '/juros-compostos', '#2dd4bf'], [PiggyBank, 'Poupança x CDB', 'Compare rendimentos', '/poupanca-cdb', '#f59e0b'], [Home, 'Planejador de Objetivo', 'Quanto guardar', '/objetivo', '#38bdf8']].map(([Ic, t, s, to, c]) => (
                    <button key={to} onClick={() => nav(to)} className="text-left rounded-2xl ring-1 ring-[hsl(var(--border))] p-3 hover:ring-violet-400/50 transition flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${c}22`, color: c }}><Ic className="w-[18px] h-[18px]" /></span>
                      <span className="min-w-0"><span className="block text-sm font-semibold truncate">{t}</span><span className="block text-[11px] text-muted truncate">{s}</span></span>
                    </button>
                  ))}
                </div>
              </Panel>
            </Reveal>
          </div>
        </>
      )}

      {items.length > 0 && tab === 'wallet' && (
        <Panel title="Minha Carteira" icon={Wallet} iconClass="text-sky-400" subtitle={`${items.length} ${items.length === 1 ? 'aplicação' : 'aplicações'} • ${formatCurrency(current)} em valor atual`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]"><th className="py-2 font-medium">Ativo</th><th className="font-medium">Classe</th><th className="font-medium">Instituição</th><th className="font-medium text-right">Aplicado</th><th className="font-medium text-right">Atual</th><th className="font-medium text-right">Resultado</th><th className="font-medium text-right">% carteira</th><th /></tr></thead>
              <tbody>
                {sorted.map((i) => { const t = tInfo(i.type); const inv = Number(i.invested_amount || 0), cur = Number(i.current_value || 0); const r = inv > 0 ? ((cur - inv) / inv) * 100 : null; return (
                  <tr key={i.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-black/[.03] dark:hover:bg-white/[.03]">
                    <td className="py-2.5"><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}><t.icon className="w-4 h-4" /></span><div className="min-w-0"><p className="font-semibold truncate max-w-[220px]">{i.name}</p>{(i.ticker || Number(i.quantity) > 0) && <p className="text-[11px] text-muted">{i.ticker ? String(i.ticker).toUpperCase() : ''}{Number(i.quantity) > 0 ? ` • ${Number(i.quantity).toLocaleString('pt-BR')} un.` : ''}</p>}</div></div></td>
                    <td><span className="text-xs px-2 py-0.5 rounded-md" style={{ background: `${t.color}1f`, color: t.color }}>{t.label}</span></td>
                    <td className="text-muted">{i.institution || '—'}</td>
                    <td className="text-right tabular-nums">{formatCurrency(inv)}</td>
                    <td className="text-right tabular-nums font-semibold">{formatCurrency(cur)}</td>
                    <td className="text-right">{r == null ? '—' : <span className={cur - inv >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{cur - inv >= 0 ? '+' : '−'}{formatCurrency(Math.abs(cur - inv))} <span className="text-[11px]">({pct1(r)})</span></span>}</td>
                    <td className="text-right tabular-nums">{pct1(current > 0 ? (cur / current) * 100 : 0)}</td>
                    <td className="text-right whitespace-nowrap"><button onClick={() => openEdit(i)} className="p-1.5 rounded-lg text-muted hover:text-sky-400" aria-label="Editar"><Pencil className="w-4 h-4" /></button><button onClick={() => setToDelete(i)} className="p-1.5 rounded-lg text-muted hover:text-rose-500" aria-label="Excluir"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>); })}
              </tbody>
              <tfoot><tr className="font-semibold"><td className="pt-3" colSpan={3}>Total</td><td className="text-right pt-3">{formatCurrency(invested)}</td><td className="text-right pt-3">{formatCurrency(current)}</td><td className={`text-right pt-3 ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{profit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(profit))}</td><td className="text-right pt-3">100%</td><td /></tr></tfoot>
            </table>
          </div>
        </Panel>
      )}

      {items.length > 0 && tab === 'contrib' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel title="Aportes por mês" icon={BarChart3} iconClass="text-teal-400" className="xl:col-span-7" subtitle="Soma do valor aplicado pela data de cada aplicação (12 meses)">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contribMonthly} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                  <RBar dataKey="Aportes" radius={[6, 6, 0, 0]}>{contribMonthly.map((d) => <Cell key={d.key} fill={d.key === mkNow ? '#a855f7' : '#2dd4bf'} />)}</RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Tile icon={CalendarDays} color="#a855f7" label="Este mês" value={formatCurrency(aportesMes)} />
              <Tile icon={Coins} color="#2dd4bf" label="Últimos 12 meses" value={formatCurrency(contribMonthly.reduce((s, d) => s + d.Aportes, 0))} />
              <Tile icon={Wallet} color="#38bdf8" label="Média mensal" value={formatCurrency(contribMonthly.reduce((s, d) => s + d.Aportes, 0) / 12)} />
            </div>
          </Panel>
          <Panel title="Histórico de aplicações" icon={CalendarDays} iconClass="text-violet-400" className="xl:col-span-5">
            <div className="max-h-[420px] overflow-y-auto pr-1">
              {contribs.length ? contribs.map((i) => { const t = tInfo(i.type); return (
                <div key={i.id} className="flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
                  <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${t.color}22`, color: t.color }}><t.icon className="w-[18px] h-[18px]" /></span>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{i.name}</p><p className="text-[11px] text-muted">{new Date(`${String(i.date).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')} • {t.label}</p></div>
                  <p className="font-semibold text-sm text-teal-500 dark:text-teal-300">+{formatCurrency(i.invested_amount || 0)}</p>
                </div>); }) : <p className="text-sm text-muted">Nenhuma aplicação com data.</p>}
            </div>
          </Panel>
        </div>
      )}

      {items.length > 0 && tab === 'returns' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel title="Rentabilidade por ativo" icon={Percent} iconClass="text-violet-400" className="xl:col-span-8" subtitle="Resultado acumulado sobre o valor aplicado">
            <div className="space-y-3">
              {[...items].filter((i) => Number(i.invested_amount) > 0).map((i) => ({ i, r: ((Number(i.current_value || 0) - Number(i.invested_amount)) / Number(i.invested_amount)) * 100 })).sort((a, b) => b.r - a.r).map(({ i, r }) => { const t = tInfo(i.type); const maxAbs = Math.max(1, ...items.filter((x) => Number(x.invested_amount) > 0).map((x) => Math.abs(((Number(x.current_value || 0) - Number(x.invested_amount)) / Number(x.invested_amount)) * 100))); return (
                <div key={i.id} className="flex items-center gap-3">
                  <span className="w-44 truncate text-sm font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />{i.name}</span>
                  <div className="flex-1"><Bar pct={(Math.abs(r) / maxAbs) * 100} color={r >= 0 ? 'linear-gradient(90deg,#2dd4bf,#a855f7)' : '#fb7185'} className="h-2.5" /></div>
                  <span className={`w-20 text-right text-sm font-semibold tabular-nums ${r >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{r >= 0 ? '+' : ''}{pct1(r)}</span>
                </div>); })}
            </div>
          </Panel>
          <div className="xl:col-span-4 space-y-5">
            <Panel title="Por classe" icon={Layers} iconClass="text-teal-400">
              {byType.map((t) => <div key={t.v} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0 text-sm"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />{t.label}</span>{t.invested > 0 ? <DeltaChip v={t.ret} /> : <span className="text-muted">—</span>}</div>)}
            </Panel>
            <Panel title="Comparativo 12M" icon={BarChart3} iconClass="text-amber-400" subtitle="Fonte: Banco Central do Brasil">
              <div className="grid grid-cols-3 gap-2"><IndCard label="CDI" value={ind?.cdi} color="#2dd4bf" note="12m" /><IndCard label="IPCA" value={ind?.ipca} color="#f59e0b" note="12m" /><IndCard label="Ibovespa" value={ind?.ibov} color="#38bdf8" note="~12m" /></div>
              <p className="text-[11px] text-muted mt-2">A rentabilidade da carteira é acumulada desde cada aplicação; os indicadores cobrem os últimos 12 meses.</p>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'proj' && <Projection start={current} />}

      {/* Modal criar/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar investimento' : 'Novo investimento'} footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><GlowButton tone="violet" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</GlowButton></>}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Nome"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Tesouro Selic 2029" autoFocus /></Field></div>
          <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
          <Field label="Instituição"><Input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Corretora/banco" /></Field>
          <Field label="Valor aplicado"><Input type="number" step="0.01" value={form.invested_amount} onChange={(e) => set('invested_amount', e.target.value)} /></Field>
          <Field label="Valor atual" hint="Vazio = igual ao aplicado"><Input type="number" step="0.01" value={form.current_value} onChange={(e) => set('current_value', e.target.value)} /></Field>
          {['cripto', 'acao', 'fii'].includes(form.type) && <>
            <Field label="Ticker" hint={form.type === 'cripto' ? 'Ex.: BTC, ETH' : 'Ex.: PETR4, HGLG11'}><Input value={form.ticker} onChange={(e) => set('ticker', e.target.value)} /></Field>
            <Field label="Quantidade"><Input type="number" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
          </>}
          <Field label="Data da aplicação"><Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir investimento" footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button><button onClick={() => del.mutate(toDelete.id)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">Excluir</button></>}>
        <p className="text-sm">Excluir <b>{toDelete?.name}</b>? Essa ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}

// Projeção com parâmetros do próprio usuário (cenário hipotético, não é recomendação)
function Projection({ start }) {
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(10);
  const data = useMemo(() => {
    const r = Math.pow(1 + Number(rate || 0) / 100, 1 / 12) - 1; let v = Number(start || 0), ap = Number(start || 0); const out = [{ name: 'Hoje', Projetado: Math.round(v), Aportado: Math.round(ap) }];
    for (let m = 1; m <= Number(years || 0) * 12; m++) { v = v * (1 + r) + Number(monthly || 0); ap += Number(monthly || 0); if (m % 12 === 0) out.push({ name: `Ano ${m / 12}`, Projetado: Math.round(v), Aportado: Math.round(ap) }); }
    return out;
  }, [start, monthly, rate, years]);
  const last = data[data.length - 1];
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <Panel title="Parâmetros" icon={Calculator} iconClass="text-violet-400" className="xl:col-span-4" subtitle="Cenário hipotético com valores informados por você">
        <div className="space-y-3">
          <Field label="Valor inicial (carteira atual)"><Input value={formatCurrency(start)} disabled /></Field>
          <Field label="Aporte mensal (R$)"><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
          <Field label="Taxa anual estimada (%)"><Input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          <Field label="Prazo (anos)"><Input type="number" min="1" max="50" value={years} onChange={(e) => setYears(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl ring-1 ring-violet-400/40 bg-violet-500/10 p-3"><p className="text-[11px] text-muted">Valor projetado</p><p className="font-display font-bold text-lg">{formatCurrency(last.Projetado)}</p></div>
          <div className="rounded-2xl ring-1 ring-teal-400/40 bg-teal-500/10 p-3"><p className="text-[11px] text-muted">Total aportado</p><p className="font-display font-bold text-lg">{formatCurrency(last.Aportado)}</p></div>
        </div>
        <p className="text-[11px] text-muted mt-3">Simulação matemática com taxa constante, sem impostos e taxas. Não é garantia de rentabilidade nem recomendação de investimento.</p>
      </Panel>
      <Panel title="Projeção do patrimônio investido" icon={TrendingUp} iconClass="text-violet-400" className="xl:col-span-8">
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs><linearGradient id="prjA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => (v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
              <Area type="monotone" dataKey="Aportado" stroke="#2dd4bf" strokeDasharray="5 4" strokeWidth={2} fill="none" />
              <Area type="monotone" dataKey="Projetado" stroke="#a855f7" strokeWidth={3} fill="url(#prjA)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
