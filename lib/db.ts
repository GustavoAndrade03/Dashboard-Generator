/**
 * Cliente Prisma compartilhado.
 *
 * O Prisma 7 exige um driver adapter (o engine Rust foi removido), daí o
 * `@prisma/adapter-pg`. A instância é memorizada em `globalThis` para
 * sobreviver ao hot reload do Next em desenvolvimento — sem isso, cada
 * recompilação abriria um novo pool e estouraria o limite de conexões do
 * free tier do Neon.
 *
 * A criação é preguiçosa de propósito: o fluxo de upload -> sugestão -> PDF
 * funciona sem banco nenhum, e só a persistência exige DATABASE_URL.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Permite que as rotas degradem com elegância quando não há banco configurado. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.example para .env e aponte para um Postgres.",
    );
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  globalForPrisma.prisma = client;
  return client;
}
