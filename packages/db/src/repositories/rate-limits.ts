import { collections } from "../client";

/**
 * Soma 1 no contador de `key` na janela atual (janelas fixas de `windowMs`) e devolve o total.
 * Os contadores expiram sozinhos (índice TTL em expiresAt).
 */
export async function hitCounter(key: string, windowMs: number): Promise<number> {
  const { rateLimits } = await collections();
  const bucket = Math.floor(Date.now() / windowMs);
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${key}:${bucket}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } },
    { upsert: true, returnDocument: "after" },
  );
  return doc?.count ?? 1;
}
