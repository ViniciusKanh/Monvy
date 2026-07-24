import { api } from './client.js';

// Fabrica um "repositorio" CRUD para uma entidade (bate em /api/entities/:name)
function makeEntity(name) {
  const base = `/api/entities/${name}`;
  return {
    list: (filters = {}) => {
      const qs = new URLSearchParams(filters).toString();
      return api.get(qs ? `${base}?${qs}` : base);
    },
    get: (id) => api.get(`${base}?id=${encodeURIComponent(id)}`),
    create: (data) => api.post(base, data),
    bulkCreate: (items) => api.post(base, { _bulk: items }),
    update: (id, data) => api.put(`${base}?id=${encodeURIComponent(id)}`, data),
    remove: (id) => api.del(`${base}?id=${encodeURIComponent(id)}`),
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

export const Auth = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  changePassword: (current, next) => api.put('/api/auth/change-password', { current, next }),
  verify: (token) => api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`),
  resend: (email) => api.post('/api/auth/resend', { email }),
  forgot: (email) => api.post('/api/auth/forgot', { email }),
  reset: (token, password) => api.post('/api/auth/reset', { token, password }),
};

export const Bootstrap = { load: () => api.get('/api/bootstrap') };
export const Summary = { get: (month) => api.get(`/api/summary?month=${month}`) };
export const Cards = {
  generateInvoices: () => api.post('/api/cards/invoices', { action: 'generate' }),
  payInvoice: (invoiceId, accountId) => api.post('/api/cards/invoices', { action: 'pay', invoiceId, accountId }),
};
export const Reports = { email: (payload) => api.post('/api/reports/email', payload) };

export const Ai = {
  parseInvoice: (pdfBase64, apiKey, categories) =>
    api.post('/api/ai/parse-invoice', { pdfBase64, apiKey, categories }),
  ask: (question, context, apiKey, history) => api.post('/api/ai/assistant', { question, context, apiKey, history }),
};

export const Admin = {
  listUsers: () => api.get('/api/admin/users'),
  updateUser: (id, data) => api.put(`/api/admin/users?id=${encodeURIComponent(id)}`, data),
  removeUser: (id) => api.del(`/api/admin/users?id=${encodeURIComponent(id)}`),
  getMail: () => api.get('/api/admin/mail'),
  saveMail: (data) => api.put('/api/admin/mail', data),
  testMail: (to) => api.post('/api/admin/mail', { to }),
};
