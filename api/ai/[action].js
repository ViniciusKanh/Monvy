import parseInvoice from '../_handlers/ai_parse_invoice.js';
import assistant from '../_handlers/ai_assistant.js';
import { sendJson } from '../_lib/auth.js';

const map = { 'parse-invoice': parseInvoice, assistant };
export default function handler(req, res) {
  const h = map[req.query.action];
  if (!h) return sendJson(res, 404, { error: 'Rota nao encontrada' });
  return h(req, res);
}
