import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s) {
  s = String(s).toUpperCase().replace(/=+$/,'').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

// verifica com janela de +/- 1 (tolerancia de relogio)
export function verifyTotp(token, secret, window = 1) {
  if (!token || !secret) return false;
  const t = Math.floor(Date.now() / 1000 / 30);
  const clean = String(token).replace(/\s/g, '');
  for (let e = -window; e <= window; e++) if (hotp(secret, t + e) === clean) return true;
  return false;
}

export function otpauthURL(secret, label, issuer = 'Monvy') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6&algorithm=SHA1`;
}
