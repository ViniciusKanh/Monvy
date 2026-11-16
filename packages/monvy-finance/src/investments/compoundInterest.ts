/**
 * Juros compostos com aportes periódicos.
 * Extraído e generalizado de `src/pages/CompoundInterest.jsx` (estado `res` do componente).
 */
import { assertNonNegative, assertNonNegativeInteger, assertValidRateFraction, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction, annualToMonthly } from '../core/rates.js';

export type ContributionTiming = 'begin' | 'end';

export interface CompoundInterestInput {
  /** Capital inicial (reais). */
  initialAmount: number;
  /** Aporte periódico (mensal), em reais. */
  monthlyContribution: number;
  /** Taxa de juros ao ano, em percentual (ex.: 12 = 12% a.a.). */
  annualRate: number;
  /** Número de meses simulados. */
  months: number;
  /**
   * Momento do aporte dentro de cada mês: `'end'` (padrão, igual ao app Monvy — aporte
   * creditado ao final do mês, depois da capitalização) ou `'begin'` (aporte capitaliza
   * junto com o saldo já no mesmo mês).
   */
  contributionTiming?: ContributionTiming;
}

export interface CompoundInterestPoint {
  month: number;
  balance: number;
  contributed: number;
  interest: number;
}

export interface CompoundInterestResult {
  initialAmount: number;
  monthlyContribution: number;
  totalContributed: number;
  totalInterest: number;
  finalBalance: number;
  effectiveMonthlyRatePct: number;
  annualRatePct: number;
  months: number;
  contributionTiming: ContributionTiming;
  series: CompoundInterestPoint[];
}

/**
 * Simula a evolução de um investimento com juros compostos e aportes mensais constantes.
 *
 * Convenção padrão: aporte no FIM do mês (`contributionTiming: 'end'`), igual ao comportamento
 * original de `CompoundInterest.jsx` (`saldo = saldo * (1 + iMes) + aporte`).
 *
 * Casos extremos suportados sem lançar erro: taxa zero, aporte zero, capital inicial zero,
 * prazo zero (retorna apenas o ponto inicial) e taxas negativas matematicamente válidas
 * (fator de capitalização > 0, isto é, taxa mensal efetiva > -100%).
 */
export function simulateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const initialAmount = assertNonNegative(input.initialAmount, 'initialAmount');
  const monthlyContribution = assertFiniteNumber(input.monthlyContribution, 'monthlyContribution');
  const annualRate = assertFiniteNumber(input.annualRate, 'annualRate');
  const months = assertNonNegativeInteger(input.months, 'months');
  const contributionTiming: ContributionTiming = input.contributionTiming ?? 'end';

  const monthlyRatePct = annualToMonthly(annualRate);
  const monthlyRateFraction = percentToFraction(monthlyRatePct);
  assertValidRateFraction(monthlyRateFraction, 'annualRate (convertida para mensal)');

  let balance = initialAmount;
  let contributed = initialAmount;
  const series: CompoundInterestPoint[] = [
    { month: 0, balance: roundCurrency(balance), contributed: roundCurrency(contributed), interest: 0 },
  ];

  for (let m = 1; m <= months; m++) {
    if (contributionTiming === 'begin') {
      balance = (balance + monthlyContribution) * (1 + monthlyRateFraction);
    } else {
      balance = balance * (1 + monthlyRateFraction) + monthlyContribution;
    }
    contributed += monthlyContribution;
    series.push({
      month: m,
      balance: roundCurrency(balance),
      contributed: roundCurrency(contributed),
      interest: roundCurrency(balance - contributed),
    });
  }

  return {
    initialAmount: roundCurrency(initialAmount),
    monthlyContribution: roundCurrency(monthlyContribution),
    totalContributed: roundCurrency(contributed),
    totalInterest: roundCurrency(balance - contributed),
    finalBalance: roundCurrency(balance),
    effectiveMonthlyRatePct: monthlyRatePct,
    annualRatePct: annualRate,
    months,
    contributionTiming,
    series,
  };
}
