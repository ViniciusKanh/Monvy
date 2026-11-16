/**
 * Divisão de despesas: racha de conta (igual) e rateio de casa (igual ou proporcional à renda,
 * com acerto de contas entre participantes).
 * Extraído e generalizado de `src/pages/BillSplit.jsx` e `src/pages/HouseholdSplit.jsx`.
 *
 * Todos os cálculos monetários operam em CENTAVOS INTEIROS internamente (ver `src/core/money.ts`)
 * para garantir que a soma das parcelas feche exatamente com o total, distribuindo o resíduo de
 * forma determinística. Participantes são identificados por `id`, nunca por nome.
 */
import { assertNonNegative, assertNonEmptyArray } from '../core/validation.js';
import { roundCurrency, splitExact, sumCurrency, toCents, fromCents } from '../core/money.js';

export interface SplitBillInput {
  /** Total da conta antes da gorjeta (reais). */
  totalAmount: number;
  /** Percentual de gorjeta (ex.: 10 = 10%). */
  tipPct?: number;
  /** Número de participantes que dividem a conta igualmente. */
  participantCount: number;
  /**
   * Itens de consumo individual (opcional): cada item é pago integralmente por quem o consumiu,
   * acrescido da gorjeta proporcional, e descontado do montante dividido igualmente entre todos.
   */
  individualItems?: Array<{ participantId: string; amount: number }>;
}

export interface SplitBillResult {
  totalWithTip: number;
  tipAmount: number;
  /** Valor da conta compartilhada (descontados os itens individuais), dividido igualmente. */
  sharedAmountPerParticipant: number;
  /** Total que cada participante com item individual paga (parte compartilhada + seu item, com gorjeta). */
  individualPayments: Array<{ participantId: string; totalOwed: number }>;
  /** Soma de todos os pagamentos — deve ser exatamente igual a `totalWithTip` (ver política de centavos). */
  sumOfPayments: number;
}

/** Divide uma conta (restaurante, bar, etc.) entre participantes, com gorjeta e itens de consumo individual opcionais. */
export function splitBill(input: SplitBillInput): SplitBillResult {
  const totalAmount = assertNonNegative(input.totalAmount, 'totalAmount');
  const tipPct = assertNonNegative(input.tipPct ?? 0, 'tipPct');
  const participantCount = assertNonEmptyArray(new Array(Math.max(1, Math.trunc(input.participantCount))).fill(0), 'participantCount').length;
  const individualItems = input.individualItems ?? [];

  const tipFraction = tipPct / 100;
  const totalWithTip = totalAmount * (1 + tipFraction);
  const tipAmount = totalWithTip - totalAmount;

  const sumIndividualBase = individualItems.reduce((s, it) => s + assertNonNegative(it.amount, 'individualItems[].amount'), 0);
  const sharedBase = Math.max(0, totalAmount - sumIndividualBase);
  const sharedWithTip = sharedBase * (1 + tipFraction);

  const sharedParts = splitExact(sharedWithTip, participantCount);
  const sharedAmountPerParticipant = sharedParts[0] ?? 0;

  const individualPayments = individualItems.map((it) => ({
    participantId: it.participantId,
    totalOwed: roundCurrency(sharedAmountPerParticipant + it.amount * (1 + tipFraction)),
  }));

  const sumOfPayments = sumCurrency([
    ...sharedParts.slice(individualItems.length), // participantes sem item individual
    ...individualPayments.map((p) => p.totalOwed),
  ]);

  return {
    totalWithTip: roundCurrency(totalWithTip),
    tipAmount: roundCurrency(tipAmount),
    sharedAmountPerParticipant: roundCurrency(sharedAmountPerParticipant),
    individualPayments,
    sumOfPayments,
  };
}

export interface ExpenseSplitParticipant {
  id: string;
  /** Renda do participante (reais) — usada apenas no modo `'income'`. */
  income?: number;
}

export interface ExpenseSplitItem {
  /** Valor da despesa (reais). */
  amount: number;
  /** Id do participante que pagou (opcional — despesas sem pagador não entram no cálculo de acerto). */
  paidByParticipantId?: string | null;
}

export type ExpenseSplitMode = 'equal' | 'income';

export interface SplitExpensesInput {
  participants: ExpenseSplitParticipant[];
  expenses: ExpenseSplitItem[];
  mode: ExpenseSplitMode;
}

export interface ExpenseSplitParticipantResult {
  participantId: string;
  /** Peso usado na divisão (fração de 0 a 1). */
  weight: number;
  /** Parte justa desta pessoa no total de despesas. */
  fairShare: number;
  /** Quanto esta pessoa efetivamente pagou. */
  amountPaid: number;
  /** Saldo: positivo = a receber, negativo = a pagar. */
  balance: number;
}

export interface SplitExpensesResult {
  totalExpenses: number;
  participants: ExpenseSplitParticipantResult[];
  /** Número de despesas sem pagador identificado (o acerto de contas fica incompleto se houver alguma). */
  expensesWithoutPayer: number;
}

/**
 * Divide um conjunto de despesas (ex.: contas da casa) entre participantes, de forma igual
 * (`mode: 'equal'`) ou proporcional à renda (`mode: 'income'`), e calcula o saldo de cada um
 * (quanto pagou menos/mais que sua parte justa). Equivalente ao motor de `HouseholdSplit.jsx`.
 */
export function splitExpenses(input: SplitExpensesInput): SplitExpensesResult {
  const participants = assertNonEmptyArray(input.participants, 'participants');
  const expenses = input.expenses ?? [];
  const mode = input.mode;

  const totalExpenses = sumCurrency(expenses.map((e) => assertNonNegative(e.amount, 'expenses[].amount')));
  const totalIncome = sumCurrency(participants.map((p) => assertNonNegative(p.income ?? 0, 'participants[].income')));
  const n = participants.length;

  const results: ExpenseSplitParticipantResult[] = participants.map((p) => {
    const weight = mode === 'income'
      ? (totalIncome > 0 ? (p.income ?? 0) / totalIncome : 1 / n)
      : 1 / n;
    const fairShare = totalExpenses * weight;
    const amountPaid = sumCurrency(
      expenses.filter((e) => e.paidByParticipantId === p.id).map((e) => e.amount)
    );
    return {
      participantId: p.id,
      weight: Math.round(weight * 10000) / 10000,
      fairShare: roundCurrency(fairShare),
      amountPaid: roundCurrency(amountPaid),
      balance: roundCurrency(amountPaid - fairShare),
    };
  });

  const expensesWithoutPayer = expenses.filter((e) => e.amount > 0 && !e.paidByParticipantId).length;

  return { totalExpenses: roundCurrency(totalExpenses), participants: results, expensesWithoutPayer };
}

export interface Settlement {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
}

/**
 * A partir dos saldos calculados por `splitExpenses`, gera o menor conjunto de transferências
 * (acerto de contas) que zera todos os saldos, dentro da tolerância monetária de 1 centavo.
 * Algoritmo guloso: ordena devedores e credores por valor e casa o maior devedor com o maior
 * credor sucessivamente — equivalente ao acerto de `HouseholdSplit.jsx`.
 */
export function calculateSettlements(balances: Array<{ participantId: string; balance: number }>): Settlement[] {
  const TOLERANCE_CENTS = 1;
  const debtors = balances
    .filter((b) => toCents(b.balance) < -TOLERANCE_CENTS)
    .map((b) => ({ id: b.participantId, cents: -toCents(b.balance) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((b) => toCents(b.balance) > TOLERANCE_CENTS)
    .map((b) => ({ id: b.participantId, cents: toCents(b.balance) }))
    .sort((a, b) => b.cents - a.cents);

  const settlements: Settlement[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amountCents = Math.min(debtors[i].cents, creditors[j].cents);
    if (amountCents > TOLERANCE_CENTS) {
      settlements.push({ fromParticipantId: debtors[i].id, toParticipantId: creditors[j].id, amount: fromCents(amountCents) });
    }
    debtors[i].cents -= amountCents;
    creditors[j].cents -= amountCents;
    if (debtors[i].cents <= TOLERANCE_CENTS) i++;
    if (creditors[j].cents <= TOLERANCE_CENTS) j++;
  }
  return settlements;
}
