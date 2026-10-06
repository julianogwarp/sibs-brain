import { embedPublishedThreads } from "@sibs/ask";
import { collections, ensureIndexes } from "@sibs/db";
import { ingest } from "./ingest";
import { classifySubtopics } from "./subtopics";
import { removeTopics } from "./remove-topics";
import { classifyPending } from "./classify";
import { rebuildThreads, rebuildTopicPage } from "@sibs/wiki-engine";

export interface PipelineOptions {
  /** Prazo (ms epoch) para parar de classificar; as páginas são montadas mesmo assim. */
  deadline?: number;
}

/** Coleta → classificação → subcategorias → páginas → vetores. Usado pelo CLI e pelo Cron da Vercel. */
export async function runPipeline({ deadline = Infinity }: PipelineOptions = {}): Promise<void> {
  const username = process.env.X_USERNAME;
  if (!username) throw new Error("X_USERNAME não definido");

  await ensureIndexes();

  const ingestion = await ingest(username);
  console.log(`[coleta] ${ingestion.fetched} tweets novos (${ingestion.stoppedReason})`);
  const range = await tweetRange();
  if (range) console.log(`[coleta] no banco: ${range.count} tweets, de ${range.oldest} até ${range.newest}`);

  await rebuildThreads(ingestion.conversationIds);
  await removeTopics();

  const touchedTopics = await classifyPending(deadline);
  console.log(`[classificação] temas alterados: ${[...touchedTopics].join(", ") || "nenhum"}`);

  try {
    await classifySubtopics(deadline);
  } catch (err) {
    console.warn(`[subcategorias] interrompido: ${err instanceof Error ? err.message : err}`);
  }

  for (const topicId of touchedTopics) {
    const result = await rebuildTopicPage(topicId, username);
    console.log(`[wiki] ${topicId}: ${result}`);
  }

  // Vetores para a busca por pergunta; uma falha aqui não invalida o resto da execução
  try {
    const embedded = await embedPublishedThreads();
    console.log(`[busca] ${embedded} threads com vetor novo`);
  } catch (err) {
    console.warn(`[busca] não foi possível gerar os vetores: ${err instanceof Error ? err.message : err}`);
  }
}

async function tweetRange() {
  const { tweets } = await collections();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const [oldest, newest, count] = await Promise.all([
    tweets.find().sort({ createdAt: 1 }).limit(1).next(),
    tweets.find().sort({ createdAt: -1 }).limit(1).next(),
    tweets.countDocuments(),
  ]);
  return oldest && newest ? { count, oldest: day(oldest.createdAt), newest: day(newest.createdAt) } : null;
}
