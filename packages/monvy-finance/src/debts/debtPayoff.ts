/**
 * Estratégias de quitação de dívidas (avalanche e bola de neve / snowball).
 * Extraído e generalizado de `simulate()` em `src/pages/DebtPayoff.jsx`.
 */
import { assertNonNegative, assertNonEmptyArray, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction } from '../core/rates.js';

const MAX_MONTHS = 600; // mesmo limite usado em DebtPayoff.jsx, evita loop infinito

export type DebtStrategy = 'avalanche' | 'snowball';

export interface DebtInput {
  /** Identificador único da dívida (NÃO usar o nome como identificador — nomes podem se repetir). */
  id: string;
  name: string;
  /** Saldo devedor atual (reais). */
  balance: number;
  /** Taxa de juros mensal, em percentual (ex.: 3.5 = 3.5% a.m.). */
  monthlyRatePct: number;
  /** Pagamento mínimo mensal (reais). */
  minimumPayment: number;
}

export interface DebtPayoffMonthSnapshot {
  month: number;
  /** Saldo devedor de cada dívida ao final do mês, por id. */
  balances: Record<string, number>;
  /** Ids das dívidas quitadas exatamente neste mês. */
  payoffsThisMonth: string[];
}

export interface DebtPayoffResult {
  strategy: DebtStrategy;
  /** Ordem de quitação sugerida (ids), do primeiro foco ao último. */
  order: string[];
  /** Meses até quitar todas as dívidas, ou `null` se não quitou dentro do limite de simulação (600 meses). */
  months: number | null;
  totalPaid: number;
  totalInterest: number;
  /** `true` quando todas as dívidas foram quitadas dentro do horizonte simulado. */
  payoffAchieved: boolean;
  monthlySnapshots: DebtPayoffMonthSnapshot[];
  /** Ids das dívidas cujo pagamento mínimo não cobre nem os juros do mês (amortização impossível com o mínimo informado). */
  debtsWithInsufficientMinimumPayment: string[];
}

/**
 * Simula a quitação de uma lista de dívidas usando o orçamento total disponível
 * (soma dos pagamentos mínimos + `extraPayment`), aplicando o excedente na dívida em foco
 * conforme a estratégia escolhida:
 * - `avalanche`: foca primeiro na dívida de MAIOR taxa de juros (minimiza juros totais pagos).
 * - `snowball`: foca primeiro na dívida de MENOR saldo devedor (gera vitórias rápidas).
 *
 * Dívidas com o mesmo nome são tratadas como entidades distintas, desde que tenham `id` diferente.
 * O saldo nunca fica negativo: o pagamento aplicado a cada dívida é sempre `Math.min(saldo, disponível)`.
 * Quando o pagamento mínimo de uma dívida não cobre nem os juros do mês, ela é reportada em
 * `debtsWithInsufficientMinimumPayment` em vez de produzir uma projeção enganosa de quitação.
 */
export function simulateDebtPayoff(params: { debts: DebtInput[]; strategy: DebtStrategy; extraPayment?: number }): DebtPayoffResult {
  const debts = assertNonEmptyArray(params.debts, 'debts');
  const extraPayment = assertNonNegative(params.extraPayment ?? 0, 'extraPayment');
  const strategy = params.strategy;

  const ids = new Set<string>();
  for (const d of debts) {
    if (ids.has(d.id)) throw new RangeError(`[monvy-finance] debts: id duplicado "${d.id}" — cada dívida precisa de um identificador único (não use o nome).`);
    ids.add(d.id);
    assertNonNegative(d.balance, `debts[${d.id}].balance`);
    assertFiniteNumber(d.monthlyRatePct, `debts[${d.id}].monthlyRatePct`);
    assertNonNegative(d.minimumPayment, `debts[${d.id}].minimumPayment`);
  }

  const debtsWithInsufficientMinimumPayment = debts
    .filter((d) => d.balance > 0 && d.minimumPayment < d.balance * percentToFraction(d.monthlyRatePct))
    .map((d) => d.id);

  let working = debts
    .map((d) => ({ id: d.id, name: d.name, balance: d.balance, ratePct: d.monthlyRatePct, minimumPayment: d.minimumPayment }))
    .filter((d) => d.balance > 0.005);

  if (working.length === 0) {
    return { strategy, order: [], months: 0, totalPaid: 0, totalInterest: 0, payoffAchieved: true, monthlySnapshots: [], debtsWithInsufficientMinimumPayment: [] };
  }

  const order = [...working]
    .sort((a, b) => (strategy === 'avalanche' ? b.ratePct - a.ratePct : a.balance - b.balance))
    .map((d) => d.id);

  const budget = working.reduce((s, d) => s + d.minimumPayment, 0) + extraPayment;
  const byId = Object.fromEntries(working.map((d) => [d.id, d]));

  let months = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  const monthlySnapshots: DebtPayoffMonthSnapshot[] = [];

  while (working.some((d) => d.balance > 0.005) && months < MAX_MONTHS) {
    months++;
    for (const d of working) {
      if (d.balance <= 0.005) continue;
      const interest = d.balance * percentToFraction(d.ratePct);
      d.balance += interest;
      totalInterest += interest;
    }
    let available = budget;
    const payoffsThisMonth: string[] = [];
    for (const id of order) {
      const d = byId[id];
      if (!d || d.balance <= 0.005) continue;
      const payment = Math.min(d.balance, available);
      d.balance = roundCurrency(d.balance - payment);
      available -= payment;
      totalPaid += payment;
      if (d.balance <= 0.005) payoffsThisMonth.push(id);
      if (available <= 0.005) break;
    }
    monthlySnapshots.push({
      month: months,
      balances: Object.fromEntries(working.map((d) => [d.id, Math.max(0, d.balance)])),
      payoffsThisMonth,
    });
  }

  const payoffAchieved = !working.some((d) => d.balance > 0.005);

  return {
    strategy,
    order,
    months: payoffAchieved ? months : null,
    totalPaid: roundCurrency(totalPaid),
    totalInterest: roundCurrency(totalInterest),
    payoffAchieved,
    monthlySnapshots,
    debtsWithInsufficientMinimumPayment,
  };
}

export interface CompareDebtStrategiesResult {
  avalanche: DebtPayoffResult;
  snowball: DebtPayoffResult;
  /** Economia de juros da avalanche em relação à bola de neve (positivo = avalanche paga menos juros). */
  interestSavingsOfAvalancheVsSnowball: number | null;
}

/** Executa as duas estratégias (avalanche e snowball) para os mesmos dados e compara os juros totais pagos. */
export function compareDebtStrategies(params: { debts: DebtInput[]; extraPayment?: number }): CompareDebtStrategiesResult {
  const avalanche = simulateDebtPayoff({ debts: params.debts, strategy: 'avalanche', extraPayment: params.extraPayment });
  const snowball = simulateDebtPayoff({ debts: params.debts, strategy: 'snowball', extraPayment: params.extraPayment });
  const bothAchieved = avalanche.payoffAchieved && snowball.payoffAchieved;
  return {
    avalanche,
    snowball,
    interestSavingsOfAvalancheVsSnowball: bothAchieved ? roundCurrency(snowball.totalInterest - avalanche.totalInterest) : null,
  };
}
