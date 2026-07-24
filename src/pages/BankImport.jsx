import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Spinner, EmptyState, Badge } from '../components/ui';
import { toast } from '../lib/toast.js';
import { formatCurrency, todayIso } from '../lib/utils.js';
import { buildCategoryIndex, predictCategory } from '../lib/categoryPredictor.js';
import { Upload, FileText, ArrowUpRight, ArrowDownRight, CheckCircle2, Trash2 } from 'lucide-react';

function parseAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[R$\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; // OFX YYYYMMDD
  return null;
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const rows = lines.map((l) => l.split(delim));
  const header = rows[0].map((h) => h.toLowerCase());
  const di = header.findIndex((h) => /data|date/.test(h));
  const ai = header.findIndex((h) => /valor|amount|value|montante/.test(h));
  const desci = header.findIndex((h) => /desc|hist|memo|lanc|estabelec/.test(h));
  const start = (di >= 0 || ai >= 0) ? 1 : 0;
  const out = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]; if (r.length < 2) continue;
    const date = parseDate(r[di >= 0 ? di : 0]);
    const amount = parseAmount(r[ai >= 0 ? ai : r.length - 1]);
    const description = (r[desci >= 0 ? desci : 1] || '').replace(/^"|"$/g, '').trim();
    if (date && !isNaN(amount) && amount !== 0) out.push({ date, description, amount });
  }
  return out;
}
function parseOFX(text) {
  const out = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const g = (tag) => { const m = b.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i')); return m ? m[1].trim() : ''; };
    const date = parseDate(g('DTPOSTED'));
    const amount = parseAmount(g('TRNAMT'));
    const description = (g('MEMO') || g('NAME') || 'Lancamento').trim();
    if (date && !isNaN(amount) && amount !== 0) out.push({ date, description, amount });
  }
  return out;
}

export default function BankImport() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const idx = useMemo(() => buildCategoryIndex(transactions), [transactions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [rows, setRows] = useState([]);
  const [account, setAccount] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const text = await file.text();
    let parsed = /<OFX>|<STMTTRN>/i.test(text) ? parseOFX(text) : parseCSV(text);
    if (!parsed.length) { toast.error('Nao consegui ler transacoes deste arquivo.'); return; }
    parsed = parsed.map((r) => {
      const type = r.amount >= 0 ? 'income' : 'expense';
      const catId = predictCategory(r.description, idx);
      const valid = catId && catMap[catId] && catMap[catId].type === type ? catId : '';
      return { ...r, amount: Math.abs(r.amount), type, category_id: valid, include: true };
    });
    setRows(parsed);
    setAccount((a) => a || accounts[0]?.id || '');
    toast.success(`${parsed.length} lancamentos lidos. Revise e importe.`);
  };

  const importMut = useMutation({
    mutationFn: () => {
      const items = rows.filter((r) => r.include).map((r) => ({
        date: r.date, amount: r.amount, type: r.type, account_id: account,
        category_id: r.category_id || null, description: r.description, status: 'completed',
      }));
      return Transaction.bulkCreate(items);
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setRows([]); toast.success(`${res.length} lancamentos importados!`); },
  });

  const included = rows.filter((r) => r.include);
  const totalIn = included.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalOut = included.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title="Importar Extrato" subtitle="Traga lancamentos de um arquivo OFX ou CSV do seu banco"
        actions={rows.length > 0 && <Button variant="outline" onClick={() => setRows([])}><Trash2 className="w-4 h-4" /> Limpar</Button>} />

      {rows.length === 0 ? (
        <Card>
          <input ref={fileRef} type="file" accept=".ofx,.csv,text/csv" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-[hsl(var(--border))] rounded-2xl py-14 flex flex-col items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><Upload className="w-7 h-7 text-emerald-500" /></div>
            <p className="font-semibold">Selecionar arquivo OFX ou CSV</p>
            <p className="text-sm text-muted">Exporte o extrato no app do seu banco (formato OFX ou CSV)</p>
          </button>
          <p className="text-xs text-muted mt-3">Os lancamentos sao categorizados automaticamente pelo seu historico. Voce revisa tudo antes de importar.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="py-3"><p className="text-xs text-muted">A importar</p><p className="font-display text-lg font-bold">{included.length}</p></Card>
            <Card className="py-3"><p className="text-xs text-muted">Entradas</p><p className="font-display text-lg font-bold text-emerald-500">{formatCurrency(totalIn)}</p></Card>
            <Card className="py-3"><p className="text-xs text-muted">Saidas</p><p className="font-display text-lg font-bold text-rose-500">{formatCurrency(totalOut)}</p></Card>
          </div>
          <Card className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Conta de destino</label>
              <Select value={account} onChange={(e) => setAccount(e.target.value)} className="mt-1"><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            </div>
            <Button onClick={() => importMut.mutate()} disabled={!account || !included.length || importMut.isPending}>{importMut.isPending ? <Spinner className="w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4" /> Importar {included.length}</>}</Button>
          </Card>
          <Card className="p-0 divide-y divide-[hsl(var(--border))] max-h-[50vh] overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${r.include ? '' : 'opacity-40'}`}>
                <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={r.include} onChange={() => setRows((rs) => rs.map((x, j) => j === i ? { ...x, include: !x.include } : x))} />
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${r.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{r.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
                <div className="flex-1 min-w-0"><p className="font-medium truncate text-sm">{r.description || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(r.date + 'T00:00').toLocaleDateString('pt-BR')}</p></div>
                <Select value={r.category_id} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, category_id: e.target.value } : x))} className="w-36 hidden sm:block text-xs">
                  <option value="">Sem categoria</option>
                  {categories.filter((c) => c.type === r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <span className={`font-semibold text-sm ${r.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
