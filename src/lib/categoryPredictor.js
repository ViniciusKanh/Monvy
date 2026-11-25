// Preditor de categoria por descricao (indice de frequencia de tokens do historico)
function tokens(desc) {
  return String(desc || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
}

export function buildCategoryIndex(transactions) {
  const idx = {};
  for (const t of transactions) {
    if (!t.category_id || t.type === 'transfer') continue;
    for (const tok of tokens(t.description)) {
      idx[tok] = idx[tok] || {};
      idx[tok][t.category_id] = (idx[tok][t.category_id] || 0) + 1;
    }
  }
  return idx;
}

export function predictCategory(desc, idx) {
  const scores = {};
  for (const tok of tokens(desc)) {
    const m = idx[tok]; if (!m) continue;
    for (const [cat, c] of Object.entries(m)) scores[cat] = (scores[cat] || 0) + c;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

// Regras deterministicas: "se a descricao contem X -> categoria Y" (prioridade maior primeiro)
export function matchRule(description, rules, type = 'expense') {
  const d = String(description || '').toLowerCase();
  if (!d) return null;
  const applicable = (rules || []).filter((r) => r.is_active !== false && (!r.tx_type || r.tx_type === type)).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const r of applicable) { if (ruleMatches(d, r)) return r.category_id; }
  return null;
}

// Palavras-chave da regra: aceita várias separadas por vírgula ("mercado, supermercado")
export function rulePatterns(rule) { return String(rule?.pattern || '').toLowerCase().split(',').map((p) => p.trim()).filter(Boolean); }
export function ruleMatches(descLower, rule) { const d = String(descLower || '').toLowerCase(); return !!d && rulePatterns(rule).some((p) => d.includes(p)); }
