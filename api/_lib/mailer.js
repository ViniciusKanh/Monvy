import nodemailer from 'nodemailer';
import { getMailConfig } from './settings.js';

let _tx = null, _key = '';
function transporter(cfg) {
  const key = `${cfg.from}:${cfg.password}`;
  if (_tx && _key === key) return _tx;
  _tx = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: cfg.from, pass: cfg.password } });
  _key = key; return _tx;
}

// Envia e-mail se configurado/habilitado. Nunca lanca (nao quebra o fluxo principal).
export async function sendMail({ to, subject, html }) {
  try {
    const cfg = await getMailConfig();
    if (!cfg.enabled || !cfg.from || !cfg.password) return { skipped: true };
    await transporter(cfg).sendMail({ from: `Monvy <${cfg.from}>`, to, subject, html });
    return { sent: true };
  } catch (e) { return { error: e.message }; }
}

export function tpl(title, body) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;background:#0b1330;border-radius:16px;overflow:hidden">
    <div style="padding:22px 24px;background:linear-gradient(135deg,#080d1f,#111b3f)">
      <span style="font-size:22px;font-weight:800;color:#fff">Mon<span style="color:#10b981">vy</span></span>
    </div>
    <div style="padding:24px;background:#fff">
      <h2 style="margin:0 0 8px;color:#0b1330;font-size:18px">${title}</h2>
      <div style="color:#475569;font-size:14px;line-height:1.6">${body}</div>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px">Monvy — Gestao Financeira</p>
    </div>
  </div>`;
}
