// Cliente da API do Pluggy (agregador Open Finance Brasil).
// Segredos (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET) vivem SOMENTE no backend.
// Fluxo: auth -> apiKey (2h) -> connect_token (widget) -> item -> accounts/transactions.
// Docs: https://docs.pluggy.ai

const BASE = 'https://api.pluggy.ai';

let _apiKey = null;
let _apiKeyExp = 0;

export function pluggyConfigured() {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

// Autentica com client credentials e devolve uma apiKey (cacheada ~ 1h50).
export async function getApiKey() {
  if (_apiKey && Date.now() < _apiKeyExp) return _apiKey;
  if (!pluggyConfigured()) throw new Error('Pluggy nao configurado (defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).');
  const r = await fetch(`${BASE}/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Pluggy auth falhou (${r.status}): ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();
  _apiKey = data.apiKey;
  _apiKeyExp = Date.now() + 110 * 60 * 1000; // 1h50 de folga (apiKey dura 2h)
  return _apiKey;
}

async function api(path, { method = 'GET', body, query } = {}) {
  const apiKey = await getApiKey();
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Pluggy ${path} (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

// Connect token usado pelo widget no frontend. itemId opcional = modo atualizacao.
export async function createConnectToken({ itemId, clientUserId } = {}) {
  const body = {};
  if (itemId) body.itemId = itemId;
  if (clientUserId) body.options = { clientUserId };
  const data = await api('/connect_token', { method: 'POST', body });
  return data.accessToken;
}

export async function getItem(itemId) { return api(`/items/${itemId}`); }
export async function deleteItem(itemId) { return api(`/items/${itemId}`, { method: 'DELETE' }); }
export async function listAccounts(itemId) { const d = await api('/accounts', { query: { itemId } }); return d.results || []; }

// Transacoes de uma conta num intervalo (pagina). Retorna lista normalizada.
export async function listTransactions(accountId, { from, to, pageSize = 200 } = {}) {
  const d = await api('/transactions', { query: { accountId, from, to, pageSize } });
  return (d.results || []).map((t) => ({
    id: t.id,
    date: String(t.date).slice(0, 10),
    description: t.description || t.descriptionRaw || 'Transacao',
    amount: Math.abs(Number(t.amount) || 0),
    // no Pluggy, DEBIT = saida (despesa), CREDIT = entrada
    type: t.type === 'DEBIT' ? 'expense' : 'income',
    category: t.category || null,
  }));
}
