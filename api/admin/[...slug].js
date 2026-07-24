import users from '../_handlers/admin_users.js';
import usersItem from '../_handlers/admin_users_item.js';
import mail from '../_handlers/admin_mail.js';
import { sendJson } from '../_lib/auth.js';

export default function handler(req, res) {
  const p = req.query.slug || [];
  if (p[0] === 'users') { if (p[1]) { req.query.id = p[1]; return usersItem(req, res); } return users(req, res); }
  if (p[0] === 'mail') return mail(req, res);
  return sendJson(res, 404, { error: 'Rota nao encontrada' });
}
