import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Transaction, Goal } from '../api/entities.js';
import { Input, Select } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { HeroTitle, Panel, GlowButton, InsightsPanel, TIP } from '../components/kit.jsx';
import { MountainArt, PiggyArt, TargetArt } from '../components/art/PageArt.jsx';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import {
  Target, Coins, Clock, Car, Plane, Home, Hammer, Laptop, GraduationCap, Heart, ShieldCheck, Sparkles, PiggyBank, CalendarDays, Percent, Info, Flag, Trophy,
  BarChart3, TrendingUp, Shield, Zap, CheckCircle2, ChevronRight, Save, Wallet,
} from 'lucide-react';

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const KINDS = [
  { v: 'veiculo', label: 'Veículo', icon: Car, goalCat: 'car' },
  { v: 'viagem', label: 'Viagem', icon: Plane, goalCat: 'travel' },
  { v: 'imovel', label: 'Casa / Imóvel', icon: Home, goalCat: 'home' },
  { v: 'reforma', label: 'Reforma', icon: Hammer, goalCat: 'home' },
  { v: 'eletronico', label: 'Eletrônico', icon: Laptop, goalCat: 'other' },
  { v: 'educacao', label: 'Educação', icon: GraduationCap, goalCat: 'education' },
  { v: 'casamento', label: 'Casamento', icon: Heart, goalCat: 'other' },
  { v: 'reserva', label: 'Reserva', icon: ShieldCheck, goalCat: 'emergency' },
  { v: 'outro', label: 'Outro', icon: Target, goalCat: 'other' },
];
const SUGGEST = [
  { v: 'eletronico', name: 'Notebook', icon: Laptop, value: 4500 },
  { v: 'viagem', name: 'Viagem', icon: Plane, value: 8000 },
  { v: 'reforma', name: 'Reforma', icon: Home, value: 15000 },
];
// valor necessário por mês para chegar em A partindo de P0 em m meses a i% a.m.
const pmtFor = (A, P0, i, m) => { const fv0 = P0 * Math.pow(1 + i, m); const f = i === 0 ? m : (Math.pow(1 + i, m) - 1) / i; return f > 0 ? Math.max(0, (A - fv0) / f) : 0; };
const monthsFor = (A, P0, i, pmt) => { let s = P0, m = 0; if (s >= A) return 0; while (s < A && m < 1200) { s = s * (1 + i) + pmt; m++; } return s >= A ? m : null; };
const fmtPct = (v) => `${String(Number(v).toFixed(2)).replace(/0$/, '').replace('.', ',')}% a.m.`;

export default function GoalPlanner() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [modo, setModo] = useState('aporte');
  const [kind, setKind] = useState('veiculo');
  const [alvo, setAlvo] = useState('20000');
  const [inicial, setInicial] = useState('2000');
  const [prazo, setPrazo] = useState('24');
  const [aporte, setAporte] = useState('500');
  const [taxa, setTaxa] = useState('0.8');
  const K = KINDS.find((k) => k.v === kind) || KINDS[0];

  const r = useMemo(() => {
    const A = n(alvo), P0 = n(inicial), i = n(taxa) / 100;
    const meses = modo === 'aporte' ? Math.max(1, Math.round(n(prazo))) : monthsFor(A, P0, i, n(aporte));
    const pmt = modo === 'aporte' ? pmtFor(A, P0, i, meses) : n(aporte);
    const horizon = meses == null ? 0 : meses;
    const series = []; let s = P0; let reach = P0 >= A ? 0 : null;
    series.push({ m: 0, saldo: Math.round(P0) });
    for (let k = 1; k <= horizon; k++) { s = s * (1 + i) + pmt; if (reach == null && s >= A - 0.5) reach = k; series.push({ m: k, saldo: Math.round(s * 100) / 100 }); }
    const aportes = pmt * horizon; const totalAportado = P0 + aportes; const final = series[series.length - 1].saldo;
    const marcoMes = (frac) => { const tgt = A * frac; if (P0 >= tgt) return 0; const hit = series.find((p) => p.saldo >= tgt - 0.5); return hit ? hit.m : null; };
    return { meses, pmt, aportes, totalAportado, juros: Math.max(0, final - totalAportado), final, series, reach, marcoMes, A, P0, i };
  }, [modo, alvo, inicial, prazo, aporte, taxa]);

  // sobra média mensal (receitas − despesas dos últimos 3 meses fechados)
  const sobra = useMemo(() => {
    const now = new Date(); let tot = 0;
    for (let k = 1; k <= 3; k++) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; for (const t of transactions) { if (String(t.date).slice(0, 7) !== mk) continue; if (t.type === 'income') tot += n(t.amount); else if (t.type === 'expense') tot -= n(t.amount); } }
    return tot / 3;
  }, [transactions]);

  const scen = (rate) => (modo === 'aporte' ? pmtFor(r.A, r.P0, rate / 100, r.meses || 1) : monthsFor(r.A, r.P0, rate / 100, n(aporte)));
  const plus100 = modo === 'aporte' ? monthsFor(r.A, r.P0, r.i, r.pmt + 100) : monthsFor(r.A, r.P0, r.i, n(aporte) + 100);
  const ganho = r.meses != null && plus100 != null ? r.meses - plus100 : null;

  const saveGoal = useMutation({
    mutationFn: () => { const d = new Date(); d.setMonth(d.getMonth() + (r.meses || 0)); return Goal.create({ name: `${K.label}${modo === 'aporte' ? '' : ' (plano)'}`, category: K.goalCat, target_amount: r.A, current_amount: r.P0, monthly_target: Math.round(r.pmt * 100) / 100, target_date: r.meses != null ? d.toISOString().slice(0, 10) : null, color: '#10b981', history: r.P0 > 0 ? [{ date: todayIso(), amount: r.P0, kind: 'inicial' }] : [] }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Meta criada a partir do plano'); },
  });

  const marcos = [
    { label: 'Início da jornada', sub: 'Definição do objetivo e primeiro aporte.', when: 'Hoje', val: null, done: true },
    ...[0.25, 0.5, 0.75].map((f) => ({ label: `${f * 100}% da meta`, val: r.A * f, m: r.marcoMes(f) })),
    { label: 'Meta alcançada!', val: r.A, m: r.reach, final: true },
  ];

  const insights = [
    { tone: 'violet', icon: Target, title: `Rendimento de ${fmtPct(n(taxa))}`, text: n(taxa) > 0 ? `Gera ${formatCurrency(r.juros)} de juros no período — ${r.final > 0 ? Math.round((r.juros / r.final) * 100) : 0}% do valor final.` : 'Sem rendimento, todo o valor sai dos seus aportes.' },
    ganho != null && ganho > 0 && { tone: 'pink', icon: BarChart3, title: 'Aumente seu aporte em +R$ 100,00', text: `Você pode antecipar a conquista em ~${ganho} ${ganho === 1 ? 'mês' : 'meses'}.` },
    sobra > 0 && { tone: r.pmt <= sobra ? 'emerald' : 'amber', icon: Wallet, title: r.pmt <= sobra ? 'Cabe na sua sobra média' : 'Acima da sua sobra média', text: `Sua sobra média dos últimos 3 meses é ${formatCurrency(sobra)}/mês; o plano pede ${formatCurrency(r.pmt)}/mês.` },
    { tone: 'sky', icon: Shield, title: 'Transforme o plano em meta', text: 'Acompanhe os depósitos e o progresso na tela de Metas.', onClick: () => saveGoal.mutate() },
  ];

  const Num = ({ label, icon: Ic, value, onChange, step, suffix }) => (
    <label className="block min-w-0">
      <span className="flex items-center gap-1.5 text-sm text-muted mb-1.5 whitespace-nowrap"><Ic className="w-4 h-4 text-fuchsia-400 shrink-0" />{label}</span>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="!text-base font-semibold" aria-label={label} />
      {suffix}
    </label>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5">
        <div className="2xl:col-span-9 space-y-5 min-w-0">
          <HeroTitle icon={Target} lead="Planejador de" accent="Objetivo" iconClass="text-fuchsia-400" subtitle="Planeje uma compra ou sonho: quanto guardar por mês ou em quanto tempo você chega lá." art={<MountainArt className="w-80 h-40" />} />

          <div className="flex flex-wrap gap-3">
            {[['aporte', 'Quanto guardar/mês', Coins], ['tempo', 'Em quanto tempo', Clock]].map(([v, l, Ic]) => (
              <button key={v} onClick={() => setModo(v)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold ring-1 transition ${modo === v ? 'bg-gradient-to-r from-teal-500/30 to-fuchsia-500/25 ring-teal-400/60 shadow-[0_0_18px_rgba(45,212,191,.25)]' : 'ring-[hsl(var(--border))] text-muted bg-[hsl(var(--card))] hover:text-[hsl(var(--text))]'}`}><Ic className="w-4 h-4" />{l}</button>
            ))}
          </div>

          <section className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-violet-400/30 p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_.8fr_.8fr] gap-3">
              <label className="block min-w-0">
                <span className="flex items-center gap-1.5 text-sm text-muted mb-1.5"><Target className="w-4 h-4 text-fuchsia-400" />Tipo de objetivo</span>
                <div className="relative"><K.icon className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" /><Select value={kind} onChange={(e) => setKind(e.target.value)} className="!pl-9 !text-base font-semibold">{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select></div>
              </label>
              <Num label="Valor do objetivo (R$)" icon={Coins} value={alvo} onChange={setAlvo} />
              <Num label="Já guardado (R$)" icon={PiggyBank} value={inicial} onChange={setInicial} />
              {modo === 'aporte' ? <Num label="Prazo (meses)" icon={CalendarDays} value={prazo} onChange={setPrazo} /> : <Num label="Aporte (R$/mês)" icon={CalendarDays} value={aporte} onChange={setAporte} />}
              <Num label="Rendimento % a.m." icon={Percent} value={taxa} onChange={setTaxa} step="0.01" />
            </div>
            <p className="text-xs text-muted mt-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Dica: ~0,8% a.m. é uma estimativa conservadora para renda fixa. Deixe 0 para uma poupança simples sem rendimento.</p>
          </section>

          {/* Banner de resultado */}
          <section className="relative overflow-hidden rounded-3xl ring-1 ring-teal-400/50 p-5 sm:p-6 bg-[linear-gradient(110deg,rgba(13,148,136,.35),rgba(30,64,175,.25)_50%,rgba(192,38,211,.35))] shadow-[0_0_40px_-10px_rgba(45,212,191,.5)]">
            <div className="flex items-center gap-4">
              <PiggyArt className="hidden sm:block w-28 h-24 shrink-0" />
              <div className="min-w-0 flex-1">
                {modo === 'aporte'
                  ? <p className="text-base sm:text-lg">Para juntar {formatCurrency(r.A)} em {r.meses} {r.meses === 1 ? 'mês' : 'meses'}, guarde por mês</p>
                  : <p className="text-base sm:text-lg">Guardando {formatCurrency(n(aporte))}/mês, você chega a {formatCurrency(r.A)} em</p>}
                <p className="font-display text-4xl sm:text-6xl font-extrabold leading-tight">{modo === 'aporte' ? <AnimatedValue value={r.pmt} format={formatCurrency} /> : r.meses != null ? `${r.meses} ${r.meses === 1 ? 'mês' : 'meses'}` : 'mais de 100 anos'}</p>
                {modo === 'tempo' && r.meses != null && <p className="text-sm opacity-90">≈ {(r.meses / 12).toFixed(1).replace('.', ',')} anos</p>}
                <button onClick={() => saveGoal.mutate()} disabled={saveGoal.isPending || r.meses == null} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/15 ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-50"><Save className="w-3.5 h-3.5" />Salvar como meta</button>
              </div>
              <TargetArt className="hidden md:block w-36 h-28 shrink-0" />
            </div>
          </section>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[[Coins, '#38bdf8', 'Total aportado', formatCurrency(r.totalAportado)], [BarChart3, '#34d399', 'Juros estimados', formatCurrency(r.juros), 'text-fuchsia-500 dark:text-fuchsia-300'], [CalendarDays, '#c084fc', 'Prazo', r.meses != null ? `${r.meses} meses` : '—']].map(([Ic, c, l, v, cls]) => (
              <div key={l} className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] p-4 flex items-center gap-3"><Ic className="w-9 h-9 shrink-0" style={{ color: c }} strokeWidth={1.6} /><div className="min-w-0"><p className="text-xs text-muted">{l}</p><p className={`font-display text-lg font-bold truncate ${cls || ''}`}>{v}</p></div></div>
            ))}
            {[[0.6, 'Cenário conservador', Shield], [0.8, 'Cenário moderado', TrendingUp]].map(([rate, l, Ic]) => { const on = Math.abs(n(taxa) - rate) < 0.001; const res = scen(rate); return (
              <button key={rate} onClick={() => setTaxa(String(rate))} className={`relative text-left rounded-2xl ring-1 p-4 flex items-center gap-3 transition ${on ? 'ring-2 ring-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(45,212,191,.3)]' : 'ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:ring-teal-400/50'}`}>
                {on && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-fuchsia-400" />}
                <Ic className="w-9 h-9 shrink-0 text-sky-400" strokeWidth={1.6} />
                <div className="min-w-0"><p className="text-xs text-muted">{l}</p><p className="font-display text-lg font-bold text-sky-500 dark:text-sky-300">{fmtPct(rate)}</p><p className="text-[11px] text-muted truncate">{modo === 'aporte' ? `${formatCurrency(res)}/mês` : res != null ? `${res} meses` : '—'}</p></div>
              </button>); })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Panel title="Projeção de crescimento" icon={BarChart3} iconClass="text-violet-400" subtitle={`Evolução do seu saldo ao longo de ${r.meses ?? 0} meses, com rendimento de ${fmtPct(n(taxa))}`} className="lg:col-span-7" tone="violet">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.series} margin={{ top: 34, right: 64, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="gpA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v === 0 ? 'Mês 0' : v)} minTickGap={18} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Saldo']} labelFormatter={(l) => `Mês ${l}`} contentStyle={TIP} />
                    <Area type="monotone" dataKey="saldo" stroke="#22d3ee" strokeWidth={3} fill="url(#gpA)" dot={r.series.length <= 40 ? { r: 3, fill: '#e0f2fe', stroke: '#22d3ee' } : false} />
                    {r.reach != null && <ReferenceDot x={r.reach} y={r.series[r.reach]?.saldo} r={7} fill="#0f172a" stroke="#22d3ee" strokeWidth={3} label={{ value: `🏆 ${formatCurrency(r.A)}`, position: 'top', fill: 'hsl(var(--text))', fontSize: 12, fontWeight: 700 }} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Resumo da projeção" icon={TrendingUp} iconClass="text-fuchsia-400" className="lg:col-span-5" tone="violet">
              <div className="divide-y divide-[hsl(var(--border))] text-sm">
                {[[Clock, 'Saldo inicial', r.P0], [Coins, `Aportes (${r.meses ?? 0}x)`, r.aportes], [Percent, `Juros (${fmtPct(n(taxa))})`, r.juros]].map(([Ic, l, v]) => <div key={l} className="flex items-center gap-2.5 py-3"><Ic className="w-4 h-4 text-muted" /><span className="flex-1">{l}</span><b>{formatCurrency(v)}</b></div>)}
              </div>
              <div className="mt-3 rounded-2xl ring-1 ring-fuchsia-400/60 bg-fuchsia-500/10 px-4 py-3 flex items-center gap-3"><Trophy className="w-6 h-6 text-amber-400" /><span className="flex-1 font-semibold">Total ao final</span><span className="font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-300">{formatCurrency(r.final)}</span></div>
            </Panel>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="2xl:col-span-3 space-y-5">
          <Panel title="Marcos da jornada" icon={Flag} iconClass="text-violet-400" subtitle="Acompanhe os principais momentos até a sua conquista." tone="violet">
            <div className="relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-400 via-cyan-400 to-fuchsia-500 opacity-60" />
              {marcos.map((mk, k) => { const reached = mk.done || mk.m === 0; return (
                <div key={k} className="relative flex items-start gap-3 py-2">
                  <span className={`relative z-[1] w-6 h-6 rounded-full grid place-items-center shrink-0 ring-2 ${mk.final ? 'bg-violet-500/30 ring-violet-400 text-amber-300' : reached ? 'bg-emerald-500 ring-emerald-300 text-white' : k === 1 ? 'bg-cyan-500/20 ring-cyan-400' : 'bg-[hsl(var(--card))] ring-[hsl(var(--border))]'}`}>{mk.final ? <Trophy className="w-3.5 h-3.5" /> : reached ? <CheckCircle2 className="w-3.5 h-3.5" /> : k === 1 ? <span className="w-2 h-2 rounded-full bg-cyan-400" /> : null}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{mk.label}</p><p className="text-[11px] text-muted">{mk.sub || (mk.m === 0 ? 'Já alcançado.' : mk.m != null ? `Previsto em ~${mk.m} ${mk.m === 1 ? 'mês' : 'meses'}.` : 'Fora do horizonte simulado.')}</p></div>
                  <span className="text-xs font-semibold whitespace-nowrap">{mk.when || formatCurrency(mk.val)}</span>
                </div>); })}
            </div>
          </Panel>
          <InsightsPanel title="Insights do Monvy" subtitle="Leitura automática do seu objetivo." items={insights.slice(0, 3)} />
          <Panel title="Sugestões de objetivo" icon={Zap} iconClass="text-fuchsia-400" subtitle={sobra > 0 ? `Prazos com sua sobra média de ${formatCurrency(sobra)}/mês.` : 'Sua sobra média dos últimos 3 meses não foi positiva, então não dá para estimar prazos.'} tone="violet">
            <div className="grid grid-cols-3 gap-2">
              {SUGGEST.map((s) => { const m = sobra > 0 ? Math.ceil(s.value / sobra) : null; return (
                <button key={s.name} onClick={() => { setKind(s.v); setAlvo(String(s.value)); setInicial('0'); if (m) { setModo('aporte'); setPrazo(String(m)); } }} className="rounded-2xl ring-1 ring-teal-400/40 bg-gradient-to-b from-teal-500/15 to-transparent p-2.5 text-center hover:ring-teal-400 transition">
                  <s.icon className="w-7 h-7 mx-auto text-sky-400" />
                  <p className="font-semibold text-sm mt-1">{s.name}</p>
                  <p className="text-xs">{formatCurrency(s.value)}</p>
                  <p className="text-[11px] text-muted mt-0.5 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{m ? `${m} meses` : '—'}</p>
                </button>); })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
