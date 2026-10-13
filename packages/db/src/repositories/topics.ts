import { finalLabels, isRemovedTopic, type Topic } from "@sibs/core";
import { collections } from "../client";

/** Cria o tema se não existe. Temas antigos que tinham o slug como nome ganham o nome certo (também na página). */
export async function ensureTopic(slug: string, { name, description }: { name: string; description: string }): Promise<void> {
  const c = await collections();
  await c.topics.updateOne(
    { _id: slug },
    { $setOnInsert: { name, description, threadIds: [], updatedAt: new Date() } },
    { upsert: true },
  );
  await c.topics.updateOne({ _id: slug, name: slug }, { $set: { name } });
  await c.pages.updateOne({ _id: slug, title: slug }, { $set: { title: name } });
}

export async function getTopic(slug: string): Promise<Topic | null> {
  const { topics } = await collections();
  return topics.findOne({ _id: slug });
}

/** Temas em uso, sem os removidos (as opções do jev, da LLM e do /admin). */
export async function activeTopics(): Promise<Topic[]> {
  const { topics } = await collections();
  return (await topics.find().sort({ _id: 1 }).toArray()).filter((t) => !isRemovedTopic(t._id, t.name));
}

/** Liga a thread ao tema (parte de publicar; use publishClassification ou publishManually). */
export async function addThreadToTopic(slug: string, threadId: string, now = new Date()): Promise<void> {
  const { topics } = await collections();
  await topics.updateOne({ _id: slug }, { $addToSet: { threadIds: threadId }, $set: { updatedAt: now } });
}

export interface PurgeResult {
  topics: string[];
  pages: number;
  revisions: number;
  suggestions: number;
  classifications: number;
}

/**
 * Apaga os temas removidos (pelo slug ou pelo nome) com página, revisões e sugestões, e apaga as
 * classificações que apontam para eles: sem classificação, a thread volta para a fila do worker.
 * As rejeitadas ficam, senão voltariam para a fila a cada execução.
 */
export async function purgeRemovedTopics(): Promise<PurgeResult> {
  const c = await collections();
  const [topicDocs, pageDocs] = await Promise.all([
    c.topics.find({}, { projection: { name: 1 } }).toArray(),
    c.pages.find({}, { projection: { title: 1 } }).toArray(),
  ]);
  const removed = [
    ...new Set([
      ...topicDocs.filter((t) => isRemovedTopic(t._id, t.name)).map((t) => t._id),
      ...pageDocs.filter((p) => isRemovedTopic(p._id, p.title)).map((p) => p._id),
    ]),
  ];
  const isRemoved = (slug: string) => removed.includes(slug) || isRemovedTopic(slug);

  const ids = (await c.classifications.find({ status: { $ne: "rejected" } }).toArray())
    .filter((cl) => isRemoved(finalLabels(cl).topic) || isRemoved(cl.jev.topic))
    .map((cl) => cl._id);

  const [pages, , revisions, suggestions, classifications] = await Promise.all([
    c.pages.deleteMany({ _id: { $in: removed } }),
    c.topics.deleteMany({ _id: { $in: removed } }),
    c.revisions.deleteMany({ pageId: { $in: removed } }),
    c.suggestions.deleteMany({ pageId: { $in: removed } }),
    ids.length ? c.classifications.deleteMany({ _id: { $in: ids } }) : Promise.resolve({ deletedCount: 0 }),
  ]);
  return {
    topics: removed,
    pages: pages.deletedCount,
    revisions: revisions.deletedCount,
    suggestions: suggestions.deletedCount,
    classifications: classifications.deletedCount,
  };
}
