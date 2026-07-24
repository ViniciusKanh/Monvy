import { db, ensureSchema, newId } from '../_lib/db.js';
import { sendJson, readBody } from '../_lib/auth.js';
import { sendMail, tpl } from '../_lib/mailer.js';

function baseUrl(req) {
  const o = req.headers.origin; if (o) return o.replace(/\/$/, '');
  const h = req.headers['x-forwarded-host'] || req.headers.host;
  return h ? `${(req.headers['x-forwarded-proto'] || 'https')}://${h}` : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const { email } = await readBody(req);
    const mail = String(email || '').toLowerCase().trim();
    const r = await db().execute({ sql: 'SELECT id, full_name FROM users WHERE email = ?', args: [mail] });
    const u = r.rows[0];
    if (u) {
      const token = newId() + newId();
      const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
      await db().execute({ sql: 'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', args: [token, exp, u.id] });
      const link = `${baseUrl(req)}/redefinir?token=${token}`;
      await sendMail({ to: mail, subject: 'Redefinir sua senha — Monvy', html: tpl('Redefinicao de senha', `Recebemos um pedido para redefinir sua senha. O link e valido por 1 hora. Se nao foi voce, ignore este e-mail.`, { ctaText: 'Criar nova senha', ctaUrl: link }) });
    }
    // resposta neutra (nao revela existencia)
    return sendJson(res, 200, { ok: true });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
