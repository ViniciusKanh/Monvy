// Parser de extrato bancario: OFX e CSV -> [{ date:'YYYY-MM-DD', amount:Number(signed), description }]

function normDate(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`; // yyyymmdd / yyyy-mm-dd
  if ((m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/))) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2]}-${m[1]}`; } // dd/mm/yyyy
  return null;
}
function normAmount(s) {
  s = String(s || '').replace(/[R$\s]/g, '').replace(/[^0-9.,\-]/g, '');
  if (!s) return null;
  const neg = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/-/g, '');
  // BR: 1.234,56 -> ponto milhar, virgula decimal
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, ''); // US: 1,234.56
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  return neg ? -Math.abs(v) : v;
}

export function parseOFX(text) {
  const out = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const amt = (b.match(/<TRNAMT>\s*([^<\r\n]+)/i) || [])[1];
    const dt = (b.match(/<DTPOSTED>\s*([0-9]{8})/i) || [])[1];
    const memo = (b.match(/<MEMO>\s*([^<\r\n]+)/i) || [])[1] || (b.match(/<NAME>\s*([^<\r\n]+)/i) || [])[1] || 'Lancamento';
    const amount = normAmount(amt); const date = normDate(dt);
    if (amount != null && date) out.push({ date, amount, description: memo.trim() });
  }
  return out;
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const delim = (lines[0] && lines[0].includes(';')) ? ';' : ',';
  const out = [];
  for (const line of lines) {
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    let date = null, amount = null, descParts = [];
    for (const c of cols) {
      const d = normDate(c);
      if (d && !date) { date = d; continue; }
      const a = /\d/.test(c) && /^[-\dR$.,\s]+$/.test(c) ? normAmount(c) : null;
      if (a != null && amount == null && Math.abs(a) > 0) { amount = a; continue; }
      descParts.push(c);
    }
    if (date && amount != null) out.push({ date, amount, description: (descParts.sort((x, y) => y.length - x.length)[0] || 'Lancamento').slice(0, 80) });
  }
  return out;
}

export async function parseStatementFile(file) {
  const text = await file.text();
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.ofx') || /<OFX>|<STMTTRN>/i.test(text)) return parseOFX(text);
  return parseCSV(text);
}
