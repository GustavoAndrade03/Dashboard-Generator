/**
 * Cria um usuário. Não há cadastro público — este script é o caminho oficial.
 *
 *   npm run user:create -- alguem@exemplo.com "senha-forte" "Nome Opcional"
 *
 * Fala direto com o Postgres via `pg` em vez de usar o Prisma Client: o script
 * roda pelo type stripping nativo do Node, sem passo de build.
 */

import { Client } from "pg";

import { hashPassword } from "../lib/auth-password.ts";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: npm run user:create -- <email> <senha> ["Nome"]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida. Rode com um .env preenchido.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(
    `INSERT INTO users (id, email, name, "passwordHash", "createdAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
    [crypto.randomUUID(), email, name ?? null, hashPassword(password)],
  );
  console.log(`Usuário ${email} pronto.`);
} finally {
  await client.end();
}
