import { ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson } from '../_lib/auth.js';
import { evaluateAgentsEvent } from '../_lib/agents.js';

// POST /api/agents/check -> avalia os robos do usuario agora (sob demanda)
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const action = parts[parts.indexOf('agents') + 1];
    if (action !== 'check') return sendJson(res, 404, { error: 'Rota nao encontrada' });
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
    const fired = await evaluateAgentsEvent(auth.sub);
    return sendJson(res, 200, { ok: true, fired });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
