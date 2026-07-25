// Leitor de fatura 100% local: extrai texto do PDF (pdf.js) e interpreta
// os lancamentos por heuristica. Sem tokens, sem API de terceiros.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const SKIP = /(pagamento|pagto|saldo anterior|fatura anterior|total da fatura|limite|encargos|multa|juros|anuidade|estorno|credito recebido|valor total|pontos|desconto)/i;

// Mapa de palavras-chave -> categoria (usado como sugestao)
const KEYWORDS = [
  [/uber|99|cabify|99app|posto|ipiranga|shell|combust|estacion|metro|onibus|passagem/i, 'Transporte'],
  [/ifood|restaurante|lanche|pizza|burger|mercado|supermerc|padaria|acougue|hortifruti|zaffari|carrefour|assai|atacad/i, 'Alimentacao'],
  [/netflix|spotify|hbo|disney|prime|youtube|deezer|globoplay|amazon music|paramount/i, 'Assinaturas'],
  [/farmacia|drogaria|drogasil|pacheco|raia|hospital|clinica|laborat|consulta|dentista/i, 'Saude'],
  [/amazon|mercadolivre|magalu|shopee|aliexpress|americanas|renner|riachuelo|zara|shopping|loja/i, 'Compras'],
  [/cinema|show|ingresso|bar |pub|balada|steam|playstation|xbox|nintendo/i, 'Lazer'],
  [/escola|faculdade|curso|udemy|alura|livraria|papelaria/i, 'Educacao'],
  [/vivo|claro|tim|oi |energia|enel|cemig|light|sabesp|copasa|internet|net |aluguel|condominio/i, 'Contas & Servicos'],
];
function keywordCategory(desc) { for (const [re, cat] of KEYWORDS) if (re.test(desc)) return cat; return null; }

function toNumber(br) { return parseFloat(String(br).replace(/\./g, '').replace(',', '.')); }

function normalizeDate(raw, year) {
  let m = raw.match(/^(\d{2})[\/.](\d{2})(?:[\/.](\d{2,4}))?/);
  if (m) { let y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(year); return `${y}-${m[2]}-${m[1]}`; }
  m = raw.match(/^(\d{2})\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
  if (m) { const mm = String(MESES[m[2].toLowerCase()]).padStart(2, '0'); return `${year}-${mm}-${m[1]}`; }
  return null;
}

async function pdfLines(pdf) {
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
      const line = byY[y].sort((a, b) => a.x - b.x).map((o) => o.s).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

// Interpreta linhas -> lancamentos
export function parseLines(lines, opts = {}) {
  const year = opts.year || new Date().getFullYear();
  const out = [];
  for (const line of lines) {
    if (SKIP.test(line)) continue;
    const dateM = line.match(/^(\d{2}[\/.]\d{2}(?:[\/.]\d{2,4})?|\d{2}\s*(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))/i);
    if (!dateM) continue;
    const date = normalizeDate(dateM[0], year);
    if (!date) continue;
    const amounts = [...line.matchAll(/(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => m[1]);
    if (!amounts.length) continue;
    const amountStr = amounts[amounts.length - 1];
    const amount = Math.abs(toNumber(amountStr));
    if (!amount || amount > 500000) continue;
    // resto da linha sem a data (evita confundir DD/MM com parcela)
    const rest = line.replace(dateM[0], ' ');
    let inst_c = 1, inst_t = 1;
    let pm = rest.match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
    if (!pm) { const bm = rest.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/); if (bm && Number(bm[2]) <= 24 && Number(bm[1]) <= Number(bm[2])) pm = bm; }
    if (pm) { inst_c = Number(pm[1]); inst_t = Number(pm[2]); }
    // descricao = linha sem data, valores e parcela
    let desc = line
      .replace(dateM[0], '')
      .replace(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}/g, '')
      .replace(/parc(?:ela)?\.?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}/i, '')
      .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/, '')
      .replace(/\s+/g, ' ').trim();
    if (desc.length < 2) desc = 'Compra';
    out.push({ date, description: desc.slice(0, 60), amount, installment_current: inst_c, installments_total: inst_t, categoryHint: keywordCategory(desc) });
  }
  return out;
}

// OCR local (Tesseract.js) para faturas escaneadas/imagem — roda no navegador
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

export async function parseInvoicePdf(file, opts = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  // 1) tenta extrair texto direto (PDF digital)
  const items = parseLines(await pdfLines(pdf), opts);
  if (items.length >= 3) return items;
  // 2) fallback: OCR local (fatura escaneada)
  if (opts.onOcr) opts.onOcr();
  try {
    const ocrItems = parseLines((await ocrPdf(pdf, opts.onProgress)).split('\n'), opts);
    return ocrItems.length ? ocrItems : items;
  } catch { return items; }
}
