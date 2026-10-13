import { finalLabels, isRemovedTopic, type Classification } from "@sibs/core";
import { collections } from "../client";
import { addThreadToTopic } from "./topics";

type NewClassification = Pick<Classification, "jev" | "validation" | "status">;

/**
 * Grava o resultado da classificação de uma thread. Publicada, ela entra no tema final
 * (o da LLM, se ela decidiu; senão o do jev). Devolve esse tema.
 */
export async function recordClassification(threadId: string, result: NewClassification): Promise<string> {
  const { classifications } = await collections();
  const now = new Date();
  const doc: Classification = { _id: threadId, ...result, createdAt: now, updatedAt: now };
  await classifications.replaceOne({ _id: threadId }, doc, { upsert: true });
  const { topic } = finalLabels(doc);
  if (result.status === "published") await addThreadToTopic(topic, threadId, now);
  return topic;
}

/** Decisão do /admin: publica a thread no tema escolhido. False se a thread não existe ou o tema foi removido. */
export async function publishManually(threadId: string, topic: string): Promise<boolean> {
  if (isRemovedTopic(topic)) return false;
  const { classifications } = await collections();
  const cls = await classifications.findOne({ _id: threadId });
  if (!cls) return false;
  const now = new Date();
  await classifications.updateOne(
    { _id: threadId },
    {
      $set: {
        status: "published",
        validation: { verdict: "corrected", topic, kind: cls.validation?.kind ?? cls.jev.kind, relevant: true, reasoning: "Revisão manual", model: "manual" },
        updatedAt: now,
      },
    },
  );
  await addThreadToTopic(topic, threadId, now);
  return true;
}

export async function rejectThread(threadId: string): Promise<void> {
  const { classifications } = await collections();
  await classifications.updateOne({ _id: threadId }, { $set: { status: "rejected", updatedAt: new Date() } });
}

export async function setSubtopic(threadId: string, subtopic: NonNullable<Classification["subtopic"]>): Promise<void> {
  const { classifications } = await collections();
  await classifications.updateOne({ _id: threadId }, { $set: { subtopic } });
}

export async function publishedClassifications(): Promise<Classification[]> {
  const { classifications } = await collections();
  return classifications.find({ status: "published" }).toArray();
}

/** Ids das threads publicadas e relevantes (as que entram na wiki e na busca). */
export async function publishedThreadIds(topic?: string): Promise<string[]> {
  return (await publishedClassifications())
    .filter((cl) => {
      const labels = finalLabels(cl);
      return labels.relevant && (topic === undefined || labels.topic === topic);
    })
    .map((cl) => cl._id);
}

export async function classificationsFor(threadIds: string[]): Promise<Classification[]> {
  const { classifications } = await collections();
  return classifications.find({ _id: { $in: threadIds } }).toArray();
}

/** Fila do /admin: as mais antigas primeiro. */
export async function reviewQueue(limit = 50): Promise<Classification[]> {
  const { classifications } = await collections();
  return classifications.find({ status: "needs_review" }).sort({ updatedAt: 1 }).limit(limit).toArray();
}
