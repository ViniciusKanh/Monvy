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

    const prompt = `Voce le notas fiscais brasileiras em PDF e extrai os dados fiscais. Pode ser:
(A) NF-e de PRODUTOS (DANFE) — tributos: ICMS, IPI, PIS, COFINS, II.
(B) NFS-e de SERVICOS (nota de servico municipal) — tributo principal: ISS (Valor do ISS); e retencoes: IRRF, CSLL, COFINS, PIS/PASEP, INSS/Contribuicao Previdenciaria Retida.

Identifique o tipo e extraia:
- note_type: "produto" ou "servico"
- emitter: razao social do PRESTADOR/emitente
- emitter_cnpj: CNPJ do emitente (so numeros)
- number: numero da nota
- issued_date: data de emissao (YYYY-MM-DD)
- total_value: valor total (da nota ou do servico) em R$
- icms, ipi, ii: tributos de produto, se houver (R$)
- iss: Valor do ISS (R$) — so em nota de servico
- pis, cofins: valores de PIS e COFINS (R$)
- irrf: IRRF retido (R$)
- csll: CSLL / Contribuicoes Sociais Retidas (R$)
- inss: Contribuicao Previdenciaria Retida / INSS (R$)
- ibs: IBS - Imposto sobre Bens e Servicos (reforma tributaria), "IBS informado" (R$)
- cbs: CBS - Contribuicao sobre Bens e Servicos (reforma tributaria), "CBS informada" (R$)
- aproximado: "Valor Aproximado dos Tributos" (Lei 12.741) se constar (R$)

Regras: valores em reais com ponto decimal; se um campo nao existir na nota, use 0. NAO invente valores. Para nota de servico com aliquota de ISS, o "Valor do ISS" e o imposto principal.
Responda SO JSON: {"note_type":"produto","emitter":"","emitter_cnpj":"","number":"","issued_date":"","total_value":0,"icms":0,"ipi":0,"ii":0,"iss":0,"pis":0,"cofins":0,"irrf":0,"csll":0,"inss":0,"ibs":0,"cbs":0,"aproximado":0}`;

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
      const taxes = {
        icms: num(p.icms), ipi: num(p.ipi), ii: num(p.ii), iss: num(p.iss),
        pis: num(p.pis), cofins: num(p.cofins), irrf: num(p.irrf), csll: num(p.csll), inss: num(p.inss),
        ibs: num(p.ibs), cbs: num(p.cbs), aproximado: num(p.aproximado),
      };
      const soma = taxes.icms + taxes.ipi + taxes.ii + taxes.iss + taxes.pis + taxes.cofins + taxes.irrf + taxes.csll + taxes.inss + taxes.ibs + taxes.cbs;
      const total_tax = Math.round((soma > 0 ? soma : taxes.aproximado) * 100) / 100;
      const dt = String(p.issued_date || '').slice(0, 10);
      return sendJson(res, 200, {
        note: {
          note_type: String(p.note_type || '').toLowerCase().includes('serv') ? 'servico' : 'produto',
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
