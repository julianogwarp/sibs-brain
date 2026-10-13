import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@sibs/core";
import { hitCounter } from "@sibs/db";

/** Identifica o visitante sem guardar o IP: hash com o segredo do site. */
export async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  return createHmac("sha256", env().SESSION_SECRET ?? "sibs-brain").update(ip).digest("hex").slice(0, 32);
}

/** Conta uma ação do visitante na janela atual; false quando passou do limite. */
export async function allowAction(action: string, limit: number, windowMinutes: number): Promise<boolean> {
  return (await hitCounter(`${action}:${await visitorKey()}`, windowMinutes * 60_000)) <= limit;
}
