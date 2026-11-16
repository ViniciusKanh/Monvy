/**
 * Sistema de amortização PRICE (parcela fixa / Tabela Price).
 * Extraído e generalizado de `priceInstallment` (`src/lib/credit.js`) e de
 * `src/pages/PriceSac.jsx`.
 */
import { assertNonNegative, assertPositiveInteger, assertFiniteNumber } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';
import { percentToFraction } from '../core/rates.js';

export interface PriceInstallmentRow {
  period: number;
  installment: number;
  interest: number;
  amortization: number;
  remainingBalance: number;
}

export interface PriceResult {
  principal: number;
  monthlyRatePct: number;
  months: number;
  /** Valor da parcela fixa (igual em todos os períodos). */
  installment: number;
  totalPaid: number;
  totalInterest: number;
  schedule: PriceInstallmentRow[];
}

/**
 * Calcula o valor da parcela fixa do sistema PRICE. Equivalente a `priceInstallment` de
 * `src/lib/credit.js`, mas validando as entradas em vez de retornar 0 silenciosamente.
 *
 * Fórmula: PMT = P * i / (1 - (1+i)^-n), com caso especial i=0 => PMT = P/n.
 */
export function priceInstallmentAmount(principal: number, monthlyRatePct: number, months: number): number {
  assertNonNegative(principal, 'principal');
  assertFiniteNumber(monthlyRatePct, 'monthlyRatePct');
  assertPositiveInteger(months, 'months');
  const i = percentToFraction(monthlyRatePct);
  if (principal === 0) return 0;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

/**
 * Calcula a simulação completa do financiamento pelo sistema PRICE: parcela fixa, tabela de
 * amortização completa (juros, amortização e saldo devedor por período), juros totais e total
 * pago. Quando `monthlyRatePct` é 0, a amortização é constante (principal/months) e os juros
 * são 0 em todos os períodos — ex.: financiamento de R$1.200,00 em 12 parcelas de R$100,00 a
 * taxa 0%, conforme caso de referência do escopo.
 */
export function calculatePrice(input: { principal: number; monthlyRatePct: number; months: number }): PriceResult {
  const principal = assertNonNegative(input.principal, 'principal');
  const monthlyRatePct = assertFiniteNumber(input.monthlyRatePct, 'monthlyRatePct');
  const months = assertPositiveInteger(input.months, 'months');
  const i = percentToFraction(monthlyRatePct);

  const installment = priceInstallmentAmount(principal, monthlyRatePct, months);
  const schedule: PriceInstallmentRow[] = [];
  let balance = principal;
  let totalPaid = 0;
  for (let period = 1; period <= months; period++) {
    const interest = balance * i;
    let amortization = installment - interest;
    // última parcela: zera o saldo exatamente, absorvendo resíduo de arredondamento de ponto flutuante
    if (period === months) amortization = balance;
    balance = roundCurrency(balance - amortization);
    totalPaid += (period === months ? amortization + interest : installment);
    schedule.push({
      period,
      installment: roundCurrency(period === months ? amortization + interest : installment),
      interest: roundCurrency(interest),
      amortization: roundCurrency(amortization),
      remainingBalance: Math.max(0, balance),
    });
  }

  return {
    principal: roundCurrency(principal),
    monthlyRatePct,
    months,
    installment: roundCurrency(installment),
    totalPaid: roundCurrency(totalPaid),
    totalInterest: roundCurrency(totalPaid - principal),
    schedule,
  };
}
