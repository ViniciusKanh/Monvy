import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, FileCode2, Camera, ChevronRight, ChevronLeft, ChevronDown, Search, CalendarDays, SlidersHorizontal, Eye, MoreHorizontal,
  Landmark, Upload, ScanLine, QrCode, Barcode, KeyRound, CheckCircle2, Clock, Trash2, ExternalLink, Pencil, Receipt, Sparkles,
  ShoppingCart, Fuel, Utensils, Clapperboard, Store, Pill, Wifi, Shirt, Car, Building2, Database, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown, ShieldCheck,
} from 'lucide-react';
import { Button, Input, Field, Modal, Spinner } from '../components/ui';
import { AnimatedValue } from '../components/Animated.jsx';
import { NfeIllustration } from '../components/tax/TaxArt.jsx';
import { ScanNoteModal } from '../components/notes/ScanNoteModal.jsx';
import { formatCurrency, monthKey, MONTHS_PT } from '../lib/utils.js';
import { formatCnpj, formatKey } from '../lib/nfeKey.js';
import { FiscalNote, AppSettings, Ai } from '../api/entities.js';
import { parseNfeXml } from '../lib/nfeXml.js';
import { toast } from '../lib/toast.js';

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const TAX_LABELS = { iss: 'ISS', icms: 'ICMS', ipi: 'IPI', ii: 'II', pis: 'PIS', cofins: 'COFINS', irrf: 'IRRF', csll: 'CSLL', inss: 'INSS', ibs: 'IBS', cbs: 'CBS', fcp: 'FCP', issqn: 'ISS', aproximado: 'Aprox. (IBPT)' };
const TAX_FIELDS = ['iss', 'icms', 'ipi', 'pis', 'cofins', 'ibs', 'cbs', 'irrf', 'csll', 'inss', 'ii', 'aproximado'];
const MAX_FILE_B64 = 1_800_000;
const PAGE = 8;
const MES = MONTHS_PT.map((m) => m.slice(0, 3));
const mkLabel = (mk) => { const [y, m] = String(mk || '').split('-'); return m ? `${MES[Number(m) - 1]}/${y}` : '—'; };
const brDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR') : '—');
const parseTaxes = (t) => { if (!t) return {}; if (typeof t === 'object') return t; try { return JSON.parse(t); } catch { return {}; } };
const pct = (v) => `${(Number.isFinite(v) ? v : 0).toFixed(1).replace('.', ',')}%`;
const isProcessed = (nt) => Number(nt.total_value) > 0 && Number(nt.total_tax) > 0;

const SOURCES = {
  xml: { label: 'XML', icon: FileCode2 },
  danfe: { label: 'PDF', icon: FileText },
  foto: { label: 'Câmera', icon: Camera },
  qrcode: { label: 'QR Code', icon: QrCode },
  barcode: { label: 'Cód. barras', icon: Barcode },
  chave: { label: 'Chave', icon: KeyRound },
};
const srcOf = (s) => SOURCES[s] || SOURCES.xml;

// ícone do estabelecimento pelo nome (só visual)
const EMITTER_ICONS = [
  [/mercad|atacad|supermerc|hortifr|carrefour|assai|distribui/i, ShoppingCart, '#10b981'],
  [/posto|combust|petro|shell|ipiranga/i, Fuel, '#a855f7'],
  [/restaur|lanchon|padar|pizz|burger|cafe|café|ifood/i, Utensils, '#14b8a6'],
  [/cinema|cinemark|kinopl|ingresso/i, Clapperboard, '#8b5cf6'],
  [/farm|drog/i, Pill, '#f43f5e'],
  [/telecom|internet|vivo|claro/i, Wifi, '#0ea5e9'],
  [/loja|moda|roupa|calçad|renner|riachuelo/i, Shirt, '#f59e0b'],
  [/auto|veic|oficina|pneu/i, Car, '#64748b'],
];
const emitterIcon = (name) => { for (const [re, Ic, c] of EMITTER_ICONS) if (re.test(name || '')) return [Ic, c]; return [Store, '#3b82f6']; };

const blankReview = { emitter: '', emitter_cnpj: '', number: '', issued_date: '', total_value: '', taxes: {}, note_type: 'produto', source: 'xml' };

export default function NotasFiscais() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const xmlRef = useRef(null);
  const pdfRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const reviewRef = useRef(null);
  reviewRef.current = review;
  const [details, setDetails] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [importMenu, setImportMenu] = useState(false);

  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [monthF, setMonthF] = useState('all');
  const [originF, setOriginF] = useState('all');
  const [typeF, setTypeF] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);

  const { data: notes = [], isLoading } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const geminiKey = settingsList[0]?.gemini_api_key;
  const existingKeys = useMemo(() => new Set(notes.map((x) => x.access_key).filter(Boolean)), [notes]);

  // ---------- indicadores ----------
  const nowMk = monthKey(new Date());
  const prevMk = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const kpi = useMemo(() => {
    const sum = (arr, f) => arr.reduce((s, x) => s + Number(x[f] || 0), 0);
    const cur = notes.filter((x) => x.reference_month === nowMk); const prev = notes.filter((x) => x.reference_month === prevMk);
    const d = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const processed = notes.filter(isProcessed).length;
    const fields = ['emitter', 'emitter_cnpj', 'number', 'issued_date'];
    const completeness = notes.length ? notes.reduce((s, x) => s + (fields.filter((f) => String(x[f] || '').trim()).length + (Number(x.total_value) > 0 ? 1 : 0) + (Number(x.total_tax) > 0 ? 1 : 0)) / 6, 0) / notes.length * 100 : 0;
    return {
      count: notes.length, value: sum(notes, 'total_value'), tax: sum(notes, 'total_tax'), processed,
      dCount: d(cur.length, prev.length), dValue: d(sum(cur, 'total_value'), sum(prev, 'total_value')), dTax: d(sum(cur, 'total_tax'), sum(prev, 'total_tax')),
      curTax: sum(cur, 'total_tax'), curValue: sum(cur, 'total_value'), completeness,
    };
  }, [notes, nowMk, prevMk]);
  const topEmitters = useMemo(() => {
    const m = {}; for (const x of notes) m[x.emitter || 'Emitente'] = (m[x.emitter || 'Emitente'] || 0) + Number(x.total_tax || 0);
    const arr = Object.entries(m).map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v).slice(0, 3);
    const max = arr[0]?.v || 1; return arr.map((x) => ({ ...x, p: (x.v / max) * 100 }));
  }, [notes]);

  // ---------- tabela ----------
  const months = useMemo(() => [...new Set(notes.map((x) => x.reference_month).filter(Boolean))].sort().reverse(), [notes]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = notes.filter((x) => {
      if (statusF === 'ok' && !isProcessed(x)) return false;
      if (statusF === 'pend' && isProcessed(x)) return false;
      if (monthF !== 'all' && x.reference_month !== monthF) return false;
      if (originF !== 'all' && (x.source || 'xml') !== originF) return false;
      if (typeF !== 'all' && (x.note_type || 'produto') !== typeF) return false;
      if (s) {
        const hay = [x.emitter, x.number, x.emitter_cnpj, formatCnpj(x.emitter_cnpj), x.access_key, String(x.total_value), formatCurrency(x.total_value)].join(' ').toLowerCase();
        if (!hay.includes(s.replace(/^r\$\s*/, ''))) return false;
      }
      return true;
    });
    const val = (x) => ({ name: (x.emitter || '').toLowerCase(), date: x.issued_date || `${x.reference_month || ''}-00`, number: Number(x.number) || 0, origin: srcOf(x.source).label, value: Number(x.total_value) || 0, tax: Number(x.total_tax) || 0 }[sort.key]);
    arr.sort((a, b) => { const A = val(a), B = val(b); const r = A < B ? -1 : A > B ? 1 : 0; return sort.dir === 'asc' ? r : -r; });
    return arr;
  }, [notes, q, statusF, monthF, originF, typeF, sort]);
  useEffect(() => { setPage(1); }, [q, statusF, monthF, originF, typeF, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const anyFilter = q || statusF !== 'all' || monthF !== 'all' || originF !== 'all' || typeF !== 'all';
  const clearFilters = () => { setQ(''); setStatusF('all'); setMonthF('all'); setOriginF('all'); setTypeF('all'); };
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'origin' ? 'asc' : 'desc' }));

  // ---------- importação ----------
  const onXml = async (e) => {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const note = parseNfeXml(text);
      if (note.access_key && existingKeys.has(note.access_key)) toast.info('Esta nota já está guardada — salvar criará uma cópia.');
      setReview({ ...note, taxes: { ...note.taxes }, xml: text, file_name: file.name, file_type: 'application/xml' });
      toast.success('XML lido. Revise e salve.');
    } catch (err) { toast.error(err.message || 'Não consegui ler o XML.'); }
    finally { setBusy(false); }
  };
  const onPdf = async (e) => {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!file) return;
    if (!geminiKey) { toast.error('Configure a chave do Gemini em Configurações para ler a DANFE.'); return; }
    setBusy(true);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const { note } = await Ai.parseDanfe(base64, geminiKey, 'application/pdf');
      if (!note) throw new Error('Não encontrei dados na nota.');
      setReview({ ...note, taxes: { ...note.taxes }, file_data: base64.length <= MAX_FILE_B64 ? base64 : null, file_name: file.name, file_type: 'application/pdf' });
      toast.success('Nota lida pela IA. Confira os valores antes de salvar.');
    } catch (err) { toast.error(err.message || 'Falha ao ler a DANFE.'); }
    finally { setBusy(false); }
  };

  const setTax = (k, v) => setReview((r) => ({ ...r, taxes: { ...r.taxes, [k]: v } }));
  const reviewTotalTax = useMemo(() => {
    if (!review) return 0;
    const t = review.taxes || {};
    const soma = n(t.iss) + n(t.icms) + n(t.ipi) + n(t.ii) + n(t.pis) + n(t.cofins) + n(t.irrf) + n(t.csll) + n(t.inss) + n(t.ibs) + n(t.cbs) + n(t.issqn);
    return soma > 0 ? soma : n(t.aproximado);
  }, [review]);

  const saveNote = useMutation({
    mutationFn: async (arg) => {
      // aceita a nota direto (ex.: "Salvar agora" do leitor) ou usa a que está em revisão
      const review = arg && typeof arg === 'object' && !arg.nativeEvent ? arg : reviewRef.current;
      const t = review.taxes || {};
      const soma = n(t.iss) + n(t.icms) + n(t.ipi) + n(t.ii) + n(t.pis) + n(t.cofins) + n(t.irrf) + n(t.csll) + n(t.inss) + n(t.ibs) + n(t.cbs) + n(t.issqn);
      const reviewTotalTax = soma > 0 ? soma : n(t.aproximado);
      const taxes = Object.fromEntries(Object.keys(TAX_LABELS).map((k) => [k, n(t[k])]));
      const total_tax = Math.round(reviewTotalTax * 100) / 100;
      if (!(total_tax > 0) && !(n(review.total_value) > 0)) throw new Error('Informe ao menos o valor da nota ou um tributo.');
      const issued = String(review.issued_date || '').slice(0, 10) || null;
      const payload = {
        access_key: review.access_key || null, number: String(review.number || ''),
        emitter: (review.emitter || 'Emitente').trim(), emitter_cnpj: String(review.emitter_cnpj || '').replace(/[.\-/\s]/g, ''),
        issued_date: issued, reference_month: (issued || '').slice(0, 7) || review.reference_month || null,
        total_value: n(review.total_value), total_tax, taxes, note_type: review.note_type || 'produto',
        source: review.source || 'xml', consult_url: review.consult_url || null,
      };
      if (review.id) return FiscalNote.update(review.id, payload);
      return FiscalNote.create({ ...payload, xml: review.xml || null, file_data: review.file_data || null, file_name: review.file_name || null, file_type: review.file_type || null });
    },
    onSuccess: (_d, arg) => { const rv = arg && typeof arg === 'object' && !arg.nativeEvent ? arg : review; toast.success(rv?.id ? 'Nota atualizada.' : 'Nota fiscal salva.'); setReview(null); qc.invalidateQueries({ queryKey: ['fiscal-notes'] }); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });
  const removeNote = useMutation({ mutationFn: (id) => FiscalNote.remove(id), onSuccess: () => { toast.success('Nota removida.'); setDetails(null); qc.invalidateQueries({ queryKey: ['fiscal-notes'] }); } });

  const openStored = (nt) => {
    try {
      let blob;
      if (nt.file_data) { const bytes = Uint8Array.from(atob(nt.file_data), (c) => c.charCodeAt(0)); blob = new Blob([bytes], { type: nt.file_type || 'application/pdf' }); }
      else if (nt.xml) { blob = new Blob([nt.xml], { type: 'application/xml' }); }
      else if (nt.consult_url) { window.open(nt.consult_url, '_blank', 'noopener'); return; }
      else { toast.info('Esta nota guardou só os dados, sem o arquivo original.'); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('Não consegui abrir o arquivo.'); }
  };
  const editNote = (nt) => { setDetails(null); setReview({ ...nt, taxes: { ...parseTaxes(nt.taxes) }, issued_date: nt.issued_date || '' }); };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <FileText className="w-11 h-11 text-sky-400 shrink-0 mt-1" strokeWidth={1.6} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Notas Fiscais</h1>
            <p className="text-sm text-muted mt-1">Armazene suas notas, importe XML/PDF, escaneie com a câmera e alimente a inteligência tributária do Monvy.</p>
            <div className="h-1 w-14 rounded-full mt-2.5 bg-gradient-to-r from-sky-400 to-violet-500" />
          </div>
        </div>
        <NfeIllustration className="hidden xl:block w-80 h-36 shrink-0 -my-4 mr-6" />
      </div>

      {/* Ações de importação */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ActionCard tone="emerald" tag="XML" icon={FileCode2} title="Importar XML da nota" text="Leitura exata, direta do arquivo da NF-e." onClick={() => xmlRef.current?.click()} disabled={busy} />
        <ActionCard tone="violet" tag="PDF" icon={FileText} title="Importar PDF (NF-e / NFS-e)" text={geminiKey ? 'Produto ou serviço, com extração por IA.' : 'Requer a chave Gemini em Configurações.'} onClick={() => pdfRef.current?.click()} disabled={busy} />
        <ActionCard tone="sky" icon={ScanLine} title="Escanear com câmera" text="Leia o QR Code do cupom ou o código de barras da DANFE pela câmera do computador ou do celular — ou por uma foto." onClick={() => setScanOpen(true)} />
      </div>
      <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={onXml} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={onPdf} />
      {busy && <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" /> Lendo a nota…</p>}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Kpi tone="sky" icon={FileText} label="Total de notas" value={<AnimatedValue value={kpi.count} format={(v) => String(Math.round(v))} />} delta={kpi.dCount} />
        <Kpi tone="emerald" icon={Database} label="Valor total das notas" value={<AnimatedValue value={kpi.value} format={formatCurrency} />} delta={kpi.dValue} />
        <Kpi tone="violet" icon={Landmark} label="Tributos identificados" value={<AnimatedValue value={kpi.tax} format={formatCurrency} />} delta={kpi.dTax} />
        <div className="rounded-2xl bg-[hsl(var(--card))] ring-1 ring-sky-400/25 shadow-soft p-4 flex items-center gap-4">
          <span className="w-12 h-12 rounded-xl flex items-center justify-center bg-sky-500/15 text-sky-400 shrink-0"><Sparkles className="w-6 h-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Processadas</p>
            <p className="font-display text-2xl font-bold leading-tight">{kpi.processed} <span className="text-base font-semibold text-muted">de {kpi.count}</span></p>
            <p className="text-[11px] text-muted">com valor e tributos identificados</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">{pct(kpi.count ? (kpi.processed / kpi.count) * 100 : 0)}</span>
        </div>
      </div>

      {/* Tabela + inteligência */}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] shadow-soft p-5 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div><h3 className="font-semibold text-lg">Minhas Notas Fiscais</h3><p className="text-xs text-muted">Gerencie, filtre e acompanhe todas as suas notas.</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => nav('/carga-tributaria')}><TrendingUp className="w-4 h-4 text-emerald-500" /> Ver Carga Tributária</Button>
              <Button size="sm" variant="outline" onClick={() => nav('/impostos')}><Landmark className="w-4 h-4" /> Ver em Impostos</Button>
              <div className="relative">
                <button onClick={() => setImportMenu((v) => !v)} onBlur={() => setTimeout(() => setImportMenu(false), 150)} aria-haspopup="menu" aria-expanded={importMenu} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-violet-500 hover:brightness-110 shadow-[0_0_18px_rgba(99,102,241,.35)] transition"><Upload className="w-4 h-4" /> Importar nota <ChevronDown className="w-3.5 h-3.5" /></button>
                {importMenu && (
                  <div role="menu" className="absolute right-0 mt-1 z-20 min-w-[12rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1">
                    <button role="menuitem" onMouseDown={() => xmlRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileCode2 className="w-4 h-4 text-emerald-500" /> Arquivo XML</button>
                    <button role="menuitem" onMouseDown={() => pdfRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><FileText className="w-4 h-4 text-violet-500" /> PDF (IA)</button>
                    <button role="menuitem" onMouseDown={() => setReview({ ...blankReview, source: 'chave' })} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5"><Pencil className="w-4 h-4" /> Lançar manualmente</button>
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" className="ring-1 ring-violet-400/40" onClick={() => setScanOpen(true)}><Camera className="w-4 h-4" /> Escanear nota</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por estabelecimento, número ou valor..." className="input-base !py-1.5 !pl-9 !text-[13px]" /></div>
            <Sel label="Status" value={statusF} onChange={setStatusF} options={[['all', 'Todos'], ['ok', 'Processada'], ['pend', 'Pendente revisão']]} />
            <Sel label="Mês" icon={CalendarDays} value={monthF} onChange={setMonthF} options={[['all', 'Todos'], ...months.map((m) => [m, mkLabel(m)])]} />
            <Sel label="Origem" value={originF} onChange={setOriginF} options={[['all', 'Todas'], ...Object.entries(SOURCES).map(([k, v]) => [k, v.label])]} />
            <Sel label="Tipo" value={typeF} onChange={setTypeF} options={[['all', 'Todos'], ['produto', 'Produto'], ['servico', 'Serviço']]} />
            <button onClick={clearFilters} disabled={!anyFilter} title="Limpar filtros" aria-label="Limpar filtros" className={`px-3 rounded-xl border transition ${anyFilter ? 'border-sky-400/60 text-sky-500 hover:bg-sky-500/10' : 'border-[hsl(var(--border))] text-muted'}`}><SlidersHorizontal className="w-4 h-4" /></button>
          </div>

          {isLoading ? <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div> : notes.length === 0 ? (
            <div className="text-center py-12"><Receipt className="w-10 h-10 mx-auto text-muted opacity-50" /><p className="font-semibold mt-3">Nenhuma nota guardada</p><p className="text-sm text-muted mt-1">Importe o XML, o PDF ou escaneie o QR Code do cupom para começar.</p></div>
          ) : (<>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-separate border-spacing-y-1.5 min-w-[860px]">
                <thead><tr className="text-left text-xs text-muted">
                  <Th k="name" sort={sort} onSort={toggleSort} className="pl-3">Estabelecimento</Th>
                  <Th k="date" sort={sort} onSort={toggleSort}>Data</Th>
                  <Th k="number" sort={sort} onSort={toggleSort}>Número</Th>
                  <th className="px-2 py-1 font-medium">Tipo</th>
                  <Th k="origin" sort={sort} onSort={toggleSort}>Origem</Th>
                  <Th k="value" sort={sort} onSort={toggleSort}>Valor total</Th>
                  <Th k="tax" sort={sort} onSort={toggleSort}>Tributos</Th>
                  <th className="px-2 py-1 font-medium">Status</th>
                  <th className="px-2 py-1"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {pageRows.length === 0 ? <tr><td colSpan={9} className="text-center text-muted py-8">Nenhuma nota com esses filtros.</td></tr> : pageRows.map((nt) => {
                    const [Ic, color] = emitterIcon(nt.emitter); const src = srcOf(nt.source); const ok = isProcessed(nt); const serv = nt.note_type === 'servico';
                    return (
                      <tr key={nt.id} className="group">
                        <td className="pl-3 pr-2 py-2 rounded-l-xl bg-black/[0.025] dark:bg-white/[0.03] group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.05]">
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22`, color }}><Ic className="w-[18px] h-[18px]" /></span>
                            <span className="min-w-0"><span className="block font-semibold truncate max-w-[210px]" title={nt.emitter}>{nt.emitter || 'Emitente'}</span><span className="block text-[11px] text-muted">{nt.emitter_cnpj ? `CNPJ ${formatCnpj(nt.emitter_cnpj)}` : 'CNPJ não informado'}</span></span>
                          </span>
                        </td>
                        <Td>{nt.issued_date ? brDate(nt.issued_date) : mkLabel(nt.reference_month)}</Td>
                        <Td>{nt.number || '—'}</Td>
                        <Td><span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${serv ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-violet-400/40' : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-sky-400/40'}`}>{serv ? 'Serviço' : 'Produto'}</span></Td>
                        <Td><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><src.icon className="w-4 h-4 text-muted" /> {src.label}</span></Td>
                        <Td className="font-medium whitespace-nowrap">{Number(nt.total_value) > 0 ? formatCurrency(nt.total_value) : '—'}</Td>
                        <Td className="font-bold whitespace-nowrap">{Number(nt.total_tax) > 0 ? formatCurrency(nt.total_tax) : '—'}</Td>
                        <Td>{ok ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 whitespace-nowrap"><CheckCircle2 className="w-3.5 h-3.5" /> Processada</span>
                          : <button onClick={() => editNote(nt)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 whitespace-nowrap" title="Completar valor/tributos"><Clock className="w-3.5 h-3.5" /> Pendente revisão</button>}</Td>
                        <td className="pr-2 py-2 rounded-r-xl bg-black/[0.025] dark:bg-white/[0.03] group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.05] whitespace-nowrap text-right">
                          <button onClick={() => setDetails(nt)} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Ver detalhes"><Eye className="w-4 h-4" /></button>
                          <RowMenu items={[
                            { icon: Pencil, label: 'Editar / revisar', onClick: () => editNote(nt) },
                            (nt.file_data || nt.xml || nt.consult_url) && { icon: ExternalLink, label: nt.file_data || nt.xml ? 'Abrir arquivo original' : 'Consultar na SEFAZ', onClick: () => openStored(nt) },
                            { icon: Trash2, label: 'Remover', danger: true, onClick: () => { if (confirm('Remover esta nota?')) removeNote.mutate(nt.id); } },
                          ].filter(Boolean)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <p className="text-xs text-muted">{filtered.length ? `Mostrando ${(page - 1) * PAGE + 1} – ${Math.min(page * PAGE, filtered.length)} de ${filtered.length} nota${filtered.length === 1 ? '' : 's'}` : 'Nenhuma nota'}</p>
              {pages > 1 && <Pager page={page} pages={pages} onPage={setPage} />}
            </div>
          </>)}
        </div>

        {/* Inteligência tributária */}
        <aside className="rounded-3xl bg-[hsl(var(--card))] ring-1 ring-violet-400/30 shadow-[0_0_30px_rgba(139,92,246,.15)] p-4 space-y-3 h-fit">
          <div className="flex items-start gap-3 px-1 pt-1">
            <Sparkles className="w-6 h-6 text-teal-300 shrink-0" />
            <div><h3 className="font-semibold text-lg leading-tight">Inteligência Tributária</h3><p className="text-xs text-muted">Insights das suas notas neste mês.</p></div>
          </div>
          <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
            <p className="text-sm font-semibold">Tributos capturados em {mkLabel(nowMk)}</p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="font-display text-2xl font-bold text-sky-500 dark:text-sky-300"><AnimatedValue value={kpi.curTax} format={formatCurrency} /></p>
              {kpi.dTax != null && <DeltaChip v={kpi.dTax} />}
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${Math.min(100, kpi.curValue > 0 ? (kpi.curTax / kpi.curValue) * 100 : 0)}%` }} /></div>
            <p className="text-[11px] text-muted mt-1">{kpi.curValue > 0 ? `${pct((kpi.curTax / kpi.curValue) * 100)} do valor das notas do mês (${formatCurrency(kpi.curValue)})` : 'Sem notas neste mês ainda.'}</p>
          </div>
          <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
            <p className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-400" /> Principais estabelecimentos</p>
            <p className="text-[11px] text-muted mb-2 ml-6">(por valor de tributos)</p>
            {topEmitters.length === 0 ? <p className="text-xs text-muted">Sem notas ainda.</p> : topEmitters.map((e, i) => (
              <div key={e.name} className="mb-2 last:mb-0">
                <div className="flex justify-between gap-2 text-xs"><span className="truncate">{e.name}</span><b className="whitespace-nowrap">{formatCurrency(e.v)}</b></div>
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${e.p}%`, background: ['linear-gradient(90deg,#3b82f6,#38bdf8)', 'linear-gradient(90deg,#10b981,#2dd4bf)', 'linear-gradient(90deg,#8b5cf6,#c084fc)'][i] }} /></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl ring-1 ring-[hsl(var(--border))] bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
            <p className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-400" /> Qualidade dos dados</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 min-w-0"><p className="font-display text-3xl font-bold text-emerald-500 dark:text-emerald-300">{pct(kpi.completeness)}</p><p className="text-[11px] text-muted leading-snug">Média de campos preenchidos (emitente, CNPJ, número, data, valor e tributos).</p></div>
              <Ring v={kpi.completeness} />
            </div>
          </div>
        </aside>
      </div>

      {/* Modal: escanear */}
      <ScanNoteModal open={scanOpen} onClose={() => setScanOpen(false)} geminiKey={geminiKey} existingKeys={existingKeys}
        onUse={(r, opt) => { setScanOpen(false); const rv = { ...blankReview, ...r, taxes: { ...(r.taxes || {}) } }; if (opt?.save) saveNote.mutate(rv); else setReview(rv); }} />

      {/* Modal: revisar antes de salvar (também edição) */}
      <Modal open={!!review} onClose={() => setReview(null)} title={review?.id ? 'Editar nota fiscal' : 'Revisar nota fiscal'} maxWidth="max-w-3xl"
        footer={<><span className="text-sm text-muted mr-auto">Total de tributos: <b className="text-emerald-600">{formatCurrency(reviewTotalTax)}</b></span><Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button><Button disabled={saveNote.isPending} onClick={() => saveNote.mutate()}>{saveNote.isPending ? <Spinner className="w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4" /> Salvar nota</>}</Button></>}>
        {review && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(() => { const s = srcOf(review.source); return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10"><s.icon className="w-3.5 h-3.5" /> {s.label}</span>; })()}
              <div className="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/5">{[['produto', 'Produto'], ['servico', 'Serviço']].map(([v, l]) => <button key={v} type="button" onClick={() => setReview({ ...review, note_type: v })} className={`px-2.5 py-0.5 rounded-md font-semibold ${(review.note_type || 'produto') === v ? 'bg-[hsl(var(--card))] shadow' : 'text-muted'}`}>{l}</button>)}</div>
              {review.tax_origin === 'impresso' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Tributos lidos na SEFAZ</span>}
              {review.tax_origin === 'foto_ia' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold"><Camera className="w-3.5 h-3.5" /> Tributos lidos da foto do cupom (IA) — confira</span>}
              {review.tax_origin === 'estimado_ia' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 font-semibold" title={review.tax_basis || ''}><Sparkles className="w-3.5 h-3.5" /> Tributos estimados pela IA — confira</span>}
              {review.consult_url && <a href={review.consult_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-500 hover:underline"><ExternalLink className="w-3.5 h-3.5" /> Consultar na SEFAZ</a>}
            </div>
            {review.access_key && <p className="text-[11px] text-muted">Chave: <code className="tracking-wide">{formatKey(review.access_key)}</code></p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Emitente / prestador"><Input value={review.emitter || ''} onChange={(e) => setReview({ ...review, emitter: e.target.value })} /></Field>
              <Field label="CNPJ"><Input value={review.emitter_cnpj || ''} onChange={(e) => setReview({ ...review, emitter_cnpj: e.target.value })} /></Field>
              <Field label="Nº da nota"><Input value={review.number || ''} onChange={(e) => setReview({ ...review, number: e.target.value })} /></Field>
              <Field label="Data de emissão" hint={!review.issued_date && review.reference_month ? `Mês pela chave: ${mkLabel(review.reference_month)}` : undefined}><Input type="date" value={review.issued_date || ''} onChange={(e) => setReview({ ...review, issued_date: e.target.value })} /></Field>
              <Field label="Valor total (R$)"><Input inputMode="decimal" value={review.total_value ?? ''} onChange={(e) => setReview({ ...review, total_value: e.target.value })} /></Field>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Tributos {review.note_type === 'servico' ? '(serviço: ISS + retenções)' : '(produto)'}</p>
              {['qrcode', 'barcode', 'chave'].includes(review.source) && <p className="text-[11px] text-muted mb-2">No cupom, use o campo "Aprox. (IBPT)" com o valor de "Tributos totais incidentes" impresso no rodapé.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {TAX_FIELDS.map((k) => <Field key={k} label={TAX_LABELS[k]}><Input inputMode="decimal" value={review.taxes?.[k] ?? ''} onChange={(e) => setTax(k, e.target.value)} /></Field>)}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: detalhes */}
      <Modal open={!!details} onClose={() => setDetails(null)} title="Detalhes da nota" maxWidth="max-w-xl"
        footer={details && <>
          <Button variant="outline" className="text-rose-500 mr-auto" onClick={() => { if (confirm('Remover esta nota?')) removeNote.mutate(details.id); }}><Trash2 className="w-4 h-4" /> Remover</Button>
          {(details.file_data || details.xml || details.consult_url) && <Button variant="outline" onClick={() => openStored(details)}><ExternalLink className="w-4 h-4" /> {details.file_data || details.xml ? 'Abrir arquivo' : 'Consultar SEFAZ'}</Button>}
          <Button onClick={() => editNote(details)}><Pencil className="w-4 h-4" /> Editar</Button>
        </>}>
        {details && (() => { const tx = Object.entries(parseTaxes(details.taxes)).filter(([, v]) => Number(v) > 0); const s = srcOf(details.source); return (
          <div className="space-y-4 text-sm">
            <div><p className="font-semibold text-base">{details.emitter || 'Emitente'}</p><p className="text-xs text-muted">{details.emitter_cnpj ? `CNPJ ${formatCnpj(details.emitter_cnpj)}` : 'CNPJ não informado'}</p></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Info k="Número" v={details.number || '—'} /><Info k="Emissão" v={details.issued_date ? brDate(details.issued_date) : mkLabel(details.reference_month)} /><Info k="Tipo" v={details.note_type === 'servico' ? 'Serviço' : 'Produto'} />
              <Info k="Origem" v={<span className="inline-flex items-center gap-1"><s.icon className="w-3.5 h-3.5" /> {s.label}</span>} /><Info k="Valor total" v={formatCurrency(details.total_value)} /><Info k="Tributos" v={<b className="text-emerald-600">{formatCurrency(details.total_tax)}</b>} />
            </div>
            {details.access_key && <div><p className="text-[11px] text-muted">Chave de acesso</p><code className="text-xs tracking-wide break-all">{formatKey(details.access_key)}</code></div>}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Tributos da nota</p>
              {tx.length === 0 ? <p className="text-xs text-muted">Nenhum tributo informado — use Editar para completar.</p> : (
                <div className="flex flex-wrap gap-1.5">{tx.map(([k, v]) => <span key={k} className="text-xs rounded-md bg-black/5 dark:bg-white/10 px-2 py-1">{TAX_LABELS[k] || k}: <b>{formatCurrency(v)}</b></span>)}</div>
              )}
              {Number(details.total_value) > 0 && Number(details.total_tax) > 0 && <p className="text-[11px] text-muted mt-2">Carga desta nota: {pct((details.total_tax / details.total_value) * 100)} do valor.</p>}
            </div>
          </div>
        ); })()}
      </Modal>
    </div>
  );
}

// ---------- componentes ----------
const ACTION_TONES = {
  emerald: { ring: 'ring-emerald-400/50', bg: 'linear-gradient(120deg,rgba(16,185,129,.22),rgba(13,148,136,.06) 60%)', tile: 'from-emerald-500/30 to-teal-600/20 text-emerald-200 ring-emerald-300/40', glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,.3)]' },
  violet: { ring: 'ring-violet-400/50', bg: 'linear-gradient(120deg,rgba(139,92,246,.26),rgba(124,58,237,.06) 60%)', tile: 'from-violet-500/35 to-fuchsia-600/20 text-violet-100 ring-violet-300/40', glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,.35)]' },
  sky: { ring: 'ring-sky-400/50', bg: 'linear-gradient(120deg,rgba(14,165,233,.24),rgba(37,99,235,.06) 60%)', tile: 'from-sky-500/30 to-blue-600/20 text-sky-100 ring-sky-300/40', glow: 'hover:shadow-[0_0_30px_rgba(56,189,248,.3)]' },
};
function ActionCard({ tone, tag, icon: Icon, title, text, onClick, disabled }) {
  const T = ACTION_TONES[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={`group text-left rounded-2xl ring-1 ${T.ring} ${T.glow} bg-[hsl(var(--card))] p-4 flex items-center gap-4 transition disabled:opacity-60`} style={{ backgroundImage: T.bg }}>
      <span className={`relative w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ring-1 ${T.tile} flex flex-col items-center justify-center shrink-0`}>
        <Icon className={`w-9 h-9 ${tag ? '-mt-2' : ''}`} strokeWidth={1.6} />
        {tag && <span className="absolute bottom-2 px-1.5 rounded text-[10px] font-extrabold tracking-wide bg-white/90 text-slate-900">{tag}</span>}
      </span>
      <span className="flex-1 min-w-0"><span className="block font-display text-lg font-bold">{title}</span><span className="block text-xs text-muted mt-1 leading-snug">{text}</span></span>
      <span className="w-9 h-9 rounded-full ring-1 ring-white/20 bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition"><ChevronRight className="w-4 h-4" /></span>
    </button>
  );
}

const KPI_TONES = { sky: ['bg-sky-500/15 text-sky-400', 'ring-sky-400/25'], emerald: ['bg-emerald-500/15 text-emerald-400', 'ring-emerald-400/25'], violet: ['bg-violet-500/15 text-violet-400', 'ring-violet-400/30'] };
function Kpi({ tone, icon: Icon, label, value, delta }) {
  const [tile, ring] = KPI_TONES[tone];
  return (
    <div className={`rounded-2xl bg-[hsl(var(--card))] ring-1 ${ring} shadow-soft p-4 flex items-center gap-4`}>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tile}`}><Icon className="w-6 h-6" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted">{label}</p><p className="font-display text-2xl font-bold leading-tight whitespace-nowrap">{value}</p></div>
      <div className="text-right shrink-0">{delta != null ? <DeltaChip v={delta} /> : <span className="text-[11px] text-muted">—</span>}<p className="text-[10px] text-muted mt-1">no mês vs. anterior</p></div>
    </div>
  );
}
function DeltaChip({ v }) {
  const up = v >= 0;
  return <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${up ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-500'}`}>{up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{up ? '+' : ''}{v.toFixed(1).replace('.', ',')}%</span>;
}
function Ring({ v }) {
  const r = 30, c = 2 * Math.PI * r, x = Math.max(0, Math.min(100, v));
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90"><defs><linearGradient id="ringNf"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#38bdf8" /></linearGradient></defs><circle cx="38" cy="38" r={r} fill="none" stroke="hsl(var(--muted) / .2)" strokeWidth="8" /><circle cx="38" cy="38" r={r} fill="none" stroke="url(#ringNf)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(x / 100) * c} ${c}`} /></svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.round(x)}%</span>
    </div>
  );
}
function Sel({ label, icon: Icon, value, onChange, options }) {
  return (
    <label className="relative inline-flex items-center gap-1.5 pl-3 pr-7 py-1.5 rounded-xl border border-[hsl(var(--border))] text-[13px] cursor-pointer whitespace-nowrap">
      {Icon && <Icon className="w-4 h-4 text-muted" />}<span className="text-muted">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="appearance-none bg-transparent outline-none cursor-pointer font-semibold [&>option]:text-slate-800">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 pointer-events-none" />
    </label>
  );
}
function Th({ k, sort, onSort, children, className = '' }) {
  const active = sort.key === k;
  return <th className={`px-2 py-1 font-medium whitespace-nowrap ${className}`}><button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-[hsl(var(--text))] ${active ? 'text-[hsl(var(--text))]' : ''}`}>{children}{active ? (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}</button></th>;
}
function Td({ children, className = '' }) {
  return <td className={`px-2 py-2 bg-black/[0.025] dark:bg-white/[0.03] group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.05] ${className}`}>{children}</td>;
}
function Info({ k, v }) { return <div><p className="text-[11px] text-muted">{k}</p><p className="font-semibold">{v}</p></div>; }
function Pager({ page, pages, onPage }) {
  const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1 || (page <= 3 && i <= 5) || (page >= pages - 2 && i >= pages - 4)) nums.push(i);
  const items = []; nums.forEach((x, i) => { if (i && x - nums[i - 1] > 1) items.push('…' + x); items.push(x); });
  const btn = 'min-w-8 h-8 px-2 rounded-lg text-sm font-semibold flex items-center justify-center';
  return (
    <nav className="flex items-center gap-1" aria-label="Paginação">
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className={`${btn} hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30`} aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
      {items.map((x) => typeof x === 'string' ? <span key={x} className="px-1 text-muted">…</span> : <button key={x} onClick={() => onPage(x)} aria-current={x === page ? 'page' : undefined} className={`${btn} ${x === page ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(56,189,248,.5)]' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>{x}</button>)}
      <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages} className={`${btn} hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30`} aria-label="Próxima"><ChevronRight className="w-4 h-4" /></button>
    </nav>
  );
}
function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Mais ações" aria-haspopup="menu" aria-expanded={open} className="p-1.5 rounded-lg text-muted hover:text-[hsl(var(--text))] hover:bg-black/5 dark:hover:bg-white/10"><MoreHorizontal className="w-4 h-4" /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[12rem] rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl p-1 text-left">
          {items.map((it) => <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 ${it.danger ? 'text-rose-500' : ''}`}><it.icon className="w-4 h-4" /> {it.label}</button>)}
        </div>
      )}
    </span>
  );
}
