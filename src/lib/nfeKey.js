// Leitura da CHAVE DE ACESSO de documentos fiscais a partir do que a câmera lê:
//  - QR Code da NFC-e (cupom): URL de consulta da SEFAZ com ?p=CHAVE|versão|...
//    (v2/v3 "online" só traz a chave; no modo offline traz também dia e valor);
//    no padrão antigo (v1) vem chNFe=...&vNF=...&dhEmi=<hex>.
//  - Código de barras CODE-128 da DANFE (NF-e): os 44 dígitos da chave.
//  - QR da NFS-e nacional: chave de 50 posições.
// A chave em si já carrega UF, ano/mês, CNPJ do emitente, modelo, série e número
// (Manual de Orientação do Contribuinte, leiaute da chave de acesso). Os itens e
// os tributos NÃO estão na chave — para eles é preciso o XML ou a leitura por IA.

const UF = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };
const MODELO = { 55: 'NF-e', 65: 'NFC-e', 57: 'CT-e', 58: 'MDF-e', 59: 'CF-e SAT', 67: 'CT-e OS' };

// valor de cada posição: dígitos valem 0-9; letras (CNPJ alfanumérico, a partir de 2026) valem código ASCII − 48
const val = (ch) => ch.charCodeAt(0) - 48;

export function keyCheckDigit(first43) {
  let sum = 0, w = 2;
  for (let i = first43.length - 1; i >= 0; i--) { sum += val(first43[i]) * w; w = w === 9 ? 2 : w + 1; }
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidKey44(key) {
  if (!/^\d{2}\d{4}[0-9A-Z]{14}\d{24}$/.test(key || '')) return false;
  return keyCheckDigit(key.slice(0, 43)) === Number(key[43]);
}

export function formatKey(key) { return String(key || '').replace(/(.{4})/g, '$1 ').trim(); }
export function formatCnpj(c) {
  const s = String(c || '');
  return s.length === 14 ? `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}` : s;
}

export function parseKey44(key) {
  const ufCode = Number(key.slice(0, 2));
  const yy = Number(key.slice(2, 4)); const mm = Number(key.slice(4, 6));
  const modelo = Number(key.slice(20, 22));
  const tpEmis = Number(key.slice(34, 35));
  return {
    key,
    valid: isValidKey44(key),
    ufCode, uf: UF[ufCode] || null,
    year: 2000 + yy, month: mm,
    referenceMonth: mm >= 1 && mm <= 12 ? `${2000 + yy}-${String(mm).padStart(2, '0')}` : null,
    cnpj: key.slice(6, 20),
    modelo, modeloLabel: MODELO[modelo] || `Modelo ${modelo}`,
    serie: String(Number(key.slice(22, 25))),
    numero: String(Number(key.slice(25, 34))),
    tpEmis, offline: tpEmis === 9,
  };
}

function hexToText(h) {
  if (!/^[0-9a-f]+$/i.test(h) || h.length % 2) return h;
  let out = ''; for (let i = 0; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return out;
}
const toNum = (v) => { const x = Number(String(v || '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };

// Recebe o texto bruto lido (URL do QR, dígitos do código de barras, ou chave digitada)
export function extractFromCode(raw) {
  const text = String(raw || '').trim();
  const isUrl = /^https?:\/\//i.test(text);
  const out = { raw: text, consultUrl: isUrl ? text : null, kind: null, key: null, info: null, issuedDay: null, totalValue: null, issuedAt: null, qrVersion: null };

  let q = null; try { q = isUrl ? new URL(text).searchParams : null; } catch { q = null; }

  // NFC-e QR v2/v3: p=chave|versão|tpAmb[|dia|vNF|...]
  const p = q?.get('p') || (text.match(/[?&]p=([^&]+)/i)?.[1] ? decodeURIComponent(text.match(/[?&]p=([^&]+)/i)[1]) : null);
  if (p) {
    const t = p.split('|');
    out.qrVersion = t[1] || null;
    if (/^[0-9A-Z]{44}$/.test(t[0])) out.key = t[0];
    // offline: dia (2 dígitos) e vNF com 2 casas decimais — evita confundir com idToken/hash do modo online
    if (t.length >= 6 && /^\d{2}$/.test(t[3] || '') && /^\d+\.\d{2}$/.test(t[4] || '')) { out.issuedDay = Number(t[3]); out.totalValue = toNum(t[4]); }
  }
  // NFC-e QR v1: chNFe=...&vNF=...&dhEmi=<hex>
  if (!out.key && q?.get('chNFe')) {
    out.key = q.get('chNFe'); out.qrVersion = q.get('nVersao') || '1';
    out.totalValue = toNum(q.get('vNF'));
    const dh = q.get('dhEmi'); if (dh) { const s = hexToText(dh); if (/^\d{4}-\d{2}-\d{2}/.test(s)) out.issuedAt = s.slice(0, 10); }
  }
  // NFS-e nacional (chave de 50 posições) — via parâmetro ou texto
  const nfse = q?.get('chave') || q?.get('chaveAcesso') || (text.match(/(?:^|\D)(\d{50})(?:\D|$)/)?.[1]);
  if (!out.key && nfse && /^\d{50}$/.test(nfse)) { out.kind = 'nfse'; out.key = nfse; return out; }

  // código de barras / texto livre: qualquer sequência de 44 posições
  if (!out.key) { const compact = text.replace(/\s+/g, '').toUpperCase(); const m = compact.match(/\d{6}[0-9A-Z]{14}\d{24}/); if (m) out.key = m[0]; }
  if (!out.key) return out;

  out.info = parseKey44(out.key);
  out.kind = out.info.modelo === 65 ? 'nfce' : out.info.modelo === 55 ? 'nfe' : 'outro';
  if (!out.issuedAt && out.issuedDay && out.info.referenceMonth) out.issuedAt = `${out.info.referenceMonth}-${String(out.issuedDay).padStart(2, '0')}`;
  if (!out.consultUrl && out.kind === 'nfe') out.consultUrl = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo';
  return out;
}

// Razão social pelo CNPJ (BrasilAPI — mesma fonte da tela Consulta CNPJ)
export async function lookupCnpjName(cnpj) {
  if (!/^\d{14}$/.test(cnpj || '')) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.nome_fantasia || d?.razao_social || null;
  } catch { return null; }
}
