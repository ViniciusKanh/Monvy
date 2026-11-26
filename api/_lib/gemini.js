// Chamada ao Gemini (Google) pedindo resposta em JSON, com descoberta dos modelos
// disponíveis para a chave do usuário e fallback entre eles.
const FALLBACK = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];

async function listModels(apiKey) {
  for (const ver of ['v1beta', 'v1']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`);
      if (!r.ok) continue;
      const data = await r.json();
      const names = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
      const flash = names.filter((n) => /flash/i.test(n) && !/image|tts|audio|live|thinking/i.test(n));
      if (flash.length) return flash;
    } catch { /* tenta a próxima versão */ }
  }
  return [];
}

// parts: [{ text }, { inline_data }...]. Retorna { data, model } ou lança erro.
export async function geminiJson(apiKey, parts, { timeoutMs = 25000 } = {}) {
  const seen = new Set();
  const candidates = [...(await listModels(apiKey)), ...FALLBACK].filter((m) => m && !seen.has(m) && seen.add(m)).slice(0, 5);
  let firstErr = '';
  for (const m of candidates) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
      });
      if (!r.ok) { if (!firstErr) firstErr = `${m} ${r.status}`; continue; }
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      try { return { data: JSON.parse(text.replace(/```json|```/g, '').trim()), model: m }; } catch { if (!firstErr) firstErr = `${m}: resposta inválida`; }
    } catch (e) { if (!firstErr) firstErr = `${m}: ${e.name === 'AbortError' ? 'tempo esgotado' : e.message}`; }
    finally { clearTimeout(t); }
  }
  throw new Error(firstErr || 'nenhum modelo disponível');
}
