import { db, ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const r = await db().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [auth.sub] });
    const u = r.rows[0];
    if (!u) return sendJson(res, 401, { error: 'Usuario nao encontrado' });
    let screens = [];
    try { screens = JSON.parse(u.allowed_screens || '[]'); } catch {}
    return sendJson(res, 200, {
      user: { id: u.id, email: u.email, full_name: u.full_name, first_name: u.first_name, last_name: u.last_name, phone: u.phone, profession: u.profession, role: u.role, photo_url: u.photo_url, allowed_screens: screens, totp_enabled: u.totp_enabled === 1, require_2fa: u.require_2fa === 1 },
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
