import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select } from '../components/ui';
import { HeroTitle, Panel, TIP } from '../components/kit.jsx';
import { PiggyVsVaultArt } from '../components/art/PageArt.jsx';
import { formatCurrency } from '../lib/utils.js';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { PiggyBank, Landmark, Trophy, Calculator, Wallet, CalendarDays, TrendingUp, Database, Percent, Info, ShieldCheck, CheckCircle2, LineChart as LineIcon, BarChart3, FileBadge2 } from 'lucide-react';

const n = (v) => { const x = Number(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const nd = (v) => { const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const SGS = (c) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${c}/dados/ultimos/1?formato=json`;
const money = (v) => formatCurrency(v);
const p2 = (v) => `${(Number.isFinite(v) ? v : 0).toFixed(2).replace('.', ',')}%`;
const BRACKETS = [[180, 0.225, 'até 6 meses'], [360, 0.20, '6 a 12 meses'], [720, 0.175, '12 a 24 meses'], [Infinity, 0.15, 'acima de 24 meses']];
const aliq = (a) => `${(a * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const irAliquota = (dias) => BRACKETS.find(([lim]) => dias <= lim)[1];
const PRAZOS = [3, 6, 12, 18, 24, 36, 48, 60];
const PCTS = [80, 85, 90, 95, 100, 105, 110, 115, 120, 130];

export default function SavingsVsCdb() {
  const [valor, setValor] = useState('10000');
  const [meses, setMeses] = useState('24');
  const [cdi, setCdi] = useState('14.9');
  const [selic, setSelic] = useState('15');
  const [pctCdi, setPctCdi] = useState('100');
  const [mode, setMode] = useState('saldo');
  const [auto, setAuto] = useState(false);

  const { data } = useQuery({
    queryKey: ['scdb-rates'], staleTime: 3600_000, retry: 1,
    queryFn: async () => { const [s, c] = await Promise.all([fetch(SGS(432)).then((r) => r.json()), fetch(SGS(4389)).then((r) => r.json())]); return { selic: Number(s?.[0]?.valor), cdi: Number(c?.[0]?.valor) }; },
  });
  useEffect(() => { if (data?.selic) { setSelic(String(data.selic)); setAuto(true); } if (data?.cdi) setCdi(String(data.cdi)); }, [data]);

  const r = useMemo(() => {
    const P = n(valor), M = Math.max(1, Math.round(nd(meses)));
    const cdiAA = nd(cdi), selicAA = nd(selic), fator = nd(pctCdi) / 100;
    const poupMes = selicAA > 8.5 ? 0.005 : (Math.pow(1 + selicAA * 0.7 / 100, 1 / 12) - 1);
    const cdbMes = Math.pow(1 + cdiAA * fator / 100, 1 / 12) - 1;
    const step = Math.max(1, Math.round(M / 8));
    const serie = [{ k: 0, label: 'Inicial', poup: P, cdb: P, gPoup: 0, gCdb: 0 }]; let poup = P, cdbBruto = P;
    for (let k = 1; k <= M; k++) {
      poup *= (1 + poupMes); cdbBruto *= (1 + cdbMes);
      if (k % step === 0 || k === M) { const cdbLiq = P + (cdbBruto - P) * (1 - irAliquota(k * 30)); serie.push({ k, label: `${k} ${k === 1 ? 'mês' : 'meses'}`, poup: Math.round(poup * 100) / 100, cdb: Math.round(cdbLiq * 100) / 100, gPoup: Math.round((poup - P) * 100) / 100, gCdb: Math.round((cdbLiq - P) * 100) / 100 }); }
    }
    const ir = irAliquota(M * 30);
    const irValor = (cdbBruto - P) * ir;
    const cdbLiq = cdbBruto - irValor;
    const anual = (fim) => (P > 0 ? (Math.pow(fim / P, 12 / M) - 1) * 100 : 0);
    const ganhoPoup = poup - P, ganhoCdb = cdbLiq - P;
    const vencedor = cdbLiq >= poup ? 'CDB' : 'Poupança';
    const dif = Math.abs(cdbLiq - poup);
    const difPct = Math.min(ganhoPoup, ganhoCdb) > 0 ? (dif / Math.min(poup, cdbLiq)) * 100 : 0;
    return { P, M, poup, cdbBruto, cdbLiq, ir, irValor, ganhoPoup, ganhoCdb, rentPoup: P ? (ganhoPoup / P) * 100 : 0, rentCdb: P ? (ganhoCdb / P) * 100 : 0, anualPoup: anual(poup), anualCdb: anual(cdbLiq), serie, vencedor, dif, difPct, brutoGanho: cdbBruto - P };
  }, [valor, meses, cdi, selic, pctCdi]);

  const cdbWins = r.vencedor === 'CDB';
  const last = r.serie.length - 1;
  const pill = (color, dy) => (p) => { if (p.index !== last) return null; const t = money(p.value); const w = t.length * 7 + 18; return <g><circle cx={p.x} cy={p.y} r="5" fill={color} stroke="#fff" strokeWidth="2" /><rect x={p.x - w - 6} y={p.y + dy - 14} width={w} height="24" rx="8" fill="hsl(var(--card))" stroke={color} /><text x={p.x - w / 2 - 6} y={p.y + dy + 3} textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>{t}</text></g>; };
  const field = (Icon, label, el) => <div className="min-w-0"><label className="text-sm font-semibold">{label}</label><div className="relative mt-1"><Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none" />{el}</div></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={PiggyBank} lead="Poupança ×" accent="CDB" iconClass="text-cyan-400" subtitle={<>Compare o rendimento líquido (já com IR) de um CDB contra a poupança<br className="hidden xl:block" /> e descubra qual faz seu dinheiro render mais.</>}
        art={<PiggyVsVaultArt className="w-[28rem] h-40 opacity-95" />} />

      <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-sky-400/30 shadow-soft p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div className="flex items-center gap-3 lg:w-56 shrink-0 lg:pr-4 lg:border-r border-[hsl(var(--border))]"><span className="w-11 h-11 rounded-xl grid place-items-center bg-sky-500/15 text-sky-400"><Calculator className="w-6 h-6" /></span><div><p className="font-semibold">Simulação</p><p className="text-xs text-muted">Ajuste os parâmetros e compare os resultados.</p></div></div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
            {field(Wallet, 'Valor (R$)', <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="pl-9" />)}
            {field(CalendarDays, 'Prazo (meses)', <Select value={meses} onChange={(e) => setMeses(e.target.value)} className="pl-9">{[...new Set([...PRAZOS, Number(meses)])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m}</option>)}</Select>)}
            {field(TrendingUp, 'CDI (% a.a.)', <Input inputMode="decimal" value={cdi} onChange={(e) => setCdi(e.target.value)} className="pl-9" />)}
            {field(Database, 'Selic (% a.a.)', <Input inputMode="decimal" value={selic} onChange={(e) => setSelic(e.target.value)} className="pl-9" />)}
            {field(Percent, 'CDB (% do CDI)', <Select value={pctCdi} onChange={(e) => setPctCdi(e.target.value)} className="pl-9">{[...new Set([...PCTS, Number(pctCdi)])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m}</option>)}</Select>)}
          </div>
        </div>
        <p className="text-xs text-muted mt-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />{auto ? 'CDI e Selic preenchidos automaticamente pelo Banco Central.' : 'CDI e Selic de referência — edite se quiser.'} Poupança é isenta de IR; o CDB paga IR regressivo ({aliq(r.ir)} neste prazo).</p>
      </section>

      <section className="relative overflow-hidden rounded-3xl ring-1 ring-emerald-400/50 shadow-[0_0_40px_-12px_rgba(52,211,153,.6)] p-5 flex flex-col md:flex-row md:items-center gap-5" style={{ background: cdbWins ? 'linear-gradient(110deg,#047857,#0f766e 35%,#4338ca 75%,#7c3aed)' : 'linear-gradient(110deg,#0e7490,#047857 60%,#065f46)' }}>
        <svg className="absolute right-40 bottom-0 w-80 h-24 opacity-50 pointer-events-none" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden><path d="M0 78 C80 70 140 60 200 40 S280 10 300 4" stroke="#a7f3d0" strokeWidth="2" fill="none" /></svg>
        <div className="flex items-center gap-4 text-white md:pr-6 md:border-r border-white/25"><Trophy className="w-12 h-12" strokeWidth={1.6} /><div><p className="text-sm opacity-90">Melhor opção neste cenário</p><p className="font-display text-4xl font-black tracking-wide">{r.vencedor.toUpperCase()}</p></div></div>
        <p className="text-white/95 flex-1">rende <b className="text-lg">{money(r.dif)}</b> a mais que {cdbWins ? 'a poupança' : 'o CDB'}<br />no fim do período (+{p2(r.difPct)} de ganho adicional).</p>
        <div className="relative rounded-2xl bg-black/25 ring-1 ring-white/25 px-5 py-3 flex items-center gap-3 text-white"><BarChart3 className="w-8 h-8 text-emerald-300" /><div><p className="text-xs opacity-80">Retorno líquido {cdbWins ? 'do CDB' : 'da poupança'}</p><p className="font-display text-3xl font-extrabold text-emerald-300">+{p2(cdbWins ? r.rentCdb : r.rentPoup)}</p></div></div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel tone="teal" title="Poupança" icon={PiggyBank} iconClass="text-cyan-400">
          <dl className="space-y-2.5 text-sm">
            <Row k="Saldo bruto (final)" v={money(r.poup)} />
            <Row k="Saldo líquido (final)" v={money(r.poup)} cls="text-emerald-500 dark:text-emerald-300 text-base" />
            <Row k="Rendimento (R$)" v={`+${money(r.ganhoPoup)}`} cls="text-sky-500" />
            <Row k="Rentabilidade no período" v={`+${p2(r.rentPoup)}`} cls="text-sky-500" />
            <Row k="Rentabilidade anualizada" v={`~ ${p2(r.anualPoup)} a.a.`} cls="text-sky-500" />
          </dl>
          <p className="mt-4 rounded-xl ring-1 ring-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Isenta de IR</p>
        </Panel>
        <Panel tone="violet" glow title={<>CDB <span className="text-violet-500 dark:text-violet-300 text-base">({pctCdi}% do CDI)</span></>} icon={FileBadge2} iconClass="text-violet-400">
          <dl className="space-y-2.5 text-sm">
            <Row k="Saldo bruto (final)" v={money(r.cdbBruto)} />
            <Row k={`IR (${aliq(r.ir)} sobre o rendimento)`} v={`- ${money(r.irValor)}`} cls="text-rose-500" />
            <Row k="Saldo líquido (final)" v={money(r.cdbLiq)} cls="text-emerald-500 dark:text-emerald-300 text-base" />
            <Row k="Rendimento líquido (R$)" v={`+${money(r.ganhoCdb)}`} cls="text-sky-500" />
            <Row k="Rentabilidade no período" v={`+${p2(r.rentCdb)}`} cls="text-sky-500" />
            <Row k="Rentabilidade anualizada" v={`~ ${p2(r.anualCdb)} a.a.`} cls="text-sky-500" />
          </dl>
        </Panel>
        <Panel tone="emerald" title="Insight da análise" icon={CheckCircle2} iconClass="text-emerald-400" action={<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-300">Auto</span>}>
          <p className="font-display text-2xl font-extrabold text-emerald-500 dark:text-emerald-300">{cdbWins ? 'O CDB vence!' : 'A poupança vence!'}</p>
          <p className="text-sm text-muted mt-1">No prazo de {r.M} meses, {cdbWins ? 'o CDB' : 'a poupança'} rende {money(r.dif)} a mais {cdbWins ? `que a poupança, mesmo com o desconto do IR de ${aliq(r.ir)}` : 'que o CDB — com este percentual do CDI, o IR come a vantagem'}.</p>
          <ul className="mt-3 rounded-xl ring-1 ring-[hsl(var(--border))] p-3 space-y-2 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />Rentabilidade líquida: CDB {p2(r.rentCdb)} × poupança {p2(r.rentPoup)}</li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />Diferença no fim: <b>{money(r.dif)}</b></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{r.M > 24 ? 'Acima de 24 meses o IR do CDB cai para 15%, a menor alíquota.' : `Ficando mais de ${r.M <= 6 ? 6 : r.M <= 12 ? 12 : 24} meses, a alíquota do IR do CDB cai.`}</li>
          </ul>
          <p className="text-[11px] text-muted mt-2">Considere também liquidez e garantia do FGC. Não é recomendação de investimento.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-7" tone="sky" title="Evolução do saldo" icon={LineIcon} iconClass="text-sky-400"
          action={<div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">{[['saldo', 'Saldo acumulado'], ['ganho', 'Rendimento']].map(([v, l]) => <button key={v} onClick={() => setMode(v)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${mode === v ? 'bg-sky-500 text-white' : 'text-muted'}`}>{l}</button>)}</div>}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={r.serie} margin={{ top: 26, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
              <YAxis width={52} domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v))} />
              <Tooltip formatter={(v, k) => [money(v), k]} contentStyle={TIP} />
              <Line dataKey={mode === 'saldo' ? 'poup' : 'gPoup'} name="Poupança (líquido)" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3 }} style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,.6))' }}><LabelList dataKey={mode === 'saldo' ? 'poup' : 'gPoup'} content={pill('#34d399', cdbWins ? 18 : -18)} /></Line>
              <Line dataKey={mode === 'saldo' ? 'cdb' : 'gCdb'} name="CDB (líquido)" stroke="#a855f7" strokeWidth={3} dot={{ r: 3 }} style={{ filter: 'drop-shadow(0 0 5px rgba(168,85,247,.6))' }}><LabelList dataKey={mode === 'saldo' ? 'cdb' : 'gCdb'} content={pill('#c084fc', cdbWins ? -18 : 18)} /></Line>
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-cyan-400" />Poupança (líquido)</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-violet-500" />CDB (líquido)</span></div>
        </Panel>
        <Panel className="xl:col-span-5" tone="sky" title="Sobre o Imposto de Renda (IR)" icon={Info} iconClass="text-sky-400">
          <p className="text-sm text-muted">O CDB tem IR sobre o rendimento, com alíquota regressiva conforme o prazo da aplicação:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {BRACKETS.map(([, a, l]) => { const on = a === r.ir; return <div key={l} className={`rounded-xl ring-1 p-2.5 text-center ${on ? 'ring-emerald-400 bg-emerald-500/10 shadow-[0_0_16px_-4px_rgba(52,211,153,.6)]' : 'ring-[hsl(var(--border))]'}`}><p className="font-display text-lg font-bold">{aliq(a)}</p><p className="text-[11px] text-muted">{l}</p></div>; })}
          </div>
          <p className="mt-4 rounded-xl ring-1 ring-[hsl(var(--border))] p-3 text-sm flex gap-3"><Landmark className="w-5 h-5 text-sky-400 shrink-0" />Neste cenário, o IR foi de {money(r.irValor)} ({aliq(r.ir)} de {money(r.brutoGanho)}), reduzindo o ganho bruto do CDB para {money(r.ganhoCdb)}.</p>
        </Panel>
      </div>
      <p className="text-xs text-muted text-center">Simulação educativa: meses de 30 dias, sem IOF (aplicações acima de 30 dias) e sem TR na poupança. Não é recomendação de investimento.</p>
    </div>
  );
}

function Row({ k, v, cls = '' }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={`font-display font-bold ${cls}`}>{v}</dd></div>;
}
