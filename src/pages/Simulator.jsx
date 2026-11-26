import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Forecast, CreditCardTransaction } from '../api/entities.js';
import { Select, Input, Spinner } from '../components/ui';
import { HeroTitle, Panel, GlowButton, TIP } from '../components/kit.jsx';
import { MlChartArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthKey, MONTHS_PT } from '../lib/utils.js';
import { lastMonths, monthlySeries, evaluateModel } from '../lib/analytics.js';
import { ComposedChart, Area, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, LabelList } from 'recharts';
import { Calculator, Scissors, TrendingUp, TrendingDown, Target, LineChart as LineIcon, Wallet, PiggyBank, Sparkles, Database, Split, Cpu, Gauge, Check, Play, Brain, Info, ShieldCheck, CheckCircle2, Coins, Landmark, ArrowUp, ArrowDown } from 'lucide-react';

const SCENARIOS = [
  { id: 'cut', label: 'Cortar Gastos', sub: 'Reduza despesas', icon: Scissors, color: '#f43f5e' },
  { id: 'income', label: 'Aumentar Receita', sub: 'Renda extra mensal', icon: TrendingUp, color: '#10b981' },
  { id: 'expense', label: 'Nova Despesa', sub: 'Novo gasto fixo', icon: TrendingDown, color: '#f59e0b' },
  { id: 'goal', label: 'Poupar Meta', sub: 'Reserve p/ objetivo', icon: Target, color: '#6366f1' },
  { id: 'invest', label: 'Investimento', sub: 'Juros compostos', icon: LineIcon, color: '#8b5cf6' },
];
const STEP_DEFS = [
  { id: 'collect', label: 'Coletando histórico', icon: Database },
  { id: 'features', label: 'Engenharia de features', icon: Cpu },
  { id: 'split', label: 'Validação cruzada (LOO)', icon: Split },
  { id: 'train', label: 'Treinando modelo (OLS)', icon: Brain },
  { id: 'predict', label: 'Projetando + intervalo', icon: LineIcon },
];
const money = (v) => formatCurrency(v);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// mediana: estimativa robusta (ignora picos e não explode em series curtas)
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export default function Simulator() {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const months = useMemo(() => lastMonths(6), []);
  // despesa do cartão por competencia (o cartao e onde a maioria gasta)
  const cardExpByMonth = useMemo(() => { const m = {}; for (const t of cardTxs) { const k = t.competence_month || String(t.date).slice(0, 7); m[k] = (m[k] || 0) + Number(t.amount || 0); } return m; }, [cardTxs]);
  // serie mensal combinando lançamentos das contas + faturas do cartão
  const series = useMemo(() => months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of transactions) { if (String(t.date).slice(0, 7) !== k) continue; if (t.type === 'income') inc += Number(t.amount); else if (t.type === 'expense') exp += Number(t.amount); }
    exp += cardExpByMonth[k] || 0;
    const [y, m] = k.split('-').map(Number);
    return { mk: k, name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, inc, exp, net: inc - exp };
  }), [transactions, cardExpByMonth, months]);
  // meses ativos (ignora meses zerados do período de adaptacao ao app)
  const active = useMemo(() => series.filter((s) => s.inc > 0 || s.exp > 0), [series]);
  const estIncome = useMemo(() => median(active.map((s) => s.inc)), [active]);
  const estExpense = useMemo(() => median(active.map((s) => s.exp)), [active]);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const avgInc = active.length ? active.reduce((a, s) => a + s.inc, 0) / active.length : 0;
  const avgExp = active.length ? active.reduce((a, s) => a + s.exp, 0) / active.length : 0;
  const rate = avgInc > 0 ? ((avgInc - avgExp) / avgInc) * 100 : 0;

  // CDI atual (para o cenario de investimento) via BrasilAPI
  const ratesQ = useQuery({ queryKey: ['market-rates'], queryFn: async () => { const r = await fetch('https://brasilapi.com.br/api/taxas/v1'); if (!r.ok) throw new Error('taxas'); return r.json(); }, retry: 1, staleTime: 3_600_000 });
  const cdi = useMemo(() => { const f = (Array.isArray(ratesQ.data) ? ratesQ.data : []).find((x) => (x.nome || '').toLowerCase() === 'cdi'); return f ? Number(f.valor) : null; }, [ratesQ.data]);
  const cdiMonthly = cdi ? (Math.pow(1 + cdi / 100, 1 / 12) - 1) * 100 : null;

  const [scenario, setScenario] = useState('cut');
  const [cat, setCat] = useState('');
  const [value, setValue] = useState('');
  const [rateInput, setRateInput] = useState('0.8');
  const [expenseMode, setExpenseMode] = useState('parcelada'); // 'parcelada' | 'fixo'
  const [installments, setInstallments] = useState('10');

  // media mensal da categoria selecionada (corte realista: não da pra cortar mais do que se gasta)
  const catAvg = useMemo(() => {
    if (!cat) return 0;
    const per = {};
    for (const t of transactions) { if (t.type !== 'expense' || t.category_id !== cat) continue; const k = String(t.date).slice(0, 7); per[k] = (per[k] || 0) + Number(t.amount); }
    for (const t of cardTxs) { if (t.category_id !== cat) continue; const k = t.competence_month || String(t.date).slice(0, 7); per[k] = (per[k] || 0) + Number(t.amount); }
    const keys = active.length ? active.map((s) => s.mk) : months;
    const vals = keys.map((k) => per[k] || 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [cat, transactions, cardTxs, active, months]);
  // ao entrar no cenario de investimento, sugere a taxa do CDI atual
  useEffect(() => { if (scenario === 'invest' && cdiMonthly) setRateInput(cdiMonthly.toFixed(2)); }, [scenario, cdiMonthly]);

  const [phase, setPhase] = useState('idle');
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState(null);
  const [result, setResult] = useState(null);
  const logRef = useRef(null);
  const running = useRef(false);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs, progress]);
  const log = (m) => setLogs((l) => [...l, { t: new Date().toLocaleTimeString('pt-BR'), m }]);
  const setStep = (id, status) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, status } : x)));

  async function run() {
    if (running.current || active.length < 2) return;
    running.current = true;
    setPhase('running'); setResult(null); setModel(null); setProgress(0); setLogs([]);
    setSteps(STEP_DEFS.map((s) => ({ ...s, status: 'pending' })));
    const incSeries = active.map((s) => s.inc);
    const expSeries = active.map((s) => s.exp);
    const nn = active.length;
    const sc = SCENARIOS.find((s) => s.id === scenario);

    setStep('collect', 'run'); log(`Série de ${nn} meses · receita e despesa separadas`); await delay(500);
    log(`receita = [${incSeries.map((x) => Math.round(x)).join(', ')}]`);
    log(`despesa = [${expSeries.map((x) => Math.round(x)).join(', ')}]`); setStep('collect', 'done');

    setStep('features', 'run'); log('Feature: índice temporal + intercepto (por componente)'); await delay(500); setStep('features', 'done');

    setStep('split', 'run'); log('Leave-One-Out CV em cada série (métrica honesta)'); await delay(550); setStep('split', 'done');

    setStep('train', 'run'); log('Ajustando OLS para receita e despesa...');
    for (let p = 0; p <= 100; p += 10) { setProgress(p); await delay(55); }
    const incM = evaluateModel(incSeries);
    const expM = evaluateModel(expSeries);
    log(`Receita: b1=${incM.slope.toFixed(1)}/mês (${incM.trend}) · Despesa: b1=${expM.slope.toFixed(1)}/mês (${expM.trend})`); setStep('train', 'done');

    setStep('eval', 'run'); await delay(500);
    const combined = { model: 'Regressão dupla — receita & despesa (OLS)', n: nn, folds: incM.folds, r2: (incM.r2 + expM.r2) / 2, cvMae: incM.cvMae + expM.cvMae, cvRmse: Math.sqrt(incM.cvRmse ** 2 + expM.cvRmse ** 2), sigma: Math.sqrt(incM.sigma ** 2 + expM.sigma ** 2), slope: expM.slope, intercept: expM.intercept, trend: expM.trend };
    log(`R2 receita=${(incM.r2 * 100).toFixed(0)}% · R2 despesa=${(expM.r2 * 100).toFixed(0)}% · CV-MAE total=${money(combined.cvMae)} · sigma=${money(combined.sigma)}`);
    setModel(combined); setStep('eval', 'done');

    setStep('predict', 'run'); log(`Base robusta (mediana): receita ${money(estIncome)}/mês · despesa ${money(estExpense)}/mês`); await delay(500);

    const v = Number(value) || 0;
    const r = (Number(rateInput) || 0) / 100;
    const nInst = Math.max(1, Number(installments) || 1);
    const parcela = scenario === 'expense' ? (expenseMode === 'parcelada' ? v / nInst : v) : 0;
    const expenseMonths = expenseMode === 'parcelada' ? nInst : 12;
    const catCut = cat ? Math.min(v, catAvg) : Math.min(v, avgExp); // corte real limitado ao gasto
    const isInvest = scenario === 'invest';
    const isGoal = scenario === 'goal';
    const surplus = Math.max(0, avgInc - avgExp);

    // histórico de saldo reconstruido do saldo atual
    let running2 = totalBalance; const hist = [];
    for (let i = series.length - 1; i >= 0; i--) { hist.unshift({ name: series[i].name, actual: Math.round(running2) }); running2 -= series[i].net; }

    // baseline (tendencia) e cenario, mes a mes
    let bal = totalBalance, baseBal = totalBalance, reserve = 0;
    const fut = [];
    for (let i = 1; i <= 12; i++) {
      const incP = estIncome; // projecao plana pela mediana (robusta em series curtas)
      const expBase = estExpense;
      baseBal += incP - expBase;

      let incAdj = 0, expScen = expBase;
      if (scenario === 'cut') expScen = Math.max(0, expBase - catCut);
      if (scenario === 'income') incAdj = v;
      if (scenario === 'expense') expScen = expBase + (i <= expenseMonths ? parcela : 0);
      const netP = (incP + incAdj) - expScen;

      if (isInvest) bal = bal * (1 + r) + v;
      else if (isGoal) { reserve += Math.min(v, Math.max(0, incP - expBase)); bal += netP; }
      else bal += netP;

      const band = 1.96 * combined.sigma * Math.sqrt(i);
      const d = new Date(); d.setMonth(d.getMonth() + i);
      const label = `${MONTHS_PT[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`;
      if (isGoal) fut.push({ name: label, pred: Math.round(reserve), lo: Math.round(reserve), band: 0, bal: Math.round(bal) });
      else fut.push({ name: label, pred: Math.round(bal), base: Math.round(baseBal), lo: Math.round(bal - band), band: Math.round(2 * band) });
    }

    const projection = isGoal
      ? [{ name: 'hoje', pred: 0, lo: 0, band: 0 }, ...fut]
      : [...hist.map((h, i) => (i === hist.length - 1 ? { name: h.name, actual: h.actual, pred: h.actual, base: h.actual, lo: h.actual, band: 0 } : { name: h.name, actual: h.actual })), ...fut];

    const scenEnd = fut[11].pred;
    const baseEnd = baseBal;
    const diff = scenEnd - baseEnd;

    // impacto detalhado (Nova Despesa)
    let impact = null;
    if (scenario === 'expense') {
      const surplusAfter = surplus - parcela;
      const endD = new Date(); endD.setMonth(endD.getMonth() + nInst);
      impact = { mode: expenseMode, parcela, nInst, total: expenseMode === 'parcelada' ? v : null, pctIncome: avgInc > 0 ? (parcela / avgInc) * 100 : 0, pctSurplus: surplus > 0 ? (parcela / surplus) * 100 : null, surplusBefore: surplus, surplusAfter, savingsBefore: rate, savingsAfter: avgInc > 0 ? (surplusAfter / avgInc) * 100 : 0, goesNegative: surplusAfter < 0, endLabel: expenseMode === 'parcelada' ? `${MONTHS_PT[endD.getMonth()]}/${endD.getFullYear()}` : null };
      log(`Nova despesa: ${money(parcela)}/mês${expenseMode === 'parcelada' ? ` x${nInst}` : ' (fixo)'} · sobra ${money(surplus)} -> ${money(surplusAfter)}`);
    }

    const catName = categories.find((c) => c.id === cat)?.name;
    let summary;
    if (scenario === 'cut') {
      log(`Corte real: ${money(catCut)}/mês${cat ? ` em ${catName}` : ''} (você gasta ~${money(cat ? catAvg : avgExp)}/mês)`);
      summary = `Cortando ${money(catCut)}/mês${cat ? ` em ${catName}` : ' em despesas'}, seu saldo em 12 meses fica em ${money(scenEnd)} — ${diff >= 0 ? '+' : ''}${money(diff)} vs a tendência (${money(catCut * 12)} economizados no ano).` + (cat && v > catAvg ? ` Você só gasta ~${money(catAvg)}/mês nessa categoria, então o corte real foi limitado a esse valor.` : '');
    } else if (scenario === 'income') {
      summary = `Com +${money(v)}/mês de receita, seu saldo em 12 meses vai a ${money(scenEnd)} — ${diff >= 0 ? '+' : ''}${money(diff)} vs a tendência (${money(v * 12)} a mais no ano).`;
    } else if (scenario === 'expense') {
      if (expenseMode === 'parcelada') summary = `Parcela de ${money(parcela)}/mês por ${nInst}x (compra de ${money(v)}). Consome ${impact.pctIncome.toFixed(0)}% da renda e ${impact.pctSurplus != null ? impact.pctSurplus.toFixed(0) + '% da sua sobra' : 'mais do que você sobra'}. Última parcela em ${impact.endLabel}.` + (impact.goesNegative ? ' Atenção: deixa o mês no vermelho enquanto durar.' : ' Cabe no orçamento.');
      else summary = `Gasto fixo de ${money(parcela)}/mês consome ${impact.pctIncome.toFixed(0)}% da renda; a poupança cai de ${impact.savingsBefore.toFixed(0)}% para ${impact.savingsAfter.toFixed(0)}%.` + (impact.goesNegative ? ' Atenção: o mês fica no vermelho.' : '');
    } else if (isGoal) {
      const feasible = v <= surplus;
      summary = `Guardando ${money(v)}/mês, você reserva ${money(scenEnd)} em 12 meses.` + (feasible ? ` Cabe na sua sobra média de ${money(surplus)}/mês.` : ` Atenção: é mais que sua sobra média (${money(surplus)}/mês) — para manter, precisaria cortar ${money(v - surplus)}/mês.`);
    } else {
      const rendimento = bal - totalBalance - v * 12;
      summary = `Investindo ${money(v)}/mês a ${rateInput}% a.m.${cdi ? ' (CDI atual)' : ''}, em 12 meses: ${money(scenEnd)} — rendimento de ${money(rendimento)} sobre ${money(totalBalance + v * 12)} aportados.`;
    }

    // taxa de poupança projetada no cenário (mesma definição da taxa atual: sobra / receita)
    let rateAfter = rate;
    if (scenario === 'cut') rateAfter = avgInc > 0 ? ((avgInc - Math.max(0, avgExp - catCut)) / avgInc) * 100 : 0;
    if (scenario === 'income') rateAfter = avgInc + v > 0 ? ((avgInc + v - avgExp) / (avgInc + v)) * 100 : 0;
    if (scenario === 'expense') rateAfter = impact.savingsAfter;
    const rendimentoInv = isInvest ? bal - totalBalance - v * 12 : 0;
    const outcome = {
      gain: isGoal ? scenEnd : isInvest ? rendimentoInv : diff,
      gainLabel: isGoal ? 'Reserva acumulada' : isInvest ? 'Rendimento estimado' : diff >= 0 ? 'Economia total estimada' : 'Impacto no saldo',
      rateAfter, patrimonio: isGoal ? fut[11].bal : scenEnd, baseEnd,
    };
    log('Modelo pronto. Previsão gerada.'); setStep('predict', 'done');
    setResult({ projection, summary, color: sc.color, impact, outcome, mode: isGoal ? 'goal' : isInvest ? 'invest' : 'balance' });
    setPhase('done'); running.current = false;

    try { const d = new Date(); d.setMonth(d.getMonth() + 1); Forecast.create({ forecast_date: d.toISOString().slice(0, 10), predicted_balance: scenEnd, lower_bound: fut[11].lo, upper_bound: fut[11].lo + fut[11].band, confidence_level: 0.95, mode: 'cash', generated_at: new Date().toISOString(), explanation: JSON.stringify({ genMonth: monthKey(new Date()), r2: combined.r2, cvMae: combined.cvMae, model: combined.model }) }).catch(() => {}); } catch {}
  }

  const sc = SCENARIOS.find((s) => s.id === scenario);
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const enoughData = active.length >= 2;
  const surplusNow = Math.max(0, avgInc - avgExp);
  // confiança = cobertura do histórico (meses com dados dos últimos 6) — não é uma promessa de acerto
  const confidence = Math.round((active.length / 6) * 100);
  // acurácia = 1 − erro médio da validação cruzada / movimento mensal médio (só existe depois de treinar)
  const accuracy = model ? Math.max(0, Math.min(100, (1 - model.cvMae / Math.max(1, avgInc + avgExp)) * 100)) : null;
  const presetBase = scenario === 'cut' ? (cat ? catAvg : avgExp) : scenario === 'income' || scenario === 'expense' ? avgInc : surplusNow;
  const sliderMax = Math.max(100, Math.ceil(((scenario === 'expense' && expenseMode === 'parcelada' ? avgInc * 3 : presetBase) || 1000) / 100) * 100);
  const valueLabel = scenario === 'goal' ? 'Valor a guardar por mês' : scenario === 'income' ? 'Renda extra por mês' : scenario === 'invest' ? 'Aporte mensal' : scenario === 'expense' ? (expenseMode === 'parcelada' ? 'Valor total da compra' : 'Novo gasto por mês') : 'Valor a economizar por mês';
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const pctRun = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const last = result && result.mode !== 'goal' ? result.projection[result.projection.length - 1] : null;
  // gráfico do mockup: de hoje (0m) até 12 meses, cenário atual × com cenário
  const chartData = useMemo(() => {
    if (!result) return [];
    const start = result.projection.findIndex((p) => p.pred != null);
    return result.projection.slice(Math.max(0, start)).map((p, i) => ({ ...p, name: `${i}m` }));
  }, [result]);
  const endPill = (color, dy) => (p) => {
    if (p.index !== chartData.length - 1 || p.value == null) return null;
    const txt = money(p.value); const w = txt.length * 6.6 + 16;
    return <g><circle cx={p.x} cy={p.y} r="5" fill={color} stroke="#fff" strokeWidth="2" /><rect x={p.x + 10} y={p.y + dy - 11} width={w} height="22" rx="7" fill={color} fillOpacity=".18" stroke={color} /><text x={p.x + 18} y={p.y + dy + 4} fontSize="11.5" fontWeight="800" fill={color}>{txt}</text></g>;
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative">
        <HeroTitle icon={Calculator} lead="Simulador" accent="Financeiro" iconClass="text-violet-400" subtitle="Modelo de predição que aprende com seu histórico e projeta cenários." art={<MlChartArt className="w-[22rem] h-36 opacity-90" />} />
      </div>
      <div className="flex items-start gap-3 text-xs p-3.5 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-200 ring-1 ring-amber-400/40">
        <Info className="w-5 h-5 shrink-0 text-amber-500" />
        <span><b>Como funciona:</b> o simulador aprende com o seu histórico de receitas e despesas (incluindo o cartão) e projeta cenários com estatística (regressão + validação cruzada), usando a mediana dos meses ativos como base. Os valores são <b>estimativas</b> baseadas no passado — <b>não são garantia do futuro</b> nem recomendação de investimento. Quanto mais meses de uso, mais precisa fica a análise.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        <Kpi tone="violet" icon={Wallet} label="Saldo atual" value={money(totalBalance)} sub="todas as contas" />
        <Kpi tone="emerald" icon={TrendingUp} label="Receita média/mês" value={money(avgInc)} sub={`${active.length} mês(es) ativos`} />
        <Kpi tone="rose" icon={TrendingDown} label="Despesa média/mês" value={money(avgExp)} sub="contas + cartão" />
        <Kpi tone="amber" icon={PiggyBank} label="Taxa de poupança" value={`${rate.toFixed(1).replace('.', ',')}%`} sub="sobra ÷ receita" />
        <Kpi tone="emerald" icon={ShieldCheck} label="Score de confiança" value={<>{confidence}<span className="text-sm text-muted font-semibold">/100</span></>} sub={<><SegBar v={confidence} c="#34d399" /><span title="Cobertura do histórico: meses com dados nos últimos 6">{active.length} de 6 meses com dados</span></>} />
        <Kpi tone="violet" icon={Gauge} label="Acurácia da simulação" value={accuracy == null ? '—' : `${accuracy.toFixed(1).replace('.', ',')}%`} sub={<><SegBar v={accuracy || 0} c="#a78bfa" /><span title="1 − (erro médio da validação cruzada ÷ movimento mensal)">{accuracy == null ? 'treine o modelo' : '1 − erro da validação'}</span></>} />
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Escolha o cenário para simular</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {SCENARIOS.map((s) => { const on = scenario === s.id; return (
            <button key={s.id} onClick={() => setScenario(s.id)} aria-pressed={on} className={`relative text-left rounded-2xl p-4 ring-1 transition flex items-center gap-3 ${on ? 'ring-2 text-white' : 'ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:brightness-110'}`} style={on ? { background: 'linear-gradient(135deg,#db2777,#a21caf 60%,#7c3aed)', '--tw-ring-color': '#f472b6', boxShadow: '0 0 26px rgba(236,72,153,.45)' } : {}}>
              <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={on ? { background: 'rgba(255,255,255,.2)' } : { background: `${s.color}22`, color: s.color }}><s.icon className="w-5 h-5" /></span>
              <span className="min-w-0"><span className="block font-semibold text-sm">{s.label}</span><span className={`block text-xs ${on ? 'text-white/80' : 'text-muted'}`}>{s.sub}</span></span>
              {on && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4" />}
            </button>); })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel className="xl:col-span-5" tone="violet" title={`Configuração — ${sc.label}`} icon={sc.icon} iconClass="text-violet-400">
          <div className="space-y-4">
            {scenario === 'cut' && (
              <div>
                <label className="text-sm font-medium">Categoria para cortar</label>
                <Select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1"><option value="">Todas as despesas</option>{expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                <p className="text-xs text-muted mt-1">Você gasta ~<b className="text-[hsl(var(--text))]">{money(cat ? catAvg : avgExp)}/mês</b> {cat ? 'nessa categoria' : 'no total'}.</p>
              </div>
            )}
            {scenario === 'expense' && (
              <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))] w-full">
                {[['parcelada', 'Compra parcelada'], ['fixo', 'Gasto fixo mensal']].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setExpenseMode(val)} className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${expenseMode === val ? 'bg-violet-500/20 text-violet-700 dark:text-violet-200 ring-1 ring-violet-400/50' : 'text-muted'}`}>{lbl}</button>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{valueLabel}</label>
              <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" className="pl-9" /></div>
              <input type="range" min={0} max={sliderMax} step={Math.max(1, Math.round(sliderMax / 200))} value={Math.min(sliderMax, Number(value) || 0)} onChange={(e) => setValue(e.target.value)} className="w-full mt-3 accent-pink-500" aria-label={valueLabel} />
              <div className="flex justify-between text-[11px] text-muted"><span>R$ 0</span><span>{money(sliderMax)}</span></div>
              {presetBase > 0 && !(scenario === 'expense' && expenseMode === 'parcelada') && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {[10, 20, 30].map((p) => { const v = Math.round(presetBase * p / 100); return <button key={p} type="button" onClick={() => setValue(String(v))} className={`px-3 py-1 rounded-lg text-xs font-semibold ring-1 transition ${Number(value) === v ? 'ring-violet-400 bg-violet-500/20 text-violet-700 dark:text-violet-200' : 'ring-[hsl(var(--border))] text-muted hover:text-[hsl(var(--text))]'}`}>{p}% · {money(v)}</button>; })}
                </div>
              )}
            </div>
            {scenario === 'expense' && expenseMode === 'parcelada' && (
              <div><label className="text-sm font-medium">Número de parcelas</label><Input type="number" min="1" step="1" value={installments} onChange={(e) => setInstallments(e.target.value)} className="mt-1" />
                {Number(value) > 0 && Number(installments) > 0 && <p className="text-xs text-muted mt-1">{money(Number(value) / Math.max(1, Number(installments)))}/mês</p>}</div>
            )}
            {scenario === 'invest' && (
              <div><label className="text-sm font-medium">Rendimento mensal (%)</label><Input type="number" step="0.01" value={rateInput} onChange={(e) => setRateInput(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted mt-1">{cdiMonthly ? `CDI atual ~${cdiMonthly.toFixed(2)}% a.m. (${cdi.toFixed(2)}% a.a.)` : 'Ex.: poupança ~0,5% a.m. · o CDI varia'}</p></div>
            )}
            <GlowButton tone="pink" onClick={run} disabled={phase === 'running' || !enoughData} className="w-full justify-center py-3">
              {phase === 'running' ? <><Spinner className="w-4 h-4" /> Treinando modelo…</> : <><Play className="w-4 h-4" /> Treinar & Simular</>}
            </GlowButton>
            {!enoughData && <p className="text-xs text-amber-500">Registre lançamentos em pelo menos 2 meses para o modelo aprender.</p>}
            {model && phase === 'done' && (
              <div className="rounded-2xl ring-1 ring-violet-400/40 bg-violet-500/5 p-3.5 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between gap-2 flex-wrap"><p className="text-xs font-bold tracking-wider text-muted flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-violet-400" /> MODELO TREINADO</p><span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-400/40">Validação Leave-One-Out · {model.folds} folds</span></div>
                <p className="text-sm font-semibold">{model.model}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniMetric label="R²" value={`${(model.r2 * 100).toFixed(0)}%`} tone="#34d399" />
                  <MiniMetric label="CV-MAE" value={money(model.cvMae)} tone="#a78bfa" />
                  <MiniMetric label="CV-RMSE" value={money(model.cvRmse)} tone="#fbbf24" />
                </div>
                <p className="text-xs text-muted">Tendência da despesa: <b className="text-[hsl(var(--text))]">{model.trend}</b> ({model.slope >= 0 ? '+' : ''}{money(model.slope)}/mês)</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="xl:col-span-7" tone="violet" title="Motor de Predição" icon={Brain} iconClass={`text-violet-400 ${phase === 'running' ? 'blink' : ''}`} action={<span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-400/40">ML local</span>}>
          {phase === 'idle' ? (
            <div className="flex flex-col items-center justify-center h-[340px] text-muted text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/40 grid place-items-center mb-3"><Cpu className="w-8 h-8 text-violet-400" /></div>
              <p className="text-sm font-semibold text-[hsl(var(--text))]">Pronto para treinar</p>
              <p className="text-xs mt-1 max-w-sm">Configure o cenário e clique em <b>Treinar & Simular</b>. O modelo aprende, valida (validação cruzada) e projeta com intervalo de confiança.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="grid grid-cols-5 gap-2">
                {steps.map((s, i) => (
                  <li key={s.id} className="relative flex flex-col items-center text-center">
                    {i > 0 && <span className={`hidden md:block absolute top-5 right-1/2 w-full h-0.5 -z-0 ${s.status !== 'pending' ? 'bg-gradient-to-r from-emerald-400 to-violet-400' : 'bg-[hsl(var(--border))]'}`} />}
                    <span className={`relative z-[1] w-10 h-10 rounded-full grid place-items-center ring-2 ${s.status === 'done' ? 'bg-emerald-500 ring-emerald-300/60 text-white' : s.status === 'run' ? 'bg-violet-500 ring-violet-300/60 text-white shadow-[0_0_16px_rgba(139,92,246,.6)]' : 'bg-[hsl(var(--card))] ring-[hsl(var(--border))] text-muted'}`}>
                      {s.status === 'done' ? <Check className="w-5 h-5" /> : s.status === 'run' ? <Spinner className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                    </span>
                    <span className={`text-[11px] leading-tight mt-1.5 ${s.status === 'pending' ? 'text-muted' : 'font-semibold'}`}>{s.label}</span>
                  </li>
                ))}
              </ol>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted">{phase === 'running' ? 'Simulação em andamento…' : 'Simulação concluída'}</span><b>{phase === 'running' ? `${Math.max(pctRun, Math.round(progress / 6))}%` : '100%'}</b></div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all" style={{ width: `${phase === 'running' ? pctRun : 100}%` }} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div ref={logRef} className={`${result ? 'md:col-span-2' : 'md:col-span-3'} rounded-xl bg-slate-950 ring-1 ring-slate-800 text-slate-300 p-3 font-mono text-[11px] leading-relaxed h-48 overflow-y-auto`}>
                  {logs.map((l, i) => (<div key={i}><span className="text-sky-400">[{l.t}]</span> {l.m}</div>))}
                  {phase === 'running' && <span className="text-violet-400 blink">▊</span>}
                </div>
                {result && (
                  <div className="rounded-2xl ring-1 ring-emerald-400/50 bg-emerald-500/10 shadow-[0_0_24px_-8px_rgba(52,211,153,.5)] p-4">
                    <p className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" />Insight da simulação</p>
                    <p className="text-sm mt-2 leading-relaxed">{result.summary}</p>
                    <p className="text-[10px] text-muted mt-2">Gerado pelo modelo estatístico local</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-8" tone="sky" title={result.mode === 'goal' ? 'Reserva acumulada — próximos 12 meses' : 'Projeção do cenário — 12 meses'} icon={LineIcon} iconClass="text-sky-400"
            action={<div className="flex items-center gap-3 text-xs text-muted flex-wrap">{result.mode !== 'goal' && <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Cenário atual (sem mudança)</span>}<span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />{result.mode === 'goal' ? 'Reserva acumulada' : `Com ${sc.label.toLowerCase()}`}</span></div>}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 22, right: 110, left: 0, bottom: 0 }}>
                <defs><linearGradient id="simBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.22} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.03} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis width={48} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v, nm) => [money(v), nm]} contentStyle={TIP} />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                {result.mode !== 'goal' && <Area dataKey="lo" stackId="ci" stroke="none" fill="transparent" legendType="none" name="lo" isAnimationActive={false} tooltipType="none" />}
                {result.mode !== 'goal' && <Area dataKey="band" stackId="ci" stroke="none" fill="url(#simBand)" name="Intervalo 95%" isAnimationActive={false} tooltipType="none" />}
                                {result.mode !== 'goal' && <Line dataKey="base" name="Cenário atual" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls><LabelList dataKey="base" content={endPill('#60a5fa', 14)} /></Line>}
                <Line dataKey="pred" name={result.mode === 'goal' ? 'Reserva' : `Com ${sc.label.toLowerCase()}`} stroke="#34d399" strokeWidth={3} dot={false} connectNulls style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,.6))' }}><LabelList dataKey="pred" content={endPill('#34d399', -14)} /></Line>
              </ComposedChart>
            </ResponsiveContainer>
            {result.mode !== 'goal' && <p className="text-[11px] text-muted mt-1">A faixa sombreada é o intervalo de 95% do modelo — quanto mais longe, maior a incerteza.</p>}
          </Panel>

          <Panel className="xl:col-span-4" tone="emerald" title="Resultado em 12 meses" icon={Target} iconClass="text-emerald-400">
            <div className="space-y-3">
              <ResultRow icon={Coins} tone="#34d399" label={result.outcome.gainLabel} value={`${result.outcome.gain >= 0 && result.mode !== 'goal' ? '+' : ''}${money(result.outcome.gain)}`} valueClass={result.outcome.gain >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'} sub={result.mode === 'goal' ? 'guardado na meta' : result.mode === 'invest' ? 'só de juros, sem impostos' : 'vs. seguir sem mudança'} />
              <ResultRow icon={PiggyBank} tone="#fbbf24" label="Taxa de poupança projetada" value={`${result.outcome.rateAfter.toFixed(1).replace('.', ',')}%`} sub={<span className={`inline-flex items-center gap-0.5 font-semibold ${result.outcome.rateAfter - rate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{result.outcome.rateAfter - rate >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{(result.outcome.rateAfter - rate >= 0 ? '+' : '') + (result.outcome.rateAfter - rate).toFixed(1).replace('.', ',')} p.p. vs. hoje</span>} />
              <ResultRow icon={Landmark} tone="#a78bfa" label="Patrimônio projetado" value={money(result.outcome.patrimonio)} sub={`hoje: ${money(totalBalance)}`} />
              {result.impact && (
                <div className={`text-xs rounded-xl p-3 ring-1 ${result.impact.goesNegative ? 'bg-rose-500/10 ring-rose-400/40 text-rose-600 dark:text-rose-300' : 'bg-emerald-500/10 ring-emerald-400/40 text-emerald-700 dark:text-emerald-300'}`}>
                  Parcela {money(result.impact.parcela)}/mês · {result.impact.pctIncome.toFixed(0)}% da renda. Sobra mensal {money(result.impact.surplusBefore)} → <b>{money(result.impact.surplusAfter)}</b>{result.impact.endLabel ? ` · última parcela em ${result.impact.endLabel}` : ' · gasto contínuo'}.
                </div>
              )}
              {last && <p className="text-[11px] text-muted">Estimativa estatística baseada no seu histórico — não é garantia.</p>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

const KT = { violet: ['#a78bfa', 'ring-violet-400/45'], emerald: ['#34d399', 'ring-emerald-400/40'], rose: ['#fb7185', 'ring-rose-400/45'], amber: ['#fbbf24', 'ring-amber-400/45'] };
function Kpi({ tone, icon: Icon, label, value, sub }) {
  const [c, ring] = KT[tone];
  return (
    <div className={`rounded-2xl ring-1 ${ring} bg-[hsl(var(--card))] p-3.5 flex items-center gap-3 min-w-0`} style={{ backgroundImage: `linear-gradient(135deg,${c}2e,transparent 70%)`, boxShadow: `0 0 22px -10px ${c}` }}>
      <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${c}26`, color: c }}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-[11px] text-muted truncate">{label}</p><p className="font-display text-lg xl:text-xl font-bold leading-tight whitespace-nowrap">{value}</p>{sub && <div className="text-[10.5px] text-muted leading-tight">{sub}</div>}</div>
    </div>
  );
}
function SegBar({ v, c }) {
  return <span className="flex gap-1 my-1">{[0, 1, 2, 3, 4].map((i) => <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: v >= (i + 1) * 20 - 10 ? c : 'hsl(var(--muted) / .25)' }} />)}</span>;
}
function MiniMetric({ label, value, tone }) {
  return <div className="rounded-xl bg-black/5 dark:bg-white/5 py-2"><p className="text-[10px] text-muted">{label}</p><p className="font-bold text-sm" style={{ color: tone }}>{value}</p></div>;
}
function ResultRow({ icon: Icon, tone, label, value, sub, valueClass = '' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl ring-1 ring-[hsl(var(--border))] p-3.5">
      <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${tone}22`, color: tone }}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className={`font-display text-xl font-bold leading-tight ${valueClass}`}>{value}</p>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>
    </div>
  );
}
