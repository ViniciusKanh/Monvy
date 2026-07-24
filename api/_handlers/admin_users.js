import { db, ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson } from '../_lib/auth.js';

// GET /api/admin/users  -> lista todos os usuarios (somente admin)
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    if (auth.role !== 'admin') return sendJson(res, 403, { error: 'Acesso restrito ao administrador' });
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Metodo nao permitido' });

    const r = await db().execute(`SELECT id,email,full_name,role,allowed_screens,is_active,created_date FROM users ORDER BY created_date ASC`);
    const users = r.rows.map((u) => {
      let screens = [];
      try { screens = JSON.parse(u.allowed_screens || '[]'); } catch {}
      return { id: u.id, email: u.email, full_name: u.full_name, role: u.role, allowed_screens: screens, is_active: !!u.is_active, created_date: u.created_date };
    });
    return sendJson(res, 200, users);
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
