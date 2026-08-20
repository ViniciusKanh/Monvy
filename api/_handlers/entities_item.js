import { ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getRow, updateRow, deleteRow } from '../_lib/entities.js';
import { recalcAllAccounts } from '../_lib/hooks.js';
import { evaluateAgentsEvent } from '../_lib/agents.js';

const WATCHED = new Set(['Transaction', 'Account', 'Debt', 'Investment', 'CreditCardTransaction', 'CreditCardInvoice', 'Goal', 'Subscription']);

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const { entity, id } = req.query;
    const owner = auth.sub;

    if (req.method === 'GET') {
      const row = await getRow(entity, owner, id);
      if (!row) return sendJson(res, 404, { error: 'Nao encontrado' });
      return sendJson(res, 200, row);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await readBody(req);
      const row = await updateRow(entity, owner, id, body);
      if (!row) return sendJson(res, 404, { error: 'Nao encontrado' });
      if (entity === 'Transaction' || entity === 'Account') await recalcAllAccounts(owner);
      if (WATCHED.has(entity)) await evaluateAgentsEvent(owner);
      return sendJson(res, 200, row);
    }

    if (req.method === 'DELETE') {
      const ok = await deleteRow(entity, owner, id);
      if (!ok) return sendJson(res, 404, { error: 'Nao encontrado' });
      if (entity === 'Transaction' || entity === 'Account') await recalcAllAccounts(owner);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
