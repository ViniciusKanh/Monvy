import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCompoundInterest } from '../dist/index.js';

test('taxa zero: saldo final = inicial + aportes, sem juros', () => {
  const r = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 100, annualRate: 0, months: 12 });
  assert.equal(r.finalBalance, 1000 + 100 * 12);
  assert.equal(r.totalInterest, 0);
});

test('aporte zero: cresce só por juros compostos sobre o inicial', () => {
  const r = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 0, annualRate: 12, months: 12 });
  assert.ok(r.finalBalance > 1000);
  assert.equal(r.totalContributed, 1000);
});

test('prazo zero: retorna apenas o ponto inicial, sem alterar o saldo', () => {
  const r = simulateCompoundInterest({ initialAmount: 500, monthlyContribution: 200, annualRate: 10, months: 0 });
  assert.equal(r.finalBalance, 500);
  assert.equal(r.series.length, 1);
});

test('valor inicial zero: ainda acumula pelos aportes mensais', () => {
  const r = simulateCompoundInterest({ initialAmount: 0, monthlyContribution: 100, annualRate: 12, months: 12 });
  assert.ok(r.finalBalance > 0);
});

test('aporte no início vs no fim do mês: início rende mais (mesmo capital base)', () => {
  const end = simulateCompoundInterest({ initialAmount: 0, monthlyContribution: 100, annualRate: 12, months: 12, contributionTiming: 'end' });
  const begin = simulateCompoundInterest({ initialAmount: 0, monthlyContribution: 100, annualRate: 12, months: 12, contributionTiming: 'begin' });
  assert.ok(begin.finalBalance > end.finalBalance);
});

test('taxa negativa matematicamente válida (acima de -100%) é aceita', () => {
  const r = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 0, annualRate: -20, months: 12 });
  assert.ok(r.finalBalance < 1000);
  assert.ok(r.finalBalance > 0);
});

test('período longo (360 meses) permanece determinístico e consistente', () => {
  const a = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 300, annualRate: 8, months: 360 });
  const b = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 300, annualRate: 8, months: 360 });
  assert.equal(a.finalBalance, b.finalBalance);
  assert.equal(a.series.length, 361);
});

test('consistência: saldo = aportado + juros (dentro de 1 centavo)', () => {
  const r = simulateCompoundInterest({ initialAmount: 1000, monthlyContribution: 150, annualRate: 9, months: 48 });
  assert.ok(Math.abs(r.finalBalance - (r.totalContributed + r.totalInterest)) < 0.01);
});

test('entrada inválida (NaN) lança erro em vez de virar zero silenciosamente', () => {
  assert.throws(() => simulateCompoundInterest({ initialAmount: NaN, monthlyContribution: 100, annualRate: 12, months: 12 }));
});

test('prazo negativo lança erro', () => {
  assert.throws(() => simulateCompoundInterest({ initialAmount: 100, monthlyContribution: 10, annualRate: 12, months: -3 }));
});

test('prazo não inteiro lança erro', () => {
  assert.throws(() => simulateCompoundInterest({ initialAmount: 100, monthlyContribution: 10, annualRate: 12, months: 2.5 }));
});
