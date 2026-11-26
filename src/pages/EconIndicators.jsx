import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, TIP } from '../components/kit.jsx';
import { EconArt } from '../components/art/PageArt.jsx';
import { Flag } from '../components/Flags.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Landmark, Percent, TrendingUp, PiggyBank, RefreshCw, AlertTriangle, Wallet, Layers, Flame, BarChart3, Briefcase, Activity, Target, BookOpen, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

const SGS = (code, n) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${n}?formato=json`;
const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const toNum = (v) => Number(String(v).replace(',', '.'));
const pct = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(d).replace('.', ',')}%`);
const mesAno = (d) => (d ? `${d.slice(3, 5)}/${d.slice(6)}` : ''); // dd/mm/aaaa -> mm/aaaa
// último valor de cada mês de uma série diária (para mini gráficos)
const monthly = (arr) => { const m = {}; for (const x of arr || []) m[x.data.slice(3)] = toNum(x.valor); return Object.values(m); };
const acum12 = (vals) => (vals.length >= 12 ? (vals.slice(-12).reduce((a, v) => a * (1 + v / 100), 1) - 1) * 100 : null);

async function fetchAll() {
  const keys = { selic: SGS(432, 260), cdi: SGS(4389, 260), ipca: SGS(433, 72), minimo: SGS(1619, 3), igpm: SGS(189, 25), desemp: SGS(24369, 14), pib: SGS(7326, 3) };
  const entries = Object.entries(keys);
  const res = await Promise.allSettled(entries.map(([, u]) => getJson(u)));
  const out = Object.fromEntries(entries.map(([k], i) => [k, res[i].status === 'fulfilled' && Array.isArray(res[i].value) ? res[i].value : []]));
  let fx = {}; try { fx = await getJson('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL'); } catch { /* opcional */ }
  if (!out.selic.length && !out.cdi.length && !out.ipca.length) throw new Error('sem dados');
  return { ...out, fx, at: Date.now() };
}

function MiniArea({ data, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1; const w = 88, h = 34;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rg) * (h - 8)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  return <svg width={w} height={h} className="absolute right-3 bottom-3 opacity-90" aria-hidden><polygon points={`0,${h} ${line} ${w},${h}`} fill={color} fillOpacity=".25" /><polyline points={line} fill="none" stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color})` }} /></svg>;
}

export default function EconIndicators() {
  const nav = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['econ-indicators-v2'], queryFn: fetchAll, retry: 1, staleTime: 3600_000 });
  const [range, setRange] = useState(12);

  const d = useMemo(() => {
    if (!data) return null;
    const last = (a) => (a.length ? toNum(a[a.length - 1].valor) : null);
    const prev = (a) => (a.length > 1 ? toNum(a[a.length - 2].valor) : null);
    const selic = last(data.selic), cdi = last(data.cdi);
    const ipcaVals = data.ipca.map((x) => toNum(x.valor));
    const ipca12 = acum12(ipcaVals), ipcaMes = ipcaVals.length ? ipcaVals[ipcaVals.length - 1] : null;
    const igpVals = data.igpm.map((x) => toNum(x.valor));
    const igpm12 = acum12(igpVals), igpmPrev = igpVals.length >= 13 ? acum12(igpVals.slice(0, -1)) : null;
    const poup = selic == null ? null : selic > 8.5 ? (Math.pow(1.005, 12) - 1) * 100 : selic * 0.7;
    const cdiMes = cdi == null ? null : (Math.pow(1 + cdi / 100, 1 / 12) - 1) * 100;
    const usd = data.fx?.USDBRL, eur = data.fx?.EURBRL;
    // série do IPCA com o acumulado de 12 meses em cada ponto
    const ipcaSerie = data.ipca.map((x, i) => ({ mes: mesAno(x.data), valor: toNum(x.valor), acum: i >= 11 ? acum12(ipcaVals.slice(0, i + 1)) : null }));
    return {
      selic, cdi, ipca12, ipcaMes, poup, cdiMes, igpm12, igpmDelta: igpm12 != null && igpmPrev != null ? igpm12 - igpmPrev : null,
      minimo: last(data.minimo), desemp: last(data.desemp), desempDelta: last(data.desemp) != null && prev(data.desemp) != null ? last(data.desemp) - prev(data.desemp) : null,
      desempRef: data.desemp.length ? mesAno(data.desemp[data.desemp.length - 1].data) : '',
      pib: last(data.pib), pibDelta: last(data.pib) != null && prev(data.pib) != null ? last(data.pib) - prev(data.pib) : null, pibRef: data.pib.length ? data.pib[data.pib.length - 1].data.slice(6) : '',
      usd: usd ? { v: Number(usd.bid), p: Number(usd.pctChange) } : null, eur: eur ? { v: Number(eur.bid), p: Number(eur.pctChange) } : null,
      sp: { selic: monthly(data.selic).slice(-12), cdi: monthly(data.cdi).slice(-12), ipca: ipcaSerie.slice(-12).map((x) => x.acum ?? 0), poup: monthly(data.selic).slice(-12).map((s) => (s > 8.5 ? 6.17 : s * 0.7)), minimo: data.minimo.map((x) => toNum(x.valor)), cdiMes: monthly(data.cdi).slice(-12).map((c) => (Math.pow(1 + c / 100, 1 / 12) - 1) * 100) },
      ipcaSerie, ipcaRef: data.ipca.length ? mesAno(data.ipca[data.ipca.length - 1].data) : '',
      at: new Date(data.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  }, [data]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;
  if (isError || !d) return <div className="space-y-5"><HeroTitle icon={Landmark} lead="Indicadores" accent="Econômicos" iconClass="text-sky-400" /><div className="rounded-2xl ring-1 ring-amber-400/40 bg-amber-500/10 p-6 text-center text-sm"><AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500" />Não foi possível carregar os indicadores do Banco Central agora. <button onClick={() => refetch()} className="underline font-semibold">Tentar de novo</button></div></div>;

  const real = d.selic != null && d.ipca12 != null ? ((1 + d.selic / 100) / (1 + d.ipca12 / 100) - 1) * 100 : null;
  const metaOk = d.ipca12 != null && d.ipca12 <= 4.5; // meta contínua 3% ± 1,5 p.p.
  const chartData = range ? d.ipcaSerie.slice(-range) : d.ipcaSerie;
  const KPIS = [
    { k: 'Taxa Selic (meta)', v: pct(d.selic), sub: 'ao ano', icon: Percent, c: '#818cf8', sp: d.sp.selic, ring: 'ring-indigo-400/50' },
    { k: 'CDI', v: pct(d.cdi), sub: 'ao ano', icon: TrendingUp, c: '#34d399', sp: d.sp.cdi, ring: 'ring-emerald-400/40' },
    { k: 'IPCA (12 meses)', v: pct(d.ipca12), sub: `mês: ${pct(d.ipcaMes)}`, icon: TrendingUp, c: '#fbbf24', sp: d.sp.ipca, ring: 'ring-amber-400/50' },
    { k: 'Poupança', v: pct(d.poup), sub: 'estimada ao ano', icon: PiggyBank, c: '#22d3ee', sp: d.sp.poup, ring: 'ring-cyan-400/40' },
    { k: 'Salário mínimo', v: d.minimo != null ? formatCurrency(d.minimo) : '—', sub: 'vigente', icon: Wallet, c: '#c084fc', sp: d.sp.minimo, ring: 'ring-violet-400/45' },
    { k: 'CDI ao mês', v: pct(d.cdiMes), sub: 'equivalente', icon: Percent, c: '#f472b6', sp: d.sp.cdiMes, ring: 'ring-pink-400/45' },
  ];
  const deltaPP = (v, invert) => v == null ? null : Math.abs(v) < 0.005 ? <span className="text-xs font-bold text-muted">= 0,00 p.p.</span> : <span className={`text-xs font-bold whitespace-nowrap ${(invert ? v <= 0 : v >= 0) ? 'text-emerald-500' : 'text-rose-500'}`}>{v >= 0 ? '▲ +' : '▼ '}{v.toFixed(2).replace('.', ',')} p.p.</span>;
  const deltaPct = (v) => v == null || !Number.isFinite(v) ? null : <span className={`text-xs font-bold whitespace-nowrap ${v >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{v >= 0 ? '▲ +' : '▼ '}{v.toFixed(2).replace('.', ',')}%</span>;
  const SECOND = [
    { k: 'Dólar (USD)', v: d.usd ? formatCurrency(d.usd.v) : '—', delta: deltaPct(d.usd?.p), icon: <Flag code="USD" size={34} /> },
    { k: 'Euro (EUR)', v: d.eur ? formatCurrency(d.eur.v) : '—', delta: deltaPct(d.eur?.p), icon: <Flag code="EUR" size={34} /> },
    { k: 'PIB (var. anual)', sub: d.pibRef ? `ano de ${d.pibRef}` : '', v: d.pib != null ? `${d.pib >= 0 ? '+' : ''}${pct(d.pib)}` : '—', delta: deltaPP(d.pibDelta), icon: <BarChart3 className="w-8 h-8 text-emerald-400" /> },
    { k: 'IGP-M (12 meses)', sub: 'acumulado', v: pct(d.igpm12), delta: deltaPP(d.igpmDelta, true), icon: <BarChart3 className="w-8 h-8 text-amber-400" /> },
    { k: 'Desemprego (PNAD)', sub: d.desempRef ? `trimestre até ${d.desempRef}` : '', v: d.desemp != null ? pct(d.desemp, 1) : '—', delta: deltaPP(d.desempDelta, true), icon: <Briefcase className="w-8 h-8 text-sky-400" /> },
  ];
  const COMP = [['CDI', d.cdi, '#34d399', TrendingUp], ['Selic (meta)', d.selic, '#a78bfa', Percent], ['CDB (100% CDI)', d.cdi, '#3b82f6', Layers], ['Poupança', d.poup, '#2dd4bf', PiggyBank], ['IPCA (inflação)', d.ipca12, '#fbbf24', Flame]];
  const maxComp = Math.max(...COMP.map((c) => c[1] || 0), 1);
  const headline = real == null ? 'Cenário em atualização' : real >= 5 ? `Juros em patamar elevado e inflação ${metaOk ? 'sob controle' : 'acima da meta'}` : real >= 2 ? `Juros reais moderados, inflação ${metaOk ? 'dentro da meta' : 'acima da meta'}` : 'Juros reais baixos — atenção à inflação';
  const insight = real == null ? '' : `A Selic em ${pct(d.selic)} a.a. com IPCA de ${pct(d.ipca12)} em 12 meses dá um juro real de cerca de ${pct(real)} a.a. ${real >= 5 ? 'Esse patamar segura a demanda e tende a favorecer a renda fixa pós-fixada (CDB, Tesouro Selic), mas encarece o crédito.' : 'Com juro real menor, o crédito fica mais barato e a renda fixa rende menos acima da inflação.'} ${metaOk ? 'A inflação está dentro do intervalo da meta (3% ± 1,5 p.p.).' : 'A inflação está acima do teto da meta (4,5%).'}`;
  const pulso = [d.ipca12 != null && `IPCA em ${pct(d.ipca12)} (${metaOk ? 'dentro da meta' : 'acima da meta'})`, d.selic != null && `Selic em ${pct(d.selic)}`, d.pib != null && `PIB ${d.pib >= 0 ? '+' : ''}${pct(d.pib)} em ${d.pibRef}`, d.desemp != null && `desemprego em ${pct(d.desemp, 1)}`].filter(Boolean).join(', ');

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Landmark} lead="Indicadores" accent="Econômicos" iconClass="text-sky-400" subtitle="Acompanhe os principais indicadores da economia brasileira, com dados oficiais do Banco Central (SGS)."
        art={<EconArt className="w-[26rem] h-40 opacity-90" />}
        actions={<button onClick={() => refetch()} className="p-2.5 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-black/5 dark:hover:bg-white/10 xl:mr-[27rem]" title="Atualizar" aria-label="Atualizar"><RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>} />
      <div className="flex flex-wrap items-center gap-3 text-xs -mt-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/50 bg-emerald-500/10 font-semibold"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Dados oficiais</span>
        <span className="text-muted flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Fonte: Banco Central (SGS) · câmbio: AwesomeAPI</span>
        <span className="text-muted flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Atualizado: hoje, {d.at}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        {KPIS.map((x) => (
          <div key={x.k} className={`relative overflow-hidden rounded-2xl ring-1 ${x.ring} bg-[hsl(var(--card))] p-4 min-h-[118px]`} style={{ backgroundImage: `linear-gradient(135deg,${x.c}2e,transparent 70%)`, boxShadow: `0 0 26px -12px ${x.c}` }}>
            <p className="text-sm flex items-center gap-2"><span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: `${x.c}26`, color: x.c }}><x.icon className="w-4 h-4" /></span>{x.k}</p>
            <p className="relative z-[1] font-display text-2xl font-extrabold mt-2 drop-shadow" style={{ color: x.c }}>{x.v}</p>
            <p className="relative z-[1] text-xs text-muted">{x.sub}</p>
            <MiniArea data={x.sp} color={x.c} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {SECOND.map((x) => (
          <div key={x.k} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 flex items-center gap-3">
            <span className="shrink-0">{x.icon}</span>
            <div className="min-w-0 flex-1"><p className="text-xs text-muted truncate">{x.k}</p><p className="font-display text-xl font-bold">{x.v}</p>{x.sub && <p className="text-[10px] text-muted truncate">{x.sub}</p>}</div>
            <span className="self-end">{x.delta}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="amber" title="IPCA — Inflação mensal" subtitle={`Variação mês a mês, em %. Acumulado de 12 meses até ${d.ipcaRef}: ${pct(d.ipca12)}.`} icon={TrendingUp} iconClass="text-amber-400"
          action={<div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">{[[12, '12 meses'], [24, '24 meses'], [36, '36 meses'], [0, 'Tudo']].map(([v, l]) => <button key={l} onClick={() => setRange(v)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${range === v ? 'bg-sky-500 text-white' : 'text-muted'}`}>{l}</button>)}</div>}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs><linearGradient id="ipcaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis width={46} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(2).replace('.', ',')}%`} />
              <ReferenceLine y={0} stroke="hsl(var(--muted))" strokeOpacity={0.4} />
              <Tooltip contentStyle={TIP} formatter={(v, k, p) => [`${pct(Number(v))}${p?.payload?.acum != null ? ` · acumulado 12m: ${pct(p.payload.acum)}` : ''}`, 'IPCA no mês']} />
              <Area dataKey="valor" stroke="#fbbf24" strokeWidth={2.5} fill="url(#ipcaG)" dot={{ r: 3, fill: '#fbbf24' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel className="xl:col-span-5" tone="violet" title="Comparativo de rentabilidade (a.a.)" icon={Landmark} iconClass="text-sky-400">
          <div className="space-y-3.5 mt-2">
            {COMP.map(([l, v, c, Ic]) => (
              <div key={l} className="flex items-center gap-3 text-sm">
                <Ic className="w-5 h-5 shrink-0" style={{ color: c }} />
                <span className="w-32 shrink-0">{l}</span>
                <span className="flex-1 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${((v || 0) / maxComp) * 100}%`, background: c, boxShadow: `0 0 10px ${c}88` }} /></span>
                <b className="w-20 text-right whitespace-nowrap">{l.startsWith('CDB') ? '≈ ' : ''}{pct(v)}</b>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-4">CDB a 100% do CDI antes do IR. Poupança: 0,5% a.m. + TR quando a Selic passa de 8,5% (a TR é desconsiderada aqui).</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-6 relative overflow-hidden rounded-3xl ring-1 ring-fuchsia-400/50 shadow-[0_0_34px_-12px_rgba(217,70,239,.6)] p-5 bg-[hsl(var(--card))]" style={{ backgroundImage: 'linear-gradient(120deg,rgba(168,85,247,.28),rgba(217,70,239,.12) 60%,transparent)' }}>
          <div className="flex items-start gap-4">
            <Target className="w-12 h-12 text-fuchsia-300 shrink-0" strokeWidth={1.6} />
            <div className="min-w-0">
              <p className="text-sm text-muted flex items-center gap-2">Insight do cenário atual <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-300">Auto</span></p>
              <h3 className="font-display text-xl font-bold mt-0.5">{headline}</h3>
              <p className="text-sm text-muted mt-2 leading-relaxed">{insight}</p>
            </div>
          </div>
        </section>
        <Panel className="xl:col-span-6" tone="sky" title="Entenda os principais indicadores" icon={BookOpen} iconClass="text-sky-400">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[[Percent, 'Selic', 'Taxa básica de juros da economia, definida pelo Copom/Banco Central.', '#a78bfa'], [TrendingUp, 'CDI', 'Taxa dos empréstimos entre bancos; referência da renda fixa.', '#34d399'], [Flame, 'IPCA', 'Índice oficial de inflação (IBGE), que mede a variação de preços ao consumidor.', '#fbbf24'], [PiggyBank, 'Poupança', 'Rende 0,5% a.m. + TR quando a Selic > 8,5%; senão, 70% da Selic + TR.', '#22d3ee']].map(([Ic, t, x, c]) => (
              <div key={t} className="lg:border-l first:border-l-0 lg:pl-4 first:pl-0 border-[hsl(var(--border))]"><p className="font-semibold flex items-center gap-1.5"><Ic className="w-4 h-4" style={{ color: c }} />{t}</p><p className="text-xs text-muted mt-1 leading-relaxed">{x}</p></div>
            ))}
          </div>
        </Panel>
      </div>

      <section className="rounded-2xl ring-1 ring-cyan-400/40 bg-[hsl(var(--card))] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="flex items-center gap-2 font-display font-bold text-lg shrink-0 sm:pr-4 sm:border-r border-[hsl(var(--border))]"><Activity className="w-6 h-6 text-cyan-400" />Pulso Econômico</span>
        <p className="text-sm flex-1">{pulso || 'Sem dados suficientes agora.'}</p>
        <button onClick={() => nav('/mercado')} className="text-sm font-semibold text-sky-500 hover:underline flex items-center gap-1 shrink-0">Ver mercado e cotações<ArrowRight className="w-4 h-4" /></button>
      </section>
      <p className="text-xs text-muted text-center">Fonte: Banco Central do Brasil (SGS: Selic 432, CDI 4389, IPCA 433, IGP-M 189, salário mínimo 1619, desocupação 24369, PIB 7326). Conteúdo informativo — não é recomendação de investimento.</p>
    </div>
  );
}
