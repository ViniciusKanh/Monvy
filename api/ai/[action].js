import parseInvoice from '../_handlers/ai_parse_invoice.js';
import { sendJson } from '../_lib/auth.js';

const map = { 'parse-invoice': parseInvoice };
export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
  const i = parts.indexOf('ai');
  const action = i >= 0 ? parts[i + 1] : undefined;
  const h = map[action];
  if (!h) return sendJson(res, 404, { error: 'Rota nao encontrada' });
  return h(req, res);
}
