/**
 * Conversão e composição de taxas de juros.
 *
 * Convenções adotadas (documentadas conforme seção 4 do escopo):
 * - "Percentual" (`Pct`): número na escala humana, ex.: 12 significa 12%.
 * - "Fração" (`Fraction`): número decimal equivalente, ex.: 0.12 significa 12%.
 * - "Taxa nominal": taxa informada sem capitalização implícita (ex.: taxa anual simples / 12 x meses).
 * - "Taxa efetiva": taxa que já reflete o efeito da capitalização composta no período considerado.
 * - Toda conversão de periodicidade (anual -> mensal, mensal -> anual) é feita por composição
 *   (juros compostos), nunca por divisão/multiplicação simples por 12 — reaproveitando o mesmo
 *   princípio de `aaToAm`/`amToAa`/`toMonthly`/`effectiveMonthly` de `src/lib/bcbRates.js` e
 *   `src/lib/credit.js` do aplicativo Monvy.
 */
import { assertFiniteNumber, assertValidRateFraction } from './validation.js';

/** Converte um percentual (12 = 12%) para fração decimal (0.12). */
export function percentToFraction(pct: number): number {
  assertFiniteNumber(pct, 'pct');
  return pct / 100;
}

/** Converte uma fração decimal (0.12) para percentual (12). */
export function fractionToPercent(fraction: number): number {
  assertFiniteNumber(fraction, 'fraction');
  return fraction * 100;
}

/**
 * Converte uma taxa efetiva anual (percentual, ex.: 12 = 12% a.a.) para a taxa efetiva mensal
 * equivalente (percentual), respeitando capitalização composta: (1+aa)^(1/12) - 1.
 * Equivalente a `aaToAm` de `src/lib/bcbRates.js`.
 */
export function annualToMonthly(annualPct: number): number {
  assertFiniteNumber(annualPct, 'annualPct');
  const annualFraction = percentToFraction(annualPct);
  assertValidRateFraction(annualFraction, 'annualPct');
  return (Math.pow(1 + annualFraction, 1 / 12) - 1) * 100;
}

/**
 * Converte uma taxa efetiva mensal (percentual) para a taxa efetiva anual equivalente (percentual),
 * respeitando capitalização composta: (1+am)^12 - 1. Equivalente a `amToAa`.
 */
export function monthlyToAnnual(monthlyPct: number): number {
  assertFiniteNumber(monthlyPct, 'monthlyPct');
  const monthlyFraction = percentToFraction(monthlyPct);
  assertValidRateFraction(monthlyFraction, 'monthlyPct');
  return (Math.pow(1 + monthlyFraction, 12) - 1) * 100;
}

export type RatePeriodicity = 'monthly' | 'annual';

/**
 * Converte uma taxa (percentual) informada em periodicidade `anual` ou `mensal` para a taxa
 * mensal efetiva equivalente (percentual). Equivalente a `toMonthly` de `src/lib/credit.js`.
 */
export function toMonthlyRate(ratePct: number, periodicity: RatePeriodicity): number {
  assertFiniteNumber(ratePct, 'ratePct');
  return periodicity === 'annual' ? annualToMonthly(ratePct) : ratePct;
}

/**
 * Compõe duas taxas (percentuais) do mesmo período, como juros compostos: (1+a)(1+b) - 1.
 * Usado, por exemplo, para combinar uma taxa de juros com a correção de um indexador
 * (TR, IPCA), reproduzindo `effectiveMonthly` de `src/lib/credit.js`.
 */
export function composeRates(ratePctA: number, ratePctB: number): number {
  assertFiniteNumber(ratePctA, 'ratePctA');
  assertFiniteNumber(ratePctB, 'ratePctB');
  const a = percentToFraction(ratePctA);
  const b = percentToFraction(ratePctB);
  return (((1 + a) * (1 + b)) - 1) * 100;
}

/**
 * Taxa efetiva mensal combinando uma taxa-base (informada em `periodicity`) com a correção
 * anual de um indexador (ex.: TR, IPCA), convertida para mensal. Reproduz `effectiveMonthly`
 * de `src/lib/credit.js`, mas como função pura e tipada: o indexador deixa de ser uma lookup
 * table fixa — o consumidor informa a taxa anual do indexador explicitamente.
 */
export function effectiveMonthlyRate(params: {
  baseRatePct: number;
  periodicity: RatePeriodicity;
  indexerAnnualPct?: number;
}): { baseMonthlyPct: number; indexerMonthlyPct: number; effectiveMonthlyPct: number } {
  const { baseRatePct, periodicity, indexerAnnualPct = 0 } = params;
  const baseMonthlyPct = toMonthlyRate(baseRatePct, periodicity);
  const indexerMonthlyPct = indexerAnnualPct > 0 ? annualToMonthly(indexerAnnualPct) : 0;
  const effectiveMonthlyPct = composeRates(baseMonthlyPct, indexerMonthlyPct);
  return { baseMonthlyPct, indexerMonthlyPct, effectiveMonthlyPct };
}
