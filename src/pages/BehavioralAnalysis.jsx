import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Category, CreditCardTransaction, Account, Investment, Debt, Goal, Subscription, CreditCardInvoice, AppSettings } from '../api/entities.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Spinner, Badge, Button } from '../components/ui';
import { toast } from '../lib/toast.js';
import { formatCurrency } from '../lib/utils.js';
import { lastMonths, monthlySeries, weekdaySpending, behaviorProfile, combineExpenses, detectSubscriptions } from '../lib/analytics.js';
import { answerHybrid } from '../lib/chat.js';
import { Markdown } from '../components/Markdown.jsx';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShieldCheck, Activity, TrendingUp, Clock, BarChart3, HeartPulse, RefreshCw, CalendarRange, Sparkles, Cpu, Brain, Lightbulb } from 'lucide-react';

const AI_KEY = 'monvy_behavior_ai';

export default function BehavioralAnalysis() {
  const { user } = useAuth();
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => Goal.list() });
  const { data: subsAll = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => Subscription.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => CreditCardInvoice.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const apiKey = settingsList[0]?.gemini_api_key;
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [ai, setAi] = useState(() => { try { return JSON.parse(localStorage.getItem(AI_KEY)) || null; } catch { return null; } });
  const [aiBusy, setAiBusy] = useState(false);

  const months = useMemo(() => lastMonths(6), []);
  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const series = useMemo(() => monthlySeries(tx, months), [tx, months]);
  const wd = useMemo(() => weekdaySpending(tx, null), [tx]);
  const b = useMemo(() => behaviorProfile({ transactions: tx, months, catMap }), [tx, months, catMap]);
  const maxDist = b.distribution[0]?.value || 1;

  // recorrente (assinaturas detectadas) vs variavel + concentracao no mês
  const subs = useMemo(() => detectSubscriptions(tx), [tx]);
  const recurringMonthly = subs.reduce((s, x) => s + Number(x.amount || 0), 0);
  const partsOfMonth = useMemo(() => {
    const buckets = { 'Inicio (1-10)': 0, 'Meio (11-20)': 0, 'Fim (21-31)': 0 };
    for (const t of tx) { if (t.type !== 'expense') continue; const d = Number(String(t.date).slice(8, 10)) || 1; const k = d <= 10 ? 'Inicio (1-10)' : d <= 20 ? 'Meio (11-20)' : 'Fim (21-31)'; buckets[k] += Number(t.amount) || 0; }
    const total = Object.values(buckets).reduce((a, c) => a + c, 0) || 1;
    return Object.entries(buckets).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  }, [tx]);
  const peakPart = partsOfMonth.reduce((a, c) => (c.value > a.value ? c : a), partsOfMonth[0]);

  // Principal alavanca: onde mexer primeiro tem mais efeito
  const lever = useMemo(() => {
    const cands = [];
    if (b.distribution[0]) cands.push({ k: 'categoria', peso: b.distribution[0].value, txt: `Sua maior categoria é ${b.distribution[0].name} (${formatCurrency(b.distribution[0].value)}). Cortar 15% aqui já libera ${formatCurrency(b.distribution[0].value * 0.15)}.` });
    if (b.impulsivity >= 35) cands.push({ k: 'impulso', peso: b.avgTicket * b.impulsivity, txt: `Impulsividade alta (${b.impulsivity}%). Adote a regra das 24h para compras acima de ${formatCurrency(b.avgTicket * 2)}.` });
    if (recurringMonthly > 0) cands.push({ k: 'recorrente', peso: recurringMonthly * 2, txt: `Você tem ${formatCurrency(recurringMonthly)}/mês em recorrentes. Revisar 1–2 assinaturas é ganho garantido todo mês.` });
    if (b.weekendPct >= 40) cands.push({ k: 'fds', peso: b.weekendPct * 10, txt: `Fins de semana pesam ${b.weekendPct}% dos gastos. Definir um teto de lazer no FDS costuma ajudar bastante.` });
    return cands.sort((a, c) => c.peso - a.peso)[0] || null;
  }, [b, recurringMonthly]);

  const gerarIA = async () => {
    setAiBusy(true);
    try {
      const ctx = { user, transactions: tx, accounts, categories, catMap, investments, debts, goals, subs: subsAll, invoices };
      const q = `Faça uma leitura comportamental das minhas finanças. Meu perfil calculado é "${b.profile}" (impulsividade ${b.impulsivity}%, consistência ${b.consistency}%, taxa de poupança ${b.savingsRate}%, ${b.weekendPct}% dos gastos no fim de semana, pico às ${b.peakDay}, ticket médio ${formatCurrency(b.avgTicket)}). Explique em 3 a 4 frases o que esse padrão diz sobre meus hábitos e traga 3 recomendações práticas e personalizadas, cada uma começando com um verbo. Seja direto, sem repetir só os números.`;
      const { text, via } = await answerHybrid({ question: q, ctx, agent: { name: 'Analista', focusLabel: 'Análise comportamental' }, apiKey, history: [] });
      const payload = { text, via, at: Date.now() };
      setAi(payload);
      try { localStorage.setItem(AI_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    } catch (e) { toast.error(e.message || 'Não consegui gerar a leitura agora.'); } finally { setAiBusy(false); }
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><BarChart3 className="w-6 h-6 text-violet-500" /> Análise Comportamental</span>}
        subtitle="Seus padrões de consumo (contas + cartão), decodificados — 100% local" />

      {/* Perfil */}
      <div className="rounded-2xl p-6 text-white shadow-soft" style={{ background: 'linear-gradient(120deg,#4338ca,#7c3aed)' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><ShieldCheck className="w-7 h-7" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h2 className="font-display text-2xl font-bold">Perfil: {b.profile}</h2></div>
            <p className="text-sm text-white/85 mt-1 max-w-2xl">{b.desc}</p>
            {lever && <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/10 p-3 text-sm"><Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" /><span><b>Onde mexer primeiro:</b> {lever.txt}</span></div>}
          </div>
        </div>
      </div>

      {/* Leitura por IA */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-violet-500" /> Leitura inteligente
            {ai && <span className="text-[10px] font-normal text-muted inline-flex items-center gap-1 ml-1">{ai.via === 'gemini' ? <><Sparkles className="w-3 h-3 text-emerald-500" /> Gemini</> : <><Cpu className="w-3 h-3" /> Motor local</>}</span>}
          </h3>
          <Button size="sm" variant="outline" onClick={gerarIA} disabled={aiBusy}>{aiBusy ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> {ai ? 'Gerar de novo' : 'Gerar leitura'}</>}</Button>
        </div>
        {aiBusy ? <div className="flex items-center gap-2 text-sm text-muted py-2"><Spinner className="w-4 h-4 text-violet-500" /> Analisando seu comportamento…</div>
          : ai ? <Markdown text={ai.text} className="text-sm" />
          : <p className="text-sm text-muted">Gere uma análise personalizada dos seus hábitos {apiKey ? 'com IA generativa (Gemini)' : 'com o motor local'}, a partir dos dados abaixo. Ela fica salva até você gerar de novo.</p>}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Impulsividade" value={`${b.impulsivity}%`} sub={b.impulsivity < 20 ? 'Baixa' : b.impulsivity < 35 ? 'Moderada' : 'Alta'} color="#10b981" />
        <MetricCard label="Consistencia" value={`${b.consistency}%`} sub={b.consistency >= 70 ? 'Alta' : 'Variavel'} color="#0ea5e9" />
        <MetricCard label="Taxa Poupança" value={`${b.savingsRate}%`} sub={b.savingsRate >= 20 ? 'Ótima' : 'Baixa'} color="#10b981" />
        <MetricCard label="Gastos FDS" value={`${b.weekendPct}%`} sub={`Pico: ${b.peakDay}`} color="#8b5cf6" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-violet-500" /> Perfil de Comportamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={b.radar} outerRadius="72%"><PolarGrid stroke="hsl(var(--border))" /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} /><Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} /></RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-indigo-500" /> Padrão por Dia da Semana</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wd}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="value" radius={[6,6,0,0]} maxBarSize={36}>{wd.map((e, i) => <Cell key={i} fill={e.weekend ? '#f43f5e' : '#6366f1'} />)}</Bar></BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs text-muted mt-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Fim de semana</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Semana</span></div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Evolucao — 6 meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Line dataKey="inc" name="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} /><Line dataKey="exp" name="Despesa" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Distribuicao de Gastos</h3>
          {b.distribution.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem despesas registradas</p>
            : <div className="space-y-3">{b.distribution.slice(0, 6).map((c, i) => (
              <div key={i}><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="font-semibold">{formatCurrency(c.value)}</span></div><div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.value / maxDist) * 100}%`, background: c.color }} /></div></div>
            ))}</div>}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3"><HeartPulse className="w-4 h-4 text-rose-500" /> Padrões Comportamentais Detectados</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Pattern icon={Clock} color="#0ea5e9" title="Comportamento Temporal" text={`Você gasta mais as ${b.peakDay}. Fins de semana representam ${b.weekendPct}% do gasto de dias uteis.`} />
          <Pattern icon={BarChart3} color="#8b5cf6" title="Padrão de Ticket" text={`Ticket medio de ${formatCurrency(b.avgTicket)}. ${b.avgTicket > 200 ? 'Compras de valor elevado.' : 'Compras de valor moderado.'}`} />
          <Pattern icon={TrendingUp} color="#10b981" title="Consistencia Financeira" text={`${b.consistency}% de consistencia mensal. ${b.consistency >= 70 ? 'Gastos estaveis.' : 'Variacoes moderadas — pode indicar gastos sazonais.'}`} />
          <Pattern icon={RefreshCw} color="#f59e0b" title="Gastos recorrentes" text={subs.length ? `${subs.length} gasto(s) recorrente(s) somando ${formatCurrency(recurringMonthly)}/mês (fixos). O restante e variavel e mais facil de ajustar.` : 'Nenhum gasto recorrente detectado ainda (aparece com 3+ meses do mêsmo lançamento).'} />
          <Pattern icon={CalendarRange} color="#6366f1" title="Concentracao no mês" text={`Você concentra os gastos no ${peakPart?.name} (${peakPart?.pct}% do total). ${peakPart?.name?.startsWith('Fim') ? 'Cuidado para não apertar o orcamento no fim do mês.' : ''}`} />
          <Pattern icon={HeartPulse} color="#f43f5e" title="Impulsividade" text={`${b.impulsivity}% das compras são bem acima do ticket medio. ${b.impulsivity >= 35 ? 'Vale esperar 24h antes de compras maiores.' : 'Nível saudavel de controle.'}`} />
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <Card className="py-4 hover-lift text-center">
      <p className="font-display text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}
function Pattern({ icon: Icon, color, title, text }) {
  return (
    <div className="p-4 rounded-xl border border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 mb-1"><Icon className="w-4 h-4" style={{ color }} /><span className="font-semibold text-sm">{title}</span></div>
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}
