import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "sibs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curto demais");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

export async function createSession(): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Comparação de strings em tempo constante (para segredos). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  // Sem SESSION_SECRET ninguém é admin, mas as páginas públicas continuam funcionando
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.error("SESSION_SECRET ausente ou curto demais; login do admin desativado");
    return false;
  }
  const i = value.lastIndexOf(".");
  const payload = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1), "hex");
  const expected = Buffer.from(sign(payload), "hex");
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return false;
  return Number(payload.split(".")[1]) > Date.now() / 1000;
}

/** Use no topo de toda página e server action do /admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
