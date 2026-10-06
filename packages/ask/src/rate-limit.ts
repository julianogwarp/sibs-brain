import { collections } from "@sibs/db";
import { config } from "./config";

/** Conta as perguntas do visitante na hora atual. Retorna false se passou do limite. */
export async function allowQuestion(visitorKey: string): Promise<boolean> {
  const { rateLimits } = await collections();
  const hour = new Date().toISOString().slice(0, 13); // AAAA-MM-DDTHH
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${visitorKey}:${hour}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * 3600_000) } },
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 1) <= config.chatMaxPerHour();
}
