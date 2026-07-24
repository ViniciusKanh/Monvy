import { db, ensureSchema, newId } from '../_lib/db.js';
import { sendJson, readBody } from '../_lib/auth.js';
import { sendMail, tpl } from '../_lib/mailer.js';

function baseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${(req.headers['x-forwarded-proto'] || 'https')}://${host}` : '';
}

// POST /api/auth/resend { email } -> reenvia confirmacao
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const { email } = await readBody(req);
    const mail = String(email || '').toLowerCase().trim();
    const r = await db().execute({ sql: 'SELECT id, full_name, email_verified FROM users WHERE email = ?', args: [mail] });
    const u = r.rows[0];
    // resposta neutra (nao revela se existe)
    if (!u || u.email_verified === 1) return sendJson(res, 200, { ok: true });
    const token = newId() + newId();
    await db().execute({ sql: 'UPDATE users SET verify_token = ? WHERE id = ?', args: [token, u.id] });
    const link = `${baseUrl(req)}/verificar?token=${token}`;
    await sendMail({ to: mail, subject: 'Confirme seu e-mail — Monvy', html: tpl('Confirme seu e-mail', `Reenviamos seu link de confirmacao. Clique no botao para ativar sua conta no Monvy.`, { ctaText: 'Confirmar meu e-mail', ctaUrl: link }) });
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
