/**
 * Independência Financeira (FIRE — Financial Independence, Retire Early).
 * Extraído e generalizado de `src/pages/Fire.jsx`.
 *
 * Diferenciação importante (seção 10 do escopo): este módulo trabalha com uma única taxa de
 * retorno informada pelo consumidor. Ele NÃO mistura taxa nominal com taxa real automaticamente —
 * cabe ao consumidor decidir e documentar se a `annualReturnRatePct` que está passando já é uma
 * taxa real (descontada a inflação) ou nominal. Recomenda-se fortemente informar uma taxa REAL
 * (acima da inflação), como o próprio Fire.jsx already sugere ("Retorno real (% a.a.)").
 * A projeção é determinística (não é previsão de mercado nem conselho de investimento).
 */
import { assertNonNegative, assertFiniteNumber, assertPositive } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction, annualToMonthly } from '../core/rates.js';

const MAX_YEARS = 80;
const MAX_MONTHS = MAX_YEARS * 12;

export interface FireTargetInput {
  /** Gasto mensal estimado na aposentadoria (reais). */
  monthlyExpense: number;
  /**
   * Múltiplo do gasto anual usado como meta (ex.: 25 = "regra dos 4%": 1/0.04 = 25).
   * Também pode ser derivado de `withdrawalRatePct` via `withdrawalRateToMultiple`.
   */
  multipleOfAnnualExpense: number;
}

export interface FireTargetResult {
  annualExpense: number;
  /** Patrimônio-alvo (número da independência financeira). */
  targetNetWorth: number;
  multipleOfAnnualExpense: number;
}

/** Converte uma taxa de retirada anual (ex.: 4 = 4%) no múltiplo equivalente do gasto anual (1/taxa). */
export function withdrawalRateToMultiple(withdrawalRatePct: number): number {
  assertPositive(withdrawalRatePct, 'withdrawalRatePct');
  return 100 / withdrawalRatePct;
}

/** Calcula o patrimônio-alvo (número da independência financeira) a partir do gasto mensal e do múltiplo desejado. */
export function calculateFireTarget(input: FireTargetInput): FireTargetResult {
  const monthlyExpense = assertNonNegative(input.monthlyExpense, 'monthlyExpense');
  const multipleOfAnnualExpense = assertPositive(input.multipleOfAnnualExpense, 'multipleOfAnnualExpense');
  const annualExpense = monthlyExpense * 12;
  return {
    annualExpense: roundCurrency(annualExpense),
    targetNetWorth: roundCurrency(annualExpense * multipleOfAnnualExpense),
    multipleOfAnnualExpense,
  };
}

export interface FireProjectionInput {
  /** Patrimônio investido atual (reais). */
  currentNetWorth: number;
  /** Aporte mensal (reais). */
  monthlyContribution: number;
  monthlyExpense: number;
  /** Retorno anual assumido, em percentual. Recomenda-se informar retorno REAL (já acima da inflação). */
  annualReturnRatePct: number;
  multipleOfAnnualExpense: number;
}

export interface FireYearlyPoint {
  year: number;
  netWorth: number;
}

export interface FireProjectionResult {
  targetNetWorth: number;
  /** Meses até atingir a meta, ou `null` se não for atingida em até 80 anos com os parâmetros informados. */
  monthsToTarget: number | null;
  yearsToTarget: number | null;
  /** Projeção anual do patrimônio (determinística — não é previsão de mercado). */
  yearly: FireYearlyPoint[];
  /** Renda mensal estimada que o patrimônio-alvo geraria, à mesma taxa de retorno. */
  monthlyIncomeAtTarget: number;
}

/**
 * Projeta a evolução do patrimônio até atingir (ou não) o alvo FIRE, mês a mês, com relatório
 * anual. A projeção é puramente determinística: aplica a mesma taxa de retorno constante em
 * todos os meses simulados — não é uma previsão de mercado nem uma recomendação individualizada.
 */
export function simulateFireProjection(input: FireProjectionInput): FireProjectionResult {
  const currentNetWorth = assertNonNegative(input.currentNetWorth, 'currentNetWorth');
  const monthlyContribution = assertFiniteNumber(input.monthlyContribution, 'monthlyContribution');
  const monthlyExpense = assertNonNegative(input.monthlyExpense, 'monthlyExpense');
  const annualReturnRatePct = assertFiniteNumber(input.annualReturnRatePct, 'annualReturnRatePct');
  const multipleOfAnnualExpense = assertPositive(input.multipleOfAnnualExpense, 'multipleOfAnnualExpense');

  const { targetNetWorth } = calculateFireTarget({ monthlyExpense, multipleOfAnnualExpense });
  const monthlyRatePct = annualToMonthly(annualReturnRatePct);
  const i = percentToFraction(monthlyRatePct);

  let balance = currentNetWorth;
  let months = 0;
  const yearly: FireYearlyPoint[] = [{ year: 0, netWorth: roundCurrency(balance) }];
  const alreadyReached = balance >= targetNetWorth && targetNetWorth > 0;

  if (!alreadyReached) {
    while (balance < targetNetWorth && months < MAX_MONTHS) {
      balance = balance * (1 + i) + monthlyContribution;
      months++;
      if (months % 12 === 0) yearly.push({ year: months / 12, netWorth: roundCurrency(balance) });
    }
  }
  if (months % 12 !== 0 && months > 0) {
    yearly.push({ year: Math.round((months / 12) * 10) / 10, netWorth: roundCurrency(balance) });
  }

  const reached = balance >= targetNetWorth && targetNetWorth > 0;
  const annualReturnFraction = percentToFraction(annualReturnRatePct);

  return {
    targetNetWorth: roundCurrency(targetNetWorth),
    monthsToTarget: reached ? months : (alreadyReached ? 0 : null),
    yearsToTarget: reached ? Math.round((months / 12) * 100) / 100 : (alreadyReached ? 0 : null),
    yearly,
    monthlyIncomeAtTarget: roundCurrency((targetNetWorth * annualReturnFraction) / 12),
  };
}
