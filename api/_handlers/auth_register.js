import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { hashPassword, sendJson, readBody } from '../_lib/auth.js';
import { sendMail, tpl } from '../_lib/mailer.js';
import { seedDefaultCategories } from '../_lib/seed.js';
import { getSetting } from '../_lib/settings.js';

const DEFAULT_SCREENS = [
  'dashboard','accounts','cards','transactions','categories','budget',
  'goals','subscriptions','calendar','reports','settings',
];

// telas padrao configuradas pelo admin (Setting), com fallback para a lista acima
async function resolveDefaultScreens() {
  try { const raw = await getSetting('default_allowed_screens'); const arr = raw ? JSON.parse(raw) : null; if (Array.isArray(arr) && arr.length) return arr; } catch {}
  return DEFAULT_SCREENS;
}

function baseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

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
    const token = newId() + newId();
    const screens = await resolveDefaultScreens();
    await db().execute({
      sql: `INSERT INTO users (id,email,password_hash,full_name,role,allowed_screens,is_active,email_verified,verify_token,created_date,updated_date)
            VALUES (?,?,?,?, 'user', ?, 1, 0, ?, ?, ?)`,
      args: [id, mail, hash, full_name || '', JSON.stringify(screens), token, now, now],
    });

    try { await seedDefaultCategories(id); } catch {}
    const link = `${baseUrl(req)}/verificar?token=${token}`;
    const r = await sendMail({
      to: mail,
      subject: 'Confirme seu e-mail — Monvy',
      html: tpl('Confirme seu e-mail para ativar a conta',
        `Ola${full_name ? ' ' + full_name : ''}, que bom ter voce no Monvy!<br/><br/>Para ativar sua conta e comecar a organizar suas financas, confirme seu e-mail clicando no botao abaixo. O link e pessoal e intransferivel.`,
        { ctaText: 'Confirmar meu e-mail', ctaUrl: link }),
    });

    return sendJson(res, 201, { needsVerification: true, email: mail, emailSent: !!r.sent });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
