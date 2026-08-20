import { getAuth, sendJson, readBody } from '../_lib/auth.js';

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001', 'gemini-1.5-flash'];

// POST /api/ai/assistant { question, context, apiKey, history }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
  try {
    const { question, context, apiKey, history = [], persona } = await readBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'Configure a chave da API Gemini em Configuracoes.' });
    if (!question) return sendJson(res, 400, { error: 'Pergunta vazia' });

    const personaLine = persona && persona.name
      ? `Voce e o robo "${persona.name}"${persona.focus ? `, especialista em ${persona.focus}` : ''} do Monvy. Fale em primeira pessoa, com personalidade amigavel, e trate o usuario pelo nome quando fizer sentido.${persona.personality ? ` Personalidade/estilo: ${persona.personality}.` : ''}`
      : 'Voce e o assistente financeiro do Monvy.';
    const sys = `${personaLine} Responda em portugues do Brasil, de forma objetiva, amigavel e util.
Use SOMENTE os dados do contexto (JSON) para responder sobre as financas do usuario. Se faltar dado, diga com franqueza.
Valores em reais (R$). Seja conciso (ate ~6 linhas), use bullet points quando ajudar. Nao invente numeros.
CONTEXTO:\n${JSON.stringify(context || {})}`;

    // historico saneado: alterna user/model e nunca repete o mesmo papel em sequencia
    const hist = [];
    for (const m of (history || []).slice(-8)) {
      const role = m.role === 'user' ? 'user' : 'model';
      if (hist.length && hist[hist.length - 1].role === role) continue;
      hist.push({ role, parts: [{ text: String(m.text || '').slice(0, 2000) }] });
    }
    if (hist.length && hist[0].role !== 'user') hist.shift();
    const contents = [...hist, { role: 'user', parts: [{ text: question }] }];

    let lastErr = 'Falha ao chamar o Gemini';
    for (const m of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: 0.5 } }) });
      if (!r.ok) { lastErr = `Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`; continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastErr = 'Resposta vazia do Gemini'; continue; }
      return sendJson(res, 200, { answer: text, model: m });
    }
    return sendJson(res, 502, { error: lastErr });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
