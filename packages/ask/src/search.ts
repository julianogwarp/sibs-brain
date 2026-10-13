import { finalLabels } from "@sibs/core";
import { allEmbeddings, classificationsFor, getThreads, publicPages } from "@sibs/db";
import { embed } from "./embed";

export interface Source {
  n: number; // número usado na citação [n]
  threadId: string;
  text: string;
  date: string; // ISO
  tweetUrl: string;
  topic: { slug: string; title: string } | null;
  score: number;
}

const CACHE_MS = 5 * 60_000;
let cache: { at: number; ids: string[]; vectors: Float32Array[] } | null = null;

export function invalidateSearchCache() {
  cache = null;
}

/** Vetores ficam em memória; com alguns milhares de threads a comparação leva milissegundos. */
async function loadVectors() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const docs = await allEmbeddings();
  cache = { at: Date.now(), ids: docs.map((d) => d._id), vectors: docs.map((d) => Float32Array.from(d.vector)) };
  return cache;
}

function dot(a: Float32Array, b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** As `k` threads mais parecidas com a pergunta (vetores normalizados: produto escalar = cosseno). */
export async function search(question: string, username: string, k = 8): Promise<Source[]> {
  const [{ ids, vectors }, [query]] = await Promise.all([loadVectors(), embed([question])]);
  if (ids.length === 0 || !query) return [];

  const top = ids
    .map((id, i) => ({ id, score: dot(vectors[i]!, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const topIds = top.map((t) => t.id);
  const [threads, classifications, pages] = await Promise.all([getThreads(topIds), classificationsFor(topIds), publicPages()]);
  const threadById = new Map(threads.map((t) => [t._id, t]));
  const topicById = new Map(classifications.map((cl) => [cl._id, finalLabels(cl).topic]));
  const pageTitle = new Map(pages.map((p) => [p._id, p.title]));

  return top.flatMap(({ id, score }, i) => {
    const thread = threadById.get(id);
    if (!thread) return [];
    const slug = topicById.get(id);
    return [
      {
        n: i + 1,
        threadId: id,
        text: thread.text,
        date: thread.startedAt.toISOString(),
        tweetUrl: `https://x.com/${username}/status/${thread.tweetIds[0]}`,
        topic: slug && pageTitle.has(slug) ? { slug, title: pageTitle.get(slug)! } : null,
        score,
      },
    ];
  });
}
