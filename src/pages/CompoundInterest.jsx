import { useMemo, useState } from 'react';
import { Input, Select } from '../components/ui';
import { HeroTitle, Panel, GlowButton, StatCard, TIP } from '../components/kit.jsx';
import { CoinsGrowthArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { Calculator, TrendingUp, PiggyBank, Coins, Repeat, LineChart as LineIcon, Wallet, Percent, CalendarClock, Eraser, Play, ShieldCheck, Gauge, Rocket, Info, ArrowUp } from 'lucide-react';

const LS = 'monvy_compound_v1';
const DEF = { inicial: '1000', aporte: '300', taxa: '1', periodicidade: 'am', prazo: '120' };
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const money = (v) => formatCurrency(v);
const pctBR = (v, d = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(d).replace('.', ',')}%`;
// Exemplos de taxa (só ilustram o cálculo — não são recomendação de investimento)
const PRESETS = [
  { id: 'cons', label: 'Conservador', taxa: '0.5', icon: ShieldCheck, tone: 'emerald' },
  { id: 'mod', label: 'Moderado', taxa: '1', icon: Gauge, tone: 'sky' },
  { id: 'agr', label: 'Agressivo', taxa: '1.5', icon: Rocket, tone: 'violet' },
];
const PRESET_CLS = { emerald: 'ring-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200', sky: 'ring-sky-400 bg-sky-500/15 text-sky-700 dark:text-sky-200', violet: 'ring-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200' };
const RANGES = [[12, '12m'], [24, '24m'], [60, '60m'], [120, '120m'], [0, 'Tudo']];

function simulate(f) {
  const iMes = f.periodicidade === 'aa' ? (Math.pow(1 + n(f.taxa) / 100, 1 / 12) - 1) : n(f.taxa) / 100;
  const meses = Math.max(0, Math.min(1200, Math.round(n(f.prazo))));
  let saldo = n(f.inicial); let investido = n(f.inicial);
  const serie = [{ mes: 0, saldo, investido }];
  for (let m = 1; m <= meses; m++) { saldo = saldo * (1 + iMes) + n(f.aporte); investido += n(f.aporte); serie.push({ mes: m, saldo, investido }); }
  return { iMes, meses, montante: saldo, investido, juros: Math.max(0, saldo - investido), serie };
}

export default function CompoundInterest() {
  const [f, setF] = useState(() => ({ ...DEF, ...(load() || {}) }));
  const [applied, setApplied] = useState(f);
  const [range, setRange] = useState(0);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const simular = () => { setApplied(f); try { localStorage.setItem(LS, JSON.stringify(f)); } catch { /* */ } };
  const limpar = () => { setF(DEF); setApplied(DEF); setRange(0); try { localStorage.removeItem(LS); } catch { /* */ } };
  const dirty = JSON.stringify(f) !== JSON.stringify(applied);

  const res = useMemo(() => simulate(applied), [applied]);
  const iMesDraft = f.periodicidade === 'aa' ? (Math.pow(1 + n(f.taxa) / 100, 1 / 12) - 1) : n(f.taxa) / 100;
  const iAnoDraft = Math.pow(1 + iMesDraft, 12) - 1;
  const ganhoPct = res.investido > 0 ? ((res.montante - res.investido) / res.investido) * 100 : 0;
  const rendPct = res.montante > 0 ? (res.juros / res.montante) * 100 : 0;

  const chart = useMemo(() => {
    const lim = range && range < res.meses ? range : res.meses;
    const pts = res.serie.slice(0, lim + 1);
    const step = Math.max(1, Math.ceil(pts.length / 160));
    const out = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    return out.map((p) => ({ mes: p.mes, saldo: Math.round(p.saldo), investido: Math.round(p.investido) }));
  }, [res, range]);
  const lastIdx = chart.length - 1;
  const endLabel = (color, dy) => (p) => {
    if (p.index !== lastIdx) return null;
    const txt = money(p.value); const w = txt.length * 6.8 + 16;
    return <g><circle cx={p.x} cy={p.y} r="5" fill={color} stroke="#fff" strokeWidth="2" /><rect x={p.x - w - 4} y={p.y + dy - 15} width={w} height="22" rx="7" fill="hsl(var(--card))" stroke={color} /><text x={p.x - w / 2 - 4} y={p.y + dy} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={color}>{txt}</text></g>;
  };
  // primeiro mês em que os juros do mês superam o aporte (efeito bola de neve)
  const snowball = useMemo(() => { if (n(applied.aporte) <= 0) return null; for (let m = 1; m < res.serie.length; m++) if (res.serie[m - 1].saldo * res.iMes >= n(applied.aporte)) return m; return null; }, [res, applied.aporte]);

  const fieldIcon = (Icon, c) => <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center" style={{ background: `${c}22`, color: c }}><Icon className="w-4 h-4" /></span>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Calculator} lead="Juros" accent="Compostos" iconClass="text-emerald-400" subtitle="Simule quanto seu dinheiro rende ao longo do tempo com aportes mensais."
        art={<CoinsGrowthArt className="w-80 h-36 opacity-90" />} />
      <div className="flex flex-wrap gap-2 -mt-1">
        {[[Repeat, 'Efeito dos juros compostos', 'Juros sobre juros, no longo prazo', '#34d399'], [CalendarClock, 'Aportes mensais', 'Construa patrimônio com disciplina', '#38bdf8'], [LineIcon, 'Projeção de crescimento', 'Visualize a evolução do seu dinheiro', '#a78bfa']].map(([Ic, l, d, c]) => (
          <span key={l} className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))]"><Ic className="w-5 h-5" style={{ color: c }} /><span className="leading-tight"><b className="text-xs block">{l}</b><span className="text-[11px] text-muted">{d}</span></span></span>
        ))}
      </div>

      <Panel tone="emerald" title="Configuração da simulação" icon={Calculator} iconClass="text-emerald-400"
        action={<div className="flex flex-wrap gap-2">{PRESETS.map((p) => { const on = f.taxa === p.taxa && f.periodicidade === 'am'; return (
          <button key={p.id} onClick={() => setF((s) => ({ ...s, taxa: p.taxa, periodicidade: 'am' }))} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 transition ${on ? PRESET_CLS[p.tone] : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}><p.icon className="w-3.5 h-3.5" />{p.label} · {p.taxa.replace('.', ',')}% a.m.</button>); })}</div>}>
        <form onSubmit={(e) => { e.preventDefault(); simular(); }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[['inicial', 'Valor inicial', Wallet, '#34d399', 'R$'], ['aporte', 'Aporte mensal', PiggyBank, '#38bdf8', 'R$'], ['taxa', 'Taxa de juros', Percent, '#a78bfa', '%']].map(([k, l, Ic, c, suf]) => (
              <div key={k}><label className="text-sm font-medium">{l}</label>
                <div className="relative mt-1">{fieldIcon(Ic, c)}<Input type="number" step="0.01" value={f[k]} onChange={(e) => set(k, e.target.value)} className="pl-12 pr-9 h-11" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suf}</span></div></div>
            ))}
            <div><label className="text-sm font-medium">Periodicidade</label>
              <div className="relative mt-1">{fieldIcon(Repeat, '#fbbf24')}<Select value={f.periodicidade} onChange={(e) => set('periodicidade', e.target.value)} className="pl-12 h-11"><option value="am">ao mês</option><option value="aa">ao ano</option></Select></div></div>
            <div><label className="text-sm font-medium">Prazo</label>
              <div className="relative mt-1">{fieldIcon(CalendarClock, '#f472b6')}<Input type="number" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} className="pl-12 pr-14 h-11" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">meses</span></div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-sky-400" />{pctBR(n(f.taxa), 2)} {f.periodicidade === 'aa' ? 'a.a.' : 'a.m.'} equivale a <b className="text-[hsl(var(--text))]">{pctBR(iMesDraft * 100, 3)} a.m.</b> ou <b className="text-[hsl(var(--text))]">{pctBR(iAnoDraft * 100, 2)} a.a.</b> · {Math.round(n(f.prazo))} meses (~{(n(f.prazo) / 12).toFixed(1).replace('.', ',')} anos)</p>
            <div className="flex gap-2">
              <button type="button" onClick={limpar} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ring-1 ring-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/10"><Eraser className="w-4 h-4" />Limpar</button>
              <GlowButton type="submit" tone="pink" className={dirty ? 'animate-pulse' : ''}><Play className="w-4 h-4" />Simular</GlowButton>
            </div>
          </div>
        </form>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard tone="emerald" icon={Coins} label="Montante final" value={money(res.montante)} sub={`em ${res.meses} meses`} chip={<span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><ArrowUp className="w-3 h-3" />+{pctBR(ganhoPct)} sobre o investido</span>} />
        <StatCard tone="sky" icon={PiggyBank} label="Total investido" value={money(res.investido)} sub={`${money(n(applied.inicial))} inicial + ${res.meses}× ${money(n(applied.aporte))}`} />
        <StatCard tone="violet" icon={TrendingUp} label="Juros ganhos" value={money(res.juros)} sub="só de rendimento" chip={<span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-300">{pctBR(rendPct)} do montante</span>} />
      </div>

      <Panel tone="sky" title="Evolução do patrimônio" icon={LineIcon} iconClass="text-sky-400"
        subtitle={snowball ? `A partir do mês ${snowball}, os juros do mês passam a render mais que o seu aporte — o efeito "bola de neve".` : 'Patrimônio (com juros) vs. o que você colocou do bolso.'}
        action={<div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">{RANGES.filter(([m]) => m === 0 || m < res.meses).map(([m, l]) => [m, m === 0 ? `${res.meses}m` : l]).map(([m, l]) => <button key={m} onClick={() => setRange(m)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${range === m ? 'bg-sky-500/20 text-sky-700 dark:text-sky-200 ring-1 ring-sky-400/50' : 'text-muted'}`}>{l}</button>)}</div>}>
        <div className="flex items-center gap-4 text-xs text-muted mb-1"><span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />Patrimônio</span><span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-violet-400 inline-block" />Total investido</span></div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chart} margin={{ top: 30, right: 14, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ciS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.45} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
              <linearGradient id="ciI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} minTickGap={24} />
            <YAxis width={52} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(v, k) => [money(v), k === 'saldo' ? 'Patrimônio' : 'Investido']} labelFormatter={(l) => `Mês ${l}`} contentStyle={TIP} />
            <Area dataKey="investido" stroke="#a78bfa" strokeWidth={2} fill="url(#ciI)"><LabelList dataKey="investido" content={endLabel('#a78bfa', -12)} /></Area>
            <Area dataKey="saldo" stroke="#34d399" strokeWidth={3} fill="url(#ciS)" style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,.5))' }}><LabelList dataKey="saldo" content={endLabel('#34d399', -12)} /></Area>
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
      <p className="text-xs text-muted text-center flex items-center justify-center gap-1.5"><Info className="w-3.5 h-3.5" />Estimativa educativa (juros compostos com aportes no fim de cada mês). Não considera impostos, taxas nem inflação, e não é recomendação de investimento.</p>
    </div>
  );
}
