import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody, comparePassword, hashPassword } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl } from '../_lib/mailer.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const { current, next } = await readBody(req);
    if (!next || String(next).length < 8) return sendJson(res, 400, { error: 'A nova senha deve ter ao menos 8 caracteres' });
    const r = await db().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [auth.sub] });
    const u = r.rows[0];
    if (!u) return sendJson(res, 404, { error: 'Usuario nao encontrado' });
    const ok = await comparePassword(current || '', u.password_hash);
    if (!ok) return sendJson(res, 400, { error: 'Senha atual incorreta' });
    await db().execute({ sql: 'UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?', args: [await hashPassword(next), nowIso(), auth.sub] });
    const cfg = await getMailConfig();
    if (cfg.notifyPassword) sendMail({ to: u.email, subject: 'Monvy — Senha alterada', html: tpl('Sua senha foi alterada', `Ola${u.full_name ? ' ' + u.full_name : ''}, sua senha do Monvy foi alterada em ${new Date().toLocaleString('pt-BR')}. Se nao foi voce, redefina imediatamente.`) }).catch(() => {});
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
