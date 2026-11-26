import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Investment, Debt } from '../api/entities.js';
import { Card, Button, Select, Input, Badge, Spinner } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { DEFAULT_TAX, calcAnual, calcMensal, calcRendaVariavel } from '../lib/tax.js';
import { Landmark, FileText, Calculator, CalendarClock, ClipboardList, Wallet, TrendingUp, Printer, Settings2, CheckCircle2, ArrowUpRight, LineChart, Paperclip, Layers, Home, Layers3, HeartPulse, BarChart3, PieChart, Briefcase, Gift, Award, MoreHorizontal, Info } from 'lucide-react';
import { Panel, Donut, DeltaChip } from '../components/kit.jsx';
import { TaxOfficialHeader } from '../components/incometax/TaxOfficialHeader.jsx';
import { TaxSummaryBar } from '../components/incometax/TaxSummaryBar.jsx';
import { TaxStepper } from '../components/incometax/TaxStepper.jsx';

const LS_KEY = 'monvy_tax_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* ignore */ } };

const DEDUCTIBLE = { saude: /saude|médico|medico|hospital|farmacia|farmácia|plano de saude|odonto|dentista/i, educacao: /educa|escola|faculdade|curso|mensalidade|universidade/i, previdencia: /previd|inss|pgbl/i };

const TABS = [
  { id: 'org', label: 'Organizador', icon: Layers, hint: 'Visão geral do ano' },
  { id: 'anual', label: 'Estimativa anual', icon: BarChart3, hint: 'Rendimentos e deduções' },
  { id: 'mensal', label: 'Carnê-Leão', icon: CalendarClock, hint: 'Autônomos (mensal)' },
  { id: 'rv', label: 'Renda variável', icon: LineChart, hint: 'Ações, FIIs, cripto' },
  { id: 'rel', label: 'Relatório', icon: FileText, hint: 'Para o contador' },
];

const PALETTE = ['#34d399', '#a855f7', '#38bdf8', '#f472b6', '#fbbf24', '#2dd4bf', '#fb7185'];
const srcIcon = (k) => /sal[aá]rio|pro.?labore/i.test(k) ? Briefcase : /b[oô]nus|prêmio|premio|plr/i.test(k) ? Award : /benef|vale|aux/i.test(k) ? Gift : /invest|dividend|juros|rend/i.test(k) ? TrendingUp : MoreHorizontal;

function Stat({ label, value, color = '', icon: Icon }) {
  return (
    <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 h-full">
      <p className="text-xs text-muted flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />}{label}</p>
      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
function Field({ label, value, onChange, prefix = 'R$', hint }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">{prefix}</span>}
        <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className={prefix ? 'pl-9' : ''} />
      </div>
      {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export default function IncomeTax() {
  const saved = load();
  const [tab, setTab] = useState('org');
  const [year, setYear] = useState(saved.year || new Date().getFullYear() - 1);
  const [cfg, setCfg] = useState({ ...DEFAULT_TAX, ...(saved.cfg || {}) });
  const [showCfg, setShowCfg] = useState(false);
  const [anual, setAnual] = useState(saved.anual || { tributavel: '', inss: '', dependentes: 0, saude: '', educacao: '', previdencia: '', pensao: '', outras: '' });
  const [mensal, setMensal] = useState(saved.mensal || { rendimento: '', inss: '', dependentes: 0, despesas: '' });
  const [rv, setRv] = useState(saved.rv || { acoesVendas: '', acoesGanho: '', acoesPrejuizo: '', daytradeGanho: '', daytradePrejuizo: '', fiiGanho: '', fiiPrejuizo: '', criptoVendas: '', criptoGanho: '' });

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => { save({ year, cfg, anual, mensal, rv }); }, [year, cfg, anual, mensal, rv]);

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy, cy - 1, cy - 2, cy - 3];
  }, []);

  // Consolidacao do ano
  const org = useMemo(() => {
    const yTx = transactions.filter((t) => String(t.date).slice(0, 4) === String(year));
    const rendimentos = yTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const rendPorCat = {};
    for (const t of yTx.filter((t) => t.type === 'income')) { const k = catMap[t.category_id]?.name || 'Outros rendimentos'; rendPorCat[k] = (rendPorCat[k] || 0) + Number(t.amount || 0); }
    const ded = { saude: 0, educacao: 0, previdencia: 0, outras: 0 };
    const dedTx = [];
    for (const t of yTx.filter((t) => t.type === 'expense')) {
      const cat = catMap[t.category_id];
      const marked = cat && cat.ir_deductible; // marcacao manual na categoria tem prioridade
      if (marked && ded[marked] != null) { ded[marked] += Number(t.amount || 0); dedTx.push({ ...t, bucket: marked }); continue; }
      if (marked) continue; // categoria explicitamente marcada como algo fora dos buckets
      const name = (cat?.name || '') + ' ' + (t.description || '');
      for (const k of Object.keys(DEDUCTIBLE)) if (DEDUCTIBLE[k].test(name)) { ded[k] += Number(t.amount || 0); dedTx.push({ ...t, bucket: k }); break; }
    }
    const comComprovante = dedTx.filter((t) => t.receipt_url).length;
    // ano anterior — só para a variação por fonte (nunca inventa: sem dado, sem variação)
    const pTx = transactions.filter((t) => t.type === 'income' && String(t.date).slice(0, 4) === String(year - 1));
    const rendPrev = pTx.reduce((s, t) => s + Number(t.amount || 0), 0);
    const rendPorCatPrev = {};
    for (const t of pTx) { const k = catMap[t.category_id]?.name || 'Outros rendimentos'; rendPorCatPrev[k] = (rendPorCatPrev[k] || 0) + Number(t.amount || 0); }
    const bens = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0) + investments.reduce((s, i) => s + Number(i.current_value || i.invested_amount || 0), 0);
    const dividas = debts.reduce((s, d) => { const rest = Number(d.installment_amount || 0) * Math.max(0, Number(d.installments || 0) - Number(d.paid_installments || 0)); return s + (rest || Number(d.total_amount || 0)); }, 0);
    return { rendimentos, rendPorCat, rendPrev, rendPorCatPrev, ded, dedTx, comComprovante, bens, dividas, contas: accounts, investimentos: investments, nDebts: debts.length };
  }, [transactions, accounts, investments, debts, catMap, year]);

  const rAnual = useMemo(() => calcAnual(anual, cfg), [anual, cfg]);
  const rMensal = useMemo(() => calcMensal(mensal, cfg), [mensal, cfg]);
  const rRv = useMemo(() => calcRendaVariavel(rv, cfg), [rv, cfg]);

  const usarDados = () => setAnual((a) => ({ ...a, tributavel: org.rendimentos.toFixed(2), saude: org.ded.saude.toFixed(2), educacao: org.ded.educacao.toFixed(2), previdencia: org.ded.previdencia.toFixed(2), outras: org.ded.outras.toFixed(2) }));
  const setCfgTabela = (key, i, field, val) => setCfg((c) => ({ ...c, [key]: c[key].map((f, j) => j === i ? { ...f, [field]: Number(val) } : f) }));

  // Indica, por secao, se ha dado real preenchido — usado so pra marcar o
  // "check" na barra de etapas, nunca inventa progresso.
  const anualFilled = Number(anual.tributavel) > 0;
  const stepFilled = useMemo(() => ({
    org: org.rendimentos > 0 || org.dedTx.length > 0,
    anual: anualFilled,
    mensal: Number(mensal.rendimento) > 0,
    rv: [rv.acoesVendas, rv.acoesGanho, rv.daytradeGanho, rv.fiiGanho, rv.criptoVendas, rv.criptoGanho].some((v) => Number(v) > 0),
    rel: org.rendimentos > 0 || org.bens > 0,
  }), [org, anualFilled, mensal.rendimento, rv]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <TaxOfficialHeader year={year} years={years} onYear={setYear} onToggleCfg={() => setShowCfg((v) => !v)} dataComplete={anualFilled} />

      <TaxSummaryBar org={org} rAnual={rAnual} anualFilled={anualFilled} />

      {showCfg && (
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Settings2 className="w-4 h-4 text-emerald-500" /> Configuração fiscal (editavel)</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {['anual', 'mensal'].map((key) => (
              <div key={key}>
                <p className="text-sm font-medium mb-2">Tabela {key === 'anual' ? 'anual (ajuste)' : 'mensal (carne-leao)'}</p>
                <div className="space-y-1.5">
                  {cfg[key].map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted w-6">{i + 1}</span>
                      <Input type="number" value={isFinite(f.até) ? f.até : ''} placeholder="acima" onChange={(e) => setCfgTabela(key, i, 'até', e.target.value || Infinity)} className="text-xs" />
                      <Input type="number" value={f.aliq} onChange={(e) => setCfgTabela(key, i, 'aliq', e.target.value)} className="text-xs w-16" />
                      <span className="text-muted">%</span>
                      <Input type="number" value={f.ded} onChange={(e) => setCfgTabela(key, i, 'ded', e.target.value)} className="text-xs" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1">colunas: até · aliquota % · parcela a deduzir</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Field label="Ded. dependente/ano" prefix="R$" value={cfg.deducaoDependenteAnual} onChange={(v) => setCfg((c) => ({ ...c, deducaoDependenteAnual: Number(v) }))} />
            <Field label="Ded. dependente/mês" prefix="R$" value={cfg.deducaoDependenteMensal} onChange={(v) => setCfg((c) => ({ ...c, deducaoDependenteMensal: Number(v) }))} />
            <Field label="Teto educacao/ano" prefix="R$" value={cfg.tetoEducacaoAnual} onChange={(v) => setCfg((c) => ({ ...c, tetoEducacaoAnual: Number(v) }))} />
            <Field label="Teto desc. simplificado" prefix="R$" value={cfg.descontoSimplificadoAnualTeto} onChange={(v) => setCfg((c) => ({ ...c, descontoSimplificadoAnualTeto: Number(v) }))} />
          </div>
          <Button variant="outline" className="mt-3" onClick={() => setCfg({ ...DEFAULT_TAX })}>Restaurar padrão</Button>
        </Card>
      )}

      <TaxStepper steps={TABS} active={tab} onChange={setTab} filled={stepFilled} />

      {tab === 'org' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: 'Rendimentos tributáveis', v: org.rendimentos, icon: Wallet, c: '#34d399', ring: 'ring-emerald-400/40', chip: org.rendPrev > 0 ? <DeltaChip v={((org.rendimentos - org.rendPrev) / org.rendPrev) * 100} /> : null },
              { l: 'Bens e direitos', v: org.bens, icon: Home, c: '#22d3ee', ring: 'ring-cyan-400/40', chip: <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-[hsl(var(--border))]">{org.contas.length + org.investimentos.length} itens</span> },
              { l: 'Dívidas e ônus', v: org.dividas, icon: Layers3, c: '#fb7185', ring: 'ring-rose-400/40', chip: <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-[hsl(var(--border))]">{org.nDebts} itens</span> },
              { l: 'Desp. dedutíveis', v: org.ded.saude + org.ded.educacao + org.ded.previdencia + org.ded.outras, icon: HeartPulse, c: '#c084fc', ring: 'ring-violet-400/40', chip: <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-[hsl(var(--border))]">{org.dedTx.length} itens</span> },
            ].map((k) => (
              <div key={k.l} className={`relative overflow-hidden rounded-2xl ring-1 ${k.ring} bg-[hsl(var(--card))] p-4`} style={{ backgroundImage: `linear-gradient(135deg,${k.c}26,transparent 70%)` }}>
                <svg className="absolute right-0 bottom-0 w-1/2 h-12 pointer-events-none opacity-50" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden><path d="M0 40 C30 34 50 16 100 6 L100 40 Z" fill={k.c} fillOpacity=".18" /></svg>
                <div className="relative flex items-start justify-between gap-2"><span className="flex items-center gap-2 text-sm font-semibold"><span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${k.c}26`, color: k.c }}><k.icon className="w-5 h-5" /></span>{k.l}</span>{k.chip}</div>
                <p className="relative font-display text-2xl font-bold mt-3" style={{ color: k.l === 'Bens e direitos' ? undefined : k.c }}>{formatCurrency(k.v)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <Panel className="xl:col-span-8" tone="emerald" title={`Rendimentos por fonte — ${year}`} subtitle="Composição dos seus rendimentos tributáveis no ano." icon={BarChart3} iconClass="text-emerald-400" action={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full ring-1 ring-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300">{Object.keys(org.rendPorCat).length} fonte(s)</span>}>
              {Object.keys(org.rendPorCat).length === 0 ? <p className="text-sm text-muted">Sem rendimentos lançados em {year}.</p> : (
                <>
                  <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                    <thead><tr className="text-xs text-muted text-left border-b border-[hsl(var(--border))]"><th className="py-2 font-medium">Fonte de rendimento</th><th className="py-2 font-medium text-right">Valor (R$)</th><th className="py-2 font-medium pl-6">Participação</th><th className="py-2 font-medium text-right">Variação (vs. {year - 1})</th></tr></thead>
                    <tbody>{Object.entries(org.rendPorCat).sort((a, b) => b[1] - a[1]).map(([k, v], i) => {
                      const share = org.rendimentos ? (v / org.rendimentos) * 100 : 0; const prev = org.rendPorCatPrev[k]; const Ic = srcIcon(k);
                      return (
                        <tr key={k} className="border-b border-[hsl(var(--border))] last:border-0">
                          <td className="py-2.5"><span className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: `${PALETTE[i % PALETTE.length]}26`, color: PALETTE[i % PALETTE.length] }}><Ic className="w-4 h-4" /></span>{k}</span></td>
                          <td className="py-2.5 text-right font-semibold">{formatCurrency(v)}</td>
                          <td className="py-2.5 pl-6"><span className="flex items-center gap-2"><span className="w-12 text-xs">{share.toFixed(1).replace('.', ',')}%</span><span className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden min-w-[90px]"><span className="block h-full rounded-full" style={{ width: `${share}%`, background: PALETTE[i % PALETTE.length], boxShadow: `0 0 8px ${PALETTE[i % PALETTE.length]}88` }} /></span></span></td>
                          <td className="py-2.5 text-right">{prev > 0 ? <DeltaChip v={((v - prev) / prev) * 100} /> : <span className="text-xs text-muted">{org.rendPrev > 0 ? 'nova fonte' : 'sem dado'}</span>}</td>
                        </tr>);
                    })}</tbody>
                  </table></div>
                  <div className="mt-3 rounded-2xl ring-1 ring-emerald-400/50 bg-emerald-500/10 px-4 py-3 flex items-center justify-between"><span className="font-semibold flex items-center gap-1.5">Total de rendimentos tributáveis <Info className="w-3.5 h-3.5 text-muted" title="Soma das receitas lançadas no ano" /></span><b className="font-display text-xl text-emerald-600 dark:text-emerald-300">{formatCurrency(org.rendimentos)}</b></div>
                </>
              )}
            </Panel>
            <Panel className="xl:col-span-4" tone="emerald" title="Composição dos rendimentos" subtitle={`Participação de cada fonte no total (${formatCurrency(org.rendimentos)}).`} icon={PieChart} iconClass="text-emerald-400">
              {(() => { const d = Object.entries(org.rendPorCat).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ name: k, value: v, color: PALETTE[i % PALETTE.length] })); return (
                <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-5">
                  <Donut size={190} thickness={0.22} data={d} center={<><b className="font-display text-base">{formatCurrency(org.rendimentos)}</b><span className="text-xs text-muted">Total</span></>} />
                  <div className="flex-1 w-full space-y-2">{d.length === 0 ? <p className="text-sm text-muted">Sem dados.</p> : d.map((x) => <p key={x.name} className="flex items-center gap-2 text-sm"><i className="w-3 h-3 rounded-full" style={{ background: x.color }} /><span className="flex-1 truncate">{x.name}</span><b>{org.rendimentos ? ((x.value / org.rendimentos) * 100).toFixed(1).replace('.', ',') : 0}%</b></p>)}</div>
                </div>); })()}
            </Panel>
          </div>

          <Panel tone="violet" title="Despesas dedutíveis identificadas" icon={HeartPulse} iconClass="text-violet-400">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[['Saúde', org.ded.saude], ['Educação', org.ded.educacao], ['Previdência', org.ded.previdencia], ['Outras', org.ded.outras]].map(([k, v]) => (
                <div key={k} className="rounded-xl ring-1 ring-[hsl(var(--border))] bg-black/[.03] dark:bg-white/[.03] py-3"><p className="text-xs text-muted">{k}</p><p className="font-semibold">{formatCurrency(v)}</p></div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Marque a dedutibilidade em <b>Categorias</b> (campo "Dedutível no IR") para precisão total; sem marcação, o Monvy estima por palavra-chave. Confira os comprovantes antes de declarar.</p>
          </Panel>
          {org.dedTx.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-semibold flex items-center gap-2"><Paperclip className="w-4 h-4 text-sky-500" /> Comprovantes das despesas dedutiveis</h3>
                <Badge color={org.comComprovante === org.dedTx.length ? 'emerald' : 'amber'}>{org.comComprovante}/{org.dedTx.length} anexados</Badge>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3"><div className="h-full rounded-full transition-all bg-sky-500" style={{ width: `${org.dedTx.length ? Math.round(org.comComprovante / org.dedTx.length * 100) : 0}%` }} /></div>
              <div className="divide-y divide-[hsl(var(--border))] max-h-72 overflow-y-auto">
                {org.dedTx.sort((a, b) => (a.receipt_url ? 1 : 0) - (b.receipt_url ? 1 : 0)).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="flex-1 min-w-0 truncate">{t.description || catMap[t.category_id]?.name || 'Despesa'} <span className="text-muted text-xs">· {new Date(String(t.date).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR')}</span></span>
                    <span className="font-medium shrink-0">{formatCurrency(t.amount)}</span>
                    {t.receipt_url
                      ? <button onClick={() => window.open(t.receipt_url, '_blank')} className="shrink-0 inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"><Paperclip className="w-3 h-3" /> ver</button>
                      : <Badge color="amber">sem comprovante</Badge>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">Anexe fotos/PDFs de notas e recibos ao editar cada lançamento. A Receita pode pedi-los na malha fina.</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'anual' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold">Dados do ano</h3>
              <Button size="sm" variant="outline" onClick={usarDados}><ClipboardList className="w-4 h-4" /> Preencher com meus dados de {year}</Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Rendimentos tributaveis" value={anual.tributavel} onChange={(v) => setAnual((a) => ({ ...a, tributavel: v }))} />
              <Field label="INSS / prev. oficial" value={anual.inss} onChange={(v) => setAnual((a) => ({ ...a, inss: v }))} />
              <Field label="Dependentes" prefix="" value={anual.dependentes} onChange={(v) => setAnual((a) => ({ ...a, dependentes: v }))} hint={`R$ ${cfg.deducaoDependenteAnual.toFixed(2)}/dependente`} />
              <Field label="Saúde" value={anual.saude} onChange={(v) => setAnual((a) => ({ ...a, saude: v }))} hint="sem limite" />
              <Field label="Educação" value={anual.educacao} onChange={(v) => setAnual((a) => ({ ...a, educacao: v }))} hint={`teto R$ ${cfg.tetoEducacaoAnual.toFixed(2)}/pessoa`} />
              <Field label="Previdência privada (PGBL)" value={anual.previdencia} onChange={(v) => setAnual((a) => ({ ...a, previdencia: v }))} />
              <Field label="Pensao alimenticia" value={anual.pensao} onChange={(v) => setAnual((a) => ({ ...a, pensao: v }))} />
              <Field label="Outras deduções" value={anual.outras} onChange={(v) => setAnual((a) => ({ ...a, outras: v }))} />
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            {[['simplificado', 'Simplificado', rAnual.simplificado], ['completo', 'Completo (por deduções)', rAnual.completo]].map(([id, label, r]) => (
              <Card key={id} className={rAnual.melhor === id ? 'ring-2 ring-emerald-500' : ''}>
                <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">{label}</h3>{rAnual.melhor === id && <Badge color="emerald"><CheckCircle2 className="w-3 h-3" /> Melhor</Badge>}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted"><span>{id === 'simplificado' ? 'Desconto (20%)' : 'Total deduções'}</span><span>{formatCurrency(id === 'simplificado' ? r.desconto : r.deduções)}</span></div>
                  <div className="flex justify-between"><span>Base de calculo</span><span className="font-medium">{formatCurrency(r.base)}</span></div>
                  <div className="flex justify-between text-muted"><span>Aliquota da faixa</span><span>{r.aliq}%</span></div>
                  <div className="flex justify-between text-base pt-1 border-t border-[hsl(var(--border))] mt-1"><span className="font-semibold">Imposto devido</span><span className="font-bold text-rose-500">{formatCurrency(r.imposto)}</span></div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="bg-emerald-500/5 border-emerald-500/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs text-muted">Melhor opção: <span className="font-semibold text-emerald-500">{rAnual.melhor}</span></p><p className="font-display text-2xl font-bold text-rose-500">{formatCurrency(rAnual.imposto)}</p><p className="text-xs text-muted">imposto devido no ano</p></div>
              <div className="text-right"><p className="text-xs text-muted">Aliquota efetiva</p><p className="font-display text-xl font-bold">{rAnual.aliquotaEfetiva.toFixed(2)}%</p><p className="text-xs text-emerald-500">economia vs. outra opção: {formatCurrency(rAnual.economia)}</p></div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'mensal' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-1">Carnê-Leão — apuracao mensal</h3>
            <p className="text-xs text-muted mb-3">Para quem recebe de pessoa fisica ou como autonomo. Recolhimento obrigatório até o último dia útil do mês seguinte (DARF codigo 0190).</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Rendimento do mês" value={mensal.rendimento} onChange={(v) => setMensal((m) => ({ ...m, rendimento: v }))} />
              <Field label="INSS recolhido" value={mensal.inss} onChange={(v) => setMensal((m) => ({ ...m, inss: v }))} />
              <Field label="Dependentes" prefix="" value={mensal.dependentes} onChange={(v) => setMensal((m) => ({ ...m, dependentes: v }))} hint={`R$ ${cfg.deducaoDependenteMensal.toFixed(2)}/dep.`} />
              <Field label="Despesas livro-caixa" value={mensal.despesas} onChange={(v) => setMensal((m) => ({ ...m, despesas: v }))} hint="só autonomos" />
            </div>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Base de calculo" value={formatCurrency(rMensal.base)} />
            <Stat label="Aliquota da faixa" value={`${rMensal.aliq}%`} />
            <Stat label="IR do mês (DARF)" value={formatCurrency(rMensal.imposto)} color="text-rose-500" />
            <Stat label="Aliquota efetiva" value={`${rMensal.aliquotaEfetiva.toFixed(2)}%`} />
          </div>
        </div>
      )}

      {tab === 'rv' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-1">Renda variavel — apuracao mensal</h3>
            <p className="text-xs text-muted mb-3">Informe os resultados do mês por tipo. DARF codigo 6015, até o último dia útil do mês seguinte. Prejuizos acumulados podem compensar ganhos do mêsmo tipo.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><LineChart className="w-4 h-4 text-emerald-500" /> Acoes (mercado a vista)</p>
                <Field label="Total de vendas no mês" value={rv.acoesVendas} onChange={(v) => setRv((s) => ({ ...s, acoesVendas: v }))} hint={`isento se <= R$ ${cfg.rv.tetoAcoesMensal.toLocaleString('pt-BR')}`} />
                <Field label="Ganho liquido" value={rv.acoesGanho} onChange={(v) => setRv((s) => ({ ...s, acoesGanho: v }))} />
                <Field label="Prejuizo acumulado a compensar" value={rv.acoesPrejuizo} onChange={(v) => setRv((s) => ({ ...s, acoesPrejuizo: v }))} />
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-rose-500" /> Day-trade ({cfg.rv.aliqDaytrade}%)</p>
                <Field label="Ganho liquido" value={rv.daytradeGanho} onChange={(v) => setRv((s) => ({ ...s, daytradeGanho: v }))} />
                <Field label="Prejuizo acumulado a compensar" value={rv.daytradePrejuizo} onChange={(v) => setRv((s) => ({ ...s, daytradePrejuizo: v }))} />
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-500" /> Fundos imobiliarios ({cfg.rv.aliqFII}%)</p>
                <Field label="Ganho liquido" value={rv.fiiGanho} onChange={(v) => setRv((s) => ({ ...s, fiiGanho: v }))} />
                <Field label="Prejuizo acumulado a compensar" value={rv.fiiPrejuizo} onChange={(v) => setRv((s) => ({ ...s, fiiPrejuizo: v }))} />
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-amber-500" /> Criptoativos</p>
                <Field label="Total de vendas no mês" value={rv.criptoVendas} onChange={(v) => setRv((s) => ({ ...s, criptoVendas: v }))} hint={`isento se <= R$ ${cfg.rv.tetoCriptoMensal.toLocaleString('pt-BR')}`} />
                <Field label="Ganho liquido" value={rv.criptoGanho} onChange={(v) => setRv((s) => ({ ...s, criptoGanho: v }))} />
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Imposto por tipo</h3>
            <div className="divide-y divide-[hsl(var(--border))]">
              {rRv.itens.map((it) => (
                <div key={it.chave} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">{it.label} <span className="text-muted">· {it.aliq}%</span></span>
                  {it.isento ? <Badge color="emerald">isento</Badge> : <span className="text-muted">base {formatCurrency(it.base)}</span>}
                  <span className="font-semibold text-rose-500 w-28 text-right">{formatCurrency(it.imposto)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/30">
            <div className="flex items-center justify-between"><div><p className="text-xs text-muted">DARF do mês (codigo 6015)</p><p className="font-display text-2xl font-bold text-rose-500">{formatCurrency(rRv.total)}</p></div><Badge color={rRv.total > 0 ? 'rose' : 'emerald'}>{rRv.total > 0 ? 'ha imposto a recolher' : 'nada a recolher'}</Badge></div>
          </Card>
        </div>
      )}

      {tab === 'rel' && (
        <div className="space-y-4">
          <Card className="flex items-center justify-between flex-wrap gap-3">
            <div><h3 className="font-semibold">Relatório consolidado {year}</h3><p className="text-xs text-muted">Rendimentos, bens e dividas para levar ao contador.</p></div>
            <Button onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir / Salvar PDF</Button>
          </Card>
          <Card id="tax-print">
            <h2 className="font-display text-xl font-bold mb-1">Resumo para o Imposto de Renda — {year}</h2>
            <p className="text-xs text-muted mb-4">Gerado pelo Monvy · valores conforme lançamentos do período</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Rendimentos" value={formatCurrency(org.rendimentos)} color="text-emerald-500" />
              <Stat label="Bens e direitos" value={formatCurrency(org.bens)} />
              <Stat label="Dívidas" value={formatCurrency(org.dividas)} color="text-rose-500" />
            </div>
            <h4 className="font-semibold mt-4 mb-1">Rendimentos por fonte</h4>
            <div className="divide-y divide-[hsl(var(--border))]">{Object.entries(org.rendPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (<div key={k} className="flex justify-between py-1.5 text-sm"><span>{k}</span><span className="font-medium">{formatCurrency(v)}</span></div>))}</div>
            <h4 className="font-semibold mt-4 mb-1">Contas e investimentos (bens)</h4>
            <div className="divide-y divide-[hsl(var(--border))]">
              {org.contas.map((a) => (<div key={a.id} className="flex justify-between py-1.5 text-sm"><span>{a.name}</span><span className="font-medium">{formatCurrency(a.current_balance || 0)}</span></div>))}
              {org.investimentos.map((i) => (<div key={i.id} className="flex justify-between py-1.5 text-sm"><span>{i.name} (investimento)</span><span className="font-medium">{formatCurrency(i.current_value || i.invested_amount || 0)}</span></div>))}
            </div>
            <h4 className="font-semibold mt-4 mb-1">Despesas dedutiveis</h4>
            <div className="divide-y divide-[hsl(var(--border))]">{[['Saúde', org.ded.saude], ['Educação', org.ded.educacao], ['Previdência', org.ded.previdencia], ['Outras', org.ded.outras]].map(([k, v]) => (<div key={k} className="flex justify-between py-1.5 text-sm"><span>{k}</span><span className="font-medium">{formatCurrency(v)}</span></div>))}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
