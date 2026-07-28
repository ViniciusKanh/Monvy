import { db, ensureSchema, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody, comparePassword } from '../_lib/auth.js';
import { randomSecret, verifyTotp, otpauthURL } from '../_lib/totp.js';

// POST /api/auth/2fa  { op: 'setup' | 'enable' | 'disable', code?, password? }
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const { op, code, password } = await readBody(req);
    const u = (await db().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [auth.sub] })).rows[0];
    if (!u) return sendJson(res, 404, { error: 'Usuario nao encontrado' });

    if (op === 'setup') {
      const secret = randomSecret();
      await db().execute({ sql: 'UPDATE users SET totp_secret = ?, updated_date = ? WHERE id = ?', args: [secret, nowIso(), u.id] });
      return sendJson(res, 200, { secret, otpauth: otpauthURL(secret, u.email) });
    }
    if (op === 'enable') {
      if (!u.totp_secret) return sendJson(res, 400, { error: 'Gere o segredo primeiro.' });
      if (!verifyTotp(code, u.totp_secret)) return sendJson(res, 400, { error: 'Codigo invalido. Verifique o app autenticador.' });
      await db().execute({ sql: 'UPDATE users SET totp_enabled = 1, updated_date = ? WHERE id = ?', args: [nowIso(), u.id] });
      return sendJson(res, 200, { ok: true });
    }
    if (op === 'disable') {
      const okPw = password && await comparePassword(password, u.password_hash);
      const okCode = code && verifyTotp(code, u.totp_secret);
      if (!okPw && !okCode) return sendJson(res, 400, { error: 'Confirme com sua senha ou um codigo valido para desativar.' });
      await db().execute({ sql: 'UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_date = ? WHERE id = ?', args: [nowIso(), u.id] });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'Operacao invalida' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
