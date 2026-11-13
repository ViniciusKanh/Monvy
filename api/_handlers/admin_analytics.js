import { db, ensureSchema } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getSetting, setSetting } from '../_lib/settings.js';

async function requireAdmin(req, res) {
  await ensureSchema();
  const auth = getAuth(req);
  if (!auth) { sendJson(res, 401, { error: 'Nao autenticado' }); return null; }
  const u = (await db().execute({ sql: 'SELECT role FROM users WHERE id=?', args: [auth.sub] })).rows[0];
  if (!u || u.role !== 'admin') { sendJson(res, 403, { error: 'Apenas administradores' }); return null; }
  return auth;
}

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

// GET /api/admin/usage?days=30 -> uso agregado de TODOS os usuarios (admin)
export async function usage(req, res) {
  const auth = await requireAdmin(req, res); if (!auth) return;
  try {
    const days = Math.min(365, Math.max(1, Number(req.query?.days) || 30));
    const since = daysAgo(days);
    const c = db();
    const byScreen = (await c.execute({
      sql: `SELECT screen_key, COUNT(*) AS views, COUNT(DISTINCT created_by_id) AS users, MAX(day) AS last
            FROM UsageEvent WHERE (is_deleted IS NULL OR is_deleted=0) AND day >= ?
            GROUP BY screen_key ORDER BY views DESC`, args: [since],
    })).rows;
    const daily = (await c.execute({
      sql: `SELECT day, COUNT(*) AS views, COUNT(DISTINCT created_by_id) AS users
            FROM UsageEvent WHERE (is_deleted IS NULL OR is_deleted=0) AND day >= ?
            GROUP BY day ORDER BY day ASC`, args: [since],
    })).rows;
    const totalUsers = (await c.execute({ sql: `SELECT COUNT(*) AS n FROM users WHERE (is_active IS NULL OR is_active=1)`, args: [] })).rows[0]?.n || 0;
    const activeUsers = (await c.execute({ sql: `SELECT COUNT(DISTINCT created_by_id) AS n FROM UsageEvent WHERE day >= ?`, args: [since] })).rows[0]?.n || 0;
    const totalViews = byScreen.reduce((s, r) => s + Number(r.views || 0), 0);
    return sendJson(res, 200, {
      days, since,
      byScreen: byScreen.map((r) => ({ screen_key: r.screen_key, views: Number(r.views), users: Number(r.users), last: r.last })),
      daily: daily.map((r) => ({ day: r.day, views: Number(r.views), users: Number(r.users) })),
      totals: { users: Number(totalUsers), activeUsers: Number(activeUsers), views: totalViews },
    });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}

// GET/PUT /api/admin/campaign -> campanha de avaliacao na loja (admin)
export async function campaign(req, res) {
  const auth = await requireAdmin(req, res); if (!auth) return;
  try {
    if (req.method === 'GET') {
      const raw = await getSetting('rate_campaign');
      let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
      return sendJson(res, 200, { campaign: data });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const b = await readBody(req);
      const data = {
        active: !!b.active,
        id: String(b.id || `c${Date.now()}`),
        title: String(b.title || 'Gostando do Monvy?').slice(0, 120),
        message: String(b.message || 'Sua avaliação nos ajuda demais. Que tal avaliar na loja?').slice(0, 400),
        url: String(b.url || '').slice(0, 500),
        updated_at: new Date().toISOString(),
      };
      await setSetting('rate_campaign', JSON.stringify(data));
      return sendJson(res, 200, { ok: true, campaign: data });
    }
    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
