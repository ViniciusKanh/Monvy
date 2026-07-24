import { ensureSchema } from './_lib/db.js';
import { getAuth, sendJson } from './_lib/auth.js';
import { listRows } from './_lib/entities.js';

// GET /api/bootstrap -> carrega todas as entidades do usuario numa unica chamada
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const o = auth.sub;
    const [accounts, categories, transactions, cards, cardTx, invoices, goals, subscriptions, safes, settings] =
      await Promise.all([
        listRows('Account', o, {}), listRows('Category', o, {}), listRows('Transaction', o, {}),
        listRows('CreditCard', o, {}), listRows('CreditCardTransaction', o, {}), listRows('CreditCardInvoice', o, {}),
        listRows('Goal', o, {}), listRows('Subscription', o, {}), listRows('Safe', o, {}),
        listRows('AppSettings', o, {}),
      ]);
    return sendJson(res, 200, { accounts, categories, transactions, cards, cardTx, invoices, goals, subscriptions, safes, settings });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}
