import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Account, Category, CategoryRule } from '../api/entities.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Select, Spinner, Badge } from '../components/ui';
import { toast } from '../lib/toast.js';
import { formatCurrency } from '../lib/utils.js';
import { buildCategoryIndex, predictCategory, matchRule } from '../lib/categoryPredictor.js';
import { parseStatementFile } from '../lib/statementParser.js';
import { Upload, ArrowUpRight, ArrowDownRight, CheckCircle2, Trash2, Link2, GitCompare } from 'lucide-react';

const daysBetween = (a, b) => Math.abs((new Date(a + 'T00:00') - new Date(b + 'T00:00')) / 86400000);

export default function BankImport() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => Account.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => Category.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => Transaction.list() });
  const { data: rules = [] } = useQuery({ queryKey: ['catrules'], queryFn: () => CategoryRule.list() });
  const idx = useMemo(() => buildCategoryIndex(transactions), [transactions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [rows, setRows] = useState([]);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);

  // Casamento: para cada linha do extrato, procura um lancamento ja existente na conta selecionada
  // (mesmo tipo, valor identico, data em ate 3 dias e ainda nao usado).
  const matched = useMemo(() => {
    if (!account) return rows.map((r) => ({ ...r, matchId: null }));
    const pool = transactions.filter((t) => t.account_id === account && t.type !== 'transfer');
    const used = new Set();
    return rows.map((r) => {
      let best = null, bestDiff = 99;
      for (const t of pool) {
        if (used.has(t.id)) continue;
        if (t.type !== r.type) continue;
        if (Math.abs(Number(t.amount) - r.amount) > 0.01) continue;
        const diff = daysBetween(String(t.date).slice(0, 10), r.date);
        if (diff <= 3 && diff < bestDiff) { best = t; bestDiff = diff; }
      }
      if (best) used.add(best.id);
      return { ...r, matchId: best ? best.id : null };
    });
  }, [rows, account, transactions]);

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    let parsed;
    try { parsed = await parseStatementFile(file); }
    catch { toast.error('Nao consegui ler este arquivo.'); return; }
    if (!parsed.length) { toast.error('Nenhuma transacao encontrada no arquivo.'); return; }
    const mapped = parsed.map((r) => {
      const type = r.amount >= 0 ? 'income' : 'expense';
      const abs = Math.abs(r.amount);
      const guess = matchRule(r.description, rules, type) || predictCategory(r.description, idx);
      const catId = guess && catMap[guess] && catMap[guess].type === type ? guess : '';
      return { date: r.date, description: r.description, amount: abs, type, category_id: catId, include: true };
    });
    setRows(mapped);
    setAccount((a) => a || accounts[0]?.id || '');
    toast.success(`${mapped.length} lancamentos lidos. Revise o casamento e importe.`);
  };

  const news = matched.filter((r) => !r.matchId);
  const dupes = matched.filter((r) => r.matchId);
  const toImport = news.filter((r) => r.include);
  const toReconcile = dupes.filter((r) => r.include);
  const totalIn = toImport.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalOut = toImport.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const setInclude = (row, val) => setRows((rs) => rs.map((x) => (x === row || (x.date === row.date && x.description === row.description && x.amount === row.amount)) ? { ...x, include: val } : x));
  const setCat = (row, val) => setRows((rs) => rs.map((x) => (x.date === row.date && x.description === row.description && x.amount === row.amount) ? { ...x, category_id: val } : x));

  const run = async () => {
    if (!account) { toast.error('Selecione a conta de destino.'); return; }
    if (!toImport.length && !toReconcile.length) { toast.info('Nada selecionado.'); return; }
    setBusy(true);
    try {
      if (toImport.length) {
        await Transaction.bulkCreate(toImport.map((r) => ({
          date: r.date, amount: r.amount, type: r.type, account_id: account,
          category_id: r.category_id || null, description: r.description, status: 'completed', reconciled: true,
        })));
      }
      for (const r of toReconcile) if (r.matchId) await Transaction.update(r.matchId, { reconciled: true });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setRows([]);
      toast.success(`${toImport.length} novo(s) importado(s) e ${toReconcile.length} conciliado(s).`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const Line = ({ r, isDupe }) => (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${r.include ? '' : 'opacity-40'}`}>
      <input type="checkbox" className="w-4 h-4 accent-emerald-500 shrink-0" checked={r.include} onChange={() => setInclude(r, !r.include)} />
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${r.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{r.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</span>
      <div className="flex-1 min-w-0"><p className="font-medium truncate text-sm">{r.description || 'Lancamento'}</p><p className="text-xs text-muted">{new Date(r.date + 'T00:00').toLocaleDateString('pt-BR')}{isDupe && <span className="text-emerald-500"> · ja existe no sistema</span>}</p></div>
      {!isDupe && <Select value={r.category_id} onChange={(e) => setCat(r, e.target.value)} className="w-36 hidden sm:block text-xs"><option value="">Sem categoria</option>{categories.filter((c) => c.type === r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
      <span className={`font-semibold text-sm shrink-0 ${r.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(r.amount)}</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader title="Importar Extrato" subtitle="Traga um extrato OFX ou CSV, veja o que ja existe e importe so o que falta"
        actions={rows.length > 0 && <Button variant="outline" onClick={() => setRows([])}><Trash2 className="w-4 h-4" /> Limpar</Button>} />

      {rows.length === 0 ? (
        <Card>
          <input ref={fileRef} type="file" accept=".ofx,.csv,.txt,text/csv" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-[hsl(var(--border))] rounded-2xl py-14 flex flex-col items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><Upload className="w-7 h-7 text-emerald-500" /></div>
            <p className="font-semibold">Selecionar arquivo OFX ou CSV</p>
            <p className="text-sm text-muted">Exporte o extrato no app do seu banco (formato OFX ou CSV)</p>
          </button>
          <p className="text-xs text-muted mt-3">O sistema casa cada linha com lancamentos que voce ja tem (mesmo valor e data proxima), importa so os que faltam e concilia o resto — sem IA de terceiros.</p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Conta de destino</label>
              <Select value={account} onChange={(e) => setAccount(e.target.value)} className="mt-1"><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            </div>
            <Button onClick={run} disabled={!account || busy || (!toImport.length && !toReconcile.length)}>{busy ? <Spinner className="w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4" /> Importar {toImport.length} e conciliar {toReconcile.length}</>}</Button>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="py-3"><p className="text-xs text-muted">Lidos</p><p className="font-display text-lg font-bold">{matched.length}</p></Card>
            <Card className="py-3"><p className="text-xs text-muted flex items-center gap-1"><Link2 className="w-3 h-3 text-emerald-500" /> Ja existentes</p><p className="font-display text-lg font-bold text-emerald-500">{dupes.length}</p></Card>
            <Card className="py-3"><p className="text-xs text-muted">Entradas novas</p><p className="font-display text-lg font-bold text-emerald-500">{formatCurrency(totalIn)}</p></Card>
            <Card className="py-3"><p className="text-xs text-muted">Saidas novas</p><p className="font-display text-lg font-bold text-rose-500">{formatCurrency(totalOut)}</p></Card>
          </div>

          {!account && <Card><p className="text-sm text-amber-500">Selecione a conta de destino para o sistema casar com seus lancamentos existentes.</p></Card>}

          {news.length > 0 && (
            <Card className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]"><Upload className="w-4 h-4 text-emerald-500" /><h3 className="font-semibold text-sm">Novos — serao criados ({news.length})</h3></div>
              <div className="divide-y divide-[hsl(var(--border))] max-h-[40vh] overflow-y-auto">{news.map((r, i) => <Line key={'n' + i} r={r} isDupe={false} />)}</div>
            </Card>
          )}

          {dupes.length > 0 && (
            <Card className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]"><GitCompare className="w-4 h-4 text-indigo-500" /><h3 className="font-semibold text-sm">Ja no sistema — serao conciliados ({dupes.length})</h3><Badge color="emerald">sem duplicar</Badge></div>
              <div className="divide-y divide-[hsl(var(--border))] max-h-[40vh] overflow-y-auto">{dupes.map((r, i) => <Line key={'d' + i} r={r} isDupe />)}</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
