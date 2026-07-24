import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// POST /api/ai/parse-invoice
// body: { pdfBase64, apiKey, categories:[{id,name}], model? }
// Usa Google Gemini (tier gratuito) com visao para ler a fatura em PDF
// e devolver os lancamentos separados e ja mapeados a categorias.
const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

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
Analise o PDF e extraia CADA lancamento/compra individualmente.
Para cada lancamento retorne: date (YYYY-MM-DD), description (curta e limpa), amount (numero positivo em reais),
category (escolha a MAIS adequada entre: ${catList.join(', ') || 'Alimentacao, Transporte, Compras, Lazer, Saude, Assinaturas, Outros'}),
installment_current e installments_total (se for parcelado, ex 2/10; senao 1 e 1).
IGNORE: pagamentos de fatura anterior, estornos, juros e saldo. Some apenas compras reais.
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
    for (const m of (model ? [model] : MODELS)) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { lastErr = `Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`; continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); }
      const items = (parsed.items || parsed || []).map((it) => ({
        date: it.date, description: it.description || 'Compra', amount: Math.abs(Number(it.amount) || 0),
        category: it.category || 'Outros',
        installment_current: Number(it.installment_current) || 1,
        installments_total: Number(it.installments_total) || 1,
      })).filter((it) => it.amount > 0);
      return sendJson(res, 200, { items, model: m });
    }
    return sendJson(res, 502, { error: lastErr });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
