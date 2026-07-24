import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-troque-isto';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    SECRET(),
    { expiresIn: '30d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET());
  } catch {
    return null;
  }
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

// Extrai e valida o usuario a partir do header Authorization: Bearer <token>
export function getAuth(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  return verifyToken(token);
}

// Helpers de resposta (Vercel Node functions)
export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function requireAuth(req, res) {
  const auth = getAuth(req);
  if (!auth) {
    sendJson(res, 401, { error: 'Nao autenticado' });
    return null;
  }
  return auth;
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}
