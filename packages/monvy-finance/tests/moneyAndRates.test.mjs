import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundCurrency, splitExact, sumCurrency, annualToMonthly, monthlyToAnnual, composeRates } from '../dist/index.js';

test('roundCurrency: casos clássicos de arredondamento de ponto flutuante', () => {
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
  assert.equal(roundCurrency(1.005), 1.01);
  assert.equal(roundCurrency(19.999999999), 20);
});

test('splitExact: soma das partes é sempre exatamente igual ao total, mesmo com dízima', () => {
  const parts = splitExact(100, 3);
  const sum = sumCurrency(parts);
  assert.equal(sum, 100);
  assert.equal(parts.length, 3);
});

test('splitExact: valores de referência calculados independentemente (100/3)', () => {
  const parts = splitExact(100, 3);
  // 33.34 + 33.33 + 33.33 = 100.00 (resíduo de 1 centavo no primeiro participante)
  assert.deepEqual(parts.map((p) => p.toFixed(2)), ['33.34', '33.33', '33.33']);
});

test('conversão de taxa anual <-> mensal é inversa (ida e volta) dentro de tolerância', () => {
  const annual = 12;
  const monthly = annualToMonthly(annual);
  const back = monthlyToAnnual(monthly);
  assert.ok(Math.abs(back - annual) < 1e-9);
});

test('conversão de taxa NÃO usa divisão simples por 12 (12% a.a. != 1% a.m.)', () => {
  const monthly = annualToMonthly(12);
  assert.notEqual(Math.round(monthly * 100) / 100, 1);
  // valor de referência calculado independentemente: (1.12)^(1/12) - 1 ≈ 0.9489%
  assert.ok(Math.abs(monthly - 0.9488792934) < 1e-6);
});

test('composeRates combina duas taxas por capitalização composta, não soma simples', () => {
  const combined = composeRates(1, 0.5);
  // (1.01 * 1.005 - 1) * 100 = 1.505%
  assert.ok(Math.abs(combined - 1.505) < 1e-9);
});
