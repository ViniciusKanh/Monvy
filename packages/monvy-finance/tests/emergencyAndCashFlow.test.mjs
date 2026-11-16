import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEmergencyFund, projectEmergencyFund, monthlySeries, monthTotals, categoryBreakdown, linearRegression, forecastNextMonth, lastMonthKeys } from '../dist/index.js';

test('calculateEmergencyFund: meta = gasto médio x meses desejados (parâmetro configurável)', () => {
  const r = calculateEmergencyFund({ averageMonthlyExpense: 3000, currentReserve: 9000, targetMonths: 6 });
  assert.equal(r.targetAmount, 18000);
  assert.equal(r.monthsCovered, 3);
  assert.equal(r.completionPct, 50);
});

test('projectEmergencyFund: meta já atingida retorna 0 meses restantes', () => {
  const r = projectEmergencyFund({ averageMonthlyExpense: 1000, currentReserve: 10000, targetMonths: 6, monthlyContribution: 500 });
  assert.equal(r.monthsToTarget, 0);
});

test('projectEmergencyFund: sem aporte e meta não atingida retorna null (não trava em loop)', () => {
  const r = projectEmergencyFund({ averageMonthlyExpense: 1000, currentReserve: 0, targetMonths: 6, monthlyContribution: 0 });
  assert.equal(r.monthsToTarget, null);
});

test('monthlySeries agrupa receitas e despesas por mês corretamente', () => {
  const tx = [
    { date: '2026-01-10', type: 'income', amount: 5000 },
    { date: '2026-01-15', type: 'expense', amount: 2000 },
    { date: '2026-02-05', type: 'expense', amount: 1500 },
  ];
  const series = monthlySeries(tx, lastMonthKeys(2, '2026-02'));
  assert.equal(series[0].monthKey, '2026-01');
  assert.equal(series[0].income, 5000);
  assert.equal(series[0].expense, 2000);
  assert.equal(series[1].expense, 1500);
});

test('monthTotals calcula taxa de poupança do mês', () => {
  const tx = [{ date: '2026-03-01', type: 'income', amount: 4000 }, { date: '2026-03-10', type: 'expense', amount: 3000 }];
  const t = monthTotals(tx, '2026-03');
  assert.equal(t.savingsRatePct, 25);
});

test('categoryBreakdown soma despesas por categoria e ordena do maior para o menor', () => {
  const tx = [
    { date: '2026-01-01', type: 'expense', amount: 100, categoryId: 'mercado' },
    { date: '2026-01-02', type: 'expense', amount: 300, categoryId: 'aluguel' },
    { date: '2026-01-03', type: 'expense', amount: 50, categoryId: 'mercado' },
  ];
  const breakdown = categoryBreakdown(tx, 'expense');
  assert.equal(breakdown[0].categoryId, 'aluguel');
  assert.equal(breakdown[1].total, 150);
});

test('forecastNextMonth sinaliza explicitamente que é estimativa (isEstimate=true)', () => {
  const tx = [
    { date: '2026-01-01', type: 'income', amount: 4000 }, { date: '2026-01-05', type: 'expense', amount: 2000 },
    { date: '2026-02-01', type: 'income', amount: 4000 }, { date: '2026-02-05', type: 'expense', amount: 2100 },
    { date: '2026-03-01', type: 'income', amount: 4000 }, { date: '2026-03-05', type: 'expense', amount: 2200 },
  ];
  const f = forecastNextMonth(tx, lastMonthKeys(3, '2026-03'));
  assert.equal(f.isEstimate, true);
  assert.equal(f.sampleSize, 3);
});

test('linearRegression com amostra de 1 ponto não quebra (retorna o próprio valor)', () => {
  const reg = linearRegression([42]);
  assert.equal(reg.predict(5), 42);
});
