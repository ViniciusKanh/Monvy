// Rate limit simples em memoria (por instancia serverless)
const hits = new Map();
export function rateLimit(key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.reset) { hits.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++; return true;
}
export function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}
