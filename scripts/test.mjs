// Testes unitarios do motor de analise (rodam sem DB/DOM)
import { evaluateModel, healthScore, detectSubscriptions, computeAlerts, lastMonths, monthlySeries } from '../src/lib/analytics.js';
import { buildCategoryIndex, predictCategory } from '../src/lib/categoryPredictor.js';
import { calcInss, calcIrrf, estimateConsumo, mensalizar, buildTaxRecords, aggregate, buildTaxAnalysis } from '../src/lib/taxBurden.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  FAIL:', m); } };

// 1. regressao/metricas
const ev = evaluateModel([1800, 1950, 2100, 2300, 2200, 2600]);
ok(ev.r2 > 0.5, 'R2 > 0.5 em serie crescente');
ok(ev.cvMae >= 0 && isFinite(ev.cvMae), 'CV-MAE finito');
ok(ev.folds === 6, 'LOO com 6 folds');

// 2. health score
const now = new Date(); const tx = [];
for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 5).toISOString().slice(0, 10);
  tx.push({ date: d, amount: 4000, type: 'income', status: 'completed', category_id: 'c2' });
  tx.push({ date: d, amount: 2500, type: 'expense', status: 'completed', category_id: 'c1', description: 'Mercado' }); }
const h = healthScore({ transactions: tx, months: lastMonths(6), totalBalance: 8000, categories: [{ type: 'expense' }], cards: [] });
ok(h.score >= 0 && h.score <= 100, 'score entre 0 e 100');
ok(h.pillars.length === 5, '5 pilares');

// 3. predictor
const idx = buildCategoryIndex(tx);
ok(predictCategory('compra mercado', idx) === 'c1', 'preditor acerta categoria');

// 4. subscriptions
const subTx = []; for (let i = 0; i < 4; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 10).toISOString().slice(0, 10); subTx.push({ type: 'expense', description: 'Netflix', amount: 39.9, date: d }); }
ok(detectSubscriptions(subTx, []).some((s) => s.name === 'Netflix'), 'detecta assinatura recorrente');

// 5. alertas
const al = computeAlerts({ transactions: [{ id: 'x', type: 'expense', amount: 100, date: '2020-01-01', status: 'pending' }], accounts: [{ id: 'a', name: 'C', current_balance: -10 }], categories: [], invoices: [], subscriptions: [], catMap: {} });
ok(al.length >= 2, 'gera alertas (vencido + saldo negativo)');

// ===========================================================================
// 6. Motor de carga tributaria (Minha Carga Tributaria)
// ===========================================================================
const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

// 6.1 INSS progressivo — salario dentro da 3a faixa
const inss3000 = calcInss(3000, 2025);
// 1518*0.075 + (2793.88-1518)*0.09 + (3000-2793.88)*0.12
const inssEsperado = 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (3000 - 2793.88) * 0.12;
ok(approx(inss3000.valor, Math.round(inssEsperado * 100) / 100), 'INSS progressivo de R$3000');
ok(inss3000.valor > 0 && inss3000.aliquotaEfetiva > 0, 'INSS tem aliquota efetiva > 0');

// 6.2 INSS teto — acima do teto usa contribuicao maxima
const inssAlto = calcInss(50000, 2025);
const teto = 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (4190.83 - 2793.88) * 0.12 + (8157.41 - 4190.83) * 0.14;
ok(approx(inssAlto.valor, Math.round(teto * 100) / 100), 'INSS respeita o teto');

// 6.3 Valor de fronteira de faixa (exatamente no limite 1518)
const inssLimite = calcInss(1518, 2025);
ok(approx(inssLimite.valor, Math.round(1518 * 0.075 * 100) / 100), 'INSS no limite da 1a faixa');

// 6.4 IRRF isento (base baixa) -> R$ 0,00 mas categoria existe
const irrfIsento = calcIrrf({ bruto: 2000, inss: 150, dependentes: 0, deducoes: 0 });
ok(irrfIsento.valor === 0, 'IRRF isento retorna 0');

// 6.5 IRRF positivo (salario alto)
const irrfAlto = calcIrrf({ bruto: 8000, inss: 900, dependentes: 0, deducoes: 0 });
ok(irrfAlto.valor > 0, 'IRRF positivo em salario alto');

// 6.6 Consumo estimado — soma dos buckets = total
const consumo = estimateConsumo([
  { valor: 1000, descricao: 'Supermercado Extra' },
  { valor: 200, descricao: 'Posto gasolina' },
  { valor: 100, descricao: 'Farmacia Drogasil' },
]);
const somaBuckets = consumo.itens.reduce((s, it) => s + it.tributo, 0);
ok(approx(Math.round(somaBuckets * 100) / 100, consumo.total), 'consumo: soma dos buckets = total');
ok(consumo.total > 0, 'consumo estima tributo > 0');

// 6.7 Mensalizacao IPVA/IPTU
ok(approx(mensalizar(1200), 100), 'mensalizacao 1200/12 = 100');
ok(mensalizar(0) === 0, 'mensalizacao de 0 = 0');

// 6.8 buildTaxRecords + aggregate: soma componentes = total, percentual = total/renda*100
const recs = buildTaxRecords({
  ano: 2025, mes: 6, salarioBruto: 4200, inssConfirmado: 392.60, irrfConfirmado: 0,
  gastos: [{ valor: 800, descricao: 'Mercado' }, { valor: 150, descricao: 'Uber' }],
  ipvaAnual: 1200, iptuAnual: 600,
});
const ag = aggregate(recs, 4200);
const somaComp = ag.componentes.reduce((s, c) => s + c.amount, 0);
ok(approx(Math.round(somaComp * 100) / 100, ag.totalCarga), 'agregado: soma componentes = totalCarga');
ok(approx(ag.percentualCarga, Math.round((ag.totalCarga / 4200) * 100 * 100) / 100), 'percentual = total/renda*100');
ok(approx(ag.diasEquivalentes, Math.round((365 * ag.percentualCarga / 100) * 100) / 100), 'dias equivalentes = 365*pct/100');

// 6.9 Classificacao confirmado vs estimado vs manual
const inssRec = recs.find((r) => r.key === 'inss');
ok(inssRec.status === 'confirmed', 'INSS informado do holerite = confirmed');
const consumoRec = recs.find((r) => r.key === 'consumo');
ok(consumoRec.status === 'estimated', 'consumo = estimated (nunca recolhido)');
const ipvaRec = recs.find((r) => r.key === 'ipva');
ok(ipvaRec.status === 'manual' && approx(ipvaRec.amount, 100), 'IPVA manual mensalizado = 100');

// 6.10 Sem salario -> INSS/IRRF indisponiveis (nao inventa)
const recsVazio = buildTaxRecords({ ano: 2025, mes: 6, salarioBruto: 0, gastos: [] });
ok(recsVazio.find((r) => r.key === 'inss').available === false, 'sem salario: INSS indisponivel');
ok(aggregate(recsVazio, 0).totalCarga === 0, 'sem dados: carga total = 0 (nao inventa)');

// 6.11 Analise inteligente do mes
const recsA = buildTaxRecords({
  ano: 2025, mes: 9, salarioBruto: 4200, inssConfirmado: 392.60, irrfConfirmado: 0,
  gastos: [{ valor: 900, descricao: 'Supermercado' }, { valor: 300, descricao: 'Posto gasolina' }],
});
const agA = aggregate(recsA, 4200);
const gastoTotalA = 900 + 300;
const an = buildTaxAnalysis({ mesLabel: 'Setembro 2025', rendaBruta: 4200, gastoTotal: gastoTotalA, records: recsA, resumo: agA, prevTotalCarga: agA.totalCarga * 0.8 });
ok(typeof an.narrativa === 'string' && an.narrativa.includes('Setembro 2025'), 'analise: narrativa cita o mes');
ok(approx(an.impostoTotal, agA.totalCarga), 'analise: imposto total = carga agregada');
ok(an.impostoSalario > 0 && an.impostoConsumo > 0, 'analise: separa salario e consumo');
ok(an.narrativa.includes('mais que no mês anterior'), 'analise: compara com mes anterior (subiu)');
ok(an.top.length > 0, 'analise: lista onde o imposto mais pesa');
// sem dados -> nao inventa
const anVazio = buildTaxAnalysis({ mesLabel: 'X', rendaBruta: 0, gastoTotal: 0, records: buildTaxRecords({ ano: 2025, mes: 9, salarioBruto: 0, gastos: [] }), resumo: aggregate(buildTaxRecords({ ano: 2025, mes: 9, salarioBruto: 0, gastos: [] }), 0) });
ok(anVazio.impostoTotal === 0, 'analise: sem dados = imposto 0');

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
