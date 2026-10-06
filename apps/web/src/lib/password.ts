import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato: scrypt$<salt hex>$<hash hex>
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.trim().split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  // Hash cortado ou com caracteres inválidos vira um buffer curto/vazio: nunca aceitar
  if (expected.length !== 64 || Buffer.from(saltHex, "hex").length !== 16) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
