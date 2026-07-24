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
