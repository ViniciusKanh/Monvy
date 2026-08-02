import { db, ensureSchema, newId, nowIso } from '../_lib/db.js';
import { getAuth, sendJson, readBody } from '../_lib/auth.js';
import { getSetting, setSetting } from '../_lib/settings.js';

const DEFAULT_ARTICLES = [
  { category: 'Primeiros passos', title: 'Como comecar no Monvy', body: 'Cadastre suas contas em Contas, depois registre receitas e despesas em Lancamentos. No Dashboard voce acompanha o resumo do mes, o fluxo de caixa e os gastos por categoria. Dica: defina um orcamento por categoria para receber alertas quando gastar demais.' },
  { category: 'Cartao de credito', title: 'Como importar a fatura do cartao', body: 'Abra Cartoes, selecione o cartao e o mes, e clique em Importar fatura. Envie o PDF da fatura: o Monvy le, separa e categoriza cada compra automaticamente, considerando estornos e creditos. Se algo nao bater, compare o total com o do PDF e use Excluir fatura para reimportar.' },
  { category: 'Cartao de credito', title: 'Como pagar uma fatura', body: 'Na tela do cartao, no mes desejado, clique em Pagar fatura. Escolha a conta de debito e o tipo de pagamento (valor total ou parcial). O pagamento vira um lancamento na conta escolhida. Voce pode pagar faturas de meses anteriores tambem.' },
  { category: 'Ferramentas', title: 'Como funciona o Simulador', body: 'O Simulador aprende com o seu historico (receitas e despesas, incluindo o cartao) e projeta cenarios: cortar gastos, aumentar receita, nova despesa parcelada, poupar meta e investimento. Os valores sao ESTIMATIVAS estatisticas com base no passado, nao uma garantia do futuro.' },
  { category: 'Planejamento', title: 'Metas e Cofres', body: 'Cada meta tem um cofre virtual. Crie uma meta com um valor-alvo e guarde dinheiro aos poucos; o progresso aparece na meta e no cofre, que estao sincronizados.' },
  { category: 'Seguranca', title: 'Ativar verificacao em duas etapas (2FA)', body: 'Em Configuracoes, na secao Verificacao em duas etapas, clique em Ativar, escaneie o QR code no seu app autenticador (Google Authenticator, Authy ou Microsoft Authenticator) e confirme com o codigo de 6 digitos. No proximo login o codigo sera pedido.' },
  { category: 'Suporte', title: 'Como abrir um chamado', body: 'Nesta pagina de Ajuda, clique em Abrir chamado, descreva o problema e anexe uma imagem se quiser. Voce acompanha a resposta em Meus chamados. Se a solucao nao resolver, e possivel reabrir o chamado.' },
];

async function seedArticles(ownerId) {
  if ((await getSetting('help_seeded')) === '1') return;
  for (const a of DEFAULT_ARTICLES) {
    await db().execute({ sql: `INSERT INTO HelpArticle (id,title,body,category,published,created_by_id,created_date,updated_date) VALUES (?,?,?,?,1,?,?,?)`, args: [newId(), a.title, a.body, a.category, ownerId, nowIso(), nowIso()] });
  }
  await setSetting('help_seeded', '1');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido' });
  try {
    await ensureSchema();
    const auth = getAuth(req);
    if (!auth) return sendJson(res, 401, { error: 'Nao autenticado' });
    const u = (await db().execute({ sql: 'SELECT id, role, email, full_name FROM users WHERE id = ?', args: [auth.sub] })).rows[0];
    if (!u) return sendJson(res, 401, { error: 'Usuario nao encontrado' });
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
      if (op === 'create') {
        const { subject, description, image_url } = body;
        if (!subject || !description) return sendJson(res, 400, { error: 'Assunto e descricao sao obrigatorios' });
        const id = newId();
        await db().execute({ sql: `INSERT INTO SupportTicket (id,subject,status,user_name,user_email,image_url,created_by_id,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?)`, args: [id, subject, 'open', u.full_name || '', u.email, image_url || null, u.id, nowIso(), nowIso()] });
        await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,image_url,created_date) VALUES (?,?,?,?,?,?,?,?)`, args: [newId(), id, u.id, 'user', u.full_name || u.email, description, image_url || null, nowIso()] });
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
        if (!t) return sendJson(res, 404, { error: 'Chamado nao encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        const messages = (await db().execute({ sql: `SELECT * FROM TicketMessage WHERE ticket_id=? ORDER BY created_date ASC`, args: [body.id] })).rows;
        return sendJson(res, 200, { ticket: t, messages, isAdmin });
      }
      if (op === 'reply') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado nao encontrado' });
        if (!isAdmin && t.created_by_id !== u.id) return sendJson(res, 403, { error: 'Sem acesso' });
        if (!body.body) return sendJson(res, 400, { error: 'Mensagem vazia' });
        await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,image_url,created_date) VALUES (?,?,?,?,?,?,?,?)`, args: [newId(), body.id, u.id, isAdmin ? 'admin' : 'user', u.full_name || u.email, body.body, body.image_url || null, nowIso()] });
        const newStatus = isAdmin ? 'answered' : 'open';
        await db().execute({ sql: `UPDATE SupportTicket SET status=?, updated_date=? WHERE id=?`, args: [newStatus, nowIso(), body.id] });
        return sendJson(res, 200, { ok: true });
      }
      if (op === 'status') {
        const t = (await db().execute({ sql: `SELECT * FROM SupportTicket WHERE id=?`, args: [body.id] })).rows[0];
        if (!t) return sendJson(res, 404, { error: 'Chamado nao encontrado' });
        const s = body.status;
        const adminStatuses = ['answered', 'resolved', 'closed', 'open'];
        const userStatuses = ['reopened', 'closed']; // reabrir ou confirmar solucao
        if (isAdmin ? !adminStatuses.includes(s) : (t.created_by_id !== u.id || !userStatuses.includes(s))) return sendJson(res, 403, { error: 'Operacao nao permitida' });
        await db().execute({ sql: `UPDATE SupportTicket SET status=?, updated_date=? WHERE id=?`, args: [s, nowIso(), body.id] });
        // registra evento na thread
        const msg = s === 'resolved' ? 'Chamado marcado como resolvido.' : s === 'reopened' ? 'Chamado reaberto pelo usuario.' : s === 'closed' ? 'Chamado encerrado.' : null;
        if (msg) await db().execute({ sql: `INSERT INTO TicketMessage (id,ticket_id,author_id,author_role,author_name,body,created_date) VALUES (?,?,?,?,?,?,?)`, args: [newId(), body.id, u.id, isAdmin ? 'admin' : 'user', u.full_name || u.email, msg, nowIso()] });
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: 'Operacao invalida' });
    }

    return sendJson(res, 404, { error: 'Rota nao encontrada' });
  } catch (e) { return sendJson(res, 500, { error: e.message }); }
}
