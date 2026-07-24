import collection from '../_handlers/entities_collection.js';
import item from '../_handlers/entities_item.js';

// Le a entidade/id direto da URL (robusto no Vercel, sem depender de req.query.path)
export default function handler(req, res) {
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const i = parts.indexOf('entities');
  const entity = i >= 0 ? parts[i + 1] : undefined;
  const id = i >= 0 ? parts[i + 2] : undefined;
  req.query = req.query || {};
  req.query.entity = entity;
  if (id) { req.query.id = id; return item(req, res); }
  return collection(req, res);
}
