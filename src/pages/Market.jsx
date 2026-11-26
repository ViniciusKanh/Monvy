import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account } from '../api/entities.js';
import { Spinner, Input, Select } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, GlowButton, DeltaChip, TIP } from '../components/kit.jsx';
import { MarketArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries } from '../lib/analytics.js';
import { getFxAlerts, addFxAlert, removeFxAlert, isHit } from '../lib/fxAlerts.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  DollarSign, Euro, Bitcoin, TrendingUp, TrendingDown, Percent, Landmark,
  Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, AlertTriangle, PiggyBank,
  Bell, Trash2, Plus, CheckCircle2, Info, Activity, LineChart as LineIcon,
} from 'lucide-react';

const fmt = (v) => formatCurrency(v);
const pc = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2).replace('.', ','));

// APIs publicas e gratuitas (sem chave): AwesomeAPI (cotacoes) e BrasilAPI (taxas oficiais)
async function fetchQuotes() {
  const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
  if (!r.ok) throw new Error('Falha ao buscar cotacoes');
  return r.json();
}
async function fetchRates() {
  const r = await fetch('https://brasilapi.com.br/api/taxas/v1');
  if (!r.ok) throw new Error('Falha ao buscar indicadores');
  return r.json();
}
async function fetchHistory() {
  const r = await fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/180');
  if (!r.ok) throw new Error('Falha ao buscar histórico');
  return r.json();
}

const QUOTE_DEFS = [
  { key: 'USDBRL', label: 'Dólar', icon: DollarSign, color: '#34d399' },
  { key: 'EURBRL', label: 'Euro', icon: Euro, color: '#818cf8' },
  { key: 'BTCBRL', label: 'Bitcoin', icon: Bitcoin, color: '#fbbf24' },
];

export default function Market() {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const quotesQ = useQuery({ queryKey: ['market-quotes'], queryFn: fetchQuotes, retry: 1, staleTime: 30_000, refetchInterval: 60_000 });
  const ratesQ = useQuery({ queryKey: ['market-rates'], queryFn: fetchRates, retry: 1, staleTime: 3_600_000 });
  const histQ = useQuery({ queryKey: ['market-hist'], queryFn: fetchHistory, retry: 1, staleTime: 3_600_000 });

  const history = useMemo(() => {
    const arr = Array.isArray(histQ.data) ? histQ.data : [];
    return arr.map((d) => ({ t: Number(d.timestamp) * 1000, v: Number(d.bid) }))
      .filter((d) => d.v > 0).sort((a, b) => a.t - b.t)
      .map((d) => ({ name: new Date(d.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), v: d.v }));
  }, [histQ.data]);
  const hMin = history.length ? Math.min(...history.map((h) => h.v)) : 0;
  const hMax = history.length ? Math.max(...history.map((h) => h.v)) : 0;
  const hNow = history.length ? history[history.length - 1].v : 0;

  // perfil financeiro do usuário
  const series = useMemo(() => monthlySeries(transactions, lastMonths(6)), [transactions]);
  const avgInc = series.reduce((a, s) => a + s.inc, 0) / (series.length || 1);
  const avgExp = series.reduce((a, s) => a + s.exp, 0) / (series.length || 1);
  const surplus = Math.max(0, avgInc - avgExp);
  const savingsRate = avgInc > 0 ? ((avgInc - avgExp) / avgInc) * 100 : 0;
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const q = quotesQ.data || {};
  const quotes = QUOTE_DEFS.map((d) => { const o = q[d.key] || {}; return { ...d, bid: Number(o.bid) || 0, pct: Number(o.pctChange) || 0, name: o.name }; });

  const rates = Array.isArray(ratesQ.data) ? ratesQ.data : [];
  const rate = (nome) => { const f = rates.find((r) => (r.nome || '').toLowerCase() === nome.toLowerCase()); return f ? Number(f.valor) : null; };
  const selic = rate('Selic'); const cdi = rate('CDI'); const ipca = rate('IPCA');

  // rendimento potencial: sobra mensal aplicada 12 meses no CDI
  const cdiFut = useMemo(() => {
    if (!cdi || surplus <= 0) return null;
    const m = Math.pow(1 + cdi / 100, 1 / 12) - 1; // taxa mensal equivalente
    let bal = 0; for (let i = 0; i < 12; i++) bal = (bal + surplus) * (1 + m);
    const aportado = surplus * 12;
    return { bal, aportado, rendimento: bal - aportado };
  }, [cdi, surplus]);

  // impacto da inflacao no dinheiro parado (saldo atual) em 12 meses
  const inflaLoss = useMemo(() => {
    if (!ipca || totalBalance <= 0) return null;
    const poder = totalBalance / (1 + ipca / 100); // poder de compra daqui 1 ano
    return { poder, perda: totalBalance - poder };
  }, [ipca, totalBalance]);

  // metricas de apoio (validadas): taxa mensal do CDI, ganho real vs inflacao e exemplo de R$1.000
  const cdiM = cdi != null ? (Math.pow(1 + cdi / 100, 1 / 12) - 1) * 100 : null; // % ao mês
  const realRate = (cdi != null && ipca != null) ? (((1 + cdi / 100) / (1 + ipca / 100)) - 1) * 100 : null; // ganho real anual
  const ex1000 = ipca != null ? 1000 / (1 + ipca / 100) : null; // poder de compra de R$1.000 em 1 ano
  const poupYear = 6.17; // rendimento aproximado da poupança a.a. (referência)

  const loading = quotesQ.isLoading && ratesQ.isLoading;
  const refetchAll = () => { quotesQ.refetch(); ratesQ.refetch(); histQ.refetch(); };

  // Alertas de câmbio (watchlist local)
  const [fxAlerts, setFxAlertsState] = useState(() => getFxAlerts());
  const [nf, setNf] = useState({ code: 'USD', dir: 'above', value: '' });
  const currentOf = (code) => Number((q[`${code}BRL`] || {}).bid) || 0;
  const addAlert = () => { const v = Number(String(nf.value).replace(',', '.')); if (!v) return; setFxAlertsState(addFxAlert({ code: nf.code, dir: nf.dir, value: v })); setNf((s) => ({ ...s, value: '' })); };
  const delAlert = (id) => setFxAlertsState(removeFxAlert(id));

  const hVar = history.length > 1 ? ((hNow - history[0].v) / history[0].v) * 100 : null;
  const updated = quotesQ.dataUpdatedAt ? new Date(quotesQ.dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const err = (msg) => <div className="py-6 text-center text-sm text-muted"><AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />{msg}</div>;
  const RATES = [
    { l: 'Selic', hint: 'Taxa básica de juros', v: selic, icon: Landmark, c: '#818cf8' },
    { l: 'CDI', hint: 'Referência da renda fixa', v: cdi, icon: Percent, c: '#34d399' },
    { l: 'IPCA', hint: 'Inflação oficial (acum. 12m)', v: ipca, icon: TrendingUp, c: '#fb7185' },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Activity} lead="Mercado &" accent="Indicadores" iconClass="text-emerald-400" subtitle="Cotações e índices oficiais conectados às suas finanças."
        art={<MarketArt className="w-80 h-36 opacity-90" />}
        actions={<button onClick={refetchAll} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-black/5 dark:hover:bg-white/10 xl:mr-[21rem]" title="Atualizar"><RefreshCw className={`w-4 h-4 ${(quotesQ.isFetching || ratesQ.isFetching) ? 'animate-spin' : ''}`} />Atualizar</button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quotes.map((c) => (
          <div key={c.key} className="relative overflow-hidden rounded-2xl ring-1 bg-[hsl(var(--card))] p-4" style={{ '--tw-ring-color': `${c.color}66`, backgroundImage: `linear-gradient(135deg,${c.color}2e,transparent 70%)`, boxShadow: `0 0 26px -10px ${c.color}` }}>
            <svg className="absolute right-0 bottom-0 w-2/3 h-10 pointer-events-none opacity-60" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden><path d="M0 40 C40 30 60 10 100 20 C140 30 160 8 200 4 L200 40 Z" fill={c.color} fillOpacity=".14" /></svg>
            <div className="relative flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: `${c.color}26`, color: c.color }}><c.icon className="w-6 h-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{c.label} (BRL)</p>
                <p className="font-display text-2xl font-bold truncate">{quotesQ.isError ? '—' : quotesQ.isLoading ? <Spinner className="w-4 h-4" /> : c.bid ? <AnimatedValue value={c.bid} format={fmt} /> : '—'}</p>
                <p className="text-[11px] text-muted">{quotesQ.isError ? 'indisponível agora' : updated ? `atualizado às ${updated}` : 'cotação de hoje'}</p>
              </div>
              {c.bid > 0 && <DeltaChip v={c.pct} className="self-start" />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-8" tone="emerald" title="Dólar — últimos 180 dias" icon={DollarSign} iconClass="text-emerald-400"
          action={history.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs justify-end">
            {[['mín', hMin, 'ring-[hsl(var(--border))]'], ['máx', hMax, 'ring-[hsl(var(--border))]'], ['atual', hNow, 'ring-emerald-400/50 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10']].map(([l, v, cls]) => <span key={l} className={`px-2.5 py-1 rounded-lg ring-1 font-semibold ${cls}`}>{l} {fmt(v)}</span>)}
            {hVar != null && <DeltaChip v={hVar} />}
          </div>}>
          {histQ.isLoading ? <div className="h-[260px] grid place-items-center"><Spinner className="w-6 h-6 text-emerald-500" /></div>
            : histQ.isError || history.length === 0 ? <div className="h-[260px] grid place-items-center">{err('Não foi possível carregar o histórico.')}</div>
            : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="usdHist" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.4} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                  <YAxis width={56} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(v) => [fmt(v), 'USD/BRL']} contentStyle={TIP} />
                  <Area dataKey="v" stroke="#34d399" strokeWidth={2.5} fill="url(#usdHist)" style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,.5))' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          <p className="text-[11px] text-muted mt-1">Fonte: AwesomeAPI (cotação de compra diária).</p>
        </Panel>

        <Panel className="xl:col-span-4" tone="violet" title="Indicadores econômicos" subtitle="Fonte: BrasilAPI · % ao ano" icon={Landmark} iconClass="text-violet-400">
          {ratesQ.isError ? err('Não foi possível carregar os indicadores.') : (
            <div className="space-y-3">
              {RATES.map((r) => (
                <div key={r.l} className="flex items-center gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] p-3">
                  <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${r.c}26`, color: r.c }}><r.icon className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0"><p className="font-semibold">{r.l}</p><p className="text-[11px] text-muted">{r.hint}</p></div>
                  <b className="font-display text-xl" style={{ color: r.c }}>{ratesQ.isLoading ? <Spinner className="w-4 h-4" /> : r.v != null ? `${r.v.toFixed(2).replace('.', ',')}%` : '—'}</b>
                </div>
              ))}
              {realRate != null && <div className={`rounded-2xl ring-1 p-3 text-sm ${realRate >= 0 ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-rose-400/50 bg-rose-500/10'}`}>Ganho real do CDI: <b className={realRate >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}>{realRate >= 0 ? '+' : ''}{realRate.toFixed(2).replace('.', ',')}% a.a.</b> <span className="text-[11px] text-muted block">((1+CDI) ÷ (1+IPCA)) − 1</span></div>}
            </div>
          )}
        </Panel>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-400" />O que isso significa para você <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-400/40">Auto</span></h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel tone="emerald" title="Rendimento potencial" icon={PiggyBank} iconClass="text-emerald-400">
            {cdiFut ? (
              <>
                <p className="text-sm text-muted leading-relaxed">Guardando sua sobra média de <b className="text-[hsl(var(--text))]">{fmt(surplus)}/mês</b> num investimento que rende o CDI ({pc(cdi)}% a.a., ou <b>{pc(cdiM)}% a.m.</b>), em 12 meses você teria <b className="text-emerald-500">{fmt(cdiFut.bal)}</b>.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl ring-1 ring-[hsl(var(--border))] p-2.5"><p className="text-[11px] text-muted">Você aporta</p><p className="font-bold text-sm">{fmt(cdiFut.aportado)}</p></div>
                  <div className="rounded-xl ring-1 ring-emerald-400/40 bg-emerald-500/10 p-2.5"><p className="text-[11px] text-muted">Só de rendimento</p><p className="font-bold text-sm text-emerald-500">+{fmt(cdiFut.rendimento)}</p></div>
                </div>
                <p className="text-[11px] text-muted mt-2">Juros compostos mês a mês até o 12º mês. Referência, sem impostos.</p>
              </>
            ) : <p className="text-sm text-muted">{cdi == null ? 'Aguardando o CDI para calcular.' : 'Registre receitas e despesas para o Monvy estimar quanto sua sobra mensal renderia no CDI.'}</p>}
            <p className="mt-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ${savingsRate >= 20 ? 'ring-emerald-400/50 text-emerald-600 dark:text-emerald-300' : 'ring-amber-400/50 text-amber-600 dark:text-amber-300'}`}>Sua taxa de poupança: {savingsRate.toFixed(0)}%</span></p>
          </Panel>
          <Panel tone="rose" title="Impacto da inflação" icon={TrendingDown} iconClass="text-rose-400">
            {inflaLoss ? (
              <>
                <p className="text-sm text-muted leading-relaxed">Com o IPCA em {pc(ipca)}% a.a., seu saldo parado de <b className="text-[hsl(var(--text))]">{fmt(totalBalance)}</b> perde cerca de <b className="text-rose-500">{fmt(inflaLoss.perda)}</b> de poder de compra em 12 meses.</p>
                <p className="text-sm text-muted mt-1">Daqui a 1 ano, esse dinheiro compraria o equivalente a <b className="text-[hsl(var(--text))]">{fmt(inflaLoss.poder)}</b> de hoje.</p>
                {ex1000 != null && <div className="mt-3 rounded-xl ring-1 ring-[hsl(var(--border))] p-2.5 text-xs">Exemplo: <b>R$ 1.000</b> hoje valeriam <b>{fmt(ex1000)}</b> em 1 ano se ficarem parados.</div>}
              </>
            ) : <p className="text-sm text-muted">{ipca == null ? 'Aguardando o IPCA para calcular.' : 'Cadastre suas contas para ver quanto a inflação corrói o dinheiro parado.'}</p>}
          </Panel>
          <Panel tone="violet" title="Ganho real & comparação" icon={Percent} iconClass="text-violet-400">
            {realRate != null ? (
              <>
                <p className="text-sm text-muted leading-relaxed">O que importa é o <b className="text-[hsl(var(--text))]">ganho real</b> (acima da inflação). Rendendo o CDI com IPCA de {pc(ipca)}%, seu ganho real é de <b className={realRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{realRate >= 0 ? '+' : ''}{pc(realRate)}% a.a.</b></p>
                <div className="mt-3 space-y-1.5 text-xs">
                  {[['CDI (renda fixa)', `${pc(cdi)}% a.a.`, ''], ['Poupança (ref.)', `~${pc(poupYear)}% a.a.`, ''], ['Inflação (IPCA)', `${pc(ipca)}% a.a.`, 'text-rose-500']].map(([l, v, c]) => <div key={l} className="flex justify-between rounded-lg ring-1 ring-[hsl(var(--border))] px-2.5 py-1.5"><span className="text-muted">{l}</span><b className={c}>{v}</b></div>)}
                </div>
              </>
            ) : <p className="text-sm text-muted">{ratesQ.isError ? 'Indicadores indisponíveis no momento.' : 'Carregando indicadores para calcular o ganho real…'}</p>}
          </Panel>
        </div>
      </div>

      <Panel tone="amber" title="Alertas de câmbio" subtitle="Defina um alvo e o sino de notificações avisa quando a cotação bater." icon={Bell} iconClass="text-amber-400">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <Select value={nf.code} onChange={(e) => setNf((s) => ({ ...s, code: e.target.value }))}><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option><option value="BTC">Bitcoin (BTC)</option></Select>
          <Select value={nf.dir} onChange={(e) => setNf((s) => ({ ...s, dir: e.target.value }))}><option value="above">subir acima de</option><option value="below">cair abaixo de</option></Select>
          <Input type="number" step="0.01" value={nf.value} onChange={(e) => setNf((s) => ({ ...s, value: e.target.value }))} placeholder="R$ alvo" />
          <GlowButton tone="emerald" onClick={addAlert} disabled={!nf.value} className="justify-center"><Plus className="w-4 h-4" />Adicionar</GlowButton>
        </div>
        {fxAlerts.length > 0 && (
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {fxAlerts.map((a) => { const cur = currentOf(a.code); const hit = isHit(a, cur); return (
              <div key={a.id} className={`flex items-center gap-3 p-2.5 rounded-xl ring-1 ${hit ? 'ring-emerald-400/50 bg-emerald-500/10' : 'ring-[hsl(var(--border))]'}`}>
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${hit ? 'bg-emerald-500 text-white' : 'bg-amber-500/15 text-amber-500'}`}>{hit ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">{a.code} {a.dir === 'above' ? 'acima de' : 'abaixo de'} {fmt(a.value)}</p><p className="text-xs text-muted">atual: {cur ? fmt(cur) : '—'}{hit ? ' · alvo atingido!' : ''}</p></div>
                <button onClick={() => delAlert(a.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10" aria-label="Remover alerta"><Trash2 className="w-4 h-4" /></button>
              </div>
            ); })}
          </div>
        )}
      </Panel>

      <p className="text-xs text-muted text-center flex items-center justify-center gap-1.5"><Info className="w-3.5 h-3.5" />Dados de fontes públicas (AwesomeAPI e BrasilAPI). Conteúdo informativo — não é recomendação de investimento.</p>
    </div>
  );
}
