import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBill, splitExpenses, calculateSettlements } from '../dist/index.js';

test('splitBill: soma das parcelas é igual ao total (sem itens individuais)', () => {
  const r = splitBill({ totalAmount: 100, tipPct: 10, participantCount: 3 });
  assert.equal(r.sumOfPayments, r.totalWithTip);
});

test('splitBill: distribui centavos residuais sem perder nem sobrar centavo algum', () => {
  const r = splitBill({ totalAmount: 100, tipPct: 0, participantCount: 3 });
  // 100/3 = 33.33... -> soma das partes deve ser exatamente 100.00
  assert.equal(r.sumOfPayments, 100);
});

test('splitBill: participantes com itens individuais pagam parte compartilhada + seu item', () => {
  const r = splitBill({ totalAmount: 150, tipPct: 10, participantCount: 3, individualItems: [{ participantId: 'p1', amount: 30 }] });
  assert.equal(r.sumOfPayments, r.totalWithTip);
  assert.ok(r.individualPayments[0].totalOwed > r.sharedAmountPerParticipant);
});

test('splitExpenses: participantes com a mesma renda dividem igual no modo income', () => {
  const r = splitExpenses({
    participants: [{ id: 'a', income: 3000 }, { id: 'b', income: 3000 }],
    expenses: [{ amount: 1000, paidByParticipantId: 'a' }],
    mode: 'income',
  });
  const a = r.participants.find((p) => p.participantId === 'a');
  const b = r.participants.find((p) => p.participantId === 'b');
  assert.equal(a.fairShare, 500);
  assert.equal(b.fairShare, 500);
});

test('splitExpenses: participantes com rendas diferentes dividem proporcionalmente', () => {
  const r = splitExpenses({
    participants: [{ id: 'a', income: 4000 }, { id: 'b', income: 2000 }],
    expenses: [{ amount: 900, paidByParticipantId: 'a' }],
    mode: 'income',
  });
  const a = r.participants.find((p) => p.participantId === 'a');
  const b = r.participants.find((p) => p.participantId === 'b');
  assert.equal(a.fairShare, 600);
  assert.equal(b.fairShare, 300);
});

test('splitExpenses: modo igual ignora renda', () => {
  const r = splitExpenses({
    participants: [{ id: 'a', income: 10000 }, { id: 'b', income: 1000 }],
    expenses: [{ amount: 1000, paidByParticipantId: 'a' }],
    mode: 'equal',
  });
  const a = r.participants.find((p) => p.participantId === 'a');
  const b = r.participants.find((p) => p.participantId === 'b');
  assert.equal(a.fairShare, 500);
  assert.equal(b.fairShare, 500);
});

test('splitExpenses: despesa sem pagador é contabilizada em expensesWithoutPayer', () => {
  const r = splitExpenses({ participants: [{ id: 'a' }, { id: 'b' }], expenses: [{ amount: 100 }], mode: 'equal' });
  assert.equal(r.expensesWithoutPayer, 1);
});

test('calculateSettlements: zera os saldos com o menor número de transferências', () => {
  const settlements = calculateSettlements([
    { participantId: 'a', balance: -500 },
    { participantId: 'b', balance: 300 },
    { participantId: 'c', balance: 200 },
  ]);
  const totalSettled = settlements.reduce((s, x) => s + x.amount, 0);
  assert.equal(Math.round(totalSettled * 100) / 100, 500);
});
