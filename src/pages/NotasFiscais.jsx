import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, ScanLine, Trash2, Store, CalendarDays, Receipt, CheckCircle2, X, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, Button, Input, Field, Badge, Spinner, EmptyState } from '../components/ui';
import { AnimatedValue, Reveal } from '../components/Animated.jsx';
import { formatCurrency, monthLabel } from '../lib/utils.js';
import { FiscalNote, AppSettings, Ai } from '../api/entities.js';
import { parseNfeXml } from '../lib/nfeXml.js';
import { toast } from '../lib/toast.js';

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const TAX_LABELS = { iss: 'ISS', icms: 'ICMS', ipi: 'IPI', ii: 'II', pis: 'PIS', cofins: 'COFINS', irrf: 'IRRF', csll: 'CSLL', inss: 'INSS', fcp: 'FCP', issqn: 'ISS', aproximado: 'Aprox. (IBPT)' };
// campos editáveis no review (issqn/fcp ficam de fora do form; ISS cobre serviço)
const TAX_FIELDS = ['iss', 'icms', 'ipi', 'pis', 'cofins', 'irrf', 'csll', 'inss', 'ii', 'aproximado'];
const MAX_FILE_B64 = 1_800_000; // ~1.3MB de arquivo; acima disso guarda só os dados

export default function NotasFiscais() {
  const qc = useQueryClient();
  const xmlRef = useRef(null);
  const pdfRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null); // { emitter, emitter_cnpj, number, issued_date, total_value, taxes, total_tax, source, xml? }

  const { data: notes = [], isLoading } = useQuery({ queryKey: ['fiscal-notes'], queryFn: () => FiscalNote.list() });
  const { data: settingsList = [] } = useQuery({ queryKey: ['appsettings'], queryFn: () => AppSettings.list() });
  const geminiKey = settingsList[0]?.gemini_api_key;

  const stats = useMemo(() => {
    const totalTax = notes.reduce((s, x) => s + Number(x.total_tax || 0), 0);
    const totalValue = notes.reduce((s, x) => s + Number(x.total_value || 0), 0);
    return { totalTax, totalValue, count: notes.length, pct: totalValue > 0 ? (totalTax / totalValue) * 100 : 0 };
  }, [notes]);

  const onXml = async (e) => {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const note = parseNfeXml(text);
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
      const { note } = await Ai.parseDanfe(base64, geminiKey);
      if (!note) throw new Error('Não encontrei dados na nota.');
      // guarda o PDF para reconsulta (se não for grande demais)
      const fileData = base64.length <= MAX_FILE_B64 ? base64 : null;
      setReview({ ...note, taxes: { ...note.taxes }, file_data: fileData, file_name: file.name, file_type: 'application/pdf' });
      toast.success('Nota lida pela IA. Confira os valores antes de salvar.');
    } catch (err) { toast.error(err.message || 'Falha ao ler a DANFE.'); }
    finally { setBusy(false); }
  };

  const setTax = (k, v) => setReview((r) => ({ ...r, taxes: { ...r.taxes, [k]: v } }));
  const reviewTotalTax = useMemo(() => {
    if (!review) return 0;
    const t = review.taxes || {};
    const soma = n(t.iss) + n(t.icms) + n(t.ipi) + n(t.ii) + n(t.pis) + n(t.cofins) + n(t.irrf) + n(t.csll) + n(t.inss) + n(t.issqn);
    return soma > 0 ? soma : n(t.aproximado);
  }, [review]);

  const saveNote = useMutation({
    mutationFn: async () => {
      const t = review.taxes || {};
      const taxes = Object.fromEntries(Object.keys(TAX_LABELS).map((k) => [k, n(t[k])]));
      const total_tax = Math.round(reviewTotalTax * 100) / 100;
      if (!(total_tax > 0) && !(n(review.total_value) > 0)) throw new Error('Informe ao menos o valor da nota ou um tributo.');
      return FiscalNote.create({
        access_key: review.access_key || null, number: String(review.number || ''),
        emitter: (review.emitter || 'Emitente').trim(), emitter_cnpj: String(review.emitter_cnpj || ''),
        issued_date: String(review.issued_date || '').slice(0, 10) || null,
        reference_month: String(review.issued_date || '').slice(0, 7) || null,
        total_value: n(review.total_value), total_tax, taxes, note_type: review.note_type || 'produto',
        source: review.source || 'xml', xml: review.xml || null,
        file_data: review.file_data || null, file_name: review.file_name || null, file_type: review.file_type || null,
      });
    },
    onSuccess: () => { toast.success('Nota fiscal salva.'); setReview(null); qc.invalidateQueries({ queryKey: ['fiscal-notes'] }); },
    onError: (e) => toast.error(e.message || 'Falha ao salvar.'),
  });

  const removeNote = useMutation({ mutationFn: (id) => FiscalNote.remove(id), onSuccess: () => { toast.success('Nota removida.'); qc.invalidateQueries({ queryKey: ['fiscal-notes'] }); } });

  // Reabre o arquivo original guardado (PDF em base64 ou XML em texto)
  const openStored = (nt) => {
    try {
      let blob;
      if (nt.file_data) { const bytes = Uint8Array.from(atob(nt.file_data), (c) => c.charCodeAt(0)); blob = new Blob([bytes], { type: nt.file_type || 'application/pdf' }); }
      else if (nt.xml) { blob = new Blob([nt.xml], { type: 'application/xml' }); }
      else { toast.info('Esta nota guardou só os dados, sem o arquivo original.'); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('Não consegui abrir o arquivo.'); }
  };
  const hasFile = (nt) => !!(nt.file_data || nt.xml);

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={<span className="flex items-center gap-2"><FileText className="w-6 h-6 text-emerald-500" /> Notas Fiscais</span>}
        subtitle="Guarde suas notas (XML e DANFE) e some os tributos que alimentam a Carga Tributária" />

      {/* Painel de importação — o ato principal da tela */}
      <Card>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={() => xmlRef.current?.click()} disabled={busy} className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 p-5 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition disabled:opacity-60">
            <Upload className="w-6 h-6 text-emerald-600" />
            <p className="font-semibold mt-2">Importar XML da nota</p>
            <p className="text-xs text-muted">Leitura exata, direto do arquivo. Recomendado.</p>
          </button>
          <button onClick={() => pdfRef.current?.click()} disabled={busy} className="rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-800 p-5 text-left hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition disabled:opacity-60">
            <ScanLine className="w-6 h-6 text-violet-600" />
            <p className="font-semibold mt-2">Importar PDF (NF-e / NFS-e)</p>
            <p className="text-xs text-muted">{geminiKey ? 'Produto ou serviço, lida pela IA. Confira os valores.' : 'Requer a chave Gemini nas Configurações.'}</p>
          </button>
        </div>
        <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={onXml} />
        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={onPdf} />
        {busy && <p className="text-sm text-muted mt-3 flex items-center gap-2"><Spinner className="w-4 h-4" /> Lendo a nota…</p>}
      </Card>

      {/* Revisão antes de salvar */}
      {review && (
        <Card className="border-emerald-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-500" /> Revisar nota
              <Badge color={review.note_type === 'servico' ? 'blue' : 'emerald'}>{review.note_type === 'servico' ? 'Serviço' : 'Produto'}</Badge>
              <span className="text-xs font-normal text-muted">{review.source === 'danfe' ? 'lida por IA' : 'XML'}</span>
            </h3>
            <button className="text-muted hover:text-rose-500" onClick={() => setReview(null)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Emitente / prestador"><Input value={review.emitter || ''} onChange={(e) => setReview({ ...review, emitter: e.target.value })} /></Field>
            <Field label="CNPJ"><Input value={review.emitter_cnpj || ''} onChange={(e) => setReview({ ...review, emitter_cnpj: e.target.value })} /></Field>
            <Field label="Nº da nota"><Input value={review.number || ''} onChange={(e) => setReview({ ...review, number: e.target.value })} /></Field>
            <Field label="Data de emissão"><Input type="date" value={review.issued_date || ''} onChange={(e) => setReview({ ...review, issued_date: e.target.value })} /></Field>
            <Field label="Valor total (R$)"><Input inputMode="decimal" value={review.total_value ?? ''} onChange={(e) => setReview({ ...review, total_value: e.target.value })} /></Field>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mt-4 mb-1">Tributos {review.note_type === 'servico' ? '(serviço: ISS + retenções)' : '(produto)'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TAX_FIELDS.map((k) => (
              <Field key={k} label={TAX_LABELS[k]}><Input inputMode="decimal" value={review.taxes?.[k] ?? ''} onChange={(e) => setTax(k, e.target.value)} /></Field>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted">Total de tributos: <b className="text-emerald-600">{formatCurrency(reviewTotalTax)}</b></span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setReview(null)}>Cancelar</Button>
              <Button disabled={saveNote.isPending} onClick={() => saveNote.mutate()}>{saveNote.isPending ? <Spinner className="w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4" /> Salvar nota</>}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Resumo */}
      {notes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card><p className="text-xs text-muted">Notas guardadas</p><p className="font-display text-2xl font-bold">{stats.count}</p></Card>
          <Card><p className="text-xs text-muted">Total das notas</p><p className="font-display text-2xl font-bold"><AnimatedValue value={stats.totalValue} format={formatCurrency} /></p></Card>
          <Card><p className="text-xs text-emerald-700 dark:text-emerald-300">Tributos nas notas</p><p className="font-display text-2xl font-bold text-emerald-600"><AnimatedValue value={stats.totalTax} format={formatCurrency} /></p><p className="text-[11px] text-muted">{stats.pct.toFixed(1)}% do valor</p></Card>
        </div>
      )}

      {/* Lista de notas */}
      {isLoading ? <div className="flex justify-center py-10"><Spinner className="w-6 h-6" /></div>
        : notes.length === 0 ? <EmptyState icon={FileText} title="Nenhuma nota guardada" subtitle="Importe o XML ou a DANFE para começar a medir seus tributos de consumo com precisão." />
        : (
          <div className="space-y-2">
            {notes.map((nt, i) => (
              <Reveal key={nt.id} delay={i * 30}>
                <Card className="hover-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2 truncate"><Store className="w-4 h-4 text-slate-400 shrink-0" /> {nt.emitter || 'Emitente'}</p>
                      <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {nt.issued_date ? new Date(nt.issued_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</span>
                        {nt.number ? <span>· nº {nt.number}</span> : null}
                        <Badge color={nt.note_type === 'servico' ? 'blue' : 'slate'}>{nt.note_type === 'servico' ? 'Serviço' : 'Produto'}</Badge>
                        <Badge color={nt.source === 'danfe' ? 'violet' : 'emerald'}>{nt.source === 'danfe' ? 'PDF' : 'XML'}</Badge>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(nt.taxes || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
                          <span key={k} className="text-[11px] rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{TAX_LABELS[k] || k}: {formatCurrency(v)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted">Tributos</p>
                      <p className="font-display text-lg font-bold text-emerald-600">{formatCurrency(nt.total_tax)}</p>
                      <p className="text-[11px] text-muted">de {formatCurrency(nt.total_value)}</p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        {hasFile(nt) && <button className="text-slate-400 hover:text-emerald-600" title="Abrir arquivo original" onClick={() => openStored(nt)}><ExternalLink className="w-4 h-4" /></button>}
                        <button className="text-rose-500" title="Remover" onClick={() => { if (confirm('Remover esta nota?')) removeNote.mutate(nt.id); }}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        )}
    </div>
  );
}
