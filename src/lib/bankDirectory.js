// Diretorio publico de bancos brasileiros: nome, codigo COMPE, ISPB e logo
// oficial — tudo vindo de fontes publicas e estaticas (BrasilAPI + o pacote
// open-source "logos-bancos-br", que redistribui os logos que as proprias
// instituicoes publicam no diretorio publico do Open Finance Brasil para
// uso nominativo). Isso NAO e uma integracao de Open Finance/Open Banking:
// nao ha consentimento do usuario, nao ha sincronizacao de saldo/extrato,
// e nenhum dado da conta do usuario sai do Monvy — e so uma lista estatica
// de "quem e quem" entre os bancos, pra identificar visualmente a conta.
const LOGO_MAP_URL = 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/data/logo-urls.min.json';
const BANKS_URL = 'https://brasilapi.com.br/api/banks/v1';

export function normalizeBankName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(s\/a|s\.a\.?|sa)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ISPB sempre com 8 digitos (zero a esquerda) pra bater com a chave usada
// pelo pacote de logos, independente do formato que a fonte de bancos der.
export function normalizeIspb(ispb) {
  const digits = String(ispb || '').replace(/\D/g, '');
  return digits ? digits.padStart(8, '0') : '';
}

async function fetchBanks() {
  const r = await fetch(BANKS_URL);
  if (!r.ok) throw new Error('Falha ao buscar bancos');
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((b) => b && b.name)
    .map((b) => ({ ispb: normalizeIspb(b.ispb), code: b.code ?? null, name: b.name, fullName: b.fullName || b.name }));
}

async function fetchLogoMap() {
  const r = await fetch(LOGO_MAP_URL);
  if (!r.ok) throw new Error('Falha ao buscar logos dos bancos');
  const raw = await r.json();
  const map = {};
  for (const [ispb, url] of Object.entries(raw || {})) map[normalizeIspb(ispb)] = url;
  return map;
}

// Usado pelo React Query: busca a lista de bancos e o mapa de logos em
// paralelo e devolve um diretorio pronto pra consulta (por ISPB ou por
// nome, com normalizacao tolerante a acento/maiusculas/S.A.).
export async function fetchBankDirectory() {
  const [banks, logoMap] = await Promise.all([
    fetchBanks().catch(() => []),
    fetchLogoMap().catch(() => ({})),
  ]);
  const byIspb = new Map();
  const byName = new Map();
  for (const b of banks) {
    const logoUrl = logoMap[b.ispb] || null;
    const entry = { ...b, logoUrl };
    if (b.ispb) byIspb.set(b.ispb, entry);
    byName.set(normalizeBankName(b.name), entry);
    if (b.fullName) byName.set(normalizeBankName(b.fullName), entry);
  }
  return {
    banks,
    byIspbGet: (ispb) => byIspb.get(normalizeIspb(ispb)) || null,
    byNameGet: (name) => byName.get(normalizeBankName(name)) || null,
    // resolve por ISPB salva (preferencial) ou, pra contas antigas sem
    // ISPB gravado, por aproximacao do nome digitado — nunca inventa um
    // logo pra um banco que nao foi encontrado no diretorio.
    resolve: (ispb, name) => (ispb && byIspb.get(normalizeIspb(ispb))) || (name ? byName.get(normalizeBankName(name)) : null) || null,
  };
}
