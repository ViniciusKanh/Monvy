import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// PUT /api/auth/profile -> atualiza o proprio perfil
export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const body = await readBody(req);
    const fields = ['full_name', 'first_name', 'last_name', 'phone', 'profession', 'photo_url'];
    const sets = [], args = [];
    for (const f of fields) if (body[f] !== undefined) { sets.push(`${f} = ?`); args.push(body[f]); }
    if (sets.length) {
      sets.push('updated_date = ?'); args.push(nowIso()); args.push(auth.sub);
      await db().execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
    }
    const r = await db().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [auth.sub] });
    const u = r.rows[0];
    let screens = []; try { screens = JSON.parse(u.allowed_screens || '[]'); } catch {}
    return sendJson(res, 200, { user: { id: u.id, email: u.email, full_name: u.full_name, first_name: u.first_name, last_name: u.last_name, phone: u.phone, profession: u.profession, role: u.role, photo_url: u.photo_url, allowed_screens: screens } });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
