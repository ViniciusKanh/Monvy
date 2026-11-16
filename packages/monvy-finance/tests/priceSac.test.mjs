import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, calculateSac, compareAmortizationSystems } from '../dist/index.js';

test('referência: financiamento de R$1.200,00 a 0% em 12 meses = parcelas de R$100,00 (PRICE)', () => {
  const r = calculatePrice({ principal: 1200, monthlyRatePct: 0, months: 12 });
  assert.equal(r.installment, 100);
  assert.equal(r.totalInterest, 0);
  assert.equal(r.totalPaid, 1200);
});

test('referência: financiamento de R$1.200,00 a 0% em 12 meses = parcelas de R$100,00 (SAC)', () => {
  const r = calculateSac({ principal: 1200, monthlyRatePct: 0, months: 12 });
  assert.equal(r.constantAmortization, 100);
  assert.equal(r.firstInstallment, 100);
  assert.equal(r.lastInstallment, 100);
  assert.equal(r.totalInterest, 0);
});

test('PRICE: parcela é constante em todos os períodos (exceto resíduo da última)', () => {
  const r = calculatePrice({ principal: 100000, monthlyRatePct: 1, months: 120 });
  const first = r.schedule[0].installment;
  for (const row of r.schedule.slice(0, -1)) assert.equal(row.installment, first);
});

test('PRICE: saldo devedor final é zero', () => {
  const r = calculatePrice({ principal: 100000, monthlyRatePct: 1, months: 120 });
  assert.equal(r.schedule[r.schedule.length - 1].remainingBalance, 0);
});

test('SAC: amortização constante em todos os períodos', () => {
  const r = calculateSac({ principal: 100000, monthlyRatePct: 1, months: 120 });
  const amorts = r.schedule.slice(0, -1).map((row) => row.amortization);
  assert.ok(amorts.every((a) => a === r.constantAmortization));
});

test('SAC: saldo devedor final é zero e é decrescente', () => {
  const r = calculateSac({ principal: 100000, monthlyRatePct: 1.2, months: 60 });
  assert.equal(r.schedule[r.schedule.length - 1].remainingBalance, 0);
  for (let i = 1; i < r.schedule.length; i++) {
    assert.ok(r.schedule[i].remainingBalance <= r.schedule[i - 1].remainingBalance);
  }
});

test('SAC paga menos (ou igual) juros totais que PRICE para os mesmos parâmetros', () => {
  const cmp = compareAmortizationSystems({ principal: 200000, monthlyRatePct: 0.9, months: 180 });
  assert.ok(cmp.sac.totalInterest <= cmp.price.totalInterest);
  assert.ok(cmp.sac.firstInstallment >= cmp.price.installment);
});

test('prazo inválido (zero ou negativo) lança erro em ambos os sistemas', () => {
  assert.throws(() => calculatePrice({ principal: 1000, monthlyRatePct: 1, months: 0 }));
  assert.throws(() => calculateSac({ principal: 1000, monthlyRatePct: 1, months: -1 }));
});
