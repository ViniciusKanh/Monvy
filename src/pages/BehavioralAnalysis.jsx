import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction } from '../api/entities.js';
import { useAiAnalysis } from '../components/AiInsight.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Spinner } from '../components/ui';
import { HeroTitle, Panel, GlowButton, TIP, pct1 } from '../components/kit.jsx';
import { HabitsArt, ChecklistArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { lastMonths, weekdaySpending, behaviorProfile, combineExpenses, detectSubscriptions } from '../lib/analytics.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShieldCheck, Activity, BarChart3, Lightbulb, ChevronRight, Brain, Sparkles, Cpu, ShoppingBag, Target, PiggyBank, CalendarDays, Zap, Flag, Layers, Gamepad2, Utensils, Rocket, TrendingUp, Equal, ArrowUp, ArrowDown, ChevronsRight } from 'lucide-react';

const PROFILE_TXT = {
  Conservador: 'Você é cauteloso com o dinheiro, prioriza segurança e evita riscos. Sua disciplina é um ponto forte — o desafio é não deixar de aproveitar o presente e fazer o dinheiro trabalhar por você.',
  Impulsivo: 'Parte relevante das suas compras foge do seu padrão de valor. O lado bom: você decide rápido. O desafio é planejar as compras maiores com antecedência.',
  Gastador: 'Você tem facilidade em gastar, especialmente com conveniência e momentos de prazer. O lado bom? Você aproveita bem o presente. O desafio é equilibrar essa liberdade com mais planejamento para garantir seus objetivos.',
  Equilibrado: 'Você mantém um bom equilíbrio entre gastar e guardar. O desafio é manter a consistência e direcionar a sobra para seus objetivos.',
};
const AX_ICON = { Controle: ShieldCheck, Poupanca: PiggyBank, Consistencia: Target, Diversificacao: Layers, Planejamento: CalendarDays };
const AX_LABEL = { Poupanca: 'Poupança', Consistencia: 'Consistência', Diversificacao: 'Diversificação' };
const lvl = (v, a, b) => (v >= b ? ['Alto', 'ring-rose-400/60 text-rose-500 dark:text-rose-300 bg-rose-500/10'] : v >= a ? ['Médio', 'ring-sky-400/60 text-sky-600 dark:text-sky-300 bg-sky-500/10'] : ['Baixo', 'ring-emerald-400/60 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10']);

export default function BehavioralAnalysis() {
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const months = useMemo(() => lastMonths(6), []);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const wd = useMemo(() => weekdaySpending(tx, null), [tx]);
  const b = useMemo(() => behaviorProfile({ transactions: tx, months, catMap }), [tx, months, catMap]);
  // janela anterior (mesmos 6 meses, terminando no mês passado) para medir a evolução em p.p.
  const pb = useMemo(() => { const start = `${monthKey(new Date())}-01`; const d = new Date(); d.setMonth(d.getMonth() - 1); const old = tx.filter((t) => String(t.date).slice(0, 10) < start); return old.some((t) => t.type === 'expense') ? behaviorProfile({ transactions: old, months: lastMonths(6, monthKey(d)), catMap }) : null; }, [tx, catMap]);
  const subs = useMemo(() => detectSubscriptions(tx), [tx]);
  const recurringMonthly = subs.reduce((s, x) => s + Number(x.amount || 0), 0);
  const ai = useAiAnalysis({ storageKey: 'behavior', agentFocus: 'Análise comportamental', prompt: `Faça uma leitura comportamental das minhas finanças. Meu perfil calculado é "${b.profile}" (impulsividade ${b.impulsivity}%, consistência ${b.consistency}%, taxa de poupança ${b.savingsRate}%, gasto no fim de semana ${b.weekendPct}% do gasto dos dias úteis, pico às ${b.peakDay}, ticket médio ${formatCurrency(b.avgTicket)}). Em no máximo 2 frases curtas, diga o que esse padrão revela e 1 ação prática.` });
  const [aiFull, setAiFull] = useState(false);

  const totalExp = b.distribution.reduce((s, c) => s + c.value, 0) || 1;
  const share = (re) => (b.distribution.filter((c) => re.test(c.name)).reduce((s, c) => s + c.value, 0) / totalExp) * 100;
  const lazer = share(/lazer|entret|divers|stream|viag|hobby/i);
  const fora = share(/aliment|restaur|delivery|ifood|lanche|bar\b/i);
  const monthsN = months.length || 1;
  const parts = useMemo(() => { const bk = [0, 0, 0]; for (const t of tx) { if (t.type !== 'expense') continue; const d = Number(String(t.date).slice(8, 10)) || 1; bk[d <= 10 ? 0 : d <= 20 ? 1 : 2] += Number(t.amount) || 0; } const tot = bk.reduce((a, c) => a + c, 0) || 1; return bk.map((v) => (v / tot) * 100); }, [tx]);
  const peakPart = parts.indexOf(Math.max(...parts));
  const lowPart = parts.indexOf(Math.min(...parts));
  const top = b.distribution[0];

  const lever = useMemo(() => {
    const c = [];
    if (top) c.push({ peso: top.value, txt: `Sua maior categoria é ${top.name} (${formatCurrency(top.value)}). Cortar 15% aqui já libera ${formatCurrency(top.value * 0.15)}.` });
    if (b.impulsivity >= 35) c.push({ peso: b.avgTicket * b.impulsivity, txt: `Impulsividade alta (${b.impulsivity}%). Adote a regra das 24h para compras acima de ${formatCurrency(b.avgTicket * 2)}.` });
    if (recurringMonthly > 0) c.push({ peso: recurringMonthly * 2, txt: `Você tem ${formatCurrency(recurringMonthly)}/mês em recorrentes. Revisar 1–2 assinaturas é ganho garantido todo mês.` });
    return c.sort((x, y) => y.peso - x.peso)[0] || null;
  }, [b, top, recurringMonthly]);

  const actions = [
    top && { tone: 'violet', icon: Target, title: `Reduza gastos em ${top.name}`, text: `Corte 15% nas compras de ${top.name} (${formatCurrency((top.value / monthsN) * 0.15)}/mês) e mantenha o resto do orçamento sem apertos.` },
    { tone: 'teal', icon: PiggyBank, title: 'Crie uma poupança automática', text: b.savingsRate >= 20 ? `Você já poupa ${b.savingsRate}% da renda. Automatizar a transferência no dia do salário ajuda a manter.` : `Separe ao menos 10% da renda todo mês, logo que o salário cair, para construir sua reserva.` },
    lazer > 0 ? { tone: 'amber', icon: BarChart3, title: 'Defina um limite de lazer', text: `Lazer e entretenimento somam ${pct1(lazer)} dos seus gastos (~${formatCurrency((totalExp * lazer) / 100 / monthsN)}/mês). Um teto mensal evita surpresas.` }
      : { tone: 'amber', icon: CalendarDays, title: 'Planeje o fim de semana', text: `Fins de semana equivalem a ${b.weekendPct}% do gasto dos dias úteis. Um teto para o FDS ajuda a manter o controle.` },
  ].filter(Boolean);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  const dpp = (a, k) => (pb ? a - pb[k] : null);
  const Metric = ({ value, label, sub, delta, good, icon: Ic, color, trend }) => (
    <div className="relative overflow-hidden rounded-2xl ring-1 p-4 bg-[hsl(var(--card))]" style={{ '--tw-ring-color': `${color}99`, backgroundImage: `linear-gradient(135deg, ${color}2e, transparent 60%)`, boxShadow: `0 0 26px -12px ${color}` }}>
      <svg viewBox="0 0 120 40" className="absolute right-0 bottom-0 w-36 h-14 opacity-70" preserveAspectRatio="none" aria-hidden="true"><path d={trend >= 0 ? 'M0 36 C30 34 50 30 70 22 S100 4 120 6' : 'M0 8 C30 10 50 18 70 24 S100 34 120 34'} stroke={color} strokeWidth="2.5" fill="none" /><path d={`${trend >= 0 ? 'M0 36 C30 34 50 30 70 22 S100 4 120 6' : 'M0 8 C30 10 50 18 70 24 S100 34 120 34'} V40 H0 Z`} fill={color} opacity=".15" /></svg>
      <div className="relative flex items-start gap-3"><Ic className="w-10 h-10 shrink-0" style={{ color }} strokeWidth={1.5} /><div className="min-w-0">
        <div className="flex items-center gap-2"><span className="font-display text-3xl font-extrabold" style={{ color }}>{value}%</span>{delta != null && <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${Math.abs(delta) < 0.5 ? 'ring-[hsl(var(--border))] text-muted' : (delta > 0) === good ? 'ring-emerald-400/50 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10' : 'ring-rose-400/50 text-rose-500 bg-rose-500/10'}`}>{Math.abs(delta) < 0.5 ? <Equal className="w-3 h-3" /> : delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{Math.abs(delta) < 0.5 ? '0' : `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta))}`} p.p.</span>}</div>
        <p className="font-semibold">{label}</p><p className="text-xs text-muted">{sub}</p></div></div>
    </div>
  );
  const RadarTick = ({ x, y, payload, cx, cy }) => { const Ic = AX_ICON[payload.value] || Activity; const dx = x - cx; const dy = y - cy; const ox = x + Math.sign(dx) * (Math.abs(dx) > 8 ? 26 : 0); const oy = y + (dy < -8 ? -18 : dy > 8 ? 16 : 0); return <g transform={`translate(${ox},${oy})`}><foreignObject x="-14" y="-24" width="28" height="22"><Ic className="w-5 h-5 mx-auto text-violet-400" /></foreignObject><text textAnchor="middle" y="10" fontSize="12" fill="hsl(var(--text))">{AX_LABEL[payload.value] || payload.value}</text></g>; };
  const aiTxt = ai.data?.text || '';
  const short = aiTxt.replace(/[#*_>`-]/g, '').replace(/\s+/g, ' ').trim();

  return (
    <div className="space-y-5 animate-fadeIn">
      <HeroTitle icon={Brain} lead="Análise Comportamental" accent="" iconClass="text-sky-400" subtitle="Entenda seus padrões, hábitos e decisões para evoluir sua relação com o dinheiro." />

      <section className="relative overflow-hidden rounded-3xl ring-1 ring-fuchsia-400/50 bg-[hsl(var(--card))] bg-[radial-gradient(70%_140%_at_0%_0%,rgba(168,85,247,.3),transparent),radial-gradient(50%_120%_at_100%_0%,rgba(236,72,153,.18),transparent)] p-5 shadow-[0_0_40px_-14px_rgba(217,70,239,.6)]">
        <HabitsArt className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 w-[400px] h-48 opacity-95 pointer-events-none" />
        <div className="relative flex items-start gap-4 lg:pr-[400px]">
          <span className="w-16 h-16 rounded-2xl grid place-items-center bg-violet-500/25 ring-1 ring-violet-400/60 shrink-0"><ShieldCheck className="w-9 h-9 text-violet-200" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-3xl font-extrabold">Perfil: <span className="bg-gradient-to-r from-fuchsia-500 to-pink-400 bg-clip-text text-transparent">{b.profile}</span></h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ring-1 ring-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><TrendingUp className="w-3.5 h-3.5" />{!pb ? 'Primeira leitura' : pb.profile === b.profile ? 'Perfil estável' : `Evoluiu de ${pb.profile}`}</span></div>
            <p className="text-sm text-muted mt-1.5 max-w-3xl">{PROFILE_TXT[b.profile] || b.desc}</p>
            {lever && <div className="mt-3 flex items-center gap-2 rounded-xl ring-1 ring-amber-400/40 bg-black/10 dark:bg-white/5 px-3 py-2 text-sm max-w-3xl"><Lightbulb className="w-4 h-4 text-amber-400 shrink-0" /><span className="flex-1"><b className="text-amber-600 dark:text-amber-300">Onde mexer primeiro:</b> {lever.txt}</span><ChevronRight className="w-4 h-4 text-muted" /></div>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl ring-1 ring-sky-400/40 bg-[hsl(var(--card))] px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0"><Brain className="w-6 h-6 text-fuchsia-400" /><b className="font-display text-lg">Leitura inteligente</b><span className="text-xs text-muted inline-flex items-center gap-1 ml-1">{ai.data?.via === 'gemini' ? <><Sparkles className="w-3.5 h-3.5 text-sky-400" />Gemini</> : <><Cpu className="w-3.5 h-3.5" />Motor Monvy</>}</span></div>
        <div className="flex-1 min-w-0 text-sm">{ai.busy ? <span className="text-muted flex items-center gap-2"><Spinner className="w-4 h-4" />Analisando seu comportamento…</span> : ai.data ? (aiFull ? <Markdown text={aiTxt} /> : <button onClick={() => setAiFull(true)} className="text-left w-full truncate" title="Ver leitura completa">{short}</button>) : <span className="text-muted">Gere uma leitura personalizada dos seus hábitos a partir dos dados abaixo.</span>}</div>
        <GlowButton tone="sky" onClick={() => { setAiFull(false); ai.gerar(); }} disabled={ai.busy} className="shrink-0">{ai.busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}{ai.data ? 'Gerar de novo' : 'Gerar leitura'}</GlowButton>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric icon={ShoppingBag} color="#2dd4bf" value={b.impulsivity} label="Impulsividade" sub={b.impulsivity < 20 ? 'Baixa' : b.impulsivity < 35 ? 'Moderada' : 'Alta'} delta={dpp(b.impulsivity, 'impulsivity')} good={false} trend={dpp(b.impulsivity, 'impulsivity') ?? 1} />
        <Metric icon={Target} color="#38bdf8" value={b.consistency} label="Consistência" sub={b.consistency >= 70 ? 'Alta' : b.consistency >= 40 ? 'Média' : 'Baixa'} delta={dpp(b.consistency, 'consistency')} good trend={dpp(b.consistency, 'consistency') ?? 1} />
        <Metric icon={PiggyBank} color="#f59e0b" value={b.savingsRate} label="Taxa Poupança" sub={b.savingsRate >= 20 ? 'Ótima' : b.savingsRate >= 10 ? 'Média' : 'Baixa'} delta={dpp(b.savingsRate, 'savingsRate')} good trend={dpp(b.savingsRate, 'savingsRate') ?? 1} />
        <Metric icon={CalendarDays} color="#c084fc" value={b.weekendPct} label="Gastos FDS" sub={`Pico: ${b.peakDay || '—'}`} delta={dpp(b.weekendPct, 'weekendPct')} good={false} trend={dpp(b.weekendPct, 'weekendPct') ?? 1} />
      </div>
      <p className="text-[11px] text-muted -mt-3">p.p. = pontos percentuais em relação à janela de 6 meses encerrada no mês passado. “Gastos FDS” compara o gasto de sábado e domingo com o dos dias úteis.</p>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-4" tone="violet" glow title="Perfil de Comportamento" icon={Activity} iconClass="text-fuchsia-400">
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={b.radar} outerRadius="66%">
                <defs><linearGradient id="baR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e879f9" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <PolarAngleAxis dataKey="axis" tick={<RadarTick />} />
                <Radar dataKey="value" stroke="#e879f9" strokeWidth={2} fill="url(#baR)" fillOpacity={0.55} dot={{ r: 4, fill: '#f5d0fe' }} />
                <Tooltip formatter={(v) => `${Math.round(v)}/100`} contentStyle={TIP} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="xl:col-span-4" tone="violet" title="Padrão por Dia da Semana" icon={BarChart3} iconClass="text-sky-400" subtitle="Todo o histórico">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wd} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}>
                <defs><linearGradient id="baW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#4f46e5" /></linearGradient><linearGradient id="baE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" /><stop offset="100%" stopColor="#db2777" /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={42} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34}>{wd.map((e, i) => <Cell key={i} fill={e.weekend ? 'url(#baE)' : 'url(#baW)'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500" />Fim de semana</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" />Semana</span><span className="ml-auto">Pico: <b className="text-[hsl(var(--text))]">{b.peakDay}</b></span></div>
        </Panel>
        <div className="xl:col-span-4 space-y-5">
          <Panel tone="violet" title="Gatilhos de consumo" icon={Zap} iconClass="text-fuchsia-400" subtitle="Categorias que mais puxam seus gastos.">
            {b.distribution.length === 0 ? <p className="text-sm text-muted">Sem despesas registradas.</p> : (
              <div className="grid grid-cols-4 gap-2">{b.distribution.slice(0, 4).map((c) => { const cat = categories.find((x) => x.name === c.name); const Ic = categoryIcon(cat || { name: c.name }); return (
                <div key={c.name} className="text-center"><span className="mx-auto w-11 h-11 rounded-xl grid place-items-center ring-1" style={{ background: `${c.color}26`, color: c.color, '--tw-ring-color': `${c.color}66` }}><Ic className="w-5 h-5" /></span><p className="text-[11px] font-semibold mt-1 leading-tight line-clamp-2">{c.name}</p><p className="text-[10px] text-muted">{pct1((c.value / totalExp) * 100)}</p></div>); })}</div>)}
          </Panel>
          <Panel tone="violet" title="Rotina financeira" icon={CalendarDays} iconClass="text-sky-400" subtitle="Seu comportamento ao longo do mês.">
            <div className="flex items-stretch gap-1.5">
              {[['Início do mês', Flag, 'text-emerald-400'], ['Meio do mês', BarChart3, 'text-amber-400'], ['Fim do mês', Flag, 'text-pink-400']].map(([l, Ic, c], k) => (
                <div key={l} className="contents">
                  <div className={`flex-1 rounded-xl ring-1 px-2 py-2 ${k === peakPart ? 'ring-amber-400/60 bg-amber-500/10' : 'ring-[hsl(var(--border))]'}`}>
                    <p className="text-xs font-semibold flex items-center gap-1"><Ic className={`w-4 h-4 ${c}`} />{l}</p>
                    <p className="text-[11px] text-muted">{pct1(parts[k])} dos gastos • {k === peakPart ? 'Gastos maiores' : k === lowPart ? 'Mais controle' : 'Moderado'}</p>
                  </div>
                  {k < 2 && <ChevronsRight className="w-4 h-4 self-center text-muted shrink-0" />}
                </div>))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-5" tone="violet" title="Resumo por hábito" icon={Layers} iconClass="text-sky-400" subtitle="Como seus principais hábitos impactam suas finanças.">
          <div className="flex items-center gap-3">
            <ChecklistArt className="hidden sm:block w-40 h-32 shrink-0" />
            <div className="flex-1 space-y-2.5 min-w-0">
              {[[ShoppingBag, 'Compras por impulso', b.impulsivity, lvl(b.impulsivity, 15, 35), '#ec4899'], [Gamepad2, 'Lazer e entretenimento', lazer, lvl(lazer, 10, 25), '#a855f7'], [Utensils, 'Alimentação fora', fora, lvl(fora, 10, 25), '#6366f1'], [CalendarDays, 'Planejamento de gastos', b.consistency, b.consistency >= 70 ? ['Alto', 'ring-emerald-400/60 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10'] : b.consistency >= 40 ? ['Médio', 'ring-sky-400/60 text-sky-600 dark:text-sky-300 bg-sky-500/10'] : ['Baixo', 'ring-rose-400/60 text-rose-500 bg-rose-500/10'], '#2dd4bf']].map(([Ic, l, v, [lv, cls], col]) => (
                <div key={l} className="flex items-center gap-2.5">
                  <Ic className="w-4 h-4 shrink-0" style={{ color: col }} /><span className="text-sm w-44 truncate">{l}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, v))}%`, background: `linear-gradient(90deg, ${col}, ${col}aa)`, boxShadow: `0 0 8px ${col}` }} /></div>
                  <span className={`text-[11px] font-bold w-14 text-center px-1.5 py-0.5 rounded-md ring-1 ${cls}`}>{lv}</span>
                </div>))}
              <p className="text-[10px] text-muted">Lazer e alimentação fora: participação nas suas despesas, pelas categorias.</p>
            </div>
          </div>
        </Panel>
        <Panel className="xl:col-span-7" tone="violet" glow title="Ações sugeridas" icon={Rocket} iconClass="text-fuchsia-400" subtitle="Passos práticos e personalizados para evoluir seu perfil.">
          <div className="grid md:grid-cols-3 gap-3">
            {actions.map((a, k) => { const T = { violet: 'ring-violet-400/60 bg-violet-500/10', teal: 'ring-teal-400/60 bg-teal-500/10', amber: 'ring-amber-400/60 bg-amber-500/10' }[a.tone]; const C = { violet: 'text-violet-400', teal: 'text-teal-400', amber: 'text-amber-400' }[a.tone]; return (
              <div key={k} className={`rounded-2xl ring-1 p-4 ${T}`}><p className="font-semibold flex items-center gap-2"><a.icon className={`w-6 h-6 ${C}`} />{a.title}</p><p className="text-sm text-muted mt-2">{a.text}</p></div>); })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
