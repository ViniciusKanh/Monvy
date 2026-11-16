/**
 * Núcleo monetário do Monvy Finance.
 *
 * Política de precisão adotada (documentada conforme exigido na seção 4 do escopo):
 *
 * 1. Todas as funções financeiras do pacote operam internamente com `number` (double de 64 bits),
 *    como o restante do código-fonte do Monvy (`src/lib/credit.js`, `src/lib/analytics.js`, etc.).
 *    Isto preserva compatibilidade de comportamento com a aplicação original.
 * 2. Para evitar o acúmulo de erro de ponto flutuante em somatórios e composições de juros,
 *    os valores intermediários NÃO são arredondados a cada iteração — o arredondamento só
 *    acontece na fronteira de saída (quando o número vira um valor "para exibir ao usuário"),
 *    usando `roundCurrency`.
 * 3. Quando uma soma de parcelas precisa necessariamente fechar com um total exato (ex.: divisão
 *    de contas, SAC), o pacote usa uma representação em CENTAVOS INTEIROS (`toCents`/`fromCents`)
 *    e distribui o resíduo de arredondamento de forma determinística (ver `distributeCents`),
 *    em vez de usar `toFixed(2)` em cada parcela isoladamente — o que pode fazer a soma das partes
 *    divergir do total por causa de arredondamentos independentes.
 * 4. Nenhuma função pura deste pacote lê o relógio do sistema ou grava em localStorage: datas e
 *    parâmetros de "agora" são sempre injetados pelo consumidor.
 */

const CENTS_PER_UNIT = 100;

/** Arredonda um valor monetário para 2 casas decimais (ponto de saída, não usar em cálculos intermediários). */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}

/** Converte um valor decimal (reais) para centavos inteiros. */
export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * CENTS_PER_UNIT);
}

/** Converte centavos inteiros de volta para reais (decimal). */
export function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

/**
 * Distribui `totalCents` entre `n` partes o mais igualmente possível, em centavos inteiros,
 * garantindo que a soma das partes seja exatamente `totalCents` (sem perda/sobra de centavos).
 * Os centavos residuais são distribuídos um a um, na ordem dos índices, para as primeiras partes
 * (determinístico e reproduzível — ver seção 13 do escopo).
 */
export function distributeCents(totalCents: number, n: number): number[] {
  if (!Number.isInteger(totalCents)) {
    throw new RangeError('distributeCents: totalCents deve ser um inteiro (centavos)');
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError('distributeCents: n deve ser um inteiro positivo');
  }
  const base = Math.trunc(totalCents / n);
  let remainder = totalCents - base * n;
  const parts = new Array<number>(n).fill(base);
  // remainder pode ser negativo (totalCents negativo); distribui 1 centavo por vez
  const step = remainder >= 0 ? 1 : -1;
  for (let i = 0; remainder !== 0 && i < n; i++) {
    parts[i] += step;
    remainder -= step;
  }
  return parts;
}

/**
 * Divide `totalValue` (em reais) entre `n` partes com soma exata, usando centavos inteiros
 * como representação intermediária. Útil para divisão de contas e rateios (seção 13).
 */
export function splitExact(totalValue: number, n: number): number[] {
  const cents = toCents(totalValue);
  return distributeCents(cents, n).map(fromCents);
}

/** Soma valores monetários somando primeiro em centavos inteiros, evitando erro de ponto flutuante acumulado. */
export function sumCurrency(values: number[]): number {
  const totalCents = values.reduce((acc, v) => acc + toCents(v), 0);
  return fromCents(totalCents);
}
