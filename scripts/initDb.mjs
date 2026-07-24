// Inicializa o banco Turso: cria as tabelas e o usuario admin.
// Uso: npm run db:init   (le variaveis de .env sem depender do pacote dotenv)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { SCHEMA_STATEMENTS } from '../api/_lib/schema.js';

// --- carrega .env manualmente ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

const ALL_SCREENS = [
  'dashboard','accounts','cards','transactions','categories','budget','goals',
  'subscriptions','safes','calendar','intelligence','health','behavioral',
  'simulator','reconciliation','reports','settings','users',
];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error('ERRO: defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no .env');
    process.exit(1);
  }
  const c = createClient({ url, authToken });

  console.log('> Criando/verificando tabelas...');
  for (const stmt of SCHEMA_STATEMENTS) await c.execute(stmt);
  console.log('  OK - ' + SCHEMA_STATEMENTS.length + ' comandos executados.');

  const email = (process.env.ADMIN_EMAIL || 'viniciussouza742@gmail.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '12345678';
  const name = process.env.ADMIN_NAME || 'Vinicius Santos';

  const existing = await c.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const screens = JSON.stringify(ALL_SCREENS);

  if (existing.rows.length) {
    await c.execute({
      sql: `UPDATE users SET password_hash=?, role='admin', full_name=?, allowed_screens=?, is_active=1, updated_date=? WHERE email=?`,
      args: [hash, name, screens, now, email],
    });
    console.log('> Admin ja existia -> atualizado (senha redefinida). Email: ' + email);
  } else {
    await c.execute({
      sql: `INSERT INTO users (id,email,password_hash,full_name,first_name,last_name,role,allowed_screens,is_active,created_date,updated_date)
            VALUES (?,?,?,?,?,?, 'admin', ?, 1, ?, ?)`,
      args: [newId(), email, hash, name, 'Vinicius', 'Santos', screens, now, now],
    });
    console.log('> Admin criado! Email: ' + email + ' | Senha: ' + password);
  }
  console.log('\nConcluido. Inicie o app e faca login.');
  process.exit(0);
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
