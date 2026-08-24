import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Debt, BankRate, Transaction } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Select, Field, Modal, Spinner, EmptyState, Badge, Textarea } from '../components/ui';
import { Reveal, AnimatedValue } from '../components/Animated.jsx';
import { LoadingScreen } from '../components/Splash.jsx';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { analyzeCredit, subtiposDe, rulesFor, STATUS_META, INDEXERS, toMonthly, effectiveMonthly, BANK_PRESETS } from '../lib/credit.js';
import { fetchMarketRate, amToAa } from '../lib/bcbRates.js';
import { Landmark, Plus, Pencil, Trash2, CheckCircle2, Table, Zap, Calculator, Building2, Download, XCircle, AlertTriangle, Gauge, ScrollText, Wallet, Sparkles } from 'lucide-react';

const TYPES = [
  { v: 'emprestimo', label: 'Empréstimo' },
  { v: 'financiamento', label: 'Financiamento' },
  { v: 'consorcio', label: 'Consórcio' },
  { v: 'cartao', label: 'Parcelamento de cartão' },
  { v: 'outro', label: 'Outro' },
];
const tLabel = (v) => (TYPES.find((t) => t.v === v) || TYPES[0]).label;
const priceInstallment = (P, iPct, n) => { const i = Number(iPct) / 100; if (!P || !n) return 0; if (i === 0) return P / n; return (P * i) / (1 - Math.pow(1 + i, -n)); };
const balanceAfter = (inst, iPct, remaining) => { const i = Number(iPct) / 100; if (remaining <= 0) return 0; if (i === 0) return inst * remaining; return inst * (1 - Math.pow(1 + i, -remaining)) / i; };
const empty = { name: '', type: 'financiamento', principal: '', interest_rate: '1.5', installments: '12', paid_installments: '0', start_date: todayIso(), due_day: '10', institution: '' };

const KINDS = [
  { v: 'imovel', label: 'Financiamento imobiliário' },
  { v: 'veiculo', label: 'Financiamento de veículo' },
  { v: 'pessoal', label: 'Empréstimo pessoal' },
  { v: 'consignado', label: 'Empréstimo consignado' },
];
const LS_SIM = 'monvy_credit_sim_v1';
const loadSim = () => { try { return JSON.parse(localStorage.getItem(LS_SIM) || 'null'); } catch { return null; } };

export default function Debts() {
  const qc = useQueryClient();
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['debts'], queryFn: () => Debt.list() });
  const { data: banks = [] } = useQuery({ queryKey: ['bankrates'], queryFn: () => BankRate.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const [tab, setTab] = useState('lista');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [schedule, setSchedule] = useState(null);

  const inval = () => qc.invalidateQueries({ queryKey: ['debts'] });
  const save = useMutation({ mutationFn: (p) => editing ? Debt.update(editing.id, p) : Debt.create(p), onSuccess: () => { inval(); setModal(false); } });
  const del = useMutation({ mutationFn: (id) => Debt.remove(id), onSuccess: inval });
  const pay = useMutation({ mutationFn: ({ d }) => Debt.update(d.id, { paid_installments: Math.min(Number(d.installments || 1), Number(d.paid_installments || 0) + 1) }), onSuccess: () => { inval(); toast.success('Parcela registrada'); } });

  const withCalc = useMemo(() => debts.map((d) => {
    const inst = Number(d.installment_amount || priceInstallment(Number(d.principal || d.total_amount || 0), d.interest_rate, Number(d.installments || 1)));
    const n = Number(d.installments || 1); const paid = Number(d.paid_installments || 0); const remaining = Math.max(0, n - paid);
    const balance = balanceAfter(inst, d.interest_rate, remaining);
    const total = inst * n; const interestTotal = total - Number(d.principal || d.total_amount || 0);
    return { ...d, inst, n, paid, remaining, balance, total, interestTotal, pct: n ? Math.round((paid / n) * 100) : 0 };
  }), [debts]);

  const totalOwed = withCalc.reduce((s, d) => s + d.balance, 0);
  const monthly = withCalc.filter((d) => d.remaining > 0).reduce((s, d) => s + d.inst, 0);
  const interestAll = withCalc.reduce((s, d) => s + Math.max(0, d.interestTotal), 0);

  // renda mensal estimada (mediana das receitas por mês)
  const rendaEstimada = useMemo(() => {
    const byMonth = {};
    for (const t of transactions) if (t.type === 'income') { const m = String(t.date).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + Number(t.amount || 0); }
    const vals = Object.values(byMonth).sort((a, b) => a - b);
    if (!vals.length) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }, [transactions]);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, type: d.type, principal: d.principal ?? d.total_amount ?? '', interest_rate: d.interest_rate ?? '0', installments: d.installments ?? '12', paid_installments: d.paid_installments ?? '0', start_date: (d.start_date || todayIso()).slice(0, 10), due_day: d.due_day ?? '10', institution: d.institution || '' }); setModal(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const formInst = priceInstallment(Number(form.principal || 0), form.interest_rate, Number(form.installments || 1));
  const submit = (e) => {
    e.preventDefault();
    const principal = Number(form.principal || 0); const n = Number(form.installments || 1);
    const inst = priceInstallment(principal, form.interest_rate, n);
    save.mutate({ name: form.name, type: form.type, principal, total_amount: inst * n, interest_rate: Number(form.interest_rate || 0), installments: n, paid_installments: Number(form.paid_installments || 0), installment_amount: inst, start_date: form.start_date, due_day: Number(form.due_day || 10), institution: form.institution });
  };

  const buildSchedule = (d) => {
    const rows = []; let bal = Number(d.principal || d.total_amount || 0); const i = Number(d.interest_rate) / 100;
    for (let k = 1; k <= d.n; k++) { const juros = bal * i; const amort = d.inst - juros; bal = Math.max(0, bal - amort); rows.push({ k, juros, amort, saldo: bal, paga: k <= d.paid }); }
    setSchedule({ name: d.name, inst: d.inst, rows });
  };

  if (isLoading) return <LoadingScreen label="Carregando suas dividas e simulacoes..." />;

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><Landmark className="w-6 h-6 text-rose-500" /> Dívidas & Crédito</span>}
        subtitle="Controle o que deve e simule se um financiamento ou emprestimo cabe no seu bolso"
        actions={tab === 'lista' && <Button onClick={openNew}><Plus className="w-4 h-4" /> Nova divida</Button>} />

      <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 w-fit">
        {[['lista', 'Minhas dividas', Landmark], ['sim', 'Simulador de crédito', Calculator]].map(([id, label, Ic]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === id ? 'bg-white dark:bg-neutral-800 shadow text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}><Ic className="w-4 h-4" /> {label}</button>
        ))}
      </div>

      {tab === 'lista' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Reveal i={0}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Saldo devedor total</p><p className="font-display text-2xl font-bold text-rose-500"><AnimatedValue value={totalOwed} format={formatCurrency} /></p></Card></Reveal>
          <Reveal i={1}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Comprometido/mês</p><p className="font-display text-2xl font-bold text-amber-500"><AnimatedValue value={monthly} format={formatCurrency} /></p></Card></Reveal>
          <Reveal i={2}><Card className="py-4 hover-lift"><p className="text-xs text-muted">Juros totais (contratos)</p><p className="font-display text-2xl font-bold"><AnimatedValue value={interestAll} format={formatCurrency} /></p></Card></Reveal>
        </div>

        {debts.length === 0 ? <Card><EmptyState icon={Landmark} title="Nenhuma divida" subtitle="Cadastre emprestimos e financiamentos para acompanhar o quanto falta pagar." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Nova divida</Button>} /></Card>
          : (
            <div className="grid md:grid-cols-2 gap-4">
              {withCalc.map((d, idx) => (
                <Reveal key={d.id} i={Math.min(idx, 8)}>
                  <Card className="hover-lift h-full">
                    <div className="flex items-start justify-between">
                      <div><p className="font-semibold">{d.name}</p><p className="text-xs text-muted">{tLabel(d.type)}{d.institution ? ` · ${d.institution}` : ''}</p></div>
                      <div className="flex gap-1">
                        <button onClick={() => buildSchedule(d)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Tabela de amortizacao"><Table className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del.mutate(d.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div><p className="text-[11px] text-muted">Saldo devedor</p><p className="font-bold text-rose-500">{formatCurrency(d.balance)}</p></div>
                      <div><p className="text-[11px] text-muted">Parcela</p><p className="font-bold">{formatCurrency(d.inst)}/mês</p></div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted">{d.paid} de {d.n} parcelas</span><span className="text-muted">{d.pct}%</span></div>
                      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.pct}%` }} /></div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[11px] text-muted">Juros {Number(d.interest_rate).toFixed(2)}% a.m. · quita em {d.remaining} mes(es)</span>
                      {d.remaining > 0 && <Button size="sm" variant="outline" className="ml-auto" onClick={() => pay.mutate({ d })}><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Paguei 1 parcela</Button>}
                      {d.remaining === 0 && <Badge color="emerald" className="ml-auto"><CheckCircle2 className="w-3 h-3" /> Quitada</Badge>}
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          )}
      </>)}

      {tab === 'sim' && <CreditSimulator banks={banks} rendaEstimada={rendaEstimada} outrasParcelas={monthly} qc={qc} />}

      {/* Modal cadastro divida */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar divida' : 'Nova divida'} maxWidth="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Financiamento carro" /></Field>
            <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor financiado (R$)"><Input type="number" step="0.01" value={form.principal} onChange={(e) => set('principal', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Juros (% a.m.)"><Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => set('interest_rate', e.target.value)} /></Field>
            <Field label="Parcelas"><Input type="number" value={form.installments} onChange={(e) => set('installments', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Parcelas pagas"><Input type="number" value={form.paid_installments} onChange={(e) => set('paid_installments', e.target.value)} /></Field>
            <Field label="Dia vencimento"><Input type="number" value={form.due_day} onChange={(e) => set('due_day', e.target.value)} /></Field>
            <Field label="Instituição"><Input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Banco" /></Field>
          </div>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" /> Parcela estimada (Tabela Price): <b>{formatCurrency(formInst)}/mês</b> · total {formatCurrency(formInst * Number(form.installments || 0))}
          </div>
        </form>
      </Modal>

      {/* Modal tabela de amortizacao */}
      {schedule && (
        <Modal open onClose={() => setSchedule(null)} title={`Amortizacao — ${schedule.name}`} maxWidth="max-w-lg"
          footer={<Button onClick={() => setSchedule(null)}>Fechar</Button>}>
          <p className="text-sm text-muted mb-2">Parcela fixa de <b className="text-[hsl(var(--text))]">{formatCurrency(schedule.inst)}</b> (Tabela Price).</p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]"><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5">#</th><th className="py-1.5 text-right">Juros</th><th className="py-1.5 text-right">Amortizacao</th><th className="py-1.5 text-right">Saldo</th></tr></thead>
              <tbody>{schedule.rows.map((r) => (
                <tr key={r.k} className={`border-b border-[hsl(var(--border))] last:border-0 ${r.paga ? 'opacity-50' : ''}`}>
                  <td className="py-1.5">{r.k}{r.paga ? ' ✓' : ''}</td>
                  <td className="py-1.5 text-right text-rose-500">{formatCurrency(r.juros)}</td>
                  <td className="py-1.5 text-right text-emerald-500">{formatCurrency(r.amort)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(r.saldo)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreditSimulator({ banks, rendaEstimada, outrasParcelas, qc }) {
  const saved = loadSim();
  const DEFAULTS = { tipo: 'imovel', subtipo: 'novo', valorBem: '', entrada: '', valorEmprestimo: '', prazo: '360', taxaMes: '0.9', indexer: 'prefixado', indexerAnnual: '', sistema: 'price', rendaMensal: rendaEstimada ? String(Math.round(rendaEstimada)) : '', outrasParcelas: outrasParcelas ? outrasParcelas.toFixed(2) : '', idadeAnos: '', idadeVeiculoAnos: '', fgts: '', ltvOverride: '', prazoMaxOverride: '', bankName: '' };
  const [f, setF] = useState({ ...DEFAULTS, ...(saved || {}), indexer: (saved && INDEXERS[saved.indexer]) ? saved.indexer : 'prefixado' });
  const [bankModal, setBankModal] = useState(false);
  const [fetching, setFetching] = useState(false);
  const set = (k, v) => setF((s) => { const next = { ...s, [k]: v }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; });
  const setTipo = (tipo) => { const subs = subtiposDe(tipo); setF((s) => { const next = { ...s, tipo, subtipo: subs[0]?.key || '', ltvOverride: '', prazoMaxOverride: '', bankName: '' }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; }); };

  const isFin = f.tipo === 'imovel' || f.tipo === 'veiculo';
  const subs = subtiposDe(f.tipo);
  const rules = rulesFor(f.tipo, f.subtipo);
  const kindBanks = banks.filter((b) => (b.kind || 'imovel') === f.tipo);

  // taxa efetiva = juros base (a.m.) combinado com o indexador (correcao estimada)
  const idxAnnualDefault = INDEXERS[f.indexer]?.defaultAnnual ?? 0;
  const idxAnnual = (f.indexerAnnual === '' || f.indexerAnnual == null) ? idxAnnualDefault : Number(f.indexerAnnual);
  const idxM = f.indexer !== 'prefixado' && idxAnnual > 0 ? (Math.pow(1 + idxAnnual / 100, 1 / 12) - 1) * 100 : 0;
  const baseM = Number(f.taxaMes) || 0;
  const effM = ((1 + baseM / 100) * (1 + idxM / 100) - 1) * 100;

  const res = useMemo(() => analyzeCredit({
    tipo: f.tipo, subtipo: f.subtipo, valorBem: f.valorBem, entrada: f.entrada, valorEmprestimo: f.valorEmprestimo,
    prazo: f.prazo, taxaMes: effM, sistema: f.sistema, rendaMensal: f.rendaMensal, outrasParcelas: f.outrasParcelas,
    idadeAnos: f.idadeAnos, idadeVeiculoAnos: f.idadeVeiculoAnos, fgts: f.fgts,
    ltvOverride: f.ltvOverride ? Number(f.ltvOverride) / 100 : null, prazoMaxOverride: f.prazoMaxOverride || null, bankName: f.bankName,
  }), [f, effM]);

  const meta = STATUS_META[res.status];

  const buscarTaxa = async () => {
    setFetching(true);
    try { const r = await fetchMarketRate(f.tipo); set('taxaMes', r.am.toFixed(2)); toast.success(r.source === 'bcb' ? `Taxa media do BCB: ${r.aa.toFixed(1)}% a.a.` : 'Usei uma taxa de referência (BCB indisponível).'); }
    catch { toast.error('Nao consegui buscar a taxa agora.'); } finally { setFetching(false); }
  };
  const usarTaxaTipica = () => { if (rules.taxaTipicaAm) { set('taxaMes', Number(rules.taxaTipicaAm).toFixed(2)); toast.success('Taxa tipica aplicada. Ajuste conforme sua proposta.'); } };
  const pickBank = (id) => {
    const b = kindBanks.find((x) => x.id === id); if (!b) return;
    const rm = b.base_rate != null && b.base_rate !== '' ? toMonthly(Number(b.base_rate), b.periodicity || 'anual') : Number(b.rate_month || 0);
    setF((s) => { const next = { ...s, taxaMes: rm.toFixed(3), indexer: b.indexer || 'prefixado', indexerAnnual: '', sistema: (b.system && b.system !== 'ambos') ? b.system : s.sistema, ltvOverride: b.max_ltv ? String(b.max_ltv) : '', prazoMaxOverride: b.prazo_max ? String(b.prazo_max) : '', bankName: b.name }; try { localStorage.setItem(LS_SIM, JSON.stringify(next)); } catch { /* */ } return next; });
    toast.success(`Condições de ${b.name} aplicadas.`);
  };
  const clearBank = () => setF((s) => ({ ...s, ltvOverride: '', prazoMaxOverride: '', bankName: '' }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-500" /> Simular crédito</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={buscarTaxa} disabled={fetching}>{fetching ? <Spinner className="w-4 h-4" /> : <><Download className="w-4 h-4" /> Taxa media (BCB)</>}</Button>
            <Button size="sm" variant="outline" onClick={() => setBankModal(true)}><Building2 className="w-4 h-4" /> Bancos</Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Tipo de crédito"><Select value={f.tipo} onChange={(e) => setTipo(e.target.value)}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select></Field>
          {subs.length > 0 && <Field label="Modalidade"><Select value={f.subtipo} onChange={(e) => set('subtipo', e.target.value)}>{subs.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>}
          {kindBanks.length > 0 && <Field label="Banco cadastrado"><Select defaultValue="" onChange={(e) => pickBank(e.target.value)}><option value="">Escolher taxa...</option>{kindBanks.map((b) => <option key={b.id} value={b.id}>{b.name} — {Number(b.rate_month).toFixed(2)}% a.m.</option>)}</Select></Field>}
          {isFin ? (<>
            <Field label="Valor do bem (R$)"><Input type="number" value={f.valorBem} onChange={(e) => set('valorBem', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Entrada (R$)"><Input type="number" value={f.entrada} onChange={(e) => set('entrada', e.target.value)} placeholder="0,00" /></Field>
          </>) : (
            <Field label="Valor do emprestimo (R$)"><Input type="number" value={f.valorEmprestimo} onChange={(e) => set('valorEmprestimo', e.target.value)} placeholder="0,00" /></Field>
          )}
          {f.tipo === 'imovel' && <Field label="Usar FGTS (R$)"><Input type="number" value={f.fgts} onChange={(e) => set('fgts', e.target.value)} placeholder="0,00" /></Field>}
          <Field label="Prazo (meses)"><Input type="number" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Field>
          <Field label="Juros base (% a.m.)"><Input type="number" step="0.001" value={f.taxaMes} onChange={(e) => set('taxaMes', e.target.value)} /></Field>
          <Field label="Indexador"><Select value={f.indexer} onChange={(e) => set('indexer', e.target.value)}>{Object.entries(INDEXERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          {f.indexer !== 'prefixado' && <Field label={`${INDEXERS[f.indexer]?.label || 'Indexador'} estimado (% a.a.)`}><Input type="number" step="0.01" value={f.indexerAnnual} onChange={(e) => set('indexerAnnual', e.target.value)} placeholder={String(idxAnnualDefault)} /></Field>}
          <Field label="Sistema"><Select value={f.sistema} onChange={(e) => set('sistema', e.target.value)}><option value="price">Price (parcela fixa)</option><option value="sac">SAC (parcela decrescente)</option></Select></Field>
          <Field label="Sua renda mensal (R$)"><Input type="number" value={f.rendaMensal} onChange={(e) => set('rendaMensal', e.target.value)} placeholder="0,00" /></Field>
          <Field label="Outras parcelas/mês (R$)"><Input type="number" value={f.outrasParcelas} onChange={(e) => set('outrasParcelas', e.target.value)} placeholder="0,00" /></Field>
          {f.tipo === 'imovel' && <Field label="Sua idade (anos)"><Input type="number" value={f.idadeAnos} onChange={(e) => set('idadeAnos', e.target.value)} placeholder="ex: 35" /></Field>}
          {f.tipo === 'veiculo' && f.subtipo === 'usado' && <Field label="Idade do veículo (anos)"><Input type="number" value={f.idadeVeiculoAnos} onChange={(e) => set('idadeVeiculoAnos', e.target.value)} placeholder="ex: 5" /></Field>}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {f.taxaMes && <span className="text-xs text-muted">Juros {baseM.toFixed(3)}% a.m.{f.indexer !== 'prefixado' ? ` + ${INDEXERS[f.indexer]?.label || 'indexador'} ~${idxM.toFixed(3)}% a.m.` : ''} → <b className="text-[hsl(var(--text))]">efetiva ~{effM.toFixed(3)}% a.m.</b> (~{amToAa(effM).toFixed(1)}% a.a.)</span>}
          {rules.taxaTipicaAm ? <button onClick={usarTaxaTipica} className="text-xs font-medium text-emerald-600 hover:underline">usar taxa tipica ({Number(rules.taxaTipicaAm).toFixed(2)}% a.m.)</button> : null}
        </div>
        {f.bankName && <div className="mt-2 flex items-center gap-2 text-xs"><Badge color="emerald"><Building2 className="w-3 h-3" /> {f.bankName}</Badge><span className="text-muted">LTV {f.ltvOverride || rules.ltvMax * 100}% · prazo max {f.prazoMaxOverride || rules.prazoMaxMeses}m</span><button onClick={clearBank} className="text-rose-500 hover:underline">remover</button></div>}
        {f.indexer === 'IPCA' && <p className="text-[11px] text-muted mt-1">No IPCA o saldo devedor e corrigido pela inflacao a cada mes; a parcela não e fixa de verdade — aqui usamos uma estimativa com o IPCA informado.</p>}
      </Card>

      {/* VEREDITO ESTILIZADO */}
      <div className="rounded-2xl p-5 text-white shadow-lg relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
        <div className="absolute -right-6 -top-6 opacity-20"><Gauge className="w-32 h-32" /></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90"><span className="text-lg">{meta.emoji}</span> Análise de aprovação — {rules.tipoLabel}{f.subtipo ? ` · ${(subs.find((s) => s.key === f.subtipo) || {}).label || ''}` : ''}</div>
          <p className="font-display text-3xl font-bold mt-1">{meta.label}</p>
          <p className="text-sm opacity-90 mt-1">{meta.hint}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><p className="text-xs opacity-80">Chance (score)</p><p className="font-bold text-xl">{res.score}/100</p></div>
            <div><p className="text-xs opacity-80">Parcela {res.sistema === 'sac' ? '(1a, maior)' : 'fixa'}</p><p className="font-bold text-xl">{formatCurrency(res.parcela)}</p></div>
            <div><p className="text-xs opacity-80">Comprometimento</p><p className="font-bold text-xl">{isFinite(res.comprometimento) ? (res.comprometimento * 100).toFixed(0) + '%' : '—'}</p></div>
            <div><p className="text-xs opacity-80">Renda minima</p><p className="font-bold text-xl">{formatCurrency(res.rendaMinima)}</p></div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Como chegamos nisso</h3>
          <div className="space-y-2">
            {res.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                <span className={r.ok ? '' : 'text-amber-600 dark:text-amber-400'}>{r.text}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Numeros do financiamento</h3>
          <div className="space-y-1.5 text-sm">
            <Row label="Valor financiado" value={formatCurrency(res.financiado)} />
            {isFin && <Row label="Loan-to-Value (LTV)" value={`${(res.ltv * 100).toFixed(0)}%`} />}
            <Row label={res.sistema === 'sac' ? 'Parcela inicial (SAC)' : 'Parcela (Price)'} value={formatCurrency(res.parcela)} />
            {res.sistema === 'sac' && <Row label="Parcela final (SAC)" value={formatCurrency(res.sac.last)} />}
            <Row label="Total pago" value={formatCurrency(res.totalPago)} />
            <Row label="Juros totais" value={formatCurrency(res.jurosTotal)} strong color="text-rose-500" />
            {f.tipo === 'imovel' && <>
              <Row label="Custos (ITBI+registro ~5%)" value={formatCurrency(res.custosAquisicao)} />
              <Row label="Recursos a vista (entrada+custos-FGTS)" value={formatCurrency(res.recursosNecessarios)} strong />
            </>}
          </div>
          <p className="text-xs text-muted mt-3">Estimativa educativa. Bancos avaliam ainda score de crédito, relacionamento e comprovacao de renda.</p>
        </Card>
      </div>

      {/* REGRAS APLICADAS */}
      <Card>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ScrollText className="w-4 h-4 text-indigo-500" /> Regras aplicadas nesta modalidade</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          {isFin && <RuleCard label="Financia até (LTV)" value={`${(rules.ltvMax * 100).toFixed(0)}%`} />}
          {isFin && <RuleCard label="Entrada minima" value={`${(rules.entradaMinPct * 100).toFixed(0)}%`} />}
          <RuleCard label="Prazo máximo" value={`${rules.prazoMaxMeses} meses`} />
          <RuleCard label="Comprometimento max" value={`${(rules.comprometimentoMax * 100).toFixed(0)}% da renda`} />
          <RuleCard label="Taxa tipica" value={`~${Number(rules.taxaTipicaAm).toFixed(2)}% a.m.`} />
          {rules.idadeRule && <RuleCard label="Idade + prazo" value="até 80 anos e 6 meses" />}
          {rules.veiculoMaxAnos && <RuleCard label="Idade max do veículo" value={`${rules.veiculoMaxAnos} anos`} />}
          {rules.rendaMax && <RuleCard label="Teto de renda (MCMV)" value={formatCurrency(rules.rendaMax)} />}
          {rules.tetoSFH ? <RuleCard label="Teto SFH (com FGTS)" value={formatCurrency(rules.tetoSFH)} /> : null}
        </div>
        {rules.obs && <p className="text-xs text-muted mt-3 flex items-start gap-2"><Wallet className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" /> {rules.obs}</p>}
        <p className="text-xs text-muted mt-2">Valores de referência do mercado brasileiro; cada banco tem politica propria. Cadastre bancos para usar taxas reais.</p>
      </Card>

      {bankModal && <BankModal banks={banks} qc={qc} onClose={() => setBankModal(false)} />}
    </div>
  );
}

function RuleCard({ label, value }) {
  return <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3"><p className="text-[11px] text-muted">{label}</p><p className="font-semibold">{value}</p></div>;
}

function Row({ label, value, strong, color = '' }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className={`${strong ? 'font-bold' : 'font-medium'} ${color}`}>{value}</span></div>;
}

const PERIODS = [['mensal', 'ao mês'], ['anual', 'ao ano']];
const emptyBank = { name: '', kind: 'imovel', base_rate: '', periodicity: 'anual', indexer: 'TR', max_ltv: '', prazo_max: '', system: 'sac', notes: '' };

function BankModal({ banks, qc, onClose }) {
  const [form, setForm] = useState(emptyBank);
  const inval = () => qc.invalidateQueries({ queryKey: ['bankrates'] });
  const build = (b) => { const rm = toMonthly(Number(b.base_rate || 0), b.periodicity); return { name: b.name, kind: b.kind, base_rate: Number(b.base_rate || 0), periodicity: b.periodicity, indexer: b.indexer, rate_month: Number(rm.toFixed(4)), max_ltv: b.max_ltv ? Number(b.max_ltv) : null, prazo_max: b.prazo_max ? Number(b.prazo_max) : null, system: b.system || 'price', updated_at: b.updated_at || new Date().toISOString().slice(0, 10), notes: b.notes || '' }; };
  const save = useMutation({ mutationFn: (p) => BankRate.create(p), onSuccess: () => { inval(); setForm(emptyBank); toast.success('Banco cadastrado'); } });
  const del = useMutation({ mutationFn: (id) => BankRate.remove(id), onSuccess: inval });
  const seed = useMutation({
    mutationFn: async () => { const have = new Set(banks.map((b) => `${(b.name || '').toLowerCase()}|${b.kind}`)); let n = 0; for (const p of BANK_PRESETS) { if (have.has(`${p.name.toLowerCase()}|${p.kind}`)) continue; await BankRate.create(build(p)); n++; } return n; },
    onSuccess: (n) => { inval(); toast.success(n ? `${n} banco(s) de referência adicionados.` : 'Os bancos de referência já estao cadastrados.'); },
  });
  const submit = () => { if (!form.name || !form.base_rate) return toast.error('Informe nome e taxa'); save.mutate(build(form)); };
  const eff = form.base_rate ? effectiveMonthly(Number(form.base_rate), form.periodicity, form.indexer) : null;

  return (
    <Modal open onClose={onClose} title="Bancos & Taxas" maxWidth="max-w-lg" footer={<Button onClick={onClose}>Fechar</Button>}>
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Comece com condições publicas de referência (13/08/2026): Caixa, Santander, Itau, Inter (TR e IPCA) e BB.</p>
          <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>{seed.isPending ? <Spinner className="w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> Importar</>}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Banco"><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Ex: Caixa" /></Field>
          <Field label="Tipo"><Select value={form.kind} onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value }))}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select></Field>
          <Field label="Taxa base (%)"><Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm((s) => ({ ...s, base_rate: e.target.value }))} placeholder="10.99" /></Field>
          <Field label="Periodicidade"><Select value={form.periodicity} onChange={(e) => setForm((s) => ({ ...s, periodicity: e.target.value }))}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Indexador"><Select value={form.indexer} onChange={(e) => setForm((s) => ({ ...s, indexer: e.target.value }))}>{Object.entries(INDEXERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="Sistema"><Select value={form.system} onChange={(e) => setForm((s) => ({ ...s, system: e.target.value }))}><option value="sac">SAC</option><option value="price">Price</option><option value="ambos">Ambos</option></Select></Field>
          <Field label="LTV máximo (%)"><Input type="number" value={form.max_ltv} onChange={(e) => setForm((s) => ({ ...s, max_ltv: e.target.value }))} placeholder="90" /></Field>
          <Field label="Prazo max (meses)"><Input type="number" value={form.prazo_max} onChange={(e) => setForm((s) => ({ ...s, prazo_max: e.target.value }))} placeholder="420" /></Field>
        </div>
        {eff && <p className="text-xs text-muted">{Number(form.base_rate).toFixed(2)}% {form.periodicity === 'anual' ? 'a.a.' : 'a.m.'} = juros ~{eff.baseM.toFixed(3)}% a.m.{form.indexer !== 'prefixado' ? ` + ${INDEXERS[form.indexer]?.label || 'indexador'} (estimado ~${eff.idxM.toFixed(3)}% a.m.) → efetiva ~${eff.eff.toFixed(3)}% a.m.` : ''}</p>}
        <Field label="Observação"><Textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Condições, relacionamento, etc." /></Field>
        <Button onClick={submit} disabled={save.isPending} className="w-full">{save.isPending ? <Spinner className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Cadastrar banco</>}</Button>
        {banks.length > 0 && (
          <div className="pt-2 border-t border-[hsl(var(--border))]">
            <p className="text-xs text-muted mb-2">Bancos cadastrados ({banks.length})</p>
            <div className="divide-y divide-[hsl(var(--border))] max-h-56 overflow-y-auto">
              {banks.map((b) => (
                <div key={b.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate">{b.name} <span className="text-muted text-xs">· {(KINDS.find((k) => k.v === b.kind) || {}).label}{b.indexer && b.indexer !== 'prefixado' ? ` · ${b.indexer}` : ''}</span></span>
                  <Badge>{Number(b.rate_month).toFixed(2)}% a.m.</Badge>
                  <button onClick={() => del.mutate(b.id)} className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
