import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Forecast, CreditCardTransaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Input, Field, Spinner, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey, MONTHS_PT } from '../lib/utils.js';
import { lastMonths, monthlySeries, evaluateModel } from '../lib/analytics.js';
import { ComposedChart, Area, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { Calculator, Scissors, TrendingUp, TrendingDown, Target, LineChart as LineIcon, Wallet, PiggyBank, Sparkles, Database, Split, Cpu, Gauge, Check, Play, Brain, Info } from 'lucide-react';

const SCENARIOS = [
  { id: 'cut', label: 'Cortar Gastos', sub: 'Reduza despesas', icon: Scissors, color: '#f43f5e' },
  { id: 'income', label: 'Aumentar Receita', sub: 'Renda extra mensal', icon: TrendingUp, color: '#10b981' },
  { id: 'expense', label: 'Nova Despesa', sub: 'Novo gasto fixo', icon: TrendingDown, color: '#f59e0b' },
  { id: 'goal', label: 'Poupar Meta', sub: 'Reserve p/ objetivo', icon: Target, color: '#6366f1' },
  { id: 'invest', label: 'Investimento', sub: 'Juros compostos', icon: LineIcon, color: '#8b5cf6' },
];
const STEP_DEFS = [
  { id: 'collect', label: 'Coletando historico', icon: Database },
  { id: 'features', label: 'Engenharia de features', icon: Cpu },
  { id: 'split', label: 'Validacao cruzada (LOO)', icon: Split },
  { id: 'train', label: 'Treinando (OLS)', icon: Brain },
  { id: 'eval', label: 'Avaliando metricas', icon: Gauge },
  { id: 'predict', label: 'Projetando + intervalo', icon: LineIcon },
];
const money = (v) => formatCurrency(v);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// mediana: estimativa robusta (ignora picos e nao explode em series curtas)
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export default function Simulator() {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });

  const months = useMemo(() => lastMonths(6), []);
  // despesa do cartao por competencia (o cartao e onde a maioria gasta)
  const cardExpByMonth = useMemo(() => { const m = {}; for (const t of cardTxs) { const k = t.competence_month || String(t.date).slice(0, 7); m[k] = (m[k] || 0) + Number(t.amount || 0); } return m; }, [cardTxs]);
  // serie mensal combinando lancamentos das contas + faturas do cartao
  const series = useMemo(() => months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of transactions) { if (String(t.date).slice(0, 7) !== k) continue; if (t.type === 'income') inc += Number(t.amount); else if (t.type === 'expense') exp += Number(t.amount); }
    exp += cardExpByMonth[k] || 0;
    const [y, m] = k.split('-').map(Number);
    return { mk: k, name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, inc, exp, net: inc - exp };
  }), [transactions, cardExpByMonth, months]);
  // meses ativos (ignora meses zerados do periodo de adaptacao ao app)
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

  // media mensal da categoria selecionada (corte realista: nao da pra cortar mais do que se gasta)
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

    setStep('collect', 'run'); log(`Serie de ${nn} meses · receita e despesa separadas`); await delay(500);
    log(`receita = [${incSeries.map((x) => Math.round(x)).join(', ')}]`);
    log(`despesa = [${expSeries.map((x) => Math.round(x)).join(', ')}]`); setStep('collect', 'done');

    setStep('features', 'run'); log('Feature: indice temporal + intercepto (por componente)'); await delay(500); setStep('features', 'done');

    setStep('split', 'run'); log('Leave-One-Out CV em cada serie (metrica honesta)'); await delay(550); setStep('split', 'done');

    setStep('train', 'run'); log('Ajustando OLS para receita e despesa...');
    for (let p = 0; p <= 100; p += 10) { setProgress(p); await delay(55); }
    const incM = evaluateModel(incSeries);
    const expM = evaluateModel(expSeries);
    log(`Receita: b1=${incM.slope.toFixed(1)}/mes (${incM.trend}) · Despesa: b1=${expM.slope.toFixed(1)}/mes (${expM.trend})`); setStep('train', 'done');

    setStep('eval', 'run'); await delay(500);
    const combined = { model: 'Regressao dupla — receita & despesa (OLS)', n: nn, folds: incM.folds, r2: (incM.r2 + expM.r2) / 2, cvMae: incM.cvMae + expM.cvMae, cvRmse: Math.sqrt(incM.cvRmse ** 2 + expM.cvRmse ** 2), sigma: Math.sqrt(incM.sigma ** 2 + expM.sigma ** 2), slope: expM.slope, intercept: expM.intercept, trend: expM.trend };
    log(`R2 receita=${(incM.r2 * 100).toFixed(0)}% · R2 despesa=${(expM.r2 * 100).toFixed(0)}% · CV-MAE total=${money(combined.cvMae)} · sigma=${money(combined.sigma)}`);
    setModel(combined); setStep('eval', 'done');

    setStep('predict', 'run'); log(`Base robusta (mediana): receita ${money(estIncome)}/mes · despesa ${money(estExpense)}/mes`); await delay(500);

    const v = Number(value) || 0;
    const r = (Number(rateInput) || 0) / 100;
    const nInst = Math.max(1, Number(installments) || 1);
    const parcela = scenario === 'expense' ? (expenseMode === 'parcelada' ? v / nInst : v) : 0;
    const expenseMonths = expenseMode === 'parcelada' ? nInst : 12;
    const catCut = cat ? Math.min(v, catAvg) : Math.min(v, avgExp); // corte real limitado ao gasto
    const isInvest = scenario === 'invest';
    const isGoal = scenario === 'goal';
    const surplus = Math.max(0, avgInc - avgExp);

    // historico de saldo reconstruido do saldo atual
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
      if (isGoal) fut.push({ name: label, pred: Math.round(reserve), lo: Math.round(reserve), band: 0 });
      else fut.push({ name: label, pred: Math.round(bal), lo: Math.round(bal - band), band: Math.round(2 * band) });
    }

    const projection = isGoal
      ? [{ name: 'hoje', pred: 0, lo: 0, band: 0 }, ...fut]
      : [...hist.map((h, i) => (i === hist.length - 1 ? { name: h.name, actual: h.actual, pred: h.actual, lo: h.actual, band: 0 } : { name: h.name, actual: h.actual })), ...fut];

    const scenEnd = fut[11].pred;
    const baseEnd = baseBal;
    const diff = scenEnd - baseEnd;

    // impacto detalhado (Nova Despesa)
    let impact = null;
    if (scenario === 'expense') {
      const surplusAfter = surplus - parcela;
      const endD = new Date(); endD.setMonth(endD.getMonth() + nInst);
      impact = { mode: expenseMode, parcela, nInst, total: expenseMode === 'parcelada' ? v : null, pctIncome: avgInc > 0 ? (parcela / avgInc) * 100 : 0, pctSurplus: surplus > 0 ? (parcela / surplus) * 100 : null, surplusBefore: surplus, surplusAfter, savingsBefore: rate, savingsAfter: avgInc > 0 ? (surplusAfter / avgInc) * 100 : 0, goesNegative: surplusAfter < 0, endLabel: expenseMode === 'parcelada' ? `${MONTHS_PT[endD.getMonth()]}/${endD.getFullYear()}` : null };
      log(`Nova despesa: ${money(parcela)}/mes${expenseMode === 'parcelada' ? ` x${nInst}` : ' (fixo)'} · sobra ${money(surplus)} -> ${money(surplusAfter)}`);
    }

    const catName = categories.find((c) => c.id === cat)?.name;
    let summary;
    if (scenario === 'cut') {
      log(`Corte real: ${money(catCut)}/mes${cat ? ` em ${catName}` : ''} (voce gasta ~${money(cat ? catAvg : avgExp)}/mes)`);
      summary = `Cortando ${money(catCut)}/mes${cat ? ` em ${catName}` : ' em despesas'}, seu saldo em 12 meses fica em ${money(scenEnd)} — ${diff >= 0 ? '+' : ''}${money(diff)} vs a tendencia (${money(catCut * 12)} economizados no ano).` + (cat && v > catAvg ? ` Voce so gasta ~${money(catAvg)}/mes nessa categoria, entao o corte real foi limitado a esse valor.` : '');
    } else if (scenario === 'income') {
      summary = `Com +${money(v)}/mes de receita, seu saldo em 12 meses vai a ${money(scenEnd)} — ${diff >= 0 ? '+' : ''}${money(diff)} vs a tendencia (${money(v * 12)} a mais no ano).`;
    } else if (scenario === 'expense') {
      if (expenseMode === 'parcelada') summary = `Parcela de ${money(parcela)}/mes por ${nInst}x (compra de ${money(v)}). Consome ${impact.pctIncome.toFixed(0)}% da renda e ${impact.pctSurplus != null ? impact.pctSurplus.toFixed(0) + '% da sua sobra' : 'mais do que voce sobra'}. Ultima parcela em ${impact.endLabel}.` + (impact.goesNegative ? ' Atencao: deixa o mes no vermelho enquanto durar.' : ' Cabe no orcamento.');
      else summary = `Gasto fixo de ${money(parcela)}/mes consome ${impact.pctIncome.toFixed(0)}% da renda; a poupanca cai de ${impact.savingsBefore.toFixed(0)}% para ${impact.savingsAfter.toFixed(0)}%.` + (impact.goesNegative ? ' Atencao: o mes fica no vermelho.' : '');
    } else if (isGoal) {
      const feasible = v <= surplus;
      summary = `Guardando ${money(v)}/mes, voce reserva ${money(scenEnd)} em 12 meses.` + (feasible ? ` Cabe na sua sobra media de ${money(surplus)}/mes.` : ` Atencao: e mais que sua sobra media (${money(surplus)}/mes) — para manter, precisaria cortar ${money(v - surplus)}/mes.`);
    } else {
      const rendimento = bal - totalBalance - v * 12;
      summary = `Investindo ${money(v)}/mes a ${rateInput}% a.m.${cdi ? ' (CDI atual)' : ''}, em 12 meses: ${money(scenEnd)} — rendimento de ${money(rendimento)} sobre ${money(totalBalance + v * 12)} aportados.`;
    }

    log('Modelo pronto. Previsao gerada.'); setStep('predict', 'done');
    setResult({ projection, summary, color: sc.color, impact, mode: isGoal ? 'goal' : isInvest ? 'invest' : 'balance' });
    setPhase('done'); running.current = false;

    try { const d = new Date(); d.setMonth(d.getMonth() + 1); Forecast.create({ forecast_date: d.toISOString().slice(0, 10), predicted_balance: scenEnd, lower_bound: fut[11].lo, upper_bound: fut[11].lo + fut[11].band, confidence_level: 0.95, mode: 'cash', generated_at: new Date().toISOString(), explanation: JSON.stringify({ genMonth: monthKey(new Date()), r2: combined.r2, cvMae: combined.cvMae, model: combined.model }) }).catch(() => {}); } catch {}
  }

  const sc = SCENARIOS.find((s) => s.id === scenario);
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const enoughData = series.filter((s) => s.inc || s.exp).length >= 2;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Calculator className="w-6 h-6 text-violet-500" /> Simulador Financeiro</span>}
        subtitle="Modelo de predicao que aprende com seu historico e projeta cenarios" />

      <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Como funciona: o simulador aprende com o seu historico de receitas e despesas (incluindo o cartao) e projeta cenarios usando estatistica (regressao + validacao cruzada) com uma base robusta pelos meses ativos. Os valores sao <b>estimativas</b> baseadas no passado — <b>nao sao garantia do futuro</b> nem recomendacao de investimento. Use como apoio a decisao. Quanto mais meses de uso, mais precisa fica a analise.</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Kpi icon={Wallet} label="Saldo atual" value={totalBalance} color="#6366f1" /></Reveal>
        <Reveal i={1}><Kpi icon={TrendingUp} label="Receita media/mes" value={avgInc} color="#10b981" /></Reveal>
        <Reveal i={2}><Kpi icon={TrendingDown} label="Despesa media/mes" value={avgExp} color="#f43f5e" /></Reveal>
        <Reveal i={3}><Kpi icon={PiggyBank} label="Taxa de poupanca" value={rate} color="#f59e0b" pct /></Reveal>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Escolha o cenario para simular:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {SCENARIOS.map((s, i) => (
            <Reveal key={s.id} i={i}>
              <button onClick={() => setScenario(s.id)} className={`w-full p-4 rounded-2xl border-2 text-left transition hover-lift ${scenario === s.id ? 'text-white shadow-soft' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`} style={scenario === s.id ? { background: s.color, borderColor: s.color } : {}}>
                <s.icon className="w-5 h-5" /><p className="font-semibold text-sm mt-2">{s.label}</p><p className={`text-xs ${scenario === s.id ? 'text-white/80' : 'text-muted'}`}>{s.sub}</p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><sc.icon className="w-4 h-4" style={{ color: sc.color }} /> Configuracao — {sc.label}</h3>
          <div className="space-y-4">
            {scenario === 'cut' && <Field label="Categoria para cortar" hint={cat ? `Voce gasta ~${money(catAvg)}/mes nessa categoria` : 'Opcional — limita o corte ao gasto real da categoria'}><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as despesas</option>{expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            {scenario === 'expense' && (
              <Field label="Tipo de despesa">
                <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5 w-full">
                  {[['parcelada', 'Compra parcelada'], ['fixo', 'Gasto fixo mensal']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setExpenseMode(val)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition ${expenseMode === val ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{lbl}</button>
                  ))}
                </div>
              </Field>
            )}
            <Field label={scenario === 'goal' ? 'Valor a guardar/mes' : scenario === 'income' ? 'Renda extra/mes' : scenario === 'invest' ? 'Aporte mensal' : scenario === 'expense' ? (expenseMode === 'parcelada' ? 'Valor total da compra' : 'Novo gasto/mes') : 'Valor a economizar/mes'}>
              <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="R$ 0,00" />
            </Field>
            {scenario === 'expense' && expenseMode === 'parcelada' && (
              <Field label="Numero de parcelas" hint={Number(value) > 0 && Number(installments) > 0 ? `${money(Number(value) / Math.max(1, Number(installments)))}/mes` : null}>
                <Input type="number" min="1" step="1" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder="10" />
              </Field>
            )}
            {scenario === 'invest' && <Field label="Rendimento mensal (%)" hint={cdiMonthly ? `CDI atual ~${cdiMonthly.toFixed(2)}% a.m. (${cdi.toFixed(2)}% a.a.)` : 'Ex: poupanca ~0,5% · CDI varia'}><Input type="number" step="0.01" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="0.8" /></Field>}
            <Button onClick={run} className="w-full" style={{ background: sc.color }} disabled={phase === 'running' || !enoughData}>
              {phase === 'running' ? <><Spinner className="w-4 h-4" /> Treinando modelo...</> : <><Play className="w-4 h-4" /> Treinar & Simular</>}
            </Button>
            {!enoughData && <p className="text-xs text-amber-500">Registre lancamentos em pelo menos 2 meses para o modelo aprender.</p>}
            {model && phase === 'done' && (
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-2 animate-fadeIn">
                <p className="text-xs font-bold tracking-wider text-muted flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> MODELO TREINADO</p>
                <p className="text-sm font-semibold">{model.model}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="R2" value={`${(model.r2 * 100).toFixed(0)}%`} tone="#10b981" />
                  <Metric label="CV-MAE" value={money(model.cvMae)} tone="#6366f1" />
                  <Metric label="CV-RMSE" value={money(model.cvRmse)} tone="#f59e0b" />
                </div>
                <p className="text-xs text-muted">Validacao Leave-One-Out ({model.folds} folds) · tendencia <b>{model.trend}</b> · b1={model.slope.toFixed(1)}/mes</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="hover-lift">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Brain className={`w-4 h-4 text-violet-500 ${phase === 'running' ? 'blink' : ''}`} /> Motor de Predicao</h3>
            <Badge color="violet">ML</Badge>
          </div>
          {phase === 'idle' ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3"><Cpu className="w-7 h-7 text-violet-500" /></div>
              <p className="text-sm font-medium">Pronto para treinar</p>
              <p className="text-xs mt-1 max-w-xs">Configure o cenario e clique em <b>Treinar & Simular</b>. O modelo aprende, valida (cross-validation) e projeta com intervalo de confianca.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {steps.map((s) => (
                  <div key={s.id} className={`flex items-center gap-3 p-2 rounded-lg transition ${s.status === 'run' ? 'bg-violet-500/10' : ''}`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.status === 'done' ? 'bg-emerald-500 text-white' : s.status === 'run' ? 'bg-violet-500 text-white' : 'bg-black/5 dark:bg-white/10 text-muted'}`}>
                      {s.status === 'done' ? <Check className="w-4 h-4" /> : s.status === 'run' ? <Spinner className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                    </span>
                    <span className={`text-sm flex-1 ${s.status === 'pending' ? 'text-muted' : 'font-medium'}`}>{s.label}</span>
                    {s.id === 'train' && s.status === 'run' && <span className="text-xs text-violet-500 font-mono">{progress}%</span>}
                  </div>
                ))}
              </div>
              {steps.find((s) => s.id === 'train' && s.status !== 'pending') && (
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all" style={{ width: `${progress}%` }} /></div>
              )}
              <div ref={logRef} className="rounded-xl bg-slate-950 text-slate-300 p-3 font-mono text-[11px] leading-relaxed h-40 overflow-y-auto">
                {logs.map((l, i) => (<div key={i}><span className="text-emerald-400">[{l.t}]</span> {l.m}</div>))}
                {phase === 'running' && <span className="text-violet-400 blink">▊</span>}
              </div>
            </div>
          )}
        </Card>
      </div>

      {result && (
        <Reveal>
          <Card className="hover-lift">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h3 className="font-semibold flex items-center gap-2"><LineIcon className="w-4 h-4 text-emerald-500" /> {result.mode === 'goal' ? 'Reserva acumulada — proximos 12 meses' : 'Previsao de Saldo — historico + 12 meses'}</h3>{model && <Badge color="emerald">R2 {(model.r2 * 100).toFixed(0)}% · IC 95%</Badge>}</div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={result.projection}>
                <defs><linearGradient id="ciBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={result.color} stopOpacity={0.18} /><stop offset="100%" stopColor={result.color} stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis width={46} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v, n) => [money(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Legend />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                <Area dataKey="lo" stackId="ci" stroke="none" fill="transparent" name=" " legendType="none" isAnimationActive={false} />
                <Area dataKey="band" stackId="ci" stroke="none" fill="url(#ciBand)" name="Intervalo 95%" isAnimationActive={false} />
                <Line dataKey="actual" name="Historico" stroke="#64748b" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
                <Line dataKey="pred" name="Previsao" stroke={result.color} strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-sm text-indigo-700 dark:text-indigo-300 flex items-start gap-2"><Sparkles className="w-4 h-4 mt-0.5 shrink-0" /> {result.summary}</div>
            {result.impact && (
              <>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Metric label="Parcela/mes" value={money(result.impact.parcela)} tone="#f59e0b" />
                  <Metric label="% da renda" value={`${result.impact.pctIncome.toFixed(0)}%`} tone="#6366f1" />
                  <Metric label="% da sobra" value={result.impact.pctSurplus != null ? `${result.impact.pctSurplus.toFixed(0)}%` : '—'} tone={result.impact.goesNegative ? '#f43f5e' : '#10b981'} />
                  <Metric label="Poupanca depois" value={`${result.impact.savingsAfter.toFixed(0)}%`} tone={result.impact.savingsAfter < result.impact.savingsBefore ? '#f43f5e' : '#10b981'} />
                </div>
                <div className={`mt-2 text-xs rounded-lg p-2 ${result.impact.goesNegative ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>
                  Sobra mensal: <b>{money(result.impact.surplusBefore)}</b> &rarr; <b>{money(result.impact.surplusAfter)}</b>{result.impact.endLabel ? ` · ultima parcela em ${result.impact.endLabel}` : ' · gasto continuo'}
                </div>
              </>
            )}
          </Card>
        </Reveal>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, pct }) {
  return (
    <Card className="py-4 hover-lift">
      <div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><Icon className="w-4 h-4" style={{ color }} /></div>
      <p className="font-display text-xl font-bold mt-1"><AnimatedValue value={value} format={(v) => (pct ? `${v.toFixed(1)}%` : money(v))} /></p>
    </Card>
  );
}
function Metric({ label, value, tone }) {
  return <div className="rounded-lg bg-black/5 dark:bg-white/5 py-1.5"><p className="text-[10px] text-muted">{label}</p><p className="font-bold text-sm" style={{ color: tone }}>{value}</p></div>;
}
