// Leitor de QR Code e código de barras (CODE-128 da DANFE) no navegador.
// 1º tenta a API nativa BarcodeDetector (Chrome/Edge/Android, rápida e sem
// download); se não existir, carrega sob demanda o ZXing (@zxing/browser,
// github.com/zxing-js/browser), que funciona em qualquer navegador moderno.

const FORMATS_NATIVE = ['qr_code', 'code_128', 'ean_13', 'itf'];

async function nativeDetector() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS_NATIVE.filter((f) => supported.includes(f));
    if (!formats.includes('qr_code')) return null;
    return new window.BarcodeDetector({ formats });
  } catch { return null; }
}

let zxingCache = null;
async function zxingReader() {
  if (!zxingCache) {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.ITF, BarcodeFormat.EAN_13]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    zxingCache = { BrowserMultiFormatReader, hints };
  }
  return new zxingCache.BrowserMultiFormatReader(zxingCache.hints, { delayBetweenScanAttempts: 150 });
}

const fmtName = (f) => String(f || '').toLowerCase().includes('qr') ? 'qrcode' : 'barcode';

// Lê de uma imagem (foto do cupom/DANFE). Retorna { text, format } ou null.
export async function decodeImageFile(file) {
  const det = await nativeDetector();
  if (det) {
    try {
      const bmp = await createImageBitmap(file);
      const found = await det.detect(bmp);
      if (found?.length) return { text: found[0].rawValue, format: fmtName(found[0].format) };
    } catch { /* cai para o ZXing */ }
  }
  const url = URL.createObjectURL(file);
  const asResult = (res) => ({ text: res.getText(), format: res.getBarcodeFormat() === 11 ? 'qrcode' : 'barcode' });
  try {
    const reader = await zxingReader();
    try { return asResult(await reader.decodeFromImageUrl(url)); } catch { /* tenta variações abaixo */ }
    // Fotos reais: QR pequeno, sem margem branca ou com pouca resolução. Redesenha
    // a imagem em escalas diferentes, com borda branca e em tons de cinza, e tenta de novo.
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    for (const scale of [2, 1.5, 3, 0.75, 0.5]) {
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      if (w * h > 16_000_000 || w < 120) continue;
      const pad = Math.round(Math.max(w, h) * 0.08);
      const canvas = document.createElement('canvas'); canvas.width = w + pad * 2; canvas.height = h + pad * 2;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'grayscale(1) contrast(1.4)';
      ctx.drawImage(img, pad, pad, w, h);
      try { return asResult(reader.decodeFromCanvas(canvas)); } catch { /* próxima escala */ }
    }
    return null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

// Câmera ao vivo no <video>. Chama onResult({ text, format }) na 1ª leitura e para sozinho.
// Retorna uma função stop().
export async function startCameraScan(video, onResult, onError) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não dá acesso à câmera.');
  const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
  let stopped = false;
  const det = await nativeDetector();

  if (det) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream; video.setAttribute('playsinline', 'true'); await video.play().catch(() => {});
    let timer;
    const stop = () => { stopped = true; clearTimeout(timer); stream.getTracks().forEach((t) => t.stop()); if (video.srcObject === stream) video.srcObject = null; };
    const tick = async () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2) {
          const found = await det.detect(video);
          if (found?.length) { const r = { text: found[0].rawValue, format: fmtName(found[0].format) }; stop(); onResult(r); return; }
        }
      } catch (e) { onError?.(e); }
      timer = setTimeout(tick, 220);
    };
    tick();
    return stop;
  }

  const reader = await zxingReader();
  let controls = null;
  // o 3º argumento do callback já traz os controles: evita acessar `controls`
  // antes de ele existir quando o código é lido logo no primeiro quadro
  controls = await reader.decodeFromConstraints(constraints, video, (result, _err, ctl) => {
    if (!result || stopped) return;
    stopped = true;
    const r = { text: result.getText(), format: result.getBarcodeFormat() === 11 ? 'qrcode' : 'barcode' };
    setTimeout(() => { try { (ctl || controls)?.stop(); } catch { /* */ } onResult(r); }, 0);
  });
  return () => { stopped = true; controls?.stop(); };
}
