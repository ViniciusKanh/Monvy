import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Investment } from '../api/entities.js';
import { Input, Spinner } from '../components/ui';
import { HeroTitle, Panel, TIP } from '../components/kit.jsx';
import { StocksArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { LineChart as LineIcon, TrendingUp, TrendingDown, Search, AlertTriangle, Key, Star, DollarSign, Percent, Building2, Gem, Flame, Plus, Briefcase, Database, ArrowRight, CircleDollarSign, Activity, ExternalLink } from 'lucide-react';

const SUGESTOES = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'BBDC4', 'WEGE3', 'HGLG11', 'XPML11', 'MXRF11', 'VISC11'];
const RANGES = [['1D', '1d', '5m'], ['1S', '5d', '1h'], ['1M', '1mo', '1d'], ['3M', '3mo', '1d'], ['6M', '6mo', '1d'], ['1A', '1y', '1d'], ['5A', '5y', '1wk']];
const isFii = (t) => /11$/.test(String(t || '').toUpperCase());
const hue = (s) => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const pctTxt = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`);
const volTxt = (v) => (!v ? '—' : v >= 1e9 ? `${(v / 1e9).toFixed(2).replace('.', ',')} bi` : v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')} mi` : v.toLocaleString('pt-BR'));

function Tile({ t, size = 'w-8 h-8' }) {
  const h = hue(t);
  return <span className={`${size} rounded-lg grid place-items-center text-[10px] font-black shrink-0 text-white`} style={{ background: `linear-gradient(135deg,hsl(${h} 70% 45%),hsl(${(h + 40) % 360} 70% 35%))` }}>{isFii(t) ? <Building2 className="w-4 h-4" /> : String(t).slice(0, 2)}</span>;
}
function Spark({ data, w = 64, h = 22 }) {
  if (!data || data.length < 2) return <span style={{ width: w }} />;
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1; const up = data[data.length - 1] >= data[0]; const c = up ? '#34d399' : '#fb7185';
  return <svg width={w} height={h} aria-hidden className="shrink-0"><polyline points={data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / rg) * (h - 4)}`).join(' ')} fill="none" stroke={c} strokeWidth="1.8" /></svg>;
}
const Chg = ({ v }) => <span className={`text-xs font-bold whitespace-nowrap ${(v ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(v ?? 0) >= 0 ? '▲' : '▼'} {pctTxt(v)}</span>;

export default function Stocks() {
  const nav = useNavigate();
  const [token, setToken] = useState(() => { try { return localStorage.getItem('brapi_token') || ''; } catch { return ''; } });
  const [showToken, setShowToken] = useState(false);
  useEffect(() => { try { localStorage.setItem('brapi_token', token); } catch { /* */ } }, [token]);
  const tk = token ? `&token=${encodeURIComponent(token)}` : '';
  const brapi = async (path) => { const r = await fetch(`https://brapi.dev/api/${path}${path.includes('?') ? '' : '?'}${tk}`); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.message || 'Limite da API ou ativo indisponível.'); return j; };

  const { data: invs = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const carteira = useMemo(() => invs.filter((i) => i.ticker && /^(acao|fii|etf|bdr)$/i.test(i.type || '') || (i.ticker && /^[A-Z]{4}\d{1,2}$/.test(String(i.ticker).toUpperCase()))).map((i) => ({ ...i, ticker: String(i.ticker).toUpperCase() })), [invs]);

  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(() => { try { return localStorage.getItem('monvy_stock_sel') || ''; } catch { return ''; } });
  const [range, setRange] = useState('1D');
  const [filter, setFilter] = useState('acoes');
  const active = sel || carteira[0]?.ticker || 'PETR4';
  useEffect(() => { try { localStorage.setItem('monvy_stock_sel', active); } catch { /* */ } }, [active]);
  const R = RANGES.find((r) => r[0] === range);

  const qMain = useQuery({ queryKey: ['brapi-q', active, R[1], token], queryFn: () => brapi(`quote/${encodeURIComponent(active)}?range=${R[1]}&interval=${R[2]}&dividends=true`), retry: 0, staleTime: 60_000 });
  const asset = qMain.data?.results?.[0];
  const hist = useMemo(() => (asset?.historicalDataPrice || []).filter((h) => h.close).map((h) => { const d = new Date(h.date * 1000); return { d: R[1] === '1d' ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), v: h.close }; }), [asset, R]);
  const dy = useMemo(() => {
    const cash = asset?.dividendsData?.cashDividends || []; if (!cash.length || !asset?.regularMarketPrice) return null;
    const lim = Date.now() - 365 * 864e5; const sum = cash.filter((c) => new Date(c.paymentDate || c.lastDatePrior).getTime() >= lim).reduce((s, c) => s + Number(c.rate || 0), 0);
    return sum > 0 ? (sum / asset.regularMarketPrice) * 100 : null;
  }, [asset]);
  const proventos = (asset?.dividendsData?.cashDividends || []).slice(0, 4);

  // índices e listas de mercado (cada um falha sozinho, sem derrubar a tela)
  const qIbov = useQuery({ queryKey: ['brapi-ibov', token], queryFn: () => brapi('quote/%5EBVSP?range=1mo&interval=1d'), retry: 0, staleTime: 300_000 });
  const qFx = useQuery({ queryKey: ['fx-usd'], queryFn: async () => (await fetch('https://economia.awesomeapi.com.br/last/USD-BRL')).json(), retry: 0, staleTime: 300_000 });
  const qSelic = useQuery({ queryKey: ['selic-1'], queryFn: async () => (await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json')).json(), retry: 0, staleTime: 3_600_000 });
  const listQ = (key, params) => ({ queryKey: ['brapi-list', key, token], queryFn: () => brapi(`quote/list?${params}`), retry: 0, staleTime: 300_000 });
  const [qUp, qDown, qFii, qVol] = useQueries({ queries: [listQ('up', 'sortBy=change&sortOrder=desc&limit=3&type=stock'), listQ('down', 'sortBy=change&sortOrder=asc&limit=3&type=stock'), listQ('fii', 'sortBy=volume&sortOrder=desc&limit=3&type=fund'), listQ('vol', `sortBy=volume&sortOrder=desc&limit=8${filter === 'fiis' ? '&type=fund' : '&type=stock'}`)] });
  const posQ = useQueries({ queries: carteira.slice(0, 8).map((c) => ({ queryKey: ['brapi-pos', c.ticker, token], queryFn: () => brapi(`quote/${encodeURIComponent(c.ticker)}?range=1mo&interval=1d`), retry: 0, staleTime: 300_000 })) });

  const ibov = qIbov.data?.results?.[0];
  const ibovSpark = (ibov?.historicalDataPrice || []).map((h) => h.close).filter(Boolean);
  const usd = qFx.data?.USDBRL; const selic = Array.isArray(qSelic.data) ? Number(qSelic.data[0]?.valor) : null;
  const pos = carteira.slice(0, 8).map((c, i) => { const r = posQ[i].data?.results?.[0]; return { ...c, price: r?.regularMarketPrice, chg: r?.regularMarketChangePercent, spark: (r?.historicalDataPrice || []).map((h) => h.close).filter(Boolean) }; });
  // desempenho da carteira em ~30 dias: soma(qtd × fechamento) do 1º ao último pregão
  const perf = useMemo(() => {
    const ok = pos.filter((p) => p.spark.length > 1 && Number(p.quantity) > 0); if (!ok.length) return null;
    const len = Math.min(...ok.map((p) => p.spark.length)); const series = Array.from({ length: len }, (_, i) => ok.reduce((s, p) => s + Number(p.quantity) * p.spark[p.spark.length - len + i], 0));
    const ch = ((series[series.length - 1] - series[0]) / series[0]) * 100;
    const ib = ibovSpark.length > 1 ? ((ibovSpark[ibovSpark.length - 1] - ibovSpark[0]) / ibovSpark[0]) * 100 : null;
    return { series, ch, ib };
  }, [pos, ibovSpark]);
  const list = (q) => q.data?.stocks || [];
  const up = (asset?.regularMarketChangePercent || 0) >= 0;
  const chartColor = hist.length > 1 && hist[hist.length - 1].v < hist[0].v ? '#fb7185' : '#34d399';
  const go = (t) => { setSel(String(t).toUpperCase()); setQuery(''); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
  const apiErr = qMain.isError ? qMain.error?.message : null;
  const tape = [ibov && { k: 'IBOV', v: ibov.regularMarketPrice?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), c: ibov.regularMarketChangePercent }, ...pos.filter((p) => p.price).map((p) => ({ k: p.ticker, v: p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), c: p.chg })), usd && { k: 'Dólar', v: Number(usd.bid).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), c: Number(usd.pctChange) }].filter(Boolean);

  return (
    <div className="space-y-5 animate-fadeIn pb-2">
      <HeroTitle icon={LineIcon} lead="Ações &" accent="FIIs" iconClass="text-sky-400" subtitle="Pesquise e acompanhe ações da B3 e Fundos Imobiliários (FIIs)." art={<StocksArt className="w-[26rem] h-40 opacity-90" />} />
      <div className="flex flex-wrap gap-3 -mt-1">
        {[[TrendingUp, 'Ibovespa', ibov ? ibov.regularMarketPrice?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—', ibov?.regularMarketChangePercent, ibovSpark, '#34d399'], [DollarSign, 'Dólar', usd ? formatCurrency(Number(usd.bid)) : '—', usd ? Number(usd.pctChange) : null, null, '#a78bfa'], [Percent, 'Juros (Selic)', selic ? `${selic.toFixed(2).replace('.', ',')}% a.a.` : '—', null, null, '#38bdf8']].map(([Ic, l, v, c, sp, col]) => (
          <div key={l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${col}26`, color: col }}><Ic className="w-5 h-5" /></span>
            <div><p className="text-xs text-muted">{l}</p><p className="font-display text-lg font-bold leading-tight">{v} {c != null && Number.isFinite(c) && <Chg v={c} />}</p></div>
            {sp && <Spark data={sp} w={72} h={26} />}
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-sky-400/30 p-3 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) go(query.trim()); }} className="flex gap-2">
          <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por ticker (ex.: PETR4, VALE3, HGLG11...)" className="pl-9 uppercase placeholder:normal-case" /></div>
          <button type="submit" className="inline-flex items-center gap-2 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(56,189,248,.4)]"><Search className="w-4 h-4" />Buscar</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Sugestões:</span>
          {SUGESTOES.map((t) => <button key={t} onClick={() => go(t)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ring-1 transition ${active === t ? 'ring-sky-400 bg-sky-500/15 text-sky-600 dark:text-sky-300' : 'ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10'}`}>{t}</button>)}
          <span className="hidden lg:block w-px h-6 bg-[hsl(var(--border))] mx-1" />
          {[['acoes', 'Ações', LineIcon], ['fiis', 'FIIs', Building2], ['div', 'Dividendos', Gem], ['vol', 'Mais negociados', Flame]].map(([v, l, Ic]) => <button key={v} onClick={() => { setFilter(v); document.getElementById('stk-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${filter === v ? 'ring-violet-400 bg-violet-500/15' : 'ring-[hsl(var(--border))] text-muted'}`}><Ic className="w-3.5 h-3.5" />{l}</button>)}
          <button onClick={() => setShowToken((s) => !s)} className="ml-auto text-xs text-muted flex items-center gap-1 hover:text-sky-500"><Key className="w-3 h-3" />{token ? 'Token brapi ativo' : 'Token brapi (opcional)'}</button>
        </div>
        {showToken && <div><Input value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder="Cole seu token gratuito de brapi.dev" className="max-w-md" /><p className="text-[11px] text-muted mt-1">Sem token, a API pública só libera alguns ativos de teste. Crie um token grátis em brapi.dev — fica salvo só neste navegador.</p></div>}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-9 rounded-3xl ring-1 ring-sky-400/50 shadow-[0_0_40px_-14px_rgba(56,189,248,.6)] bg-[hsl(var(--card))] p-5" style={{ backgroundImage: 'radial-gradient(70% 120% at 0% 0%,rgba(14,165,233,.16),transparent),radial-gradient(60% 120% at 100% 100%,rgba(168,85,247,.16),transparent)' }}>
          {qMain.isLoading ? <div className="h-[300px] grid place-items-center"><Spinner className="w-8 h-8 text-sky-500" /></div>
            : apiErr || !asset ? <div className="h-[300px] grid place-items-center text-center text-sm text-muted px-6"><div><AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" /><p>Não consegui consultar <b>{active}</b>: {apiErr || 'ativo não encontrado'}.</p>{!token && <p className="mt-1">Sem token a brapi só libera PETR4, VALE3, ITUB4 e MGLU3. <button onClick={() => setShowToken(true)} className="underline font-semibold">Adicionar token</button></p>}</div></div>
            : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-5">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-300"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />Ativo em destaque</span>
                  <div className="flex items-center gap-3 mt-3"><Tile t={asset.symbol} size="w-12 h-12" /><div className="min-w-0"><p className="font-display text-2xl font-extrabold leading-tight">{asset.symbol}</p><p className="text-sm text-muted truncate">{asset.shortName || asset.longName}</p></div></div>
                  <p className="font-display text-3xl font-black mt-3">{formatCurrency(asset.regularMarketPrice)}</p>
                  <p className={`text-sm font-bold mt-0.5 ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? '▲' : '▼'} {pctTxt(asset.regularMarketChangePercent)} <span className="font-semibold">({asset.regularMarketChange >= 0 ? '+' : ''}{formatCurrency(asset.regularMarketChange)})</span></p>
                  {asset.longName && asset.longName !== asset.shortName && <p className="text-xs text-muted mt-3">{asset.longName}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-3">{[isFii(asset.symbol) ? 'FII' : 'Ação', asset.currency || 'BRL', asset.regularMarketTime ? `Atualizado ${new Date(asset.regularMarketTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : null].filter(Boolean).map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-[hsl(var(--border))]">{t}</span>)}</div>
                </div>
                <div className="min-w-0">
                  <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))] mb-2">{RANGES.map(([l]) => <button key={l} onClick={() => setRange(l)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${range === l ? 'bg-sky-500 text-white' : 'text-muted'}`}>{l}</button>)}</div>
                  {hist.length > 1 ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={hist} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="stkG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={0.4} /><stop offset="100%" stopColor={chartColor} stopOpacity={0.02} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} minTickGap={28} />
                        <YAxis width={50} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2).replace('.', ',')} />
                        <Tooltip formatter={(v) => [formatCurrency(v), asset.symbol]} contentStyle={TIP} />
                        <Area dataKey="v" stroke={chartColor} strokeWidth={2.5} fill="url(#stkG)" style={{ filter: `drop-shadow(0 0 6px ${chartColor}88)` }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <p className="h-[230px] grid place-items-center text-sm text-muted text-center">Histórico deste período indisponível{!token ? ' sem token da brapi' : ' no seu plano da brapi'}.</p>}
                </div>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => nav('/investimentos')} className="py-2.5 rounded-xl text-xs font-bold whitespace-nowrap text-white bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-[0_0_14px_rgba(16,185,129,.4)]" title="Registrar uma compra nos seus investimentos">Registrar compra</button>
                    <button onClick={() => nav('/investimentos')} className="py-2.5 rounded-xl text-xs font-bold whitespace-nowrap text-white bg-gradient-to-b from-rose-600 to-rose-800" title="Registrar uma venda nos seus investimentos">Registrar venda</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[['Abertura', formatCurrency(asset.regularMarketOpen)], ['Máxima', formatCurrency(asset.regularMarketDayHigh)], ['Mínima', formatCurrency(asset.regularMarketDayLow)], ['Volume', volTxt(asset.regularMarketVolume)]].map(([k, v]) => <div key={k} className="rounded-xl ring-1 ring-[hsl(var(--border))] p-2.5"><p className="text-muted">{k}</p><b className="text-sm">{v}</b></div>)}
                  </div>
                  <div className="rounded-xl ring-1 ring-violet-400/40 bg-violet-500/10 p-3 flex items-center gap-3"><Database className="w-7 h-7 text-violet-400" /><div><p className="text-xs text-muted">Div. Yield (12M)</p><b className="font-display text-xl text-violet-600 dark:text-violet-300">{dy != null ? `${dy.toFixed(2).replace('.', ',')}%` : '—'}</b></div></div>
                  <p className="text-[10px] text-muted">O Monvy não é corretora: os botões abrem seus Investimentos para você registrar a operação.</p>
                </div>
              </div>
            )}
        </section>

        <Panel className="xl:col-span-3" tone="violet" title={`Minha Carteira (${carteira.length})`} icon={Briefcase} iconClass="text-violet-400" action={<button onClick={() => nav('/investimentos')} className="p-1.5 rounded-lg ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Adicionar ativo"><Plus className="w-4 h-4" /></button>}>
          {carteira.length === 0 ? <p className="text-sm text-muted">Cadastre ações e FIIs (com ticker) em <button onClick={() => nav('/investimentos')} className="underline">Investimentos</button> para acompanhar aqui.</p> : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {pos.map((p) => <button key={p.id} onClick={() => go(p.ticker)} className="w-full flex items-center gap-2 py-2 text-left hover:bg-black/[.03] dark:hover:bg-white/[.03] rounded-lg"><Tile t={p.ticker} size="w-7 h-7" /><b className="text-sm flex-1">{p.ticker}</b><span className="text-sm">{p.price ? formatCurrency(p.price) : '—'}</span><span className="w-16 text-right">{p.chg != null ? <Chg v={p.chg} /> : null}</span><Spark data={p.spark} w={48} /></button>)}
            </div>
          )}
        </Panel>
      </div>

      <div id="stk-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[['Maiores altas (hoje)', TrendingUp, 'text-emerald-400', list(qUp), qUp], ['Maiores baixas (hoje)', TrendingDown, 'text-rose-400', list(qDown), qDown], ['FIIs mais negociados', Building2, 'text-sky-400', list(qFii), qFii]].map(([t, Ic, cls, rows, q]) => (
          <Panel key={t} title={t} icon={Ic} iconClass={cls} className="!p-4">
            {q.isLoading ? <Spinner className="w-5 h-5" /> : q.isError ? <p className="text-xs text-muted">Indisponível {token ? 'no seu plano da brapi' : 'sem token da brapi'}.</p> : (
              <div className="space-y-2">{rows.map((s) => <button key={s.stock} onClick={() => go(s.stock)} className="w-full flex items-center gap-2 text-sm text-left"><Tile t={s.stock} size="w-7 h-7" /><b className="flex-1">{s.stock}</b><span>{formatCurrency(s.close)}</span><span className={`text-xs font-bold px-1.5 py-0.5 rounded-md w-[70px] text-center ${s.change >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-500'}`}>{pctTxt(s.change)}</span></button>)}</div>
            )}
          </Panel>
        ))}
        <Panel title="Desempenho da carteira" icon={Activity} iconClass="text-emerald-400" className="!p-4">
          {perf ? <><p className="text-xs text-muted">Últimos ~30 dias (pelas cotações)</p><p className={`font-display text-3xl font-black ${perf.ch >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pctTxt(perf.ch)}</p>{perf.ib != null && <p className="text-xs text-muted">vs. Ibovespa: <b className={perf.ib >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{pctTxt(perf.ib)}</b></p>}<div className="mt-1"><Spark data={perf.series} w={200} h={40} /></div></> : <p className="text-sm text-muted">Precisa de ativos com ticker e quantidade na carteira e do histórico da brapi.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="sky" title={filter === 'fiis' ? 'FIIs mais negociados' : filter === 'div' ? 'Proventos — ' + active : 'Ações mais negociadas'} icon={filter === 'div' ? CircleDollarSign : Flame} iconClass="text-amber-400">
          {filter === 'div' ? (
            proventos.length === 0 ? <p className="text-sm text-muted">Sem proventos informados pela brapi para {active}.</p> : (
              <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted border-b border-[hsl(var(--border))]"><th className="py-2 font-medium">Tipo</th><th className="py-2 font-medium">Data com</th><th className="py-2 font-medium">Pagamento</th><th className="py-2 font-medium text-right">Valor</th></tr></thead>
                <tbody>{proventos.map((c, i) => <tr key={i} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-2">{c.label || 'Provento'}</td><td>{c.lastDatePrior ? new Date(c.lastDatePrior).toLocaleDateString('pt-BR') : '—'}</td><td>{c.paymentDate ? new Date(c.paymentDate).toLocaleDateString('pt-BR') : '—'}</td><td className="text-right font-semibold">{formatCurrency(Number(c.rate))}</td></tr>)}</tbody></table>
            )
          ) : qVol.isLoading ? <Spinner className="w-5 h-5" /> : qVol.isError ? <p className="text-sm text-muted">Lista indisponível {token ? 'no seu plano da brapi' : 'sem token da brapi'}.</p> : (
            <div className="grid sm:grid-cols-2 gap-x-6">{list(qVol).map((s) => <button key={s.stock} onClick={() => go(s.stock)} className="flex items-center gap-2 py-2 border-b border-[hsl(var(--border))] text-sm text-left"><Tile t={s.stock} size="w-7 h-7" /><span className="flex-1 min-w-0"><b>{s.stock}</b><span className="block text-[11px] text-muted truncate">{s.name}</span></span><span className="text-right"><b className="block">{formatCurrency(s.close)}</b><span className="text-[11px] text-muted">vol. {volTxt(s.volume)}</span></span></button>)}</div>
          )}
        </Panel>
        <Panel className="xl:col-span-5" tone="emerald" title="Como usar" icon={ExternalLink} iconClass="text-emerald-400">
          <ul className="text-sm text-muted space-y-2">
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />Clique em qualquer ticker para vê-lo em destaque, com gráfico de 1 dia a 5 anos.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />Sua carteira vem dos Investimentos com ticker; o desempenho usa as quantidades cadastradas.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />Div. Yield (12M) soma os proventos pagos nos últimos 12 meses ÷ preço atual.</li>
          </ul>
          <p className="text-[11px] text-muted mt-3">Fonte: brapi.dev (cotações com atraso), Banco Central e AwesomeAPI. Não é recomendação de investimento.</p>
        </Panel>
      </div>

      {tape.length > 0 && (
        <div className="sticky bottom-2 z-10 rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur px-3 py-2 flex items-center gap-4 overflow-x-auto text-sm">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/50 bg-emerald-500/10 text-xs font-semibold shrink-0"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Mercado</span>
          {tape.map((t) => <span key={t.k} className="flex items-center gap-2 whitespace-nowrap pr-4 border-r border-[hsl(var(--border))] last:border-0"><b>{t.k}</b>{t.v}{t.c != null && Number.isFinite(t.c) && <Chg v={t.c} />}</span>)}
        </div>
      )}
    </div>
  );
}
