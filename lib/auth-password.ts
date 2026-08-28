/**
 * Hash de senha com scrypt do próprio Node.
 *
 * Evita uma dependência (bcrypt/argon2) para algo que a biblioteca padrão já
 * resolve bem. Formato armazenado: `scrypt$<salt hex>$<derivada hex>`.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  // Comparação em tempo constante: evita vazar informação pelo tempo de resposta.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
