import nodemailer from 'nodemailer';
import { getMailConfig } from './settings.js';

const E = process.env;
// Provedor SMTP por variáveis de ambiente (Brevo, Resend, SendGrid, SES, etc.).
// Tem prioridade sobre o Gmail salvo no banco — resolve o limite diário do Gmail.
// true quando o provedor SMTP externo (ex.: Brevo) está configurado por env
export function envConfigured() { return !!(E.EMAIL_HOST && E.EMAIL_USER && E.EMAIL_PASS); }
// quais variáveis obrigatórias ainda faltam (para diagnóstico no painel)
export function envMissing() { return ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'].filter((k) => !E[k]); }

function envSmtp() {
  if (!E.EMAIL_HOST || !E.EMAIL_USER || !E.EMAIL_PASS) return null;
  const port = Number(E.EMAIL_PORT || 587);
  return {
    host: E.EMAIL_HOST, port, secure: port === 465,
    user: E.EMAIL_USER, pass: E.EMAIL_PASS,
    fromAddr: E.EMAIL_FROM || E.EMAIL_USER,
    fromName: E.EMAIL_FROM_NAME || 'Monvy',
  };
}

const _txCache = {};
function transporter(opts) {
  const key = `${opts.host}:${opts.port}:${opts.user}`;
  if (_txCache[key]) return _txCache[key];
  const tx = nodemailer.createTransport({ host: opts.host, port: opts.port, secure: opts.secure, auth: { user: opts.user, pass: opts.pass } });
  _txCache[key] = tx; return tx;
}

// Monta a lista de provedores disponíveis, em ordem de preferência:
// 1) SMTP das variáveis de ambiente (ex.: Brevo)  2) Gmail salvo no banco.
// Assim, se o primeiro falhar (ex.: limite diário), tenta o próximo automaticamente.
function providers(cfg) {
  const list = [];
  // 1) SMTP configurado pelo painel do admin (tem prioridade)
  if (cfg && cfg.smtpHost && cfg.smtpUser && cfg.smtpPass) {
    const port = Number(cfg.smtpPort) || 587;
    list.push({ label: 'smtp', host: cfg.smtpHost, port, secure: port === 465, user: cfg.smtpUser, pass: cfg.smtpPass, fromAddr: cfg.smtpFrom || cfg.smtpUser, fromName: cfg.smtpFromName || 'Monvy' });
  }
  // 2) SMTP por variáveis de ambiente (ex.: Brevo na Vercel)
  const env = envSmtp();
  if (env) list.push({ label: 'env', host: env.host, port: env.port, secure: env.secure, user: env.user, pass: env.pass, fromAddr: env.fromAddr, fromName: env.fromName });
  // 3) Gmail salvo no banco (reserva)
  if (cfg && cfg.enabled && cfg.from && cfg.password) list.push({ label: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true, user: cfg.from, pass: cfg.password, fromAddr: cfg.from, fromName: 'Monvy' });
  return list;
}

// Envia e-mail se configurado/habilitado. Nunca lanca (não quebra o fluxo principal).
// Tenta cada provedor em ordem; se um falhar, cai para o próximo (fallback).
export async function sendMail({ to, subject, html, replyTo }) {
  try {
    const cfg = await getMailConfig().catch(() => ({}));
    const list = providers(cfg);
    if (!list.length) return { skipped: true };
    // versao em texto puro (melhora a entregabilidade e evita marcacao de spam)
    const text = String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
    let lastErr = null;
    for (const p of list) {
      try {
        const msg = {
          from: `${p.fromName} <${p.fromAddr}>`, to, subject, html, text,
          headers: { 'List-Unsubscribe': `<mailto:${p.fromAddr}?subject=descadastrar>`, 'Auto-Submitted': 'auto-generated' },
        };
        if (replyTo) msg.replyTo = replyTo;
        await transporter(p).sendMail(msg);
        return { sent: true, via: p.label };
      } catch (e) { lastErr = e; /* tenta o próximo provedor */ }
    }
    return { error: lastErr ? lastErr.message : 'Falha ao enviar e-mail' };
  } catch (e) { return { error: e.message }; }
}

export function tpl(title, bodyHtml, opts = {}) {
  const cta = opts.ctaText && opts.ctaUrl
    ? `<a href="${opts.ctaUrl}" style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#059669,#34d399);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;font-size:14px">${opts.ctaText}</a>`
    : '';
  const logo = `<span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-.5px">Mon<span style="color:#34d399">vy</span></span>`;
  return `<div style="margin:0;padding:24px;background:#eef2f7">
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(8,13,31,.15)">
      <div style="padding:26px 28px;background:linear-gradient(135deg,#080d1f 0%,#0b1330 55%,#111b3f 100%)">${logo}
        <div style="height:3px;width:54px;margin-top:12px;border-radius:3px;background:linear-gradient(90deg,#059669,#34d399)"></div>
      </div>
      <div style="padding:28px;background:#ffffff">
        <h2 style="margin:0 0 12px;color:#0b1330;font-size:20px;font-weight:800">${title}</h2>
        <div style="color:#475569;font-size:14px;line-height:1.7">${bodyHtml}</div>
        ${cta}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;line-height:1.6">
          Atenciosamente,
          <table style="border-collapse:collapse;margin-top:12px"><tr>
            <td style="vertical-align:middle;padding-right:14px">
              <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#059669,#34d399);color:#ffffff;font-weight:800;font-size:24px;text-align:center;line-height:48px;font-family:Arial,sans-serif">M</div>
            </td>
            <td style="vertical-align:middle">
              <div style="color:#0b1330;font-weight:800;font-size:15px">Vinicius Santos</div>
              <div style="color:#059669;font-weight:700;font-size:12px">Desenvolvedor do Monvy</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:2px">Mon<span style="color:#10b981">vy</span> · Gestao Financeira Pessoal</div>
            </td>
          </tr></table>
        </div>
      </div>
      <div style="padding:14px 28px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center">Monvy — Gestao Financeira Pessoal · ${opts.footerNote || 'e-mail automático, por favor não responda.'}</div>
    </div>
  </div>`;
}

// linha de item para tabelas de e-mail (ex: vencimentos)
export function itemRow(label, sub, amount, color = '#0b1330') {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7">
      <div style="color:#0b1330;font-weight:600;font-size:14px">${label}</div>
      <div style="color:#94a3b8;font-size:12px">${sub || ''}</div>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;text-align:right;color:${color};font-weight:700;font-size:14px;white-space:nowrap">${amount}</td>
  </tr>`;
}
export function itemsTable(rows) {
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">${rows.join('')}</table>`;
}
