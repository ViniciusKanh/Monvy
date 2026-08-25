import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getSetting, setSetting } from '../_lib/settings.js';
import { sendMail, tpl } from '../_lib/mailer.js';

function baseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${req.headers['x-forwarded-proto'] || 'https'}://${host}` : '';
}
async function adminEmails() {
  const r = await db().execute(`SELECT email FROM users WHERE role='admin' AND (is_active IS NULL OR is_active=1)`);
  return r.rows.map((x) => x.email).filter(Boolean);
}

const DEFAULT_ARTICLES = [
  { category: 'Primeiros passos', title: 'Como comecar no Monvy', body: 'Cadastre suas contas em Contas, depois registre receitas e despesas em Lancamentos. No Dashboard você acompanha o resumo do mês, o fluxo de caixa e os gastos por categoria. Dica: defina um orcamento por categoria para receber alertas quando gastar demais.' },
  { category: 'Cartao de crédito', title: 'Como importar a fatura do cartão', body: 'Abra Cartoes, selecione o cartão e o mês, e clique em Importar fatura. Envie o PDF da fatura: o Monvy le, separa e categoriza cada compra automaticamente, considerando estornos e creditos. Se algo não bater, compare o total com o do PDF e use Excluir fatura para reimportar.' },
  { category: 'Cartao de crédito', title: 'Como pagar uma fatura', body: 'Na tela do cartão, no mês desejado, clique em Pagar fatura. Escolha a conta de debito e o tipo de pagamento (valor total ou parcial). O pagamento vira um lancamento na conta escolhida. Você pode pagar faturas de meses anteriores tambem.' },
  { category: 'Ferramentas', title: 'Como funciona o Simulador', body: 'O Simulador aprende com o seu histórico (receitas e despesas, incluindo o cartão) e projeta cenarios: cortar gastos, aumentar receita, nova despesa parcelada, poupar meta e investimento. Os valores são ESTIMATIVAS estatisticas com base no passado, não uma garantia do futuro.' },
  { category: 'Planejamento', title: 'Metas e Cofres', body: 'Cada meta tem um cofre virtual. Crie uma meta com um valor-alvo e guarde dinheiro aos poucos; o progresso aparece na meta e no cofre, que estao sincronizados.' },
  { category: 'Seguranca', title: 'Ativar verificacao em duas etapas (2FA)', body: 'Em Configuracoes, na secao Verificacao em duas etapas, clique em Ativar, escaneie o QR code no seu app autenticador (Google Authenticator, Authy ou Microsoft Authenticator) e confirme com o codigo de 6 digitos. No próximo login o codigo sera pedido.' },
  { category: 'Suporte', title: 'Como abrir um chamado', body: 'Nesta pagina de Ajuda, clique em Abrir chamado, descreva o problema e anexe uma imagem se quiser. Você acompanha a resposta em Meus chamados. Se a solucao não resolver, e possivel reabrir o chamado.' },
];

async function seedArticles(ownerId) {
  if ((await getSetting('help_seeded')) === '1') return;
  for (const a of DEFAULT_ARTICLES) {
    await db().execute({ sql: `INSERT INTO HelpArticle (id,title,body,category,published,created_by_id,created_date,updated_date) VALUES (?,?,?,?,1,?,?,?)`, args: [newId(), a.title, a.body, a.category, ownerId, nowIso(), nowIso()] });
  }
  await setSetting('help_seeded', '1');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo não permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Não autenticado' });
    const u = (await db().execute({ sql: 'SELECT id, role, email, full_name FROM users WHERE id = ?', args: [auth.sub] })).rows[0];
    if (!u) return sendJson(res, 401, { error: 'Usuario não encontrado' });
    const isAdmin = u.role === 'admin';

    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const action = parts[parts.indexOf('support') + 1];
    const body = await readBody(req);
    const op = body.op;

    // ---------- ARTIGOS ----------
    if (action === 'articles') {
      await seedArticles(u.id);
      if (op === 'list') {
        const sql = isAdmin
          ? `SELECT * FROM HelpArticle WHERE (is_deleted IS NULL OR is_deleted=0) ORDER BY category, created_date DESC`
          : `SELECT * FROM HelpArticle WHERE (is_deleted IS NULL OR is_deleted=0) AND published=1 ORDER BY category, created_date DESC`;
        const rows = (await db().execute(sql)).rows;
        return sendJson(res, 200, { articles: rows.map((a) => ({ ...a, published: a.published === 1 })) });
      }
      if (!isAdmin) return sendJson(res, 403, { error: 'Apenas administradores' });
      if (op === 'save') {
        const { id, title, body: content, category, published } = body;
        if (!title) return sendJson(res, 400, { error: 'Titulo obrigatorio' });
        if (id) {
          await db().execute({ sql: `UPDATE HelpArticle SET title=?, body=?, category=?, published=?, updated_date=? WHERE id=?`, args: [title, content || '', category || 'Geral', published === false ? 0 : 1, nowIso(), id] });
          return sendJson(res, 200, { ok: true, id });
        }
        const nid = newId();
        await db().execute({ sql: `INSERT INTO HelpArticle (id,title,body,category,published,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?)`, args: [nid, title, content || '', category || 'Geral', published === false ? 0 : 1, u.id, nowIso(), nowIso()] });
        return sendJson(res, 200, { ok: true, id: nid });
      }
      if (op === 'delete') {
        await db().execute({ sql: `UPDATE HelpArticle SET is_deleted=1, updated_date=? WHERE id=?`, args: [nowIso(), body.id] });
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: 'Operacao invalida' });
    }

    // ---------- CHAMADOS ----------
    if (action === 'tickets') {
      const appLink = `${baseUrl(req)}/ajuda`;
      if (op === 'create') {
        const { subject, description, image_url, category } = body;
        if (!subject || !description) return sendJson(res, 400, { error: 'Assunto e descricao são obrigatorios' });
        const id = newId();
        const number = Number((await db().execute(`SELECT COALESCE(MAX(number),1000) n FROM SupportTicket`)).rows[0]?.n || 1000) + 1;
        await db().execute({ sql: `INSERT INTO SupportTicket (id,number,subject,status,category,priority,user_name,user_email,image_url,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, number, subject, 'open', category || 'Duvida', 'normal', u.full_name || '', u.email, image_url || null, u.id, nowIso(), nowIso()] });
        await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,image_url,created_date) VALUES (?,?,?,?,?,?,?,?)`, args: [newId(), id, u.id, 'user', u.full_name || u.email, description, image_url || null, nowIso()] });
        // notifica os admins (podem responder por e-mail direto ao usuário via Reply-To, ou no app)
        const admins = await adminEmails();
        if (admins.length) sendMail({
          to: admins.join(','), replyTo: u.email,
          subject: `Novo chamado: ${subject}`,
          html: tpl('Novo chamado aberto 🎫', `<b>${u.full_name || u.email}</b> abriu um chamado.<br/><br/><b>Assunto:</b> ${subject}<br/><b>Categoria:</b> ${category || 'Duvida'}<br/><b>Descricao:</b><br/>${String(description).replace(/</g, '&lt;').slice(0, 1200)}${image_url ? '<br/><br/>(o usuário anexou um arquivo)' : ''}`, { ctaText: 'Responder no app', ctaUrl: appLink, footerNote: 'responda este e-mail para falar direto com o usuário.' }),
        }).catch(() => {});
        return sendJson(res, 200, { ok: true, id });
      }
      if (op === 'list') {
        const rows = isAdmin
          ? (await db().execute(`SELECT * FROM SupportTicket WHERE (is_deleted IS NULL OR is_deleted=0) ORDER BY updated_date DESC`)).rows
          : (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE created_by_id=? AND (is_deleted IS NULL OR is_deleted=0) ORDER BY updated_date DESC`, args: [u.id] })).rows;
        return sendJson(res, 200, { tickets: rows, isAdmin });
      }
      if (op === 'get') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado não encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        const messages = (await db().execute({ sql: `SELECT * FROM TicketMessage WHERE ticket_id=? ORDER BY created_date ASC`, args: [body.id] })).rows;
        return sendJson(res, 200, { ticket: t, messages, isAdmin });
      }
      if (op === 'reply') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado não encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        if (!body.body) return sendJson(res, 400, { error: 'Mensagem vazia' });
        await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,image_url,created_date) VALUES (?,?,?,?,?,?,?,?)`, args: [newId(), body.id, u.id, isAdmin ? 'admin' : 'user', u.full_name || u.email, body.body, body.image_url || null, nowIso()] });
        const newStatus = isAdmin ? 'answered' : 'pending';
        await db().execute({ sql: `UPDATE SupportTicket SET status=?, updated_date=? WHERE id=?`, args: [newStatus, nowIso(), body.id] });
        if (isAdmin) {
          // resposta do suporte -> avisa o usuário
          if (t.user_email) sendMail({ to: t.user_email, subject: `Resposta ao seu chamado: ${t.subject}`, html: tpl('Você tem uma resposta do suporte 💬', `Seu chamado <b>${t.subject}</b> foi respondido:<br/><br/>${String(body.body).replace(/</g, '&lt;').slice(0, 1200)}`, { ctaText: 'Ver no app', ctaUrl: appLink }) }).catch(() => {});
        } else {
          // resposta do usuário -> avisa os admins
          const admins = await adminEmails();
          if (admins.length) sendMail({ to: admins.join(','), replyTo: u.email, subject: `Nova mensagem no chamado: ${t.subject}`, html: tpl('Nova mensagem em um chamado 💬', `<b>${u.full_name || u.email}</b> respondeu no chamado <b>${t.subject}</b>:<br/><br/>${String(body.body).replace(/</g, '&lt;').slice(0, 1200)}`, { ctaText: 'Responder no app', ctaUrl: appLink, footerNote: 'responda este e-mail para falar direto com o usuário.' }) }).catch(() => {});
        }
        return sendJson(res, 200, { ok: true });
      }
      if (op === 'meta') { // admin: categoria/prioridade (escalonamento)
        if (!isAdmin) return sendJson(res, 403, { error: 'Apenas administradores' });
        const sets = [], args = [];
        if (body.category !== undefined) { sets.push('category=?'); args.push(body.category); }
        if (body.priority !== undefined) { sets.push('priority=?'); args.push(body.priority); }
        if (!sets.length) return sendJson(res, 400, { error: 'Nada para atualizar' });
        sets.push('updated_date=?'); args.push(nowIso(), body.id);
        await db().execute({ sql: `UPDATE SupportTicket SET ${sets.join(', ')} WHERE id=?`, args });
        return sendJson(res, 200, { ok: true });
      }
      if (op === 'status') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado não encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        const s = body.status || 'open';
        const label = body.statusLabel || s;
        const final = !!body.final;
        const wasFinal = !!t.resolved_date;
        const resolvedDate = final ? nowIso() : (wasFinal ? null : t.resolved_date);
        await db().execute({ sql: `UPDATE SupportTicket SET status=?, resolved_date=?, updated_date=? WHERE id=?`, args: [s, resolvedDate, nowIso(), body.id] });
        const evt = final ? `Chamado finalizado (${label}).` : (wasFinal ? `Chamado reaberto (${label}).` : `Status alterado para "${label}".`);
        await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,created_date) VALUES (?,?,?,?,?,?,?)`, args: [newId(), body.id, u.id, isAdmin ? 'admin' : 'user', u.full_name || u.email, evt, nowIso()] });
        if (final && isAdmin && t.user_email) sendMail({ to: t.user_email, subject: `Chamado #${t.number || ''} finalizado: ${t.subject}`, html: tpl('Seu chamado foi finalizado ✅', `O chamado <b>#${t.number || ''} — ${t.subject}</b> foi finalizado (${label}). Se a solucao não te atender, você pode reabri-lo no app.`, { ctaText: 'Ver no app', ctaUrl: `${baseUrl(req)}/chamados` }) }).catch(() => {});
        if (!final && wasFinal && !isAdmin) { const admins = await adminEmails(); if (admins.length) sendMail({ to: admins.join(','), replyTo: t.user_email, subject: `Chamado #${t.number || ''} reaberto: ${t.subject}`, html: tpl('Um chamado foi reaberto 🔁', `O usuário <b>${t.user_name || t.user_email}</b> reabriu o chamado <b>#${t.number || ''} — ${t.subject}</b>.`, { ctaText: 'Ver no app', ctaUrl: `${baseUrl(req)}/chamados` }) }).catch(() => {}); }
        return sendJson(res, 200, { ok: true });
      }
      if (op === 'delete') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado não encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        await db().execute({ sql: `UPDATE SupportTicket SET is_deleted=1, updated_date=? WHERE id=?`, args: [nowIso(), body.id] });
        const when = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
        const quem = u.full_name || u.email;
        const detalhe = `
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
            <tr><td style="padding:6px 0;color:#64748b">Chamado</td><td style="padding:6px 0;text-align:right;font-weight:700">#${t.number || ''} — ${String(t.subject || '').replace(/</g, '&lt;')}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Categoria</td><td style="padding:6px 0;text-align:right">${t.category || 'Duvida'}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Prioridade</td><td style="padding:6px 0;text-align:right">${t.priority || 'normal'}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Aberto por</td><td style="padding:6px 0;text-align:right">${t.user_name || t.user_email || '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Excluido por</td><td style="padding:6px 0;text-align:right">${quem}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Data da exclusao</td><td style="padding:6px 0;text-align:right">${when}</td></tr>
          </table>`;
        const html = tpl('Um chamado foi excluido 🗑️', `O chamado abaixo foi <b>removido</b> da Central de Tickets. Este e um aviso automático para manter o histórico rastreavel.${detalhe}`, { ctaText: 'Ver a Central de Tickets', ctaUrl: `${baseUrl(req)}/chamados`, footerNote: 'exclusao registrada automaticamente pelo Monvy.' });
        const destinatarios = new Set();
        if (t.user_email) destinatarios.add(t.user_email);
        for (const a of await adminEmails()) destinatarios.add(a);
        if (destinatarios.size) sendMail({ to: [...destinatarios].join(','), subject: `Chamado #${t.number || ''} excluido: ${t.subject}`, html }).catch(() => {});
        // Notificação no app (garante o aviso mesmo sem e-mail configurado) — para o dono do chamado
        if (t.created_by_id) {
          await db().execute({ sql: `INSERT INTO Notification (id,kind,title,text,path,read,is_deleted,created_date,updated_date,created_by_id) VALUES (?,?,?,?,?,0,0,?,?,?)`,
            args: [newId(), 'ticket', `Chamado #${t.number || ''} excluido`, `${String(t.subject || '').slice(0, 80)} — excluido por ${quem}`, '/chamados', nowIso(), nowIso(), t.created_by_id] }).catch(() => {});
        }
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: 'Operacao invalida' });
    }

    // ---------- CONFIG (categorias e status dos chamados) ----------
    if (action === 'config') {
      const DEF_CATS = ['Duvida', 'Problema tecnico', 'Financeiro', 'Bug', 'Sugestao', 'Outro'];
      const DEF_STATUS = [
        { key: 'open', label: 'Novo', color: 'amber' },
        { key: 'pending', label: 'Pendente', color: 'blue' },
        { key: 'answered', label: 'Aguardando resposta', color: 'violet' },
        { key: 'resolved', label: 'Resolvido', color: 'emerald', final: true },
        { key: 'closed', label: 'Finalizado', color: 'slate', final: true },
      ];
      if (op === 'get') {
        let cats = null, sts = null;
        try { cats = JSON.parse((await getSetting('ticket_categories')) || 'null'); } catch {}
        try { sts = JSON.parse((await getSetting('ticket_statuses')) || 'null'); } catch {}
        return sendJson(res, 200, { categories: Array.isArray(cats) && cats.length ? cats : DEF_CATS, statuses: Array.isArray(sts) && sts.length ? sts : DEF_STATUS });
      }
      if (op === 'save') {
        if (!isAdmin) return sendJson(res, 403, { error: 'Apenas administradores' });
        if (Array.isArray(body.categories)) await setSetting('ticket_categories', JSON.stringify(body.categories));
        if (Array.isArray(body.statuses)) await setSetting('ticket_statuses', JSON.stringify(body.statuses));
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: 'Operacao invalida' });
    }

    return sendJson(res, 404, { error: 'Rota não encontrada' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
