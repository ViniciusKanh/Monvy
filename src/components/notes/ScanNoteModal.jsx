import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Keyboard, ScanLine, QrCode, Barcode, CheckCircle2, AlertTriangle, ExternalLink, Copy, Sparkles, X, RefreshCw } from 'lucide-react';
import { Button, Spinner } from '../ui';
import { startCameraScan, decodeImageFile } from '../../lib/codeScanner.js';
import { extractFromCode, formatKey, formatCnpj, lookupCnpjName } from '../../lib/nfeKey.js';
import { Ai } from '../../api/entities.js';
import { formatCurrency } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';

const TABS = [['camera', 'Câmera', Camera], ['foto', 'Foto / imagem', ImageUp], ['chave', 'Digitar chave', Keyboard]];
const MAX_FILE_B64 = 1_800_000;
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
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const chainRef = useRef(Promise.resolve());
  const fileRef = useRef(null);

  const stopCam = () => { try { stopRef.current?.(); } catch { /* */ } stopRef.current = null; };
  const reset = () => { setScan(null); setError(''); };

  useEffect(() => { if (!open) { stopCam(); setScan(null); setError(''); setPhoto(null); setTyped(''); setCamState('idle'); setTab('camera'); } }, [open]);
  useEffect(() => () => stopCam(), []);

  const handleText = async (text, format) => {
    const r = extractFromCode(text);
    if (!r.key) { setError('Li um código, mas ele não contém a chave de uma nota fiscal. Tente o QR Code do cupom ou o código de barras da DANFE.'); setScan({ ...r, format }); return; }
    setError('');
    const base = { ...r, format, emitterName: null, duplicate: existingKeys?.has(r.key) };
    setScan(base);
    if (r.info?.cnpj) { const name = await lookupCnpjName(r.info.cnpj); if (name) setScan((s) => (s && s.key === r.key ? { ...s, emitterName: name } : s)); }
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
      const b64 = await toB64(photo.file);
      const { note } = await Ai.parseDanfe(b64, geminiKey, photo.file.type || 'image/jpeg');
      if (!note) throw new Error('A IA não encontrou dados na foto.');
      const fromKey = scan?.key ? toReview(scan) : {};
      onUse({
        ...note, ...Object.fromEntries(Object.entries(fromKey).filter(([, v]) => v !== '' && v != null && !(typeof v === 'object' && !Object.keys(v).length))),
        taxes: { ...(note.taxes || {}) },
        total_value: fromKey.total_value || note.total_value,
        source: scan?.key ? (scan.format === 'barcode' ? 'barcode' : 'qrcode') : 'foto',
        file_data: b64.length <= MAX_FILE_B64 ? b64 : null, file_name: photo.file.name, file_type: photo.file.type || 'image/jpeg',
      });
      toast.success('Foto lida pela IA. Confira os valores antes de salvar.');
    } catch (err) { toast.error(err.message || 'Falha ao ler a foto.'); }
    finally { setBusy(false); }
  };

  const useScan = () => { if (scan?.key) onUse(toReview(scan)); };

  if (!open) return null;
  const info = scan?.info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Escanear nota fiscal">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[hsl(var(--card))] ring-1 ring-sky-400/30 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center"><ScanLine className="w-6 h-6" /></span>
            <div><h2 className="font-display text-xl font-bold">Escanear nota fiscal</h2><p className="text-xs text-muted">QR Code do cupom (NFC-e), código de barras da DANFE (NF-e) ou QR da NFS-e.</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div role="tablist" className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-[hsl(var(--border))]">
            {TABS.map(([k, l, Ic]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); reset(); }} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${tab === k ? 'bg-sky-500/20 text-sky-600 dark:text-sky-200 ring-1 ring-sky-400/50' : 'text-muted hover:text-[hsl(var(--text))]'}`}><Ic className="w-4 h-4" /> {l}</button>
            ))}
          </div>

          {!scan?.key && tab === 'camera' && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[62%] h-[62%]">
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
                  <Item k="Emitente" v={scan.emitterName || <span className="text-muted">buscando…</span>} wide />
                  <Item k="CNPJ" v={formatCnpj(info.cnpj)} />
                  <Item k="Número / série" v={`${info.numero} / ${info.serie}`} />
                  <Item k={scan.issuedAt ? 'Emissão' : 'Mês de emissão'} v={scan.issuedAt ? new Date(scan.issuedAt + 'T00:00').toLocaleDateString('pt-BR') : `${String(info.month).padStart(2, '0')}/${info.year}`} />
                  <Item k="UF" v={info.uf || '—'} />
                  <Item k="Valor da nota" v={scan.totalValue ? formatCurrency(scan.totalValue) : <span className="text-muted">não vem no código</span>} />
                </dl>
              )}
              <p className="text-xs text-muted">Os tributos não ficam no código. Na revisão, informe o valor aproximado impresso no cupom ("Tributos totais incidentes — Lei 12.741/2012"){geminiKey ? ', ou use a IA para ler a foto' : ''}. Para leitura exata, importe o XML.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={useScan}><CheckCircle2 className="w-4 h-4" /> Continuar e revisar</Button>
                {tab === 'foto' && photo && geminiKey && <Button variant="outline" onClick={readPhotoWithAi} disabled={busy}><Sparkles className="w-4 h-4 text-violet-500" /> Completar com IA (foto)</Button>}
                {scan.consultUrl && <Button variant="outline" onClick={() => window.open(scan.consultUrl, '_blank', 'noopener')}><ExternalLink className="w-4 h-4" /> Consultar na SEFAZ</Button>}
                <Button variant="ghost" onClick={() => { reset(); setPhoto(null); }}><RefreshCw className="w-4 h-4" /> Ler outra</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ k, v, wide }) {
  return <div className={wide ? 'col-span-2 sm:col-span-3' : ''}><dt className="text-[11px] text-muted">{k}</dt><dd className="font-semibold truncate">{v}</dd></div>;
}

function toReview(s) {
  const info = s.info || {};
  return {
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
}
