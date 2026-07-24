// Testes unitarios do motor de analise (rodam sem DB/DOM)
import { evaluateModel, healthScore, detectSubscriptions, computeAlerts, lastMonths, monthlySeries } from '../src/lib/analytics.js';
import { buildCategoryIndex, predictCategory } from '../src/lib/categoryPredictor.js';

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

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
