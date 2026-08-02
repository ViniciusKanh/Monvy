import { db, ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getSetting, setSetting } from '../_lib/settings.js';

// GET/PUT /api/admin/defaults -> telas padrao aplicadas a cada novo usuario
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const u = (await db().execute({ sql: 'SELECT role FROM users WHERE id=?', args: [auth.sub] })).rows[0];
    if (!u || u.role !== 'admin') return sendJson(res, 403, { error: 'Apenas administradores' });

    if (req.method === 'GET') {
      const raw = await getSetting('default_allowed_screens');
      let screens = null; try { screens = raw ? JSON.parse(raw) : null; } catch {}
      return sendJson(res, 200, { screens });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const { screens } = await readBody(req);
      if (!Array.isArray(screens)) return sendJson(res, 400, { error: 'screens deve ser uma lista' });
      await setSetting('default_allowed_screens', JSON.stringify(screens));
      return sendJson(res, 200, { ok: true, screens });
    }
    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
