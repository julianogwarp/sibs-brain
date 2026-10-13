import { createHash } from "node:crypto";
import OpenAI from "openai";
import { env } from "@sibs/core";
import { adjustSpend, embeddingStates, getThreads, publishedThreadIds, pruneEmbeddings, reserveBudget, saveEmbeddings } from "@sibs/db";
import { estimateTokens } from "./config";
import { invalidateSearchCache } from "./search";

const BATCH = 100;
let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI());

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** Gera embeddings (normalizados pela OpenAI) com o custo dentro do limite do mês. */
export async function embed(texts: string[]): Promise<number[][]> {
  const usdToBrl = (tokens: number) => (tokens / 1_000_000) * env().EMBEDDING_USD_PER_MTOK * env().USD_BRL;
  const reserved = usdToBrl(texts.reduce((sum, t) => sum + estimateTokens(t), 0));
  await reserveBudget("embed", reserved, env().EMBED_MONTHLY_BUDGET_BRL);

  let res;
  try {
    res = await openai().embeddings.create({ model: env().EMBEDDING_MODEL, input: texts, encoding_format: "float" });
  } catch (err) {
    await adjustSpend("embed", -reserved);
    throw err;
  }
  await adjustSpend("embed", usdToBrl(res.usage.total_tokens) - reserved);
  return [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Mantém um vetor por thread publicada: cria os que faltam, refaz os que mudaram
 * e apaga os de threads que deixaram de ser publicadas. Retorna quantos foram gerados.
 */
export async function embedPublishedThreads(): Promise<number> {
  const model = env().EMBEDDING_MODEL;

  const published = await publishedThreadIds();
  await pruneEmbeddings(published);

  const [threads, existing] = await Promise.all([getThreads(published), embeddingStates()]);
  const current = new Map(existing.map((e) => [e._id, e]));
  const todo = threads.filter((t) => {
    const e = current.get(t._id);
    return !e || e.model !== model || e.textHash !== hash(t.text);
  });

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const vectors = await embed(batch.map((t) => t.text));
    const now = new Date();
    await saveEmbeddings(batch.map((t, j) => ({ _id: t._id, model, textHash: hash(t.text), vector: vectors[j]!, updatedAt: now })));
  }
  invalidateSearchCache();
  return todo.length;
}
