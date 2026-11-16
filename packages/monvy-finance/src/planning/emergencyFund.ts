/**
 * Reserva de emergência. Extraído e generalizado de `src/pages/EmergencyFund.jsx`.
 *
 * Importante (seção 9 do escopo): a quantidade de meses de cobertura (3, 6, 12...) é um
 * PARÂMETRO configurável pelo consumidor, não uma regra universal de adequação financeira.
 */
import { assertNonNegative, assertPositive, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';

export interface EmergencyFundInput {
  /** Gasto médio mensal (reais). */
  averageMonthlyExpense: number;
  /** Reserva atual disponível (reais). */
  currentReserve: number;
  /** Meta de cobertura, em meses (parâmetro configurável — não há "número certo" universal). */
  targetMonths: number;
}

export interface EmergencyFundResult {
  targetAmount: number;
  currentReserve: number;
  /** Quantos meses de gasto a reserva atual cobre hoje. */
  monthsCovered: number;
  remainingToTarget: number;
  /** Percentual de conclusão da meta (0 a 100). */
  completionPct: number;
}

export function calculateEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const averageMonthlyExpense = assertNonNegative(input.averageMonthlyExpense, 'averageMonthlyExpense');
  const currentReserve = assertNonNegative(input.currentReserve, 'currentReserve');
  const targetMonths = assertPositive(input.targetMonths, 'targetMonths');

  const targetAmount = averageMonthlyExpense * targetMonths;
  const monthsCovered = averageMonthlyExpense > 0 ? currentReserve / averageMonthlyExpense : 0;
  const remainingToTarget = Math.max(0, targetAmount - currentReserve);
  const completionPct = targetAmount > 0 ? Math.min(100, (currentReserve / targetAmount) * 100) : 100;

  return {
    targetAmount: roundCurrency(targetAmount),
    currentReserve: roundCurrency(currentReserve),
    monthsCovered: Math.round(monthsCovered * 100) / 100,
    remainingToTarget: roundCurrency(remainingToTarget),
    completionPct: Math.round(completionPct * 100) / 100,
  };
}

export interface EmergencyFundProjectionInput extends EmergencyFundInput {
  /** Quanto o usuário consegue guardar por mês rumo à meta (reais). */
  monthlyContribution: number;
}

export interface EmergencyFundProjectionResult extends EmergencyFundResult {
  /** Meses necessários para atingir a meta no ritmo de aporte informado, ou `null` se o aporte for <= 0 e a meta ainda não foi atingida. */
  monthsToTarget: number | null;
}

/** Calcula a reserva de emergência e projeta quantos meses faltam para atingir a meta, dado um ritmo de aporte. */
export function projectEmergencyFund(input: EmergencyFundProjectionInput): EmergencyFundProjectionResult {
  const base = calculateEmergencyFund(input);
  const monthlyContribution = assertFiniteNumber(input.monthlyContribution, 'monthlyContribution');
  if (base.remainingToTarget <= 0) return { ...base, monthsToTarget: 0 };
  if (monthlyContribution <= 0) return { ...base, monthsToTarget: null };
  return { ...base, monthsToTarget: Math.ceil(base.remainingToTarget / monthlyContribution) };
}
