import type { Thread } from "@sibs/core";
import { collections } from "../client";

/** Grava a thread; se ela mudou e ainda não estava publicada, volta para a fila de classificação. */
export async function saveThread(thread: Thread): Promise<void> {
  const c = await collections();
  await c.threads.replaceOne({ _id: thread._id }, thread, { upsert: true });
  await c.classifications.deleteOne({ _id: thread._id, status: { $ne: "published" } });
}

/** Threads sem classificação (a fila do worker), as mais recentes primeiro. */
export async function threadsWithoutClassification(limit = 200): Promise<Thread[]> {
  const { threads } = await collections();
  return threads
    .aggregate<Thread>([
      { $lookup: { from: "classifications", localField: "_id", foreignField: "_id", as: "cls" } },
      { $match: { cls: { $size: 0 } } },
      { $project: { cls: 0 } },
      { $sort: { startedAt: -1 } },
      { $limit: limit },
    ])
    .toArray();
}

/** Threads pelos ids, as mais recentes primeiro. */
export async function getThreads(ids: string[]): Promise<Thread[]> {
  const { threads } = await collections();
  return threads.find({ _id: { $in: ids } }).sort({ startedAt: -1 }).toArray();
}
