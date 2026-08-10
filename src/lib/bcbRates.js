// Taxas de juros de credito. Tenta a API publica do Banco Central (SGS) best-effort;
// se falhar (offline/CORS/indisponivel), usa uma tabela de referencia. Valores sempre editaveis.

export const aaToAm = (aa) => (Math.pow(1 + Number(aa) / 100, 1 / 12) - 1) * 100; // % ao ano -> % ao mes
export const amToAa = (am) => (Math.pow(1 + Number(am) / 100, 12) - 1) * 100;

// Series do SGS/BCB (taxa media de juros PF, % a.a.). Best-effort — podem mudar.
const SGS = {
  imovel: 25497,      // Financiamento imobiliario com taxas de mercado - PF
  veiculo: 25471,     // Aquisicao de veiculos - PF
  pessoal: 25462,     // Credito pessoal nao consignado - PF
  consignado: 25457,  // Credito pessoal consignado total - PF
};

// Referencia aproximada (% a.a.) caso a API nao responda. Ajuste conforme o mercado.
export const REFERENCE_AA = { imovel: 11.5, veiculo: 26, pessoal: 75, consignado: 25 };

export async function fetchMarketRate(kind) {
  const code = SGS[kind];
  const ref = REFERENCE_AA[kind] ?? 20;
  if (!code) return { am: aaToAm(ref), aa: ref, source: 'referencia' };
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('http');
    const data = await r.json();
    const aa = Number(String(data?.[data.length - 1]?.valor || '').replace(',', '.'));
    if (!isFinite(aa) || aa <= 0) throw new Error('valor');
    return { am: aaToAm(aa), aa, source: 'bcb', date: data[data.length - 1]?.data };
  } catch {
    return { am: aaToAm(ref), aa: ref, source: 'referencia' };
  }
}
