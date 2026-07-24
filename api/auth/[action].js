import login from '../_handlers/auth_login.js';
import register from '../_handlers/auth_register.js';
import me from '../_handlers/auth_me.js';
import verify from '../_handlers/auth_verify.js';
import resend from '../_handlers/auth_resend.js';
import forgot from '../_handlers/auth_forgot.js';
import reset from '../_handlers/auth_reset.js';
import change from '../_handlers/auth_change.js';
import profile from '../_handlers/auth_profile.js';
import { sendJson } from '../_lib/auth.js';

const map = {
  login, register, me, verify, resend,
  'forgot-password': forgot, 'reset-password': reset, 'change-password': change, profile,
};
export default function handler(req, res) {
  const h = map[req.query.action];
  if (!h) return sendJson(res, 404, { error: 'Rota nao encontrada' });
  return h(req, res);
}
