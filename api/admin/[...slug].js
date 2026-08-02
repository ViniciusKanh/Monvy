import users from '../_handlers/admin_users.js';
import usersItem from '../_handlers/admin_users_item.js';
import mail from '../_handlers/admin_mail.js';
import defaults from '../_handlers/admin_defaults.js';
import { sendJson } from '../_lib/auth.js';

export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const i = parts.indexOf('admin');
  req.query = req.query || {};
  const a = i >= 0 ? parts[i + 1] : undefined;
  const b = (i >= 0 ? parts[i + 2] : undefined) || req.query.id;
  if (a === 'users') { if (b) { req.query.id = b; return usersItem(req, res); } return users(req, res); }
  if (a === 'mail') return mail(req, res);
  if (a === 'defaults') return defaults(req, res);
  return sendJson(res, 404, { error: 'Rota nao encontrada' });
}
