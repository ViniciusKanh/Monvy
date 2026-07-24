import { db } from './db.js';

export async function getSetting(key) {
  const r = await db().execute({ sql: 'SELECT value FROM Setting WHERE key = ?', args: [key] });
  return r.rows[0]?.value ?? null;
}
export async function setSetting(key, value) {
  await db().execute({
    sql: 'INSERT INTO Setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, value == null ? '' : String(value)],
  });
}
export async function getMailConfig() {
  const [from, password, enabled, nu, np, na] = await Promise.all(
    ['mail_from', 'mail_password', 'mail_enabled', 'notify_new_user', 'notify_password', 'notify_alerts'].map(getSetting)
  );
  return {
    from: from || '', password: password || '', enabled: enabled === '1',
    notifyNewUser: nu !== '0', notifyPassword: np !== '0', notifyAlerts: na !== '0',
  };
}
