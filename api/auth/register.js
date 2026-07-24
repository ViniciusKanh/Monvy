import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { hashPassword, signToken, sendJson, readBody } from '../_lib/auth.js';
import { getMailConfig } from '../_lib/settings.js';
import { sendMail, tpl } from '../_lib/mailer.js';

const DEFAULT_SCREENS = [
  'dashboard','accounts','cards','transactions','categories','budget',
  'goals','subscriptions','calendar','reports','settings',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const { email, password, full_name } = await readBody(req);
    if (!email || !password) return sendJson(res, 400, { error: 'Informe email e senha' });
    if (String(password).length < 8) return sendJson(res, 400, { error: 'A senha deve ter ao menos 8 caracteres' });
    const mail = String(email).toLowerCase().trim();
    const exists = await db().execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [mail] });
    if (exists.rows.length) return sendJson(res, 409, { error: 'Este email ja esta cadastrado' });

    const hash = await hashPassword(password);
    const now = nowIso();
    const id = newId();
    await db().execute({
      sql: `INSERT INTO users (id,email,password_hash,full_name,role,allowed_screens,is_active,created_date,updated_date)
            VALUES (?,?,?,?, 'user', ?, 1, ?, ?)`,
      args: [id, mail, hash, full_name || '', JSON.stringify(DEFAULT_SCREENS), now, now],
    });
    const cfg = await getMailConfig();
    if (cfg.notifyNewUser) sendMail({ to: mail, subject: 'Bem-vindo ao Monvy!', html: tpl('Conta criada com sucesso 🎉', `Ola${full_name ? ' ' + full_name : ''}, sua conta no Monvy foi criada. Agora voce pode controlar contas, cartoes, metas e muito mais.`) }).catch(() => {});
    const user = { id, email: mail, role: 'user' };
    return sendJson(res, 201, {
      token: signToken(user),
      user: { id, email: mail, full_name: full_name || '', role: 'user', allowed_screens: DEFAULT_SCREENS },
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
