import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { sendJson, readBody } from '../_lib/auth.js';
import { rateLimit, clientIp } from '../_lib/ratelimit.js';
import { sendMail, tpl } from '../_lib/mailer.js';

function baseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${(req.headers['x-forwarded-proto'] || 'https')}://${host}` : '';
}

// POST /api/auth/forgot-password { email }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  if (!rateLimit('forgot:' + clientIp(req), 5, 60000)) return sendJson(res, 429, { error: 'Muitas tentativas. Aguarde.' });
  try {
    await ensureSchema();
    const { email } = await readBody(req);
    const mail = String(email || '').toLowerCase().trim();
    const r = await db().execute({ sql: 'SELECT id, full_name FROM users WHERE email = ?', args: [mail] });
    const u = r.rows[0];
    if (u) {
      const token = newId() + newId();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
      await db().execute({ sql: 'UPDATE users SET reset_token = ?, reset_expires = ?, updated_date = ? WHERE id = ?', args: [token, expires, nowIso(), u.id] });
      const link = `${baseUrl(req)}/redefinir-senha?token=${token}`;
      await sendMail({ to: mail, subject: 'Monvy — Redefinicao de senha', html: tpl('Redefinir sua senha', `Ola${u.full_name ? ' ' + u.full_name : ''}, recebemos um pedido para redefinir sua senha. O link expira em 1 hora. Se nao foi voce, ignore este e-mail.`, { ctaText: 'Criar nova senha', ctaUrl: link }) });
    }
    // resposta neutra sempre
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
