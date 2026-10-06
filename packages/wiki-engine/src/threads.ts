import type { Thread, Tweet } from "@sibs/core";
import { collections } from "@sibs/db";

/** Agrupa os tweets do autor por conversa e grava/atualiza as threads. Retorna os ids alterados. */
export async function rebuildThreads(conversationIds: string[]): Promise<string[]> {
  if (conversationIds.length === 0) return [];
  const c = await collections();
  const tweets = await c.tweets
    .find({ conversationId: { $in: conversationIds } })
    .sort({ createdAt: 1 })
    .toArray();

  const byConversation = new Map<string, Tweet[]>();
  for (const t of tweets) {
    const list = byConversation.get(t.conversationId) ?? [];
    list.push(t);
    byConversation.set(t.conversationId, list);
  }

  const now = new Date();
  for (const [conversationId, list] of byConversation) {
    const thread: Thread = {
      _id: conversationId,
      tweetIds: list.map((t) => t._id),
      text: list.map((t) => t.text).join("\n\n"),
      startedAt: list[0]!.createdAt,
      updatedAt: now,
    };
    await c.threads.replaceOne({ _id: conversationId }, thread, { upsert: true });
    // Thread mudou: precisa ser classificada de novo
    await c.classifications.deleteOne({ _id: conversationId, status: { $ne: "published" } });
  }
  return [...byConversation.keys()];
}

/** Threads que ainda não têm classificação. */
export async function threadsToClassify(limit = 200): Promise<Thread[]> {
  const c = await collections();
  return c.threads
    .aggregate<Thread>([
      { $lookup: { from: "classifications", localField: "_id", foreignField: "_id", as: "cls" } },
      { $match: { cls: { $size: 0 } } },
      { $project: { cls: 0 } },
      { $sort: { startedAt: -1 } },
      { $limit: limit },
    ])
    .toArray();
}
