import { ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getMailConfig, setSetting } from '../_lib/settings.js';
import { sendMail, tpl, envConfigured } from '../_lib/mailer.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    if (auth.role !== 'admin') return sendJson(res, 403, { error: 'Acesso restrito ao administrador' });

    if (req.method === 'GET') {
      const c = await getMailConfig();
      return sendJson(res, 200, { from: c.from, has_password: !!c.password, enabled: c.enabled, notifyNewUser: c.notifyNewUser, notifyPassword: c.notifyPassword, notifyAlerts: c.notifyAlerts, smtp_env: envConfigured() });
    }
    if (req.method === 'PUT') {
      const b = await readBody(req);
      if (b.from !== undefined) await setSetting('mail_from', b.from.trim());
      if (b.password) await setSetting('mail_password', b.password); // so atualiza se enviado
      if (b.enabled !== undefined) await setSetting('mail_enabled', b.enabled ? '1' : '0');
      if (b.notifyNewUser !== undefined) await setSetting('notify_new_user', b.notifyNewUser ? '1' : '0');
      if (b.notifyPassword !== undefined) await setSetting('notify_password', b.notifyPassword ? '1' : '0');
      if (b.notifyAlerts !== undefined) await setSetting('notify_alerts', b.notifyAlerts ? '1' : '0');
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      const to = b.to || auth.email;
      const r = await sendMail({ to, subject: 'Monvy — E-mail de teste', html: tpl('Funcionou! ✅', 'Seu envio de e-mail esta configurado corretamente. A partir de agora o Monvy pode notificar por e-mail.') });
      if (r.sent) return sendJson(res, 200, { ok: true, to, via: r.via });
      return sendJson(res, 400, { error: r.error || 'Envio nao configurado/habilitado.' });
    }
    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
