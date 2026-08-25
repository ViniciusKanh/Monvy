import login from '../_handlers/auth_login.js';
import register from '../_handlers/auth_register.js';
import me from '../_handlers/auth_me.js';
import verify from '../_handlers/auth_verify.js';
import resend from '../_handlers/auth_resend.js';
import forgot from '../_handlers/auth_forgot.js';
import reset from '../_handlers/auth_reset.js';
import change from '../_handlers/auth_change.js';
import profile from '../_handlers/auth_profile.js';
import twofa from '../_handlers/auth_2fa.js';
import { sendJson } from '../_lib/auth.js';

const map = { login, register, me, verify, resend, forgot, reset, 'forgot-password': forgot, 'reset-password': reset, 'change-password': change, profile, '2fa': twofa };
export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
  const i = parts.indexOf('auth');
  const action = i >= 0 ? parts[i + 1] : undefined;
  const h = map[action];
  if (!h) return sendJson(res, 404, { error: 'Rota nao encontrada' });
  req.query = req.query || {};
  req.query.action = action;
  return h(req, res);
}
