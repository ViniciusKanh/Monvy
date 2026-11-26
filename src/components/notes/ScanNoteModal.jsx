import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImageUp, Keyboard, ScanLine, QrCode, Barcode, CheckCircle2, AlertTriangle, ExternalLink, Copy, Sparkles, X, RefreshCw, Landmark, ShoppingBag, Loader2, Info } from 'lucide-react';
import { Button, Spinner } from '../ui';
import { startCameraScan, decodeImageFile } from '../../lib/codeScanner.js';
import { extractFromCode, formatKey, formatCnpj, lookupCnpjName } from '../../lib/nfeKey.js';
import { Ai } from '../../api/entities.js';
import { formatCurrency } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';

const TABS = [['camera', 'Câmera', Camera], ['foto', 'Foto / imagem', ImageUp], ['chave', 'Digitar chave', Keyboard]];
const MAX_FILE_B64 = 1_800_000;
// fotos de celular passam de 4 MB (limite do servidor): reduz para ~1600 px em JPEG antes de enviar
async function shrinkImage(file, max = 1600) {
  if (!/^image\//.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], (file.name || 'cupom').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

// Modal "Escanear nota": lê o QR Code (NFC-e/NFS-e) ou o código de barras (DANFE)
// pela câmera, por uma foto ou digitando a chave; mostra o que a chave revela e
// entrega os dados para a revisão. Tributos podem ser completados pela IA (foto).
export function ScanNoteModal({ open, onClose, onUse, geminiKey, existingKeys }) {
  const [tab, setTab] = useState('camera');
  const [scan, setScan] = useState(null); // resultado de extractFromCode + { format, emitterName }
  const [error, setError] = useState('');
  const [camState, setCamState] = useState('idle'); // idle | starting | live | denied
  const [photo, setPhoto] = useState(null); // { file, url }
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [sefaz, setSefaz] = useState(null); // { status: loading|ok|fail, note, error, reason, via }
  const [showItems, setShowItems] = useState(false);
  const [cupom, setCupom] = useState(null); // foto do cupom lida pela IA: { status, key, note, error, file }
  const cupomRef = useRef(null);
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const chainRef = useRef(Promise.resolve());
  const fileRef = useRef(null);

  const stopCam = () => { try { stopRef.current?.(); } catch { /* */ } stopRef.current = null; };
  const reset = () => { setScan(null); setError(''); setSefaz(null); setShowItems(false); setCupom(null); };

  useEffect(() => { if (!open) { stopCam(); setScan(null); setError(''); setPhoto(null); setTyped(''); setCamState('idle'); setTab('camera'); setSefaz(null); setShowItems(false); setCupom(null); } }, [open]);
  // trava a rolagem da página por trás enquanto o leitor está aberto (no celular a câmera ocupa a tela)
  useEffect(() => { if (!open) return; const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, [open]);
  useEffect(() => () => stopCam(), []);

  const handleText = async (text, format) => {
    const r = extractFromCode(text);
    if (!r.key) { setError('Li um código, mas ele não contém a chave de uma nota fiscal. Tente o QR Code do cupom ou o código de barras da DANFE.'); setScan({ ...r, format }); return; }
    setError('');
    const base = { ...r, format, emitterName: null, duplicate: existingKeys?.has(r.key) };
    setScan(base);
    // NFC-e com link do QR: busca a nota direto na SEFAZ (e a IA completa os tributos)
    if (r.kind === 'nfce' && r.consultUrl) runSefaz(r.consultUrl, r.key);
    if (r.info?.cnpj) { const name = await lookupCnpjName(r.info.cnpj); if (name) setScan((s) => (s && s.key === r.key ? { ...s, emitterName: name } : s)); }
  };

  // Plano B garantido: foto (ou PDF) do próprio cupom lida pelo Gemini — o mesmo
  // leitor da importação de PDF, que acha os "Tributos totais incidentes" impressos
  const onCupom = async (e) => {
    const raw = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!raw || !scan?.key) return;
    const file = await shrinkImage(raw);
    const key = scan.key;
    setCupom({ status: 'loading', key });
    try {
      const b64 = await toB64(file);
      const mime = file.type === 'application/pdf' ? 'application/pdf' : (file.type || 'image/jpeg');
      const { note } = await Ai.parseDanfe(b64, geminiKey, mime);
      if (!note) throw new Error('A IA não encontrou dados no cupom.');
      const tax = Number(note.total_tax) || 0;
      setCupom({ status: tax > 0 || Number(note.total_value) > 0 ? 'ok' : 'fail', key, note, error: tax > 0 ? '' : 'A IA leu o cupom, mas não achou o valor dos tributos impresso. Confira se a foto pegou a parte "Tributos totais incidentes".', file: { b64: b64.length <= MAX_FILE_B64 ? b64 : null, name: file.name, type: mime } });
    } catch (err) { setCupom({ status: 'fail', key, error: err.message || 'Falha ao ler a foto do cupom.' }); }
  };

  function mergedNote() {
    const base = sefaz?.status === 'ok' && sefaz.key === scan?.key ? sefaz.note : null;
    const c = cupom?.status === 'ok' && cupom.key === scan?.key ? cupom.note : null;
    if (!c) return base;
    const taxes = Object.fromEntries(Object.entries(c.taxes || {}).filter(([, v]) => Number(v) > 0));
    const hasTax = Object.keys(taxes).length > 0;
    return {
      ...(base || {}),
      emitter: base?.emitter || c.emitter, emitter_cnpj: base?.emitter_cnpj || c.emitter_cnpj, number: base?.number || c.number,
      issued_date: base?.issued_date || c.issued_date, total_value: Number(c.total_value) || base?.total_value || 0,
      taxes: hasTax ? taxes : (base?.taxes || {}), tax_origin: hasTax ? 'foto_ia' : base?.tax_origin, tax_basis: hasTax ? 'Lido da foto do cupom pela IA (Gemini) — confira com o impresso.' : base?.tax_basis,
      items: base?.items || [], items_count: base?.items_count ?? null, tax_split: base?.tax_split,
    };
  }

  const runSefaz = async (url, key) => {
    setSefaz({ status: 'loading', key });
    try {
      const r = await Ai.nfceSefaz(url, geminiKey || undefined);
      if (r?.ok) setSefaz({ status: 'ok', key, note: r.note, via: r.via, aiError: r.aiError });
      else setSefaz({ status: 'fail', key, error: r?.error || 'Não consegui ler a nota na SEFAZ.', reason: r?.reason, debug: r?.debug });
    } catch (e) { setSefaz({ status: 'fail', key, error: e.message || 'Falha ao consultar a SEFAZ.', reason: 'network' }); }
  };

  // câmera ao vivo — as aberturas/fechamentos são enfileirados (chainRef) para que
  // um "stop" atrasado nunca desligue a câmera que acabou de ser aberta (ex.: troca
  // rápida de aba ou o duplo efeito do React em desenvolvimento)
  useEffect(() => {
    if (!open || tab !== 'camera' || scan) { stopCam(); return; }
    let cancelled = false;
    chainRef.current = chainRef.current.then(async () => {
      if (cancelled) return;
      setCamState('starting'); setError('');
      try {
        const stop = await startCameraScan(videoRef.current, (r) => { if (!cancelled) { setCamState('idle'); handleText(r.text, r.format); } });
        if (cancelled) stop(); else { stopRef.current = stop; setCamState('live'); }
      } catch (e) {
        if (!cancelled) { setCamState('denied'); setError(e?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere o acesso no navegador ou use "Foto / imagem".' : e?.name === 'NotFoundError' ? 'Nenhuma câmera encontrada neste dispositivo. Use "Foto / imagem" ou digite a chave.' : (e?.message || 'Não consegui abrir a câmera.')); }
      }
    });
    return () => { cancelled = true; stopCam(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, scan]);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) }); reset(); setBusy(true);
    try {
      const r = await decodeImageFile(file);
      if (r) await handleText(r.text, r.format);
      else setError(geminiKey ? 'Não encontrei QR Code nem código de barras nesta imagem. Você pode ler a foto inteira com IA.' : 'Não encontrei QR Code nem código de barras nesta imagem. Tente uma foto mais nítida e reta, ou digite a chave.');
    } finally { setBusy(false); }
  };

  // IA lê a foto (itens, valor, tributos aproximados) e completa o que a chave não traz
  const readPhotoWithAi = async () => {
    if (!photo?.file || !geminiKey) return;
    setBusy(true);
    try {
      const small = await shrinkImage(photo.file);
      const b64 = await toB64(small);
      const { note } = await Ai.parseDanfe(b64, geminiKey, small.type || 'image/jpeg');
      if (!note) throw new Error('A IA não encontrou dados na foto.');
      const fromKey = scan?.key ? toReview(scan) : {};
      onUse({
        ...note, ...Object.fromEntries(Object.entries(fromKey).filter(([, v]) => v !== '' && v != null && !(typeof v === 'object' && !Object.keys(v).length))),
        taxes: { ...(note.taxes || {}) },
        total_value: fromKey.total_value || note.total_value,
        source: scan?.key ? (scan.format === 'barcode' ? 'barcode' : 'qrcode') : 'foto',
        file_data: b64.length <= MAX_FILE_B64 ? b64 : null, file_name: small.name, file_type: small.type || 'image/jpeg',
      });
      toast.success('Foto lida pela IA. Confira os valores antes de salvar.');
    } catch (err) { toast.error(err.message || 'Falha ao ler a foto.'); }
    finally { setBusy(false); }
  };

  const withFile = (r) => (cupom?.status === 'ok' && cupom.key === scan?.key && cupom.file ? { ...r, file_data: cupom.file.b64, file_name: cupom.file.name, file_type: cupom.file.type } : r);
  const useScan = () => { if (scan?.key) onUse(withFile(toReview(scan, mergedNote()))); };

  if (!open) return null;
  const info = scan?.info;

  const sn = mergedNote();
  // Portal no <body>: a página usa animação com transform, o que fazia o "fixed" do
  // modal se prender à página (no celular a câmera aparecia lá embaixo).
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Escanear nota fiscal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-y-auto overscroll-contain sm:rounded-3xl bg-[hsl(var(--card))] sm:ring-1 ring-sky-400/30 shadow-2xl">
        <div className="sticky top-0 z-10 bg-[hsl(var(--card))] flex items-center justify-between gap-3 px-4 py-3 sm:p-5 border-b border-[hsl(var(--border))]" style={{ paddingTop: 'max(.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0"><ScanLine className="w-6 h-6" /></span>
            <div className="min-w-0"><h2 className="font-display text-lg sm:text-xl font-bold">Escanear nota fiscal</h2><p className="text-xs text-muted hidden sm:block">QR Code do cupom (NFC-e), código de barras da DANFE (NF-e) ou QR da NFS-e.</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 sm:p-5 space-y-4">
          <div role="tablist" className="flex sm:inline-flex w-full sm:w-auto p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">
            {TABS.map(([k, l, Ic]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); reset(); }} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${tab === k ? 'bg-sky-500/20 text-sky-600 dark:text-sky-200 ring-1 ring-sky-400/50' : 'text-muted hover:text-[hsl(var(--text))]'}`}><Ic className="w-4 h-4" /> {l}</button>
            ))}
          </div>

          {!scan?.key && tab === 'camera' && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[68dvh] sm:max-h-none sm:aspect-video mx-auto w-full">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[78%] h-[50%] sm:w-[62%] sm:h-[62%]">
                  {['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'].map((c) => <span key={c} className={`absolute w-9 h-9 border-sky-400 ${c}`} />)}
                  {camState === 'live' && <span className="absolute left-2 right-2 h-0.5 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,.9)] animate-[scanline_2.2s_ease-in-out_infinite]" />}
                </div>
              </div>
              <div className="absolute bottom-3 inset-x-3 text-center text-xs text-white/90">
                {camState === 'starting' && <span className="inline-flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full"><Spinner className="w-3.5 h-3.5" /> Abrindo a câmera…</span>}
                {camState === 'live' && <span className="bg-black/50 px-3 py-1.5 rounded-full">Aponte para o QR Code ou para o código de barras da nota</span>}
              </div>
              <style>{'@keyframes scanline{0%,100%{top:8%}50%{top:90%}}'}</style>
            </div>
          )}

          {!scan?.key && tab === 'foto' && (
            <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center">
              <button onClick={() => fileRef.current?.click()} className="rounded-2xl border-2 border-dashed border-sky-400/50 hover:bg-sky-500/5 p-6 text-center transition">
                <ImageUp className="w-9 h-9 mx-auto text-sky-400" />
                <p className="font-semibold mt-2">Escolher ou tirar foto</p>
                <p className="text-xs text-muted mt-1">JPG/PNG do cupom, da DANFE ou da NFS-e. No celular abre a câmera.</p>
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
              <div className="rounded-2xl bg-black/5 dark:bg-white/5 min-h-[160px] flex items-center justify-center overflow-hidden">
                {photo ? <img src={photo.url} alt="Foto da nota" className="max-h-56 object-contain" /> : <p className="text-xs text-muted">Pré-visualização</p>}
              </div>
            </div>
          )}

          {!scan?.key && tab === 'chave' && (
            <form onSubmit={(e) => { e.preventDefault(); handleText(typed, 'manual'); }} className="space-y-2">
              <label className="text-sm font-medium">Chave de acesso (44 dígitos) ou URL do QR Code</label>
              <div className="flex gap-2">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" className="input-base font-mono tracking-wide" autoFocus />
                <Button type="submit" disabled={!typed.trim()}>Ler</Button>
              </div>
              <p className="text-xs text-muted">A chave fica impressa na DANFE e no cupom, abaixo do QR Code.</p>
            </form>
          )}

          {busy && <p className="text-sm text-muted flex items-center gap-2"><Spinner className="w-4 h-4" /> Processando…</p>}
          {error && (
            <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1"><p>{error}</p>{scan?.raw && !scan?.key && <p className="text-[11px] text-muted mt-1 break-all">Conteúdo lido: {scan.raw.slice(0, 160)}</p>}</div>
              {tab === 'camera' && camState !== 'denied' && <Button size="sm" variant="outline" onClick={() => { reset(); }}><RefreshCw className="w-3.5 h-3.5" /> Tentar de novo</Button>}
            </div>
          )}
          {tab === 'foto' && photo && !scan?.key && geminiKey && !busy && (
            <button onClick={readPhotoWithAi} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition"><Sparkles className="w-4 h-4" /> Ler a foto inteira com IA</button>
          )}

          {/* Resultado */}
          {scan?.key && (
            <div className="rounded-2xl ring-1 ring-emerald-400/30 bg-emerald-500/[0.06] p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {scan.format === 'barcode' ? <Barcode className="w-5 h-5 text-emerald-500" /> : <QrCode className="w-5 h-5 text-emerald-500" />}
                <p className="font-semibold">{scan.kind === 'nfse' ? 'NFS-e (nota de serviço)' : info?.modeloLabel || 'Documento fiscal'} encontrada</p>
                {info && (info.valid ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> chave válida</span>
                  : <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500"><AlertTriangle className="w-3 h-3" /> dígito verificador não confere</span>)}
                {scan.duplicate && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">já está nas suas notas</span>}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2">
                <code className="text-xs sm:text-sm tracking-wide break-all flex-1">{formatKey(scan.key)}</code>
                <button onClick={() => { navigator.clipboard?.writeText(scan.key); toast.success('Chave copiada.'); }} className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10" aria-label="Copiar chave"><Copy className="w-4 h-4" /></button>
              </div>
              {info && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                  <Item k="Emitente" v={sn?.emitter || scan.emitterName || <span className="text-muted">buscando…</span>} wide />
                  <Item k="CNPJ" v={formatCnpj(info.cnpj)} />
                  <Item k="Número / série" v={`${info.numero} / ${info.serie}`} />
                  <Item k={sn?.issued_date || scan.issuedAt ? 'Emissão' : 'Mês de emissão'} v={sn?.issued_date || scan.issuedAt ? new Date((sn?.issued_date || scan.issuedAt) + 'T00:00').toLocaleDateString('pt-BR') : `${String(info.month).padStart(2, '0')}/${info.year}`} />
                  <Item k="UF" v={info.uf || '—'} />
                  <Item k="Valor da nota" v={sn?.total_value || scan.totalValue ? formatCurrency(sn?.total_value || scan.totalValue) : <span className="text-muted">{sefaz?.status === 'loading' ? 'buscando…' : 'não vem no código'}</span>} />
                </dl>
              )}
              {scan.kind === 'nfce' && sefaz && sefaz.key === scan.key ? (
                <div className="rounded-xl ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 space-y-3">
                  <ol className="space-y-1.5 text-sm">
                    <Step done label="QR Code lido" />
                    <Step done={sefaz.status === 'ok'} fail={sefaz.status === 'fail'} loading={sefaz.status === 'loading'} label={sefaz.status === 'fail' ? 'Não consegui abrir a nota na SEFAZ' : sefaz.status === 'ok' ? 'Nota encontrada na SEFAZ' : 'Buscando a nota na SEFAZ…'} />
                    <Step done={!!sn && taxTotal(sn.taxes) > 0} fail={(sefaz.status !== 'loading' && !(sn && taxTotal(sn.taxes) > 0)) && cupom?.status !== 'loading'} loading={sefaz.status === 'loading' || cupom?.status === 'loading'} label={cupom?.status === 'loading' ? 'Lendo a foto do cupom com a IA…' : sn?.tax_origin === 'foto_ia' ? 'Tributos lidos da foto do cupom (IA)' : sefaz.status === 'fail' ? 'Tributos: fotografe o cupom para a IA ler' : sefaz.status === 'ok' ? (sn?.tax_origin === 'impresso' ? 'Tributos lidos do cupom (Lei 12.741)' : sn?.tax_origin === 'estimado_ia' ? 'Tributos estimados pela IA (Gemini)' : geminiKey ? 'A página da SEFAZ não trouxe os tributos — fotografe o cupom' : 'A página da SEFAZ não trouxe os tributos — configure o Gemini') : geminiKey ? 'Lendo itens e tributos com o Gemini' : 'Lendo tributos'} />
                  </ol>
                  {sn && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Kpi icon={Landmark} k={sn.tax_origin === 'estimado_ia' ? 'Tributos (estimativa)' : 'Tributos aprox.'} v={taxTotal(sn.taxes) ? formatCurrency(taxTotal(sn.taxes)) : '—'} accent={sn.tax_origin === 'estimado_ia' ? 'text-violet-500 dark:text-violet-300' : 'text-emerald-600 dark:text-emerald-300'} sub={sn.total_value && taxTotal(sn.taxes) ? `${((taxTotal(sn.taxes) / sn.total_value) * 100).toFixed(1).replace('.', ',')}% da compra` : null} />
                        <Kpi icon={ShoppingBag} k={sn.total_value ? 'Valor da nota' : 'Itens'} v={sn.total_value ? formatCurrency(sn.total_value) : (sn.items_count ?? (sn.items?.length || '—'))} />
                      </div>
                      {(sn.tax_split?.federal || sn.tax_split?.estadual || sn.tax_split?.municipal) ? <p className="text-xs text-muted">Federal {formatCurrency(sn.tax_split.federal || 0)} · Estadual {formatCurrency(sn.tax_split.estadual || 0)} · Municipal {formatCurrency(sn.tax_split.municipal || 0)}</p> : null}
                      {sn.tax_origin === 'estimado_ia' && <p className="text-[11px] rounded-lg bg-violet-500/10 ring-1 ring-violet-400/30 px-2.5 py-1.5 flex gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" /><span><b>Estimativa da IA</b>, não é o valor oficial. {sn.tax_basis}</span></p>}
                      {sn.items?.length > 0 && (
                        <div>
                          <button onClick={() => setShowItems((v) => !v)} className="text-xs font-semibold text-sky-500 hover:underline">{showItems ? 'Esconder itens' : `Ver os ${sn.items.length} itens`}</button>
                          {showItems && <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-[hsl(var(--border))] text-xs">{sn.items.map((it, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="truncate">{it.qty !== 1 ? `${String(it.qty).replace('.', ',')}× ` : ''}{it.name}</span><b className="shrink-0">{formatCurrency(it.total || it.unit_value * it.qty)}</b></li>)}</ul>}
                        </div>
                      )}
                      {sefaz.aiError && <p className="text-[11px] text-amber-600 dark:text-amber-300">A IA não respondeu ({sefaz.aiError}); usei só os dados lidos da SEFAZ.</p>}
                    </>
                  )}
                  {sefaz.status === 'fail' && (
                    <div className="text-xs text-muted space-y-2">
                      <p className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{sefaz.error} {sefaz.reason === 'captcha' ? 'Abra a consulta, confirme o captcha e tire uma foto do cupom para a IA ler.' : 'Você pode tentar de novo, abrir a consulta ou ler a foto do cupom com IA.'}</p>
                      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => runSefaz(scan.consultUrl, scan.key)}><RefreshCw className="w-3.5 h-3.5" /> Tentar de novo</Button></div>
                      {sefaz.debug && <details className="text-[10px]"><summary className="cursor-pointer">Detalhes técnicos</summary><p className="mt-1 break-all">HTTP {sefaz.debug.status} · {sefaz.debug.chars} caracteres · {sefaz.debug.url}</p><p className="mt-1 break-all opacity-80">{sefaz.debug.sample}</p></details>}
                    </div>
                  )}
                  {sefaz.status !== 'loading' && !(sn && taxTotal(sn.taxes) > 0) && (
                    <div className="rounded-xl ring-1 ring-violet-400/40 bg-violet-500/10 p-3 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2"><Camera className="w-4 h-4 text-violet-400" />Ler os tributos pela foto do cupom</p>
                      <p className="text-xs text-muted">Fotografe o cupom inteiro (ou envie o PDF): a IA lê o valor e os "Tributos totais incidentes" impressos — o mesmo leitor da importação de PDF.</p>
                      {geminiKey ? (
                        <>
                          <input ref={cupomRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onCupom} />
                          <Button size="sm" onClick={() => cupomRef.current?.click()} disabled={cupom?.status === 'loading'}>{cupom?.status === 'loading' ? <><Spinner className="w-3.5 h-3.5" /> Lendo com a IA…</> : <><Camera className="w-3.5 h-3.5" /> Fotografar o cupom</>}</Button>
                          {cupom?.error && cupom.key === scan.key && <p className="text-xs text-amber-600 dark:text-amber-300">{cupom.error}</p>}
                        </>
                      ) : <p className="text-xs text-amber-600 dark:text-amber-300">Configure a chave do Gemini em Configurações para usar a leitura por foto.</p>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{scan.kind === 'nfe' ? 'NF-e (modelo 55): a SEFAZ só entrega o XML completo com certificado digital ou captcha, então não dá para buscar sozinho. Importe o XML/PDF ou leia a foto da DANFE com IA.' : scan.kind === 'nfse' ? 'NFS-e: informe o ISS na revisão ou importe o PDF/XML da nota.' : 'Sem o link do QR Code não dá para consultar a SEFAZ automaticamente. Use a câmera no QR do cupom ou leia a foto com IA.'}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={useScan} disabled={sefaz?.status === 'loading' && sefaz.key === scan.key}>{sefaz?.status === 'loading' && sefaz.key === scan.key ? <><Spinner className="w-4 h-4" /> Buscando na SEFAZ…</> : <><CheckCircle2 className="w-4 h-4" /> {sn ? 'Revisar e salvar' : 'Continuar e revisar'}</>}</Button>
                {sn && !scan.duplicate && (sn.total_value > 0) && <Button variant="outline" onClick={() => onUse(withFile(toReview(scan, sn)), { save: true })}><Sparkles className="w-4 h-4 text-emerald-500" /> Salvar agora</Button>}
                {tab === 'foto' && photo && geminiKey && <Button variant="outline" onClick={readPhotoWithAi} disabled={busy}><Sparkles className="w-4 h-4 text-violet-500" /> Completar com IA (foto)</Button>}
                {scan.consultUrl && <Button variant="outline" onClick={() => window.open(scan.consultUrl, '_blank', 'noopener')}><ExternalLink className="w-4 h-4" /> Consultar na SEFAZ</Button>}
                <Button variant="ghost" onClick={() => { reset(); setPhoto(null); }}><RefreshCw className="w-4 h-4" /> Ler outra</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const taxTotal = (t = {}) => { const soma = ['icms', 'ipi', 'ii', 'iss', 'pis', 'cofins', 'irrf', 'csll', 'inss', 'ibs', 'cbs'].reduce((a, k) => a + (Number(t[k]) || 0), 0); return soma > 0 ? soma : Number(t.aproximado) || 0; };

function Step({ done, fail, loading, label }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${done ? 'bg-emerald-500 text-white' : fail ? 'bg-amber-500/20 text-amber-500' : 'bg-black/10 dark:bg-white/10 text-muted'}`}>{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <CheckCircle2 className="w-3.5 h-3.5" /> : fail ? <AlertTriangle className="w-3 h-3" /> : null}</span>
      <span className={done ? 'font-medium' : 'text-muted'}>{label}</span>
    </li>
  );
}
function Kpi({ icon: Icon, k, v, sub, accent = '' }) {
  return <div className="rounded-lg bg-black/5 dark:bg-white/5 px-2.5 sm:px-3 py-2 min-w-0"><p className="text-[10px] sm:text-[11px] text-muted flex items-center gap-1 truncate"><Icon className="w-3 h-3 shrink-0" />{k}</p><p className={`font-display text-sm sm:text-base font-bold truncate ${accent}`}>{v}</p>{sub && <p className="text-[10px] text-muted">{sub}</p>}</div>;
}

function Item({ k, v, wide }) {
  return <div className={wide ? 'col-span-2 sm:col-span-3' : ''}><dt className="text-[11px] text-muted">{k}</dt><dd className="font-semibold truncate">{v}</dd></div>;
}

function toReview(s, sn) {
  const info = s.info || {};
  const base = {
    access_key: s.key,
    number: info.numero || '',
    emitter: s.emitterName || '',
    emitter_cnpj: info.cnpj || '',
    issued_date: s.issuedAt || '',
    reference_month: s.issuedAt ? s.issuedAt.slice(0, 7) : (info.referenceMonth || ''),
    total_value: s.totalValue || '',
    taxes: {},
    note_type: s.kind === 'nfse' ? 'servico' : 'produto',
    source: s.format === 'barcode' ? 'barcode' : s.format === 'manual' ? 'chave' : 'qrcode',
    consult_url: s.consultUrl || null,
  };
  if (!sn) return base;
  // dados lidos na SEFAZ completam (e corrigem) o que o código trazia
  return {
    ...base,
    emitter: sn.emitter || base.emitter,
    emitter_cnpj: sn.emitter_cnpj || base.emitter_cnpj,
    number: sn.number || base.number,
    issued_date: sn.issued_date || base.issued_date,
    reference_month: (sn.issued_date || base.issued_date || '').slice(0, 7) || base.reference_month,
    total_value: sn.total_value || base.total_value,
    taxes: { ...(sn.taxes || {}) },
    tax_origin: sn.tax_origin,
    tax_basis: sn.tax_basis,
  };
}
