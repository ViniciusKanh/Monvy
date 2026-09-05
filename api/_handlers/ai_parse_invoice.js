import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// POST /api/ai/parse-invoice
// body: { pdfBase64, apiKey, categories:[{id,name}], model? }
// Usa Google Gemini (tier gratuito) com visao para ler a fatura em PDF
// e devolver os lancamentos separados e ja mapeados a categorias.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro-latest'];

// Lista os modelos que a chave realmente pode usar (prioriza flash, depois pro).
// Tenta v1beta e v1 — resolve os 404 de "model not found".
async function listModels(apiKey) {
  for (const ver of ['v1beta', 'v1']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`);
      if (!r.ok) continue;
      const data = await r.json();
      const names = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));
      const flash = names.filter((n) => /flash/i.test(n));
      const pro = names.filter((n) => /pro/i.test(n) && !/flash/i.test(n));
      if (flash.length || pro.length) return [...flash, ...pro];
    } catch { /* tenta a proxima versao */ }
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });

  try {
    const { pdfBase64, apiKey, categories = [], model } = await readBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'Chave da API Gemini nao configurada. Adicione em Configuracoes.' });
    if (!pdfBase64) return sendJson(res, 400, { error: 'Envie o PDF da fatura.' });

    const catList = categories.map((c) => c.name).filter(Boolean);
    const prompt = `Voce le faturas de cartao (Nubank e outros) e extrai APENAS as COMPRAS REAIS da secao de transacoes. Leia a fatura inteira e liste cada compra UMA UNICA VEZ (nao duplique).

IGNORE COMPLETAMENTE (nao sao compras, sao mecanica de pagamento/divida) qualquer linha que contenha:
"Pagamento recebido", "Fatura anterior", "Saldo", "Total a pagar", "Total de compras", "Pagamento minimo", "Limite",
"Desconto de antecipacao", "Antecipada - Parcela", "Antecipada -", "Encerramento de divida", "Estorno de juros da divida", "Estorno de pagamento de transferencia", "Reversao de Desconto", "Desconto Antecipacao", "Pix", "Saque".

Estornos/creditos de uma COMPRA real (ex.: "Credito de <loja>", "Estorno de <loja>") => inclua com amount NEGATIVO e category "Estorno".
Compras normais (lojas, apps, assinaturas, IOF, mercado, transporte) => amount POSITIVO.
ATENCAO: NAO confunda "Antecipada - <loja> - Parcela X/N" (ignore, e antecipacao) com uma compra parcelada normal como "<loja> - Parcela 1/23" (INCLUA como compra). Inclua TODAS as compras, ate as pequenas (ex.: Google, Carrefour, Uber).

Para cada item: date (YYYY-MM-DD), description curta e limpa (remova " - Parcela x/y"), amount, category (a melhor entre: ${catList.join(', ') || 'Alimentacao, Transporte, Compras, Lazer, Saude, Assinaturas, Estorno, Outros'}), installment_current e installments_total (ex 2/10; senao 1/1).
Informe "invoice_total" = o valor de "Total a pagar" do resumo da fatura.

Responda SO JSON: {"invoice_total":0,"items":[{"date":"YYYY-MM-DD","description":"","amount":0,"category":"","installment_current":1,"installments_total":1}]}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    };

    let firstErr = '';
    // Prefere os modelos que a propria chave lista; depois os fixos como reserva
    const discovered = model ? [] : await listModels(apiKey);
    const seen = new Set();
    const candidates = (model ? [model] : [...discovered, ...MODELS]).filter((m) => m && !seen.has(m) && seen.add(m));
    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      let r;
      try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
      catch (e) { if (!firstErr) firstErr = `rede: ${e.message}`; continue; }
      if (!r.ok) { const t = (await r.text()).slice(0, 160); if (!firstErr) firstErr = `${m} ${r.status}: ${t}`; continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { parsed = null; } }
      if (!parsed) { if (!firstErr) firstErr = `${m}: resposta invalida`; continue; }
      // normaliza texto p/ filtros
      const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const NOISE = ['pagamento recebido', 'fatura anterior', 'total a pagar', 'total de compras', 'pagamento minimo', 'desconto de antecipa', 'antecipada - parcela', 'antecipada -', 'encerramento de divida', 'estorno de juros da divida', 'estorno de pagamento de transfer', 'reversao de desconto', 'desconto antecipacao', 'saldo em aberto'];
      const seenItems = new Set();
      const items = (parsed.items || parsed || [])
        .map((it) => ({
          date: it.date, description: (it.description || 'Compra').replace(/\s*-\s*parcela\s*\d+\/\d+/i, '').trim() || 'Compra',
          amount: Number(it.amount) || 0,
          category: it.category || 'Outros',
          installment_current: Number(it.installment_current) || 1,
          installments_total: Number(it.installments_total) || 1,
        }))
        .filter((it) => it.amount !== 0)
        .filter((it) => { const d = norm(it.description); return !NOISE.some((k) => d.includes(k)); })
        .filter((it) => { const key = `${it.date}|${norm(it.description)}|${it.amount}|${it.installment_current}/${it.installments_total}`; if (seenItems.has(key)) return false; seenItems.add(key); return true; });
      const total = items.reduce((s, it) => s + it.amount, 0);
      const declaredTotal = Number(parsed.invoice_total) || null;
      return sendJson(res, 200, { items, total, declaredTotal, model: m });
    }
    return sendJson(res, 502, { error: 'Nao consegui usar o Gemini. Verifique se a chave e valida e tem acesso a um modelo Flash. Detalhe: ' + (firstErr || 'sem modelos disponiveis') });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
