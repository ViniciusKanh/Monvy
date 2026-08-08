import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, Account, Category, Investment, Debt } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Input, Badge, Spinner } from '../components/ui';
import { formatCurrency } from '../lib/utils.js';
import { DEFAULT_TAX, calcAnual, calcMensal } from '../lib/tax.js';
import { Landmark, FileText, Calculator, CalendarClock, ClipboardList, Wallet, TrendingUp, Printer, Settings2, Info, CheckCircle2, ArrowUpRight } from 'lucide-react';

const LS_KEY = 'monvy_tax_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* ignore */ } };

const DEDUCTIBLE = { saude: /saude|médico|medico|hospital|farmacia|farmácia|plano de saude|odonto|dentista/i, educacao: /educa|escola|faculdade|curso|mensalidade|universidade/i, previdencia: /previd|inss|pgbl/i };

const TABS = [
  { id: 'org', label: 'Organizador', icon: ClipboardList },
  { id: 'anual', label: 'Estimativa anual', icon: Calculator },
  { id: 'mensal', label: 'Carnê-Leão', icon: CalendarClock },
  { id: 'rel', label: 'Relatório', icon: FileText },
];

function Stat({ label, value, color = '', icon: Icon }) {
  return (
    <Card className="py-4 hover-lift h-full">
      <p className="text-xs text-muted flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />}{label}</p>
      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
    </Card>
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

  const { data: transactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => Investment.list() });
  const { data: debts = [] } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => { save({ year, cfg, anual, mensal }); }, [year, cfg, anual, mensal]);

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
    for (const t of yTx.filter((t) => t.type === 'expense')) {
      const cat = catMap[t.category_id];
      const marked = cat && cat.ir_deductible; // marcacao manual na categoria tem prioridade
      if (marked && ded[marked] != null) { ded[marked] += Number(t.amount || 0); continue; }
      if (marked) continue; // categoria explicitamente marcada como algo fora dos buckets
      const name = (cat?.name || '') + ' ' + (t.description || '');
      for (const k of Object.keys(DEDUCTIBLE)) if (DEDUCTIBLE[k].test(name)) { ded[k] += Number(t.amount || 0); break; }
    }
    const bens = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0) + investments.reduce((s, i) => s + Number(i.current_value || i.invested_amount || 0), 0);
    const dividas = debts.reduce((s, d) => { const rest = Number(d.installment_amount || 0) * Math.max(0, Number(d.installments || 0) - Number(d.paid_installments || 0)); return s + (rest || Number(d.total_amount || 0)); }, 0);
    return { rendimentos, rendPorCat, ded, bens, dividas, contas: accounts, investimentos: investments };
  }, [transactions, accounts, investments, debts, catMap, year]);

  const rAnual = useMemo(() => calcAnual(anual, cfg), [anual, cfg]);
  const rMensal = useMemo(() => calcMensal(mensal, cfg), [mensal, cfg]);

  const usarDados = () => setAnual((a) => ({ ...a, tributavel: org.rendimentos.toFixed(2), saude: org.ded.saude.toFixed(2), educacao: org.ded.educacao.toFixed(2), previdencia: org.ded.previdencia.toFixed(2), outras: org.ded.outras.toFixed(2) }));
  const setCfgTabela = (key, i, field, val) => setCfg((c) => ({ ...c, [key]: c[key].map((f, j) => j === i ? { ...f, [field]: Number(val) } : f) }));

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8 text-emerald-500" /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-emerald-500" /> Imposto de Renda</span>}
        subtitle="Organize a declaracao, estime o imposto e apure o carne-leao — tudo com seus dados"
        actions={<div className="flex items-center gap-2">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">{years.map((y) => <option key={y} value={y}>Ano {y}</option>)}</Select>
          <Button variant="outline" onClick={() => setShowCfg((v) => !v)}><Settings2 className="w-4 h-4" /> Tabela</Button>
        </div>} />

      <Card className="py-3 bg-amber-500/5 border-amber-500/30">
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2"><Info className="w-4 h-4 shrink-0 mt-0.5" /> Ferramenta de apoio — nao substitui o programa oficial da Receita nem orientacao contabil. As tabelas usam a base 2024/2025; confira e ajuste em "Tabela" os valores vigentes do ano.</p>
      </Card>

      {showCfg && (
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Settings2 className="w-4 h-4 text-emerald-500" /> Configuracao fiscal (editavel)</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {['anual', 'mensal'].map((key) => (
              <div key={key}>
                <p className="text-sm font-medium mb-2">Tabela {key === 'anual' ? 'anual (ajuste)' : 'mensal (carne-leao)'}</p>
                <div className="space-y-1.5">
                  {cfg[key].map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted w-6">{i + 1}</span>
                      <Input type="number" value={isFinite(f.ate) ? f.ate : ''} placeholder="acima" onChange={(e) => setCfgTabela(key, i, 'ate', e.target.value || Infinity)} className="text-xs" />
                      <Input type="number" value={f.aliq} onChange={(e) => setCfgTabela(key, i, 'aliq', e.target.value)} className="text-xs w-16" />
                      <span className="text-muted">%</span>
                      <Input type="number" value={f.ded} onChange={(e) => setCfgTabela(key, i, 'ded', e.target.value)} className="text-xs" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1">colunas: ate · aliquota % · parcela a deduzir</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Field label="Ded. dependente/ano" prefix="R$" value={cfg.deducaoDependenteAnual} onChange={(v) => setCfg((c) => ({ ...c, deducaoDependenteAnual: Number(v) }))} />
            <Field label="Ded. dependente/mes" prefix="R$" value={cfg.deducaoDependenteMensal} onChange={(v) => setCfg((c) => ({ ...c, deducaoDependenteMensal: Number(v) }))} />
            <Field label="Teto educacao/ano" prefix="R$" value={cfg.tetoEducacaoAnual} onChange={(v) => setCfg((c) => ({ ...c, tetoEducacaoAnual: Number(v) }))} />
            <Field label="Teto desc. simplificado" prefix="R$" value={cfg.descontoSimplificadoAnualTeto} onChange={(v) => setCfg((c) => ({ ...c, descontoSimplificadoAnualTeto: Number(v) }))} />
          </div>
          <Button variant="outline" className="mt-3" onClick={() => setCfg({ ...DEFAULT_TAX })}>Restaurar padrao</Button>
        </Card>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 overflow-x-auto">
        {TABS.map((t) => { const Icon = t.icon; return (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.id ? 'bg-white dark:bg-neutral-800 shadow text-emerald-600 dark:text-emerald-400' : 'text-muted hover:text-current'}`}>
            <Icon className="w-4 h-4" /> {t.label}
          </button>
        ); })}
      </div>

      {tab === 'org' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Rendimentos tributaveis" value={formatCurrency(org.rendimentos)} color="text-emerald-500" icon={ArrowUpRight} />
            <Stat label="Bens e direitos" value={formatCurrency(org.bens)} icon={Wallet} />
            <Stat label="Dividas e onus" value={formatCurrency(org.dividas)} color="text-rose-500" icon={Landmark} />
            <Stat label="Desp. dedutiveis" value={formatCurrency(org.ded.saude + org.ded.educacao + org.ded.previdencia + org.ded.outras)} color="text-indigo-500" icon={TrendingUp} />
          </div>
          <Card>
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Rendimentos por fonte — {year}</h3><Badge color="emerald">{Object.keys(org.rendPorCat).length} fonte(s)</Badge></div>
            {Object.keys(org.rendPorCat).length === 0 ? <p className="text-sm text-muted">Sem rendimentos lancados em {year}.</p> :
              <div className="divide-y divide-[hsl(var(--border))]">{Object.entries(org.rendPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 text-sm"><span>{k}</span><span className="font-semibold text-emerald-500">{formatCurrency(v)}</span></div>
              ))}</div>}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Despesas dedutiveis identificadas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[['Saude', org.ded.saude], ['Educacao', org.ded.educacao], ['Previdencia', org.ded.previdencia], ['Outras', org.ded.outras]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-black/5 dark:bg-white/5 py-3"><p className="text-xs text-muted">{k}</p><p className="font-semibold">{formatCurrency(v)}</p></div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Marque a dedutibilidade em <b>Categorias</b> (campo "Dedutivel no IR") para precisao total; sem marcacao, o Monvy estima por palavra-chave. Confira os comprovantes antes de declarar.</p>
          </Card>
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
              <Field label="Saude" value={anual.saude} onChange={(v) => setAnual((a) => ({ ...a, saude: v }))} hint="sem limite" />
              <Field label="Educacao" value={anual.educacao} onChange={(v) => setAnual((a) => ({ ...a, educacao: v }))} hint={`teto R$ ${cfg.tetoEducacaoAnual.toFixed(2)}/pessoa`} />
              <Field label="Previdencia privada (PGBL)" value={anual.previdencia} onChange={(v) => setAnual((a) => ({ ...a, previdencia: v }))} />
              <Field label="Pensao alimenticia" value={anual.pensao} onChange={(v) => setAnual((a) => ({ ...a, pensao: v }))} />
              <Field label="Outras deducoes" value={anual.outras} onChange={(v) => setAnual((a) => ({ ...a, outras: v }))} />
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            {[['simplificado', 'Simplificado', rAnual.simplificado], ['completo', 'Completo (por deducoes)', rAnual.completo]].map(([id, label, r]) => (
              <Card key={id} className={rAnual.melhor === id ? 'ring-2 ring-emerald-500' : ''}>
                <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">{label}</h3>{rAnual.melhor === id && <Badge color="emerald"><CheckCircle2 className="w-3 h-3" /> Melhor</Badge>}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted"><span>{id === 'simplificado' ? 'Desconto (20%)' : 'Total deducoes'}</span><span>{formatCurrency(id === 'simplificado' ? r.desconto : r.deducoes)}</span></div>
                  <div className="flex justify-between"><span>Base de calculo</span><span className="font-medium">{formatCurrency(r.base)}</span></div>
                  <div className="flex justify-between text-muted"><span>Aliquota da faixa</span><span>{r.aliq}%</span></div>
                  <div className="flex justify-between text-base pt-1 border-t border-[hsl(var(--border))] mt-1"><span className="font-semibold">Imposto devido</span><span className="font-bold text-rose-500">{formatCurrency(r.imposto)}</span></div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="bg-emerald-500/5 border-emerald-500/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs text-muted">Melhor opcao: <span className="font-semibold text-emerald-500">{rAnual.melhor}</span></p><p className="font-display text-2xl font-bold text-rose-500">{formatCurrency(rAnual.imposto)}</p><p className="text-xs text-muted">imposto devido no ano</p></div>
              <div className="text-right"><p className="text-xs text-muted">Aliquota efetiva</p><p className="font-display text-xl font-bold">{rAnual.aliquotaEfetiva.toFixed(2)}%</p><p className="text-xs text-emerald-500">economia vs. outra opcao: {formatCurrency(rAnual.economia)}</p></div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'mensal' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-1">Carnê-Leão — apuracao mensal</h3>
            <p className="text-xs text-muted mb-3">Para quem recebe de pessoa fisica ou como autonomo. Recolhimento obrigatorio ate o ultimo dia util do mes seguinte (DARF codigo 0190).</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Rendimento do mes" value={mensal.rendimento} onChange={(v) => setMensal((m) => ({ ...m, rendimento: v }))} />
              <Field label="INSS recolhido" value={mensal.inss} onChange={(v) => setMensal((m) => ({ ...m, inss: v }))} />
              <Field label="Dependentes" prefix="" value={mensal.dependentes} onChange={(v) => setMensal((m) => ({ ...m, dependentes: v }))} hint={`R$ ${cfg.deducaoDependenteMensal.toFixed(2)}/dep.`} />
              <Field label="Despesas livro-caixa" value={mensal.despesas} onChange={(v) => setMensal((m) => ({ ...m, despesas: v }))} hint="so autonomos" />
            </div>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Base de calculo" value={formatCurrency(rMensal.base)} />
            <Stat label="Aliquota da faixa" value={`${rMensal.aliq}%`} />
            <Stat label="IR do mes (DARF)" value={formatCurrency(rMensal.imposto)} color="text-rose-500" />
            <Stat label="Aliquota efetiva" value={`${rMensal.aliquotaEfetiva.toFixed(2)}%`} />
          </div>
        </div>
      )}

      {tab === 'rel' && (
        <div className="space-y-4">
          <Card className="flex items-center justify-between flex-wrap gap-3">
            <div><h3 className="font-semibold">Relatorio consolidado {year}</h3><p className="text-xs text-muted">Rendimentos, bens e dividas para levar ao contador.</p></div>
            <Button onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir / Salvar PDF</Button>
          </Card>
          <Card id="tax-print">
            <h2 className="font-display text-xl font-bold mb-1">Resumo para o Imposto de Renda — {year}</h2>
            <p className="text-xs text-muted mb-4">Gerado pelo Monvy · valores conforme lancamentos do periodo</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Rendimentos" value={formatCurrency(org.rendimentos)} color="text-emerald-500" />
              <Stat label="Bens e direitos" value={formatCurrency(org.bens)} />
              <Stat label="Dividas" value={formatCurrency(org.dividas)} color="text-rose-500" />
            </div>
            <h4 className="font-semibold mt-4 mb-1">Rendimentos por fonte</h4>
            <div className="divide-y divide-[hsl(var(--border))]">{Object.entries(org.rendPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (<div key={k} className="flex justify-between py-1.5 text-sm"><span>{k}</span><span className="font-medium">{formatCurrency(v)}</span></div>))}</div>
            <h4 className="font-semibold mt-4 mb-1">Contas e investimentos (bens)</h4>
            <div className="divide-y divide-[hsl(var(--border))]">
              {org.contas.map((a) => (<div key={a.id} className="flex justify-between py-1.5 text-sm"><span>{a.name}</span><span className="font-medium">{formatCurrency(a.current_balance || 0)}</span></div>))}
              {org.investimentos.map((i) => (<div key={i.id} className="flex justify-between py-1.5 text-sm"><span>{i.name} (investimento)</span><span className="font-medium">{formatCurrency(i.current_value || i.invested_amount || 0)}</span></div>))}
            </div>
            <h4 className="font-semibold mt-4 mb-1">Despesas dedutiveis</h4>
            <div className="divide-y divide-[hsl(var(--border))]">{[['Saude', org.ded.saude], ['Educacao', org.ded.educacao], ['Previdencia', org.ded.previdencia], ['Outras', org.ded.outras]].map(([k, v]) => (<div key={k} className="flex justify-between py-1.5 text-sm"><span>{k}</span><span className="font-medium">{formatCurrency(v)}</span></div>))}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
