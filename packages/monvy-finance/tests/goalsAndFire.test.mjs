import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequiredContribution, estimateTimeToGoal, simulateSavingsGoal, calculateFireTarget, simulateFireProjection } from '../dist/index.js';

test('meta já atingida: aporte necessário é zero', () => {
  const r = calculateRequiredContribution({ targetAmount: 1000, initialAmount: 5000, months: 12, monthlyRatePct: 0 });
  assert.equal(r.alreadyReached, true);
  assert.equal(r.requiredMonthlyContribution, 0);
});

test('rentabilidade zero: aporte = (meta - inicial) / meses', () => {
  const r = calculateRequiredContribution({ targetAmount: 12000, initialAmount: 0, months: 12, monthlyRatePct: 0 });
  assert.equal(r.requiredMonthlyContribution, 1000);
});

test('estimateTimeToGoal: meta impossível (sem aporte e sem rendimento) retorna months null', () => {
  const r = estimateTimeToGoal({ targetAmount: 10000, initialAmount: 100, monthlyContribution: 0, monthlyRatePct: 0 });
  assert.equal(r.months, null);
  assert.equal(r.alreadyReached, false);
});

test('estimateTimeToGoal: meta já atingida retorna 0 meses', () => {
  const r = estimateTimeToGoal({ targetAmount: 100, initialAmount: 500, monthlyContribution: 0, monthlyRatePct: 0 });
  assert.equal(r.months, 0);
  assert.equal(r.alreadyReached, true);
});

test('taxas negativas matematicamente válidas são aceitas em simulateSavingsGoal', () => {
  const r = simulateSavingsGoal({ targetAmount: 1000, initialAmount: 2000, monthlyContribution: 0, monthlyRatePct: -5, months: 6 });
  assert.ok(r.finalBalance < 2000);
});

test('série projetada é consistente (monotônica com aportes positivos e taxa >= 0)', () => {
  const r = simulateSavingsGoal({ targetAmount: 100000, initialAmount: 0, monthlyContribution: 500, monthlyRatePct: 0.5, months: 24 });
  for (let i = 1; i < r.series.length; i++) assert.ok(r.series[i].balance >= r.series[i - 1].balance);
});

test('calculateFireTarget: patrimônio-alvo = gasto anual x múltiplo (ex.: regra dos 4% = 25x)', () => {
  const r = calculateFireTarget({ monthlyExpense: 5000, multipleOfAnnualExpense: 25 });
  assert.equal(r.annualExpense, 60000);
  assert.equal(r.targetNetWorth, 1500000);
});

test('simulateFireProjection: patrimônio já suficiente retorna 0 meses', () => {
  const r = simulateFireProjection({ currentNetWorth: 2000000, monthlyContribution: 0, monthlyExpense: 5000, annualReturnRatePct: 4, multipleOfAnnualExpense: 25 });
  assert.equal(r.monthsToTarget, 0);
});

test('simulateFireProjection: sem aporte e retorno insuficiente, meta não é atingida em 80 anos', () => {
  const r = simulateFireProjection({ currentNetWorth: 0, monthlyContribution: 0, monthlyExpense: 5000, annualReturnRatePct: 0, multipleOfAnnualExpense: 25 });
  assert.equal(r.monthsToTarget, null);
});
