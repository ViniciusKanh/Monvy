import { db, newId, nowIso } from './db.js';

const DEFAULT_CATEGORIES = [
  { name: 'Salario', type: 'income', color: '#10b981', icon: 'wallet' },
  { name: 'Renda Extra', type: 'income', color: '#14b8a6', icon: 'plus' },
  { name: 'Alimentacao', type: 'expense', color: '#f43f5e', icon: 'utensils' },
  { name: 'Moradia', type: 'expense', color: '#6366f1', icon: 'home' },
  { name: 'Transporte', type: 'expense', color: '#0ea5e9', icon: 'car' },
  { name: 'Saude', type: 'expense', color: '#ec4899', icon: 'heart' },
  { name: 'Lazer', type: 'expense', color: '#8b5cf6', icon: 'gamepad' },
  { name: 'Contas & Servicos', type: 'expense', color: '#f59e0b', icon: 'file' },
  { name: 'Educacao', type: 'expense', color: '#14b8a6', icon: 'book' },
  { name: 'Compras', type: 'expense', color: '#64748b', icon: 'bag' },
  { name: 'Outros', type: 'expense', color: '#94a3b8', icon: 'tag' },
];

export async function seedDefaultCategories(ownerId) {
  const exists = await db().execute({ sql: 'SELECT COUNT(*) c FROM Category WHERE created_by_id = ?', args: [ownerId] });
  if (Number(exists.rows[0].c) > 0) return 0;
  const now = nowIso();
  for (const c of DEFAULT_CATEGORIES) {
    await db().execute({
      sql: `INSERT INTO Category (id,name,type,color,icon,is_active,is_deleted,created_date,updated_date,created_by_id)
            VALUES (?,?,?,?,?,1,0,?,?,?)`,
      args: [newId(), c.name, c.type, c.color, c.icon, now, now, ownerId],
    });
  }
  return DEFAULT_CATEGORIES.length;
}
