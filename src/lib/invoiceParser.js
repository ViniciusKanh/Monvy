// Leitor de fatura 100% local: extrai texto do PDF (pdf.js), reconhece se e uma
// fatura e interpreta os lancamentos por heuristica. Sem tokens, sem API externa.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

// Linhas de resumo/opcoes que NAO sao compras
// NAO ignora estorno/credito: eles sao capturados como valores NEGATIVOS para a soma bater com o PDF.
// "pagamento"/"pagto" continua ignorado (pagamento de fatura anterior nao entra na soma).
const SKIP = /(pagamento|pagto|saldo|fatura anterior|total\b|limite|parcelar em|valor de entrada|valor da parcela|\bcet\b|pr[oó]xima|fechamento|anuidade|\bpontos\b|per[ií]odo vigente|vencimento|emiss[aã]o|resumo|dispon[ií]vel|utilizado)/i;

// Palavra-chave -> categoria sugerida
const KEYWORDS = [
  [/uber|99app|99 \*|cabify|posto|ipiranga|shell|combust|estacion|metro|onibus|passagem|buser|localiza|movida/i, 'Transporte'],
  [/ifood|rappi|restaurante|lanchon|lanche|pizza|burger|mercado|supermerc|padaria|acougue|hortifruti|zaffari|carrefour|assai|atacad|conveniencia|rotisseria|horti/i, 'Alimentacao'],
  [/netflix|spotify|hbo|disney|prime video|youtube|deezer|globoplay|paramount|apple\.com\/bill|apple com|steam|playstation|xbox|uhuu/i, 'Assinaturas'],
  [/farmacia|drogaria|drogasil|pacheco|drogaria_sp|drogaria sao|raia|hospital|clinica|laborat|dentista/i, 'Saude'],
  [/amazon|mercadolivre|mercado\*|magalu|shopee|aliexpress|americanas|renner|riachuelo|zara|shopping|loja|ebazar|tiktok shop|vidanamoda|repstore|blocksand|rmbox|trevoeletronic/i, 'Compras'],
  [/cinema|show|ingresso|\bbar\b|pub|balada|uhuu/i, 'Lazer'],
  [/escola|faculdade|curso|udemy|alura|livraria|papelaria|jusbrasil|github/i, 'Educacao'],
  [/vivo|claro|\btim\b|\boi\b|energia|enel|cemig|light|sabesp|copasa|internet|aluguel|condominio/i, 'Contas & Servicos'],
];
function keywordCategory(desc) { for (const [re, cat] of KEYWORDS) if (re.test(desc)) return cat; return null; }
function toNumber(br) { return parseFloat(String(br).replace(/\./g, '').replace(',', '.')); }

function normalizeDate(raw, year) {
  let m = raw.match(/^(\d{2})[\/.](\d{2})(?:[\/.](\d{2,4}))?/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(year); return `${y}-${m[2]}-${m[1]}`; }
  m = raw.match(/^(\d{2})\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
  if (m) { const mm = String(MESES[m[2].toLowerCase()]).padStart(2, '0'); return `${year}-${mm}-${m[1]}`; }
  return null;
}

// dinheiro com sinal opcional (inclui o menos unicode U+2212)
const MONEY = /([−-]?)\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;

export function parseLines(lines, opts = {}) {
  const year = opts.year || new Date().getFullYear();
  const out = [];
  for (let raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 6) continue;
    const dateM = line.match(/^(\d{2}[\/.]\d{2}(?:[\/.]\d{2,4})?|\d{2}\s*(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))/i);
    if (!dateM) continue;              // linha precisa comecar com data
    if (SKIP.test(line)) continue;     // ignora resumo/estorno/opcoes
    const date = normalizeDate(dateM[0], year);
    if (!date) continue;
    const monies = [...line.matchAll(MONEY)];
    if (!monies.length) continue;
    const last = monies[monies.length - 1];
    const sign = last[1] ? -1 : 1;      // "-" = credito/estorno -> valor negativo
    const amount = sign * toNumber(last[2]);
    if (!amount || Math.abs(amount) > 500000) continue;

    // parcela
    let ic = 1, it = 1;
    const pm = line.match(/parcela\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
    if (pm) { ic = Number(pm[1]); it = Number(pm[2]); }

    // descricao = tira data, mascara do cartao (•••• 5205), valores e parcela
    let desc = line
      .replace(dateM[0], ' ')
      .replace(/[•·•�*]{2,}\s*\d{3,4}/g, ' ')        // •••• 5205
      .replace(/[−-]?\s*(?:R\$)?\s*[−-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, ' ')
      .replace(/\s*[−-]\s*$/g, '')
      .replace(/-\s*parcela\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}/i, ' ')
      .replace(/parcela\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}/i, ' ')
      .replace(/\s+/g, ' ').trim();
    if (desc.length < 2) continue;

    out.push({ date, description: desc.slice(0, 60), amount, installment_current: ic, installments_total: it, categoryHint: amount < 0 ? 'Estorno' : keywordCategory(desc) });
  }
  return out;
}

// Reconhece se o texto parece uma fatura de cartao
export function looksLikeInvoice(text, items) {
  if (items && items.length >= 3) return true;
  return /fatura|vencimento|cart[aã]o de cr[eé]dito|nubank|ita[uú]|bradesco|santander|inter|c6 bank|banco do brasil|caixa|limite (total|do cart)/i.test(text || '');
}

async function extractLines(pdf) {
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = {};
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      (byY[y] = byY[y] || []).push({ x: it.transform[4], s: it.str });
    }
    for (const y of Object.keys(byY).map(Number).sort((a, b) => b - a)) {
      const l = byY[y].sort((a, b) => a.x - b.x).map((o) => o.s).join(' ').replace(/\s+/g, ' ').trim();
      if (l) lines.push(l);
    }
  }
  return lines;
}

async function ocrPdf(pdf, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por');
  let text = '';
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const { data } = await worker.recognize(canvas);
      text += '\n' + (data.text || '');
      if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100));
    }
  } finally { await worker.terminate(); }
  return text;
}

// Retorna { isInvoice, items }
export async function parseInvoicePdf(file, opts = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = await extractLines(pdf);
  let items = parseLines(lines, opts);
  let text = lines.join('\n');
  if (items.length < 3) {
    // fallback OCR (fatura escaneada/imagem)
    if (opts.onOcr) opts.onOcr();
    try { const ocr = await ocrPdf(pdf, opts.onProgress); text += '\n' + ocr; const ocrItems = parseLines(ocr.split('\n'), opts); if (ocrItems.length > items.length) items = ocrItems; } catch { /* sem OCR */ }
  }
  return { isInvoice: looksLikeInvoice(text, items), items };
}
