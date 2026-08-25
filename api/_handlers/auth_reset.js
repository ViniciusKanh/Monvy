import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { sendJson, readBody, hashPassword } from '../_lib/auth.js';
import { sendMail, tpl } from '../_lib/mailer.js';

// POST /api/auth/reset-password { token, password }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo não permitido' });
  try {
    await ensureSchema();
    const { token, password } = await readBody(req);
    if (!token) return sendJson(res, 400, { error: 'Token ausente' });
    if (!password || String(password).length < 8) return sendJson(res, 400, { error: 'A senha deve ter ao menos 8 caracteres' });
    const r = await db().execute({ sql: 'SELECT id, email, reset_expires FROM users WHERE reset_token = ?', args: [token] });
    const u = r.rows[0];
    if (!u) return sendJson(res, 400, { error: 'Link invalido ou já utilizado' });
    if (!u.reset_expires || new Date(u.reset_expires) < new Date()) return sendJson(res, 400, { error: 'Link expirado. Solicite novamente.' });
    await db().execute({ sql: 'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, email_verified = 1, updated_date = ? WHERE id = ?', args: [await hashPassword(password), nowIso(), u.id] });
    sendMail({ to: u.email, subject: 'Monvy — Senha redefinida', html: tpl('Senha redefinida com sucesso', `Sua senha foi alterada em ${new Date().toLocaleString('pt-BR')}. Se não foi você, entre em contato imediatamente.`) }).catch(() => {});
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
