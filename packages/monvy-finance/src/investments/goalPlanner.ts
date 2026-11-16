/**
 * Planejamento de metas financeiras (quanto aportar / quanto tempo leva / projeção).
 * Extraído e generalizado de `src/pages/GoalPlanner.jsx`.
 */
import { assertNonNegative, assertFiniteNumber, assertPositiveInteger } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction } from '../core/rates.js';

const MAX_ITERATIONS = 1200; // 100 anos, mesmo limite usado em GoalPlanner.jsx

export interface RequiredContributionInput {
  /** Valor-alvo da meta (reais). */
  targetAmount: number;
  /** Valor já disponível hoje (reais). */
  initialAmount: number;
  /** Prazo desejado, em meses. */
  months: number;
  /** Rendimento mensal esperado, em percentual (ex.: 0.8 = 0.8% a.m.). Use 0 para poupança sem rendimento. */
  monthlyRatePct: number;
}

export interface RequiredContributionResult {
  /** Aporte mensal necessário para atingir a meta no prazo informado. */
  requiredMonthlyContribution: number;
  totalContributed: number;
  interestEarned: number;
  months: number;
  /** `true` quando a meta já está atingida com o valor inicial, sem necessidade de aporte. */
  alreadyReached: boolean;
}

/**
 * Calcula o aporte mensal constante necessário para atingir `targetAmount` em `months` meses,
 * partindo de `initialAmount` e rendendo `monthlyRatePct` ao mês.
 *
 * Fórmula (valor futuro de uma série uniforme): A = P0*(1+i)^n + PMT*[((1+i)^n - 1)/i]
 * Quando `i === 0`, a fórmula se reduz à divisão simples do restante pelo número de meses.
 */
export function calculateRequiredContribution(input: RequiredContributionInput): RequiredContributionResult {
  const targetAmount = assertNonNegative(input.targetAmount, 'targetAmount');
  const initialAmount = assertNonNegative(input.initialAmount, 'initialAmount');
  const months = assertPositiveInteger(input.months, 'months');
  const monthlyRatePct = assertFiniteNumber(input.monthlyRatePct, 'monthlyRatePct');
  const i = percentToFraction(monthlyRatePct);

  const futureValueOfInitial = initialAmount * Math.pow(1 + i, months);
  if (futureValueOfInitial >= targetAmount) {
    return {
      requiredMonthlyContribution: 0,
      totalContributed: roundCurrency(initialAmount),
      interestEarned: roundCurrency(futureValueOfInitial - initialAmount),
      months,
      alreadyReached: true,
    };
  }

  const annuityFactor = i === 0 ? months : (Math.pow(1 + i, months) - 1) / i;
  const requiredMonthlyContribution = annuityFactor > 0
    ? Math.max(0, (targetAmount - futureValueOfInitial) / annuityFactor)
    : Math.max(0, (targetAmount - initialAmount) / months);

  const totalContributed = initialAmount + requiredMonthlyContribution * months;
  return {
    requiredMonthlyContribution: roundCurrency(requiredMonthlyContribution),
    totalContributed: roundCurrency(totalContributed),
    interestEarned: roundCurrency(Math.max(0, targetAmount - totalContributed)),
    months,
    alreadyReached: false,
  };
}

export interface TimeToGoalInput {
  targetAmount: number;
  initialAmount: number;
  /** Aporte mensal constante (reais). */
  monthlyContribution: number;
  monthlyRatePct: number;
}

export interface TimeToGoalResult {
  /** Número de meses até atingir a meta, ou `null` quando é matematicamente inalcançável no horizonte simulado. */
  months: number | null;
  finalBalance: number;
  totalContributed: number;
  interestEarned: number;
  /** `true` quando a meta já está atingida com o valor inicial. */
  alreadyReached: boolean;
}

/**
 * Calcula quantos meses são necessários para atingir `targetAmount`, aportando
 * `monthlyContribution` por mês a partir de `initialAmount`, rendendo `monthlyRatePct` a.m.
 *
 * Quando o aporte mensal é zero (ou negativo) e a taxa de juros não é suficiente para o saldo
 * crescer até a meta, a função retorna `months: null` em vez de simular indefinidamente —
 * tratando explicitamente a meta como matematicamente inalcançável (ver seção 8 do escopo).
 */
export function estimateTimeToGoal(input: TimeToGoalInput): TimeToGoalResult {
  const targetAmount = assertNonNegative(input.targetAmount, 'targetAmount');
  const initialAmount = assertNonNegative(input.initialAmount, 'initialAmount');
  const monthlyContribution = assertFiniteNumber(input.monthlyContribution, 'monthlyContribution');
  const monthlyRatePct = assertFiniteNumber(input.monthlyRatePct, 'monthlyRatePct');
  const i = percentToFraction(monthlyRatePct);

  if (initialAmount >= targetAmount) {
    return { months: 0, finalBalance: roundCurrency(initialAmount), totalContributed: roundCurrency(initialAmount), interestEarned: 0, alreadyReached: true };
  }

  // Detecta impossibilidade matemática: saldo não cresce (aporte <= 0 e juros <= 0).
  if (monthlyContribution <= 0 && i <= 0) {
    return { months: null, finalBalance: roundCurrency(initialAmount), totalContributed: roundCurrency(initialAmount), interestEarned: 0, alreadyReached: false };
  }

  let balance = initialAmount;
  let months = 0;
  while (balance < targetAmount && months < MAX_ITERATIONS) {
    balance = balance * (1 + i) + monthlyContribution;
    months++;
  }

  const reached = balance >= targetAmount;
  const totalContributed = initialAmount + monthlyContribution * months;
  return {
    months: reached ? months : null,
    finalBalance: roundCurrency(balance),
    totalContributed: roundCurrency(totalContributed),
    interestEarned: roundCurrency(Math.max(0, balance - totalContributed)),
    alreadyReached: false,
  };
}

export interface SavingsGoalSimulationInput {
  targetAmount: number;
  initialAmount: number;
  monthlyContribution: number;
  monthlyRatePct: number;
  months: number;
}

export interface SavingsGoalPoint {
  month: number;
  balance: number;
}

export interface SavingsGoalSimulationResult {
  series: SavingsGoalPoint[];
  finalBalance: number;
  targetAmount: number;
  /** Primeiro mês em que o saldo projetado atinge a meta, ou `null` se não atingir dentro de `months`. */
  monthGoalReached: number | null;
}

/** Simula a evolução do saldo rumo a uma meta, mês a mês, por um horizonte fixo (para gráficos). */
export function simulateSavingsGoal(input: SavingsGoalSimulationInput): SavingsGoalSimulationResult {
  const targetAmount = assertNonNegative(input.targetAmount, 'targetAmount');
  const initialAmount = assertNonNegative(input.initialAmount, 'initialAmount');
  const monthlyContribution = assertFiniteNumber(input.monthlyContribution, 'monthlyContribution');
  const monthlyRatePct = assertFiniteNumber(input.monthlyRatePct, 'monthlyRatePct');
  const months = assertNonNegative(input.months, 'months');
  const i = percentToFraction(monthlyRatePct);

  let balance = initialAmount;
  const series: SavingsGoalPoint[] = [{ month: 0, balance: roundCurrency(balance) }];
  let monthGoalReached: number | null = balance >= targetAmount && targetAmount > 0 ? 0 : null;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + monthlyContribution;
    series.push({ month: m, balance: roundCurrency(balance) });
    if (monthGoalReached === null && targetAmount > 0 && balance >= targetAmount) monthGoalReached = m;
  }

  return { series, finalBalance: roundCurrency(balance), targetAmount: roundCurrency(targetAmount), monthGoalReached };
}
