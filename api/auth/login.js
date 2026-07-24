import { db, ensureSchema } from '../_lib/db.js';
import { comparePassword, signToken, sendJson, readBody } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const { email, password } = await readBody(req);
    if (!email || !password) return sendJson(res, 400, { error: 'Informe email e senha' });
    const r = await db().execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [String(email).toLowerCase().trim()],
    });
    const user = r.rows[0];
    if (!user || !user.is_active) return sendJson(res, 401, { error: 'Credenciais invalidas' });
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return sendJson(res, 401, { error: 'Credenciais invalidas' });
    const safe = publicUser(user);
    return sendJson(res, 200, { token: signToken(user), user: safe });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}

function publicUser(u) {
  let screens = [];
  try { screens = JSON.parse(u.allowed_screens || '[]'); } catch {}
  return {
    id: u.id, email: u.email, full_name: u.full_name, role: u.role,
    photo_url: u.photo_url, allowed_screens: screens,
  };
}
