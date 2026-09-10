import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// POST /api/ai/parse-informe
// body: { pdfBase64, apiKey, year? }
// Le um "Informe de Rendimentos Financeiros" (banco/corretora) com o Gemini e
// devolve, por instituicao/conta, os tributos retidos. Adaptado a varios tipos
// de conta: corrente, poupanca, CDB/RDB, LCI/LCA, fundos, Tesouro, acoes/FIIs.
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
    const { pdfBase64, apiKey, year } = await readBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'Chave da API Gemini nao configurada. Adicione em Configuracoes.' });
    if (!pdfBase64) return sendJson(res, 400, { error: 'Envie o PDF do informe de rendimentos.' });

    const prompt = `Voce le "Informe de Rendimentos Financeiros" de bancos e corretoras brasileiras (Nubank, Itau, BB, Bradesco, Santander, Inter, C6, XP, Rico, Nubank, Mercado Pago, etc.) e extrai os TRIBUTOS RETIDOS por instituicao/conta.

O documento pode conter varios tipos de conta/aplicacao: conta corrente, poupanca, CDB/RDB, LCI/LCA (isentos de IR), fundos de investimento, Tesouro Direto, acoes/FIIs, previdencia. Consolide por INSTITUICAO (e, se houver, por tipo de conta).

Para cada bloco, extraia:
- institution: nome da instituicao/banco/corretora
- account_type: tipo predominante (ex.: "Conta/Poupanca", "CDB", "Fundos", "Tesouro", "Acoes/FII", "Previdencia", ou "Diversos")
- ir_fonte: total de Imposto de Renda Retido na Fonte (R$) daquela instituicao
- outros: outros tributos retidos (R$), se houver (NAO inclua IOF aqui — IOF nao entra no informe)
- rendimentos: total de rendimentos/juros do periodo (R$), apenas para contexto

Regras:
- Valores em reais, use ponto decimal. Se nao houver, use 0.
- LCI/LCA e poupanca costumam ter IR 0 — registre 0 mesmo assim se aparecerem.
- NAO invente instituicoes nem valores que nao estejam no documento.
- Se o ano do informe aparecer, informe em "year".

Responda SO JSON: {"year":${year || 0},"accounts":[{"institution":"","account_type":"","ir_fonte":0,"outros":0,"rendimentos":0}]}`;

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
      let parsed;
      try { parsed = JSON.parse(text); } catch { try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { parsed = null; } }
      if (!parsed) { if (!firstErr) firstErr = `${m}: resposta invalida`; continue; }
      const accounts = (parsed.accounts || [])
        .map((a) => ({
          institution: String(a.institution || '').trim() || 'Instituicao',
          account_type: String(a.account_type || '').trim() || 'Diversos',
          ir_fonte: num(a.ir_fonte), outros: num(a.outros), rendimentos: num(a.rendimentos),
        }))
        .filter((a) => a.ir_fonte > 0 || a.outros > 0 || a.rendimentos > 0);
      return sendJson(res, 200, { year: Number(parsed.year) || Number(year) || null, accounts, model: m });
    }
    return sendJson(res, 502, { error: 'Nao consegui ler o informe com o Gemini. Verifique a chave/modelo. Detalhe: ' + (firstErr || 'sem modelos') });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
