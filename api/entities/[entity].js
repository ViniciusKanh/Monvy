import collection from '../_handlers/entities_collection.js';
import item from '../_handlers/entities_item.js';

// Rota robusta: /api/entities/:entity  (item via ?id=  OU  /:entity/:id)
export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const ei = parts.indexOf('entities');
  const entity = ei >= 0 ? parts[ei + 1] : undefined;
  const pathId = ei >= 0 ? parts[ei + 2] : undefined;
  req.query = req.query || {};
  req.query.entity = entity;
  const id = pathId || req.query.id;
  if (id) { req.query.id = id; return item(req, res); }
  return collection(req, res);
}
