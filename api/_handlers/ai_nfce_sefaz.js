import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { rateLimit } from '../_lib/ratelimit.js';
import { geminiJson } from '../_lib/gemini.js';

// POST /api/ai/nfce-sefaz   body: { url, apiKey? }
// Abre a página pública de consulta da NFC-e (o link do QR Code do cupom) direto
// na SEFAZ — do servidor, para não esbarrar no CORS do navegador — e extrai
// emitente, data, valor e os "Tributos Totais Incidentes (Lei 12.741/2012)".
// Com a chave do Gemini, a IA lê a página (itens, valores) e, se o cupom não
// trouxer os tributos impressos, faz uma ESTIMATIVA por item, marcada como tal.
//
// Observação: o XML oficial completo só é entregue pela SEFAZ com certificado
// digital ou captcha; a página do QR Code traz os mesmos dados do cupom.

const MAX_HTML = 1_500_000;
const okHost = (h) => /(^|\.)gov\.br$/i.test(h) && !/^\d+\.\d+\.\d+\.\d+$/.test(h);

async function fetchSefaz(rawUrl) {
  let url = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    let u; try { u = new URL(url); } catch { throw Object.assign(new Error('Link do QR Code inválido.'), { code: 'bad_url' }); }
    if (!/^https?:$/.test(u.protocol) || !okHost(u.hostname)) throw Object.assign(new Error('O link não é de um portal da SEFAZ (.gov.br).'), { code: 'bad_host' });
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    let r;
    try {
      r = await fetch(u.toString(), { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    } catch (e) { throw Object.assign(new Error(e.name === 'AbortError' ? 'A SEFAZ demorou demais para responder.' : 'Não consegui conectar ao portal da SEFAZ.'), { code: 'network' }); }
    finally { clearTimeout(t); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), u).toString(); continue; }
    if (!r.ok) throw Object.assign(new Error(`A SEFAZ respondeu com erro ${r.status}.`), { code: 'http' });
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, MAX_HTML);
    const ct = r.headers.get('content-type') || '';
    let charset = (ct.match(/charset=([\w-]+)/i) || [])[1];
    if (!charset) charset = (buf.toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html; try { html = new TextDecoder(charset.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    return { html, finalUrl: u.toString() };
  }
  throw Object.assign(new Error('Redirecionamentos demais na SEFAZ.'), { code: 'redirects' });
}

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', Ccedil: 'Ç', Atilde: 'Ã', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú' };
export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(tr|p|div|li|h\d|table|span class="?txtTit)[^>]*>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENT[e] ?? m)
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
const brNum = (s) => { if (s == null) return 0; let x = String(s).replace(/[^\d.,-]/g, ''); if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const v = Number(x); return Number.isFinite(v) ? Math.abs(v) : 0; };
const MONEY = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})';
const grab = (txt, re) => { const m = txt.match(re); return m ? m[1] : null; };

// leitura determinística (sem IA) — layout comum dos portais de NFC-e
export function parsePage(html, text) {
  const flat = text.replace(/\n/g, ' ');
  const total = brNum(grab(flat, new RegExp(`Valor a pagar\\s*R?\\$?\\s*:?\\s*\\|?\\s*${MONEY}`, 'i')) || grab(flat, new RegExp(`Valor total\\s*(?:R\\$)?\\s*:?\\s*\\|?\\s*${MONEY}`, 'i')));
  const trib = brNum(grab(flat, new RegExp(`Tributos\\s+Totais\\s+Incidentes[\\s\\S]{0,90}?${MONEY}`, 'i')) || grab(flat, new RegExp(`(?:Valor\\s+)?aprox(?:imado)?\\.?\\s+(?:dos|de)\\s+tributos[^0-9]{0,60}${MONEY}`, 'i')) || grab(flat, new RegExp(`Trib(?:utos)?\\.?\\s+aprox[^0-9]{0,40}${MONEY}`, 'i')));
  const fed = brNum(grab(flat, new RegExp(`(?<!Lei )Federa(?:l|is)\\s*(?:R\\$)?\\s*:?\\s*\\|?\\s*${MONEY}`, 'i')));
  const est = brNum(grab(flat, new RegExp(`Estadua(?:l|is)\\s*(?:R\\$)?\\s*:?\\s*\\|?\\s*${MONEY}`, 'i')));
  const mun = brNum(grab(flat, new RegExp(`Municipa(?:l|is)\\s*(?:R\\$)?\\s*:?\\s*\\|?\\s*${MONEY}`, 'i')));
  const cnpj = (grab(flat, /CNPJ\s*:?\s*([\d.\/-]{14,18})/i) || '').replace(/\D/g, '');
  const emitter = htmlToText(grab(html, /class=["']?txtTopo["']?[^>]*>([^<]{3,160})</i) || '');
  const dt = grab(flat, /Emiss[aã]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const number = grab(flat, /N[uú]mero\s*:?\s*(\d{1,9})/i) || '';
  const items = Number(grab(flat, /Qtd\.?\s*total\s*de\s*itens\s*:?\s*\|?\s*(\d+)/i)) || null;
  const captcha = /captcha|hcaptcha|recaptcha|n[aã]o sou um rob/i.test(html) && !total;
  return { total, trib, split: { federal: fed, estadual: est, municipal: mun }, cnpj, emitter, issued: dt ? dt.split('/').reverse().join('-') : '', number, items, captcha };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido' });
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Não autenticado' });
  if (!rateLimit('nfce:' + auth.sub, 20, 60000)) return sendJson(res, 429, { error: 'Muitas consultas seguidas. Aguarde um minuto.' });
  try {
    const { url, apiKey } = await readBody(req);
    if (!url) return sendJson(res, 400, { error: 'Envie o link do QR Code.' });
    let page;
    try { page = await fetchSefaz(String(url)); }
    catch (e) { return sendJson(res, 200, { ok: false, reason: e.code || 'network', error: e.message }); }
    const text = htmlToText(page.html);
    const p = parsePage(page.html, text);
    if (p.captcha) return sendJson(res, 200, { ok: false, reason: 'captcha', error: 'A SEFAZ deste estado pediu verificação humana (captcha) para mostrar a nota.' });

    let ai = null; let aiError = null;
    if (apiKey && text.length > 80) {
      const prompt = `Abaixo está o TEXTO da página pública de consulta de uma NFC-e (cupom fiscal eletrônico brasileiro), obtida na SEFAZ.
Extraia em JSON:
- emitter (razão social/nome do emitente), emitter_cnpj (só números), number (número da nota), issued_date (YYYY-MM-DD)
- total_value: valor pago/total da nota (R$)
- printed_tax: o valor de "Tributos Totais Incidentes (Lei Federal 12.741/2012)" EXATAMENTE como impresso; 0 se a página não trouxer
- printed_federal, printed_estadual, printed_municipal: a divisão desses tributos, se impressa; senão 0
- items: lista [{ "name", "qty", "unit_value", "total" }] com todos os produtos
- estimated_tax: SOMENTE se printed_tax for 0, estime a carga aproximada de tributos (estilo IBPT, alíquotas médias nacionais por tipo de produto: alimentos básicos ~15-20%, bebidas ~30-45%, higiene/limpeza ~30-40%, combustíveis ~35-45%, medicamentos ~30%, eletrônicos ~35-45%, refeições/restaurante ~30%) aplicada a cada item; se printed_tax > 0, use 0
- estimated_basis: uma frase curta explicando a estimativa (ou "")
Use números com ponto decimal. Não invente itens nem valores que não estejam no texto.
Responda SO JSON: {"emitter":"","emitter_cnpj":"","number":"","issued_date":"","total_value":0,"printed_tax":0,"printed_federal":0,"printed_estadual":0,"printed_municipal":0,"items":[],"estimated_tax":0,"estimated_basis":""}

TEXTO DA PÁGINA:
${text.slice(0, 40000)}`;
      try { ai = (await geminiJson(apiKey, [{ text: prompt }])).data; } catch (e) { aiError = e.message; }
    }

    const nOr = (a, b) => (a > 0 ? a : brNum(b));
    const total = nOr(p.total, ai?.total_value);
    const printed = nOr(p.trib, ai?.printed_tax);
    const estimated = printed > 0 ? 0 : brNum(ai?.estimated_tax);
    if (!total && !printed && !ai) return sendJson(res, 200, { ok: false, reason: 'parse', error: 'Abri a página da SEFAZ, mas não reconheci os dados da nota neste layout.' + (apiKey ? '' : ' Configure a chave do Gemini para a IA ler a página.') });

    const items = Array.isArray(ai?.items) ? ai.items.slice(0, 200).map((i) => ({ name: String(i.name || '').slice(0, 120), qty: brNum(i.qty) || 1, unit_value: brNum(i.unit_value), total: brNum(i.total) })) : [];
    return sendJson(res, 200, {
      ok: true,
      note: {
        emitter: p.emitter || String(ai?.emitter || '').trim(),
        emitter_cnpj: p.cnpj || String(ai?.emitter_cnpj || '').replace(/\D/g, ''),
        number: p.number || String(ai?.number || ''),
        issued_date: p.issued || String(ai?.issued_date || '').slice(0, 10),
        total_value: total,
        taxes: { aproximado: Math.round((printed || estimated) * 100) / 100 },
        tax_split: { federal: p.split.federal || brNum(ai?.printed_federal), estadual: p.split.estadual || brNum(ai?.printed_estadual), municipal: p.split.municipal || brNum(ai?.printed_municipal) },
        tax_origin: printed > 0 ? 'impresso' : estimated > 0 ? 'estimado_ia' : 'nenhum',
        tax_basis: printed > 0 ? 'Valor impresso no cupom (Lei 12.741/2012), lido na SEFAZ.' : String(ai?.estimated_basis || ''),
        items, items_count: p.items || items.length || null,
      },
      via: ai ? 'sefaz+gemini' : 'sefaz', aiError,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
