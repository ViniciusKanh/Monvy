import { useMemo, useState } from 'react';
import { Input } from '../components/ui';
import { HeroTitle, GlowButton, Ring, TIP } from '../components/kit.jsx';
import { HouseCalcArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';
import { GitCompare, Database, Percent, CalendarDays, Play, Calculator, Layers, Boxes, CalendarClock, TrendingDown, TrendingUp, Lightbulb, CheckCircle2, Sprout } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const money = (v) => formatCurrency(v);
const pctBR = (v) => `${(Number.isFinite(v) ? v : 0).toFixed(1).replace('.', ',')}%`;
const LS = 'monvy_pricesac_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };

function calc({ valor, taxa, prazo }) {
  const P = n(valor), i = n(taxa) / 100, N = Math.max(1, Math.min(600, Math.round(n(prazo))));
  const price = i === 0 ? P / N : (P * i) / (1 - Math.pow(1 + i, -N));
  const priceTotal = price * N;
  const amortSac = P / N;
  let saldo = P, sacTotal = 0; const serie = [];
  for (let k = 1; k <= N; k++) { const pSac = amortSac + saldo * i; sacTotal += pSac; saldo -= amortSac; serie.push({ k, Price: price, SAC: pSac }); }
  return { P, N, price, priceTotal, priceJuros: priceTotal - P, sacFirst: amortSac + P * i, sacLast: amortSac + amortSac * i, sacTotal, sacJuros: sacTotal - P, serie };
}

// Etiqueta "balão" para os pontos destacados do gráfico
const Callout = ({ x, y, color, title, value, dx = 0, dy = -46, anchor = 'start' }) => {
  const w = Math.max(title.length * 5.6, value.length * 7.6) + 22; const bx = anchor === 'end' ? x + dx - w : x + dx;
  return (
    <g>
      <rect x={bx} y={y + dy} width={w} height="40" rx="10" fill="hsl(var(--card))" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 8px ${color}66)` }} />
      <text x={bx + 11} y={y + dy + 15} fontSize="10" fill="hsl(var(--muted))">{title}</text>
      <text x={bx + 11} y={y + dy + 32} fontSize="13" fontWeight="800" fill="hsl(var(--text))">{value}</text>
    </g>
  );
};

export default function PriceSac() {
  const init = load() || { valor: '100000', taxa: '1', prazo: '120' };
  const [f, setF] = useState(init);
  const [applied, setApplied] = useState(init);
  const r = useMemo(() => calc(applied), [applied]);
  const simular = () => { setApplied(f); try { localStorage.setItem(LS, JSON.stringify(f)); } catch { /* */ } };

  const economia = Math.max(0, r.priceJuros - r.sacJuros);
  const economiaPct = r.priceJuros > 0 ? (economia / r.priceJuros) * 100 : 0;
  const pjPrice = r.priceTotal > 0 ? (r.priceJuros / r.priceTotal) * 100 : 0;
  const pjSac = r.sacTotal > 0 ? (r.sacJuros / r.sacTotal) * 100 : 0;
  // mês em que a parcela SAC fica menor que a Price
  const cross = useMemo(() => r.serie.find((p) => p.SAC <= p.Price)?.k || null, [r]);
  const chart = useMemo(() => { const step = Math.max(1, Math.ceil(r.N / 150)); return r.serie.filter((p, i) => i % step === 0 || p.k === r.N).map((p) => ({ k: p.k, Price: Math.round(p.Price * 100) / 100, SAC: Math.round(p.SAC * 100) / 100 })); }, [r]);

  const inputs = [['valor', 'Valor financiado (R$)', Database, '#22d3ee'], ['taxa', 'Juros (% a.m.)', Percent, '#a78bfa'], ['prazo', 'Prazo (meses)', CalendarDays, '#38bdf8']];
  const cards = [
    { id: 'price', title: 'Price (parcela fixa)', desc: 'Parcelas iguais do início ao fim. Mais previsível e fácil de planejar.', chip: 'Parcela fixa', chipIcon: CalendarClock, icon: Calculator, c: '#d946ef', from: '#f0abfc', to: '#c026d3', ring: 'ring-fuchsia-400/50', glow: 'shadow-[0_0_30px_-8px_rgba(217,70,239,.55)]', bg: 'linear-gradient(135deg,rgba(192,38,211,.22),rgba(76,29,149,.08) 70%)', first: r.price, last: r.price, total: r.priceTotal, juros: r.priceJuros, pj: pjPrice },
    { id: 'sac', title: 'SAC (parcela decrescente)', desc: 'Parcelas que diminuem ao longo do tempo. Menor custo total.', chip: 'Parcela decrescente', chipIcon: TrendingDown, icon: Layers, c: '#34d399', from: '#6ee7b7', to: '#10b981', ring: 'ring-emerald-400/50', glow: 'shadow-[0_0_30px_-8px_rgba(52,211,153,.5)]', bg: 'linear-gradient(135deg,rgba(16,185,129,.2),rgba(6,78,59,.08) 70%)', first: r.sacFirst, last: r.sacLast, total: r.sacTotal, juros: r.sacJuros, pj: pjSac },
  ];
  const lastK = chart[chart.length - 1]?.k;
  const xTicks = useMemo(() => { const st = r.N <= 24 ? 3 : r.N <= 180 ? 6 : r.N <= 360 ? 12 : 24; const t = [1]; for (let k = st; k < r.N; k += st) t.push(k); t.push(r.N); return t; }, [r.N]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative">
        <HeroTitle icon={GitCompare} lead="Price ×" accent="SAC" iconClass="text-cyan-400" subtitle={<>Compare os dois sistemas de amortização lado a lado e descubra<br className="hidden xl:block" /> qual se encaixa melhor no seu objetivo financeiro.</>} />
        <div className="hidden xl:flex absolute right-0 -top-3 items-center gap-4 pointer-events-none select-none">
          <HouseCalcArt className="w-80 h-36 opacity-90" />
          <ul className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]/80 p-3.5 space-y-2 text-sm">
            {['Compare custos totais', 'Veja a evolução das parcelas', 'Escolha com mais segurança'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{t}</li>)}
          </ul>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); simular(); }} className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-violet-400/30 shadow-[0_0_32px_-14px_rgba(168,85,247,.5)] p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
        {inputs.map(([k, l, Ic, c]) => (
          <div key={k} className="flex items-end gap-3">
            <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0 ring-1" style={{ background: `${c}22`, color: c, '--tw-ring-color': `${c}55` }}><Ic className="w-5 h-5" /></span>
            <div className="flex-1 min-w-0"><label className="text-xs text-muted">{l}</label><Input type="number" step="0.01" value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} className="mt-1 h-10 font-semibold" /></div>
          </div>
        ))}
        <GlowButton type="submit" tone="pink" className="h-11 px-6 justify-center"><Play className="w-4 h-4" />Simular Comparação</GlowButton>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map((c) => (
          <section key={c.id} className={`rounded-3xl bg-[hsl(var(--card))] ring-1 ${c.ring} ${c.glow} p-5`} style={{ backgroundImage: c.bg }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0 ring-1" style={{ background: `${c.c}26`, color: c.c, '--tw-ring-color': `${c.c}66` }}><c.icon className="w-6 h-6" /></span>
                <div className="min-w-0"><h3 className="font-display text-xl font-bold">{c.title}</h3><p className="text-xs text-muted">{c.desc}</p></div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 shrink-0" style={{ color: c.c, background: `${c.c}1f`, '--tw-ring-color': `${c.c}66` }}><c.chipIcon className="w-3.5 h-3.5" />{c.chip}</span>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <div className="flex-1 min-w-0 divide-y divide-[hsl(var(--border))] text-sm">
                {[[Boxes, '1ª parcela', money(c.first)], [CalendarDays, 'Última parcela', money(c.last)], [Layers, 'Total pago', money(c.total)], [Percent, 'Juros totais', money(c.juros), 'text-rose-500 dark:text-rose-400']].map(([Ic, l, v, cls]) => (
                  <div key={l} className="flex items-center gap-2 py-2"><Ic className="w-4 h-4 text-muted shrink-0" /><span className="text-muted flex-1">{l}</span><b className={`font-display ${cls || ''}`}>{v}</b></div>
                ))}
              </div>
              <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] p-3 text-center hidden sm:block">
                <p className="text-xs text-muted mb-1">Resumo</p>
                <Ring value={c.pj} size={112} stroke={10} from={c.from} to={c.to}><span className="font-display text-xl font-extrabold">{pctBR(c.pj)}</span><span className="text-[10px] text-muted leading-tight">do total<br />são juros</span></Ring>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl ring-1 ring-amber-400/50 bg-amber-500/10 shadow-[0_0_24px_-10px_rgba(251,191,36,.5)] p-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0 lg:pr-4 lg:border-r border-amber-400/30"><Lightbulb className="w-8 h-8 text-amber-400" /><b className="text-lg">Insight da comparação</b></div>
        <p className="text-sm flex-1">O <b>SAC</b> paga <b className="text-emerald-600 dark:text-emerald-300">{money(economia)} a menos de juros (−{pctBR(economiaPct)})</b> em relação ao Price{cross ? <>, e a parcela SAC fica menor que a Price a partir do <b>{cross}º mês</b></> : ''}. Já o <b>Price</b> tem parcelas fixas, o que o torna mais fácil de planejar no orçamento — e começa {money(r.sacFirst - r.price)} mais barato por mês.</p>
        <div className="flex gap-2 shrink-0">
          <span className="rounded-xl ring-1 ring-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 flex items-center gap-2"><Sprout className="w-5 h-5 text-emerald-400" /><span className="text-[11px] text-muted leading-tight">Menor custo (juros)<br /><b className="text-sm text-emerald-600 dark:text-emerald-300">SAC</b></span></span>
          <span className="rounded-xl ring-1 ring-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-1.5 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-fuchsia-400" /><span className="text-[11px] text-muted leading-tight">Mais previsível<br /><b className="text-sm text-fuchsia-600 dark:text-fuchsia-300">Price</b></span></span>
        </div>
      </section>

      <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-sky-400/30 shadow-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div><h3 className="font-semibold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" />Evolução da parcela</h3><p className="text-xs text-muted">Comparativo do valor da parcela ao longo do prazo ({r.N} meses)</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-3 text-xs px-3 py-1.5 rounded-full ring-1 ring-[hsl(var(--border))]"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 inline-block" />Price (parcela fixa)</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />SAC (parcela decrescente)</span></span>
            {[[TrendingDown, `−${pctBR(economiaPct)}`, 'de juros no SAC', '#34d399'], [Database, money(economia), 'economia total', '#22d3ee'], [CalendarDays, `${r.N} meses`, 'de prazo', '#a78bfa']].map(([Ic, v, l, c]) => (
              <span key={l} className="inline-flex items-center gap-2 rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-1.5"><Ic className="w-4 h-4" style={{ color: c }} /><span className="leading-tight"><b className="text-sm block" style={{ color: c }}>{v}</b><span className="text-[10px] text-muted">{l}</span></span></span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chart} margin={{ top: 56, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="k" type="number" domain={[1, r.N]} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} ticks={xTicks} />
            <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v)} />
            <Tooltip formatter={(v, k) => [money(v), k]} labelFormatter={(l) => `Mês ${l}`} contentStyle={TIP} />
            <Line dataKey="Price" stroke="#d946ef" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0 0 6px rgba(217,70,239,.6))' }} />
            <Line dataKey="SAC" stroke="#34d399" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,.6))' }} />
            <ReferenceDot x={1} y={r.sacFirst} r={6} fill="#34d399" stroke="#fff" strokeWidth={2} label={(p) => <Callout x={p.viewBox.x} y={p.viewBox.y} color="#34d399" title="SAC — 1ª parcela" value={money(r.sacFirst)} dx={10} dy={-50} />} />
            <ReferenceDot x={1} y={r.price} r={6} fill="#d946ef" stroke="#fff" strokeWidth={2} label={(p) => <Callout x={p.viewBox.x} y={p.viewBox.y} color="#d946ef" title="Price — parcela (fixa)" value={money(r.price)} dx={16} dy={10} />} />
            {lastK && <ReferenceDot x={lastK} y={r.price} r={6} fill="#d946ef" stroke="#fff" strokeWidth={2} label={(p) => <Callout x={p.viewBox.x} y={p.viewBox.y} color="#d946ef" title="Price — última parcela" value={money(r.price)} dx={-10} dy={-50} anchor="end" />} />}
            {lastK && <ReferenceDot x={lastK} y={r.sacLast} r={6} fill="#34d399" stroke="#fff" strokeWidth={2} label={(p) => <Callout x={p.viewBox.x} y={p.viewBox.y} color="#34d399" title="SAC — última parcela" value={money(r.sacLast)} dx={-10} dy={10} anchor="end" />} />}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted mt-1">Simulação sem seguros, tarifas e correção monetária (TR/IPCA), que variam por contrato. Use como comparação entre os sistemas, não como proposta de crédito.</p>
      </section>
    </div>
  );
}
