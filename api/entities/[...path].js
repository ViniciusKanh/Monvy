import collection from '../_handlers/entities_collection.js';
import item from '../_handlers/entities_item.js';

export default function handler(req, res) {
  const p = req.query.path || [];
  req.query.entity = p[0];
  if (p.length > 1) { req.query.id = p[1]; return item(req, res); }
  return collection(req, res);
}
