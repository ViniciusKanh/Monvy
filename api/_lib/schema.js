// Definicao central do schema Monvy (SQLite/LibSQL - Turso).
// Usado pela API (ensureSchema) e pelo script scripts/initDb.mjs.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    profession TEXT,
    phone TEXT,
    photo_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    allowed_screens TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_date TEXT,
    updated_date TEXT,
    created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Account (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'checking',
    initial_balance REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    color TEXT DEFAULT '#18A558',
    icon TEXT DEFAULT 'wallet',
    is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Category (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    color TEXT DEFAULT '#18A558',
    icon TEXT DEFAULT 'tag',
    budget_limit REAL,
    ir_deductible TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "Transaction" (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'expense',
    account_id TEXT,
    account_to_id TEXT,
    category_id TEXT,
    description TEXT,
    is_fixed INTEGER DEFAULT 0,
    recurrence TEXT DEFAULT 'none',
    status TEXT DEFAULT 'pending',
    installments_total INTEGER,
    installment_current INTEGER,
    parent_transaction_id TEXT,
    obligation_id TEXT,
    tags TEXT DEFAULT '[]',
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS CreditCard (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_digits TEXT,
    brand TEXT DEFAULT 'visa',
    closing_day INTEGER NOT NULL DEFAULT 1,
    due_day INTEGER NOT NULL DEFAULT 10,
    credit_limit REAL,
    account_id TEXT,
    color TEXT DEFAULT '#1a1a2e',
    is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS CreditCardTransaction (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL DEFAULT 0,
    category_id TEXT,
    installments_total INTEGER DEFAULT 1,
    installment_current INTEGER DEFAULT 1,
    competence_month TEXT,
    is_recurring INTEGER DEFAULT 0,
    imported_from_pdf INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS CreditCardInvoice (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    competence_month TEXT NOT NULL,
    total_amount REAL,
    due_date TEXT,
    closing_date TEXT,
    status TEXT DEFAULT 'open',
    paid_date TEXT,
    paid_amount REAL,
    payment_transaction_id TEXT,
    pdf_url TEXT,
    ai_analysis TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Goal (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    current_amount REAL DEFAULT 0,
    monthly_target REAL,
    start_date TEXT,
    target_date TEXT,
    status TEXT DEFAULT 'active',
    category TEXT,
    color TEXT DEFAULT '#18A558',
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Subscription (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    renewal_day INTEGER NOT NULL DEFAULT 1,
    category TEXT,
    color TEXT DEFAULT '#8b5cf6',
    icon_emoji TEXT DEFAULT '📱',
    is_active INTEGER DEFAULT 1,
    usage_frequency TEXT DEFAULT 'monthly',
    notes TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Anomaly (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    detected_date TEXT,
    amount REAL,
    category_id TEXT,
    account_id TEXT,
    anomaly_score REAL NOT NULL DEFAULT 0,
    reason TEXT,
    z_score REAL,
    category_average REAL,
    is_acknowledged INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Forecast (
    id TEXT PRIMARY KEY,
    forecast_date TEXT NOT NULL,
    predicted_balance REAL NOT NULL DEFAULT 0,
    lower_bound REAL,
    upper_bound REAL,
    confidence_level REAL DEFAULT 0.95,
    mode TEXT NOT NULL DEFAULT 'cash',
    generated_at TEXT,
    features_importance TEXT DEFAULT '{}',
    explanation TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS AppSettings (
    id TEXT PRIMARY KEY,
    gemini_api_key_configured INTEGER DEFAULT 0,
    gemini_api_key TEXT,
    default_view_mode TEXT DEFAULT 'cash',
    currency TEXT DEFAULT 'BRL',
    locale TEXT DEFAULT 'pt-BR',
    notifications_enabled INTEGER DEFAULT 1,
    auto_categorize INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Safe (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL DEFAULT 0,
    current_amount REAL DEFAULT 0,
    icon TEXT DEFAULT 'piggy',
    color TEXT DEFAULT '#10b981',
    notes TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Setting (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS HelpArticle (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    category TEXT DEFAULT 'Geral',
    published INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS SupportTicket (
    id TEXT PRIMARY KEY,
    number INTEGER,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    category TEXT DEFAULT 'Duvida',
    priority TEXT DEFAULT 'normal',
    user_name TEXT, user_email TEXT,
    image_url TEXT,
    resolved_date TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS TicketMessage (
    id TEXT PRIMARY KEY,
    ticket_id TEXT,
    author_id TEXT, author_role TEXT, author_name TEXT,
    body TEXT, image_url TEXT,
    created_date TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS Trigger (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT DEFAULT 'financial_summary',
    frequency TEXT DEFAULT 'daily',
    weekday INTEGER DEFAULT 1,
    config TEXT,
    enabled INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ticket_owner ON SupportTicket(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tmsg_ticket ON TicketMessage(ticket_id)`,
  `CREATE INDEX IF NOT EXISTS idx_trigger_owner ON Trigger(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_owner ON "Transaction"(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_date ON "Transaction"(date)`,
  `CREATE INDEX IF NOT EXISTS idx_cct_card ON CreditCardTransaction(card_id)`,
  `CREATE TABLE IF NOT EXISTS Investment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'renda_fixa',
    ticker TEXT,
    quantity REAL,
    invested_amount REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    institution TEXT,
    date TEXT,
    notes TEXT,
    color TEXT DEFAULT '#6366f1',
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS Debt (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'emprestimo',
    total_amount REAL DEFAULT 0,
    principal REAL DEFAULT 0,
    interest_rate REAL DEFAULT 0,
    installments INTEGER DEFAULT 1,
    paid_installments INTEGER DEFAULT 0,
    installment_amount REAL DEFAULT 0,
    start_date TEXT,
    due_day INTEGER DEFAULT 10,
    institution TEXT,
    notes TEXT,
    color TEXT DEFAULT '#f43f5e',
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS CategoryRule (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    category_id TEXT,
    tx_type TEXT DEFAULT 'expense',
    priority INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS Notification (
    id TEXT PRIMARY KEY,
    kind TEXT DEFAULT 'info',
    title TEXT,
    text TEXT,
    path TEXT,
    read INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_date TEXT, updated_date TEXT, created_by_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notif_owner ON Notification(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_catrule_owner ON CategoryRule(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_owner2 ON Investment(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_debt_owner ON Debt(created_by_id)`,
  `CREATE INDEX IF NOT EXISTS idx_acc_owner ON Account(created_by_id)`,
];

// Migracoes idempotentes (rodam com try/catch; ignoram 'duplicate column')
// Migrations versionadas (aplicadas 1x; id gravado em Setting 'migrations_applied')
export const MIGRATIONS = [
  { id: '001_appsettings_gemini', statements: [`ALTER TABLE AppSettings ADD COLUMN gemini_api_key TEXT`] },
  { id: '002_tx_status', statements: [`ALTER TABLE "Transaction" ADD COLUMN status TEXT DEFAULT 'pending'`] },
  { id: '003_users_verify', statements: [`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1`, `ALTER TABLE users ADD COLUMN verify_token TEXT`] },
  { id: '004_users_reset', statements: [`ALTER TABLE users ADD COLUMN reset_token TEXT`, `ALTER TABLE users ADD COLUMN reset_expires TEXT`] },
  { id: '007_totp', statements: [
    `ALTER TABLE users ADD COLUMN totp_secret TEXT`,
    `ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN require_2fa INTEGER DEFAULT 0`,
  ] },
  { id: '006_tx_receipt', statements: [`ALTER TABLE "Transaction" ADD COLUMN receipt_url TEXT`] },
  { id: '005_perf_indexes', statements: [
    `CREATE INDEX IF NOT EXISTS idx_tx_owner_date ON "Transaction"(created_by_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_owner_status ON "Transaction"(created_by_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_cct_owner_month ON CreditCardTransaction(created_by_id, competence_month)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_owner ON CreditCardInvoice(created_by_id, status)`,
  ] },
  { id: '008_bank_address', statements: [
    `ALTER TABLE Account ADD COLUMN bank TEXT`,
    `ALTER TABLE users ADD COLUMN cep TEXT`,
    `ALTER TABLE users ADD COLUMN address TEXT`,
  ] },
  { id: '009_ticket_meta', statements: [
    `ALTER TABLE SupportTicket ADD COLUMN category TEXT DEFAULT 'Duvida'`,
    `ALTER TABLE SupportTicket ADD COLUMN priority TEXT DEFAULT 'normal'`,
    `ALTER TABLE SupportTicket ADD COLUMN resolved_date TEXT`,
  ] },
  { id: '010_trigger_config', statements: [`ALTER TABLE Trigger ADD COLUMN config TEXT`] },
  { id: '011_tx_reconciled', statements: [`ALTER TABLE "Transaction" ADD COLUMN reconciled INTEGER DEFAULT 0`] },
  { id: '012_ticket_number', statements: [`ALTER TABLE SupportTicket ADD COLUMN number INTEGER`] },
  { id: '013_category_ir_deductible', statements: [`ALTER TABLE Category ADD COLUMN ir_deductible TEXT DEFAULT ''`] },
];
// compat
export const SAFE_ALTERS = MIGRATIONS.flatMap((m) => m.statements);

// Entidades expostas pela API generica /api/entities/:entity
export const ENTITIES = {
  Account: 'Account',
  Category: 'Category',
  Transaction: '"Transaction"',
  CreditCard: 'CreditCard',
  CreditCardTransaction: 'CreditCardTransaction',
  CreditCardInvoice: 'CreditCardInvoice',
  Goal: 'Goal',
  Subscription: 'Subscription',
  Anomaly: 'Anomaly',
  Forecast: 'Forecast',
  AppSettings: 'AppSettings',
  Safe: 'Safe',
  Trigger: 'Trigger',
  Investment: 'Investment',
  Debt: 'Debt',
  CategoryRule: 'CategoryRule',
  Notification: 'Notification',
};

// Colunas do tipo JSON (serializadas/desserializadas automaticamente)
export const JSON_FIELDS = {
  Transaction: ['tags'],
  Forecast: ['features_importance'],
  Trigger: ['config'],
};

// Colunas boolean (armazenadas como 0/1)
export const BOOL_FIELDS = {
  Account: ['is_active'],
  Category: ['is_active'],
  Transaction: ['is_fixed', 'reconciled'],
  CreditCard: ['is_active'],
  CreditCardTransaction: ['is_recurring', 'imported_from_pdf'],
  Goal: [],
  Subscription: ['is_active'],
  Anomaly: ['is_acknowledged'],
  AppSettings: ['gemini_api_key_configured', 'notifications_enabled', 'auto_categorize'],
  Trigger: ['enabled'],
  Notification: ['read'],
};
