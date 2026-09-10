import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// POST /api/ai/parse-danfe
// body: { pdfBase64, apiKey }
// Le uma DANFE (PDF da nota fiscal) com o Gemini e extrai os tributos.
// Preferir sempre o XML (leitura nativa e exata); a DANFE e o plano B.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro-latest'];

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
    } catch { /* proxima versao */ }
  }
  return [];
}

const num = (v) => { const x = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(x) ? 0 : Math.abs(x); };

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });

  try {
    const { pdfBase64, apiKey } = await readBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'Chave da API Gemini nao configurada. Adicione em Configuracoes.' });
    if (!pdfBase64) return sendJson(res, 400, { error: 'Envie o PDF da DANFE.' });

    const prompt = `Voce le DANFE (Documento Auxiliar da Nota Fiscal Eletronica) em PDF e extrai os dados fiscais.
Extraia:
- emitter: razao social do emitente (a loja/empresa)
- emitter_cnpj: CNPJ do emitente (so numeros)
- number: numero da nota
- issued_date: data de emissao (YYYY-MM-DD)
- total_value: valor total da nota (R$)
- icms, ipi, pis, cofins, ii: valores dos tributos, se aparecerem (R$)
- aproximado: "Valor Aproximado dos Tributos" (Lei 12.741) se constar (R$)

Regras: valores em reais com ponto decimal; se nao houver, use 0. NAO invente valores.
Responda SO JSON: {"emitter":"","emitter_cnpj":"","number":"","issued_date":"","total_value":0,"icms":0,"ipi":0,"pis":0,"cofins":0,"ii":0,"aproximado":0}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    };

    let firstErr = '';
    const discovered = await listModels(apiKey);
    const seen = new Set();
    const candidates = [...discovered, ...MODELS].filter((m) => m && !seen.has(m) && seen.add(m));
    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      let r;
      try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
      catch (e) { if (!firstErr) firstErr = `rede: ${e.message}`; continue; }
      if (!r.ok) { const t = (await r.text()).slice(0, 160); if (!firstErr) firstErr = `${m} ${r.status}: ${t}`; continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let p;
      try { p = JSON.parse(text); } catch { try { p = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { p = null; } }
      if (!p) { if (!firstErr) firstErr = `${m}: resposta invalida`; continue; }
      const taxes = { icms: num(p.icms), ipi: num(p.ipi), pis: num(p.pis), cofins: num(p.cofins), ii: num(p.ii), aproximado: num(p.aproximado) };
      const soma = taxes.icms + taxes.ipi + taxes.pis + taxes.cofins + taxes.ii;
      const total_tax = Math.round((soma > 0 ? soma : taxes.aproximado) * 100) / 100;
      const dt = String(p.issued_date || '').slice(0, 10);
      return sendJson(res, 200, {
        note: {
          emitter: String(p.emitter || '').trim() || 'Emitente',
          emitter_cnpj: String(p.emitter_cnpj || '').replace(/\D/g, ''),
          number: String(p.number || '').trim(),
          issued_date: dt, total_value: num(p.total_value), taxes, total_tax, source: 'danfe',
        }, model: m,
      });
    }
    return sendJson(res, 502, { error: 'Nao consegui ler a DANFE com o Gemini. Detalhe: ' + (firstErr || 'sem modelos') });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
