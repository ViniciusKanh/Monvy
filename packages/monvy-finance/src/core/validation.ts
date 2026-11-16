/**
 * Validação de entradas para o núcleo financeiro do Monvy Finance.
 *
 * Política: nunca converter silenciosamente uma entrada inválida em zero.
 * Toda função pública do pacote deve validar seus parâmetros numéricos
 * com os helpers abaixo e lançar `FinanceValidationError` quando algo
 * estiver fora do domínio matemático esperado.
 */

/** Erro lançado quando uma entrada não atende às pré-condições de uma função financeira. */
export class FinanceValidationError extends Error {
  readonly field: string;
  readonly value: unknown;

  constructor(field: string, value: unknown, message: string) {
    super(`[monvy-finance] ${field}: ${message} (recebido: ${JSON.stringify(value)})`);
    this.name = 'FinanceValidationError';
    this.field = field;
    this.value = value;
  }
}

/** Garante que `value` é um número finito (rejeita NaN, Infinity, -Infinity, strings, undefined, null). */
export function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new FinanceValidationError(field, value, 'deve ser um número finito');
  }
  return value;
}

/** Garante que `value` é um número finito e não-negativo. */
export function assertNonNegative(value: unknown, field: string): number {
  const v = assertFiniteNumber(value, field);
  if (v < 0) {
    throw new FinanceValidationError(field, value, 'não pode ser negativo');
  }
  return v;
}

/** Garante que `value` é um número finito estritamente positivo. */
export function assertPositive(value: unknown, field: string): number {
  const v = assertFiniteNumber(value, field);
  if (v <= 0) {
    throw new FinanceValidationError(field, value, 'deve ser maior que zero');
  }
  return v;
}

/** Garante que `value` é um inteiro finito. */
export function assertInteger(value: unknown, field: string): number {
  const v = assertFiniteNumber(value, field);
  if (!Number.isInteger(v)) {
    throw new FinanceValidationError(field, value, 'deve ser um número inteiro');
  }
  return v;
}

/** Garante que `value` é um inteiro >= 0 (prazos em meses, por exemplo). */
export function assertNonNegativeInteger(value: unknown, field: string): number {
  const v = assertInteger(value, field);
  if (v < 0) {
    throw new FinanceValidationError(field, value, 'não pode ser negativo');
  }
  return v;
}

/** Garante que `value` é um inteiro >= 1 (número de parcelas/meses de uma simulação). */
export function assertPositiveInteger(value: unknown, field: string): number {
  const v = assertInteger(value, field);
  if (v < 1) {
    throw new FinanceValidationError(field, value, 'deve ser um inteiro maior ou igual a 1');
  }
  return v;
}

/** Garante que uma taxa (fração decimal, ex.: 0.01 = 1%) é finita e maior que -1 (evita divisão por zero / juros impossíveis). */
export function assertValidRateFraction(value: unknown, field: string): number {
  const v = assertFiniteNumber(value, field);
  if (v <= -1) {
    throw new FinanceValidationError(field, value, 'taxa implica fator de capitalização <= 0 (deve ser > -100%)');
  }
  return v;
}

/** Garante que o array não está vazio. */
export function assertNonEmptyArray<T>(value: T[] | undefined | null, field: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FinanceValidationError(field, value, 'deve ser um array não vazio');
  }
  return value;
}
