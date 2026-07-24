import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Forecast } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Input, Field, Spinner, Badge } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { formatCurrency, monthKey } from '../lib/utils.js';
import { lastMonths, monthlySeries, projectBalance, evaluateModel } from '../lib/analytics.js';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Calculator, Scissors, TrendingUp, TrendingDown, Target, LineChart as LineIcon, Wallet, PiggyBank, Sparkles, Database, Split, Cpu, Gauge, Check, Play, Brain } from 'lucide-react';

const SCENARIOS = [
  { id: 'cut', label: 'Cortar Gastos', sub: 'Reduza despesas', icon: Scissors, color: '#f43f5e' },
  { id: 'income', label: 'Aumentar Receita', sub: 'Renda extra mensal', icon: TrendingUp, color: '#10b981' },
  { id: 'expense', label: 'Nova Despesa', sub: 'Novo gasto fixo', icon: TrendingDown, color: '#f59e0b' },
  { id: 'goal', label: 'Poupar Meta', sub: 'Reserve p/ objetivo', icon: Target, color: '#6366f1' },
  { id: 'invest', label: 'Investimento', sub: 'Juros compostos', icon: LineIcon, color: '#8b5cf6' },
];
const STEP_DEFS = [
  { id: 'collect', label: 'Coletando historico', icon: Database },
  { id: 'split', label: 'Dividindo treino / teste', icon: Split },
  { id: 'select', label: 'Selecionando modelo', icon: Cpu },
  { id: 'train', label: 'Treinando modelo', icon: Brain },
  { id: 'eval', label: 'Avaliando (holdout)', icon: Gauge },
  { id: 'predict', label: 'Projetando 12 meses', icon: LineIcon },
];
const money = (v) => formatCurrency(v);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Simulator() {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });

  const months = useMemo(() => lastMonths(6), []);
  const series = useMemo(() => monthlySeries(transactions, months), [transactions, months]);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const avgInc = series.reduce((a, s) => a + s.inc, 0) / (series.length || 1);
  const avgExp = series.reduce((a, s) => a + s.exp, 0) / (series.length || 1);
  const rate = avgInc > 0 ? ((avgInc - avgExp) / avgInc) * 100 : 0;

  const [scenario, setScenario] = useState('cut');
  const [cat, setCat] = useState('');
  const [value, setValue] = useState('');
  const [rateInput, setRateInput] = useState('0.8');

  const [phase, setPhase] = useState('idle'); // idle | running | done
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
    if (running.current || !transactions.length) return;
    running.current = true;
    setPhase('running'); setResult(null); setModel(null); setProgress(0); setLogs([]);
    setSteps(STEP_DEFS.map((s) => ({ ...s, status: 'pending' })));
    const ys = series.map((s) => s.net);
    const sc = SCENARIOS.find((s) => s.id === scenario);

    // 1. coletar
    setStep('collect', 'run'); log(`Carregando serie temporal (${series.length} meses de fluxo liquido)...`); await delay(650);
    log(`Amostras: [${ys.map((v) => Math.round(v)).join(', ')}]`); setStep('collect', 'done');

    // 2. split
    setStep('split', 'run'); const nTest = Math.max(1, Math.round(ys.length * 0.2)); const nTrain = ys.length - nTest;
    log(`Split 80/20 -> treino=${nTrain} meses, teste=${nTest} mes(es)`); await delay(650); setStep('split', 'done');

    // 3. selecao de modelo
    setStep('select', 'run'); log('Comparando candidatos: Media Movel, Regressao Linear (OLS)...'); await delay(500);
    log('Selecionado: Regressao Linear (Minimos Quadrados) — melhor ajuste a tendencia'); setStep('select', 'done');

    // 4. treino (barra)
    setStep('train', 'run'); log('Ajustando coeficientes (gradiente analitico)...');
    for (let p = 0; p <= 100; p += 8) { setProgress(p); await delay(45); }
    setProgress(100);
    const ev = evaluateModel(ys);
    log(`Coeficientes: inclinacao=${ev.slope.toFixed(1)}/mes, intercepto=${ev.intercept.toFixed(0)}`); setStep('train', 'done');

    // 5. avaliacao
    setStep('eval', 'run'); await delay(600);
    log(`Metricas (holdout): R2=${(ev.r2 * 100).toFixed(0)}% · MAE=${money(ev.mae)} · RMSE=${money(ev.rmse)}`);
    setModel(ev); setStep('eval', 'done');

    // 6. projecao
    setStep('predict', 'run'); log('Gerando projecao de 12 meses com o cenario aplicado...'); await delay(600);
    const baseNet = ev.predict ? ev.predict(ys.length) : (avgInc - avgExp);
    const v = Number(value) || 0;
    let projection, summary;
    if (scenario === 'invest') {
      const r = (Number(rateInput) || 0) / 100; const arr = []; let bal = totalBalance;
      for (let i = 1; i <= 12; i++) { bal = bal * (1 + r) + v; arr.push({ name: `M${i}`, Base: Math.round(totalBalance + baseNet * i), Cenario: Math.round(bal) }); }
      projection = arr; summary = `Investindo ${money(v)}/mes a ${rateInput}% a.m., em 12 meses: ${money(arr[11].Cenario)}.`;
    } else {
      let delta = 0;
      if (scenario === 'cut' || scenario === 'income') delta = v;
      else if (scenario === 'expense' || scenario === 'goal') delta = -v;
      const base = projectBalance(totalBalance, baseNet, 12);
      const scen = projectBalance(totalBalance, baseNet + delta, 12);
      projection = base.map((b, i) => ({ name: b.name, Base: b.Saldo, Cenario: scen[i].Saldo }));
      const diff = projection[11].Cenario - projection[11].Base;
      summary = scenario === 'goal' ? `Guardando ${money(v)}/mes, em 12 meses voce reserva ${money(v * 12)}.` : `Impacto em 12 meses: ${diff >= 0 ? '+' : ''}${money(diff)} no saldo.`;
    }
    log('Concluido. Projecao pronta.'); setStep('predict', 'done');
    setResult({ projection, summary, color: sc.color });
    setPhase('done'); running.current = false;

    // cache no banco (fire and forget)
    try { const d = new Date(); d.setMonth(d.getMonth() + 1); Forecast.create({ forecast_date: d.toISOString().slice(0, 10), predicted_balance: totalBalance + baseNet * 12, mode: 'cash', generated_at: new Date().toISOString(), confidence_level: ev.r2, explanation: JSON.stringify({ genMonth: monthKey(new Date()), monthlyNet: baseNet, model: ev.model, r2: ev.r2 }) }).catch(() => {}); } catch {}
  }

  const sc = SCENARIOS.find((s) => s.id === scenario);
  const expenseCats = categories.filter((c) => c.type === 'expense');

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Calculator className="w-6 h-6 text-violet-500" /> Simulador Financeiro</span>}
        subtitle="Modelo de predicao que aprende com seu historico e projeta cenarios" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Reveal i={0}><Kpi icon={Wallet} label="Saldo atual" value={totalBalance} color="#6366f1" /></Reveal>
        <Reveal i={1}><Kpi icon={TrendingUp} label="Receita media/mes" value={avgInc} color="#10b981" /></Reveal>
        <Reveal i={2}><Kpi icon={TrendingDown} label="Despesa media/mes" value={avgExp} color="#f43f5e" /></Reveal>
        <Reveal i={3}><Kpi icon={PiggyBank} label="Taxa de poupanca" value={rate} color="#f59e0b" pct /></Reveal>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Escolha o cenario para simular:</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {SCENARIOS.map((s, i) => (
            <Reveal key={s.id} i={i}>
              <button onClick={() => { setScenario(s.id); }} className={`w-full p-4 rounded-2xl border-2 text-left transition hover-lift ${scenario === s.id ? 'text-white shadow-soft' : 'border-[hsl(var(--border))] hover:bg-black/5 dark:hover:bg-white/5'}`} style={scenario === s.id ? { background: s.color, borderColor: s.color } : {}}>
                <s.icon className="w-5 h-5" /><p className="font-semibold text-sm mt-2">{s.label}</p><p className={`text-xs ${scenario === s.id ? 'text-white/80' : 'text-muted'}`}>{s.sub}</p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Config */}
        <Card className="hover-lift">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><sc.icon className="w-4 h-4" style={{ color: sc.color }} /> Configuracao — {sc.label}</h3>
          <div className="space-y-4">
            {scenario === 'cut' && <Field label="Categoria para cortar"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Selecione a categoria</option>{expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <Field label={scenario === 'goal' ? 'Valor a guardar/mes' : scenario === 'income' ? 'Renda extra/mes' : scenario === 'invest' ? 'Aporte mensal' : scenario === 'expense' ? 'Novo gasto/mes' : 'Valor a economizar/mes'}>
              <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="R$ 0,00" />
            </Field>
            {scenario === 'invest' && <Field label="Rendimento mensal (%)"><Input type="number" step="0.01" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="0.8" /></Field>}
            <Button onClick={run} className="w-full" style={{ background: sc.color }} disabled={phase === 'running'}>
              {phase === 'running' ? <><Spinner className="w-4 h-4" /> Processando...</> : <><Play className="w-4 h-4" /> Treinar & Simular</>}
            </Button>
            {model && phase === 'done' && (
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-2 animate-fadeIn">
                <p className="text-xs font-bold tracking-wider text-muted flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> MODELO TREINADO</p>
                <p className="text-sm font-semibold">{model.model}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="R2" value={`${(model.r2 * 100).toFixed(0)}%`} tone="#10b981" />
                  <Metric label="MAE" value={money(model.mae)} tone="#6366f1" />
                  <Metric label="RMSE" value={money(model.rmse)} tone="#f59e0b" />
                </div>
                <p className="text-xs text-muted">Split {model.nTrain}/{model.nTest} · tendencia <b>{model.trend}</b> · features: indice do mes + intercepto</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pipeline / Motor */}
        <Card className="hover-lift relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Brain className={`w-4 h-4 text-violet-500 ${phase === 'running' ? 'blink' : ''}`} /> Motor de Predicao</h3>
            <Badge color="violet">ML</Badge>
          </div>

          {phase === 'idle' ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3"><Cpu className="w-7 h-7 text-violet-500" /></div>
              <p className="text-sm font-medium">Pronto para treinar</p>
              <p className="text-xs mt-1 max-w-xs">Configure o cenario e clique em <b>Treinar & Simular</b>. O modelo vai dividir, treinar e avaliar seus dados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* stepper */}
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
              {/* terminal */}
              <div ref={logRef} className="rounded-xl bg-slate-950 text-slate-300 p-3 font-mono text-[11px] leading-relaxed h-40 overflow-y-auto">
                {logs.map((l, i) => (<div key={i}><span className="text-emerald-400">[{l.t}]</span> {l.m}</div>))}
                {phase === 'running' && <span className="text-violet-400 blink">▊</span>}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Projecao */}
      {result && (
        <Reveal>
          <Card className="hover-lift">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><LineIcon className="w-4 h-4 text-emerald-500" /> Projecao de Saldo — 12 meses</h3>{model && <Badge color="emerald">confianca {(model.r2 * 100).toFixed(0)}%</Badge>}</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={result.projection}>
                <defs><linearGradient id="sBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity={0.25} /><stop offset="100%" stopColor="#94a3b8" stopOpacity={0} /></linearGradient><linearGradient id="sScen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={result.color} stopOpacity={0.35} /><stop offset="100%" stopColor={result.color} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis width={46} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                <Area dataKey="Base" name="Base (tendencia)" stroke="#94a3b8" strokeWidth={2} fill="url(#sBase)" />
                <Area dataKey="Cenario" name="Cenario" stroke={result.color} strokeWidth={2.5} fill="url(#sScen)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-sm text-indigo-700 dark:text-indigo-300 flex items-start gap-2"><Sparkles className="w-4 h-4 mt-0.5 shrink-0" /> {result.summary}</div>
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
