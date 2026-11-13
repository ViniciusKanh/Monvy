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

// GET /api/admin/usage?days=30&churn=14 -> uso agregado + por usuario (admin)
export async function usage(req, res) {
  const auth = await requireAdmin(req, res); if (!auth) return;
  try {
    const days = Math.min(365, Math.max(1, Number(req.query?.days) || 30));
    const churnDays = Math.min(180, Math.max(1, Number(req.query?.churn) || 14));
    const since = daysAgo(days);
    const churnCut = daysAgo(churnDays);
    const today = new Date().toISOString().slice(0, 10);
    const c = db();

    // user x screen na janela (base para byScreen e por-usuario, em 1 consulta)
    const rows = (await c.execute({
      sql: `SELECT created_by_id AS uid, screen_key, COUNT(*) AS views, COUNT(DISTINCT day) AS days, MAX(day) AS last
            FROM UsageEvent WHERE (is_deleted IS NULL OR is_deleted=0) AND day >= ?
            GROUP BY created_by_id, screen_key`, args: [since],
    })).rows;
    // ultimo acesso de sempre (para detectar quem sumiu, mesmo fora da janela)
    const lastEverRows = (await c.execute({ sql: `SELECT created_by_id AS uid, MAX(day) AS last_ever, COUNT(*) AS total FROM UsageEvent GROUP BY created_by_id`, args: [] })).rows;
    const lastEver = {}; const totalEver = {};
    for (const r of lastEverRows) { lastEver[r.uid] = r.last_ever; totalEver[r.uid] = Number(r.total || 0); }
    // usuarios cadastrados
    const users = (await c.execute({ sql: `SELECT id, full_name, email, role, created_date FROM users WHERE (is_active IS NULL OR is_active=1)`, args: [] })).rows;

    // agrega por tela
    const scr = {};
    for (const r of rows) {
      const k = r.screen_key; (scr[k] = scr[k] || { screen_key: k, views: 0, users: new Set(), last: '' });
      scr[k].views += Number(r.views); scr[k].users.add(r.uid); if (r.last > scr[k].last) scr[k].last = r.last;
    }
    const byScreen = Object.values(scr).map((s) => ({ screen_key: s.screen_key, views: s.views, users: s.users.size, last: s.last })).sort((a, b) => b.views - a.views);

    // agrega por usuario
    const uMap = {};
    for (const r of rows) {
      const u = (uMap[r.uid] = uMap[r.uid] || { uid: r.uid, events: 0, days: new Set(), top: null, topViews: 0, last: '' });
      u.events += Number(r.views);
      u.days.add(r.last); // aproxima dias ativos via telas (refinado abaixo nao e critico)
      if (Number(r.views) > u.topViews) { u.topViews = Number(r.views); u.top = r.screen_key; }
      if (r.last > u.last) u.last = r.last;
    }
    const perUser = users.map((u) => {
      const a = uMap[u.id];
      const lastSeen = lastEver[u.id] || null;
      let status = 'nunca'; // nunca usou
      if (lastSeen) status = (lastSeen >= since) ? 'ativo' : (lastSeen < churnCut ? 'sumiu' : 'ativo');
      return {
        id: u.id, name: u.full_name || u.email, email: u.email, role: u.role,
        events: a ? a.events : 0, topScreen: a ? a.top : null, lastSeen, totalEver: totalEver[u.id] || 0, status,
      };
    }).sort((x, y) => y.events - x.events);

    const daily = (await c.execute({
      sql: `SELECT day, COUNT(*) AS views, COUNT(DISTINCT created_by_id) AS users
            FROM UsageEvent WHERE (is_deleted IS NULL OR is_deleted=0) AND day >= ?
            GROUP BY day ORDER BY day ASC`, args: [since],
    })).rows;

    const activeUsers = perUser.filter((u) => u.status === 'ativo').length;
    const churned = perUser.filter((u) => u.status === 'sumiu').length;
    const neverUsed = perUser.filter((u) => u.status === 'nunca').length;
    const totalViews = byScreen.reduce((s, r) => s + r.views, 0);
    const busiest = daily.reduce((mx, d) => (Number(d.views) > (mx?.views || 0) ? { day: d.day, views: Number(d.views) } : mx), null);
    const avgPerActive = activeUsers > 0 ? Math.round(totalViews / activeUsers) : 0;

    return sendJson(res, 200, {
      days, churnDays, since, today,
      byScreen,
      daily: daily.map((r) => ({ day: r.day, views: Number(r.views), users: Number(r.users) })),
      perUser,
      totals: { users: users.length, activeUsers, churned, neverUsed, views: totalViews, avgPerActive, busiest },
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
