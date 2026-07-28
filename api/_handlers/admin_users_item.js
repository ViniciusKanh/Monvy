import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';

// PUT /api/admin/users/:id  -> atualiza role, allowed_screens, is_active (somente admin)
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    if (auth.role !== 'admin') return sendJson(res, 403, { error: 'Acesso restrito ao administrador' });
    const { id } = req.query;

    if (req.method === 'DELETE') {
      if (id === auth.sub) return sendJson(res, 400, { error: 'Voce nao pode remover a si mesmo' });
      await db().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method !== 'PUT' && req.method !== 'PATCH')
      return sendJson(res, 405, { error: 'Metodo nao permitido' });

    const body = await readBody(req);
    const sets = [];
    const args = [];
    if (body.role !== undefined) { sets.push('role = ?'); args.push(body.role); }
    if (body.is_active !== undefined) { sets.push('is_active = ?'); args.push(body.is_active ? 1 : 0); }
    if (body.allowed_screens !== undefined) {
      sets.push('allowed_screens = ?');
      args.push(JSON.stringify(body.allowed_screens || []));
    }
    if (body.full_name !== undefined) { sets.push('full_name = ?'); args.push(body.full_name); }
    if (body.require_2fa !== undefined) { sets.push('require_2fa = ?'); args.push(body.require_2fa ? 1 : 0); }
    if (body.reset_2fa) { sets.push('totp_enabled = 0'); sets.push('totp_secret = NULL'); }
    if (!sets.length) return sendJson(res, 400, { error: 'Nada para atualizar' });
    sets.push('updated_date = ?'); args.push(nowIso());
    args.push(id);
    await db().execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });

    const r = await db().execute({ sql: 'SELECT id,email,full_name,role,allowed_screens,is_active FROM users WHERE id = ?', args: [id] });
    const u = r.rows[0];
    let screens = []; try { screens = JSON.parse(u.allowed_screens || '[]'); } catch {}
    return sendJson(res, 200, { id: u.id, email: u.email, full_name: u.full_name, role: u.role, allowed_screens: screens, is_active: !!u.is_active });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
