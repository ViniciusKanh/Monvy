import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark, ShieldCheck, Calculator, Info, HelpCircle, Plug, PlusCircle,
  Receipt, Car, Home, TrendingDown, CheckCircle2, CircleDashed, PencilLine, Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Field, Modal, Badge, EmptyState, Spinner } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthKey, monthLabel } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Transaction, CreditCardTransaction } from '../api/entities.js';
import { combineExpenses } from '../lib/analytics.js';
import { buildTaxRecords, aggregate, explain } from '../lib/taxBurden.js';
import { STATUS } from '../lib/taxRates.js';
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
  const [ofConnected, setOfConnected] = useState(false);

  const nowMk = monthKey(new Date());
  const ano = Number(nowMk.slice(0, 4));
  const mes = Number(nowMk.slice(5, 7));

  const save = (next) => { setCfg(next); try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* */ } };

  const txQ = useQuery({ queryKey: ['tax-tx'], queryFn: () => Transaction.list() });
  const ccQ = useQuery({ queryKey: ['tax-cc'], queryFn: () => CreditCardTransaction.list() });
  const loading = txQ.isLoading || ccQ.isLoading;
  const erro = txQ.isError || ccQ.isError;

  // Gastos reais do mês (despesas positivas) -> base do consumo estimado
  const gastosPorMes = useMemo(() => {
    const all = combineExpenses(txQ.data || [], ccQ.data || []).filter((t) => t.type === 'expense' && Number(t.amount) > 0);
    const byMonth = {};
    for (const t of all) {
      const mk = String(t.date).slice(0, 7);
      (byMonth[mk] = byMonth[mk] || []).push({ valor: Number(t.amount), descricao: t.description, categoria: t.category_id });
    }
    return byMonth;
  }, [txQ.data, ccQ.data]);

  // Registros e resumo do mês atual
  const { records, resumo, rendaBruta } = useMemo(() => {
    const entrada = {
      ano, mes,
      salarioBruto: n(cfg.salarioBruto),
      dependentes: n(cfg.dependentes),
      deducoes: n(cfg.deducoes),
      inssConfirmado: cfg.inssConfirmado === '' ? undefined : n(cfg.inssConfirmado),
      irrfConfirmado: cfg.irrfConfirmado === '' ? undefined : n(cfg.irrfConfirmado),
      gastos: gastosPorMes[nowMk] || [],
      ipvaAnual: n(cfg.ipvaAnual),
      iptuAnual: n(cfg.iptuAnual),
    };
    const recs = buildTaxRecords(entrada);
    const rb = n(cfg.salarioBruto);
    return { records: recs, resumo: aggregate(recs, rb), rendaBruta: rb };
  }, [cfg, gastosPorMes, nowMk, ano, mes]);

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

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner className="w-8 h-8" /></div>;

  const cpfLabel = user?.cpf_set ? user.cpf_masked : 'CPF não cadastrado';

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Minha Carga Tributária</span>}
        subtitle="Quanto você paga (e estima pagar) em tributos por mês e por ano" />

      {/* Cabeçalho: mês, renda, CPF mascarado */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div><span className="text-muted">Mês</span><div className="font-semibold">{monthLabel(nowMk)}</div></div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div><span className="text-muted">Renda bruta</span><div className="font-semibold">{formatCurrency(rendaBruta)}</div></div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div><span className="text-muted flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> CPF</span><div className="font-semibold font-mono">{cpfLabel}</div></div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSourcesOpen(true)}><Plug className="w-4 h-4" /> Fontes</Button>
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
      <Modal open={sourcesOpen} onClose={() => setSourcesOpen(false)} title="Fontes conectadas">
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted">O Monvy nunca pede senha de banco ou do gov.br e não acessa portais protegidos. Integrações reais exigem consentimento explícito e podem ser revogadas a qualquer momento.</p>
          <SourceRow icon={Plug} name="Open Finance" desc="Consentimento para leitura de transações (padrão regulado)."
            connected={ofConnected} onToggle={() => setOfConnected((v) => !v)} mock />
          <SourceRow icon={Landmark} name="Receita Federal / SERPRO" desc="Integra Contador / Compartilha RFB — requer contrato e certificado." connected={false} disabled />
          <SourceRow icon={Wallet} name="Folha de pagamento" desc="Você informa os valores do holerite em 'Meus dados'." connected={n(cfg.inssConfirmado) > 0} manual />
          <SourceRow icon={Receipt} name="IBPT (consumo)" desc="Médias de referência para tributos embutidos em compras." connected manual />
        </div>
      </Modal>
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
