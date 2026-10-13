import { env } from "@sibs/core";
import { hitCounter } from "@sibs/db";

export type QuestionLimit = "ok" | "visitor" | "global";

const HOUR_MS = 3600_000;
const countThisHour = (key: string) => hitCounter(`question:${key}`, HOUR_MS);

/**
 * Limites da hora atual: por visitante e, para o site todo, um teto que impede que muitos IPs
 * diferentes (proxies, bots) gastem o orçamento do mês de uma vez. Pergunta barrada pelo limite
 * do visitante não conta no teto do site.
 */
export async function allowQuestion(visitorKey: string): Promise<QuestionLimit> {
  if ((await countThisHour(visitorKey)) > env().CHAT_MAX_PER_HOUR) return "visitor";
  if ((await countThisHour("global")) > env().CHAT_MAX_GLOBAL_PER_HOUR) return "global";
  return "ok";
}
