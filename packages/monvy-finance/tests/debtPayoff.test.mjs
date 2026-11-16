import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateDebtPayoff, compareDebtStrategies } from '../dist/index.js';

const sampleDebts = () => ([
  { id: 'd1', name: 'Cartão', balance: 5000, monthlyRatePct: 8, minimumPayment: 300 },
  { id: 'd2', name: 'Empréstimo', balance: 2000, monthlyRatePct: 2, minimumPayment: 150 },
  { id: 'd3', name: 'Cartão', balance: 1000, monthlyRatePct: 10, minimumPayment: 100 },
]);

test('avalanche foca primeiro na dívida de maior taxa de juros', () => {
  const r = simulateDebtPayoff({ debts: sampleDebts(), strategy: 'avalanche', extraPayment: 200 });
  assert.equal(r.order[0], 'd3'); // 10% a.m., maior taxa
});

test('snowball foca primeiro na dívida de menor saldo', () => {
  const r = simulateDebtPayoff({ debts: sampleDebts(), strategy: 'snowball', extraPayment: 200 });
  assert.equal(r.order[0], 'd3'); // também é o menor saldo neste exemplo
});

test('dívidas com o mesmo nome são tratadas como entidades distintas (por id)', () => {
  const r = simulateDebtPayoff({ debts: sampleDebts(), strategy: 'avalanche', extraPayment: 200 });
  assert.ok(r.order.includes('d1') && r.order.includes('d3'));
});

test('id duplicado lança erro (nome não pode ser usado como identificador)', () => {
  const debts = [
    { id: 'x', name: 'A', balance: 100, monthlyRatePct: 1, minimumPayment: 50 },
    { id: 'x', name: 'B', balance: 200, monthlyRatePct: 1, minimumPayment: 50 },
  ];
  assert.throws(() => simulateDebtPayoff({ debts, strategy: 'avalanche' }));
});

test('dívida já quitada (balance 0) retorna quitação imediata', () => {
  const r = simulateDebtPayoff({ debts: [{ id: 'd1', name: 'X', balance: 0, monthlyRatePct: 5, minimumPayment: 100 }], strategy: 'avalanche' });
  assert.equal(r.months, 0);
  assert.equal(r.payoffAchieved, true);
});

test('juros zero: tempo de quitação é proporcional ao saldo/pagamento', () => {
  const r = simulateDebtPayoff({ debts: [{ id: 'd1', name: 'X', balance: 1000, monthlyRatePct: 0, minimumPayment: 100 }], strategy: 'avalanche' });
  assert.equal(r.months, 10);
  assert.equal(r.totalInterest, 0);
});

test('pagamento mínimo insuficiente (não cobre juros) é sinalizado, sem projeção enganosa', () => {
  const r = simulateDebtPayoff({ debts: [{ id: 'd1', name: 'X', balance: 10000, monthlyRatePct: 15, minimumPayment: 50 }], strategy: 'avalanche' });
  assert.ok(r.debtsWithInsufficientMinimumPayment.includes('d1'));
});

test('pagamento extra acelera a quitação', () => {
  const noExtra = simulateDebtPayoff({ debts: sampleDebts(), strategy: 'avalanche' });
  const withExtra = simulateDebtPayoff({ debts: sampleDebts(), strategy: 'avalanche', extraPayment: 500 });
  assert.ok(withExtra.months < noExtra.months);
});

test('limite de iterações evita loop infinito (pagamento zero com juros positivos)', () => {
  const r = simulateDebtPayoff({ debts: [{ id: 'd1', name: 'X', balance: 10000, monthlyRatePct: 20, minimumPayment: 0 }], strategy: 'avalanche' });
  assert.equal(r.payoffAchieved, false);
  assert.equal(r.months, null);
});

test('compareDebtStrategies compara avalanche e snowball e calcula economia de juros quando ambas quitam', () => {
  const r = compareDebtStrategies({ debts: sampleDebts(), extraPayment: 300 });
  assert.ok(r.avalanche.payoffAchieved && r.snowball.payoffAchieved);
  assert.ok(r.interestSavingsOfAvalancheVsSnowball >= 0);
});
