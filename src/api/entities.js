import { api } from './client.js';

// Entidades que podem disparar robos em tempo real (avisa a UI para atualizar as notificacoes)
const WATCHED = new Set(['Transaction', 'Account', 'Debt', 'Investment', 'CreditCardTransaction', 'CreditCardInvoice', 'Goal', 'Subscription']);
const ping = (name) => { if (WATCHED.has(name) && typeof window !== 'undefined') { try { window.dispatchEvent(new CustomEvent('monvy:data-changed', { detail: name })); } catch { /* */ } } };

// Fabrica um "repositorio" CRUD para uma entidade (bate em /api/entities/:name)
function makeEntity(name) {
  const base = `/api/entities/${name}`;
  return {
    list: (filters = {}) => {
      const qs = new URLSearchParams(filters).toString();
      return api.get(qs ? `${base}?${qs}` : base);
    },
    get: (id) => api.get(`${base}?id=${encodeURIComponent(id)}`),
    create: (data) => api.post(base, data).then((r) => { ping(name); return r; }),
    bulkCreate: (items) => api.post(base, { _bulk: items }).then((r) => { ping(name); return r; }),
    update: (id, data) => api.put(`${base}?id=${encodeURIComponent(id)}`, data).then((r) => { ping(name); return r; }),
    remove: (id) => api.del(`${base}?id=${encodeURIComponent(id)}`).then((r) => { ping(name); return r; }),
  };
}

export const Account = makeEntity('Account');
export const Category = makeEntity('Category');
export const Transaction = makeEntity('Transaction');
export const CreditCard = makeEntity('CreditCard');
export const CreditCardTransaction = makeEntity('CreditCardTransaction');
export const CreditCardInvoice = makeEntity('CreditCardInvoice');
export const Goal = makeEntity('Goal');
export const Subscription = makeEntity('Subscription');
export const Anomaly = makeEntity('Anomaly');
export const Forecast = makeEntity('Forecast');
export const AppSettings = makeEntity('AppSettings');
export const Safe = makeEntity('Safe');
export const Trigger = makeEntity('Trigger');
export const Investment = makeEntity('Investment');
export const Debt = makeEntity('Debt');
export const CategoryRule = makeEntity('CategoryRule');
export const Notification = makeEntity('Notification');
export const BankRate = makeEntity('BankRate');

export const Auth = {
  login: (email, password, code) => api.post('/api/auth/login', { email, password, code }),
  register: (data) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  changePassword: (current, next) => api.put('/api/auth/change-password', { current, next }),
  verify: (token) => api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`),
  resend: (email) => api.post('/api/auth/resend', { email }),
  forgot: (email) => api.post('/api/auth/forgot', { email }),
  reset: (token, password) => api.post('/api/auth/reset', { token, password }),
  setup2fa: () => api.post('/api/auth/2fa', { op: 'setup' }),
  enable2fa: (code) => api.post('/api/auth/2fa', { op: 'enable', code }),
  disable2fa: (data) => api.post('/api/auth/2fa', { op: 'disable', ...data }),
};

export const Support = {
  articles: () => api.post('/api/support/articles', { op: 'list' }),
  saveArticle: (data) => api.post('/api/support/articles', { op: 'save', ...data }),
  deleteArticle: (id) => api.post('/api/support/articles', { op: 'delete', id }),
  tickets: () => api.post('/api/support/tickets', { op: 'list' }),
  ticket: (id) => api.post('/api/support/tickets', { op: 'get', id }),
  createTicket: (data) => api.post('/api/support/tickets', { op: 'create', ...data }),
  replyTicket: (data) => api.post('/api/support/tickets', { op: 'reply', ...data }),
  setTicketStatus: (id, data) => api.post('/api/support/tickets', { op: 'status', id, ...data }),
  deleteTicket: (id) => api.post('/api/support/tickets', { op: 'delete', id }),
  updateTicket: (id, data) => api.post('/api/support/tickets', { op: 'meta', id, ...data }),
  config: () => api.post('/api/support/config', { op: 'get' }),
  saveConfig: (data) => api.post('/api/support/config', { op: 'save', ...data }),
};

export const Bootstrap = { load: () => api.get('/api/bootstrap') };
export const Summary = { get: (month) => api.get(`/api/summary?month=${month}`) };
export const Cards = {
  generateInvoices: () => api.post('/api/cards/invoices', { action: 'generate' }),
  payInvoice: (payload) => api.post('/api/cards/invoices', { action: 'pay', ...payload }),
};
export const Reports = { email: (payload) => api.post('/api/reports/email', payload) };

export const Ai = {
  parseInvoice: (pdfBase64, apiKey, categories) =>
    api.post('/api/ai/parse-invoice', { pdfBase64, apiKey, categories }),
  ask: (question, context, apiKey, history, persona) => api.post('/api/ai/assistant', { question, context, apiKey, history, persona }),
};

export const Admin = {
  listUsers: () => api.get('/api/admin/users'),
  updateUser: (id, data) => api.put(`/api/admin/users?id=${encodeURIComponent(id)}`, data),
  removeUser: (id) => api.del(`/api/admin/users?id=${encodeURIComponent(id)}`),
  getMail: () => api.get('/api/admin/mail'),
  saveMail: (data) => api.put('/api/admin/mail', data),
  testMail: (to) => api.post('/api/admin/mail', { to }),
  getDefaultScreens: () => api.get('/api/admin/defaults'),
  saveDefaultScreens: (screens) => api.post('/api/admin/defaults', { screens }),
};
