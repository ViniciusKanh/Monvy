import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Investment, Account, Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Plus, Pencil, Trash2, LineChart, Wallet, Coins, RefreshCw } from 'lucide-react';

// mapa de simbolos cripto -> id CoinGecko (para cotacao automatica, gratis e sem chave)
const CG = { btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', usdc: 'usd-coin', matic: 'matic-network', dot: 'polkadot', ltc: 'litecoin', link: 'chainlink', avax: 'avalanche-2', trx: 'tron', shib: 'shiba-inu', ton: 'the-open-network', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near' };

const TYPES = [
  { v: 'renda_fixa', label: 'Renda fixa', color: '#10b981' },
  { v: 'tesouro', label: 'Tesouro Direto', color: '#0ea5e9' },
  { v: 'acao', label: 'Acoes', color: '#6366f1' },
  { v: 'fii', label: 'Fundos imobiliarios', color: '#8b5cf6' },
  { v: 'fundo', label: 'Fundos', color: '#f59e0b' },
  { v: 'cripto', label: 'Cripto', color: '#f43f5e' },
  { v: 'outro', label: 'Outro', color: '#64748b' },
];
const tInfo = (v) => TYPES.find((t) => t.v === v) || TYPES[TYPES.length - 1];
const empty = { name: '', type: 'renda_fixa', institution: '', invested_amount: '', current_value: '', ticker: '', quantity: '', date: todayIso(), color: '#6366f1' };

export default function Investments() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const inval = () => qc.invalidateQueries({ queryKey: ['investments'] });
  const save = useMutation({ mutationFn: (p) => editing ? Investment.update(editing.id, p) : Investment.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Investment.remove(id), onSuccess: inval });

  const [quoting, setQuoting] = useState(false);
  const updateQuotes = async () => {
    const crypto = items.filter((i) => i.type === 'cripto' && Number(i.quantity) > 0 && i.ticker);
    const stocks = items.filter((i) => (i.type === 'acao' || i.type === 'fii') && Number(i.quantity) > 0 && i.ticker);
    if (!crypto.length && !stocks.length) { toast.info('Informe tipo (cripto/acao/FII), ticker e quantidade nas aplicacoes para atualizar automaticamente.'); return; }
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
      toast.success(`${updated} cotacao(oes) atualizada(s)${failed ? `. ${failed} nao encontrada(s) — confira o ticker.` : '.'}`);
    } catch { toast.error('Falha ao buscar cotacoes'); } finally { setQuoting(false); }
  };

  const invested = items.reduce((s, i) => s + Number(i.invested_amount || 0), 0);
  const current = items.reduce((s, i) => s + Number(i.current_value || 0), 0);
  const profit = current - invested;
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
  const totalAccounts = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalDebt = debts.reduce((s, d) => s + Number(d.total_amount || 0) * (1 - Number(d.paid_installments || 0) / Math.max(1, Number(d.installments || 1))), 0);
  const netWorth = totalAccounts + current - totalDebt;

  const byType = useMemo(() => {
    const m = {};
    for (const i of items) { const t = tInfo(i.type); m[t.v] = m[t.v] || { name: t.label, value: 0, color: t.color }; m[t.v].value += Number(i.current_value || 0); }
    return Object.values(m).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }, [items]);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (i) => { setEditing(i); setForm({ name: i.name, type: i.type, institution: i.institution || '', invested_amount: i.invested_amount ?? '', current_value: i.current_value ?? '', ticker: i.ticker || '', quantity: i.quantity ?? '', date: (i.date || todayIso()).slice(0, 10), color: tInfo(i.type).color }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, invested_amount: Number(form.invested_amount || 0), current_value: Number(form.current_value || 0) || Number(form.invested_amount || 0), quantity: Number(form.quantity || 0), color: tInfo(form.type).color }); };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><LineChart className="w-6 h-6 text-indigo-500" /> Investimentos & Patrimonio</span>}
        subtitle="Acompanhe suas aplicacoes e o seu patrimonio liquido"
        actions={<div className="flex gap-2"><Button variant="outline" onClick={updateQuotes} disabled={quoting}>{quoting ? <Spinner className="w-4 h-4" /> : <><RefreshCw className="w-4 h-4" /> Atualizar cotacoes</>}</Button><Button onClick={openNew}><Plus className="w-4 h-4" /> Novo investimento</Button></div>} />

      {/* Patrimonio liquido */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-soft ring-1 ring-white/10" style={{ background: 'linear-gradient(135deg,#0b1330 0%,#1e1b4b 55%,#312e81 100%)' }}>
        <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full glow-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,.3), transparent 68%)' }} />
        <div className="relative">
          <p className="text-[11px] tracking-[0.28em] text-indigo-200 font-medium">PATRIMONIO LIQUIDO</p>
          <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={netWorth} format={formatCurrency} /></p>
          <div className="grid grid-cols-3 gap-3 mt-4 max-w-lg">
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-300">Contas</p><p className="font-bold text-emerald-300">{formatCurrency(totalAccounts)}</p></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-300">Investido (atual)</p><p className="font-bold text-indigo-300">{formatCurrency(current)}</p></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5"><p className="text-[11px] text-slate-300">Dividas</p><p className="font-bold text-rose-300">−{formatCurrency(totalDebt)}</p></div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Patrimonio = contas + investimentos − dividas em aberto.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Kpi icon={Wallet} label="Valor investido" value={invested} color="#6366f1" /></Reveal>
        <Reveal i={1}><Kpi icon={LineChart} label="Valor atual" value={current} color="#0ea5e9" /></Reveal>
        <Reveal i={2}><Kpi icon={profit >= 0 ? TrendingUp : TrendingDown} label="Resultado" value={profit} color={profit >= 0 ? '#10b981' : '#f43f5e'} /></Reveal>
        <Reveal i={3}><Kpi icon={TrendingUp} label="Rentabilidade" value={profitPct} pct color={profitPct >= 0 ? '#10b981' : '#f43f5e'} /></Reveal>
      </div>

      {items.length === 0 ? <Card><EmptyState icon={Coins} title="Nenhum investimento" subtitle="Cadastre suas aplicacoes para acompanhar rentabilidade e patrimonio." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Novo investimento</Button>} /></Card>
        : (
          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="hover-lift">
              <h3 className="font-semibold mb-2">Alocacao por tipo</h3>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={byType} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">{byType.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs text-muted">total</span><span className="font-display font-bold">{formatCurrency(current)}</span></div>
              </div>
              <div className="space-y-1.5 mt-2">{byType.map((c, i) => (<div key={i} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div>))}</div>
            </Card>

            <div className="lg:col-span-2 space-y-2">
              {items.map((i, idx) => { const t = tInfo(i.type); const p = Number(i.current_value || 0) - Number(i.invested_amount || 0); const pp = Number(i.invested_amount) > 0 ? (p / Number(i.invested_amount)) * 100 : 0; return (
                <Reveal key={i.id} i={Math.min(idx, 10)}>
                  <Card className="py-3 hover-lift">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: t.color }}><LineChart className="w-5 h-5" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{i.name}{i.ticker ? ` · ${i.ticker}` : ''}</p>
                        <p className="text-xs text-muted">{t.label}{i.institution ? ` · ${i.institution}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{formatCurrency(i.current_value)}</p>
                        <p className={`text-xs font-medium ${p >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{p >= 0 ? '+' : ''}{formatCurrency(p)} ({pp >= 0 ? '+' : ''}{pp.toFixed(1)}%)</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(i)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del.mutate(i.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ); })}
            </div>
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar investimento' : 'Novo investimento'} maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: CDB Banco X" /></Field>
            <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor investido (R$)"><Input type="number" step="0.01" value={form.invested_amount} onChange={(e) => set('invested_amount', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Valor atual (R$)" hint="Deixe vazio = igual ao investido"><Input type="number" step="0.01" value={form.current_value} onChange={(e) => set('current_value', e.target.value)} placeholder="0,00" /></Field>
          </div>
          <Field label="Instituicao"><Input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Ex: Nubank, XP..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker / simbolo"><Input value={form.ticker} onChange={(e) => set('ticker', e.target.value)} placeholder="Ex: BTC, PETR4, MXRF11" /></Field>
            <Field label="Quantidade"><Input type="number" step="0.00000001" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="0" /></Field>
          </div>
          {(form.type === 'cripto' || form.type === 'acao' || form.type === 'fii') && <p className="text-xs text-muted flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Com ticker e quantidade, o botao "Atualizar cotacoes" busca o preco e recalcula o valor atual automaticamente (cripto via CoinGecko; acoes/FIIs via brapi).</p>}
        </form>
      </Modal>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, pct }) {
  return (
    <Card className="py-4 hover-lift">
      <div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><Icon className="w-4 h-4" style={{ color }} /></div>
      <p className="font-display text-xl font-bold mt-1" style={{ color }}><AnimatedValue value={value} format={(v) => (pct ? `${v.toFixed(1)}%` : formatCurrency(v))} /></p>
    </Card>
  );
}
