import { status, connectToken, saveItem, transactions, disconnect } from '../_handlers/pluggy.js';
import { sendJson } from '../_lib/auth.js';

// Dispatcher unico (1 funcao serverless) para as integracoes bancarias (Pluggy).
const map = {
  status,
  'connect-token': connectToken,
  'save-item': saveItem,
  transactions,
  disconnect,
};

export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
  const i = parts.indexOf('integrations');
  const action = i >= 0 ? parts[i + 1] : undefined;
  const h = map[action];
  if (!h) return sendJson(res, 404, { error: 'Rota nao encontrada' });
  return h(req, res);
}
