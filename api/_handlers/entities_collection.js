import { ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { listRows, createRow, bulkCreate } from '../_lib/entities.js';
import { recalcAllAccounts } from '../_lib/hooks.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const entity = req.query.entity;
    const owner = auth.sub;

    if (req.method === 'GET') {
      const filters = { ...req.query };
      delete filters.entity;
      const rows = await listRows(entity, owner, filters);
      return sendJson(res, 200, rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      let result;
      if (Array.isArray(body)) {
        result = await bulkCreate(entity, owner, body);
      } else if (Array.isArray(body._bulk)) {
        result = await bulkCreate(entity, owner, body._bulk);
      } else {
        result = await createRow(entity, owner, body);
      }
      if (entity === 'Transaction' || entity === 'Account') await recalcAllAccounts(owner);
      return sendJson(res, 201, result);
    }

    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
