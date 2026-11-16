/**
 * Comparação objetiva entre os sistemas PRICE e SAC.
 *
 * Importante (seção 6 do escopo): esta função compara os DOIS SISTEMAS para os MESMOS parâmetros
 * de principal, taxa e prazo — ela não declara que um sistema é "sempre" mais vantajoso. O SAC
 * tende a pagar menos juros totais (porque amortiza mais rápido no início), mas começa com
 * parcelas maiores; a escolha real depende também de CET, seguros, tarifas e do perfil de fluxo
 * de caixa do tomador — custos que esta função só considera se forem explicitamente informados
 * (ver `extraCosts`).
 */
import { calculatePrice, type PriceResult } from './price.js';
import { calculateSac, type SacResult } from './sac.js';
import { assertNonNegative } from '../core/validation.js';
import { roundCurrency } from '../core/money.js';

export interface CompareAmortizationInput {
  principal: number;
  monthlyRatePct: number;
  months: number;
  /** Custos adicionais explícitos (seguros, tarifas, CET), em reais, somados ao total pago de cada sistema quando informados. */
  extraCosts?: { price?: number; sac?: number };
}

export interface CompareAmortizationResult {
  price: PriceResult;
  sac: SacResult;
  /** Diferença de juros totais (price - sac). Positivo significa que o PRICE paga mais juros. */
  interestDifference: number;
  /** Diferença entre a primeira parcela do SAC e a parcela fixa do PRICE (sac - price). */
  firstInstallmentDifference: number;
  totalPaidWithExtraCosts: { price: number; sac: number };
}

/** Compara PRICE e SAC para os mesmos parâmetros de financiamento, sem declarar um vencedor universal. */
export function compareAmortizationSystems(input: CompareAmortizationInput): CompareAmortizationResult {
  const price = calculatePrice(input);
  const sac = calculateSac(input);
  const extraPrice = assertNonNegative(input.extraCosts?.price ?? 0, 'extraCosts.price');
  const extraSac = assertNonNegative(input.extraCosts?.sac ?? 0, 'extraCosts.sac');

  return {
    price,
    sac,
    interestDifference: roundCurrency(price.totalInterest - sac.totalInterest),
    firstInstallmentDifference: roundCurrency(sac.firstInstallment - price.installment),
    totalPaidWithExtraCosts: {
      price: roundCurrency(price.totalPaid + extraPrice),
      sac: roundCurrency(sac.totalPaid + extraSac),
    },
  };
}
