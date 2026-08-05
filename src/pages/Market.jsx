import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge, Button, Input, Select } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries } from '../lib/analytics.js';
import { getFxAlerts, addFxAlert, removeFxAlert, isHit } from '../lib/fxAlerts.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  DollarSign, Euro, Bitcoin, TrendingUp, TrendingDown, Percent, Landmark,
  Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, AlertTriangle, PiggyBank,
  Bell, Trash2, Plus, CheckCircle2,
} from 'lucide-react';

const fmt = (v) => formatCurrency(v);

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
  if (!r.ok) throw new Error('Falha ao buscar historico');
  return r.json();
}

const QUOTE_DEFS = [
  { key: 'USDBRL', label: 'Dolar', icon: DollarSign, color: '#10b981' },
  { key: 'EURBRL', label: 'Euro', icon: Euro, color: '#6366f1' },
  { key: 'BTCBRL', label: 'Bitcoin', icon: Bitcoin, color: '#f59e0b' },
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

  // perfil financeiro do usuario
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
  const cdiM = cdi != null ? (Math.pow(1 + cdi / 100, 1 / 12) - 1) * 100 : null; // % ao mes
  const realRate = (cdi != null && ipca != null) ? (((1 + cdi / 100) / (1 + ipca / 100)) - 1) * 100 : null; // ganho real anual
  const ex1000 = ipca != null ? 1000 / (1 + ipca / 100) : null; // poder de compra de R$1.000 em 1 ano
  const poupYear = 6.17; // rendimento aproximado da poupanca a.a. (referencia)

  const loading = quotesQ.isLoading && ratesQ.isLoading;
  const refetchAll = () => { quotesQ.refetch(); ratesQ.refetch(); histQ.refetch(); };

  // Alertas de cambio (watchlist local)
  const [fxAlerts, setFxAlertsState] = useState(() => getFxAlerts());
  const [nf, setNf] = useState({ code: 'USD', dir: 'above', value: '' });
  const currentOf = (code) => Number((q[`${code}BRL`] || {}).bid) || 0;
  const addAlert = () => { const v = Number(String(nf.value).replace(',', '.')); if (!v) return; setFxAlertsState(addFxAlert({ code: nf.code, dir: nf.dir, value: v })); setNf((s) => ({ ...s, value: '' })); };
  const delAlert = (id) => setFxAlertsState(removeFxAlert(id));

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title={<span className="flex items-center gap-2"><TrendingUp className="w-6 h-6 text-emerald-500" /> Mercado & Indicadores</span>}
        subtitle="Cotacoes e indices oficiais conectados as suas financas"
        actions={<button onClick={refetchAll} className="p-2.5 rounded-xl card hover:bg-black/5 dark:hover:bg-white/10" title="Atualizar"><RefreshCw className={`w-5 h-5 ${(quotesQ.isFetching || ratesQ.isFetching) ? 'animate-spin' : ''}`} /></button>}
      />

      {/* Cotacoes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Cotacoes de hoje</h3>
          {quotes[0]?.name && <span className="text-xs text-muted">fonte: AwesomeAPI</span>}
        </div>
        {quotesQ.isError ? (
          <Card className="py-6 text-center text-sm text-muted"><AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />Nao foi possivel carregar as cotacoes. Verifique sua conexao e tente atualizar.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quotes.map((c, i) => (
              <Reveal key={c.key} i={i}>
                <Card className="hover-lift">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: c.color }}><c.icon className="w-4 h-4" /></span>
                    {isFinite(c.pct) && (
                      <span className={`text-xs font-semibold flex items-center gap-0.5 ${c.pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{c.pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(c.pct).toFixed(2)}%</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-2">{c.label} (BRL)</p>
                  <p className="font-display text-2xl font-bold">{quotesQ.isLoading ? <Spinner className="w-4 h-4" /> : <AnimatedValue value={c.bid} format={fmt} />}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {/* Historico do dolar */}
      <Card className="hover-lift">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /> Dolar — ultimos 180 dias</h3>
          {history.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Badge color="slate">min {fmt(hMin)}</Badge>
              <Badge color="slate">max {fmt(hMax)}</Badge>
              <Badge color="emerald">atual {fmt(hNow)}</Badge>
            </div>
          )}
        </div>
        {histQ.isLoading ? (
          <div className="h-[240px] flex items-center justify-center"><Spinner className="w-6 h-6 text-emerald-500" /></div>
        ) : histQ.isError || history.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-sm text-muted"><AlertTriangle className="w-6 h-6 mb-2 text-amber-500" />Nao foi possivel carregar o historico.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={history} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs><linearGradient id="usdHist" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis width={52} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v) => [fmt(v), 'USD/BRL']} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              <Area dataKey="v" stroke="#10b981" strokeWidth={2.5} fill="url(#usdHist)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Indicadores */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Indicadores economicos</h3>
          {rates.length > 0 && <span className="text-xs text-muted">fonte: BrasilAPI · % ao ano</span>}
        </div>
        {ratesQ.isError ? (
          <Card className="py-6 text-center text-sm text-muted"><AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />Nao foi possivel carregar os indicadores. Tente atualizar.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <RateCard label="Selic" hint="Taxa basica de juros" value={selic} loading={ratesQ.isLoading} icon={Landmark} color="#6366f1" />
            <RateCard label="CDI" hint="Referencia da renda fixa" value={cdi} loading={ratesQ.isLoading} icon={Percent} color="#10b981" />
            <RateCard label="IPCA" hint="Inflacao oficial (acum. 12m)" value={ipca} loading={ratesQ.isLoading} icon={TrendingUp} color="#f43f5e" />
          </div>
        )}
      </div>

      {/* O que isso significa para voce */}
      <div>
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" /> O que isso significa para voce</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="hover-lift">
            <div className="flex items-center gap-2 mb-2"><span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center"><PiggyBank className="w-4 h-4" /></span><h4 className="font-semibold">Rendimento potencial</h4></div>
            {cdiFut ? (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Guardando sua sobra media de <b className="text-[hsl(var(--text))]">{fmt(surplus)}/mes</b> num investimento que rende o CDI ({cdi?.toFixed(2)}% ao ano, ou <b>{cdiM?.toFixed(2)}% ao mes</b>), em 12 meses voce teria <b className="text-emerald-500">{fmt(cdiFut.bal)}</b>.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2"><p className="text-[11px] text-muted">Voce aporta</p><p className="font-bold text-sm">{fmt(cdiFut.aportado)}</p></div>
                  <div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-[11px] text-muted">So de rendimento</p><p className="font-bold text-sm text-emerald-500">+{fmt(cdiFut.rendimento)}</p></div>
                </div>
                <p className="text-[11px] text-muted mt-2">Calculo: cada aporte rende juros compostos mes a mes ate o 12º mes. Referencia, sem impostos.</p>
              </>
            ) : (
              <p className="text-sm text-muted">Registre receitas e despesas para o Monvy estimar quanto sua sobra mensal renderia no CDI.</p>
            )}
            <p className="mt-3 text-xs"><Badge color={savingsRate >= 20 ? 'emerald' : 'amber'}>Sua taxa de poupanca: {savingsRate.toFixed(0)}%</Badge></p>
          </Card>

          <Card className="hover-lift">
            <div className="flex items-center gap-2 mb-2"><span className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center"><TrendingDown className="w-4 h-4" /></span><h4 className="font-semibold">Impacto da inflacao</h4></div>
            {inflaLoss ? (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Com o IPCA em {ipca?.toFixed(2)}% ao ano, seu saldo parado de <b className="text-[hsl(var(--text))]">{fmt(totalBalance)}</b> perde cerca de <b className="text-rose-500">{fmt(inflaLoss.perda)}</b> de poder de compra em 12 meses.
                </p>
                <p className="text-sm text-muted mt-1">Ou seja: daqui a 1 ano, esse dinheiro compraria o equivalente a <b className="text-[hsl(var(--text))]">{fmt(inflaLoss.poder)}</b> de hoje.</p>
                {ex1000 != null && <div className="mt-2 rounded-lg bg-black/5 dark:bg-white/5 p-2 text-xs">Exemplo simples: <b>R$ 1.000</b> hoje valeriam <b>{fmt(ex1000)}</b> em 1 ano se ficarem parados.</div>}
              </>
            ) : (
              <p className="text-sm text-muted">Cadastre suas contas para ver quanto a inflacao corroe o dinheiro parado.</p>
            )}
          </Card>

          <Card className="hover-lift">
            <div className="flex items-center gap-2 mb-2"><span className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center"><Percent className="w-4 h-4" /></span><h4 className="font-semibold">Ganho real & comparacao</h4></div>
            {realRate != null ? (
              <>
                <p className="text-sm text-muted leading-relaxed">O que importa e o <b className="text-[hsl(var(--text))]">ganho real</b> (acima da inflacao). Rendendo o CDI ({cdi?.toFixed(2)}%) com IPCA de {ipca?.toFixed(2)}%, seu ganho real e de <b className={realRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{realRate >= 0 ? '+' : ''}{realRate.toFixed(2)}% ao ano</b>.</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted">CDI (renda fixa)</span><b>{cdi?.toFixed(2)}% a.a.</b></div>
                  <div className="flex justify-between"><span className="text-muted">Poupanca (ref.)</span><b>~{poupYear.toFixed(2)}% a.a.</b></div>
                  <div className="flex justify-between"><span className="text-muted">Inflacao (IPCA)</span><b className="text-rose-500">{ipca?.toFixed(2)}% a.a.</b></div>
                </div>
                <p className="text-[11px] text-muted mt-2">Ganho real = ((1+CDI) / (1+IPCA)) − 1. Acima de zero, seu dinheiro cresce de verdade.</p>
              </>
            ) : (
              <p className="text-sm text-muted">Carregando indicadores para calcular o ganho real...</p>
            )}
          </Card>
        </div>
      </div>

      {/* Alertas de cambio */}
      <Card className="hover-lift">
        <h3 className="font-semibold flex items-center gap-2 mb-1"><Bell className="w-4 h-4 text-amber-500" /> Alertas de cambio</h3>
        <p className="text-xs text-muted mb-3">Defina um alvo e o sino de notificacoes avisa quando a cotacao bater.</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Select value={nf.code} onChange={(e) => setNf((s) => ({ ...s, code: e.target.value }))}><option value="USD">Dolar (USD)</option><option value="EUR">Euro (EUR)</option><option value="BTC">Bitcoin (BTC)</option></Select>
          <Select value={nf.dir} onChange={(e) => setNf((s) => ({ ...s, dir: e.target.value }))}><option value="above">subir acima de</option><option value="below">cair abaixo de</option></Select>
          <Input type="number" step="0.01" value={nf.value} onChange={(e) => setNf((s) => ({ ...s, value: e.target.value }))} placeholder="R$ alvo" />
          <Button onClick={addAlert} disabled={!nf.value}><Plus className="w-4 h-4" /> Adicionar</Button>
        </div>
        {fxAlerts.length > 0 && (
          <div className="mt-3 space-y-2">
            {fxAlerts.map((a) => { const cur = currentOf(a.code); const hit = isHit(a, cur); return (
              <div key={a.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${hit ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[hsl(var(--border))]'}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hit ? 'bg-emerald-500 text-white' : 'bg-amber-500/15 text-amber-500'}`}>{hit ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.code} {a.dir === 'above' ? 'acima de' : 'abaixo de'} {fmt(a.value)}</p>
                  <p className="text-xs text-muted">atual: {cur ? fmt(cur) : '—'} {hit ? '· alvo atingido!' : ''}</p>
                </div>
                <button onClick={() => delAlert(a.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
              </div>
            ); })}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted text-center pt-2">Dados de fontes publicas (AwesomeAPI e BrasilAPI). Conteudo informativo — nao e recomendacao de investimento.</p>
    </div>
  );
}

function RateCard({ label, hint, value, loading, icon: Icon, color }) {
  return (
    <Card className="hover-lift">
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: color }}><Icon className="w-4 h-4" /></span>
        <span className="text-[10px] font-bold tracking-widest text-muted">% a.a.</span>
      </div>
      <p className="text-xs text-muted mt-2">{label}</p>
      <p className="font-display text-2xl font-bold">{loading ? <Spinner className="w-4 h-4" /> : value != null ? `${value.toFixed(2)}%` : '—'}</p>
      <p className="text-[11px] text-muted mt-0.5">{hint}</p>
    </Card>
  );
}
