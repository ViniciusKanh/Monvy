import { ensureSchema } from './_lib/db.js';
import { getAuth, sendJson, readBody } from './_lib/auth.js';
import { getSetting, setSetting } from './_lib/settings.js';

const KINDS = new Set(['shown', 'clicked', 'dismissed']);

// POST /api/campaign-event { campaignId, kind: 'shown'|'clicked'|'dismissed' }
// Registra engajamento real da campanha de avaliação (para a tela de Campanhas do admin).
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const body = await readBody(req);
    const campaignId = String(body.campaignId || '').slice(0, 64);
    const kind = String(body.kind || '');
    if (!campaignId || !KINDS.has(kind)) return sendJson(res, 400, { error: 'Parametros invalidos' });

    const raw = await getSetting('rate_campaign_stats');
    let all = {}; try { all = raw ? JSON.parse(raw) : {}; } catch { all = {}; }
    const cur = all[campaignId] || { shown: 0, clicked: 0, dismissed: 0 };
    cur[kind] = (Number(cur[kind]) || 0) + 1;
    all[campaignId] = cur;
    await setSetting('rate_campaign_stats', JSON.stringify(all));
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
