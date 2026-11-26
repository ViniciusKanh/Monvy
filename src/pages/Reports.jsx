import { useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportReportToPdf } from '../lib/exportPdf.js';
import { Transaction, Account, Category, CreditCardTransaction, AppSettings, TaxLedger, FiscalNote, Payslip } from '../api/entities.js';
import { iofByMonth as calcIofByMonth, isIofText } from '../lib/cardTaxes.js';
import { salaryFromPayslips } from '../lib/payslips.js';
import { AiWordCloud } from '../components/AiWordCloud.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button, Select, Badge, Spinner } from '../components/ui';
import { HeroTitle, Panel, Donut, DeltaChip, GlowButton, TIP } from '../components/kit.jsx';
import { ReportArt } from '../components/art/PageArt.jsx';
import { formatCurrency, monthKey, monthLabel, monthRange, MONTHS_PT } from '../lib/utils.js';
import { combineExpenses, categoryTrends } from '../lib/analytics.js';
import { buildTaxRecords, aggregate } from '../lib/taxBurden.js';
import { Landmark } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, LineChart, Line, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FileText, Download, Printer, TrendingUp, TrendingDown, Lightbulb, Sparkles, FileSpreadsheet, Wallet, CreditCard, Layers, PiggyBank, Target, Check, BarChart3, PieChart as PieIcon, Activity } from 'lucide-react';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { Reports as ReportsApi } from '../api/entities.js';
import { toast } from '../lib/toast.js';
import { exportReportXlsx } from '../lib/exportXlsx.js';
import { Mail } from 'lucide-react';

const COLORS = ['#ef4444', '#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#64748b'];

export default function Reports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(3);
  const [endMk, setEndMk] = useState(monthKey(new Date()));
  const monthOptions = monthRange(11, 3);
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: cardTxs = [] } = useQuery({ queryKey: ['cardtx'], queryFn: () => CreditCardTransaction.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const { data: taxLedger = [] } = useQuery({ queryKey: ['tax-ledger-all'], queryFn: () => TaxLedger.list() });
  const { data: fiscalNotes = [] } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const { data: payslips = [] } = useQuery({ queryKey: ['payslips'], queryFn: () => Payslip.list() });
  const geminiKey = settingsList[0]?.gemini_api_key;
  // mapas por mês: IOF (faturas) e tributos de notas fiscais
  const iofByMonth = useMemo(() => calcIofByMonth(taxLedger, cardTxs), [taxLedger, cardTxs]);
  const nfeByMonth = useMemo(() => { const m = {}; for (const r of fiscalNotes) { const mk = String(r.reference_month || ''); if (mk) m[mk] = (m[mk] || 0) + Number(r.total_tax || 0); } return m; }, [fiscalNotes]);
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const tx = useMemo(() => combineExpenses(transactions, cardTxs), [transactions, cardTxs]);
  const months = useMemo(() => { const [y, m] = endMk.split('-').map(Number); const arr = []; for (let i = period - 1; i >= 0; i--) arr.push(monthKey(new Date(y, m - 1 - i, 1))); return arr; }, [period, endMk]);
  const inPeriod = (d) => months.includes(String(d).slice(0, 7));
  const periodTx = useMemo(() => tx.filter((t) => inPeriod(t.date)), [tx, months]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of periodTx) { if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    return { inc, exp, bal: inc - exp, rate: inc > 0 ? ((inc - exp) / inc * 100) : 0 };
  }, [periodTx]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const periodLabel = period === 1 ? monthLabel(endMk) : `${period} meses até ${monthLabel(endMk)}`;

  // Carga tributária por mês do período (usa config salva + despesas reais)
  const taxByMonth = useMemo(() => {
    let cfg = { salarioBruto: 4200, dependentes: 0, deducoes: 0, inssConfirmado: 392.60, irrfConfirmado: 0, ipvaAnual: 0, iptuAnual: 0 };
    try { const raw = localStorage.getItem('monvy:taxBurden:v1'); if (raw) { const s = JSON.parse(raw); const nm = (v) => { const x = Number(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; }; cfg = { salarioBruto: nm(s.salarioBruto), dependentes: nm(s.dependentes), deducoes: nm(s.deducoes), inssConfirmado: s.inssConfirmado === '' ? undefined : nm(s.inssConfirmado), irrfConfirmado: s.irrfConfirmado === '' ? undefined : nm(s.irrfConfirmado), ipvaAnual: nm(s.ipvaAnual), iptuAnual: nm(s.iptuAnual) }; } } catch { /* usa default */ }
    return months.map((k) => {
      const gastos = tx.filter((t) => t.type === 'expense' && Number(t.amount) > 0 && String(t.date).slice(0, 7) === k && !isIofText(t.description)).map((t) => ({ valor: Number(t.amount), descricao: t.description, categoria: t.category_id }));
      const cm = salaryFromPayslips(cfg, payslips, k); // holerite do mês manda (salário/INSS/IRRF confirmados)
      const recs = buildTaxRecords({ ano: Number(k.slice(0, 4)), mes: Number(k.slice(5, 7)), ...cm, gastos, iofLancado: iofByMonth[k] || 0, nfeConfirmado: nfeByMonth[k] || 0 });
      const ag = aggregate(recs, cm.salarioBruto);
      const [y, m] = k.split('-').map(Number);
      return { mk: k, name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, confirmado: ag.totalConfirmado, estimado: ag.totalEstimado, total: ag.totalCarga, pct: ag.percentualCarga, recs };
    });
  }, [tx, months, iofByMonth, nfeByMonth, payslips]);
  const taxTotals = useMemo(() => {
    const t = taxByMonth.reduce((a, r) => ({ conf: a.conf + r.confirmado, est: a.est + r.estimado, tot: a.tot + r.total }), { conf: 0, est: 0, tot: 0 });
    const avgPct = taxByMonth.length ? taxByMonth.reduce((s, r) => s + r.pct, 0) / taxByMonth.length : 0;
    // distribuição por categoria (soma no período) + separação salário/consumo/outros
    const byCat = {};
    let salario = 0, consumo = 0, outros = 0;
    for (const r of taxByMonth) for (const rec of r.recs) if (rec.available) {
      byCat[rec.name] = (byCat[rec.name] || 0) + rec.amount;
      if (rec.key === 'inss' || rec.key === 'irrf') salario += rec.amount;
      else if (rec.key === 'consumo') consumo += rec.amount;
      else outros += rec.amount;
    }
    const dist = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    // top buckets de consumo (onde o imposto embutido mais pesa)
    const buckets = {};
    for (const r of taxByMonth) { const c = r.recs.find((x) => x.key === 'consumo' && x.available); for (const it of (c?.meta?.itens || [])) buckets[it.label] = (buckets[it.label] || 0) + it.tributo; }
    const topBuckets = Object.entries(buckets).map(([label, tributo]) => ({ label, tributo })).sort((a, b) => b.tributo - a.tributo).slice(0, 3);
    return { ...t, avgPct, dist, salario, consumo, outros, topBuckets };
  }, [taxByMonth]);

  // Narrativa do período (reutilizada na tela, no e-mail e nos exports)
  const taxNarrativa = useMemo(() => {
    const gasto = totals.exp;
    if (taxTotals.tot <= 0) return '';
    const f = formatCurrency;
    const pctConsumo = gasto > 0 ? Math.round((taxTotals.consumo / gasto) * 100) : 0;
    const comp = [taxTotals.salario > 0 ? `${f(taxTotals.salario)} sobre o salário (INSS+IRRF)` : '', taxTotals.consumo > 0 ? `${f(taxTotals.consumo)} embutidos no consumo` : '', taxTotals.outros > 0 ? `${f(taxTotals.outros)} de IPVA/IPTU/IOF` : ''].filter(Boolean).join(', ');
    const top = taxTotals.topBuckets.length ? ` Onde o imposto embutido mais pesa: ${taxTotals.topBuckets.map((b) => `${b.label} (${f(b.tributo)})`).join(', ')}.` : '';
    return `No período (${periodLabel}), você gastou ${f(gasto)} e destinou cerca de ${f(taxTotals.tot)} a impostos — ${taxTotals.avgPct.toFixed(1)}% da renda${comp ? `, sendo ${comp}` : ''}. Consumo representa ~${pctConsumo}% dos seus gastos em tributo embutido.${top}`;
  }, [taxTotals, totals.exp, periodLabel]);

  // Resumo de notas fiscais no período
  const NF_LABELS = { iss: 'ISS', icms: 'ICMS', ipi: 'IPI', ii: 'II', pis: 'PIS', cofins: 'COFINS', irrf: 'IRRF', csll: 'CSLL', inss: 'INSS', ibs: 'IBS', cbs: 'CBS', issqn: 'ISS' };
  const nfSummary = useMemo(() => {
    const inP = fiscalNotes.filter((r) => months.includes(String(r.reference_month || '')));
    const totalValue = inP.reduce((s, r) => s + Number(r.total_value || 0), 0);
    const totalTax = inP.reduce((s, r) => s + Number(r.total_tax || 0), 0);
    const byType = {};
    for (const nt of inP) for (const [k, v] of Object.entries(nt.taxes || {})) { if (k === 'aproximado' || k === 'fcp') continue; if (Number(v) > 0) byType[NF_LABELS[k] || k] = (byType[NF_LABELS[k] || k] || 0) + Number(v); }
    const types = Object.entries(byType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const byEmit = {};
    for (const nt of inP) byEmit[nt.emitter || 'Emitente'] = (byEmit[nt.emitter || 'Emitente'] || 0) + Number(nt.total_tax || 0);
    const top = Object.entries(byEmit).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    return { count: inP.length, totalValue, totalTax, types, top };
  }, [fiscalNotes, months]);

  const monthly = useMemo(() => months.map((k) => {
    let inc = 0, exp = 0;
    for (const t of tx) { if (String(t.date).slice(0, 7) !== k) continue; if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    const [y, m] = k.split('-').map(Number);
    return { name: `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`, Receita: inc, Despesa: exp, net: inc - exp };
  }), [tx, months]);

  const evolution = useMemo(() => { let acc = 0; return monthly.map((r) => { acc += r.net; return { name: r.name, Saldo: acc }; }); }, [monthly]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of periodTx) if (t.type === 'expense') { const c = catMap[t.category_id]; const n = c?.name || 'Sem categoria'; map[n] = map[n] || { name: n, value: 0, color: c?.color }; map[n].value += +t.amount; }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [periodTx, catMap]);
  const maxCat = byCategory[0]?.value || 1;
  const totalExp = byCategory.reduce((s, c) => s + c.value, 0) || 1;
  const topExpenses = useMemo(() => periodTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5), [periodTx]);
  const statement = useMemo(() => [...periodTx].sort((a, b) => (a.date < b.date ? 1 : -1)), [periodTx]);
  const trends = useMemo(() => categoryTrends(periodTx, months, catMap), [periodTx, months, catMap]);
  const rising = trends.find((x) => x.change > 25 && x.total > 0);

  const insights = useMemo(() => {
    const arr = [];
    if (monthly.length >= 2) {
      const last = monthly[monthly.length - 1], prev = monthly[monthly.length - 2];
      if (prev.Despesa > 0) { const d = ((last.Despesa - prev.Despesa) / prev.Despesa) * 100; if (Math.abs(d) >= 8) arr.push({ t: d > 0 ? 'warn' : 'ok', m: `Despesas ${d > 0 ? 'subiram' : 'cairam'} ${Math.abs(d).toFixed(0)}% em ${last.name} vs ${prev.name}.` }); }
    }
    if (totals.rate >= 20) arr.push({ t: 'ok', m: `Ótima taxa de poupança no período: ${totals.rate.toFixed(0)}% da renda.` });
    else if (totals.bal < 0) arr.push({ t: 'warn', m: `No período você gastou ${formatCurrency(-totals.bal)} a mais do que ganhou.` });
    else if (totals.inc > 0) arr.push({ t: 'info', m: `Taxa de poupança do período: ${totals.rate.toFixed(0)}%.` });
    if (byCategory[0]) arr.push({ t: 'info', m: `Maior gasto: ${byCategory[0].name} — ${formatCurrency(byCategory[0].value)} (${Math.round((byCategory[0].value / totalExp) * 100)}% das despesas).` });
    if (rising) arr.push({ t: 'warn', m: `${rising.name} vem crescendo (+${rising.change.toFixed(0)}% no período). Vale acompanhar.` });
    if (topExpenses[0]) arr.push({ t: 'info', m: `Maior lançamento único: ${topExpenses[0].description || catMap[topExpenses[0].category_id]?.name || 'Despesa'} (${formatCurrency(topExpenses[0].amount)}).` });
    if (!arr.length) arr.push({ t: 'ok', m: 'Período equilibrado, sem destaques negativos.' });
    return arr;
  }, [monthly, totals, byCategory, totalExp, rising, topExpenses, catMap]);

  const exportCsv = () => {
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status']];
    periodTx.forEach((t) => rows.push([t.date, t.type, (t.description || '').replace(/;/g, ','), catMap[t.category_id]?.name || '', String(t.amount).replace('.', ','), t.status || 'pending']));
    const csv = rows.map((r) => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `monvy-relatório-${period}m.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const taxPayload = () => ({
    narrativa: taxNarrativa, total: taxTotals.tot, confirmado: taxTotals.conf, estimado: taxTotals.est,
    salario: taxTotals.salario, consumo: taxTotals.consumo, outros: taxTotals.outros, avgPct: taxTotals.avgPct,
    byMonth: taxByMonth.map((m) => ({ name: m.name, confirmado: m.confirmado, estimado: m.estimado, total: m.total, pct: m.pct })),
    dist: taxTotals.dist, topBuckets: taxTotals.topBuckets,
  });

  const exportExcel = () => {
    exportReportXlsx({
      periodLabel, totals, totalBalance,
      monthly: monthly.map((m) => ({ name: m.name, Receita: m.Receita, Despesa: m.Despesa, net: m.net })),
      byCategory: byCategory.map((c) => ({ name: c.name, value: c.value })),
      statement: statement.map((t) => ({ date: t.date, type: t.type, description: t.description || catMap[t.category_id]?.name || '', category: catMap[t.category_id]?.name || '', amount: Number(t.amount), status: t.status || 'pending' })),
      tax: taxPayload(),
    }, `monvy-relatorio-${period}m`);
    toast.success('Planilha Excel gerada.');
  };

  const printRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPDF = async () => {
    if (!printRef.current) return;
    setPdfBusy(true);
    try {
      await exportReportToPdf(printRef.current, { filename: `monvy-relatorio-${period}m.pdf`, title: 'Monvy · Relatório Financeiro', subtitle: `${periodLabel}${user?.full_name ? ' · ' + user.full_name : ''}` });
      toast.success('PDF gerado.');
    } catch (e) { toast.error('Não consegui gerar o PDF: ' + (e.message || '')); }
    finally { setPdfBusy(false); }
  };

  const [emailing, setEmailing] = useState(false);
  const sendByEmail = async () => {
    setEmailing(true);
    try {
      await ReportsApi.email({ summary: {
        name: user?.full_name, periodLabel,
        inc: totals.inc, exp: totals.exp, bal: totals.bal, rate: totals.rate, totalBalance,
        categories: byCategory.map((c) => ({ name: c.name, value: c.value })),
        topExpenses: topExpenses.map((t) => ({ name: t.description || catMap[t.category_id]?.name || 'Despesa', value: Number(t.amount) })),
        monthly: monthly.map((m) => ({ name: m.name, inc: m.Receita, exp: m.Despesa, net: m.net })),
        insights: insights.map((i) => i.m),
        insight: rising ? `${rising.name} cresceu ${rising.change.toFixed(0)}% no período — vale acompanhar.` : (totals.rate >= 20 ? `Ótima taxa de poupança: ${totals.rate.toFixed(0)}%.` : null),
        tax: taxPayload(),
        nf: nfSummary.count > 0 ? { count: nfSummary.count, totalTax: nfSummary.totalTax, totalValue: nfSummary.totalValue, types: nfSummary.types, top: nfSummary.top } : null,
      } });
      toast.success('Relatório enviado para o seu e-mail!');
    } catch (e) { toast.error(e.message || 'Falha ao enviar. Verifique a config de e-mail.'); }
    finally { setEmailing(false); }
  };

  // período anterior de mesmo tamanho (para as variações dos KPIs)
  const prevTotals = useMemo(() => {
    const [y, m] = months[0].split('-').map(Number); const prevMonths = []; for (let i = period; i >= 1; i--) prevMonths.push(monthKey(new Date(y, m - 1 - i, 1)));
    let inc = 0, exp = 0; for (const t of tx) { if (!prevMonths.includes(String(t.date).slice(0, 7))) continue; if (t.type === 'income') inc += +t.amount; if (t.type === 'expense') exp += +t.amount; }
    return { inc, exp };
  }, [tx, months, period]);
  const chg = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
  // variação do patrimônio no período: saldo de hoje menos tudo que entrou/saiu desde o início do período
  const varPeriodo = useMemo(() => {
    const start = months[0]; let net = 0; for (const t of tx) { if (String(t.date).slice(0, 7) < start) continue; if (t.type === 'income') net += +t.amount; if (t.type === 'expense') net -= +t.amount; }
    const startBal = totalBalance - net; return startBal > 0 ? (totals.bal / startBal) * 100 : null;
  }, [tx, months, totalBalance, totals.bal]);
  const trend = useMemo(() => { if (monthly.length < 2) return {}; const a = monthly[0], b = monthly[monthly.length - 1]; const pc = (x, y) => (x !== 0 ? ((y - x) / Math.abs(x)) * 100 : null); return { inc: pc(a.Receita, b.Receita), exp: pc(a.Despesa, b.Despesa), net: pc(a.net, b.net) }; }, [monthly]);
  const exec = useMemo(() => {
    const expUp = chg(totals.exp, prevTotals.exp);
    const headline = totals.bal < 0 ? `Período desafiador${expUp != null && expUp > 10 ? ', com aumento relevante de despesas' : ', com gastos acima da renda'}.` : totals.rate >= 20 ? 'Período saudável, com boa sobra no orçamento.' : 'Período equilibrado, com espaço para poupar mais.';
    const top = byCategory[0];
    const conclusao = totals.bal < 0 ? `controle os gastos${top ? ` de ${top.name}` : ''} e revise as despesas variáveis.` : totals.rate >= 20 ? 'mantenha o ritmo e direcione a sobra para reserva e investimentos.' : `defina um teto para ${top ? top.name : 'as maiores categorias'} e automatize um aporte mensal.`;
    return { headline, conclusao };
  }, [totals, prevTotals, byCategory]);
  const recs = useMemo(() => {
    const items = []; const top = byCategory[0];
    if (top && top.value / totalExp >= 0.3) items.push(`Reduza em pelo menos 20% os gastos com ${top.name} (−${formatCurrency(top.value * 0.2)} no período).`);
    if (totals.rate < 10) items.push(`Aumente a taxa de poupança para ≥ 10% (hoje em ${totals.rate.toFixed(1).replace('.', ',')}%).`);
    if (rising) items.push(`Revise ${rising.name}, que cresceu ${rising.change.toFixed(0)}% no período.`);
    if (!items.length) items.push('Continue registrando tudo e reserve a sobra logo no início do mês.');
    return { items: items.slice(0, 3), prio: totals.bal < 0 ? 'Alta' : totals.rate < 10 ? 'Média' : 'Baixa' };
  }, [byCategory, totalExp, totals, rising]);

  return (
    <div ref={printRef} className="space-y-4 animate-fadeIn print:space-y-2">
      <div className="print:hidden relative">
        <HeroTitle icon={FileText} lead="Relatório" accent="Financeiro" iconClass="text-sky-400" subtitle="Análise completa, insights e evolução das suas finanças." art={<ReportArt className="w-[24rem] h-36 opacity-90" />} />
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={endMk} onChange={(e) => setEndMk(e.target.value)} className="w-auto min-w-[170px]">{monthOptions.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</Select>
        <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="w-auto min-w-[150px]"><option value={1}>Somente o mês</option><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></Select>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" onClick={sendByEmail} disabled={emailing}>{emailing ? <Spinner className="w-4 h-4" /> : <><Mail className="w-4 h-4" /> Enviar por e-mail</>}</Button>
          <GlowButton tone="sky" onClick={exportPDF} disabled={pdfBusy}>{pdfBusy ? <Spinner className="w-4 h-4" /> : <><Printer className="w-4 h-4" /> Exportar PDF</>}</GlowButton>
        </div>
      </div>
      {/* Capa só para impressão (PDF limpo, sem o hero pesado) */}
      <div className="hidden print:block" style={{ borderBottom: '3px solid #065f46', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46' }}>Monvy · Relatório Financeiro</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{periodLabel} · gerado em {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
            <div style={{ fontWeight: 700, color: '#0b1330' }}>{user?.full_name || user?.email || ''}</div>
            <div>Patrimônio: {formatCurrency(totalBalance)}</div>
          </div>
        </div>
      </div>


      {/* faixa do perfil */}
      <section className="print:hidden relative overflow-hidden rounded-3xl ring-1 ring-fuchsia-400/50 shadow-[0_0_40px_-12px_rgba(168,85,247,.6)] p-5 text-white flex flex-wrap items-center gap-5" style={{ background: 'linear-gradient(110deg,#6d28d9,#7c3aed 40%,#a21caf 75%,#4338ca)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden><path d="M0 70 C80 30 140 90 220 50 S340 20 400 40" stroke="#f0abfc" strokeWidth="1.5" fill="none" /><path d="M0 85 C90 55 170 100 250 70 S360 45 400 60" stroke="#a5f3fc" strokeWidth="1" fill="none" /></svg>
        {user?.photo_url ? <img src={user.photo_url} alt="" className="relative w-16 h-16 rounded-2xl object-cover ring-2 ring-white/40" />
          : <div className="relative w-16 h-16 rounded-2xl bg-white/20 ring-2 ring-white/40 grid place-items-center font-display font-bold text-2xl">{(user?.full_name || '?').slice(0, 1)}</div>}
        <div className="relative flex-1 min-w-[200px]">
          <p className="font-display text-2xl font-bold">{user?.full_name || 'Usuário'}</p>
          <p className="text-sm text-white/80">{user?.email}{user?.profession ? ` · ${user.profession}` : ''}</p>
          <span className="inline-block mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/25">{periodLabel}</span>
        </div>
        <div className="relative text-right"><p className="text-sm text-white/80">Saldo total</p><p className="font-display text-3xl font-black">{formatCurrency(totalBalance)}</p><p className="text-xs text-white/70">{new Date().toLocaleDateString('pt-BR')}</p></div>
        {varPeriodo != null && <div className="relative rounded-2xl bg-black/30 ring-1 ring-white/25 px-4 py-3 flex items-center gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center bg-emerald-400/25 text-emerald-300"><TrendingUp className="w-5 h-5" /></span><div><p className="text-xs text-white/75">Variação (período)</p><p className={`font-display text-2xl font-extrabold ${varPeriodo >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{varPeriodo >= 0 ? '+' : ''}{varPeriodo.toFixed(1).replace('.', ',')}%</p></div></div>}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Receita do período', v: totals.inc, icon: Wallet, c: '#38bdf8', d: chg(totals.inc, prevTotals.inc), inv: false },
          { l: 'Despesa do período', v: totals.exp, icon: CreditCard, c: '#fb7185', d: chg(totals.exp, prevTotals.exp), inv: true },
          { l: 'Saldo do período', v: totals.bal, icon: Layers, c: '#a78bfa', neg: totals.bal < 0 },
          { l: 'Taxa de poupança', v: null, txt: `${totals.rate.toFixed(1).replace('.', ',')}%`, icon: PiggyBank, c: '#c084fc', neg: totals.rate < 0 },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3" style={{ backgroundImage: `linear-gradient(135deg,${k.c}22,transparent 70%)` }}>
            <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${k.c}26`, color: k.c }}><k.icon className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-xs text-muted">{k.l}</p><p className={`font-display text-xl font-bold truncate ${k.neg ? 'text-rose-500' : ''}`}>{k.txt ?? <AnimatedValue value={k.v} format={formatCurrency} />}</p></div>
            {k.d != null && <DeltaChip v={k.d} invert={k.inv} className="self-start" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel className="xl:col-span-7" tone="violet" title="Resumo inteligente do período" icon={Sparkles} iconClass="text-sky-400" action={<span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg ring-1 ring-violet-400/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">Visão executiva · Auto</span>}>
          <div className="grid sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.4fr)] gap-4">
            <div className="rounded-2xl ring-1 ring-emerald-400/40 p-4 flex items-center gap-3" style={{ backgroundImage: 'linear-gradient(135deg,rgba(16,185,129,.2),transparent)' }}><Target className="w-10 h-10 text-emerald-300 shrink-0" strokeWidth={1.6} /><p className="font-display text-lg font-bold leading-snug">{exec.headline}</p></div>
            <div className="space-y-2 text-sm">
              {insights.slice(0, 3).map((i, k) => <p key={k} className="flex items-start gap-2">{i.t === 'warn' ? <TrendingUp className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> : i.t === 'ok' ? <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Lightbulb className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}{i.m}</p>)}
              <p className="rounded-xl ring-1 ring-amber-400/40 bg-amber-500/10 px-3 py-2 flex gap-2"><Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /><span><b>Conclusão:</b> {exec.conclusao}</span></p>
            </div>
          </div>
        </Panel>
        <Panel className="xl:col-span-5" tone="pink" title="Recomendações" icon={Target} iconClass="text-pink-400" action={<span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${recs.prio === 'Alta' ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300' : recs.prio === 'Média' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'}`}>Prioridade: {recs.prio}</span>}>
          <ul className="space-y-3">{recs.items.map((r, i) => <li key={i} className="flex items-start gap-2.5 text-sm"><span className="w-5 h-5 rounded-md bg-emerald-500 text-white grid place-items-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5" /></span>{r}</li>)}</ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title={<>Receitas vs Despesas <span className="text-sm text-muted font-normal">(últimos {period} {period > 1 ? 'meses' : 'mês'})</span></>} icon={BarChart3} iconClass="text-sky-400" action={<div className="flex gap-3 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Receitas</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-rose-500" />Despesas</span></div>}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 22, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="rbInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" /></linearGradient><linearGradient id="rbExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#e11d48" /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
              <Bar dataKey="Receita" fill="url(#rbInc)" radius={[6, 6, 0, 0]} maxBarSize={46}>{period <= 6 && <LabelList dataKey="Receita" position="top" formatter={(v) => formatCurrency(v)} style={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--text))' }} />}</Bar>
              <Bar dataKey="Despesa" fill="url(#rbExp)" radius={[6, 6, 0, 0]} maxBarSize={46}>{period <= 6 && <LabelList dataKey="Despesa" position="top" formatter={(v) => formatCurrency(v)} style={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--text))' }} />}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Evolução do saldo (acumulado)" icon={TrendingUp} iconClass="text-violet-400">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evolution} margin={{ top: 30, right: 56, left: 0, bottom: 0 }}><defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} padding={{ left: 40, right: 10 }} /><YAxis width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} />
              <Area dataKey="Saldo" stroke="#a78bfa" strokeWidth={2.5} fill="url(#gArea)" dot={{ r: 5, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}>{period <= 6 && <LabelList dataKey="Saldo" content={(p) => { const t = formatCurrency(p.value); const w = t.length * 6.4 + 14; const c = p.value >= 0 ? '#34d399' : '#fb7185'; return <g><rect x={p.x - w / 2} y={p.y - 30} width={w} height="20" rx="6" fill="hsl(var(--card))" stroke={c} /><text x={p.x} y={p.y - 16} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={c}>{t}</text></g>; }} />}</Area>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Despesas por categoria" subtitle={periodLabel} icon={PieIcon} iconClass="text-fuchsia-400">
          {byCategory.length === 0 ? <p className="text-sm text-muted py-6 text-center">Sem despesas no período.</p> : (
            <div className="flex flex-col sm:flex-row xl:flex-col items-center gap-4">
              <Donut size={140} thickness={0.26} data={byCategory.slice(0, 6).map((c, i) => ({ name: c.name, value: c.value, color: c.color || COLORS[i % COLORS.length] }))} center={<><b className="font-display text-sm">{formatCurrency(totalExp)}</b><span className="text-[10px] text-muted">Total</span></>} />
              <div className="flex-1 w-full space-y-1.5 text-xs">{byCategory.slice(0, 6).map((c, i) => <p key={c.name} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color || COLORS[i % COLORS.length] }} /><span className="flex-1 truncate">{c.name}</span><b>{formatCurrency(c.value)}</b><span className="text-muted w-10 text-right">{((c.value / totalExp) * 100).toFixed(1).replace('.', ',')}%</span></p>)}</div>
            </div>
          )}
        </Panel>
        <Panel title={<>Análise de tendência <span className="text-sm text-muted font-normal">({period} {period > 1 ? 'meses' : 'mês'})</span></>} icon={Activity} iconClass="text-sky-400">
          {monthly.length < 2 ? <p className="text-sm text-muted">Escolha 3 meses ou mais para ver a tendência.</p> : (
            <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
              <div className="space-y-2">{[['Receitas', trend.inc, false, TrendingUp], ['Despesas', trend.exp, true, TrendingUp], ['Saldo', trend.net, false, Layers]].map(([l, v, inv, Ic]) => <div key={l} className="rounded-xl ring-1 ring-[hsl(var(--border))] px-3 py-1.5 flex items-center gap-3 text-sm"><Ic className="w-4 h-4 text-muted" /><span className="w-16">{l}</span><b className={v == null ? '' : (inv ? v <= 0 : v >= 0) ? 'text-emerald-500' : 'text-rose-500'}>{v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`}</b></div>)}</div>
              <ResponsiveContainer width="100%" height={130}><LineChart data={monthly} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TIP} /><Line dataKey="Receita" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} /><Line dataKey="Despesa" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} /><Line dataKey="net" name="Saldo" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
            </div>
          )}
          <p className="text-[11px] text-muted mt-2">Variação do primeiro para o último mês do período.</p>
        </Panel>
        <Panel tone="emerald" title="Principais insights do relatório" icon={BarChart3} iconClass="text-emerald-400">
          <ul className="space-y-2.5 text-sm">{insights.slice(0, 5).map((i, k) => <li key={k} className="flex items-start gap-2"><span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-500 grid place-items-center shrink-0"><Check className="w-3.5 h-3.5" /></span>{i.m}</li>)}</ul>
        </Panel>
      </div>

      {/* Maiores despesas + resumo por categoria */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Maiores despesas do período</h3>
          {topExpenses.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem despesas no período.</p>
            : <div className="space-y-2">{topExpenses.map((t, i) => { const c = catMap[t.category_id]; return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{t.description || c?.name || 'Despesa'}</p><p className="text-[11px] text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')} · {c?.name || 'Sem categoria'}</p></div>
                <span className="font-semibold text-rose-500 shrink-0">{formatCurrency(t.amount)}</span>
              </div>
            ); })}</div>}
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Resumo por categoria</h3>
          {byCategory.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem dados.</p>
            : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5 font-medium">Categoria</th><th className="py-1.5 font-medium text-right">Valor</th><th className="py-1.5 font-medium text-right">%</th></tr></thead>
              <tbody>{byCategory.map((c, i) => (<tr key={i} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-1.5 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} />{c.name}</td><td className="py-1.5 text-right font-medium">{formatCurrency(c.value)}</td><td className="py-1.5 text-right text-muted">{((c.value / totalExp) * 100).toFixed(1)}%</td></tr>))}</tbody>
              <tfoot><tr className="font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatCurrency(totalExp)}</td><td className="py-1.5 text-right">100%</td></tr></tfoot>
            </table></div>}
        </Card>
      </div>

      {/* Nuvem de palavras dos gastos */}
      <AiWordCloud cardTxs={cardTxs} transactions={transactions} apiKey={geminiKey} />

      {/* Carga tributária no período */}
      <Card className="print-break">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-500" /> Carga tributária ({period} {period > 1 ? 'meses' : 'mês'})</h3>
          <Badge color="emerald">média {taxTotals.avgPct.toFixed(1)}% da renda</Badge>
        </div>
        {taxNarrativa && <p className="text-sm leading-relaxed mb-3">{taxNarrativa}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3"><p className="text-xs text-muted">Imposto total</p><p className="font-display text-lg font-bold">{formatCurrency(taxTotals.tot)}</p></div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3"><p className="text-xs text-blue-700 dark:text-blue-300">Sobre o salário</p><p className="font-display text-lg font-bold text-blue-600">{formatCurrency(taxTotals.salario)}</p></div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3"><p className="text-xs text-amber-700 dark:text-amber-300">No consumo</p><p className="font-display text-lg font-bold text-amber-600">{formatCurrency(taxTotals.consumo)}</p></div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3"><p className="text-xs text-emerald-700 dark:text-emerald-300">Confirmado</p><p className="font-display text-lg font-bold text-emerald-600">{formatCurrency(taxTotals.conf)}</p></div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted mb-1">Evolução mensal</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taxByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="confirmado" stackId="a" fill="#059669" name="Confirmado" />
                <Bar dataKey="estimado" stackId="a" fill="#f59e0b" name="Estimado" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Distribuição por tributo</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5 font-medium">Tributo</th><th className="py-1.5 font-medium text-right">Valor</th><th className="py-1.5 font-medium text-right">%</th></tr></thead>
              <tbody>{taxTotals.dist.map((d, i) => (<tr key={i} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-1.5">{d.name}</td><td className="py-1.5 text-right font-medium">{formatCurrency(d.value)}</td><td className="py-1.5 text-right text-muted">{taxTotals.tot > 0 ? ((d.value / taxTotals.tot) * 100).toFixed(1) : '0'}%</td></tr>))}</tbody>
              <tfoot><tr className="font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatCurrency(taxTotals.tot)}</td><td className="py-1.5 text-right">100%</td></tr></tfoot>
            </table></div>
          </div>
        </div>
        <p className="text-xs text-muted mt-3">Projeção anualizada ≈ {formatCurrency((taxTotals.tot / (period || 1)) * 12)}. Valores <b>confirmados</b> vêm do holerite/lançamentos; <b>estimados</b> usam médias de consumo (padrão IBPT) e não representam tributo efetivamente recolhido. Ajuste seus dados em <b>Minha Carga Tributária</b>.</p>
      </Card>

      {/* Notas fiscais no período */}
      {nfSummary.count > 0 && (
        <Card className="print-break">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-500" /> Notas fiscais ({nfSummary.count})</h3>
            <Badge color="emerald">{formatCurrency(nfSummary.totalTax)} em tributos</Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted mb-1">Tributos por tipo</p>
              <table className="w-full text-sm">
                <tbody>{nfSummary.types.map((t) => (<tr key={t.name} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-1.5">{t.name}</td><td className="py-1.5 text-right font-medium">{formatCurrency(t.value)}</td></tr>))}</tbody>
                <tfoot><tr className="font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatCurrency(nfSummary.totalTax)}</td></tr></tfoot>
              </table>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Onde mais paguei imposto</p>
              <table className="w-full text-sm">
                <tbody>{nfSummary.top.map((e) => (<tr key={e.name} className="border-b border-[hsl(var(--border))] last:border-0"><td className="py-1.5 truncate">{e.name}</td><td className="py-1.5 text-right font-medium">{formatCurrency(e.value)}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted mt-3">Somam {formatCurrency(nfSummary.totalValue)} em compras/serviços. Estes tributos entram como <b>confirmados</b> na sua carga tributária.</p>
        </Card>
      )}

      {/* Extrato detalhado (para PDF) */}
      <Card className="print-break">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Extrato detalhado</h3><span className="text-xs text-muted">{statement.length} lançamento(s)</span></div>
        {statement.length === 0 ? <p className="text-sm text-muted py-4 text-center">Sem lançamentos no período.</p>
          : <div className="overflow-x-auto max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]"><tr className="text-left text-muted border-b border-[hsl(var(--border))]"><th className="py-1.5 font-medium">Data</th><th className="py-1.5 font-medium">Descrição</th><th className="py-1.5 font-medium">Categoria</th><th className="py-1.5 font-medium text-right">Valor</th></tr></thead>
              <tbody>{statement.map((t) => { const c = catMap[t.category_id]; const isInc = t.type === 'income'; return (
                <tr key={t.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="py-1.5 whitespace-nowrap text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-1.5">{t.description || c?.name || (isInc ? 'Receita' : t.type === 'transfer' ? 'Transferencia' : 'Despesa')}</td>
                  <td className="py-1.5 text-muted">{t.type === 'transfer' ? 'Transferencia' : (c?.name || '—')}</td>
                  <td className={`py-1.5 text-right font-medium whitespace-nowrap ${isInc ? 'text-emerald-500' : t.type === 'transfer' ? 'text-indigo-500' : 'text-rose-500'}`}>{isInc ? '+' : t.type === 'transfer' ? '' : '-'}{formatCurrency(t.amount)}</td>
                </tr>
              ); })}</tbody>
            </table>
          </div>}
      </Card>
    </div>
  );
}
