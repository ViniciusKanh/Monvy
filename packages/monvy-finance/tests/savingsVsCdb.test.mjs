import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSavingsVsFixedIncome, fixedIncomeIrRate } from '../dist/index.js';

test('fixedIncomeIrRate: alíquotas regressivas por faixa de dias', () => {
  assert.equal(fixedIncomeIrRate(100), 22.5);
  assert.equal(fixedIncomeIrRate(200), 20);
  assert.equal(fixedIncomeIrRate(500), 17.5);
  assert.equal(fixedIncomeIrRate(1000), 15);
});

test('compareSavingsVsFixedIncome: produz série consistente e vencedor determinístico', () => {
  const r = compareSavingsVsFixedIncome({ initialAmount: 10000, months: 24, selicAnnualPct: 10.5, cdiAnnualPct: 10.5, percentOfCdi: 100 });
  assert.equal(r.series.length, 24);
  assert.ok(['savings', 'fixed_income', 'tie'].includes(r.winner));
});
