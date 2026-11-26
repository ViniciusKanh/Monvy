import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, DeltaChip } from '../components/kit.jsx';
import { GlobeFxArt } from '../components/art/PageArt.jsx';
import { Flag } from '../components/Flags.jsx';
import { formatCurrency } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { ArrowRightLeft, ArrowUpDown, RefreshCw, AlertTriangle, Globe, TrendingUp, Zap, Star, Settings2, BarChart3, Clock, Copy, ArrowRight, Plane, Info, Trash2 } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', name: 'Dólar americano', sym: '$' },
  { code: 'EUR', name: 'Euro', sym: '€' },
  { code: 'GBP', name: 'Libra esterlina', sym: '£' },
  { code: 'JPY', name: 'Iene japonês', sym: '¥' },
  { code: 'CAD', name: 'Dólar canadense', sym: 'C$' },
  { code: 'ARS', name: 'Peso argentino', sym: '$' },
  { code: 'CHF', name: 'Franco suíço', sym: 'Fr' },
  { code: 'CNY', name: 'Yuan chinês', sym: '¥' },
];
const BRL = { code: 'BRL', name: 'Real brasileiro', sym: 'R$' };
const ALL = [BRL, ...CURRENCIES];
const byCode = Object.fromEntries(ALL.map((c) => [c.code, c]));
const PAIRS = CURRENCIES.map((c) => `${c.code}-BRL`).join(',');
const QUICK = [100, 500, 1000, 5000, 10000];
const RANGES = [['24h', 2], ['7d', 8], ['30d', 31], ['1 ano', 366]];
const LS_RECENT = 'monvy_fx_recent_v1';
const LS_FAVS = 'monvy_fx_favs_v1';
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };

const getJson = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('Falha ao buscar cotações'); return r.json(); };
const nf = (v, d = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number.isFinite(v) ? v : 0);
const decOf = (code, v) => (code === 'JPY' || code === 'ARS' ? (Math.abs(v) >= 100 ? 0 : 2) : 2);
const rateFmt = (v) => (v < 0.1 ? nf(v, 4) : nf(v, 4));

function Spark({ data, up, w = 64, h = 22 }) {
  if (!data || data.length < 2) return <span className="inline-block" style={{ width: w, height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / rg) * (h - 4)}`).join(' ');
  const c = up ? '#34d399' : '#fb7185';
  return <svg width={w} height={h} className="shrink-0" aria-hidden><polyline points={pts} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${c}88)` }} /></svg>;
}

function CurrencySelect({ value, onChange, label }) {
  const c = byCode[value];
  return (
    <label className="relative flex items-center gap-3 pl-3 pr-9 py-2.5 rounded-xl ring-1 ring-[hsl(var(--border))] bg-black/[.03] dark:bg-white/[.04] hover:ring-sky-400/50 cursor-pointer min-w-[190px]">
      <Flag code={value} size={34} />
      <span className="min-w-0"><b className="block leading-tight">{value}</b><span className="block text-[11px] text-muted truncate">{c?.name}</span></span>
      <svg className="absolute right-3 w-4 h-4 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer">
        {ALL.map((x) => <option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}
      </select>
    </label>
  );
}

export default function Converter() {
  const nav = useNavigate();
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({ queryKey: ['fx-rates', PAIRS], queryFn: () => getJson(`https://economia.awesomeapi.com.br/last/${PAIRS}`), retry: 1, staleTime: 60_000, refetchInterval: 120_000 });
  const [from, setFrom] = useState(() => ls.get('monvy_fx_pair', {}).from || 'USD');
  const [to, setTo] = useState(() => ls.get('monvy_fx_pair', {}).to || 'BRL');
  const [amount, setAmount] = useState('1000');
  const [range, setRange] = useState('24h');
  const [showAll, setShowAll] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [favs, setFavs] = useState(() => ls.get(LS_FAVS, ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'ARS']));
  const [editFavs, setEditFavs] = useState(false);
  const [recent, setRecent] = useState(() => ls.get(LS_RECENT, []));
  useEffect(() => { ls.set('monvy_fx_pair', { from, to }); }, [from, to]);

  // histórico diário (30 dias) de cada moeda: sparklines, variação de 7 dias e tendências
  const days = RANGES.find((r) => r[0] === range)?.[1] || 31;
  const histN = Math.max(31, days);
  const hist = useQueries({ queries: CURRENCIES.map((c) => ({ queryKey: ['fx-hist', c.code, histN], queryFn: () => getJson(`https://economia.awesomeapi.com.br/json/daily/${c.code}-BRL/${histN}`), retry: 1, staleTime: 3_600_000 })) });
  const series = useMemo(() => Object.fromEntries(CURRENCIES.map((c, i) => { const arr = Array.isArray(hist[i].data) ? hist[i].data : []; return [c.code, arr.map((d) => ({ t: Number(d.timestamp), v: Number(d.bid) })).filter((d) => d.v > 0).sort((a, b) => a.t - b.t)]; })), [hist]);

  const q = data || {};
  const rateOf = (c) => (c === 'BRL' ? 1 : Number((q[`${c}BRL`] || {}).bid) || 0);
  const pctOf = (c) => (c === 'BRL' ? 0 : Number((q[`${c}BRL`] || {}).pctChange));
  const varN = (c, n) => { const s = series[c] || []; if (s.length < 2) return null; const tail = s.slice(-n); return ((tail[tail.length - 1].v - tail[0].v) / tail[0].v) * 100; };
  const amt = Number(String(amount).replace(/\./g, '').replace(',', '.')) || 0;
  const rFrom = rateOf(from), rTo = rateOf(to);
  const result = rFrom && rTo ? (amt * rFrom) / rTo : 0;
  const cross = rFrom && rTo ? rFrom / rTo : 0;
  const ready = rFrom > 0 && rTo > 0;
  // variação do par "from" em relação a "to" (via BRL)
  const pairVar = (fn) => { const a = from === 'BRL' ? 0 : fn(from); const b = to === 'BRL' ? 0 : fn(to); if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null; return ((1 + a / 100) / (1 + b / 100) - 1) * 100; };
  const v24 = pairVar((c) => pctOf(c));
  const v7 = pairVar((c) => varN(c, 8));
  const updated = (q.USDBRL?.create_date || '').slice(11, 16) || (dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

  // grava a conversão no histórico quando o valor fica parado por 2s
  useEffect(() => {
    if (!ready || amt <= 0 || from === to) return;
    const t = setTimeout(() => {
      setRecent((list) => {
        const top = list[0];
        if (top && top.from === from && top.to === to && top.amt === amt) return list;
        const next = [{ from, to, amt, res: result, at: Date.now() }, ...list.filter((x) => !(x.from === from && x.to === to && x.amt === amt))].slice(0, 20);
        ls.set(LS_RECENT, next); return next;
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [from, to, amt, result, ready]);

  const swap = () => { setFrom(to); setTo(from); };
  const toggleFav = (c) => setFavs((f) => { const n = f.includes(c) ? f.filter((x) => x !== c) : [...f, c]; ls.set(LS_FAVS, n); return n; });
  const when = (ts) => { const d = new Date(ts); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1); const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === today.toDateString() ? `Hoje, ${hm}` : d.toDateString() === y.toDateString() ? `Ontem, ${hm}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hm}`; };
  const copyRec = (r) => { const t = `${nf(r.amt, decOf(r.from, r.amt))} ${r.from} = ${nf(r.res, decOf(r.to, r.res))} ${r.to}`; navigator.clipboard?.writeText(t); toast.success('Conversão copiada.'); };
  const listed = showAll ? CURRENCIES : CURRENCIES.slice(0, 5);
  const trendCodes = ['USD', 'EUR', 'GBP', 'CAD', 'JPY'];
  const trendVar = (c) => (range === '24h' ? pctOf(c) : varN(c, days));
  const quickSym = byCode[from]?.sym || '';

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={ArrowRightLeft} lead="Conversor de" accent="Moedas" iconClass="text-sky-400" subtitle="Converta valores entre as principais moedas do mundo, com cotações atualizadas."
        art={<GlobeFxArt className="w-[21rem] h-32 opacity-95" />}
        actions={<button onClick={() => { refetch(); hist.forEach((h) => h.refetch()); }} className="p-2.5 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-black/5 dark:hover:bg-white/10 xl:mr-[22rem]" title="Atualizar cotações" aria-label="Atualizar cotações"><RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>} />

      {isError && <div className="rounded-2xl ring-1 ring-amber-400/40 bg-amber-500/10 p-3 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Não foi possível carregar as cotações agora. Verifique a conexão e tente atualizar.</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-4">
          <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-sky-400/40 shadow-[0_0_40px_-14px_rgba(56,189,248,.6)] p-5" style={{ backgroundImage: 'radial-gradient(80% 120% at 0% 0%,rgba(14,165,233,.14),transparent),radial-gradient(60% 120% at 100% 100%,rgba(168,85,247,.16),transparent)' }}>
            <p className="text-[11px] tracking-[0.28em] font-bold text-muted flex items-center gap-2"><Globe className="w-4 h-4 text-sky-400" />CONVERSÃO DE MOEDAS</p>
            <p className="text-sm text-muted mt-4 mb-1.5">Você tem (de)</p>
            <div className="flex flex-col sm:flex-row gap-3 rounded-2xl ring-1 ring-sky-400/40 bg-black/[.03] dark:bg-white/[.03] p-2">
              <CurrencySelect value={from} onChange={setFrom} label="Moeda de origem" />
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Valor" className="flex-1 min-w-0 bg-transparent font-display text-3xl sm:text-4xl font-bold outline-none px-3" placeholder="0,00" />
            </div>
            <div className="relative h-4 flex justify-center">
              <button onClick={swap} aria-label="Inverter moedas" title="Inverter" className="absolute -top-3 z-[1] w-14 h-14 rounded-full grid place-items-center bg-[hsl(var(--card))] ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,.6)] hover:rotate-180 transition-transform duration-300"><ArrowUpDown className="w-6 h-6 text-sky-400" /></button>
            </div>
            <p className="text-sm text-muted mt-4 mb-1.5">Recebe (para)</p>
            <div className="flex flex-col sm:flex-row gap-3 rounded-2xl ring-1 ring-violet-400/50 p-2" style={{ backgroundImage: 'linear-gradient(90deg,rgba(14,165,233,.08),rgba(139,92,246,.22))' }}>
              <CurrencySelect value={to} onChange={setTo} label="Moeda de destino" />
              <p className="flex-1 min-w-0 font-display text-3xl sm:text-4xl font-bold px-3 self-center truncate">{isLoading ? <Spinner className="w-6 h-6" /> : ready ? nf(result, decOf(to, result)) : '—'}</p>
            </div>

            <div className="mt-4 rounded-2xl ring-1 ring-emerald-400/40 bg-emerald-500/[.07] p-3 grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3 sm:divide-x divide-[hsl(var(--border))]">
              <div className="flex items-center gap-3"><TrendingUp className="w-9 h-9 text-emerald-400 shrink-0" /><div className="min-w-0"><p className="text-xs text-muted">Cotação atual</p><p className="font-display text-lg sm:text-xl font-bold truncate">{ready ? (to === 'BRL' ? `1 ${from} = R$ ${rateFmt(cross)}` : `1 ${from} = ${rateFmt(cross)} ${to}`) : '—'}</p></div></div>
              <div className="sm:pl-4 text-center"><p className="text-xs text-muted">Variação (24h)</p><p className="mt-1">{v24 != null ? <DeltaChip v={v24} /> : '—'}</p></div>
              <div className="sm:pl-4 text-center"><p className="text-xs text-muted">Variação (7d)</p><p className="mt-1">{v7 != null ? <DeltaChip v={v7} /> : '—'}</p></div>
            </div>

            <p className="text-sm font-semibold mt-4 mb-2 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" />Valores rápidos ({from})</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {QUICK.map((v) => { const on = amt === v; return <button key={v} onClick={() => setAmount(String(v))} className={`py-2 rounded-xl text-sm font-semibold ring-1 transition ${on ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-white ring-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.5)]' : 'ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>{quickSym} {nf(v)}</button>; })}
            </div>
          </section>

          <Panel tone="sky" title="Moedas favoritas" subtitle="Acesso rápido às suas moedas mais usadas." icon={Star} iconClass="text-emerald-400 fill-emerald-400/30"
            action={<button onClick={() => setEditFavs((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Settings2 className="w-3.5 h-3.5" />{editFavs ? 'Concluir' : 'Gerenciar favoritas'}</button>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(editFavs ? CURRENCIES.map((c) => c.code) : favs).map((code) => { const c = byCode[code]; const fav = favs.includes(code); const on = from === code; return (
                <div key={code} className={`relative rounded-xl ring-1 p-2.5 flex items-center gap-2 transition ${on ? 'ring-sky-400 bg-sky-500/10 shadow-[0_0_16px_-4px_rgba(56,189,248,.6)]' : 'ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <button onClick={() => { setFrom(code); if (to === code) setTo('BRL'); }} className="flex items-center gap-2 min-w-0 flex-1 text-left"><Flag code={code} size={26} /><span className="min-w-0"><b className="text-sm block leading-tight">{code}</b><span className="text-[10px] text-muted truncate block">{c.name}</span></span></button>
                  <button onClick={() => toggleFav(code)} aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className="absolute top-1.5 right-1.5"><Star className={`w-3.5 h-3.5 ${fav ? 'text-sky-400 fill-sky-400' : 'text-muted'}`} /></button>
                </div>); })}
              {!editFavs && favs.length === 0 && <p className="text-sm text-muted col-span-full">Nenhuma favorita. Use "Gerenciar favoritas" para escolher.</p>}
            </div>
          </Panel>

          <Panel tone="violet" title="Tendências do mercado" subtitle="Variação das principais moedas frente ao Real (BRL)." icon={BarChart3} iconClass="text-emerald-400"
            action={<div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">{RANGES.map(([l]) => <button key={l} onClick={() => setRange(l)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${range === l ? 'bg-cyan-400/20 text-cyan-700 dark:text-cyan-200 ring-1 ring-cyan-400/50' : 'text-muted'}`}>{l}</button>)}</div>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {trendCodes.map((c) => { const v = trendVar(c); const s = (series[c] || []).slice(-(range === '24h' ? 8 : days)).map((x) => x.v); const up = (v ?? 0) >= 0; return (
                <div key={c} className="rounded-xl ring-1 ring-[hsl(var(--border))] p-2.5">
                  <p className="flex items-center gap-2 font-semibold text-sm"><Flag code={c} size={20} />{c}</p>
                  <div className="flex items-center justify-between mt-1.5 gap-1">{v != null && Number.isFinite(v) ? <span className={`text-xs font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? '▲' : '▼'} {up ? '+' : ''}{nf(v)}%</span> : <span className="text-xs text-muted">—</span>}<Spark data={s} up={up} w={56} /></div>
                </div>); })}
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Panel tone="sky" title="Cotações de hoje" icon={BarChart3} iconClass="text-sky-400" action={updated && <span className="text-[11px] text-muted flex items-center gap-1.5 whitespace-nowrap"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Atualização: {updated}</span>}>
            <div className="divide-y divide-[hsl(var(--border))]">
              {listed.map((c) => { const r = rateOf(c.code); const p = pctOf(c.code); const s = (series[c.code] || []).slice(-8).map((x) => x.v); return (
                <button key={c.code} onClick={() => { setFrom(c.code); setTo('BRL'); }} className="w-full flex items-center gap-2.5 py-2.5 text-left hover:bg-black/[.03] dark:hover:bg-white/[.03] rounded-lg px-1">
                  <Flag code={c.code} size={28} />
                  <span className="min-w-0 flex-1"><b className="text-sm block leading-tight">{c.code}</b><span className="text-[11px] text-muted truncate block">{c.name}</span></span>
                  <span className="text-right"><b className="text-sm block">{isLoading ? '…' : r ? `R$ ${rateFmt(r)}` : '—'}</b>{Number.isFinite(p) && r > 0 && <span className={`text-[11px] font-semibold ${p >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{p >= 0 ? '▲ +' : '▼ '}{nf(p)}%</span>}</span>
                  <Spark data={s} up={s.length > 1 ? s[s.length - 1] >= s[0] : p >= 0} />
                </button>); })}
            </div>
            <button onClick={() => setShowAll((v) => !v)} className="w-full mt-2 text-sm font-semibold text-sky-500 hover:underline flex items-center justify-center gap-1.5">{showAll ? 'Mostrar menos' : 'Ver todas as moedas'}<ArrowRight className="w-4 h-4" /></button>
          </Panel>

          <Panel tone="violet" title="Conversões recentes" icon={Clock} iconClass="text-sky-400" action={recent.length > 0 && <button onClick={() => { setRecent([]); ls.set(LS_RECENT, []); }} className="p-1.5 rounded-lg text-muted hover:text-rose-500" title="Limpar histórico" aria-label="Limpar histórico"><Trash2 className="w-4 h-4" /></button>}>
            {recent.length === 0 ? <p className="text-sm text-muted">As conversões que você fizer aparecem aqui (ficam salvas só neste navegador).</p> : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {(showHist ? recent : recent.slice(0, 4)).map((r) => (
                  <div key={r.at} className="flex items-center gap-2 py-2 text-sm">
                    <Flag code={r.from} size={22} />
                    <b className="whitespace-nowrap">{r.from} → {r.to}</b>
                    <button onClick={() => { setFrom(r.from); setTo(r.to); setAmount(String(r.amt)); }} className="flex-1 min-w-0 truncate text-left hover:underline" title="Repetir conversão">{nf(r.amt, decOf(r.from, r.amt))} → {nf(r.res, decOf(r.to, r.res))}</button>
                    <span className="text-[11px] text-muted whitespace-nowrap">{when(r.at)}</span>
                    <button onClick={() => copyRec(r)} className="p-1 rounded-md text-muted hover:text-[hsl(var(--text))]" aria-label="Copiar conversão"><Copy className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
            {recent.length > 4 && <button onClick={() => setShowHist((v) => !v)} className="w-full mt-2 text-sm font-semibold text-sky-500 hover:underline flex items-center justify-center gap-1.5">{showHist ? 'Mostrar menos' : 'Ver histórico completo'}<ArrowRight className="w-4 h-4" /></button>}
          </Panel>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl ring-1 ring-cyan-400/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ backgroundImage: 'linear-gradient(90deg,rgba(14,165,233,.22),rgba(30,27,75,.4) 50%,rgba(217,70,239,.22))' }}>
        <Plane className="w-10 h-10 text-cyan-300 -rotate-12 shrink-0" />
        <div className="flex-1"><p className="font-display text-xl font-bold">Vai viajar?</p><p className="text-sm text-muted">Acompanhe a cotação da moeda de destino, compare com outros períodos e planeje quanto guardar para a viagem.</p></div>
        <button onClick={() => nav('/objetivo')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_20px_rgba(56,189,248,.4)] hover:brightness-110 shrink-0">Planejar viagem<ArrowRight className="w-4 h-4" /></button>
      </section>
      <p className="text-xs text-muted text-center flex items-center justify-center gap-1.5"><Info className="w-3.5 h-3.5" />Fonte: AwesomeAPI (cotação comercial de compra). Bancos e casas de câmbio aplicam spread, IOF e tarifas.</p>
    </div>
  );
}
