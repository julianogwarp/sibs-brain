import type { Embedding } from "@sibs/core";
import { collections } from "../client";

export async function allEmbeddings(): Promise<Embedding[]> {
  const { embeddings } = await collections();
  return embeddings.find().toArray();
}

/** Modelo e hash do texto de cada vetor, sem o vetor (para saber o que refazer). */
export async function embeddingStates(): Promise<Omit<Embedding, "vector">[]> {
  const { embeddings } = await collections();
  return embeddings.find({}, { projection: { vector: 0 } }).toArray();
}

/** Apaga os vetores de threads que não estão na lista. */
export async function pruneEmbeddings(keepIds: string[]): Promise<void> {
  const { embeddings } = await collections();
  await embeddings.deleteMany({ _id: { $nin: keepIds } });
}

export async function saveEmbeddings(items: Embedding[]): Promise<void> {
  if (items.length === 0) return;
  const { embeddings } = await collections();
  await embeddings.bulkWrite(items.map(({ _id, ...rest }) => ({ replaceOne: { filter: { _id }, replacement: rest, upsert: true } })));
}
