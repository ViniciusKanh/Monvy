import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// POST /api/ai/parse-invoice
// body: { pdfBase64, apiKey, categories:[{id,name}], model? }
// Usa Google Gemini (tier gratuito) com visao para ler a fatura em PDF
// e devolver os lancamentos separados e ja mapeados a categorias.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

// Descobre um modelo valido da chave (fallback quando os fixos dao 404)
async function discoverModel(apiKey) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!r.ok) return null;
    const data = await r.json();
    const models = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
    const flash = models.find((m) => /flash/i.test(m.name)) || models[0];
    return flash ? flash.name.replace(/^models\//, '') : null;
  } catch { return null; }
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
    const prompt = `Voce e um extrator de faturas de cartao de credito brasileiras.
Extraia CADA item da lista de lancamentos/transacoes da fatura, INCLUSIVE estornos, creditos e reembolsos.
REGRAS DE SINAL (MUITO IMPORTANTE):
- Compras, IOF, juros e tarifas => amount POSITIVO.
- Estornos, creditos, reembolsos e devolucoes (aparecem com sinal de menos "-", ou "−") => amount NEGATIVO.
NAO inclua linhas de resumo/pagamento: "pagamento de fatura anterior", "pagamento recebido", "saldo", "total desta fatura", "limite".
A SOMA de todos os amounts (respeitando o sinal) DEVE ser IGUAL ao total desta fatura mostrado no PDF. Confira antes de responder.
Para cada item retorne: date (YYYY-MM-DD), description (curta e limpa), amount (numero; NEGATIVO para estorno/credito),
category (a MAIS adequada entre: ${catList.join(', ') || 'Alimentacao, Transporte, Compras, Lazer, Saude, Assinaturas, Estorno, Outros'}; use "Estorno" para creditos e estornos),
installment_current e installments_total (se for parcelado, ex 2/10; senao 1 e 1).
Responda SOMENTE JSON no formato: {"items":[{"date":"","description":"","amount":0,"category":"","installment_current":1,"installments_total":1}]}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    };

    let lastErr = 'Falha ao chamar o Gemini';
    // Prefere o modelo realmente disponivel na chave (descoberto), depois os fixos
    const discovered = model ? null : await discoverModel(apiKey);
    const seen = new Set();
    const candidates = (model ? [model] : [discovered, ...MODELS]).filter((m) => m && !seen.has(m) && seen.add(m));
    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { lastErr = `Gemini (${m}) ${r.status}: ${(await r.text()).slice(0, 200)}`; continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); }
      const items = (parsed.items || parsed || []).map((it) => ({
        date: it.date, description: it.description || 'Compra', amount: Number(it.amount) || 0,
        category: it.category || 'Outros',
        installment_current: Number(it.installment_current) || 1,
        installments_total: Number(it.installments_total) || 1,
      })).filter((it) => it.amount !== 0);
      const total = items.reduce((s, it) => s + it.amount, 0);
      return sendJson(res, 200, { items, total, model: m });
    }
    return sendJson(res, 502, { error: 'Nao consegui usar o Gemini. Verifique se a chave e valida e tem acesso a um modelo Flash. Detalhe: ' + lastErr });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
