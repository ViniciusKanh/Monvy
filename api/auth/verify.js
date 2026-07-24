import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { sendJson } from '../_lib/auth.js';

// GET /api/auth/verify?token=...  -> ativa a conta
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const token = req.query.token;
    if (!token) return sendJson(res, 400, { error: 'Token ausente' });
    const r = await db().execute({ sql: 'SELECT id, email_verified FROM users WHERE verify_token = ?', args: [token] });
    const u = r.rows[0];
    if (!u) return sendJson(res, 404, { error: 'Link invalido ou expirado' });
    if (u.email_verified === 1) return sendJson(res, 200, { ok: true, already: true });
    await db().execute({ sql: 'UPDATE users SET email_verified = 1, verify_token = NULL, updated_date = ? WHERE id = ?', args: [nowIso(), u.id] });
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
