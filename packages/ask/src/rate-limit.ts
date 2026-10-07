import { collections } from "@sibs/db";
import { config } from "./config";

export type QuestionLimit = "ok" | "visitor" | "global";

/** Soma 1 no contador da hora atual e devolve o total. */
async function countThisHour(key: string): Promise<number> {
  const { rateLimits } = await collections();
  const hour = new Date().toISOString().slice(0, 13); // AAAA-MM-DDTHH
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${key}:${hour}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * 3600_000) } },
    { upsert: true, returnDocument: "after" },
  );
  return doc?.count ?? 1;
}

/**
 * Limites da hora atual: por visitante e, para o site todo, um teto que impede que muitos IPs
 * diferentes (proxies, bots) gastem o orçamento do mês de uma vez. Pergunta barrada pelo limite
 * do visitante não conta no teto do site.
 */
export async function allowQuestion(visitorKey: string): Promise<QuestionLimit> {
  if ((await countThisHour(visitorKey)) > config.chatMaxPerHour()) return "visitor";
  if ((await countThisHour("global")) > config.chatMaxGlobalPerHour()) return "global";
  return "ok";
}
