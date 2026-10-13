import type { Thread, Tweet } from "@sibs/core";
import { saveThread, tweetsOfConversations } from "@sibs/db";

/** Agrupa os tweets do autor por conversa e grava/atualiza as threads. Retorna os ids alterados. */
export async function rebuildThreads(conversationIds: string[]): Promise<string[]> {
  if (conversationIds.length === 0) return [];
  const tweets = await tweetsOfConversations(conversationIds);

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
    await saveThread(thread); // se mudou e não estava publicada, volta para a classificação
  }
  return [...byConversation.keys()];
}
