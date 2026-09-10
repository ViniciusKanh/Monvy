import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark, ShieldCheck, Calculator, Info, HelpCircle, Plug, PlusCircle,
  Receipt, Car, Home, TrendingDown, CheckCircle2, CircleDashed, PencilLine, Wallet,
  ChevronLeft, ChevronRight, CalendarDays, ShieldQuestion, Check, Loader2, Sparkles, Trash2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Field, Modal, Badge, EmptyState, Spinner } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Transaction, CreditCardTransaction, Category, TaxLedger, Ai, AppSettings } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { combineExpenses } from '../lib/analytics.js';
import { buildTaxRecords, aggregate, explain, buildTaxAnalysis } from '../lib/taxBurden.js';
import { STATUS } from '../lib/taxRates.js';
import { BankConnections } from '../components/BankConnections.jsx';
import { AiInsight } from '../components/AiInsight.jsx';
import { Integrations } from '../api/entities.js';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const LS_KEY = 'monvy:taxBurden:v1';
// Seed de desenvolvimento (spec): apenas salario/INSS/IRRF de exemplo; demais zerados.
const DEFAULTS = { salarioBruto: '4200', dependentes: '0', deducoes: '', inssConfirmado: '392.60', irrfConfirmado: '0', ipvaAnual: '', iptuAnual: '' };

function loadCfg() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* */ }
  return { ...DEFAULTS };
}
const n = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };

// cor por status
const STATUS_UI = {
  [STATUS.confirmed]: { label: 'Confirmado', color: 'emerald', icon: CheckCircle2, hint: 'Sustentado por uma fonte (holerite, lançamento ou cadastro).' },
  [STATUS.estimated]: { label: 'Estimado', color: 'amber', icon: CircleDashed, hint: 'Média/tabela de referência. Não representa valor efetivamente recolhido.' },
  [STATUS.manual]: { label: 'Informado', color: 'violet', icon: PencilLine, hint: 'Valor que você digitou (ex.: IPVA/IPTU anual mensalizado).' },
};
const CARD_ICON = { inss: ShieldCheck, irrf: Receipt, consumo: TrendingDown, iof: Calculator, ipva: Car, iptu: Home };
// Classes estáticas (evita purge do Tailwind com strings dinâmicas)
const ICON_BG = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30',
};
const PIE_COLORS = ['#059669', '#0d9488', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444'];

export default function TaxBurden() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(loadCfg);
  const [editOpen, setEditOpen] = useState(false);
  const [explainRec, setExplainRec] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [informe, setInforme] = useState({ origin_label: '', ir: '', iof: '', outros: '' });
  const [informeReview, setInformeReview] = useState(null); // linhas extraidas do PDF
  const [importingInforme, setImportingInforme] = useState(false);
  const fileRef = useRef(null);

  const currentMk = monthKey(new Date());
  const [selMk, setSelMk] = useState(currentMk);
  const nowMk = selMk;
  const ano = Number(nowMk.slice(0, 4));
  const mes = Number(nowMk.slice(5, 7));
  const stepMonth = (delta) => { const [y, m] = selMk.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); const mk = monthKey(d); if (mk <= currentMk) setSelMk(mk); };
  const isCurrent = selMk === currentMk;
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const save = (next) => { setCfg(next); try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* */ } };

  const refreshLedger = () => { qc.invalidateQueries({ queryKey: ['tax-ledger-year', ano] }); qc.invalidateQueries({ queryKey: ['tax-ledger', selMk] }); };
  const saveInforme = useMutation({
    mutationFn: async () => {
      const ir = n(informe.ir), iof = n(informe.iof), outros = n(informe.outros);
      const total = Math.round((ir + iof + outros) * 100) / 100;
      if (!informe.origin_label.trim() || total <= 0) throw new Error('Informe a conta/banco e ao menos um valor.');
      return TaxLedger.create({ kind: 'INFORME', amount: total, year: ano, source: 'informe', origin_kind: 'account', origin_label: informe.origin_label.trim(), meta: { ir, iof, outros } });
    },
    onSuccess: () => { toast.success('Informe de rendimento salvo.'); setInforme({ origin_label: '', ir: '', iof: '', outros: '' }); refreshLedger(); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });
  const removeLedger = useMutation({ mutationFn: (id) => TaxLedger.remove(id), onSuccess: () => { toast.success('Removido.'); refreshLedger(); } });

  // Importar informe de rendimentos (PDF) com IA — adapta a varios tipos de conta
  const settingsQ = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const geminiKey = settingsQ.data?.[0]?.gemini_api_key;
  const onInformeFile = async (e) => {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!file) return;
    if (!geminiKey) { toast.error('Configure a chave do Gemini em Configurações para ler o PDF.'); return; }
    setImportingInforme(true);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const { accounts = [] } = await Ai.parseInforme(base64, geminiKey, ano);
      if (!accounts.length) { toast.error('Não encontrei tributos no informe. Você pode lançar manualmente.'); return; }
      setInformeReview(accounts.map((a, i) => ({ _k: i, origin_label: a.institution, account_type: a.account_type, ir: String(a.ir_fonte || ''), iof: String(a.iof || ''), outros: String(a.outros || ''), rendimentos: a.rendimentos || 0 })));
      toast.success(`${accounts.length} conta(s) lida(s). Revise e salve.`);
    } catch (err) { toast.error(err.message || 'Falha ao ler o informe.'); }
    finally { setImportingInforme(false); }
  };
  const saveInformeBatch = useMutation({
    mutationFn: async () => {
      const rows = (informeReview || []).map((a) => {
        const ir = n(a.ir), iof = n(a.iof), outros = n(a.outros);
        return { kind: 'INFORME', amount: Math.round((ir + iof + outros) * 100) / 100, year: ano, source: 'informe', origin_kind: 'account', origin_label: (a.origin_label || 'Conta').trim(), meta: { ir, iof, outros, account_type: a.account_type, rendimentos: a.rendimentos } };
      }).filter((r) => r.amount > 0);
      if (!rows.length) throw new Error('Nenhum valor de tributo para salvar.');
      for (const r of rows) await TaxLedger.create(r);
      return rows.length;
    },
    onSuccess: (n2) => { toast.success(`${n2} conta(s) salva(s) do informe.`); setInformeReview(null); refreshLedger(); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });

  // Transacoes reais dos bancos conectados (Pluggy) no mes selecionado -> refinam o consumo
  const ofTxQ = useQuery({
    queryKey: ['tax-of-tx', selMk],
    queryFn: async () => { try { const r = await Integrations.transactions(`${selMk}-01`, `${selMk}-31`); return r.transactions || []; } catch { return []; } },
    retry: false,
  });

  const txQ = useQuery({ queryKey: ['tax-tx'], queryFn: () => Transaction.list() });
  const ccQ = useQuery({ queryKey: ['tax-cc'], queryFn: () => CreditCardTransaction.list() });
  const catQ = useQuery({ queryKey: ['tax-cat'], queryFn: () => Category.list() });
  const loading = txQ.isLoading || ccQ.isLoading;
  const erro = txQ.isError || ccQ.isError;

  // Tributos importados/informados (IOF das faturas, informe de rendimento)
  const ledgerMonthQ = useQuery({ queryKey: ['tax-ledger', selMk], queryFn: () => TaxLedger.list({ reference_month: selMk }) });
  const ledgerYearQ = useQuery({ queryKey: ['tax-ledger-year', ano], queryFn: () => TaxLedger.list({ year: ano }) });
  const iofConfirmado = useMemo(() => (ledgerMonthQ.data || []).filter((r) => r.kind === 'IOF').reduce((s, r) => s + Number(r.amount || 0), 0), [ledgerMonthQ.data]);
  const informeEntries = useMemo(() => (ledgerYearQ.data || []).filter((r) => r.source === 'informe'), [ledgerYearQ.data]);

  // id -> nome da categoria (melhora a classificação por bucket de consumo)
  const catName = useMemo(() => Object.fromEntries((catQ.data || []).map((c) => [c.id, c.name])), [catQ.data]);

  // Gastos reais do mês (despesas positivas) -> base do consumo estimado.
  // Combina lançamentos do Monvy + cartão de crédito; usa o NOME da categoria.
  const gastosPorMes = useMemo(() => {
    const all = combineExpenses(txQ.data || [], ccQ.data || [])
      .filter((t) => t.type === 'expense' && Number(t.amount) > 0)
      .filter((t) => !/\biof\b/i.test(t.description || '')); // IOF é tributo, não consumo (evita dupla contagem)
    const byMonth = {};
    for (const t of all) {
      const mk = String(t.date).slice(0, 7);
      (byMonth[mk] = byMonth[mk] || []).push({ valor: Number(t.amount), descricao: t.description, categoria: catName[t.category_id] || t.description });
    }
    return byMonth;
  }, [txQ.data, ccQ.data, catName]);

  // Gastos do mês selecionado = Monvy + banco conectado (Pluggy), com dedup simples
  const gastosSel = useMemo(() => {
    const base = gastosPorMes[nowMk] || [];
    const seen = new Set(base.map((g) => `${Math.round(g.valor * 100)}`));
    const of = (ofTxQ.data || []).filter((t) => t.type === 'expense' && Number(t.amount) > 0)
      .filter((t) => { const k = `${Math.round(Number(t.amount) * 100)}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((t) => ({ valor: Number(t.amount), descricao: t.description, categoria: t.category }));
    return [...base, ...of];
  }, [gastosPorMes, nowMk, ofTxQ.data]);
  const usandoBanco = (ofTxQ.data || []).length > 0;

  // Registros e resumo do mês atual
  const { records, resumo, rendaBruta } = useMemo(() => {
    const entrada = {
      ano, mes,
      salarioBruto: n(cfg.salarioBruto),
      dependentes: n(cfg.dependentes),
      deducoes: n(cfg.deducoes),
      inssConfirmado: cfg.inssConfirmado === '' ? undefined : n(cfg.inssConfirmado),
      irrfConfirmado: cfg.irrfConfirmado === '' ? undefined : n(cfg.irrfConfirmado),
      gastos: gastosSel,
      ipvaAnual: n(cfg.ipvaAnual),
      iptuAnual: n(cfg.iptuAnual),
      iofLancado: iofConfirmado, // IOF confirmado, somado das faturas importadas
    };
    const recs = buildTaxRecords(entrada);
    const rb = n(cfg.salarioBruto);
    return { records: recs, resumo: aggregate(recs, rb), rendaBruta: rb };
  }, [cfg, gastosSel, ano, mes, iofConfirmado]);

  // Histórico de 6 meses (carga total por mês) — usa consumo real de cada mês
  const historico = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      const mk = monthKey(d);
      const recs = buildTaxRecords({
        ano: d.getFullYear(), mes: d.getMonth() + 1,
        salarioBruto: n(cfg.salarioBruto), dependentes: n(cfg.dependentes), deducoes: n(cfg.deducoes),
        inssConfirmado: cfg.inssConfirmado === '' ? undefined : n(cfg.inssConfirmado),
        irrfConfirmado: cfg.irrfConfirmado === '' ? undefined : n(cfg.irrfConfirmado),
        gastos: gastosPorMes[mk] || [], ipvaAnual: n(cfg.ipvaAnual), iptuAnual: n(cfg.iptuAnual),
      });
      const ag = aggregate(recs, n(cfg.salarioBruto));
      arr.push({ mk, label: monthLabel(mk).split(' ')[0].slice(0, 3), total: ag.totalCarga, confirmado: ag.totalConfirmado, estimado: ag.totalEstimado });
    }
    return arr;
  }, [cfg, gastosPorMes, ano, mes]);

  const pieData = resumo.componentes.filter((c) => c.amount > 0).map((c) => ({ name: c.name, value: c.amount }));

  // Análise inteligente do mês (cruza gasto total + tributos)
  const analise = useMemo(() => {
    const gastoTotal = gastosSel.reduce((s, g) => s + n(g.valor), 0);
    const idx = historico.findIndex((h) => h.mk === nowMk);
    const prevTotalCarga = idx > 0 ? historico[idx - 1].total : null;
    return buildTaxAnalysis({ mesLabel: monthLabel(nowMk), rendaBruta, gastoTotal, records, resumo, prevTotalCarga });
  }, [gastosSel, historico, nowMk, rendaBruta, records, resumo]);

  // Prompt para a IA elaborar em cima dos números já calculados
  const aiPrompt = useMemo(() => (
    `Escreva uma análise curta (3-4 frases), em português do Brasil, tom prático e claro, sobre a carga tributária de ${monthLabel(nowMk)} deste usuário. `
    + `Use SOMENTE estes números já calculados (não invente): gasto total do mês ${formatCurrency(analise.gastoTotal)}; `
    + `imposto total ${formatCurrency(analise.impostoTotal)} (${analise.pctRenda}% da renda bruta de ${formatCurrency(rendaBruta)}); `
    + `sendo ${formatCurrency(analise.impostoSalario)} sobre o salário (INSS+IRRF) e ${formatCurrency(analise.impostoConsumo)} de tributos embutidos no consumo`
    + `${analise.impostoOutros > 0 ? ` e ${formatCurrency(analise.impostoOutros)} de IPVA/IPTU/IOF` : ''}. `
    + `${analise.top.length ? `Onde o imposto de consumo mais pesa: ${analise.top.map((t) => `${t.label} ${formatCurrency(t.tributo)}`).join(', ')}. ` : ''}`
    + `Explique de forma simples onde o dinheiro está indo em imposto e dê 1 dica prática. Não repita todos os números crus como lista; escreva em texto corrido.`
  ), [analise, nowMk, rendaBruta]);

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner className="w-8 h-8" /></div>;

  const cpfLabel = user?.cpf_set ? user.cpf_masked : 'CPF não cadastrado';

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Minha Carga Tributária</span>}
        subtitle="Quanto você paga (e estima pagar) em tributos por mês e por ano" />

      {/* Cabeçalho: mês, renda, CPF mascarado */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Mês</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <button onClick={() => stepMonth(-1)} className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
              <span className="font-semibold min-w-[130px] text-center">{monthLabel(nowMk)}</span>
              <button onClick={() => stepMonth(1)} disabled={isCurrent} className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center disabled:opacity-30" title="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
              {!isCurrent && <button onClick={() => setSelMk(currentMk)} className="text-xs text-emerald-600 hover:underline ml-1">hoje</button>}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div><span className="text-muted">Renda bruta</span><div className="font-semibold">{formatCurrency(rendaBruta)}</div></div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div><span className="text-muted flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> CPF</span><div className="font-semibold font-mono">{cpfLabel}</div></div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSourcesOpen(true)}><Plug className="w-4 h-4" /> Fontes{usandoBanco && <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" title="Banco conectado alimentando a análise" />}</Button>
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => setAdminOpen(true)}><ShieldCheck className="w-4 h-4" /> Tributos importados</Button>}
          <Button size="sm" onClick={() => setEditOpen(true)}><PencilLine className="w-4 h-4" /> Meus dados</Button>
        </div>
      </Card>

      {erro && <Card className="border-red-300 text-red-600 text-sm">Não consegui carregar seus lançamentos agora. Os tributos diretos ainda aparecem; o consumo pode ficar incompleto.</Card>}

      {/* Card principal — só quando há dado suficiente */}
      {resumo.temDadoSuficiente ? (
        <div className="rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#065f46,#0d9488)' }}>
          <p className="text-sm opacity-90">Carga tributária estimada do mês</p>
          <p className="font-display text-4xl font-extrabold mt-1"><AnimatedValue value={resumo.totalCarga} format={formatCurrency} /></p>
          <p className="text-sm opacity-90 mt-1">
            {resumo.percentualCarga.toFixed(1)}% da sua renda bruta · confirmado {formatCurrency(resumo.totalConfirmado)} + estimado {formatCurrency(resumo.totalEstimado)}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm bg-white/15 rounded-lg px-3 py-1.5" title="Equivalência financeira: quantos dias do ano de trabalho, proporcionalmente, custeiam esses tributos. Não é um pagamento literal diário.">
            <Info className="w-4 h-4" /> equivale a aproximadamente <b>{Math.round(resumo.diasEquivalentes)} dias</b> de trabalho no ano
          </div>
          {resumo.categoriasSemDado.length > 0 && (
            <p className="text-xs opacity-80 mt-3">Carga conhecida até agora. Ainda existem categorias sem dados: {resumo.categoriasSemDado.map((k) => k.toUpperCase()).join(', ')}.</p>
          )}
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="font-semibold">Carga conhecida até agora</p>
          <p className="text-sm text-muted mt-1">Ainda existem categorias sem dados. Adicione seu salário para começar a medir INSS e IRRF.</p>
          <Button className="mt-4" onClick={() => setEditOpen(true)}><Wallet className="w-4 h-4" /> Adicionar salário</Button>
        </Card>
      )}

      {/* Análise do mês — narrativa + composição gasto vs imposto */}
      {resumo.temDadoSuficiente && (
        <Card>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-emerald-500" /> Análise do mês</h3>
          <p className="text-sm leading-relaxed">{analise.narrativa}</p>
          <div className="grid sm:grid-cols-4 gap-2 mt-4">
            <MiniStat label="Gastou no mês" value={formatCurrency(analise.gastoTotal)} tone="slate" />
            <MiniStat label="Só de imposto" value={formatCurrency(analise.impostoTotal)} tone="emerald" hint={`${analise.pctRenda}% da renda`} />
            <MiniStat label="Sobre o salário" value={formatCurrency(analise.impostoSalario)} tone="blue" hint="INSS + IRRF" />
            <MiniStat label="No consumo" value={formatCurrency(analise.impostoConsumo)} tone="amber" hint={`${analise.pctConsumoDoGasto}% dos gastos`} />
          </div>
          {analise.top.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted mb-1">Onde o imposto embutido mais pesa:</p>
              <div className="flex flex-wrap gap-2">
                {analise.top.map((t) => <Badge key={t.label} color="amber">{t.label} · {formatCurrency(t.tributo)}</Badge>)}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Aprofundar com IA (Gemini, com fallback no motor local) */}
      {resumo.temDadoSuficiente && (
        <AiInsight prompt={aiPrompt} storageKey={`taxburden_${nowMk}`} title="Análise inteligente (IA)" agentName="Consultor Tributário" agentFocus="impostos" />
      )}

      {/* Cards por categoria */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {records.map((r, i) => {
          const ui = STATUS_UI[r.status];
          const Icon = CARD_ICON[r.key] || Calculator;
          const StatusIcon = ui.icon;
          return (
            <Reveal key={r.id} delay={i * 40}>
              <Card className={`h-full ${!r.available ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${ICON_BG[ui.color]}`}><Icon className="w-4.5 h-4.5" /></span>
                    <div>
                      <p className="font-semibold text-sm">{r.name}</p>
                      <Badge color={ui.color} className="mt-0.5"><StatusIcon className="w-3 h-3" /> {r.available ? ui.label : 'Indisponível'}</Badge>
                    </div>
                  </div>
                  <button className="text-muted hover:text-emerald-500" title="Como calculamos" onClick={() => setExplainRec(r)}><HelpCircle className="w-4 h-4" /></button>
                </div>
                <p className="font-display text-2xl font-bold mt-3">{r.available ? formatCurrency(r.amount) : '—'}</p>
                {r.available && r.meta?.mensalizado && <p className="text-xs text-muted">equivalência mensal ({formatCurrency(r.meta.anual)}/ano ÷ 12)</p>}
                {r.available && r.key === 'consumo' && <p className="text-xs text-muted">sobre {formatCurrency(r.meta.totalGasto)} de gastos · média {r.meta.percentualMedio.toFixed(0)}%</p>}
                {!r.available && r.key === 'consumo' && <p className="text-xs text-muted">sem lançamentos no mês</p>}
                {!r.available && (r.key === 'ipva' || r.key === 'iptu') && <p className="text-xs text-muted">informe em "Meus dados"</p>}
                {r.available && r.key === 'irrf' && r.meta?.isento && <p className="text-xs text-emerald-600">isento nesta faixa</p>}
              </Card>
            </Reveal>
          );
        })}
      </div>

      {/* Gráficos — valores idênticos aos cards */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-500" /> Distribuição do mês</h3>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={Receipt} title="Sem dados" subtitle="Adicione salário e lançamentos para ver a distribuição." />}
        </Card>
        <Card>
          <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-emerald-500" /> Histórico (6 meses)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="confirmado" stackId="a" fill="#059669" name="Confirmado" radius={[0, 0, 0, 0]} />
              <Bar dataKey="estimado" stackId="a" fill="#f59e0b" name="Estimado" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setDetailsOpen(true)}><Info className="w-4 h-4" /> Ver detalhes</Button>
      </div>

      {/* Modal: Meus dados (entradas manuais) */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Meus dados tributários"
        footer={<Button onClick={() => setEditOpen(false)} className="w-full">Concluir</Button>}>
        <div className="space-y-3">
          <p className="text-xs text-muted">O cálculo é feito no seu dispositivo. INSS e IRRF são calculados pelas tabelas oficiais; se você tem o holerite, informe os valores descontados para marcá-los como <b>confirmados</b>.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salário bruto (R$)"><Input inputMode="decimal" value={cfg.salarioBruto} onChange={(e) => save({ ...cfg, salarioBruto: e.target.value })} /></Field>
            <Field label="Dependentes"><Input inputMode="numeric" value={cfg.dependentes} onChange={(e) => save({ ...cfg, dependentes: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="INSS descontado (holerite)" hint="opcional — confirma o valor"><Input inputMode="decimal" value={cfg.inssConfirmado} onChange={(e) => save({ ...cfg, inssConfirmado: e.target.value })} placeholder="calculado se vazio" /></Field>
            <Field label="IRRF descontado (holerite)" hint="opcional — confirma o valor"><Input inputMode="decimal" value={cfg.irrfConfirmado} onChange={(e) => save({ ...cfg, irrfConfirmado: e.target.value })} placeholder="calculado se vazio" /></Field>
          </div>
          <Field label="Outras deduções mensais (R$)" hint="saúde, previdência, pensão"><Input inputMode="decimal" value={cfg.deducoes} onChange={(e) => save({ ...cfg, deducoes: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IPVA anual (R$)" hint="mensalizado ÷ 12"><Input inputMode="decimal" value={cfg.ipvaAnual} onChange={(e) => save({ ...cfg, ipvaAnual: e.target.value })} /></Field>
            <Field label="IPTU anual (R$)" hint="mensalizado ÷ 12"><Input inputMode="decimal" value={cfg.iptuAnual} onChange={(e) => save({ ...cfg, iptuAnual: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {/* Modal: Como calculamos */}
      <Modal open={!!explainRec} onClose={() => setExplainRec(null)} title={explainRec ? `Como calculamos: ${explainRec.name}` : ''}>
        {explainRec && (() => { const e = explain(explainRec); const ui = STATUS_UI[explainRec.status]; return (
          <div className="space-y-3 text-sm">
            <Badge color={ui.color}>{explainRec.available ? ui.label : 'Indisponível'}</Badge>
            <p className="text-muted">{ui.hint}</p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
              <div className="flex justify-between"><span className="text-muted">Valor</span><b>{explainRec.available ? formatCurrency(explainRec.amount) : '—'}</b></div>
              <div className="flex justify-between"><span className="text-muted">Fonte</span><span>{e.fonte}</span></div>
              <div className="flex justify-between"><span className="text-muted">Origem</span><span>{e.source}</span></div>
              {e.detalhe?.base != null && <div className="flex justify-between"><span className="text-muted">Base de cálculo</span><span>{formatCurrency(e.detalhe.base)}</span></div>}
              {e.detalhe?.aliquotaEfetiva != null && <div className="flex justify-between"><span className="text-muted">Alíquota efetiva</span><span>{e.detalhe.aliquotaEfetiva.toFixed(2)}%</span></div>}
              {e.detalhe?.percentualMedio != null && <div className="flex justify-between"><span className="text-muted">% médio embutido</span><span>{e.detalhe.percentualMedio.toFixed(1)}%</span></div>}
              {e.atualizadoEm && <div className="flex justify-between"><span className="text-muted">Atualizado</span><span>{new Date(e.atualizadoEm).toLocaleDateString('pt-BR')}</span></div>}
            </div>
            {!e.confirmado && <p className="text-xs text-amber-600">Este valor é uma estimativa e não representa tributo efetivamente recolhido.</p>}
          </div>
        ); })()}
      </Modal>

      {/* Modal: Ver detalhes */}
      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Detalhes da carga tributária" maxWidth="max-w-xl">
        <div className="space-y-4 text-sm">
          <Section title="Renda">
            <Row label="Renda bruta mensal" value={formatCurrency(rendaBruta)} />
          </Section>
          <Section title="Tributos diretos">
            {records.filter((r) => ['inss', 'irrf', 'iof'].includes(r.key)).map((r) => (
              <Row key={r.id} label={r.name} value={r.available ? formatCurrency(r.amount) : 'indisponível'} tag={STATUS_UI[r.status].label} color={STATUS_UI[r.status].color} />
            ))}
          </Section>
          <Section title="Tributos sobre consumo">
            {(() => { const c = records.find((r) => r.key === 'consumo'); if (!c?.available) return <p className="text-muted">Sem lançamentos neste mês.</p>;
              return (c.meta.itens || []).map((it) => <Row key={it.chave} label={`${it.label} (${(it.percentual * 100).toFixed(0)}%)`} value={formatCurrency(it.tributo)} tag="Estimado" color="amber" />); })()}
          </Section>
          <Section title="Patrimônio">
            {records.filter((r) => ['ipva', 'iptu'].includes(r.key)).map((r) => (
              <Row key={r.id} label={`${r.name}${r.meta?.mensalizado ? ' (mensalizado)' : ''}`} value={r.available ? formatCurrency(r.amount) : 'não informado'} tag={STATUS_UI[r.status].label} color={STATUS_UI[r.status].color} />
            ))}
          </Section>
          <div className="flex justify-between border-t pt-3 font-semibold"><span>Total da carga do mês</span><span>{formatCurrency(resumo.totalCarga)}</span></div>
          <p className="text-xs text-muted">Projeção anual aproximada: {formatCurrency(resumo.totalCarga * 12)} ({resumo.percentualCarga.toFixed(1)}% da renda).</p>
        </div>
      </Modal>

      {/* Modal: Fontes conectadas */}
      <Modal open={sourcesOpen} onClose={() => setSourcesOpen(false)} title="Fontes conectadas" maxWidth="max-w-lg">
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted">Conecte seus bancos via Open Finance (Pluggy) para uma análise mais precisa. Você autoriza no ambiente do banco; o Monvy nunca vê sua senha e a leitura pode ser revogada a qualquer momento.</p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1"><Plug className="w-3.5 h-3.5" /> Bancos conectados</p>
            <BankConnections />
          </div>

          <SourceRow icon={Landmark} name="Receita Federal / SERPRO" desc="Integra Contador / Compartilha RFB — requer contrato e certificado." connected={false} disabled />
          <SourceRow icon={Wallet} name="Folha de pagamento" desc="Você informa os valores do holerite em 'Meus dados'." connected={n(cfg.inssConfirmado) > 0} manual />
          <SourceRow icon={Receipt} name="IBPT (consumo)" desc="Médias de referência para tributos embutidos em compras." connected manual />
        </div>
      </Modal>

      {/* Modal Admin: Tributos importados (IOF das faturas + informe de rendimento) */}
      <Modal open={adminOpen} onClose={() => setAdminOpen(false)} title="Tributos importados (Admin)" maxWidth="max-w-xl">
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted">Recurso administrativo. Consolida tributos vindos de outras telas para análise aqui: o <b>IOF</b> capturado a cada fatura de cartão importada e o <b>informe de rendimento</b> das suas contas (IR na fonte, IOF, outros). Dados sensíveis — mantenha restrito.</p>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">IOF das faturas · {ano}</p>
            {(ledgerYearQ.data || []).filter((r) => r.source === 'invoice' && r.kind === 'IOF').length === 0
              ? <p className="text-xs text-muted">Nenhum IOF capturado ainda. Importe uma fatura em Cartões que contenha IOF.</p>
              : (ledgerYearQ.data || []).filter((r) => r.source === 'invoice' && r.kind === 'IOF').map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1">
                  <span>{r.origin_label} · {r.reference_month}</span>
                  <span className="flex items-center gap-2"><b>{formatCurrency(r.amount)}</b><button className="text-rose-500" onClick={() => removeLedger.mutate(r.id)}><Trash2 className="w-3.5 h-3.5" /></button></span>
                </div>
              ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Informe de rendimento por conta · {ano}</p>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onInformeFile} />
              <Button size="sm" variant="outline" disabled={importingInforme} onClick={() => fileRef.current?.click()}>{importingInforme ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> Importar PDF (IA)</>}</Button>
            </div>

            {/* Revisão do que a IA leu do PDF (multi-conta, editável) */}
            {informeReview && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-3 mb-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mb-2">Lido do informe — revise antes de salvar</p>
                <div className="space-y-2">
                  {informeReview.map((a, i) => (
                    <div key={a._k} className="rounded-lg bg-white dark:bg-slate-800 p-2">
                      <div className="flex items-center gap-2">
                        <Input className="flex-1" value={a.origin_label} onChange={(e) => setInformeReview((rv) => rv.map((x, j) => j === i ? { ...x, origin_label: e.target.value } : x))} placeholder="Instituição" />
                        <span className="text-xs text-muted whitespace-nowrap">{a.account_type}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <Field label="IR fonte"><Input inputMode="decimal" value={a.ir} onChange={(e) => setInformeReview((rv) => rv.map((x, j) => j === i ? { ...x, ir: e.target.value } : x))} /></Field>
                        <Field label="IOF"><Input inputMode="decimal" value={a.iof} onChange={(e) => setInformeReview((rv) => rv.map((x, j) => j === i ? { ...x, iof: e.target.value } : x))} /></Field>
                        <Field label="Outros"><Input inputMode="decimal" value={a.outros} onChange={(e) => setInformeReview((rv) => rv.map((x, j) => j === i ? { ...x, outros: e.target.value } : x))} /></Field>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setInformeReview(null)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" disabled={saveInformeBatch.isPending} onClick={() => saveInformeBatch.mutate()}>{saveInformeBatch.isPending ? <Spinner className="w-4 h-4" /> : `Salvar ${informeReview.length} conta(s)`}</Button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted mb-2">Ou lance manualmente:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Field label="Conta / Banco"><Input value={informe.origin_label} onChange={(e) => setInforme({ ...informe, origin_label: e.target.value })} placeholder="Ex: Nubank NuConta" /></Field></div>
              <Field label="IR na fonte (R$)"><Input inputMode="decimal" value={informe.ir} onChange={(e) => setInforme({ ...informe, ir: e.target.value })} /></Field>
              <Field label="IOF (R$)"><Input inputMode="decimal" value={informe.iof} onChange={(e) => setInforme({ ...informe, iof: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Outros tributos (R$)"><Input inputMode="decimal" value={informe.outros} onChange={(e) => setInforme({ ...informe, outros: e.target.value })} /></Field></div>
            </div>
            <Button className="w-full mt-2" disabled={saveInforme.isPending} onClick={() => saveInforme.mutate()}>{saveInforme.isPending ? <Spinner className="w-4 h-4" /> : <><PlusCircle className="w-4 h-4" /> Adicionar informe</>}</Button>
          </div>

          {informeEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Informes cadastrados</p>
              {informeEntries.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 mb-1">
                  <div>
                    <p className="font-medium">{r.origin_label}</p>
                    <p className="text-xs text-muted">IR {formatCurrency(r.meta?.ir || 0)} · IOF {formatCurrency(r.meta?.iof || 0)} · Outros {formatCurrency(r.meta?.outros || 0)}</p>
                  </div>
                  <span className="flex items-center gap-2"><b>{formatCurrency(r.amount)}</b><button className="text-rose-500" onClick={() => removeLedger.mutate(r.id)}><Trash2 className="w-4 h-4" /></button></span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 mt-1 font-semibold"><span>Total tributos das contas ({ano})</span><span>{formatCurrency(informeEntries.reduce((s, r) => s + Number(r.amount || 0), 0))}</span></div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const MINISTAT_TONE = {
  slate: 'bg-slate-50 dark:bg-slate-800/50',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
};
function MiniStat({ label, value, tone = 'slate', hint }) {
  return (
    <div className={`rounded-xl p-3 ${MINISTAT_TONE[tone]}`}>
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="font-display text-lg font-bold leading-tight">{value}</p>
      {hint && <p className="text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}
function Section({ title, children }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">{title}</p><div className="space-y-1">{children}</div></div>;
}
function Row({ label, value, tag, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">{label}{tag && <Badge color={color}>{tag}</Badge>}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function SourceRow({ icon: Icon, name, desc, connected, onToggle, mock, disabled, manual }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
        <div>
          <p className="font-semibold flex items-center gap-2">{name} {mock && <Badge color="amber">simulado</Badge>} {manual && <Badge color="violet">manual</Badge>}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      {onToggle ? (
        <Button size="sm" variant={connected ? 'ghost' : 'primary'} onClick={onToggle}>{connected ? 'Revogar' : 'Conectar'}</Button>
      ) : (
        <Badge color={connected ? 'emerald' : 'slate'}>{disabled ? 'requer contrato' : connected ? 'ativo' : 'inativo'}</Badge>
      )}
    </div>
  );
}
